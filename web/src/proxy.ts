import { NextRequest, NextResponse } from "next/server";
// Geschuetzte Seiten: ohne gemivo_sso-Cookie -> gemivo-Login (Signatur prueft jede API selbst)
const GESCHUETZT = ["/app", "/einrichtung", "/admin", "/koppeln"];
export function proxy(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (!GESCHUETZT.some(g => p === g || p.startsWith(g + "/"))) return NextResponse.next();
  if (req.cookies.get("gemivo_sso")?.value) return NextResponse.next();
  const host = req.headers.get("host") || "anruf.gemivo.de";
  const login = new URL("https://gemivo.de/konto/login.php");
  login.searchParams.set("next", `https://${host}${p}${req.nextUrl.search}`);
  return NextResponse.redirect(login);
}
export const config = { matcher: ["/app/:path*", "/einrichtung/:path*", "/admin/:path*", "/koppeln/:path*", "/app", "/einrichtung", "/admin", "/koppeln"] };
