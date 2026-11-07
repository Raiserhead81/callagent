"use client";
export async function api<T = any>(pfad: string, opt: { method?: string; body?: unknown } = {}): Promise<T & { ok: boolean; fehler?: string | string[] }> {
  const r = await fetch(pfad, { method: opt.method || "GET", headers: opt.body ? { "Content-Type": "application/json" } : undefined,
    body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store", credentials: "same-origin" });
  if (r.status === 401) { location.href = "https://gemivo.de/konto/login.php?next=" + encodeURIComponent(location.href); }
  try { return await r.json(); } catch { return { ok: false, fehler: "Serverfehler " + r.status } as any; }
}
export const fehlerText = (f: unknown) => Array.isArray(f) ? f.join(" · ") : String(f || "Fehler");
export function funnel(schritt: string, ereignis: string) {
  try { navigator.sendBeacon?.("/api/funnel", new Blob([JSON.stringify({ schritt, ereignis })], { type: "application/json" })) || fetch("/api/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schritt, ereignis }), keepalive: true }); } catch {}
}
export function zeit(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export async function pushAktivieren(vapid: string): Promise<string> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "Dieser Browser kann keine Push-Nachrichten (auf dem iPhone erst nach „Zum Home-Bildschirm“).";
  const erl = await Notification.requestPermission();
  if (erl !== "granted") return "Benachrichtigungen wurden nicht erlaubt.";
  const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
  const k = Uint8Array.from(atob(vapid.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((vapid.length + 3) % 4)), c => c.charCodeAt(0));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: k });
  const r = await api("/api/push", { method: "POST", body: { ...sub.toJSON(), test: true } });
  return r.ok ? "" : fehlerText(r.fehler);
}
