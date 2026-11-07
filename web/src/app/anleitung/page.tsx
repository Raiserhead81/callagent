import type { Metadata } from "next";
import { Kopf, Fuss } from "@/components/Kopf";
import { Bildschirm } from "@/components/Bildschirm";

export const metadata: Metadata = { title: "Anleitung – Gemma Anrufassistent", description: "Schritt für Schritt: Gemini-Schlüssel, FritzBox oder SIP-Anbieter, Android-App, Rufumleitung, Kosten, Abschalten." };

const INHALT = [
  ["voraussetzungen", "1. Voraussetzungen"], ["gemini", "2. Gemini-Schlüssel und Guthaben"], ["anschluss", "3. FritzBox oder SIP-Anbieter"],
  ["name", "4. Name für die Begrüßung"], ["benachrichtigung", "5. Benachrichtigung"], ["android", "6. Android-App, Rechte, Akku"],
  ["umleitung", "7. Rufumleitung"], ["test", "8. Test-Anruf"], ["kosten", "9. Kosten"], ["aus", "10. Ausschalten und Löschen"], ["datenschutz", "Datenschutz"], ["grenzen", "Was Gemma kann und nicht kann"],
];

export default function Anleitung() {
  return (
    <>
      <Kopf />
      <main className="anleitung mx-auto max-w-3xl px-4 pb-10 pt-6">
        <h1 className="text-2xl font-bold">Anleitung: Gemma nimmt deine Anrufe an</h1>
        <p className="mt-2 text-tx2">Stand: November 2026. Die App ist eine Beta und kostenlos. Du brauchst etwa 20 bis 30 Minuten. Die Android-App führt dich durch dieselben Schritte; hier steht alles zum Nachlesen.</p>
        <nav className="karte mt-4 p-4" aria-label="Inhalt">
          <ol className="!pl-0 !list-none grid gap-1 sm:grid-cols-2">{INHALT.map(([id, t]) => <li key={id} className="!m-0"><a href={"#" + id}>{t}</a></li>)}</ol>
        </nav>

        <h2 id="so-funktionierts">So funktioniert es</h2>
        <ol>
          <li>Eine Nummer, die nicht in deinen Kontakten steht, ruft dein Android-Handy an.</li>
          <li>Die gemivo-App lehnt diesen Anruf sofort ab. Für das Mobilfunknetz bist du damit „besetzt“.</li>
          <li>Deine Rufumleitung „bei besetzt“ schickt den Anruf an deine Festnetz- bzw. SIP-Nummer.</li>
          <li>Dort ist Gemma (auf dem gemivo-Server) angemeldet, nimmt ab und spricht mit Googles Gemini-Live-Modell über deinen eigenen Gemini-Schlüssel.</li>
          <li>Nach dem Gespräch bekommst du die Zusammenfassung (Push oder E-Mail) und findest Transkript und Rückruf-Knopf im Dashboard.</li>
        </ol>
        <p>Kontakte klingeln ganz normal. Android-Apps dürfen im Mobilfunk-Gespräch weder mithören noch sprechen; deshalb läuft Gemma über die Umleitung auf eine Festnetz-/SIP-Nummer.</p>

        <h2 id="voraussetzungen">1. Voraussetzungen</h2>
        <ul>
          <li><b>Android-Handy</b> (ab Android 10). iPhones gehen nicht: iOS erlaubt Apps das Ablehnen einzelner Anrufe nicht.</li>
          <li><b>Eine Festnetz- oder SIP-Rufnummer</b>, auf die dein Handy umleiten kann: entweder eine <b>FRITZ!Box</b> mit Festnetznummer (Weg A) oder ein <b>SIP-Anbieter</b> (Weg B, z. B. sipgate, easybell, dus.net). Am besten eine zweite Nummer, damit dein normales Festnetztelefon nicht mitklingelt.</li>
          <li><b>Ein Google-Konto mit Gemini-API-Schlüssel</b> (Google AI Studio). Für ernsthafte Nutzung mit aktivierter Abrechnung bzw. Guthaben, siehe Schritt 2.</li>
          <li><b>Ein gemivo-Konto</b> (kostenlos, <a href="https://gemivo.de/konto/registrieren.php">hier anlegen</a>).</li>
          <li>Optional: Telegram ist für Beta-Nutzer derzeit nicht verfügbar; du bekommst die Zusammenfassungen per Push oder E-Mail.</li>
        </ul>
        <p><b>Nicht nötig:</b> VPN/WireGuard, ein eigener Server oder OpenRouter.</p>

        <h2 id="gemini">2. Gemini-Schlüssel und Guthaben</h2>
        <p>Gemma spricht mit Googles Modell <span className="mono">gemini-3.8-live</span>. Abgerechnet wird direkt zwischen dir und Google über deinen Schlüssel. gemivo sieht dein Google-Konto nicht.</p>
        <h3>2a. Schlüssel erstellen</h3>
        <ol>
          <li>Öffne <a href="https://aistudio.google.com">aistudio.google.com</a> und melde dich mit deinem Google-Konto an.</li>
          <li>Links auf <span className="menue">Get API key</span> bzw. <span className="menue">API-Schlüssel</span>, dann <span className="menue">API-Schlüssel erstellen</span>. Ein Projekt wird dabei automatisch angelegt.</li>
          <li>Den Schlüssel (beginnt meist mit <span className="mono">AIza</span>) kopieren und in der App bzw. unter <a href="/einrichtung">Einrichtung</a> einfügen. Er wird verschlüsselt gespeichert und nur für deine Anrufe benutzt.</li>
        </ol>
        <h3>2b. Abrechnung bzw. Guthaben einrichten</h3>
        <p>Laut Google-Doku zur Abrechnung (Stand Nov. 2026):</p>
        <ol>
          <li>In AI Studio auf der Seite <span className="menue">Projects</span> beim Projekt in der Spalte <i>Billing Tier</i> auf <span className="menue">Set up billing</span> klicken.</li>
          <li>Land wählen, Bedingungen akzeptieren, Kontaktdaten und Zahlungsmittel hinterlegen (oder ein vorhandenes Rechnungskonto wählen).</li>
          <li>Je nach Konto wirst du um <b>Vorauszahlung (Prepay, mindestens 5 US-Dollar)</b> gebeten oder kannst zwischen Prepay und nachträglicher Abrechnung (Postpay) wählen.</li>
        </ol>
        <ul>
          <li><b>Prepay:</b> Guthaben wird nahezu in Echtzeit abgezogen. Bei 0 schlägt jede Anfrage fehl („402 Payment Required“) und Gemma kann nicht mehr abnehmen, bis du nachlädst. Automatisches Nachladen mit Monatsgrenze ist möglich. Guthaben verfällt nach 12 Monaten.</li>
          <li><b>Ausgabenlimit:</b> In AI Studio kannst du unter <span className="menue">Spend</span> ein monatliches Projekt-Limit setzen (laut Google experimentell).</li>
          <li><b>Free Tier:</b> Laut Preisseite ist <span className="mono">gemini-3.8-live</span> auch im kostenlosen Kontingent nutzbar, aber mit Ratenlimits, und Google darf Inhalte aus dem Free Tier zur Produktverbesserung verwenden. Weil es um Gespräche mit Dritten geht, empfehlen wir die Abrechnung zu aktivieren (dann laut Preisseite keine Verwendung zur Produktverbesserung).</li>
        </ul>
        <p>Der Knopf <b>„Schlüssel testen“</b> baut eine echte, kurze Verbindung zum Live-Modell auf. Erst wenn sie klappt, meldet sich Gemma an deinem Anschluss an. Fehlermeldungen wie „kein Guthaben“ oder „Ratenlimit“ werden dort im Klartext angezeigt.</p>
        <p className="text-sm text-tx2">Quellen: <a href="https://aistudio.google.com/docs/billing">Google AI Studio – Billing</a>, <a href="https://aistudio.google.com/docs/pricing">Gemini API – Preise</a>.</p>

        <h2 id="anschluss">3. FritzBox oder SIP-Anbieter</h2>
        <p>Gemma meldet sich bei deinem Anschluss wie ein normales Internet-Telefon an (SIP-Registrierung). Welcher Weg passt?</p>
        <ul>
          <li><b>Weg A – FRITZ!Box:</b> gratis, deine vorhandene Festnetznummer. Funktioniert nur, wenn deine FRITZ!Box aus dem Internet erreichbar ist (öffentliche IPv4- oder IPv6-Adresse).</li>
          <li><b>Weg B – SIP-Anbieter:</b> Registrar, Benutzer und Kennwort vom Anbieter. Klappt unabhängig vom Heimanschluss; viele Anbieter verlangen eine kleine Gebühr für die Nummer.</li>
        </ul>

        <h3 id="fritzbox">Weg A: FRITZ!Box (FRITZ!OS 7.5 / 8.x)</h3>
        <p><b>Erst prüfen, ob deine Box erreichbar ist:</b> In der FRITZ!Box-Oberfläche (<span className="mono">http://fritz.box</span>) unter <span className="menue">Internet › Online-Monitor</span> stehen die Zeilen „Internet, IPv4“ und „Internet, IPv6“. Laut AVM gilt:</p>
        <ul>
          <li>Steht bei IPv4 eine normale öffentliche Adresse: gut, Weg A über IPv4.</li>
          <li>Steht dort <b>DS-Lite</b> oder eine Adresse aus 192.0.0.0–192.0.0.7 (typisch bei Kabelanschlüssen), ist die Box aus dem Internet <b>nur über IPv6</b> erreichbar. Der gemivo-Server spricht IPv6, Gemma meldet sich dann über IPv6 an. <i>Hinweis Beta:</i> Diese Variante haben wir noch nicht mit einer Kunden-FRITZ!Box durchgetestet. Wird der Verbindungstest nicht grün, nimm Weg B.</li>
          <li>Wird gar keine IPv6-Adresse angezeigt und IPv4 ist DS-Lite/privat: Weg A geht nicht, nimm Weg B.</li>
        </ul>
        <p><b>MyFRITZ!-Adresse besorgen</b> (bleibt gleich, auch wenn sich deine IP ändert): <span className="menue">Internet › MyFRITZ!-Konto</span> – dort steht „Ihre MyFRITZ!-Adresse“, z. B. <span className="mono">abcd1234efgh5678.myfritz.net</span>. Falls noch kein MyFRITZ!-Konto existiert, dort zuerst eins einrichten.</p>
        <p><b>IP-Telefon für Gemma anlegen:</b></p>
        <ol>
          <li><span className="menue">Telefonie › Telefoniegeräte</span> › <span className="menue">Neues Gerät einrichten</span>.</li>
          <li><span className="menue">Telefon (mit und ohne Anrufbeantworter)</span> › Weiter › <span className="menue">LAN/WLAN (IP-Telefon)</span> › Weiter. Name: <span className="mono">Gemma</span>.</li>
          <li>Benutzername (z. B. <span className="mono">gemma</span>) und ein <b>langes</b> Kennwort (mindestens 12 Zeichen) vergeben. Laut AVM wird beim Telefon genau dieser in der Oberfläche angezeigte Benutzername eingetragen.</li>
          <li>Die FRITZ!Box verlangt eventuell eine Bestätigung: eine Taste an der Box drücken oder einen Code am FRITZ!Fon eingeben.</li>
          <li>Ausgehende Rufnummer: egal (Gemma ruft nie hinaus). <b>Ankommende Anrufe:</b> <span className="menue">nur auf folgende Rufnummern reagieren</span> und genau die Nummer wählen, auf die dein Handy umleiten soll.</li>
          <li>Übernehmen. Danach in der Liste beim Gerät auf das Stift-Symbol (Bearbeiten) und bei den Anmeldedaten <span className="menue">Anmeldung aus dem Internet erlauben</span> anhaken. Die genaue Position kann je nach FRITZ!OS-Version leicht abweichen. Diese Option öffnet laut Erfahrungsberichten den SIP-Port 5060 für die Anmeldung von außen.</li>
        </ol>
        <Bildschirm titel="FRITZ!Box › Telefoniegerät „Gemma“ bearbeiten" pfad={["Telefonie", "Telefoniegeräte", "Gemma", "Anmeldedaten"]}
          zeilen={[["Benutzername", "gemma"], ["Kennwort", "••••••••••••••"], ["☑ Anmeldung aus dem Internet erlauben"], ["Ankommende Anrufe", "nur auf: 0451 1234567"]]} />
        <p><b>In der App bzw. unter Einrichtung eintragen:</b></p>
        <Bildschirm titel="gemivo › Einrichtung › Anschluss (Weg A)" zeilen={[["Art", "FRITZ!Box"], ["Registrar (MyFRITZ!-Adresse)", "abcd1234efgh5678.myfritz.net"], ["Port", "5060"], ["Benutzername", "gemma"], ["Kennwort", "aus Schritt 3"], ["Rufnummer (Ziel der Umleitung)", "0451 1234567"]]} />
        <p>Statt der MyFRITZ!-Adresse geht laut AVM auch die öffentliche IP-Adresse der Box, die sich aber meist regelmäßig ändert. AVM sichert die Anmeldung von IP-Telefonen über das Internet nicht für jeden Anschluss zu; der <b>Verbindungstest</b> zeigt dir, ob es klappt (grün = „angemeldet“).</p>
        <p className="text-sm text-tx2">Quelle: AVM-Wissensdatenbank „IP-Telefon an FRITZ!Box anmelden“ (Registrar bei Anmeldung über das Internet = öffentliche Adresse der FRITZ!Box) und „Was ist DS-Lite“ (nur über IPv6 erreichbar).</p>

        <h3 id="sip">Weg B: SIP-Anbieter</h3>
        <ol>
          <li>Im Kundenportal deines Anbieters ein <b>SIP-/VoIP-Telefon</b> (Gerät) anlegen und ihm die gewünschte Rufnummer zuweisen.</li>
          <li>Dort stehen <b>Registrar</b> (Server, z. B. <span className="mono">sipgate.de</span>), <b>SIP-Benutzer/SIP-ID</b> und <b>SIP-Kennwort</b>. Manche Anbieter nennen zusätzlich einen getrennten Auth-Benutzer oder eine Domain/Realm; beides kannst du unter „Erweitert“ eintragen.</li>
          <li>In der App/Einrichtung „SIP-Anbieter“ wählen und die Werte eintragen. Rufnummer = die Nummer dieses SIP-Telefons.</li>
        </ol>
        <p><b>Ausweichweg WireGuard (nur auf Anfrage):</b> Wenn deine FRITZ!Box nicht aus dem Internet erreichbar ist, kann sie per WireGuard-VPN mit dem gemivo-Server gekoppelt werden (so läuft der allererste Testanschluss). Das ist pro Box eine manuelle Einrichtung durch gemivo und nicht Teil der Beta-Selbsteinrichtung.</p>

        <h2 id="name">4. Name für die Begrüßung</h2>
        <p>Gemma begrüßt Anrufer mit: <i>„Schönen guten Tag, hier spricht Gemma, die digitale Assistentin von &lt;Vorname&gt;. &lt;Vorname&gt; ist gerade leider nicht erreichbar – kann ich etwas für Sie aufnehmen?“</i> Der Hinweis „digitale Assistentin“ ist fest eingebaut, damit Anrufer wissen, dass eine KI spricht.</p>
        <p>Spricht Gemma deinen Namen falsch aus, trag eine <b>Aussprache-Schreibweise</b> ein (z. B. „Kai“ für „Kay“). Sie wird nur für die Stimme benutzt; im Protokoll steht dein richtiger Name.</p>

        <h2 id="benachrichtigung">5. Benachrichtigung</h2>
        <ul>
          <li><b>Push:</b> im Dashboard „Push aktivieren“ antippen und erlauben (Browser bzw. installierte Web-App).</li>
          <li><b>E-Mail:</b> an die Adresse deines gemivo-Kontos, einschaltbar im Dashboard.</li>
          <li><b>Telegram:</b> für Beta-Nutzer noch nicht verfügbar.</li>
        </ul>

        <h2 id="android">6. Android-App, Rechte, Akku</h2>
        <ol>
          <li><a href="/download/gemivo-anruf.apk">App herunterladen (APK)</a> und öffnen. Android fragt einmalig, ob dein Browser Apps installieren darf: <span className="menue">Einstellungen</span> › „Aus dieser Quelle zulassen“.</li>
          <li>In der App <b>„Mit gemivo verbinden“</b>: Du meldest dich im Browser an, die App bekommt einen eigenen Geräteschlüssel. Alternativ den 8-stelligen Kopplungscode aus <a href="/koppeln">anruf.gemivo.de/koppeln</a> eintippen.</li>
          <li><b>Anruf-Filter-Rolle:</b> Die App fragt, ob sie deine <span className="menue">Anrufer-ID- und Spam-App</span> sein darf. Bestätigen. Deine normale Telefon-App bleibt unverändert.</li>
          <li><b>Kontakte:</b> erlauben. Nur so erkennt die App bekannte Nummern. Ohne dieses Recht lehnt die App aus Sicherheitsgründen gar nichts ab.</li>
          <li><b>Akku:</b> Die App bittet um die Ausnahme von der Akku-Optimierung. Zusätzlich je nach Hersteller:
            <ul>
              <li>OnePlus/OPPO/realme (ColorOS): <span className="menue">App-Info › Akkunutzung</span> › „Hintergrundaktivität zulassen“ einschalten.</li>
              <li>Samsung (One UI): <span className="menue">App-Info › Akku</span> › „Nicht eingeschränkt“.</li>
              <li>Xiaomi/Redmi/POCO (HyperOS/MIUI): <span className="menue">App-Info › Akkusparmodus</span> › „Keine Einschränkungen“ und „Autostart“ an.</li>
            </ul>
            Ohne das kann das System die App einfrieren, dann wird ein unbekannter Anruf nicht abgelehnt und klingelt normal.</li>
        </ol>

        <h2 id="umleitung">7. Rufumleitung</h2>
        <p>Die App erzeugt den Code mit deiner Nummer und wählt ihn auf Knopfdruck. Von Hand in der Telefon-App eintippen und Anruftaste drücken:</p>
        <Bildschirm titel="Telefon-App › Tastenfeld" zeilen={[["Einschalten (bei besetzt)", "**67*04511234567#"], ["Status prüfen", "*#67#"], ["Ausschalten", "##67#"]]} />
        <p>Nimm das nationale Format ohne „+“ (das Pluszeichen geht bei manchen Handys beim Wählen von Codes verloren). Das Netz bestätigt mit einer Meldung wie „Rufumleitung aktiviert“. Achtung: Eine bestehende Mailbox-Umleitung „bei besetzt“ wird dadurch ersetzt.</p>

        <h2 id="test">8. Test-Anruf</h2>
        <ol>
          <li>Prüfe im Dashboard: alle Punkte grün, Anschluss „angemeldet“.</li>
          <li>Lass dich von einer Nummer anrufen, die <b>nicht</b> in deinen Kontakten steht (z. B. ein Freund mit unterdrückter Nummer).</li>
          <li>Dein Handy klingelt nicht; Gemma meldet sich. Nach dem Auflegen erscheinen Zusammenfassung und Transkript im Dashboard, dazu Push/E-Mail.</li>
        </ol>
        <p>Klingelt dein Handy trotzdem: Akku-Einstellungen (Schritt 6) prüfen. Hört der Anrufer ein Besetztzeichen: Umleitung prüfen (<span className="mono">*#67#</span>). Hört er „Assistentin nicht verfügbar“: Gemini-Schlüssel/Guthaben prüfen.</p>

        <h2 id="kosten">9. Kosten</h2>
        <ul>
          <li><b>gemivo:</b> kostenlos (Beta).</li>
          <li><b>Google Gemini (dein Schlüssel):</b> laut offizieller Preisseite für <span className="mono">gemini-3.8-live</span> (Paid Tier): Audio-Eingang 3,00 US-$ pro 1 Mio. Token „oder 0,005 $/Minute“, Audio-Ausgabe 12,00 US-$ pro 1 Mio. Token „oder 0,018 $/Minute“. Ein Gespräch ist bei Gemma auf 60 Sekunden begrenzt; als grober Richtwert also wenige US-Cent pro Anruf. Dazu kommt eine kleine Textanfrage für die Zusammenfassung. Den genauen Verbrauch zeigt dir AI Studio.</li>
          <li><b>Rufumleitung:</b> Dein Mobilfunkanbieter rechnet die Weiterleitung wie einen Anruf von dir ins deutsche Festnetz ab. In einer Allnet-Flat ist das meist enthalten, aber prüfe deinen Tarif.</li>
          <li><b>FritzBox:</b> keine Zusatzkosten. <b>SIP-Anbieter:</b> laut dessen Preisliste.</li>
        </ul>

        <h2 id="aus">10. Ausschalten und Löschen</h2>
        <ul>
          <li><b>Kurz aus:</b> in der App den Schalter „Gemma nimmt an“ ausschalten (unbekannte Nummern klingeln wieder normal) oder <span className="mono">##67#</span> wählen.</li>
          <li><b>Pausieren:</b> im Dashboard „Gemma pausieren“ – Gemma meldet sich von deinem Anschluss ab.</li>
          <li><b>Einzelne Anrufe löschen:</b> im Dashboard beim Anruf „Löschen“.</li>
          <li><b>Alles löschen:</b> Dashboard › „Meine Daten löschen“. Entfernt Anrufe, Transkripte, Zugangsdaten, Gemini-Schlüssel und Geräte. Danach in der FRITZ!Box das IP-Telefon „Gemma“ entfernen, <span className="mono">##67#</span> wählen und die App deinstallieren. Den Gemini-Schlüssel kannst du in AI Studio löschen.</li>
        </ul>

        <h2 id="datenschutz">Datenschutz</h2>
        <ul>
          <li>Anrufer hören zu Beginn, dass eine digitale Assistentin spricht.</li>
          <li>Gespeichert werden Nummer, Zeit, Dauer, Transkript und Zusammenfassung, auf dem gemivo-Server in Deutschland, bis du sie löschst. Tonaufnahmen werden nicht gespeichert.</li>
          <li>Das Gesprächsaudio wird zur Verarbeitung an Google (Gemini API) übertragen, über deinen eigenen Schlüssel. Bei aktivierter Abrechnung verwendet Google die Inhalte laut Preisseite nicht zur Produktverbesserung, im Free Tier schon.</li>
          <li>SIP-Kennwort und Gemini-Schlüssel liegen verschlüsselt (AES-256-GCM) auf dem Server und werden nur für deinen Anschluss benutzt.</li>
          <li>Wenn du Anrufe beruflich annehmen lässt, bist du für die Anrufer-Daten verantwortlich (z. B. Hinweis in deiner Datenschutzerklärung).</li>
        </ul>

        <h2 id="grenzen">Was Gemma kann und nicht kann</h2>
        <ul>
          <li><b>Kann:</b> freundlich abnehmen, nach dem Anliegen fragen, den Wunsch wiederholen, sich verabschieden; Zusammenfassung mit Name/Firma/Anliegen, soweit genannt.</li>
          <li><b>Kann nicht:</b> Termine vereinbaren, Auskünfte über dich geben, zu dir durchstellen, Zusagen machen. Gespräche enden nach höchstens 60 Sekunden oder 10 Sekunden Stille.</li>
          <li>Spracherkennung kann sich irren; im Zweifel zurückrufen.</li>
          <li>Nur Android, nur mit Umleitung „bei besetzt“. Anrufe bekannter Kontakte bleiben unberührt.</li>
        </ul>
      </main>
      <Fuss />
    </>
  );
}
