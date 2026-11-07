#!/usr/bin/env bash
# Lokaler Ende-zu-Ende-Test OHNE Anbieter: Asterisk ruft sich selbst per SIP (127.0.0.1) an.
# Der Testanrufer spielt zwei Saetze (TTS-WAVs), die Bruecke antwortet als Gemma.
# Beweis: journalctl -u callagent-sip + neuer Eintrag in calls.db (nummer = 'selbsttest').
set -euo pipefail
S=/var/lib/asterisk/sounds/callagent
mkdir -p "$S"
if [ ! -f "$S/anrufer-satz.wav" ]; then
  echo "Erzeuge Anrufer-Saetze per Gemini-TTS (Stimme Puck) ..."
  KEY=$(cat /opt/gemma-live/gemini-key-paid)
  tts() { # text datei
    curl -s -m 60 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
      -H "x-goog-api-key: $KEY" -H "Content-Type: application/json" \
      -d "{\"contents\":[{\"parts\":[{\"text\":\"$1\"}]}],\"generationConfig\":{\"responseModalities\":[\"AUDIO\"],\"speechConfig\":{\"voiceConfig\":{\"prebuiltVoiceConfig\":{\"voiceName\":\"Puck\"}}}}}" \
    | python3 -c 'import sys,json,base64;j=json.load(sys.stdin);d=[p for p in j["candidates"][0]["content"]["parts"] if "inlineData" in p][0]["inlineData"]["data"];sys.stdout.buffer.write(base64.b64decode(d))' > /tmp/ca-tts.raw
    sox -t raw -r 24000 -e signed -b 16 -c 1 /tmp/ca-tts.raw -r 8000 -c 1 "$2"
    rm -f /tmp/ca-tts.raw
  }
  tts "Hallo, hier ist Thomas Becker von der Firma Solarfix. Ich wollte mit Herrn Conrad über sein Angebot für die Solaranlage sprechen. Er soll mich bitte morgen zurückrufen." "$S/anrufer-satz.wav"
  tts "Nein, das war alles. Vielen Dank und tschüss." "$S/anrufer-tschuess.wav"
  chown -R asterisk:asterisk "$S"
fi
VOR=$(sqlite3 /opt/callagent/data/calls.db "SELECT IFNULL(MAX(id),0) FROM calls;")
asterisk -rx "channel originate PJSIP/selbsttest@selbsttest extension s@testanrufer" 
echo "Anruf laeuft (ca. 70 s) ..."
for i in $(seq 1 30); do
  sleep 5
  N=$(sqlite3 /opt/callagent/data/calls.db "SELECT COUNT(*) FROM calls WHERE id>$VOR AND zusammenfassung IS NOT NULL;")
  [ "$N" -gt 0 ] && break
done
sqlite3 -line /opt/callagent/data/calls.db "SELECT id,nummer,start,ende,grund,transkript,zusammenfassung FROM calls WHERE id>$VOR;"
