import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler } from "@/lib/antwort";
import { anrufBot } from "@/lib/melden";
import { zufall } from "@/lib/krypto";
/** Einmal-Deep-Link t.me/<bot>?start=<token> (10 Min gueltig). Nur wenn ein eigener Anruf-Bot eingerichtet ist. */
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const bot = anrufBot();
  if (!bot || !bot.name) return fehler("Telegram ist noch nicht freigeschaltet. Nutze Push oder E-Mail.", 409);
  const token = zufall(18);
  await db.tgLink.deleteMany({ where: { userId: u.uid } });
  await db.tgLink.create({ data: { token, userId: u.uid, ablauf: new Date(Date.now() + 600_000).toISOString() } });
  return ok({ link: `https://t.me/${bot.name}?start=${token}` });
}
