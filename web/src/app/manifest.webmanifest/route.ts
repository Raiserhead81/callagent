import vorlage from "../manifest-vorlage.json";
/**
 * Manifest je Plattform: Auf Android gibt es die echte App (APK) – dort soll Chrome KEINE zweite
 * Web-App (WebAPK) installieren. Chrome installiert nur bei display standalone/fullscreen/minimal-ui;
 * mit display "browser" wird "Zum Startbildschirm" nur ein Lesezeichen, keine App.
 * (prefer_related_applications geht nicht: die App ist nicht im Play Store, Chrome wuerde ins Leere verweisen.)
 * iOS/Desktop: unveraendert installierbar.
 */
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const android = /Android/i.test(req.headers.get("user-agent") || "");
  const m = android ? { ...vorlage, display: "browser" } : vorlage;
  return new Response(JSON.stringify(m), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache", Vary: "User-Agent" },
  });
}
