/**
 * EINE Quelle fuer die Einrichtungs-Anleitung: Web (/anleitung) und Android-App (GET /api/anleitung,
 * Offline-Kopie in android/app/src/main/assets/anleitung.json via scripts/export-anleitung.mjs).
 * Auszeichnung in Texten: **fett**, `code`. Menuepfade nur so, wie sie belegt sind (AVM-Wissensdatenbank,
 * Google-AI-Studio-Doku, Stand Nov. 2026); Unbelegtes neutral beschrieben.
 * Skizzen = neutrale Nachbildung der wichtigsten Felder (keine Fremd-Screenshots).
 */
export interface Skizze { titel: string; pfad?: string[]; zeilen: [string, string?][] }
export interface Unterschritt { text: string; skizze?: Skizze; bild?: string; bildText?: string }
export interface Hinweis { id: string; titel: string; text: string; schritte: string[] }
export interface Schritt {
  id: string; titel: string; kurz: string; ziel: string;
  unterschritte: Unterschritt[];
  hilfe: Record<string, string>;   // Fehlerbild -> "Was tun?"
  ueberspringbar?: boolean;
  quelle?: string;
}

export const ANLEITUNG_VERSION = "2026-11-07d";

export const SCHRITTE: Schritt[] = [
  {
    id: "konto", titel: "Mit gemivo verbinden", kurz: "Konto verknüpfen",
    ziel: "Die App gehört zu deinem gemivo-Konto. Alle Einstellungen gelten dann in App und Web gleich.",
    unterschritte: [
      { text: "Tippe auf **„Im Browser anmelden“**. Es öffnet sich die gemivo-Anmeldung." },
      { text: "Melde dich mit deinem gemivo-Konto an (noch keins? Dort kostenlos registrieren)." },
      { text: "Danach springt der Browser von selbst zurück in diese App. Der Schritt wird grün." },
      { text: "Alternativ am Computer `anruf.gemivo.de/koppeln` öffnen und den **8-stelligen Code** hier eingeben." },
    ],
    hilfe: {
      code: "Der Code gilt 10 Minuten und nur einmal. Auf anruf.gemivo.de/koppeln einen neuen erzeugen.",
      netz: "Keine Verbindung zum Server. Prüfe WLAN oder mobile Daten und versuche es erneut.",
    },
  },
  {
    id: "gemini", titel: "Gemini-Schlüssel und Guthaben", kurz: "Gemini-Schlüssel",
    ziel: "Gemma spricht über Googles Live-Modell. Das bezahlst du direkt bei Google über deinen eigenen Schlüssel.",
    unterschritte: [
      { text: "Tippe auf **„Google AI Studio öffnen“** und melde dich mit deinem Google-Konto an. Komm danach hierher zurück." },
      { text: "Wähle **„API-Schlüssel erstellen“** (englisch „Create API key“). Ein Projekt wird dabei automatisch angelegt.",
        skizze: { titel: "Google AI Studio › API-Schlüssel (Skizze)", zeilen: [["Knopf", "API-Schlüssel erstellen"], ["Ergebnis", "AIza… bzw. AQ.… (Schlüssel)"], ["Aktion", "Kopieren"]] } },
      { text: "Schlüssel **kopieren**. Wenn du zurück in die App kommst, bietet sie dir an, ihn aus der Zwischenablage einzufügen." },
      { text: "Für Guthaben: In AI Studio auf der Seite **Projects** beim Projekt in der Spalte *Billing Tier* auf **„Set up billing“** tippen.",
        skizze: { titel: "Google AI Studio › Projects (Skizze)", zeilen: [["Projekt", "Default Gemini Project"], ["Billing Tier", "Free  ›  Set up billing"]] } },
      { text: "Land wählen, Bedingungen akzeptieren, Zahlungsmittel hinterlegen. Google verlangt je nach Konto eine **Vorauszahlung ab 5 US-$** (Prepay) oder bietet Prepay/Postpay zur Wahl." },
      { text: "Ohne Abrechnung geht es im **Free Tier** mit Ratenlimits; dann darf Google die Gespräche zur Produktverbesserung nutzen. Wir empfehlen die Abrechnung." },
      { text: "Schlüssel einfügen und **„Schlüssel testen“** tippen. Die App baut eine echte, kurze Verbindung zum Live-Modell auf." },
    ],
    hilfe: {
      ungueltig: "Schlüssel nicht erkannt: in AI Studio erneut kopieren (ganzer Text, ohne Leerzeichen).",
      guthaben: "Kein Guthaben: In AI Studio › Projects › Set up billing Guthaben aufladen, dann erneut testen.",
      limit: "Ratenlimit des Free Tiers erreicht: kurz warten oder Abrechnung aktivieren.",
      netz: "Keine Verbindung zu Google: Netz prüfen und erneut testen.",
    },
    quelle: "aistudio.google.com/docs/billing und /docs/pricing (Stand Nov. 2026)",
  },
  {
    id: "anschluss", titel: "FritzBox oder SIP-Anbieter", kurz: "Anschluss",
    ziel: "Gemma meldet sich wie ein Internet-Telefon an deiner Rufnummer an. Auf diese Nummer leitet dein Handy später um.",
    unterschritte: [
      { text: "**Weg A FRITZ!Box:** Öffne im WLAN zu Hause `http://fritz.box` und melde dich an." },
      { text: "Prüfe unter **Internet › Online-Monitor** die Zeilen „Internet, IPv4“ und „Internet, IPv6“. Steht bei IPv4 **DS-Lite** oder eine Adresse 192.0.0.x (oft bei Kabel), ist die Box nur über **IPv6** erreichbar. Steht dort keine IPv6-Adresse und IPv4 ist DS-Lite: nimm Weg B.",
        skizze: { titel: "FRITZ!Box › Online-Monitor (Skizze)", pfad: ["Internet", "Online-Monitor"], zeilen: [["Internet, IPv4", "öffentliche Adresse oder „DS-Lite“"], ["Internet, IPv6", "2a02:… (dann klappt IPv6)"]] } },
      { text: "Unter **Internet › MyFRITZ!-Konto** steht deine **MyFRITZ!-Adresse** (z. B. `abcd1234.myfritz.net`). Das ist der Registrar." },
      { text: "**Telefonie › Telefoniegeräte › Neues Gerät einrichten** › **Telefon (mit und ohne Anrufbeantworter)** › **LAN/WLAN (IP-Telefon)**, Name `Gemma`.",
        skizze: { titel: "FRITZ!Box › Neues Gerät (Skizze)", pfad: ["Telefonie", "Telefoniegeräte", "Neues Gerät einrichten"], zeilen: [["Gerät", "Telefon (mit und ohne Anrufbeantworter)"], ["Anschluss", "LAN/WLAN (IP-Telefon)"], ["Name", "Gemma"]] } },
      { text: "Benutzername (z. B. `gemma`) und ein **langes Kennwort** (mind. 12 Zeichen) vergeben. Eventuell will die Box eine Bestätigung per Taste an der Box." },
      { text: "**Ankommende Anrufe:** nur auf **eine** Rufnummer reagieren – die, auf die dein Handy umleiten soll (am besten eine Zweitnummer)." },
      { text: "Beim Gerät auf **Bearbeiten** (Stift) und bei den Anmeldedaten **„Anmeldung aus dem Internet erlauben“** anhaken. Die Position kann je nach FRITZ!OS-Version leicht abweichen.",
        skizze: { titel: "FRITZ!Box › Telefoniegerät „Gemma“ (Skizze)", pfad: ["Telefonie", "Telefoniegeräte", "Gemma", "Anmeldedaten"], zeilen: [["Benutzername", "gemma"], ["Kennwort", "••••••••••••"], ["☑ Anmeldung aus dem Internet erlauben"], ["Ankommende Anrufe", "nur auf: deine Zweitnummer"]] } },
      { text: "Trage unten ein: Registrar = MyFRITZ!-Adresse, Port 5060, Benutzername, Kennwort, Rufnummer. Dann **„Speichern und verbinden“**." },
      { text: "**Weg B SIP-Anbieter:** Im Kundenportal ein SIP-/VoIP-Gerät anlegen und ihm die Nummer zuweisen. Registrar, SIP-ID und SIP-Kennwort von dort eintragen." },
    ],
    hilfe: {
      "nicht-konfiguriert": "Gemma ist noch nicht aktiv: erst Gemini-Schlüssel (grün) und Name speichern.",
      Rejected: "Die Gegenstelle lehnt ab: Benutzername/Kennwort prüfen; bei der FRITZ!Box „Anmeldung aus dem Internet erlauben“ anhaken.",
      Unregistered: "Keine Antwort: Registrar-Adresse prüfen. Bei DS-Lite ohne IPv6 klappt Weg A nicht – nimm Weg B (SIP-Anbieter).",
    },
    quelle: "AVM-Wissensdatenbank „IP-Telefon an FRITZ!Box anmelden“ und „Was ist DS-Lite“",
  },
  {
    id: "name", titel: "Name für die Begrüßung", kurz: "Begrüßung",
    ziel: "Anrufer hören, wessen digitale Assistentin spricht.",
    unterschritte: [
      { text: "Vorname eintragen. Gemma sagt: „Schönen guten Tag, hier spricht Gemma, die **digitale Assistentin** von …“. Der KI-Hinweis ist fest eingebaut." },
      { text: "Spricht Gemma deinen Namen falsch aus, trag eine **Aussprache-Schreibweise** ein (z. B. „Kai“ für „Kay“). Im Protokoll steht weiter dein richtiger Name." },
    ],
    hilfe: { name: "Name: 2 bis 40 Buchstaben (Leerzeichen, Punkt, Bindestrich erlaubt)." },
  },
  {
    id: "benachrichtigung", titel: "Benachrichtigung", kurz: "Benachrichtigung", ueberspringbar: true,
    ziel: "So erfährst du nach jedem Anruf, was der Anrufer wollte.",
    unterschritte: [
      { text: "**E-Mail** an die Adresse deines gemivo-Kontos einschalten – direkt hier." },
      { text: "**Push** (Browser-Benachrichtigung) richtest du im Dashboard auf anruf.gemivo.de ein." },
      { text: "Telegram ist für Beta-Nutzer noch nicht verfügbar. Alles steht außerdem immer im Dashboard." },
    ],
    hilfe: {},
  },
  {
    id: "rechte", titel: "Rechte und Akku", kurz: "Rechte & Akku",
    ziel: "Die App muss unbekannte Anrufe erkennen und ablehnen dürfen – und darf vom System nicht eingefroren werden.",
    unterschritte: [
      { text: "**Anruf-Filter:** Tippe auf „Rolle anfragen“. Android fragt „Gemma Anruf als standardmäßige **Anrufer-ID- und Spam-App** festlegen?“. „Gemma Anruf“ auswählen und **„Als Standard festlegen“** tippen. Deine Telefon-App bleibt unverändert.",
        bild: "rolle", bildText: "Echter Android-Systemdialog (Android 15; Aussehen je nach Hersteller anders)" },
      { text: "**Kontakte:** Bei „Gemma Anruf erlauben, auf deine Kontakte zuzugreifen?“ **Zulassen** tippen. Nur so erkennt die App bekannte Nummern; ohne dieses Recht lehnt sie zur Sicherheit gar nichts ab.",
        bild: "kontakte", bildText: "Echter Android-Systemdialog (Android 15)" },
      { text: "**Akku:** Bei „Soll die App immer im Hintergrund ausgeführt werden?“ **Zulassen** tippen.", bild: "akku", bildText: "Echter Android-Systemdialog (Android 15)" },
      { text: "Zusätzlich je nach Hersteller in der **App-Info**: ColorOS (OnePlus/OPPO/realme) „Akkunutzung › Hintergrundaktivität zulassen“; Samsung „Akku › Nicht eingeschränkt“; Xiaomi „Akkusparmodus › Keine Einschränkungen“ und „Autostart“." },
    ],
    hilfe: {
      rolle: "Ohne Rolle klingeln unbekannte Nummern normal. Erneut „Rolle anfragen“ und „Gemma Anruf“ wählen.",
      kontakte: "Ohne Kontakte-Recht lehnt die App nichts ab. Erneut erlauben oder in App-Info › Berechtigungen.",
      akku: "Ohne Akku-Ausnahme kann das System die App einfrieren. App-Info öffnen und Akku „nicht eingeschränkt“ wählen.",
    },
  },
  {
    id: "umleitung", titel: "Rufumleitung bei besetzt", kurz: "Rufumleitung",
    ziel: "Lehnt die App einen unbekannten Anruf ab, gilt das im Netz als „besetzt“ – die Umleitung schickt ihn an Gemma.",
    unterschritte: [
      { text: "Tippe auf **„Umleitung jetzt einschalten“**. Die App wählt `**67*<deine Gemma-Nummer>#` im nationalen Format (ohne „+“)." },
      { text: "Das Netz zeigt eine Meldung wie „Rufumleitung aktiviert“. Bestätige danach hier mit **„Ja, aktiviert“**." },
      { text: "Status prüfen: `*#67#`, ausschalten: `##67#`. Eine bestehende Mailbox-Umleitung bei besetzt wird ersetzt." },
      { text: "Kosten: Die Weiterleitung rechnet dein Mobilfunkanbieter wie einen Anruf ins deutsche Festnetz ab (in Allnet-Flats meist enthalten)." },
    ],
    hilfe: {
      nein: "Keine Bestätigung vom Netz: Status mit *#67# prüfen. Manche Anbieter erlauben Umleitungen nur nach Freischaltung im Kundenportal.",
      nummer: "Erst im Schritt „Anschluss“ die Rufnummer eintragen.",
    },
  },
  {
    id: "test", titel: "Test-Anruf", kurz: "Test-Anruf",
    ziel: "Einmal ausprobieren, ob alles zusammenspielt.",
    unterschritte: [
      { text: "Lass dich von einer Nummer anrufen, die **nicht** in deinen Kontakten steht (z. B. mit unterdrückter Nummer)." },
      { text: "Dein Handy klingelt nicht – Gemma meldet sich und fragt nach dem Anliegen." },
      { text: "Nach dem Auflegen erscheint der Anruf hier und im Dashboard. Die App prüft das automatisch." },
    ],
    hilfe: {
      klingelt: "Handy klingelt trotzdem: Schritt „Rechte und Akku“ prüfen (Hersteller-Akku-Einstellung).",
      besetzt: "Anrufer hört besetzt: Umleitung mit *#67# prüfen.",
      ansage: "Anrufer hört „Assistentin nicht verfügbar“: Gemini-Schlüssel/Guthaben prüfen.",
    },
  },
];

