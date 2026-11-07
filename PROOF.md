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

## Fix-Runde 07.11.2026 ~04:00 (Claude) - Beweise

**Ursache "Dialer-Rolle verweigert":** Auf dem Handy lag die ALTE APK (sha1 1b7a29... = dist/callagent-debug.apk, ohne DialerActivity/InCallControl). Mit der aktuellen Build-APK: `cmd role add-role-holder android.app.role.DIALER de.gemivo.callagent 0` -> Rolleninhaber `de.gemivo.callagent`, alle Rechte GRANTED_BY_ROLE.

**E2E-Testanruf (Test-Leitung TestVerbindung, gleicher Telecom-Weg wie echter Anruf), logcat:**
```
I CallAgent: gespielt 8490 ms                     (Begruessung Kore ueber Lautsprecher, Route speaker)
I CallAgent: Audio-Quelle #0 nicht verfuegbar     (VOICE_DOWNLINK = nur System-Apps)
I CallAgent: Audio-Quelle #1 stille (avg 0)       (MIC)
I CallAgent: Audio-Quelle #2 stille (avg 0)       (VOICE_RECOGNITION)
I CallAgent: Audio-Quelle #3 stille (avg 0)       (VOICE_COMMUNICATION)
E CallAgent: Keine Audio-Quelle liefert Ton - Android sperrt das Mikro im Anruf (Audiohelfer an? false)
I CallAgent: KI legt auf / [Test] Ende 2 / onCallRemoved
```
calls.db #17 `+4940999000222|kein-audio|Anrufer hat nichts gesagt (nur Begrüßung von Gemma).`
Echter Mobilfunkanruf #16 (03:58, MODE_IN_CALL) zeigt dasselbe: Mikro liefert exakt 0.

**Server:** test.sh 8/8 PASS, Unit 5/5 PASS (inkl. denglisch + wiederholt). Zusammenfassung #12 jetzt echt
(vorher immer "keine Zusammenfassung": Callback `sum => ...` bekam `null` statt Text).

**Offen (Kay):** Android schaltet Mikro-Aufnahme fremder Apps im Anruf stumm. Gegenmittel: Audiohelfer
(Bedienungshilfe) in Einstellungen > Bedienungshilfen > CallAgent einschalten (per adb nicht erlaubt),
dann Testanruf von fremder Nummer. Status in der App: docs/app-status-audiohelfer.png.

## SIP-Weg 07.11.2026 ~04:20 (Claude) - Selbsttest bestanden

Testlauf `/opt/callagent/sip/selbsttest.sh` auf gemivo: Asterisk 20 ruft sich per SIP über 127.0.0.1 an (echtes SIP und RTP, alaw),
der Testanrufer spielt zwei Sätze, die Brücke `callagent-sip` (AudioSocket 127.0.0.1:3118, Vosk 16 kHz) antwortet als Gemma.
Journal (Auszug, Anruf #23):
```
Anruf ... von +4940999000333
gespielt 8.5 s                                     (Begrüßung Kore, 24k->8k)
Anrufer: hallo hier ist thomas becker von der firma solar fick ich wollte mit herrn konrad über sein angebot für die solaranlage sprechen er mich bitte morgen zurückrufen
Gemma (gemini): Guten Tag, Herr Becker, das richte ich gerne aus. Wie war der Firmenname bitte noch mal genau, und unter welcher Nummer kann Kay Sie morgen erreichen?
Anrufer: nein dafür für alle vielen dank und chi
Gemma (gemini): Alles klar, ich gebe die Nachricht so an Kay weiter. Einen schönen Tag noch und auf Wiederhören!
Ende (sip-aufgelegt): Zusammenfassung in calls.db #23
```
Sichtprüfung: `/log` listet #20 bis #23 mit Grund `sip-*` (per curl geprüft). Unit-Tests 5/5 PASS, `node --check` und `ast.parse` OK.
Bekannte Fehler aus dem Test sind behoben: Vosk braucht 16 kHz (vorher Absturz bei 8 kHz), das Anrufer-Verzeichnis gehört jetzt `asterisk`, und bei Paketpausen wird Stille nachgeschoben, damit Vosk das Satzende erkennt.
