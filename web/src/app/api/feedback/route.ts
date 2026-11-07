import { NextRequest } from "next/server";
import fs from "fs";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { telegramAnKay } from "@/lib/melden";
import { zufall } from "@/lib/krypto";

const ARTEN = ["feedback", "einrichtung", "anruf"];
const KAT = ["fehler", "idee", "lob"];
const SHOT_DIR = process.env.ANRUF_SHOT_DIR || "/opt/callagent/data/feedback-shots";

/** Feedback speichern (Text/Sterne/Kategorie/Screenshot; Anruf-Daumen; Einrichtungs-Bewertung) + sofort Telegram an Kay. */
export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const b = await body(req);
  const art = String(b.art || "feedback");
  if (!ARTEN.includes(art)) return fehler("art ungültig");
  const kategorie = b.kategorie && KAT.includes(b.kategorie) ? b.kategorie : null;
  const sterne = b.sterne ? Math.round(Number(b.sterne)) : null;
  if (sterne !== null && !(sterne >= 1 && sterne <= 5)) return fehler("Sterne 1 bis 5");
  const daumen = b.daumen === 1 || b.daumen === -1 ? b.daumen : null;
  const text = String(b.text || "").trim().slice(0, 4000) || null;
  let callId: number | null = null;
  if (art === "anruf") {
    callId = Number(b.callId);
    const c = await db.call.findFirst({ where: { id: callId, userId: u.uid }, select: { id: true } });
    if (!c) return fehler("Anruf nicht gefunden", 404);
    if (daumen === null) return fehler("Daumen hoch oder runter fehlt");
  } else if (art === "feedback" && !text && !sterne) return fehler("Bitte kurz etwas schreiben oder Sterne vergeben.");
  else if (art === "einrichtung" && !sterne) return fehler("Bitte 1 bis 5 wählen.");
  let screenshot: string | null = null;
  if (b.screenshot && typeof b.screenshot === "string") {
    const m = b.screenshot.match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!m) return fehler("Screenshot-Format");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 3_000_000) return fehler("Screenshot zu groß (max. 3 MB)");
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    screenshot = `${u.uid}-${Date.now()}-${zufall(6)}.${m[1] === "png" ? "png" : "jpg"}`;
    fs.writeFileSync(SHOT_DIR + "/" + screenshot, buf, { mode: 0o600 });
  }
  const daten = {
    userId: u.uid, art, kategorie, sterne, daumen, text, callId,
    appVersion: str(b.appVersion, 40), geraet: str(b.geraet, 80), android: str(b.android, 20), schritt: str(b.schritt, 40),
    quelle: u.quelle, screenshot, erstellt: new Date().toISOString(),
  };
  // Anruf-Bewertung: eine je Anruf (aktualisieren statt doppeln)
  let id: number;
  const vorhanden = art === "anruf" ? await db.feedback.findFirst({ where: { userId: u.uid, art, callId } }) : null;
  if (vorhanden) id = (await db.feedback.update({ where: { id: vorhanden.id }, data: daten })).id;
  else id = (await db.feedback.create({ data: daten })).id;
  const teile = [`💬 Anruf-App Feedback #${id} (${art}${kategorie ? "/" + kategorie : ""})`, `Nutzer ${u.uid}${u.owner ? " (Kay)" : ""} · ${u.quelle}${daten.appVersion ? " " + daten.appVersion : ""}`];
  if (sterne) teile.push("Sterne: " + "★".repeat(sterne) + "☆".repeat(5 - sterne));
  if (daumen !== null) teile.push(`Anruf #${callId}: ${daumen > 0 ? "👍" : "👎"}`);
  if (daten.schritt) teile.push("Schritt: " + daten.schritt);
  if (text) teile.push("", text);
  if (screenshot) teile.push("(mit Screenshot)");
  teile.push("", "Admin: https://anruf.gemivo.de/admin");
  if (u.uid < 990000) await telegramAnKay(teile.join("\n")); // Testnutzer (>=990000) nicht melden
  return ok({ id });
}
function str(v: unknown, n: number) { const s = String(v ?? "").trim(); return s ? s.slice(0, n) : null; }
