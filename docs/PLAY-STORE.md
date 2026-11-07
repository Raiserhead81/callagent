# Play-Store-Start „Gemma Anrufassistent“ – Checkliste für Kay

Stand 07.11.2026. **Vorbereitet, NICHT eingereicht.** Alles Technische liegt bereit; die Schritte unten kann nur Kay in der Play Console machen.

## Was bereitliegt
| Was | Wo |
|---|---|
| AAB 2.4-play (versionCode 9, targetSdk 36, **unsigniert**) | gemivo `/opt/callagent-play/gemivo-anruf-2.4-vc9-UNSIGNIERT.aab` |
| Signier-Skript (erzeugt Upload-Key **nur nach deinem OK**) | gemivo `/opt/callagent-play/play-signieren.sh` (Kopie `docs/play/play-signieren.sh`) |
| Store-Texte DE / EN | `docs/play/listing-de.md`, `docs/play/listing-en.md` |
| App-Symbol 512×512, Feature-Grafik 1024×500 | `docs/play/play-icon-512.png`, `docs/play/feature-graphic.png` |
| 7 Handy-Screenshots 1080×2160 (Verhältnis 2:1, Emulator, keine private Statusleiste) | `docs/play/screenshots/` |
| Berechtigungs-Begründungen | `docs/play/berechtigungen.md` |
| Datensicherheit (Data Safety) | `docs/play/data-safety.md` |
| Rechtstexte (Datenschutz, AVV, AGB-Ergänzung) | `docs/rechtstexte-entwurf/` – **Entwürfe, du musst sie final freigeben und veröffentlichen** |

## Vorher entscheiden
1. **Upload-Key:** Für `de.gemivo.callagent` gibt es noch keinen. Mit deinem OK auf gemivo `bash /opt/callagent-play/play-signieren.sh` ausführen (fragt ein Passwort, erzeugt `anruf-upload.jks`, signiert das AAB). Schlüssel + Passwort sicher sichern.
2. **Bestehende APK-Nutzer (auch dein Handy):** Die Direkt-APK ist mit einem anderen Schlüssel signiert als die spätere Play-Version. Ein Wechsel von APK auf Play geht nur mit Deinstallieren + Neuinstallieren (Einstellungen liegen auf dem Server und bleiben; Rolle/Rechte neu vergeben).
3. **Datenschutzerklärung-URL:** Play verlangt eine öffentliche URL. Entwurf freigeben und z. B. unter `https://gemivo.de/datenschutz-anruf.html` veröffentlichen.
4. **Länder/Sprache:** App spricht nur Deutsch → Vorschlag: nur DE/AT/CH, nur deutscher Eintrag (EN-Text liegt bereit, falls gewünscht).

## Klicks in der Play Console
1. play.google.com/console → **App erstellen** → Name „Gemma Anrufassistent“, Standardsprache Deutsch, **App**, **Kostenlos**, Erklärungen bestätigen.
2. **Dashboard › App einrichten:**
   - *Datenschutzerklärung*: URL eintragen (siehe oben).
   - *App-Zugriff*: „Alle oder einige Funktionen sind eingeschränkt“ → Anleitung für Prüfer: Test-gemivo-Konto anlegen und Zugangsdaten hinterlegen; Hinweis, dass für echte Anrufe eine FRITZ!Box/SIP-Nummer und ein Gemini-Schlüssel nötig sind (Einrichtungsassistent und Erklärungen sind ohne prüfbar).
   - *Anzeigen*: Nein.
   - *Einstufung des Inhalts*: Fragebogen (Kategorie „Dienstprogramm/Produktivität/Kommunikation“, keine Gewalt etc.).
   - *Zielgruppe*: 18+ (nicht für Kinder).
   - *Datensicherheit*: nach `docs/play/data-safety.md` ausfüllen.
   - *Behörden-Apps / Finanzfunktionen / Gesundheit*: Nein.
3. **Store-Eintrag › Haupteintrag:** Texte aus `listing-de.md`, Symbol, Feature-Grafik, Screenshots hochladen; Kategorie Kommunikation; Kontakt hallo@gemivo.de, Website https://anruf.gemivo.de.
4. **Test › Geschlossener Test** → Track anlegen → signiertes AAB hochladen → Tester (E-Mail-Liste/Google-Gruppe) → Länder → Überprüfung starten.
   - Hinweis Google-Regel für **private Entwicklerkonten, die nach dem 13.11.2023 erstellt wurden**: Vor der Produktion muss ein geschlossener Test mit **mindestens 12 Testern über 14 Tage** laufen (dein Konto ist „Persönlich“). Laut Memory sollen dafür echte Nutzer statt Testfarm genommen werden.
5. Nach 14 Tagen: **Produktionszugriff beantragen** (Formular), dann Produktions-Release mit demselben AAB oder einem neueren versionCode.

## Bei der Prüfung wahrscheinlich gefragt
- **Rolle Anrufer-ID/Spam:** Kernfunktion, Begründung in `berechtigungen.md`. Keine Anrufliste/SMS-Rechte.
- **KI-Hinweis:** Anrufer hören zu Beginn „digitale Assistentin“ (fest eingebaut).
- **Datenübermittlung an Google (Gemini):** über den eigenen Schlüssel des Nutzers, in Datenschutzerklärung und Data Safety genannt.

## Neue Version hochladen (später)
`cd /opt/callagent-app && node`-freier Ablauf: versionCode in `android/app/build.gradle` erhöhen → `node web/scripts/export-anleitung.mjs` (Offline-Texte) → `./gradlew bundlePlayRelease` → AAB nach `/opt/callagent-play/…-UNSIGNIERT.aab` kopieren → `play-signieren.sh` → hochladen.
