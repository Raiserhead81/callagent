"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fehlerText, zeit, pushAktivieren } from "@/lib/client";
import { FeedbackKnopf } from "@/components/Feedback";

type Anruf = { id: number; nummer: string | null; start: string | null; ende: string | null; grund: string | null; zusammenfassung: string | null; dauer: number | null; daumen: number | null };
const SCHRITT_NAMEN: Record<string, string> = { gemini: "Gemini-Schlüssel", anschluss: "Anschluss angemeldet", name: "Name für Begrüßung", benachrichtigung: "Benachrichtigung", rechte: "App-Rechte (in der App)", umleitung: "Rufumleitung (in der App)", test: "Erster Anruf" };

export function Dashboard() {
  const [me, setMe] = useState<any>(null);
  const [anrufe, setAnrufe] = useState<Anruf[] | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const [transkript, setTranskript] = useState<Record<number, { ich: boolean; text: string }[]>>({});
  const [msg, setMsg] = useState("");
  const laden = useCallback(async () => {
    const [a, b] = await Promise.all([api("/api/me"), api("/api/anrufe")]);
    if (a.ok) setMe(a); if (b.ok) setAnrufe(b.anrufe);
  }, []);
  useEffect(() => {
    laden();
    const q = new URLSearchParams(location.search).get("anruf");
    if (q) oeffne(Number(q));
    const i = setInterval(laden, 30000); return () => clearInterval(i);
  }, [laden]);
  async function oeffne(id: number) {
    setOffen(o => o === id ? null : id);
    if (!transkript[id]) { const r = await api(`/api/anrufe/${id}`); if (r.ok) setTranskript(t => ({ ...t, [id]: r.anruf.transkript })); }
  }
  async function loeschen(id: number) {
    if (!confirm("Diesen Anruf mit Transkript endgültig löschen?")) return;
    const r = await api(`/api/anrufe/${id}`, { method: "DELETE" }); if (r.ok) setAnrufe(x => (x || []).filter(c => c.id !== id)); else setMsg(fehlerText(r.fehler));
  }
  async function bewerten(id: number, daumen: number) {
    const text = daumen < 0 ? prompt("Was war nicht gut? (optional)") || "" : "";
    const r = await api("/api/feedback", { method: "POST", body: { art: "anruf", callId: id, daumen, text } });
    if (r.ok) setAnrufe(x => (x || []).map(c => c.id === id ? { ...c, daumen } : c)); else setMsg(fehlerText(r.fehler));
  }
  async function profil(d: Record<string, unknown>) { const r = await api("/api/profil", { method: "PUT", body: d }); if (!r.ok) setMsg(fehlerText(r.fehler)); laden(); }
  async function push() { setMsg("Push wird eingerichtet …"); const f = await pushAktivieren(me.vapid); setMsg(f || "Push ist aktiv. Eine Test-Nachricht ist unterwegs."); laden(); }
  async function allesLoeschen() {
    const t = prompt("Alle deine Anrufe, Zugangsdaten, Schlüssel und Geräte löschen? Zum Bestätigen LÖSCHEN eintippen.");
    if (t !== "LÖSCHEN") return;
    const r = await api("/api/konto", { method: "DELETE", body: { bestaetigung: "LÖSCHEN" } });
    if (r.ok) location.href = "/"; else setMsg(fehlerText(r.fehler));
  }

  if (!me) return <main className="mx-auto max-w-3xl px-4 py-8 text-tx2">Lade …</main>;
  const fehlend = Object.entries(me.schritte as Record<string, boolean>).filter(([k, v]) => !v && SCHRITT_NAMEN[k]);
  const bereit = me.schritte.gemini && me.schritte.anschluss && me.schritte.name;
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
      <section className={"karte p-4 " + (bereit ? "" : "border-warn")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={"inline-block h-3 w-3 rounded-full " + (bereit && me.profil.aktiv ? "bg-ok" : "bg-warn")} aria-hidden />
          <h1 className="text-lg font-bold">{!me.profil.aktiv ? "Gemma ist pausiert" : bereit ? "Gemma ist bereit" : "Einrichtung noch nicht fertig"}</h1>
          <span className="ml-auto text-sm text-tx2" data-testid="zaehler">{me.zaehler.text}</span>
        </div>
        <p className="mt-1 text-sm text-tx2">Anschluss: <b data-testid="regstatus">{statusText(me.sip.status)}</b>{me.sip.nummer ? ` · Nummer ${me.sip.nummer}` : ""}</p>
        {!me.nutzer.owner && me.gemini.status !== "ok" && <p className="mt-2 text-sm text-fehl">Ohne gültigen Gemini-Schlüssel nimmt Gemma keine Anrufe an. {me.gemini.fehler || ""}</p>}
        {fehlend.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold">Noch offen:</p>
            <ul className="mt-1 flex flex-wrap gap-2">{fehlend.map(([k]) => <li key={k}><a className="knopf knopf-2 !min-h-9 text-sm" href={`/einrichtung?schritt=${k}`}>{SCHRITT_NAMEN[k]}</a></li>)}</ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="knopf knopf-2" href="/einrichtung">Einrichtung</a>
          {!me.nutzer.owner && <button className="knopf knopf-2" onClick={() => profil({ aktiv: !me.profil.aktiv })}>{me.profil.aktiv ? "Gemma pausieren" : "Gemma wieder einschalten"}</button>}
        </div>
      </section>
      {msg && <p className="karte mt-3 p-3 text-sm" role="status">{msg}</p>}

      <section className="mt-5">
        <h2 className="text-lg font-bold">Anrufe</h2>
        {anrufe === null ? <p className="text-tx2">Lade …</p> : anrufe.length === 0 ? (
          <p className="karte mt-2 p-4 text-tx2" data-testid="leer">Noch keine Anrufe. Sobald Gemma einen Anruf angenommen hat, erscheint er hier.</p>
        ) : (
          <ul className="mt-2 grid gap-3" data-testid="anrufliste">
            {anrufe.map(c => (
              <li key={c.id} className="karte p-4" data-testid={"anruf-" + c.id}>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="mono font-semibold">{c.nummer && c.nummer !== "unbekannt" ? c.nummer : "unterdrückt"}</span>
                  <span className="text-sm text-tx2">{zeit(c.start)}{c.dauer !== null ? ` · ${c.dauer} s` : ""}</span>
                </div>
                <p className="mt-1">{c.zusammenfassung || <span className="text-tx2">Zusammenfassung folgt …</span>}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.nummer && /^\+?\d{4,}$/.test(c.nummer) && <a className="knopf !min-h-10 text-sm" href={`tel:${c.nummer}`}>Zurückrufen</a>}
                  <button className="knopf knopf-2 !min-h-10 text-sm" onClick={() => oeffne(c.id)} aria-expanded={offen === c.id}>Transkript</button>
                  <span className="ml-auto flex items-center gap-1 text-sm text-tx2">Gut?
                    <button aria-label="Gespräch war gut" aria-pressed={c.daumen === 1} className={"h-10 w-10 rounded-lg text-xl " + (c.daumen === 1 ? "bg-ak-weich" : "")} onClick={() => bewerten(c.id, 1)}>👍</button>
                    <button aria-label="Gespräch war nicht gut" aria-pressed={c.daumen === -1} className={"h-10 w-10 rounded-lg text-xl " + (c.daumen === -1 ? "bg-ak-weich" : "")} onClick={() => bewerten(c.id, -1)}>👎</button>
                  </span>
                </div>
                {offen === c.id && (
                  <div className="mt-3 border-t border-rand pt-3 text-sm">
                    {(transkript[c.id] || []).length === 0 ? <p className="text-tx2">Kein Transkript.</p> :
                      transkript[c.id].map((z, i) => <p key={i} className="my-1"><b>{z.ich ? "Gemma" : "Anrufer"}:</b> {z.text}</p>)}
                    <button className="knopf knopf-gefahr mt-2 !min-h-10 text-sm" onClick={() => loeschen(c.id)}>Löschen</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="karte mt-5 p-4">
        <h2 className="font-bold">Benachrichtigung</h2>
        {me.nutzer.owner ? <p className="mt-1 text-sm text-tx2">Du bekommst Anrufe per Telegram (Hermes).</p> : (
          <div className="mt-2 grid gap-2">
            <div className="flex flex-wrap items-center gap-2"><span>Push: {me.pushAbos > 0 ? "aktiv auf " + me.pushAbos + " Gerät(en)" : "aus"}</span>
              <button className="knopf knopf-2 !min-h-10 text-sm" onClick={push}>{me.pushAbos > 0 ? "Dieses Gerät hinzufügen" : "Push aktivieren"}</button></div>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={me.profil.notifyEmail} onChange={e => profil({ notifyEmail: e.target.checked })} /> E-Mail an {me.nutzer.email || "dein gemivo-Konto"}</label>
          </div>
        )}
      </section>

      <section className="karte mt-5 p-4">
        <h2 className="font-bold">Android-App</h2>
        <p className="mt-1 text-sm text-tx2">Gekoppelte Geräte: {me.geraete.length || "keine"}</p>
        <div className="mt-2 flex flex-wrap gap-2"><a className="knopf knopf-2" href={me.apk}>App herunterladen</a><a className="knopf knopf-2" href="/koppeln">Gerät koppeln</a>
          {me.nutzer.owner && <a className="knopf knopf-2" href="/admin">Admin: Feedback</a>}</div>
      </section>

      {!me.nutzer.owner && (
        <section className="mt-5 p-1"><button className="knopf knopf-gefahr" onClick={allesLoeschen}>Meine Daten löschen</button></section>
      )}
      <FeedbackKnopf schritt="dashboard" />
    </main>
  );
}
export function statusText(s: string) {
  return ({ Registered: "angemeldet", Unregistered: "nicht angemeldet", Rejected: "abgelehnt (Zugangsdaten?)", "nicht-konfiguriert": "noch nicht aktiv", aus: "kein Anschluss", "engine-fehler": "Server nicht erreichbar" } as Record<string, string>)[s] || s;
}
