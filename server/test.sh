#!/usr/bin/env bash
# CallAgent Live-API-Test: laeuft gegen die produktive Instanz.
# Aufruf: TOKEN=... ./test.sh   (Token liegt auf gemivo in /opt/callagent/.app-token)
set -e
BASE="${BASE:-https://callagent.gemivo.de}"
TOKEN="${TOKEN:?Umgebungsvariable TOKEN fehlt}"
FEHLER=0

check() { # name erwartet ist
  local name="$1" ist="$2"
  if [ "$ist" = "$3" ] || echo "$ist" | grep -qE "$3"; then echo "PASS $name"; else echo "FAIL $name (erwartet: $3, ist: $ist)"; FEHLER=1; fi
}

# 1) Health
H=$(curl -s -m 10 "$BASE/health")
check "health-ok" "$(echo "$H" | python3 -c 'import json,sys;print(json.load(sys.stdin)["ok"])')" "True"
check "health-stimme" "$H" "Kore"

# 2) Start (Begruessung + WAV)
R=$(curl -s -m 60 -X POST "$BASE/api/start" -H "X-App-Token: $TOKEN" -H "Content-Type: application/json" -d '{"nummer":"+491700000000"}')
SID=$(echo "$R" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("session",""))')
check "start-session" "$SID" "^c[0-9]+-"
BYTES=$(echo "$R" | python3 -c 'import json,sys,base64;d=json.load(sys.stdin);a=d.get("audio_b64","");print(len(base64.b64decode(a)) if a else 0)')
if [ "$BYTES" -gt 10000 ]; then echo "PASS start-audio ($BYTES Bytes WAV)"; else echo "FAIL start-audio ($BYTES Bytes)"; FEHLER=1; fi

# 3) Turn (LLM-Antwort + WAV)
R=$(curl -s -m 120 -X POST "$BASE/api/turn" -H "X-App-Token: $TOKEN" -H "Content-Type: application/json" -d "{\"session\":\"$SID\",\"text\":\"Testanruf von Musterfirma, Rueckruf erbeten.\"}")
check "turn-ok" "$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("ok"))')" "True"

# 4) End (Zusammenfassung)
R=$(curl -s -m 150 -X POST "$BASE/api/end" -H "X-App-Token: $TOKEN" -H "Content-Type: application/json" -d "{\"session\":\"$SID\",\"grund\":\"test\"}")
check "end-ok" "$(echo "$R" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("ok"))')" "True"

# 5) Log-Seite
L=$(curl -s -m 10 "$BASE/log?token=$TOKEN")
check "log-html" "$L" "CallAgent-Protokoll"

# 6) Auth-Schutz
A=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$BASE/api/start" -X POST -d '{}')
check "auth-401" "$A" "401"

if [ "$FEHLER" = "0" ]; then echo "ALLE TESTS BESTANDEN"; else echo "TESTS FEHLGESCHLAGEN"; exit 1; fi
