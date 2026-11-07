import { NextResponse } from "next/server";
export const ok = (d: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...d }, { headers: { "Cache-Control": "no-store" } });
export const fehler = (msg: string | string[], status = 400) => NextResponse.json({ ok: false, fehler: msg }, { status });
export async function body(req: Request): Promise<any> { try { return await req.json(); } catch { return {}; } }
