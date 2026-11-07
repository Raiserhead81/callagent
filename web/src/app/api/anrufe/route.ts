import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok } from "@/lib/antwort";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const liste = await db.call.findMany({ where: { userId: u.uid }, orderBy: { id: "desc" }, take: 100,
    select: { id: true, nummer: true, start: true, ende: true, grund: true, zusammenfassung: true } });
  const bew = await db.feedback.findMany({ where: { userId: u.uid, art: "anruf", callId: { in: liste.map(c => c.id) } }, select: { callId: true, daumen: true } });
  const b = new Map(bew.map(x => [x.callId, x.daumen]));
  return ok({ anrufe: liste.map(c => ({ ...c, dauer: c.start && c.ende ? Math.max(0, Math.round((Date.parse(c.ende) - Date.parse(c.start)) / 1000)) : null, daumen: b.get(c.id) ?? null })) });
}
