import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { pjsipSync } from "@/lib/engine";
/** Nutzer loescht seine Daten (Anrufe, Zugangsdaten, Geraete, Push, Feedback). Nur eigene (userId). */
export async function DELETE(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (u.owner) return fehler("Owner-Konto wird nicht über die App gelöscht.");
  const b = await body(req);
  if (b.bestaetigung !== "LÖSCHEN") return fehler("Bitte LÖSCHEN eintippen.");
  const w = { userId: u.uid };
  await db.$transaction([
    db.call.deleteMany({ where: w }), db.geraet.deleteMany({ where: w }), db.pushAbo.deleteMany({ where: w }),
    db.feedback.deleteMany({ where: w }), db.funnel.deleteMany({ where: w }), db.kopplung.deleteMany({ where: w }), db.tgLink.deleteMany({ where: w }),
    db.mandant.deleteMany({ where: w }),
  ]);
  await pjsipSync();
  return ok();
}
