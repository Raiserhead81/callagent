import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler } from "@/lib/antwort";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Ctx) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const id = Number((await ctx.params).id);
  const c = await db.call.findFirst({ where: { id, userId: u.uid } });
  if (!c) return fehler("nicht gefunden", 404);
  let transkript: unknown[] = []; try { transkript = JSON.parse(c.transkript || "[]"); } catch {}
  return ok({ anruf: { ...c, transkript } });
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const id = Number((await ctx.params).id);
  const r = await db.call.deleteMany({ where: { id, userId: u.uid } });
  await db.feedback.deleteMany({ where: { callId: id, userId: u.uid } });
  return r.count ? ok({ geloescht: r.count }) : fehler("nicht gefunden", 404);
}
