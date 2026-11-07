import { NextRequest } from "next/server";
import { internOk } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { anrufMelden } from "@/lib/melden";
import { db } from "@/lib/db";
/** Engine -> Web: Anruf fertig, Nutzer benachrichtigen (nur diesen Nutzer, Anruf muss ihm gehoeren). */
export async function POST(req: NextRequest) {
  if (!internOk(req)) return fehler("forbidden", 403);
  const b = await body(req);
  const uid = Number(b.userId), callId = Number(b.callId);
  const c = await db.call.findFirst({ where: { id: callId, userId: uid }, select: { id: true } });
  if (!c) return fehler("Anruf gehoert nicht zum Nutzer", 404);
  return ok(await anrufMelden(uid, callId, String(b.nummer || ""), String(b.zusammenfassung || "")));
}
