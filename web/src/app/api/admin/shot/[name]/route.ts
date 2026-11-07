import { NextRequest } from "next/server";
import fs from "fs";
import { nutzer, nichtAngemeldet } from "@/lib/auth";
import { fehler } from "@/lib/antwort";
const DIR = process.env.ANRUF_SHOT_DIR || "/opt/callagent/data/feedback-shots";
/** Feedback-Screenshot ansehen (nur Kay/Owner). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const u = await nutzer(req);
  if (!u) return nichtAngemeldet();
  if (!u.owner) return fehler("nur Admin", 403);
  const n = (await ctx.params).name;
  if (!/^\d+-\d+-[A-Za-z0-9_\-]+\.(jpg|png)$/.test(n)) return fehler("Name", 400);
  try { return new Response(fs.readFileSync(DIR + "/" + n), { headers: { "Content-Type": n.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, no-store" } }); }
  catch { return fehler("nicht gefunden", 404); }
}
