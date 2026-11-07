import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { cfg } from "./konfig";
import { verifySso } from "./sso";
import { sha256 } from "./krypto";

export interface Nutzer { uid: number; email: string; name: string; owner: boolean; quelle: "web" | "app" }

/** Nutzer aus gemivo_sso-Cookie (Web) ODER Geraete-Token (Android-App, Header Authorization: Bearer). */
export async function nutzer(req: NextRequest): Promise<Nutzer | null> {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t.length < 20) return null;
    const g = await db.geraet.findUnique({ where: { tokenHash: sha256(t) } });
    if (!g) return null;
    await db.geraet.update({ where: { id: g.id }, data: { zuletzt: new Date().toISOString() } });
    const m = await db.mandant.findUnique({ where: { userId: g.userId } });
    return { uid: g.userId, email: m?.email || "", name: m?.anzeigeName || "", owner: g.userId === cfg.ownerUid, quelle: "app" };
  }
  const p = verifySso(req.cookies.get("gemivo_sso")?.value, cfg.ssoSecret());
  if (!p) return null;
  const uid = Number(p.sub);
  const jetzt = new Date().toISOString();
  // Erstlogin: Mandant anlegen (nur additiv, Owner-Zeile uid 8 existiert bereits und wird nicht ueberschrieben)
  await db.mandant.upsert({
    where: { userId: uid },
    create: { userId: uid, email: p.email || null, anzeigeName: p.name || null, vorname: vornameAus(p.name), notifyEmail: 0, erstellt: jetzt, geaendert: jetzt },
    update: uid === cfg.ownerUid ? {} : { email: p.email || undefined, anzeigeName: p.name || undefined },
  });
  return { uid, email: p.email || "", name: p.name || "", owner: uid === cfg.ownerUid, quelle: "web" };
}
function vornameAus(n?: string | null): string | null {
  const v = String(n || "").trim().split(/\s+/)[0];
  return v && /^[\p{L}][\p{L}\-']{1,39}$/u.test(v) ? v : null;
}
export const nichtAngemeldet = () => NextResponse.json({ ok: false, fehler: "nicht angemeldet" }, { status: 401 });
/** Interne Aufrufe der Engine (127.0.0.1, gleicher Token wie Engine). */
export function internOk(req: NextRequest): boolean {
  const t = cfg.internToken();
  return !!t && req.headers.get("x-intern-token") === t;
}
