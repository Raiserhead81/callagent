import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { geminiKeyForm } from "@/lib/regeln";
import { testeKey } from "@/lib/gemini";
import { verschluesseln, entschluesseln } from "@/lib/krypto";
import { pjsipSync } from "@/lib/engine";

/** POST {key?} -> Key testen (echter Live-Connect) und bei Erfolg verschluesselt speichern. Ohne key: gespeicherten neu testen. */
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (u.owner) return ok({ test: { ok: true, schritt: "fertig" }, hinweis: "Owner nutzt den gemivo-Key." });
  const b = await body(req);
  const m = await db.mandant.findUnique({ where: { userId: u.uid } });
  let key = String(b.key || "").trim();
  if (!key) { try { key = entschluesseln(m?.geminiKeyEnc); } catch { key = ""; } }
  if (!geminiKeyForm(key)) return fehler("Das sieht nicht wie ein Gemini-API-Schlüssel aus (beginnt mit AIza… oder AQ.…).");
  const t = await testeKey(key);
  const jetzt = new Date().toISOString();
  await db.mandant.update({
    where: { userId: u.uid },
    data: t.ok ? { geminiKeyEnc: verschluesseln(key), geminiStatus: "ok", geminiGeprueft: jetzt, geminiFehler: null, geaendert: jetzt }
      : (b.key ? { geminiFehler: t.fehler || "Test fehlgeschlagen", geminiGeprueft: jetzt } : { geminiStatus: "fehler", geminiFehler: t.fehler || "Test fehlgeschlagen", geminiGeprueft: jetzt }),
  });
  if (t.ok || !b.key) await pjsipSync();
  return ok({ test: t });
}
export async function DELETE(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (u.owner) return fehler("Owner-Key wird nicht hier verwaltet.");
  await db.mandant.update({ where: { userId: u.uid }, data: { geminiKeyEnc: null, geminiStatus: "fehlt", geminiFehler: null } });
  await pjsipSync();
  return ok();
}
