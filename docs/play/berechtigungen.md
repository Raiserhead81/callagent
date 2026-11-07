# Berechtigungen und Richtlinien-Begründung (Play-Variante, targetSdk 36)

Geprüft mit `aapt2 dump badging` (play-Variante 2.4-play): nur **READ_CONTACTS, INTERNET, CALL_PHONE**. Entfernt gegenüber der Direkt-APK: Bedienungshilfe-Dienst (AccessibilityService), InCallService/Dialer-Activity, Mikrofon-Vordergrunddienst, RECORD_AUDIO, ANSWER_PHONE_CALLS, READ_PHONE_STATE, POST_NOTIFICATIONS, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS.

| Funktion | Wofür | Text für die Play Console |
|---|---|---|
| Rolle **Anrufer-ID- und Spam-App** (`ROLE_CALL_SCREENING`, `CallScreeningService`) | Kernfunktion: Anrufe unbekannter Nummern ablehnen, damit die Rufumleitung „bei besetzt“ sie an die KI-Assistentin weiterleitet | „Die App filtert eingehende Anrufe: Nummern aus dem Adressbuch werden durchgelassen, unbekannte abgelehnt und per Netz-Rufumleitung an die Anrufassistenz des Nutzers weitergeleitet. Die Rolle wird nur nach ausdrücklicher Zustimmung im Systemdialog übernommen.“ |
| **READ_CONTACTS** | Prüfen, ob die anrufende Nummer im Adressbuch steht – nur auf dem Gerät, nichts wird übertragen. Ohne Recht lehnt die App nichts ab. | „Kontakte werden ausschließlich lokal mit der eingehenden Nummer abgeglichen, um bekannte Anrufer nicht zu filtern. Es werden keine Kontakte übertragen oder gespeichert.“ |
| **CALL_PHONE** | Auf Knopfdruck den GSM-Code `**67*<Nummer>#` (Umleitung bei besetzt) bzw. `##67#` wählen | „Nur auf ausdrücklichen Tipp des Nutzers wird der Netzcode für die Rufumleitung gewählt.“ |
| **INTERNET** | Verbindung zu anruf.gemivo.de (Einrichtung, Status) | – |

Hinweise
- Call-Log/SMS werden NICHT angefordert → kein „Permissions Declaration Form“ für SMS/Anrufliste nötig.
- Keine Bedienungshilfe in der Play-Variante → keine Accessibility-API-Erklärung nötig.
- Akku: Play-Variante öffnet nur die Systemliste „Akku-Optimierung“ (keine Berechtigung REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).
- In der App erscheint vor jeder Berechtigung eine Erklärung (Assistent Schritt 6) = gut sichtbare Offenlegung.
