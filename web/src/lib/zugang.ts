import { cfg, envAus } from "./konfig";
import { db } from "./db";
/**
 * Darf Gemma fuer diesen Nutzer Anrufe annehmen? (Bezahlschranke vorbereitet, standardmaessig AUS)
 * ANRUF_PAYWALL=false (Kay 07.11.2026: Beta kostenlos) -> immer frei.
 * Sonst: Owner frei; 14 Tage ab Einrichtung frei; danach gemivo-Abo (Plan "anruf" oder "bundle", Status active).
 */
export async function zugang(uid: number): Promise<{ aktiv: boolean; grund: string; testTageRest?: number }> {
  if (!cfg.paywall()) return { aktiv: true, grund: "beta-kostenlos" };
  if (uid === cfg.ownerUid) return { aktiv: true, grund: "owner" };
  const m = await db.mandant.findUnique({ where: { userId: uid } });
  if (!m) return { aktiv: false, grund: "unbekannt" };
  const rest = testTageRest(m.erstellt, cfg.testTage);
  if (rest > 0) return { aktiv: true, grund: "testphase", testTageRest: rest };
  try {
    const tok = envAus("/etc/gemivo/gemivo.env", "INTERNAL_API_TOKEN");
    const r = await fetch(`https://gemivo.de/konto/api/subscription.php?gemivo_id=${uid}&app=anruf`, { headers: { "X-Internal-Token": tok }, signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    const ok = j.active && j.status === "active" && ["anruf", "bundle"].includes(j.plan);
    return { aktiv: !!ok, grund: ok ? "abo" : "kein-abo", testTageRest: 0 };
  } catch { return { aktiv: true, grund: "abo-api-weg-fail-open" }; }
}
export function testTageRest(erstellt: string | null | undefined, tage: number, jetzt = Date.now()): number {
  if (!erstellt) return tage;
  const ende = Date.parse(erstellt) + tage * 86400000;
  return Math.max(0, Math.ceil((ende - jetzt) / 86400000));
}
