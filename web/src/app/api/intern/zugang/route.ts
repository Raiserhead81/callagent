import { NextRequest } from "next/server";
import { internOk } from "@/lib/auth";
import { ok, fehler } from "@/lib/antwort";
import { zugang } from "@/lib/zugang";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!internOk(req)) return fehler("forbidden", 403);
  return ok(await zugang(Number(req.nextUrl.searchParams.get("uid"))));
}
