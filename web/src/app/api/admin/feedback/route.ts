import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler } from "@/lib/antwort";
import { SCHRITTE } from "@/lib/regeln";
export const dynamic = "force-dynamic";
/** Nur Kay (uid 8): Feedback-Liste, Durchschnitte, Funnel (Anzahl Nutzer je Schritt, ohne Testkonten >= 990000). */
export async function GET(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (!u.owner) return fehler("nur Admin", 403);
  const art = req.nextUrl.searchParams.get("art") || undefined;
  const kat = req.nextUrl.searchParams.get("kategorie") || undefined;
  const echt = { userId: { lt: 990000 } };
  const liste = await db.feedback.findMany({ where: { ...echt, ...(art ? { art } : {}), ...(kat ? { kategorie: kat } : {}) }, orderBy: { id: "desc" }, take: 200 });
  const alle = await db.feedback.findMany({ where: echt, select: { art: true, sterne: true, daumen: true } });
  const schnitt = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null;
  const stats = {
    feedbackSterne: schnitt(alle.filter(f => f.art === "feedback" && f.sterne).map(f => f.sterne!)),
    einrichtungSterne: schnitt(alle.filter(f => f.art === "einrichtung" && f.sterne).map(f => f.sterne!)),
    anrufeGut: alle.filter(f => f.art === "anruf" && f.daumen === 1).length,
    anrufeSchlecht: alle.filter(f => f.art === "anruf" && f.daumen === -1).length,
    anzahl: alle.length,
  };
  const ev = await db.funnel.findMany({ where: echt, select: { userId: true, schritt: true, ereignis: true } });
  const funnel = [...SCHRITTE, "assistent"].map(s => {
    const z = (e: string) => new Set(ev.filter(x => x.schritt === s && x.ereignis === e).map(x => x.userId)).size;
    return { schritt: s, gesehen: z("gesehen"), erledigt: z("erledigt"), abgebrochen: z("abgebrochen"), fertig: z("fertig") };
  });
  const nutzerGesamt = await db.mandant.count({ where: { userId: { lt: 990000 } } });
  return ok({ liste, stats, funnel, nutzerGesamt });
}
