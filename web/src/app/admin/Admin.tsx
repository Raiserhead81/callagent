"use client";
import { useEffect, useState } from "react";
import { api, fehlerText, zeit } from "@/lib/client";
export function Admin() {
  const [d, setD] = useState<any>(null); const [f, setF] = useState(""); const [art, setArt] = useState(""); const [kat, setKat] = useState("");
  useEffect(() => { api(`/api/admin/feedback?art=${art}&kategorie=${kat}`).then(r => r.ok ? setD(r) : setF(fehlerText(r.fehler))); }, [art, kat]);
  if (f) return <main className="mx-auto max-w-3xl px-4 py-8 text-fehl">{f}</main>;
  if (!d) return <main className="mx-auto max-w-3xl px-4 py-8 text-tx2">Lade …</main>;
  const w = (v: number | null) => v === null ? "noch keine" : v.toFixed(1) + " / 5";
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-xl font-bold">Beta-Feedback</h1>
      <p className="text-sm text-tx2">Ohne Testkonten (uid ≥ 990000). Nutzer gesamt: {d.nutzerGesamt}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Feedback", w(d.stats.feedbackSterne)], ["Einrichtung", w(d.stats.einrichtungSterne)], ["Anrufe 👍", String(d.stats.anrufeGut)], ["Anrufe 👎", String(d.stats.anrufeSchlecht)]].map(([t, v]) =>
          <div key={t} className="karte p-3"><p className="text-xs text-tx2">{t}</p><p className="text-lg font-bold">{v}</p></div>)}
      </div>
      <h2 className="mt-6 font-bold">Einrichtungs-Funnel (Nutzer je Schritt)</h2>
      <div className="karte mt-2 overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="text-left text-tx2"><th className="p-2">Schritt</th><th className="p-2">gesehen</th><th className="p-2">erledigt</th><th className="p-2">abgebrochen</th></tr></thead>
          <tbody>{d.funnel.map((z: any) => <tr key={z.schritt} className="border-t border-rand"><td className="p-2">{z.schritt}</td><td className="p-2">{z.gesehen}</td><td className="p-2">{z.erledigt || z.fertig}</td><td className="p-2">{z.abgebrochen}</td></tr>)}</tbody></table>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h2 className="font-bold">Einträge</h2>
        <select className="eingabe !w-auto" value={art} onChange={e => setArt(e.target.value)} aria-label="Art"><option value="">alle Arten</option><option value="feedback">Feedback</option><option value="einrichtung">Einrichtung</option><option value="anruf">Anruf</option></select>
        <select className="eingabe !w-auto" value={kat} onChange={e => setKat(e.target.value)} aria-label="Kategorie"><option value="">alle Kategorien</option><option value="fehler">Fehler</option><option value="idee">Idee</option><option value="lob">Lob</option></select>
      </div>
      {d.liste.length === 0 ? <p className="karte mt-2 p-4 text-tx2">Noch kein Feedback.</p> : (
        <ul className="mt-2 grid gap-2">{d.liste.map((x: any) => (
          <li key={x.id} className="karte p-3 text-sm">
            <p className="text-tx2">#{x.id} · {zeit(x.erstellt)} · uid {x.userId} · {x.art}{x.kategorie ? "/" + x.kategorie : ""} · {x.quelle}{x.appVersion ? " " + x.appVersion : ""}{x.schritt ? " · Schritt " + x.schritt : ""}</p>
            <p className="mt-1">{x.sterne ? "★".repeat(x.sterne) + "☆".repeat(5 - x.sterne) + " " : ""}{x.daumen ? (x.daumen > 0 ? "👍 " : "👎 ") + "Anruf #" + x.callId + " " : ""}{x.text}</p>
            {x.screenshot && <a className="text-xs" href={"/api/admin/shot/" + x.screenshot} target="_blank" rel="noopener">Screenshot ansehen</a>}
          </li>))}</ul>
      )}
    </main>
  );
}
