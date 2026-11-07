import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok } from "@/lib/antwort";
import crypto from "crypto";
/** Web (angemeldet): Kopplungscode fuer die Android-App erzeugen (10 Min, einmalig). */
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u || u.quelle !== "web") return nichtAngemeldet();
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(crypto.randomBytes(8)).map(b => zeichen[b % zeichen.length]).join("");
  await db.kopplung.deleteMany({ where: { userId: u.uid } });
  await db.kopplung.create({ data: { code, userId: u.uid, ablauf: new Date(Date.now() + 600_000).toISOString() } });
  return ok({ code, deeplink: `gemivoanruf://koppeln?code=${code}` });
}
