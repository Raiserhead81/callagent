"use client";
import { useEffect, useRef, useState } from "react";
import { api, fehlerText, funnel, pushAktivieren } from "@/lib/client";
import { FeedbackKnopf } from "@/components/Feedback";
import { statusText } from "../app/Dashboard";

const SCHRITTE: [string, string][] = [["gemini", "Gemini-Schlüssel"], ["anschluss", "FritzBox / SIP"], ["name", "Begrüßung"], ["benachrichtigung", "Benachrichtigung"], ["rechte", "Android-App"], ["umleitung", "Rufumleitung"], ["test", "Test-Anruf"]];

export function Assistent() {
  const [me, setMe] = useState<any>(null);
  const [akt, setAkt] = useState("gemini");
  const [msg, setMsg] = useState<{ t: string; gut?: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const erledigt = useRef<Set<string>>(new Set());
  const laden = async () => { const r = await api("/api/me"); if (r.ok) setMe(r); return r; };
  useEffect(() => {
    laden().then(r => {
      const q = new URLSearchParams(location.search).get("schritt");
      if (q && SCHRITTE.some(s => s[0] === q)) setAkt(q);
      else if (r.ok) setAkt((SCHRITTE.find(([k]) => !r.schritte[k]) || SCHRITTE[0])[0]);
    });
  }, []);
  useEffect(() => {
    funnel(akt, "gesehen");
    const weg = () => { if (document.visibilityState === "hidden" && !erledigt.current.has(akt)) funnel(akt, "abgebrochen"); };
    document.addEventListener("visibilitychange", weg);
    return () => document.removeEventListener("visibilitychange", weg);
  }, [akt]);
  const geschafft = (k: string) => { erledigt.current.add(k); funnel(k, "erledigt"); };
  const weiter = () => { const i = SCHRITTE.findIndex(s => s[0] === akt); setMsg(null); if (i < SCHRITTE.length - 1) setAkt(SCHRITTE[i + 1][0]); window.scrollTo({ top: 0 }); };

  if (!me) return <main className="mx-auto max-w-3xl px-4 py-8 text-tx2">Lade …</main>;
  const owner = me.nutzer.owner;
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-5">
      <h1 className="text-xl font-bold">Einrichtung</h1>
      <p className="text-sm text-tx2">Am bequemsten in der Android-App (gleiche Schritte, dieselben Daten). Ausführlich: <a href="/anleitung">Anleitung</a>.</p>
      <ol className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Schritte">
        {SCHRITTE.map(([k, t], i) => (
          <li key={k}><button onClick={() => { setMsg(null); setAkt(k); }} aria-current={akt === k ? "step" : undefined}
            className={"knopf !min-h-10 whitespace-nowrap text-sm " + (akt === k ? "" : "knopf-2")}>
            <span aria-label={me.schritte[k] ? "erledigt" : "offen"} className={me.schritte[k] ? "text-ok" : "text-fehl"}>{me.schritte[k] ? "✓" : "○"}</span>{i + 1}. {t}</button></li>
        ))}
      </ol>
      {msg && <p role="status" className={"karte mt-2 p-3 text-sm " + (msg.gut ? "text-ok" : "text-fehl")} data-testid="meldung">{msg.t}</p>}
      <section className="karte mt-3 p-4">
        {akt === "gemini" && <Gemini me={me} owner={owner} setMsg={setMsg} laeuft={laeuft} setLaeuft={setLaeuft} fertig={async () => { geschafft("gemini"); await laden(); }} />}
        {akt === "anschluss" && <Anschluss me={me} owner={owner} setMsg={setMsg} laeuft={laeuft} setLaeuft={setLaeuft} fertig={async () => { await laden(); }} geschafft={() => geschafft("anschluss")} />}
        {akt === "name" && <Name me={me} owner={owner} setMsg={setMsg} fertig={async () => { geschafft("name"); await laden(); }} />}
        {akt === "benachrichtigung" && <Melden me={me} owner={owner} setMsg={setMsg} fertig={async () => { geschafft("benachrichtigung"); await laden(); }} />}
        {akt === "rechte" && <Rechte me={me} />}
        {akt === "umleitung" && <Umleitung me={me} />}
        {akt === "test" && <Test me={me} laden={laden} />}
        <div className="mt-5 flex justify-between gap-2 border-t border-rand pt-3">
          <a className="knopf knopf-2" href="/app">Zum Dashboard</a>
          {akt !== "test" && <button className="knopf" onClick={weiter}>Weiter</button>}
        </div>
      </section>
      <FeedbackKnopf schritt={akt} />
    </main>
  );
}
type P = { me: any; owner: boolean; setMsg: (m: { t: string; gut?: boolean } | null) => void; laeuft?: boolean; setLaeuft?: (b: boolean) => void; fertig: () => Promise<void> };

