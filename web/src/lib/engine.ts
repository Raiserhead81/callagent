import { cfg } from "./konfig";
/** Interne Engine-API (CallAgent :3114): PJSIP neu erzeugen, Registrierungsstatus. */
async function ruf(pfad: string, methode = "GET"): Promise<any> {
  const r = await fetch(cfg.engine() + pfad, { method: methode, headers: { "X-App-Token": cfg.internToken() }, signal: AbortSignal.timeout(15000) });
  return r.json();
}
export const pjsipSync = () => ruf("/api/intern/pjsip-sync", "POST").catch(e => ({ ok: false, fehler: String(e) }));
export const regStatus = (uid: number) => ruf("/api/intern/reg-status?uid=" + uid).catch(() => ({ ok: false, status: "engine-fehler" }));
