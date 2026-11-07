"use client";
import { useState } from "react";
import { api, fehlerText } from "@/lib/client";

/** Gut sichtbarer Feedback-Knopf (unten rechts): Kategorie, Sterne, Text. */
export function FeedbackKnopf({ schritt }: { schritt?: string }) {
  const [offen, setOffen] = useState(false);
  const [kat, setKat] = useState("idee"); const [sterne, setSterne] = useState(0); const [text, setText] = useState("");
  const [msg, setMsg] = useState(""); const [laeuft, setLaeuft] = useState(false);
  const senden = async () => {
    setLaeuft(true); setMsg("");
    const r = await api("/api/feedback", { method: "POST", body: { art: "feedback", kategorie: kat, sterne: sterne || undefined, text, schritt, geraet: navigator.userAgent.slice(0, 80) } });
    setLaeuft(false);
    if (r.ok) { setMsg("Danke! Dein Feedback ist angekommen."); setText(""); setSterne(0); setTimeout(() => setOffen(false), 1500); } else setMsg(fehlerText(r.fehler));
  };
  return (
    <>
      <button onClick={() => setOffen(true)} className="knopf fixed bottom-4 right-4 z-30 shadow-lg" aria-haspopup="dialog">Feedback</button>
      {offen && (
        <div role="dialog" aria-modal="true" aria-label="Feedback" className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={e => e.target === e.currentTarget && setOffen(false)}>
          <div className="karte w-full max-w-md p-4">
            <h2 className="text-lg font-bold">Feedback zur Beta</h2>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Kategorie">
              {[["fehler", "Fehler"], ["idee", "Idee"], ["lob", "Lob"]].map(([k, t]) => (
                <button key={k} role="radio" aria-checked={kat === k} onClick={() => setKat(k)} className={"knopf flex-1 " + (kat === k ? "" : "knopf-2")}>{t}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1" aria-label="Sterne (optional)">
              {[1, 2, 3, 4, 5].map(s => <button key={s} aria-label={s + " Sterne"} onClick={() => setSterne(s === sterne ? 0 : s)} className="h-11 w-11 text-2xl">{s <= sterne ? "★" : "☆"}</button>)}
              <span className="ml-2 text-sm text-tx2">optional</span>
            </div>
            <textarea className="eingabe mt-3 min-h-28" placeholder="Was ist dir aufgefallen?" value={text} onChange={e => setText(e.target.value)} maxLength={4000} />
            {msg && <p className="mt-2 text-sm">{msg}</p>}
            <div className="mt-3 flex gap-2">
              <button className="knopf knopf-2 flex-1" onClick={() => setOffen(false)}>Schließen</button>
              <button className="knopf flex-1" disabled={laeuft || (!text.trim() && !sterne)} onClick={senden}>Senden</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