function Gemini({ me, owner, setMsg, laeuft, setLaeuft, fertig }: P) {
  const [key, setKey] = useState("");
  if (owner) return <><h2 className="font-bold">Gemini</h2><p className="mt-1 text-tx2">Dein Anschluss nutzt den gemivo-Owner-Schlüssel. Nichts zu tun.</p></>;
  const test = async (neu: boolean) => {
    setLaeuft!(true); setMsg({ t: "Teste echte Verbindung zum Live-Modell …", gut: true });
    const r = await api("/api/gemini", { method: "POST", body: neu ? { key } : {} });
    setLaeuft!(false);
    if (!r.ok) return setMsg({ t: fehlerText(r.fehler) });
    if (r.test.ok) { setMsg({ t: `Schlüssel funktioniert (Live-Verbindung in ${((r.test.ms || 0) / 1000).toFixed(1)} s). Gespeichert.`, gut: true }); setKey(""); await fertig(); }
    else setMsg({ t: r.test.fehler || "Test fehlgeschlagen" });
  };
  return (
    <>
      <h2 className="font-bold">Gemini-API-Schlüssel</h2>
      <p className="mt-1 text-sm text-tx2">Status: <b className={me.gemini.status === "ok" ? "text-ok" : "text-fehl"} data-testid="gemini-status">{me.gemini.status === "ok" ? "gültig" : me.gemini.status === "fehlt" ? "fehlt" : "Fehler"}</b>{me.gemini.fehler ? " – " + me.gemini.fehler : ""}</p>
      <ol className="mt-3 list-decimal pl-5 text-sm">
        <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a> öffnen, „API-Schlüssel erstellen“.</li>
        <li>Unter „Projects“ › „Set up billing“ Abrechnung aktivieren bzw. Guthaben (Prepay, ab 5 $) aufladen. <a href="/anleitung#gemini">Warum?</a></li>
        <li>Schlüssel hier einfügen und testen.</li>
      </ol>
      <label className="mt-3 block text-sm font-semibold" htmlFor="key">Schlüssel</label>
      <input id="key" className="eingabe mono mt-1" autoComplete="off" spellCheck={false} placeholder="AIza…" value={key} onChange={e => setKey(e.target.value.trim())} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="knopf" disabled={laeuft || key.length < 30} onClick={() => test(true)}>Schlüssel testen und speichern</button>
        {me.gemini.status !== "fehlt" && <button className="knopf knopf-2" disabled={laeuft} onClick={() => test(false)}>Gespeicherten erneut testen</button>}
      </div>
    </>
  );
}

