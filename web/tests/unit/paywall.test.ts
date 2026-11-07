import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: { mandant: { findUnique: vi.fn(async () => ({ erstellt: "2020-01-01T00:00:00Z" })) } } }));
import { zugang } from "@/lib/zugang";
describe("Bezahlschranke", () => {
  it("Standard AUS: jeder Nutzer frei (Beta kostenlos)", async () => {
    delete process.env.ANRUF_PAYWALL;
    expect(await zugang(990001)).toEqual({ aktiv: true, grund: "beta-kostenlos" });
  });
  it("AN: Owner frei", async () => {
    process.env.ANRUF_PAYWALL = "true";
    expect((await zugang(8)).aktiv).toBe(true);
    delete process.env.ANRUF_PAYWALL;
  });
});
