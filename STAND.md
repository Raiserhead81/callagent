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

# Produkt „Gemma Anrufassistent“ (Multi-Tenant, ab 07.11.2026)
- Web: https://anruf.gemivo.de (Next.js 16 standalone, `web/`, /opt/gemivo-anruf, systemd `gemivo-anruf`, :3124). Öffentlich: `/`, `/anleitung`. Mit gemivo-SSO: `/app` (Dashboard), `/einrichtung`, `/koppeln`, `/admin` (nur uid 8).
- Gemeinsame DB `/opt/callagent/data/calls.db` (WAL). Tabellen legt die Engine an (`server/mandant.js` migrieren(), additiv): `calls.user_id`, `ca_mandant`, `ca_geraet`, `ca_kopplung`, `ca_tg_link`, `ca_push`, `ca_feedback`, `ca_funnel`. Prisma nur als Client, NIE db push/migrate.
- Kay = Mandant uid 8, `sip_modus=legacy` (Registrierung weiter aus sip.env/wg0, wird nie generiert), paid-Key-Datei, Telegram Hermes. Alle alten Anrufe user_id=8.
- Fremde Mandanten: `/etc/asterisk/pjsip_mandanten.conf` (generiert, transport-m4 0.0.0.0:5070 + transport-m6 [::]:5070, je Mandant m<uid>-reg mit line=yes, endpoint set_var=CA_TENANT=<uid>). Dialplan schreibt CA_TENANT in die Anrufer-Datei, Brücke reicht `tenant` an /api/start, Engine liefert Prompt + BYOK-Key, Zusammenfassung über den Nutzer-Key, Benachrichtigung über Web-App (/api/intern/benachrichtigen: Push/E-Mail). Ohne Freigabe (kein Key/Name/inaktiv/Limit/Abo): feste Ansage `sip/ansage-inaktiv.sln` + auflegen.
- Secrets: SIP-Pass + Gemini-Key AES-256-GCM, Schlüssel `/etc/gemivo/anruf.key` (600).
- Bezahlschranke vorbereitet (`web/src/lib/zugang.ts`, 14 Tage Test, Plan anruf/bundle), per `ANRUF_PAYWALL=false` AUS (Kay: Beta kostenlos).
- Tests: `server/test-unit.js`, `web` vitest (`npm test`), Playwright E2E auf gemivo `node /opt/gemivo-anruf/tests/e2e/run.mjs`, SIP-Mandanten-Selbsttest `/opt/callagent/sip/selbsttest-mandant.sh`, Kays Selbsttest `/opt/callagent/sip/selbsttest.sh`.
- Deploy Web: `deploy/deploy-web.sh`. APK: `/var/www/apk-host/anruf.gemivo.de/download/gemivo-anruf.apk` (v2.0-assistent, Debug-Signatur wie 1.3).
- Rechtstexte nur als ENTWURF in `docs/rechtstexte-entwurf/` (nicht verlinkt).
