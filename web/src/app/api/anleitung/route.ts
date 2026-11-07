import { SCHRITTE, HINWEISE, ANLEITUNG_VERSION } from "@/lib/anleitung";
/** Oeffentlich: Anleitungstexte fuer die Android-App (dieselbe Quelle wie /anleitung). */
export const dynamic = "force-static";
export function GET() {
  return Response.json({ version: ANLEITUNG_VERSION, schritte: SCHRITTE, hinweise: HINWEISE }, { headers: { "Cache-Control": "public, max-age=300" } });
}
