import { NextRequest } from "next/server";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok } from "@/lib/antwort";
import { regStatus } from "@/lib/engine";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const m = await db.mandant.findUnique({ where: { userId: u.uid }, select: { sipModus: true, geminiStatus: true, vorname: true, owner: true } });
  const st = await regStatus(u.uid);
  let hinweis = "";
  if (st.status === "nicht-konfiguriert") {
    if (!m?.owner && m?.geminiStatus !== "ok") hinweis = "Erst den Gemini-Schlüssel erfolgreich testen, dann meldet sich Gemma an.";
    else if (!m?.owner && !m?.vorname) hinweis = "Erst den Namen für die Begrüßung speichern.";
    else if (m?.sipModus === "aus") hinweis = "Kein Anschluss eingetragen.";
  } else if (st.status === "Rejected") hinweis = "Die Gegenstelle lehnt die Anmeldung ab: Benutzername/Kennwort prüfen, bei der FritzBox „Anmeldung aus dem Internet erlauben“ aktivieren.";
  else if (st.status === "Unregistered") hinweis = "Noch keine Antwort. Registrar-Adresse und Erreichbarkeit prüfen (siehe Anleitung, DS-Lite/IPv6).";
  return ok({ status: st.status, hinweis });
}
