import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { pruefeName } from "@/lib/regeln";
import { pjsipSync } from "@/lib/engine";

export async function PUT(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const b = await body(req);
  const data: Record<string, unknown> = { geaendert: new Date().toISOString() };
  if (b.vorname !== undefined) {
    if (u.owner) return fehler("Kays Anschluss nutzt die feste Begrüßung (Owner).");
    const f = pruefeName(b.vorname); if (f) return fehler(f);
    data.vorname = String(b.vorname).trim();
  }
  if (b.aussprache !== undefined) {
    const a = String(b.aussprache || "").trim();
    if (a && pruefeName(a)) return fehler("Aussprache: " + pruefeName(a));
    data.aussprache = a || null;
  }
  if (b.notifyEmail !== undefined) data.notifyEmail = b.notifyEmail ? 1 : 0;
  if (b.notifyPush !== undefined) data.notifyPush = b.notifyPush ? 1 : 0;
  if (b.aktiv !== undefined && !u.owner) data.aktiv = b.aktiv ? 1 : 0;
  if (b.telegramTrennen) data.tgChatId = null;
  await db.mandant.update({ where: { userId: u.uid }, data });
  if (b.vorname !== undefined || b.aktiv !== undefined) await pjsipSync();
  return ok();
}