function Anschluss({ me, owner, setMsg, laeuft, setLaeuft, fertig, geschafft }: P & { geschafft: () => void }) {
  const s = me.sip;
  const [f, setF] = useState({ modus: s.modus === "anbieter" ? "anbieter" : "fritzbox", server: s.server, port: String(s.port || 5060), user: s.user, authUser: s.authUser, pass: "", domain: s.domain, nummer: s.nummer, ipv: s.ipv || "auto" });
  const [status, setStatus] = useState<string>(s.status); const [hinweis, setHinweis] = useState("");
  const [erw, setErw] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const pruefen = async (mal = 6) => {
    for (let i = 0; i < mal; i++) {
      const r = await api("/api/sip/status");
      if (r.ok) { setStatus(r.status); setHinweis(r.hinweis || ""); if (r.status === "Registered") { geschafft(); return true; } }
      await new Promise(x => setTimeout(x, 2500));
    }
    return false;
  };
  if (owner) return <><h2 className="font-bold">Anschluss</h2><p className="mt-1 text-tx2">Kays FritzBox läuft über WireGuard und bleibt unverändert.</p>
    <p className="mt-2">Status: <b data-testid="regstatus">{statusText(status)}</b></p><button className="knopf knopf-2 mt-2" onClick={() => pruefen(1)}>Verbindungstest</button></>;
  const speichern = async () => {
    setLaeuft!(true); setMsg({ t: "Speichere und melde Gemma an …", gut: true });
    const r = await api("/api/sip", { method: "POST", body: { ...f, port: Number(f.port) } });
    if (!r.ok) { setLaeuft!(false); return setMsg({ t: fehlerText(r.fehler) }); }
    setStatus(r.status); setF({ ...f, pass: "" });
    const ok = r.status === "Registered" || (await pruefen());
    setLaeuft!(false);
    setMsg(ok ? { t: "Gemma ist an deinem Anschluss angemeldet.", gut: true } : { t: "Gespeichert, aber noch nicht angemeldet. Siehe Hinweis unten." });
    await fertig();
  };
  return (
    <>
      <h2 className="font-bold">FritzBox oder SIP-Anbieter</h2>
      <div className="mt-2 flex gap-2" role="radiogroup">
        {[["fritzbox", "FRITZ!Box"], ["anbieter", "SIP-Anbieter"]].map(([k, t]) => <button key={k} role="radio" aria-checked={f.modus === k} className={"knopf flex-1 " + (f.modus === k ? "" : "knopf-2")} onClick={() => setF({ ...f, modus: k })}>{t}</button>)}
      </div>
      <p className="mt-2 text-sm text-tx2">{f.modus === "fritzbox" ? <>In der FRITZ!Box ein IP-Telefon „Gemma“ anlegen und „Anmeldung aus dem Internet erlauben“ anhaken. <a href="/anleitung#fritzbox">So geht&apos;s in der FritzBox</a></> : <>Werte aus dem Kundenportal deines Anbieters (SIP-Gerät). <a href="/anleitung#sip">So geht&apos;s</a></>}</p>
      <div className="mt-3 grid gap-3">
        <Feld id="server" label={f.modus === "fritzbox" ? "Registrar (MyFRITZ!-Adresse)" : "Registrar / Server"} value={f.server} onChange={set("server")} ph={f.modus === "fritzbox" ? "abcd1234efgh5678.myfritz.net" : "sipgate.de"} />
        <Feld id="user" label="Benutzername" value={f.user} onChange={set("user")} ph={f.modus === "fritzbox" ? "gemma" : "1234567e0"} />
        <Feld id="pass" label={s.passGesetzt ? "Kennwort (leer = unverändert)" : "Kennwort"} value={f.pass} onChange={set("pass")} typ="password" />
        <Feld id="nummer" label="Rufnummer (Ziel der Umleitung)" value={f.nummer} onChange={set("nummer")} ph="0451 1234567" typ="tel" />
        <button className="text-left text-sm underline" onClick={() => setErw(!erw)} aria-expanded={erw}>Erweitert (Port, Auth-Benutzer, Domain, IP-Version)</button>
        {erw && <div className="grid gap-3">
          <Feld id="port" label="Port" value={f.port} onChange={set("port")} typ="number" />
          <Feld id="authUser" label="Auth-Benutzer (falls abweichend)" value={f.authUser} onChange={set("authUser")} />
          <Feld id="domain" label="Domain/Realm (falls abweichend)" value={f.domain} onChange={set("domain")} />
          <label className="text-sm font-semibold">IP-Version<select className="eingabe mt-1" value={f.ipv} onChange={set("ipv")}><option value="auto">automatisch</option><option value="v4">IPv4</option><option value="v6">IPv6 (DS-Lite)</option></select></label>
        </div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="knopf" disabled={laeuft} onClick={speichern}>Speichern und verbinden</button>
        <button className="knopf knopf-2" disabled={laeuft} onClick={() => pruefen(1)}>Verbindungstest</button>
      </div>
      <p className="mt-3">Status: <b data-testid="regstatus" className={status === "Registered" ? "text-ok" : "text-fehl"}>{statusText(status)}</b></p>
      {hinweis && <p className="text-sm text-tx2">{hinweis}</p>}
    </>
  );
}
function Feld({ id, label, value, onChange, ph, typ = "text" }: { id: string; label: string; value: string; onChange: (e: any) => void; ph?: string; typ?: string }) {
  return <label htmlFor={id} className="text-sm font-semibold">{label}<input id={id} name={id} type={typ} className="eingabe mt-1" value={value || ""} onChange={onChange} placeholder={ph} autoComplete="off" spellCheck={false} /></label>;
}

function Name({ me, owner, setMsg, fertig }: P) {
  const [v, setV] = useState(me.profil.vorname); const [a, setA] = useState(me.profil.aussprache);
  if (owner) return <><h2 className="font-bold">Begrüßung</h2><p className="mt-1 text-tx2">Fest: „… hier spricht Gemma, die Assistentin von Kay.“ (Aussprache „Kai“)</p></>;
  const speichern = async () => { const r = await api("/api/profil", { method: "PUT", body: { vorname: v, aussprache: a } }); if (r.ok) { setMsg({ t: "Gespeichert.", gut: true }); await fertig(); } else setMsg({ t: fehlerText(r.fehler) }); };
  return (
    <>
      <h2 className="font-bold">Name für die Begrüßung</h2>
      <p className="mt-1 text-sm text-tx2">Vorschau: „Schönen guten Tag, hier spricht Gemma, die digitale Assistentin von <b>{v || "…"}</b>. {v || "…"} ist gerade leider nicht erreichbar – kann ich etwas für Sie aufnehmen?“</p>
      <div className="mt-3 grid gap-3">
        <Feld id="vorname" label="Vorname" value={v} onChange={e => setV(e.target.value)} ph="Anna" />
        <Feld id="aussprache" label="Aussprache-Schreibweise (optional)" value={a} onChange={e => setA(e.target.value)} ph="z. B. Kai für Kay" />
      </div>
      <button className="knopf mt-3" onClick={speichern}>Speichern</button>
    </>
  );
}
function Melden({ me, owner, setMsg, fertig }: P) {
  if (owner) return <><h2 className="font-bold">Benachrichtigung</h2><p className="mt-1 text-tx2">Telegram über Hermes (Chat 805026354), unverändert.</p></>;
  const push = async () => { setMsg({ t: "Richte Push ein …", gut: true }); const f = await pushAktivieren(me.vapid); setMsg(f ? { t: f } : { t: "Push aktiv, Test-Nachricht gesendet.", gut: true }); if (!f) await fertig(); };
  const mail = async (an: boolean) => { const r = await api("/api/profil", { method: "PUT", body: { notifyEmail: an } }); if (r.ok) await fertig(); };
  return (
    <>
      <h2 className="font-bold">Wie willst du benachrichtigt werden?</h2>
      <div className="mt-3 grid gap-3">
        <div><button className="knopf" onClick={push}>Push auf diesem Gerät aktivieren</button><p className="mt-1 text-sm text-tx2">Aktive Geräte: {me.pushAbos}</p></div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={me.profil.notifyEmail} onChange={e => mail(e.target.checked)} /> E-Mail an {me.nutzer.email || "dein gemivo-Konto"}</label>
        <p className="text-sm text-tx2">Telegram: für Beta-Nutzer noch nicht verfügbar.</p>
      </div>
    </>
  );
}
function Rechte({ me }: { me: any }) {
  return (
    <>
      <h2 className="font-bold">Android-App installieren</h2>
      <ol className="mt-2 list-decimal pl-5 text-sm">
        <li><a href={me.apk}>App herunterladen</a> und installieren.</li>
        <li>In der App „Mit gemivo verbinden“ (oder Code von <a href="/koppeln">/koppeln</a>).</li>
        <li>Die App fragt nacheinander: Rolle „Anrufer-ID- und Spam-App“, Kontakte, Akku-Ausnahme. Alle bestätigen.</li>
      </ol>
      <p className="mt-2 text-sm">Status aus der App: <b className={me.schritte.rechte ? "text-ok" : "text-fehl"}>{me.schritte.rechte ? "erledigt" : "noch nicht gemeldet"}</b></p>
    </>
  );
}
function Umleitung({ me }: { me: any }) {
  return (
    <>
      <h2 className="font-bold">Rufumleitung bei besetzt</h2>
      {me.umleitung.ein ? <>
        <p className="mt-2 text-sm">In der Telefon-App eintippen und Anruftaste drücken (oder in der App auf „Umleitung einschalten“):</p>
        <p className="mono mt-2 text-2xl font-bold" data-testid="umleitung">{me.umleitung.ein}</p>
        <p className="mt-2 text-sm text-tx2">Ausschalten: <span className="mono">{me.umleitung.aus}</span> · Status: <span className="mono">*#67#</span> · Kosten: wie ein Festnetzanruf in deinem Tarif.</p>
      </> : <p className="mt-2 text-fehl">Erst im Schritt „FritzBox / SIP“ die Rufnummer eintragen.</p>}
    </>
  );
}
function Test({ me, laden }: { me: any; laden: () => Promise<any> }) {
  const [sterne, setSterne] = useState(0); const [text, setText] = useState(""); const [fertig, setFertig] = useState(false);
  useEffect(() => { try { setFertig(localStorage.getItem("anruf-einrichtung-bewertet") === "1"); } catch {} }, []);
  const bewerten = async () => {
    const r = await api("/api/feedback", { method: "POST", body: { art: "einrichtung", sterne, text, schritt: "test" } });
    if (r.ok) { setFertig(true); funnel("assistent", "fertig"); try { localStorage.setItem("anruf-einrichtung-bewertet", "1"); } catch {} }
  };
  return (
    <>
      <h2 className="font-bold">Test-Anruf</h2>
      <p className="mt-2 text-sm">Lass dich von einer Nummer anrufen, die nicht in deinen Kontakten steht. Dein Handy klingelt nicht, Gemma nimmt ab.</p>
      <p className="mt-2">Letzter Anruf: <b className={me.letzterAnruf ? "text-ok" : "text-tx2"}>{me.letzterAnruf ? "angekommen ✓" : "noch keiner"}</b> <button className="knopf knopf-2 !min-h-9 text-sm" onClick={laden}>Aktualisieren</button></p>
      <div className="mt-4 border-t border-rand pt-3">
        {fertig ? <p className="text-ok">Danke für deine Bewertung!</p> : <>
          <p className="font-semibold">Wie leicht war die Einrichtung?</p>
          <div className="mt-1 flex gap-1">{[1, 2, 3, 4, 5].map(s => <button key={s} aria-label={s + " von 5"} onClick={() => setSterne(s)} className="h-11 w-11 text-2xl">{s <= sterne ? "★" : "☆"}</button>)}</div>
          <textarea className="eingabe mt-2" placeholder="Kommentar (optional)" value={text} onChange={e => setText(e.target.value)} />
          <button className="knopf mt-2" disabled={!sterne} onClick={bewerten}>Bewertung senden</button>
        </>}
      </div>
    </>
  );
}