/** "Gut zu wissen: Was passieren kann" – nur Punkte, die aus Aufbau/Konfiguration belegbar sind. */
export const HINWEISE: Hinweis[] = [
  { id: "besetzt", titel: "Auch Kontakte können bei Gemma landen", schritte: ["umleitung"],
    text: "Die Umleitung greift bei **besetzt**. Telefonierst du gerade selbst oder drückst einen Anruf weg, geht auch ein Anruf aus deinen Kontakten an Gemma." },
  { id: "unbekannt", titel: "Was als „unbekannt“ gilt", schritte: ["rechte"],
    text: "Kontakte klingeln normal. Unterdrückte Nummern gelten als unbekannt. Ruft jemand von einer anderen Nummer an als gespeichert (z. B. Firmen-Durchwahl statt Zentrale), gilt er ebenfalls als unbekannt." },
  { id: "akku", titel: "Energiesparen kann die App einfrieren", schritte: ["rechte"],
    text: "Manche Hersteller (z. B. ColorOS, Samsung, Xiaomi) frieren Apps im Hintergrund ein. Dann klingelt ein unbekannter Anruf ganz normal, statt zu Gemma zu gehen. Die Akku-Ausnahme aus Schritt 6 schützt davor." },
  { id: "kosten", titel: "Kosten", schritte: ["gemini", "umleitung"],
    text: "Gemini rechnet Google direkt über deinen Schlüssel ab. Die Umleitung zählt in deinem Mobilfunktarif wie ein Anruf ins deutsche Festnetz. gemivo selbst ist in der Beta kostenlos." },
  { id: "grenzen", titel: "Gesprächsgrenzen", schritte: ["test"],
    text: "Gemma legt nach höchstens **60 Sekunden** auf, ebenso nach **10 Sekunden Stille**. Sie verspricht nichts, macht keine Termine und stellt nicht durch – sie nimmt nur das Anliegen auf." },
  { id: "verhoeren", titel: "Die KI kann sich verhören", schritte: ["test"],
    text: "Namen und Firmen werden manchmal falsch verstanden. Transkript und Zusammenfassung entstehen automatisch und sind nicht wörtlich garantiert. Im Zweifel zurückrufen." },
  { id: "erreichbar", titel: "Wenn Gemma nicht erreichbar ist", schritte: ["anschluss"],
    text: "Ändert sich die Internet-Adresse deiner FRITZ!Box (z. B. nächtliche Zwangstrennung), meldet sich Gemma automatisch neu an; das kann **einige Minuten** dauern. Ist der gemivo-Server nicht angemeldet, kann Gemma nicht abnehmen – was der Anrufer dann hört (z. B. besetzt), entscheidet deine FRITZ!Box bzw. dein Anbieter. Ist Google gestört oder dein Guthaben leer, hört der Anrufer eine kurze Ansage, dass die Assistentin gerade nicht verfügbar ist, und du bekommst einen Hinweis zum Zurückrufen." },
  { id: "datenschutz", titel: "Datenschutz", schritte: ["name"],
    text: "Anrufer hören zu Beginn, dass eine **digitale Assistentin** spricht. Transkripte und Zusammenfassungen werden gespeichert, bis du sie löschst. Das Gesprächsaudio verarbeitet Google (Gemini) über deinen Schlüssel; Tonaufnahmen speichern wir nicht." },
  { id: "sicherheit", titel: "Sicherheit", schritte: ["anschluss"],
    text: "Gib dem IP-Telefon „Gemma“ in der FRITZ!Box ein **langes Zufallskennwort**; Gemma meldet sich nur damit an. Dein Kennwort und dein Gemini-Schlüssel liegen verschlüsselt auf dem gemivo-Server. Der Server nimmt Anrufe nur über angemeldete Anschlüsse an, nicht anonym." },
  { id: "aus", titel: "Jederzeit ausschalten", schritte: ["umleitung"],
    text: "Umleitung aus mit `##67#` oder in der App den Schalter „Gemma nimmt unbekannte Anrufe an“ ausschalten – dann klingeln alle Anrufe wieder normal." },
];

/** Schritt-Text fuer Web (HTML): `code` zuerst (darin keine weitere Auszeichnung), sonst **fett** / *kursiv*. */
export function zuHtml(t: string): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t.split("`").map((teil, i) => i % 2 ? '<span class="mono">' + esc(teil) + "</span>"
    : esc(teil).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<i>$2</i>")).join("");
}
