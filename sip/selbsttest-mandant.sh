#!/usr/bin/env bash
# Multi-Tenant-Selbsttest OHNE echten Anbieter (gemivo Anrufassistent):
#  - Asterisk spielt selbst den "SIP-Anbieter" (Registrar testprov auf :5060)
#  - Testmandant 990003 registriert sich wie ein echter Kunde ueber transport-m4 (:5070)
#  - Testanruf an den Anbieter -> landet ueber die Registrierung beim Mandanten (line-Identifikation)
#  - Beweis: calls.user_id=990003, Begruessung mit dessen Namen + KI-Hinweis, Kay (uid 8) bekommt nichts
# Testmandant + Anbieter werden danach wieder entfernt. Kays Anschluss bleibt unberuehrt.
set -euo pipefail
DB=/opt/callagent/data/calls.db; UID_T=990003; CONF=/etc/asterisk/pjsip_testprov.conf
TOK=$(cat /opt/callagent/.app-token)
PW=$(openssl rand -hex 12)
sync() { curl -s -X POST -H "X-App-Token: $TOK" http://127.0.0.1:3114/api/intern/pjsip-sync; echo; }
aufraeumen() {
  # Reihenfolge wichtig (fail2ban!): erst Mandanten-Registrierung abmelden, solange testprov noch existiert,
  # sonst zaehlt das Abmelde-REGISTER als InvalidAccountID gegen die eigene Server-IP.
  sqlite3 -cmd ".timeout 5000" $DB "DELETE FROM ca_mandant WHERE user_id=$UID_T; DELETE FROM calls WHERE user_id=$UID_T;" || true
  sync >/dev/null; sleep 4
  rm -f "$CONF"; asterisk -rx "module reload res_pjsip.so" >/dev/null
}
trap aufraeumen EXIT
cat > "$CONF" <<T
; TEMPORAER von selbsttest-mandant.sh
[testprov-auth]
type=auth
auth_type=userpass
username=testprov
password=$PW
[testprov]
type=aor
max_contacts=1
remove_existing=yes
[testprov]
type=endpoint
context=testprov-leer
disallow=all
allow=alaw,ulaw
auth=testprov-auth
aors=testprov
direct_media=no
callerid=Testanrufer <+4915199999999>
T
chown root:asterisk "$CONF"; chmod 640 "$CONF"
grep -q pjsip_testprov.conf /etc/asterisk/pjsip.conf || echo "#tryinclude pjsip_testprov.conf" >> /etc/asterisk/pjsip.conf
# FEHLKEY=1: absichtlich ungueltiger Key -> erwartet Ansage + grund live-fehler + Rueckruf-Hinweis
if [ "${FEHLKEY:-0}" = "1" ]; then
  KEYENC=$(cd /opt/callagent && node -e "console.log(require('./mandant').verschluesseln('AIzaSyUNGUELTIG_selbsttest_0000000000000'))")
else
  KEYENC=$(cd /opt/callagent && node -e "const m=require('./mandant');console.log(m.verschluesseln(require('fs').readFileSync('/opt/gemma-live/gemini-key-paid','utf8').trim()))")
fi
PWENC=$(cd /opt/callagent && node -e "console.log(require('./mandant').verschluesseln(process.argv[1]))" "$PW")
sqlite3 -cmd ".timeout 5000" $DB "INSERT OR REPLACE INTO ca_mandant(user_id,email,vorname,aussprache,sip_modus,sip_server,sip_port,sip_user,sip_pass_enc,sip_nummer,sip_ipv,gemini_key_enc,gemini_status,notify_email,notify_push,aktiv,limit_monat,owner,erstellt,geaendert)
 VALUES($UID_T,'test$UID_T@example.invalid','Jörg','','anbieter','116.203.204.226',5060,'testprov','$PWENC','04519999990','v4','$KEYENC','ok',0,0,1,300,0,datetime('now'),datetime('now'));"
asterisk -rx "module reload res_pjsip.so" >/dev/null
echo "Sync: $(sync)"
for i in $(seq 1 15); do
  S=$(asterisk -rx "pjsip show registrations" | grep "m$UID_T-reg" || true)
  echo "$S" | grep -q Registered && break; sleep 1
done
echo "Registrierung Mandant: $S"
echo "Kay: $(asterisk -rx 'pjsip show registrations' | grep anbieter-reg)"
echo "$S" | grep -q Registered || { echo "FAIL: Mandant nicht registriert"; exit 1; }
VOR=$(sqlite3 $DB "SELECT IFNULL(MAX(id),0) FROM calls;")
asterisk -rx "channel originate PJSIP/testprov extension s@testanrufer"
echo "Anruf laeuft (ca. 70 s) ..."
for i in $(seq 1 30); do
  sleep 5
  N=$(sqlite3 $DB "SELECT COUNT(*) FROM calls WHERE id>$VOR AND zusammenfassung IS NOT NULL;")
  [ "$N" -gt 0 ] && break
done
sqlite3 -line $DB "SELECT id,user_id,nummer,grund,substr(transkript,1,400) AS transkript,zusammenfassung FROM calls WHERE id>$VOR;"
U=$(sqlite3 $DB "SELECT user_id FROM calls WHERE id>$VOR LIMIT 1;")
if [ "${FEHLKEY:-0}" = "1" ]; then
  G=$(sqlite3 $DB "SELECT grund||' | '||zusammenfassung FROM calls WHERE id>$VOR LIMIT 1;")
  echo "$G" | grep -q "live-fehler | Gemma konnte das Gespräch nicht führen" && echo "PASS Gemini-Ausfall: Ansage + Rueckruf-Hinweis ($G)" || { echo "FAIL Gemini-Ausfall: $G"; exit 1; }
  exit 0
fi
B=$(sqlite3 $DB "SELECT transkript FROM calls WHERE id>$VOR LIMIT 1;")
[ "$U" = "$UID_T" ] && echo "PASS Anruf dem Mandanten $UID_T zugeordnet" || { echo "FAIL Zuordnung ($U)"; exit 1; }
echo "$B" | grep -q "digitale Assistentin von Jörg" && echo "PASS Begruessung mit Mandanten-Name + KI-Hinweis" || { echo "FAIL Begruessung"; exit 1; }
echo "$B" | grep -qw "Kay" && { echo "FAIL Kay im Mandanten-Gespraech"; exit 1; } || echo "PASS kein Kay im Gespraech"
journalctl -u callagent --since "-3 min" --no-pager | grep -E "web-melden|telegram" | tail -3
