import { Kopf, Fuss } from "@/components/Kopf";

const SCHRITTE = [
  ["Unbekannte Nummer ruft an", "Die Android-App erkennt: nicht in deinen Kontakten. Dein Handy klingelt nicht."],
  ["Umleitung zu Gemma", "Der Anruf geht per Rufumleitung „bei besetzt“ an deine FritzBox- oder SIP-Nummer, dort nimmt Gemma ab."],
  ["Gemma fragt nach", "Sie sagt, dass sie deine digitale Assistentin ist, nimmt das Anliegen auf und verabschiedet sich."],
  ["Du bekommst die Notiz", "Zusammenfassung per Push oder E-Mail, Transkript und Rückruf-Knopf im Dashboard."],
];

export default function Start() {
  return (
    <>
      <Kopf />
      <main className="mx-auto max-w-3xl px-4">
        <section className="pb-6 pt-10">
          <p className="text-sm font-semibold text-ak">Beta · kostenlos · Android</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">Unbekannte Anrufer? Gemma geht ran.</h1>
          <p className="mt-3 text-lg text-tx2">Kontakte klingeln wie immer. Alle anderen Anrufe nimmt Gemma, deine digitale Assistentin, an, fragt nach dem Anliegen und schickt dir eine kurze Zusammenfassung.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className="knopf" href="/einrichtung">Jetzt einrichten</a>
            <a className="knopf knopf-2" href="/anleitung">Anleitung lesen</a>
          </div>
        </section>

        <section className="karte p-5">
          <h2 className="text-lg font-bold">So läuft ein Anruf</h2>
          <ol className="mt-3 grid gap-3">
            {SCHRITTE.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ak-weich font-bold text-ak">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-tx2">{d}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="karte p-5">
            <h2 className="font-bold">Was du brauchst</h2>
            <ul className="mt-2 list-disc pl-5 text-tx2">
              <li>Android-Handy (kein iPhone)</li>
              <li>FRITZ!Box mit Festnetznummer oder SIP-Anbieter</li>
              <li>Eigenen Gemini-API-Schlüssel von Google</li>
              <li>Kostenloses gemivo-Konto</li>
            </ul>
          </div>
          <div className="karte p-5">
            <h2 className="font-bold">Was es kostet</h2>
            <ul className="mt-2 list-disc pl-5 text-tx2">
              <li>gemivo: kostenlos (Beta)</li>
              <li>Google Gemini: nach Verbrauch über deinen Schlüssel, laut Preisseite wenige Cent pro Minute</li>
              <li>Umleitung: wie ein Festnetzanruf in deinem Mobilfunktarif</li>
            </ul>
            <a className="mt-2 inline-block text-sm" href="/anleitung#kosten">Details</a>
          </div>
        </section>

        <section className="karte mt-6 p-5">
          <h2 className="font-bold">Ehrlich gesagt</h2>
          <ul className="mt-2 list-disc pl-5 text-tx2">
            <li>Gemma nimmt Nachrichten auf. Sie macht keine Termine, gibt keine Auskünfte über dich und stellt nicht durch.</li>
            <li>Gespräche dauern höchstens 60 Sekunden.</li>
            <li>Anrufer hören gleich zu Beginn, dass eine KI spricht. Transkripte speichern wir, bis du sie löschst. Tonaufnahmen speichern wir nicht.</li>
            <li>Die FritzBox-Anmeldung über das Internet hängt von deinem Anschluss ab (bei Kabel/DS-Lite nur über IPv6). Der Verbindungstest zeigt dir, ob es klappt.</li>
          </ul>
        </section>
      </main>
      <Fuss />
    </>
  );
}
