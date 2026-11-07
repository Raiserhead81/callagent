import { createHmac, timingSafeEqual } from "crypto";
export interface SsoPayload { sub?: number | string; email?: string; name?: string | null; exp?: number; iat?: number }
const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** Prueft ein gemivo_sso-JWT (HS256). */
export function verifySso(jwt: string | undefined, secret: string): SsoPayload | null {
  if (!jwt || !secret) return null;
  const t = jwt.split(".");
  if (t.length !== 3) return null;
  try {
    const head = JSON.parse(Buffer.from(t[0], "base64").toString("utf8"));
    if (head.alg !== "HS256") return null;
  } catch { return null; }
  const soll = Buffer.from(b64url(createHmac("sha256", secret).update(t[0] + "." + t[1]).digest()));
  const ist = Buffer.from(t[2]);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return null;
  let p: SsoPayload;
  try { p = JSON.parse(Buffer.from(t[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; }
  if (p.exp && p.exp < Math.floor(Date.now() / 1000)) return null;
  const sub = Number(p.sub);
  if (!Number.isInteger(sub) || sub <= 0) return null;
  return { ...p, sub };
}
/** Nur fuer Tests: signiertes JWT erzeugen. */
export function signSso(p: SsoPayload, secret: string): string {
  const h = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const b = b64url(Buffer.from(JSON.stringify(p)));
  return h + "." + b + "." + b64url(createHmac("sha256", secret).update(h + "." + b).digest());
}
