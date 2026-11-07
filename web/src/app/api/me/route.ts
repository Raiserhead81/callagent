import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { ok } from "@/lib/antwort";
import { regStatus } from "@/lib/engine";
import { anrufBot, vapidPublic } from "@/lib/melden";
import { cfg } from "@/lib/konfig";
import { limitText, maskiere, umleitungEin, UMLEITUNG_AUS } from "@/lib/regeln";
import { zugang } from "@/lib/zugang";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  const m = await db.mandant.findUnique({ where: { userId: u.uid } });
  if (!m) return nichtAngemeldet();
  const monat = new Date().toISOString().slice(0, 7);
  const [anzahl, letzter, push, geraete, funnel] = await Promise.all([
    db.call.count({ where: { userId: u.uid, start: { startsWith: monat } } }),
    db.call.findFirst({ where: { userId: u.uid }, orderBy: { id: "desc" }, select: { id: true, start: true } }),
    db.pushAbo.count({ where: { userId: u.uid } }),
    db.geraet.findMany({ where: { userId: u.uid }, select: { id: true, name: true, erstellt: true, zuletzt: true } }),
    db.funnel.findMany({ where: { userId: u.uid, ereignis: "erledigt" }, select: { schritt: true } }),
  ]);
  const reg = m.sipModus === "aus" ? { status: "aus" } : await regStatus(u.uid);
  const z = await zugang(u.uid);
  const appErledigt = new Set(funnel.map(f => f.schritt));
  const owner = !!m.owner;
  const schritte = {
    konto: true,
    gemini: owner || m.geminiStatus === "ok",
    anschluss: reg.status === "Registered",
    name: !!(m.vorname && m.vorname.trim()),
    benachrichtigung: owner || push > 0 || !!m.notifyEmail || !!m.tgChatId,
    rechte: appErledigt.has("rechte"),
    umleitung: appErledigt.has("umleitung"),
    test: !!letzter,
  };
  return ok({
    nutzer: { uid: u.uid, email: m.email, name: m.anzeigeName, owner },
    profil: { vorname: m.vorname || "", aussprache: m.aussprache || "", notifyEmail: !!m.notifyEmail, notifyPush: !!m.notifyPush, telegram: !!m.tgChatId, aktiv: !!m.aktiv },
    gemini: { status: owner ? "ok" : m.geminiStatus, geprueft: m.geminiGeprueft, fehler: m.geminiFehler, eigenerKey: !owner, key: owner ? "gemivo (Owner)" : maskiere(m.geminiKeyEnc ? "gespeichert" : "") },
    sip: { modus: m.sipModus, server: m.sipServer || "", port: m.sipPort, user: m.sipUser || "", authUser: m.sipAuthUser || "", domain: m.sipDomain || "", nummer: m.sipNummer || "", ipv: m.sipIpv, passGesetzt: !!m.sipPassEnc || owner, status: reg.status },
    umleitung: { ein: umleitungEin(m.sipNummer || ""), aus: UMLEITUNG_AUS },
    zaehler: { anzahl, limit: owner ? 0 : m.limitMonat, text: limitText(anzahl, m.limitMonat, owner) },
    zugang: { aktiv: z.aktiv, grund: z.grund, paywall: cfg.paywall() },
    schritte, letzterAnruf: letzter, pushAbos: push, geraete,
    telegramBot: anrufBot() ? true : false, vapid: vapidPublic(), apk: cfg.apkUrl,
  });
}
