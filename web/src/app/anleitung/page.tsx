import type { Metadata } from "next";
import { Kopf, Fuss } from "@/components/Kopf";
import { Bildschirm } from "@/components/Bildschirm";
import { SCHRITTE, HINWEISE, zuHtml } from "@/lib/anleitung";

export const metadata: Metadata = { title: "Anleitung – Gemma Anrufassistent", description: "Schritt für Schritt: Gemini-Schlüssel, FritzBox oder SIP-Anbieter, Android-App, Rufumleitung, Kosten, Abschalten." };

const INHALT = [
  ["voraussetzungen", "Voraussetzungen"], ...SCHRITTE.map((s, i) => [s.id, `${i + 1}. ${s.titel}`]),
  ["gut-zu-wissen", "Gut zu wissen: Was passieren kann"], ["kosten", "Kosten"], ["aus", "Ausschalten und Löschen"], ["datenschutz", "Datenschutz"], ["grenzen", "Was Gemma kann und nicht kann"],
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

        <h2 id="voraussetzungen">Voraussetzungen</h2>
        <ul>
          <li><b>Android-Handy</b> (ab Android 10). iPhones gehen nicht: iOS erlaubt Apps das Ablehnen einzelner Anrufe nicht.</li>
          <li><b>Eine Festnetz- oder SIP-Rufnummer</b>, auf die dein Handy umleiten kann: entweder eine <b>FRITZ!Box</b> mit Festnetznummer (Weg A) oder ein <b>SIP-Anbieter</b> (Weg B, z. B. sipgate, easybell, dus.net). Am besten eine zweite Nummer, damit dein normales Festnetztelefon nicht mitklingelt.</li>
          <li><b>Ein Google-Konto mit Gemini-API-Schlüssel</b> (Google AI Studio). Für ernsthafte Nutzung mit aktivierter Abrechnung bzw. Guthaben, siehe Schritt 2.</li>
          <li><b>Ein gemivo-Konto</b> (kostenlos, <a href="https://gemivo.de/konto/registrieren.php">hier anlegen</a>).</li>
          <li>Optional: Telegram ist für Beta-Nutzer derzeit nicht verfügbar; du bekommst die Zusammenfassungen per Push oder E-Mail.</li>
        </ul>
        <p><b>Nicht nötig:</b> VPN/WireGuard, ein eigener Server oder OpenRouter.</p>

        <h2 id="einrichtung">Einrichtung in 8 Schritten</h2>
        <p>Genau diese Schritte führt dich auch die Android-App durch (gleicher Text, eine Quelle).</p>
        {SCHRITTE.map((st, n) => (
          <section key={st.id} id={st.id} className="scroll-mt-16">
            {st.id === "anschluss" && <><span id="fritzbox" /><span id="sip" /></>}
            {st.id === "rechte" && <span id="android" />}
            <h2>Schritt {n + 1}: {st.titel}</h2>
            <p className="text-tx2">{st.ziel}</p>
            {st.id === "rechte" && <p><a href="/download/gemivo-anruf.apk">App herunterladen (APK)</a>. Android fragt einmalig, ob dein Browser Apps installieren darf.</p>}
            <ol>
              {st.unterschritte.map((u, k) => (
                <li key={k}>
                  <span dangerouslySetInnerHTML={{ __html: zuHtml(u.text) }} />
                  {u.skizze && <Bildschirm titel={u.skizze.titel} pfad={u.skizze.pfad} zeilen={u.skizze.zeilen} />}
                  {u.bild && <figure className="my-3"><img src={`/anleitung/${u.bild}.png`} alt={u.bildText || ""} loading="lazy" className="karte max-h-[420px] w-auto" /><figcaption className="text-xs text-tx2">{u.bildText}</figcaption></figure>}
                </li>
              ))}
            </ol>
            {Object.keys(st.hilfe).length > 0 && (
              <details className="karte mt-2 p-3"><summary className="cursor-pointer font-semibold">Klappt nicht? Was tun</summary>
                <ul>{Object.values(st.hilfe).map((h, k) => <li key={k}>{h}</li>)}</ul></details>
            )}
            {st.quelle && <p className="text-sm text-tx2">Quelle: {st.quelle}</p>}
          </section>
        ))}

        <h2 id="gut-zu-wissen">Gut zu wissen: Was passieren kann</h2>
        <ul>{HINWEISE.map(h => <li key={h.id} id={"hinweis-" + h.id}><b>{h.titel}:</b> <span dangerouslySetInnerHTML={{ __html: zuHtml(h.text) }} /></li>)}</ul>

        <h2 id="kosten">Kosten</h2>
        <ul>
          <li><b>gemivo:</b> kostenlos (Beta).</li>
          <li><b>Google Gemini (dein Schlüssel):</b> laut offizieller Preisseite für <span className="mono">gemini-3.8-live</span> (Paid Tier): Audio-Eingang 3,00 US-$ pro 1 Mio. Token „oder 0,005 $/Minute“, Audio-Ausgabe 12,00 US-$ pro 1 Mio. Token „oder 0,018 $/Minute“. Ein Gespräch ist bei Gemma auf 60 Sekunden begrenzt; als grober Richtwert also wenige US-Cent pro Anruf. Dazu kommt eine kleine Textanfrage für die Zusammenfassung. Den genauen Verbrauch zeigt dir AI Studio.</li>
          <li><b>Rufumleitung:</b> Dein Mobilfunkanbieter rechnet die Weiterleitung wie einen Anruf von dir ins deutsche Festnetz ab. In einer Allnet-Flat ist das meist enthalten, aber prüfe deinen Tarif.</li>
          <li><b>FritzBox:</b> keine Zusatzkosten. <b>SIP-Anbieter:</b> laut dessen Preisliste.</li>
        </ul>

        <h2 id="aus">Ausschalten und Löschen</h2>
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
