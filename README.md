# CallAgent - Telefon-KI fuer Kay

Android-App (Default-Dialer), die Anrufe von **unbekannten Nummern** (nicht im
Adressbuch) automatisch annimmt: **Gemma**, Kays persoenliche Assistentin,
fuehrt das Gespraech mit einer menschlichen Stimme (Gemini-TTS "Kore") und
protokolliert Name, Anliegen und Rueckruf-Wunsch.

## Architektur

```
Android-App (Kotlin, Default-Dialer)
  CallScreeningService  -> unbekannte Nummer? -> annehmen
  InCallService         -> Audio-Greifen (VOICE_DOWNLINK/Downlink-Audio)
  Vosk STT (offline)    -> gesprochenen Text transkribieren
  HTTPS callagent.gemivo.de
     POST /api/start    -> Begruessung als WAV (24 kHz PCM)
     POST /api/turn     -> Antwort-Text + WAV
     POST /api/end      -> Zusammenfassung + Protokoll
  AudioTrack            -> Antwort in den Anruf spielen (Halbduplex)
```

## Server (gemivo)

- Dienst: `/opt/callagent/server.js` (Node, systemd `callagent`, Port 3114 intern)
- Oeffentlich: `https://callagent.gemivo.de` (nginx, LE-Cert)
- Auth: `X-App-Token` (liegt in `/opt/callagent/.app-token`)
- LLM: Mac-Mini-GPU (LiteLLM gemma4 via Tunnel 11440), Fallback gemini-3.8-flash
- Stimme: Gemini-TTS `gemini-2.5-flash-preview-tts`, Voice **Kore**, 24 kHz PCM -> WAV
- Protokoll: SQLite `/opt/callagent/data/calls.db`, Uebersicht: `/log`

## API

| Endpunkt | Body | Antwort |
|---|---|---|
| POST /api/start | `{nummer}` | `{session, begruessung_text, audio_b64}` |
| POST /api/turn | `{session, text}` | `{antwort_text, audio_b64, ende, motor}` |
| POST /api/end | `{session, grund}` | `{zusammenfassung}` |
| GET /log | - | HTML-Protokoll |

`audio_b64` = WAV (PCM 16 bit, 24 kHz, mono) base64.

## Rechtliches

Die KI stellt sich als Gemma, Kays Assistentin, vor (transparent).
Gespraechsverarbeitung nur mit Ansage - DSGVO/201-StGB beachten.

## Stand

- [x] Server-Backend komplett (start/turn/end/log, bewiesen per curl)
- [ ] Android-App (in Arbeit)

## Tests

    TOKEN=<app-token> ./server/test.sh

8/8 PASS (07.11.2026, live gegen callagent.gemivo.de)

## Testumgebung + Testlauf (07.11.2026, 01:55 Uhr)

    ssh gemivo 'cat /opt/callagent/.app-token'   # TOKEN holen
    TOKEN=<token> ./server/test.sh

Echter Output gegen https://callagent.gemivo.de (produktive Instanz):

    PASS health-ok
    PASS health-stimme (Kore)
    PASS start-session (c1794012643391-1)
    PASS start-audio (388410 Bytes WAV)
    PASS turn-ok (LLM-Antwort, motor:mini/gemini)
    PASS end-ok (Zusammenfassung in SQLite)
    PASS log-html (CallAgent-Protokoll-Seite)
    PASS auth-401 (ohne Token kein Zugriff)
    ALLE TESTS BESTANDEN

Syntax-Check: `node --check server/server.js` OK.
Sichtpruefung /log: /tmp/callagent-log.png (102621 Bytes, via ~/bin/sichtpruefung gerendert).
Keys/Token liegen AUSSERHALB des Repos auf dem Server (/opt/callagent/.app-token,
/opt/gemma-live/gemini-key-paid, /etc/gemma-live/llm-key) - im Code nur Pfade.

## Render-Nachweis

Log-Seite gerendert: `docs/log-screenshot.png` (via ~/bin/sichtpruefung, 07.11.2026).

## Einstieg / Betrieb

- Server auf gemivo: `/opt/callagent/server.js`, systemd `systemctl restart callagent`
- Aenderungen deployen: `rsync -a server/server.js gemivo:/opt/callagent/ && ssh gemivo systemctl restart callagent`
- Live-Checks: `curl https://callagent.gemivo.de/health`, Protokoll: `https://callagent.gemivo.de/log?token=<token>`
- Abhaengigkeiten: Node 22, sqlite3-CLI, Mini-Tunnel 11440 (LiteLLM gemma4), Gemini-Key (/opt/gemma-live/gemini-key-paid)

## Android-App (Etappe 2)

Natives Java-Android (kein TWA): Default-Dialer mit CallScreeningService +
InCallService + AudioLoop (Vosk-Offline-STT -> Server -> AudioTrack-Uplink).

**Installieren (Handy):**
1. APK laden: https://callagent.gemivo.de/apk/callagent-debug.apk
2. App oeffnen: Token eintragen (liegt auf gemivo: `/opt/callagent/.app-token`)
3. "Als Standard-Telefon-App festlegen" -> CallAgent waehlen
4. Rechte erteilen, Sprachmodell laden (~46 MB, einmalig)
5. Fertig: Bekannte Nummern klingeln normal, unbekannte nimmt Gemma an.

**Build (gemivo-Server):** Projekt liegt unter `/opt/callagent-app`,
`./gradlew assembleDebug`, APK landet in `app/build/outputs/apk/debug/`.

**Wichtig:** Telefon-Audio (VOICE_DOWNLINK/Uplink) ist geraeteabhaengig -
erster echter Testanruf noetig. Vosk small-de erkennt gutes Deutsch,
bei schlechter Erkennung: groesseres Modell (vosk-model-de-0.21).
