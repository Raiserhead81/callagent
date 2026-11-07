# ENTWURF – Datenschutzhinweise „Gemma Anrufassistent“ (anruf.gemivo.de)

> ENTWURF vom 07.11.2026, nicht veröffentlicht. Ergänzt die allgemeine Datenschutzerklärung von gemivo.de.

## 1. Verantwortlicher
Kay Conrad, Fleischhauerstr. 2, 23552 Lübeck, hallo@gemivo.de (gemivo.de).
Für die Daten **der Anrufer** ist zusätzlich der jeweilige Nutzer verantwortlich, der Gemma für seinen Anschluss einsetzt (siehe Abschnitt 6). [PRÜFEN: Rollenverteilung privat vs. gewerblich]

## 2. Welche Daten wir verarbeiten
**Von Nutzern (Kontoinhabern):** gemivo-Konto (Nutzer-ID, E-Mail, Name), Vorname und Aussprache für die Begrüßung, SIP-Zugangsdaten (Registrar, Benutzer, Kennwort – verschlüsselt), Gemini-API-Schlüssel (verschlüsselt), Umleitungs-Rufnummer, Benachrichtigungs-Einstellungen, Geräte-Token der App, Push-Abonnements, Feedback und anonymisierte Zählwerte zur Einrichtung.
**Von Anrufern (Dritten):** Rufnummer (sofern übermittelt), Zeitpunkt, Dauer, Gesprächsinhalt als Text-Transkript und Zusammenfassung. Das Gesprächsaudio wird **nicht gespeichert**, sondern nur während des Gesprächs live verarbeitet.

## 3. Zwecke und Rechtsgrundlagen
- Bereitstellung des Dienstes für Nutzer: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).
- Annahme und Protokollierung von Anrufen im Auftrag des Nutzers: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Nutzers, Anliegen entgegenzunehmen; Anrufer werden zu Beginn informiert, dass eine digitale Assistentin spricht, und können jederzeit auflegen). [PRÜFEN]
- Feedback/Funnel zur Verbesserung: Art. 6 Abs. 1 lit. f DSGVO.

## 4. Empfänger
- **Google (Gemini API)**: Sprache des Gesprächs (live) und Transkript (für die Zusammenfassung) werden über den **eigenen API-Schlüssel des Nutzers** an Google übermittelt. Laut Google-Preisseite (Stand 11/2026) werden Inhalte im kostenpflichtigen Tarif nicht zur Produktverbesserung verwendet, im kostenlosen Tarif („Free Tier“) schon. Google kann Daten außerhalb der EU verarbeiten (Drittlandübermittlung). [PRÜFEN: Google-Vertragspartner und Garantien, Gemini API Additional Terms / Data Processing Addendum]
- **Hetzner Online GmbH** (Serverstandort Deutschland) als Hoster.
- **Telefonie**: der SIP-Anbieter bzw. die FRITZ!Box des Nutzers; der Mobilfunkanbieter des Nutzers (Rufumleitung).
- **Benachrichtigung**: E-Mail-Versand über den Mail-Dienstleister von gemivo [PRÜFEN: Anbieter benennen]; Web-Push über den Push-Dienst des Browsers (z. B. Google/Mozilla/Apple).

## 5. Speicherdauer
- Anrufprotokolle (Nummer, Zeit, Transkript, Zusammenfassung): bis der Nutzer sie löscht, spätestens mit Löschung des Kontos. [PRÜFEN: automatische Löschfrist, z. B. 90 Tage, einführen?]
- Zugangsdaten und Schlüssel: bis zur Änderung oder Löschung durch den Nutzer.
- Feedback-Screenshots: bis zur Bearbeitung, höchstens 12 Monate. [PRÜFEN]

## 6. Hinweise für Nutzer (Anrufer-Daten Dritter)
Wer Gemma beruflich einsetzt, verarbeitet personenbezogene Daten seiner Anrufer und muss diese selbst informieren (z. B. in der eigenen Datenschutzerklärung) und ggf. einen Auftragsverarbeitungsvertrag mit gemivo abschließen (Vorlage AVV). Gemma weist Anrufer zu Beginn darauf hin, dass eine digitale Assistentin spricht. Eine Aufzeichnung des Tons findet nicht statt; gespeichert wird ein Text-Transkript.

## 7. Rechte der Betroffenen
Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde. Nutzer können Anrufe einzeln oder alle Daten im Dashboard selbst löschen. Anrufer wenden sich an den Nutzer, den sie angerufen haben, oder an hallo@gemivo.de.

## 8. Sicherheit
Übertragung per HTTPS; SIP-Kennwort und API-Schlüssel AES-256-GCM-verschlüsselt; Daten strikt je Nutzer getrennt.
