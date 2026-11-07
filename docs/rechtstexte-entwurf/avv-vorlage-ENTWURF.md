# ENTWURF – Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO) – Gemma Anrufassistent

> ENTWURF/VORLAGE vom 07.11.2026, nicht veröffentlicht, nicht anwaltlich geprüft.

**Verantwortlicher (Auftraggeber):** [Name/Firma, Anschrift des gewerblichen Nutzers]
**Auftragsverarbeiter (Auftragnehmer):** Kay Conrad (gemivo), Fleischhauerstr. 2, 23552 Lübeck, hallo@gemivo.de

## § 1 Gegenstand und Dauer
Annahme von Telefonanrufen, die der Auftraggeber per Rufumleitung an seinen bei gemivo eingerichteten Anschluss leitet, durch eine KI-Assistentin („Gemma“), Erstellung von Transkript und Zusammenfassung, Benachrichtigung des Auftraggebers. Dauer: Laufzeit der Nutzung des Dienstes.

## § 2 Art der Daten und Betroffene
Betroffene: Anrufer des Auftraggebers. Daten: Rufnummer, Zeitpunkt, Dauer, Gesprächsinhalt (Live-Audio ohne Speicherung; Text-Transkript, Zusammenfassung), ggf. vom Anrufer genannte Namen, Firmen, Anliegen.

## § 3 Weisungen
Verarbeitung nur auf dokumentierte Weisung des Auftraggebers; die Einstellungen im Dashboard gelten als Weisung.

## § 4 Pflichten des Auftragnehmers
Vertraulichkeit der eingesetzten Personen; technische und organisatorische Maßnahmen (Anlage 1); Unterstützung bei Betroffenenrechten und Meldepflichten; Löschung bzw. Rückgabe nach Ende des Auftrags; Nachweis der Einhaltung, Duldung von Kontrollen nach Vorankündigung.

## § 5 Unterauftragsverarbeiter
1. Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen (Hosting, Deutschland).
2. Google (Gemini API) – **über den eigenen API-Schlüssel des Auftraggebers**; Vertragsverhältnis besteht direkt zwischen Auftraggeber und Google. [PRÜFEN: Einordnung, ob Google hier Unterauftragsverarbeiter von gemivo oder direkter Auftragsverarbeiter des Auftraggebers ist]
3. [PRÜFEN: E-Mail-Versanddienstleister]
Änderungen werden dem Auftraggeber vorab mitgeteilt; er kann widersprechen.

## § 6 Drittlandübermittlung
Bei Google kann eine Verarbeitung außerhalb der EU erfolgen. [PRÜFEN: Garantien (EU-US Data Privacy Framework / Standardvertragsklauseln)]

## Anlage 1 – Technische und organisatorische Maßnahmen (Kurzfassung)
- Server in Deutschland, Zugriff nur per SSH-Schlüssel, Firewall.
- TLS für alle Web-Verbindungen; SIP-Kennwörter und API-Schlüssel AES-256-GCM-verschlüsselt, Schlüssel nur für root lesbar.
- Mandantentrennung: jede Abfrage ist auf die Nutzer-ID beschränkt; automatisierte Tests prüfen, dass Nutzer fremde Anrufe weder sehen noch löschen können.
- Keine Speicherung von Tonaufnahmen; Löschung einzelner Anrufe und aller Daten durch den Auftraggeber selbst.
- Backups: [PRÜFEN: Umfang und Frist der Server-Backups dokumentieren]
