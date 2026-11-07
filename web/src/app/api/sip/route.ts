import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok, fehler, body } from "@/lib/antwort";
import { pruefeSip, nationaleNummer } from "@/lib/regeln";
import { verschluesseln } from "@/lib/krypto";
import { pjsipSync, regStatus } from "@/lib/engine";

export async function POST(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (u.owner) return fehler("Kays Anschluss läuft über den bestehenden FritzBox-VPN-Weg und wird hier nicht geändert.");
  const b = await body(req);
  const m = await db.mandant.findUnique({ where: { userId: u.uid } });
  const d = { modus: String(b.modus || ""), server: String(b.server || "").trim(), port: b.port || 5060, user: String(b.user || "").trim(),
    authUser: String(b.authUser || "").trim(), pass: b.pass ? String(b.pass) : "", domain: String(b.domain || "").trim(), nummer: String(b.nummer || ""), ipv: String(b.ipv || "auto") };
  const f = pruefeSip(d, !m?.sipPassEnc);
  if (f.length) return fehler(f);
  const data: Record<string, unknown> = d.modus === "aus" ? { sipModus: "aus", geaendert: new Date().toISOString() } : {
    sipModus: d.modus, sipServer: d.server, sipPort: Number(d.port), sipUser: d.user, sipAuthUser: d.authUser || null,
    sipDomain: d.domain || null, sipNummer: nationaleNummer(d.nummer), sipIpv: d.ipv, geaendert: new Date().toISOString(),
  };
  if (d.pass) data.sipPassEnc = verschluesseln(d.pass);
  await db.mandant.update({ where: { userId: u.uid }, data });
  const s = await pjsipSync();
  // Registrierung braucht ein paar Sekunden -> Status sofort und Client pollt /api/sip/status
  await new Promise(r => setTimeout(r, 2500));
  return ok({ sync: s, status: (await regStatus(u.uid)).status });
}
