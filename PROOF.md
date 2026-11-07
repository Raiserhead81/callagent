# Testprotokoll (07.11.2026, live bewiesen)

## Server-API (curl gegen https://callagent.gemivo.de)

1. `/health` -> `{"ok":true,"stimme":"Kore"}`
2. `POST /api/start` (nummer +4917112345678) -> ok:true, session `c1794011092884-1`,
   WAV 373050 Bytes (Gemini-TTS Kore, 24 kHz PCM)
3. `POST /api/turn` "Thomas von Solarfix..." -> ok:true, motor:mini,
   Antwort: "Ich notiere: Thomas von Solarfix... Kay meldet sich heute noch."
   WAV 901050 Bytes
4. `POST /api/turn` "Sandra Zahnarztpraxis..." -> ok:true, motor:mini
5. `POST /api/end` -> ok:true, Protokoll in SQLite `calls.db`
6. `GET /log` -> HTML-Liste, Eintraege #1..#8 sichtbar (curl-Auszug geprueft)
7. `GET /log/3` -> Transkript mit "Anrufer: Hi, Sandra von der Zahnarztpraxis..."
8. Screenshot: /tmp/callagent-log.png (102621 Bytes, via ~/bin/sichtpruefung gerendert)

## Infra-Beweise

- systemd `callagent` -> active, Port 3114 (3111-3113 belegt)
- nginx `callagent.gemivo.de`: HTTP->HTTPS-301, Let's-Encrypt-Cert bis 04.02.2027
- Mini-GPU: rapidmlx auf :8801 healthy, LiteLLM-Key-Auth ok,
  gemma4-Antwort: "Ja, kay ist gerade am Telefon..."
- Gemini-Fallback: gemini-2.5-flash -> 404 (deprecated), auf gemini-3.8-flash
  umgestellt und live getestet ("ok")

## Stand bei PAUSE (07.11. 03:50)

- Backend laeuft + getestet (Unit 3/3, Live 8/8, Gemini-3.8-Fallback).
- /handshake-Endpunkt eingebaut, aber Bug: Token-Pruefe greift vor Seitenaufruf (Fix: /handshake vor Token-Check ausnehmen).
- App vom OnePlus DEINSTALLIERT (ColorOS-Blockade ungeloest: Dialer-Rolle verweigert, schemalose DIAL-Filter werden vom PM beim Install geloescht, install -r teils nur scheinbar erfolgreich - IMMER versionName per dumpsys pruefen).
- Wiederaufnahme: Rechte nur per App-UI-Dialog (adb pm grant verweigert), Token+Vosk per run-as einspielen (Anleitung im Auftrags-Text der letzten Session), clean build wegen Gradle-Cache.
