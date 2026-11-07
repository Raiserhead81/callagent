import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { SCHRITTE } from "@/lib/regeln";
const EREIGNISSE = ["gesehen", "erledigt", "abgebrochen", "fertig"];
/** Einrichtungs-Funnel: welcher Schritt gesehen/erledigt/abgebrochen (Admin sieht nur Summen je Schritt). */
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const b = await body(req);
  const schritt = String(b.schritt || ""), ereignis = String(b.ereignis || "");
  if (!(SCHRITTE as readonly string[]).includes(schritt) && schritt !== "assistent") return fehler("schritt");
  if (!EREIGNISSE.includes(ereignis)) return fehler("ereignis");
  // Duplikate begrenzen: gleiches Ereignis je Nutzer/Schritt hoechstens einmal pro Stunde
  const seit = new Date(Date.now() - 3600_000).toISOString();
  const dup = await db.funnel.findFirst({ where: { userId: u.uid, schritt, ereignis, erstellt: { gte: seit } } });
  if (!dup) await db.funnel.create({ data: { userId: u.uid, schritt, ereignis, quelle: u.quelle, erstellt: new Date().toISOString() } });
  return ok();
}
