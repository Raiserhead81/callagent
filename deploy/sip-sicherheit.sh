#!/bin/bash
# SIP-Absicherung fuer anruf.gemivo.de (07.11.2026, Kay: "will kein Sicherheitsloch")
# Laeuft auf gemivo als root:  ssh ... 'bash -s' < deploy/sip-sicherheit.sh
#
# Schicht 1: Port 5070/udp + RTP 10000-10100/udp NICHT weltweit offen, sondern nur fuer die
#            Adressen der eingetragenen Nutzer-Boxen/SIP-Anbieter (Allowlist, alle 5 Min aktualisiert).
# Schicht 2: Asterisk schreibt ein Security-Log, fail2ban sperrt Angreifer nach 3 Fehlversuchen 24 h
#            (gilt auch fuer Adressen auf der Allowlist).
# Schicht 3: Asterisk hat KEINEN anonymen Endpoint (bereits so) -> unbekannte Anrufer werden abgewiesen.
set -euo pipefail
T=$(date +%Y%m%d-%H%M%S); B=/opt/_backups/sip-sicherheit; mkdir -p "$B"

# --- Schicht 2a: Asterisk Security-Log ---
cp -p /etc/asterisk/logger.conf "$B/logger.conf.$T"
if ! grep -qE '^security *=>' /etc/asterisk/logger.conf; then
  sed -i '/^\[logfiles\]/a security => security' /etc/asterisk/logger.conf
fi
asterisk -rx "logger reload" >/dev/null

# --- Schicht 2b: fail2ban-Jail ---
cat > /etc/fail2ban/jail.d/asterisk-callagent.local <<'EOF'
[asterisk]
enabled  = true
filter   = asterisk
logpath  = /var/log/asterisk/security
           /var/log/asterisk/messages
backend  = auto
banaction = iptables-allports
maxretry = 3
findtime = 600
bantime  = 86400
ignoreip = 127.0.0.1/8 ::1 192.168.178.0/24
EOF
touch /var/log/asterisk/security /var/log/asterisk/messages
systemctl reload fail2ban || systemctl restart fail2ban

# --- Schicht 1: Allowlist-Skript ---
cat > /usr/local/sbin/sip-allowlist <<'EOF'
#!/bin/bash
# Oeffnet 5070/udp + 10000:10100/udp nur fuer Hosts aus /etc/asterisk/pjsip_mandanten.conf
# (server_uri=, client_uri=, contact=, match=). Regeln tragen den Kommentar "sip-mandant".
set -uo pipefail
CONF=/etc/asterisk/pjsip_mandanten.conf
hosts=$(grep -hoE '^(server_uri|client_uri|contact|outbound_proxy|match) *= *[^ ;]+' "$CONF" 2>/dev/null \
  | sed -E 's/^[a-z_]+ *= *//; s/^sips?://; s/^[^@]*@//; s/;.*$//; s/^\[([^]]+)\].*/\1/; s/:[0-9]+$//' \
  | grep -vE '^(127\.|::1|0\.0\.0\.0)' | sort -u)
soll=""
for h in $hosts; do
  if [[ "$h" =~ ^[0-9.]+(/[0-9]+)?$ || "$h" =~ : ]]; then soll+="$h"$'\n'; continue; fi
  soll+="$(getent ahosts "$h" | awk '{print $1}' | sort -u)"$'\n'
done
# Zusatz-Netze (SIP-Anbieter senden Anrufe teils von anderen Adressen als ihr Registrar-Name),
# eine Adresse/CIDR pro Zeile, z.B. sipgate 217.10.64.0/20 - nur eintragen, wenn ein Nutzer den Anbieter nutzt
[ -f /etc/asterisk/sip-allowlist-extra ] && soll+="$(grep -vE '^\s*(#|$)' /etc/asterisk/sip-allowlist-extra)"$'\n'
soll=$(echo "$soll" | grep -v '^$' | sort -u)
ist=$(ufw status | awk '/sip-mandant/ && /5070/ {print $3}' | sort -u)
for ip in $soll; do
  echo "$ist" | grep -qxF "$ip" && continue
  ufw allow from "$ip" to any port 5070 proto udp comment sip-mandant >/dev/null
  ufw allow from "$ip" to any port 10000:10100 proto udp comment sip-mandant >/dev/null
  logger -t sip-allowlist "offen fuer $ip"
done
for ip in $ist; do
  echo "$soll" | grep -qxF "$ip" && continue
  ufw delete allow from "$ip" to any port 5070 proto udp >/dev/null 2>&1 || true
  ufw delete allow from "$ip" to any port 10000:10100 proto udp >/dev/null 2>&1 || true
  logger -t sip-allowlist "geschlossen fuer $ip"
done
EOF
chmod 750 /usr/local/sbin/sip-allowlist
echo '*/5 * * * * root /usr/local/sbin/sip-allowlist' > /etc/cron.d/sip-allowlist
/usr/local/sbin/sip-allowlist

# --- Kontrolle ---
echo "== fail2ban:"; fail2ban-client status asterisk | tail -3
echo "== ufw 5070 (nur sip-mandant-Regeln, kein 'Anywhere'):"; ufw status | grep -E '5070|10000:10100' || echo "(noch keine Nutzer-Box -> Port fuer alle zu)"
echo "== asterisk security log:"; asterisk -rx "logger show channels" | grep -i security
echo SIP-SICHERHEIT-OK
