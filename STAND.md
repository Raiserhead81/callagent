# CallAgent – Stand 07.11.2026 (live, von Kay bestätigt)

## Kette (laeuft)
1. Unbekannte/unterdrueckte Nummer ruft Kays Handy (OnePlus PMA110, ColorOS/Android 17).
2. App `de.gemivo.callagent` v1.3-screening haelt NUR `ROLE_CALL_SCREENING` (Dialer = `com.android.contacts`), lehnt ab (respondToCall reject). Kontakte reicht Android gar nicht an die App weiter, App prueft zusaetzlich; ohne READ_CONTACTS lehnt sie NICHTS ab.
3. Netz-Umleitung bei besetzt `**67*045130433056#` (aktiv) -> FritzBox-Nummer 0451 30433056.
4. FritzBox 6670 "IP-Telefon 1" (User `gemmacall`, intern **620, nur 30433056) -> gemivo per WireGuard wg0 192.168.178.202 (ufw wg0 5062 + 10000:10100/udp), Asterisk 20 PJSIP registriert.
5. AudioSocket -> `/opt/callagent/sip/callagent_sip.py` + `callagent_live.py` (systemd `callagent-sip`): Gemini Live `gemini-3.8-live`, Stimme Kore, paid-Key `/opt/gemma-live/gemini-key-paid`, google-genai 2.25.0 im sip-venv. Antwort 1-2 s. Werkzeug `auflegen`. Fallback: alter Weg (Vosk -> Text-LLM -> TTS, 8-9 s).
6. Backend `/opt/callagent/server.js` (systemd `callagent`, :3114, https://callagent.gemivo.de, Log-UI /log): /api/start {live:true} liefert Prompt, /api/notiz Transkript, /api/end Zusammenfassung (Gemini zuerst, Mini Ersatz) + Telegram an Kay (Hermes-Bot, Token `/opt/callagent/telegram.env`, Chat 805026354).

## Verhalten (Kays Wuensche)
- Begruessung "hier spricht Gemma, die Assistentin von Kai" (ohne Nachnamen; fuer die Stimme "Kai" = Kay gefiel so; Protokoll/Telegram wieder "Kay").
- Klares Anliegen -> sofort bestaetigen + Wunsch wiederholen + schoenen Tag + auflegen. Keine Zeitversprechen.
- Max 60 s (Abschied-Hinweis bei 45 s), 10 s Stille -> auflegen.
- Kosten: FritzBox/SIP 0 EUR, Umleitung zaehlt als Festnetz-Anruf (Flat, nicht verifiziert), Gemini wenige Cent/Monat.
- Aus: `##67#` oder KI-Schalter in der App.

## Fallen / Lehren
- 🔴 Android: Fremd-Apps bekommen im Mobilfunk-Call weder Mikro noch Einspeisen -> nur SIP-Weg funktioniert. Dialer-Rolle-Ansatz verworfen.
- 🔴 ColorOS friert App bei Sperre ein -> Screening wird nicht gebunden. Fix: `dumpsys deviceidle whitelist +de.gemivo.callagent` + Akku "Hintergrundaktivitaeten zulassen".
- 🔴 Asterisk sendet in Sprechpausen kein RTP -> Stille in ECHTZEIT nachliefern, sonst kein Gemini-ACTIVITY_END. Stille-Uhr am Sprachpegel (>300), nicht am Transkript.
- FritzBox TR-064 SetClient4 scheitert an 2FA (866) -> IP-Telefon per adb im Handy-Chrome-UI angelegt, Kay drueckt Taste.
- MMI per adb: "+" geht in tel:-URI verloren -> nationales Format + ACTION_DIAL + Wahltaste tippen.
- `adb install -r` immer per `dumpsys package ... versionName` pruefen; pm grant blockiert -> Rechte per Einstellungen-UI.
- Mini-LLM fuer Telefon zu langsam/Denglisch/chinesische Zeichen/erfundene Firmen -> Gemini.

## Repo / Build
GitHub Raiserhead81/callagent (main, letzter e8cc7d8+), lokal ~/callagent-app (Air). APK-Build auf gemivo /opt/callagent-app (`./gradlew clean assembleDebug`, SDK /opt/android-sdk). Backups /opt/_backups/callagent/. Selbsttest `/opt/callagent/sip/selbsttest.sh`, Live-API-Test `server/test.sh`, Unit `server/test-unit.js`. Lock-Bereich `callagent`.
