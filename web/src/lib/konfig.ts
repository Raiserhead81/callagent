import fs from "fs";
/** Liest eine Datei leise (leer bei Fehler). */
export function datei(p: string): string {
  try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; }
}
/** KEY=VALUE aus einer env-Datei (z.B. /etc/gemivo/gemivo.env) */
export function envAus(p: string, name: string): string {
  const m = datei(p).match(new RegExp("^" + name + "=[\"']?([^\"'\\n]*)", "m"));
  return m ? m[1].trim() : "";
}
const GEMIVO_ENV = "/etc/gemivo/gemivo.env";
export const cfg = {
  ssoSecret: () => process.env.GEMIVO_SSO_SECRET || envAus(GEMIVO_ENV, "GEMIVO_SSO_SECRET"),
  internToken: () => process.env.CALLAGENT_TOKEN || datei("/opt/callagent/.app-token"),
  engine: () => process.env.CALLAGENT_ENGINE || "http://127.0.0.1:3114",
  ownerUid: 8,
  basisUrl: () => process.env.ANRUF_BASIS_URL || "https://anruf.gemivo.de",
  // Bezahlschranke: Kay 07.11.2026 -> erstmal kostenlos (Beta). Nur mit ANRUF_PAYWALL=true aktiv.
  paywall: () => (process.env.ANRUF_PAYWALL || "false") === "true",
  testTage: 14,
  apkUrl: "/download/gemivo-anruf.apk",
};
