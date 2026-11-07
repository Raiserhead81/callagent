import crypto from "crypto";
import { datei } from "./konfig";
// Gleiches Format wie server/mandant.js: "v1:" + base64(iv12 | tag16 | ciphertext), AES-256-GCM
let _k: Buffer | null = null;
function key(): Buffer {
  if (_k) return _k;
  const hex = (process.env.ANRUF_KEY || datei(process.env.ANRUF_KEY_DATEI || "/etc/gemivo/anruf.key")).trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("anruf.key fehlt");
  _k = Buffer.from(hex, "hex");
  return _k;
}
export function verschluesseln(klar: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(klar, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
export function entschluesseln(enc: string | null | undefined): string {
  if (!enc || !enc.startsWith("v1:")) return "";
  const b = Buffer.from(enc.slice(3), "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const zufall = (n = 32) => crypto.randomBytes(n).toString("base64url");
export function _testKey(hex: string | null) { _k = hex ? Buffer.from(hex, "hex") : null; }
