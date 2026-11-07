import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/antwort";
import { anrufBot, telegramSenden } from "@/lib/melden";
/** Webhook des EIGENEN Anruf-Bots (nie Kays Hermes-Bot: der pollt per getUpdates). Secret-Header Pflicht. */
export async function POST(req: NextRequest) {
  const bot = anrufBot();
  if (!bot || !bot.secret || req.headers.get("x-telegram-bot-api-secret-token") !== bot.secret) return new Response("forbidden", { status: 403 });
  const up = await req.json().catch(() => ({}));
  const msg = up?.message;
  const m = String(msg?.text || "").match(/^\/start\s+([A-Za-z0-9_\-]{10,40})$/);
  if (!m || !msg?.chat?.id) return ok();
  const l = await db.tgLink.findUnique({ where: { token: m[1] } });
  if (!l || l.ablauf < new Date().toISOString()) {
    await telegramSenden(bot.token, String(msg.chat.id), "Der Link ist abgelaufen. Bitte in der App neu verknüpfen.");
    return ok();
  }
  await db.mandant.update({ where: { userId: l.userId }, data: { tgChatId: String(msg.chat.id) } });
  await db.tgLink.deleteMany({ where: { token: m[1] } });
  await telegramSenden(bot.token, String(msg.chat.id), "✅ Verknüpft. Gemma schickt dir hier nach jedem Anruf die Zusammenfassung.");
  return ok();
}
