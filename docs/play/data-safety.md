# Datensicherheit (Data Safety) – Vorschlag zum Ausfüllen [Kay prüft final]

**Werden Daten erhoben oder geteilt?** Ja.  **Verschlüsselt bei der Übertragung?** Ja (HTTPS).  **Kann der Nutzer die Löschung verlangen?** Ja – selbst im Dashboard („Meine Daten löschen“, einzelne Anrufe löschen) oder per E-Mail an hallo@gemivo.de.

| Datentyp (Play-Kategorie) | Erhoben | Geteilt | Zweck | Optional? |
|---|---|---|---|---|
| Persönliche Infos › E-Mail-Adresse, Name | ja (gemivo-Konto) | nein | Kontoverwaltung, App-Funktionen, Benachrichtigung (E-Mail optional) | nein |
| Persönliche Infos › Telefonnummer (Umleitungs-Nummer des Nutzers; Nummern der Anrufer) | ja | nein | App-Funktionen (Rufumleitung, Anrufliste) | nein |
| Audio › Sprachaufnahmen (Gesprächsaudio der Anrufer) | wird verarbeitet, **nicht gespeichert** („flüchtig verarbeitet“ ankreuzen) | ja: an Google (Gemini API) über den eigenen Schlüssel des Nutzers [PRÜFEN: „geteilt“ vs. „Dienstleister im Auftrag“] | App-Funktionen | nein |
| Nachrichten › Sonstige In-App-Nachrichten (Transkript, Zusammenfassung) | ja | ja: Transkript an Google (Gemini) für die Zusammenfassung [PRÜFEN] | App-Funktionen | nein |
| App-Aktivität › Sonstige nutzergenerierte Inhalte (Feedback-Text, optionaler Screenshot) | ja | nein | Analyse/Verbesserung | ja |
| App-Info und Leistung › Diagnose (App-Version, Gerätemodell, Android-Version beim Feedback) | ja | nein | Analyse | ja |
| Geräte-IDs | nein (eigener zufälliger Geräte-Token, keine Werbe-ID) | – | – | – |
| Kontakte | **nein** – nur lokal auf dem Gerät abgeglichen, nicht übertragen | – | – | – |

Zugangsdaten (SIP-Kennwort, Gemini-Schlüssel) werden verschlüsselt (AES-256-GCM) gespeichert und nur für den Anschluss des Nutzers verwendet [Play hat dafür keine eigene Kategorie; ggf. unter „Sonstige“].
