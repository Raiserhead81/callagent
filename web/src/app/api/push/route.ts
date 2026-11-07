import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { zufall } from "@/lib/krypto";
import { pushAn } from "@/lib/melden";
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const b = await body(req);
  const ep = String(b?.endpoint || "");
  if (!/^https:\/\//.test(ep) || !b?.keys?.p256dh || !b?.keys?.auth) return fehler("Push-Abo ungültig");
  const alt = await db.pushAbo.findUnique({ where: { endpoint: ep } });
  if (alt && alt.userId !== u.uid) await db.pushAbo.deleteMany({ where: { endpoint: ep, userId: alt.userId } }); // Geraet wechselt Konto
  await db.pushAbo.upsert({ where: { endpoint: ep }, create: { id: zufall(12), userId: u.uid, endpoint: ep, p256dh: b.keys.p256dh, auth: b.keys.auth, erstellt: new Date().toISOString() },
    update: { p256dh: b.keys.p256dh, auth: b.keys.auth } });
  await db.mandant.update({ where: { userId: u.uid }, data: { notifyPush: 1 } });
  const n = b.test ? await pushAn(u.uid, "Gemma Anrufassistent", "Benachrichtigungen sind eingerichtet.", "/app") : 0;
  return ok({ gesendet: n });
}
export async function DELETE(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  await db.pushAbo.deleteMany({ where: { userId: u.uid } });
  await db.mandant.update({ where: { userId: u.uid }, data: { notifyPush: 0 } });
  return ok();
}
