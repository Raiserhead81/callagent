// Gemini-Key echt pruefen: (1) Modell abrufbar (REST), (2) kurzer Live-Connect (setupComplete).
export const LIVE_MODELL = process.env.ANRUF_LIVE_MODELL || "gemini-3.8-live";
export interface KeyTest { ok: boolean; schritt: "rest" | "live" | "fertig"; fehler?: string; ms?: number }

export function fehlerText(status: number, body: string): string {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) return "Der Schlüssel ist ungültig. Bitte in AI Studio neu kopieren.";
  if (status === 402 || /Payment Required|prepay|billing/i.test(body)) return "Kein Guthaben: Bitte in AI Studio unter Billing Guthaben aufladen (Prepay) oder Abrechnung einrichten.";
  if (status === 403) return "Zugriff verweigert: Ist die Gemini API für das Projekt aktiviert?";
  if (status === 404) return "Das Live-Modell ist für diesen Schlüssel nicht verfügbar.";
  if (status === 429) return "Limit erreicht (Free-Tier-Ratenlimit oder Tageskontingent). Später erneut versuchen oder Abrechnung aktivieren.";
  return "Unerwartete Antwort von Google (" + status + ").";
}

export async function testeKey(key: string, timeoutMs = 10000): Promise<KeyTest> {
  const t0 = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${LIVE_MODELL}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { ok: false, schritt: "rest", fehler: fehlerText(r.status, await r.text()) };
  } catch (e) { return { ok: false, schritt: "rest", fehler: "Google nicht erreichbar: " + String(e).slice(0, 80) }; }
  return new Promise<KeyTest>((resolve) => {
    const url = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=" + encodeURIComponent(key);
    let fertig = false;
    const ende = (x: KeyTest) => { if (fertig) return; fertig = true; clearTimeout(timer); try { ws.close(); } catch {} resolve({ ...x, ms: Date.now() - t0 }); };
    const ws = new WebSocket(url);
    const timer = setTimeout(() => ende({ ok: false, schritt: "live", fehler: "Keine Antwort vom Live-Modell (Zeitüberschreitung)." }), timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({ setup: { model: "models/" + LIVE_MODELL, generationConfig: { responseModalities: ["AUDIO"] } } }));
    ws.onmessage = async (ev: MessageEvent) => {
      const d = typeof ev.data === "string" ? ev.data : Buffer.from(await (ev.data as Blob).arrayBuffer?.() ?? ev.data).toString();
      if (d.includes("setupComplete")) ende({ ok: true, schritt: "fertig" });
      else if (d.includes("error")) ende({ ok: false, schritt: "live", fehler: "Live-Fehler: " + d.slice(0, 160) });
    };
    ws.onclose = (ev: CloseEvent) => ende({ ok: false, schritt: "live", fehler: liveCloseText(ev.code, ev.reason) });
    ws.onerror = () => {};
  });
}
export function liveCloseText(code: number, reason: string): string {
  if (/quota|exceeded|billing|prepay|payment/i.test(reason)) return "Live-Modell abgelehnt: kein Guthaben/Kontingent (" + reason.slice(0, 100) + ")";
  if (/API key/i.test(reason)) return "Live-Modell: Schlüssel ungültig.";
  return "Live-Verbindung geschlossen (" + code + (reason ? ": " + reason.slice(0, 120) : "") + ")";
}
