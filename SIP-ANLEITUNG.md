# CallAgent über SIP: Gemma nimmt Anrufe auf dem Server an

Ablauf: Handy leitet um (bei Nichtannahme/besetzt/nicht erreichbar) → Rufnummer, die auf
gemivo per SIP registriert ist → Asterisk nimmt an → `callagent-sip` (Vosk-Spracherkennung,
Gemma/Gemini, Stimme Kore) → Transkript und Zusammenfassung in `calls.db`, sichtbar unter
`https://callagent.gemivo.de/log` und in der App (Button "Protokoll").

Auf dem Server ist alles fertig und getestet. Es fehlen nur die Zugangsdaten.

## Welche Rufnummer? (Stand Nov. 2026)

| Weg | Kosten | API | Bewertung |
|---|---|---|---|
| **A: Eigene FritzBox** (6670 Cable, Festnetznummer vom Kabelanschluss) | **0 €**: Nummer ist schon da; gemivo hängt bereits im FritzBox-WireGuard (192.168.178.202) | **TR-064** (gratis): Anrufliste, Rufumleitung, Anrufmonitor (Port 1012, Ereignis "RING" mit Anrufernummer) | **Empfehlung** |
| B: sipgate + sipgate.io | Paket sipgate.io S kostet 0 €, setzt aber ein sipgate-Konto voraus. Günstigster Tarif ist business S für 12,95 € pro User und Monat (mind. 2 User). Die alten Privattarife (basic) gibt es nicht mehr. | REST-API gratis, 100 Webhooks gratis, danach 4,9 ct pro Anruf | gute API, aber **nicht kostenlos** |
| C: Kleine VoIP-Anbieter (bellSIP Light, dus.net, peoplefone, einfachVOIP) | keine Grundgebühr, Nummer kostet etwa 5 bis 12 € pro Jahr oder einmalig etwa 10 € | meist keine Anruf-API | fast gratis, ohne API |

Nicht mehr gratis: sipgate basic (eingestellt), easybell Call basic (seit 2023 nicht für Neukunden), fonial Free
(laut teltarif-Forum seit 01.04.2026 abgeschafft).

**Rufumleitung Handy → deutsche Festnetznummer:** Die Weiterleitung rechnet der Mobilfunkanbieter
wie einen abgehenden Anruf ab. In einer Allnet-Flat mit Festnetz-Flatrate ist sie deshalb meist
enthalten. Eine verbindliche Aussage von fraenk/Telekom dazu habe ich nicht gefunden: Bitte einmal
in der Rechnung bzw. App prüfen, nachdem die Umleitung eingerichtet ist.

## Weg A: FritzBox (empfohlen, gratis)

1. Öffne `http://192.168.178.1` → Telefonie → Telefoniegeräte → **Neues Gerät einrichten** →
   Telefon (mit und ohne Anrufbeantworter) → **LAN/WLAN (IP-Telefon)**, Name `CallAgent`.
2. Benutzername (z. B. `callagent`) und ein langes Kennwort vergeben. Die FritzBox verlangt die
   Bestätigung am Gerät (Taste drücken) oder per FRITZ!Fon.
3. **Ankommende Anrufe:** Wähle nur die Rufnummer, auf die das Handy umleiten soll (am besten eine
   zweite Kabel-Rufnummer, damit dein normales Festnetztelefon nicht mitklingelt).
4. Auf gemivo `/opt/callagent/sip.env` bearbeiten (`nano /opt/callagent/sip.env`):
   ```
   SIP_MODUS=fritzbox
   SIP_SERVER=192.168.178.1
   SIP_USER=callagent
   SIP_PASS=<Kennwort aus Schritt 2>
   SIP_BIND_IP=192.168.178.202
   SIP_NUMMER=<diese Festnetznummer>
   ```
5. Firewall nur fürs Heimnetz-VPN öffnen und Konfiguration schreiben:
   ```
   ufw allow in on wg0 to any port 5062 proto udp
   ufw allow in on wg0 to any port 10000:10100 proto udp
   /opt/callagent/sip/sip-konfig.sh
   ```
   Erfolg: `pjsip show registrations` zeigt `Registered`. In der FritzBox steht das Gerät als "registriert".
6. Optional für die API (Anrufliste/Umleitung per TR-064): FritzBox-Benutzer mit dem Recht
   "Sprachnachrichten, Faxnachrichten, FRITZ!App Fon und Anrufliste" anlegen und in `sip.env`
   `FRITZ_USER`/`FRITZ_PASS` eintragen.

## Weg B: sipgate (falls du ein Konto hast oder buchst)

1. app.sipgate.com → Telefonie → Geräte → **VoIP-Telefon hinzufügen**. Dort stehen die SIP-ID
   (z. B. `1234567e0`), das SIP-Passwort und der Registrar `sipgate.de`. Weise die Rufnummer dem Gerät zu.
2. `sip.env`: `SIP_MODUS=anbieter`, `SIP_SERVER=sipgate.de`, `SIP_USER=<SIP-ID>`, `SIP_PASS=<SIP-Passwort>`,
   `SIP_BIND_IP=` leer lassen.
3. API: app.sipgate.com → Persönliche Zugangstoken (Personal Access Token) → neues Token mit den
   Scopes `history:read`, `devices:read`, `numbers:read` (für eine Umleitung per API zusätzlich
   `devices:callforwardings:write`). Trage Token-ID und Token als `SIPGATE_TOKEN_ID`/`SIPGATE_TOKEN` ein.
   Für Webhooks bei eingehenden Anrufen (Push-API) trägst du in sipgate.io die URL
   `https://callagent.gemivo.de/...` ein. Der Endpunkt ist noch nicht gebaut, weil sipgate nicht gratis ist.
4. Firewall: Die Registrierung geht von gemivo aus nach außen, eingehende Pakete kommen von sipgate.
   Öffne nur für sipgate: `ufw allow from 217.10.64.0/20 to any port 5060,10000:10100 proto udp`.
   Prüfe vorher die aktuellen IP-Bereiche bei sipgate.
5. `/opt/callagent/sip/sip-konfig.sh`

## Rufumleitung am Handy (GSM-Codes, in der Telefon-App wählen und Anruftaste drücken)

Nummer im Format `+49...` (die SIP- bzw. FritzBox-Festnetznummer):

| Wann | Einschalten | Ausschalten |
|---|---|---|
| Nicht angenommen (nach 20 s) | `**61*+49XXXXXXXX*11*20#` | `##61#` |
| Besetzt | `**67*+49XXXXXXXX#` | `##67#` |
| Nicht erreichbar (aus, kein Netz) | `**62*+49XXXXXXXX#` | `##62#` |
| Alle drei zusammen | `**004*+49XXXXXXXX#` | `##004#` |

Achtung: `**004#` überschreibt eine eingerichtete Mailbox-Umleitung. Status prüfen mit `*#61#`, `*#67#`, `*#62#`.
Bekannte Anrufer lassen sich damit nicht ausnehmen: Die Umleitung greift für alle Anrufe, die du nicht annimmst.

## Test und Betrieb

- Selbsttest ohne Anbieter (Asterisk ruft sich per SIP selbst an, ein Testanrufer spricht):
  `/opt/callagent/sip/selbsttest.sh` → zeigt den neuen `calls.db`-Eintrag.
- Live-Log: `journalctl -u callagent-sip -f` (Anrufer, erkannter Text, Gemma-Antwort, Ende)
- Dienste: `asterisk`, `callagent-sip` (Brücke 127.0.0.1:3118), `callagent` (Backend :3114)
- Abschalten: `SIP_MODUS=aus` in `sip.env` → `sip-konfig.sh`
