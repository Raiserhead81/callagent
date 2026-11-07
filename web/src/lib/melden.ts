import { execFile } from "child_process";
import webpush from "web-push";
import { db } from "./db";
import { cfg, datei, envAus } from "./konfig";

// Kays Hermes-Bot NUR zum SENDEN an Kay (sendMessage kollidiert nicht mit dem getUpdates-Polling des Gateways).
export async function telegramAnKay(text: string): Promise<boolean> {
  const tok = envAus("/opt/callagent/telegram.env", "TELEGRAM_BOT_TOKEN");
  if (!tok) return false;
  return telegramSenden(tok, process.env.CALLAGENT_TG_CHAT || "805026354", text);
}
// Eigener Anruf-Bot fuer Nutzer (optional, /opt/callagent/anruf-bot.env: ANRUF_BOT_TOKEN, ANRUF_BOT_NAME, ANRUF_BOT_SECRET)
export function anrufBot() {
  const p = "/opt/callagent/anruf-bot.env";
  const token = process.env.ANRUF_BOT_TOKEN || envAus(p, "ANRUF_BOT_TOKEN");
  return token ? { token, name: process.env.ANRUF_BOT_NAME || envAus(p, "ANRUF_BOT_NAME"), secret: process.env.ANRUF_BOT_SECRET || envAus(p, "ANRUF_BOT_SECRET") } : null;
}
export async function telegramSenden(token: string, chat: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }), signal: AbortSignal.timeout(15000),
    });
    return r.ok;
  } catch { return false; }
}
export function mailSenden(an: string, betreff: string, text: string): Promise<boolean> {
  return new Promise(res => execFile("php", ["/var/www/html/gemivo-api/mail-cli.php", "--to=" + an, "--subject=" + betreff, "--body=" + text],
    { timeout: 30000 }, e => res(!e)));
}
let vapidGesetzt = false;
function vapid(): boolean {
  if (vapidGesetzt) return true;
  const pub = process.env.VAPID_PUBLIC || envAus("/etc/gemivo/gemivo.env", "VAPID_PUBLIC");
  const priv = process.env.VAPID_PRIVATE || envAus("/etc/gemivo/gemivo.env", "VAPID_PRIVATE");
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:hallo@gemivo.de", pub, priv);
  vapidGesetzt = true;
  return true;
}
export const vapidPublic = () => process.env.VAPID_PUBLIC || envAus("/etc/gemivo/gemivo.env", "VAPID_PUBLIC");

export async function pushAn(uid: number, titel: string, text: string, url: string): Promise<number> {
  if (!vapid()) return 0;
  const abos = await db.pushAbo.findMany({ where: { userId: uid } });
  let n = 0;
  for (const a of abos) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh || "", auth: a.auth || "" } }, JSON.stringify({ titel, text, url }));
      n++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.pushAbo.deleteMany({ where: { id: a.id, userId: uid } });
    }
  }
  return n;
}

/** Anruf-Benachrichtigung an GENAU diesen Nutzer (alle aktivierten Kanaele). */
export async function anrufMelden(uid: number, callId: number, nummer: string, sum: string) {
  const m = await db.mandant.findUnique({ where: { userId: uid } });
  if (!m) return { ok: false, kanaele: [] as string[] };
  const nr = String(nummer || "").trim() || "unterdrückt";
  const link = `${cfg.basisUrl()}/app?anruf=${callId}`;
  const text = `📞 Gemma hat einen Anruf angenommen\nVon: ${nr}\n\n${sum}\n\n` + (/^\+?\d{4,}$/.test(nr) ? `Zurückrufen: tel:${nr}\n` : "") + `Details und Bewertung: ${link}`;
  const kanaele: string[] = [];
  if (m.notifyPush && (await pushAn(uid, "Anruf von " + nr, sum.slice(0, 180), link)) > 0) kanaele.push("push");
  if (m.notifyEmail && m.email && (await mailSenden(m.email, "Gemma: Anruf von " + nr, text))) kanaele.push("email");
  const bot = anrufBot();
  if (bot && m.tgChatId && (await telegramSenden(bot.token, m.tgChatId, text))) kanaele.push("telegram");
  return { ok: true, kanaele };
}
export { datei };
