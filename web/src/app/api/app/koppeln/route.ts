import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fehler, body } from "@/lib/antwort";
import { sha256, zufall } from "@/lib/krypto";
// einfache Bremse gegen Code-Raten (pro Prozess)
const versuche = new Map<string, { n: number; t: number }>();
/** App (ohne Login): Kopplungscode -> Geraete-Token (nur einmal sichtbar, gespeichert als SHA-256). */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "?";
  const v = versuche.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - v.t > 600_000) { v.n = 0; v.t = Date.now(); }
  if (++v.n > 10) return fehler("Zu viele Versuche, bitte 10 Minuten warten.", 429);
  versuche.set(ip, v);
  const b = await body(req);
  const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 8) return fehler("Code hat 8 Zeichen.");
  const k = await db.kopplung.findUnique({ where: { code } });
  if (!k || k.ablauf < new Date().toISOString()) return fehler("Code ungültig oder abgelaufen.", 404);
  await db.kopplung.deleteMany({ where: { code } });
  const token = zufall(32);
  await db.geraet.create({ data: { id: zufall(9), userId: k.userId, tokenHash: sha256(token), name: String(b.name || "Android").slice(0, 60), erstellt: new Date().toISOString() } });
  return ok({ token });
}
