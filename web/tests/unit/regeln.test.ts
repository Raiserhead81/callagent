import { describe, it, expect } from "vitest";
import { pruefeSip, nationaleNummer, umleitungEin, telUri, pruefeName, geminiKeyForm, limitText } from "@/lib/regeln";
import { verifySso, signSso } from "@/lib/sso";
import { verschluesseln, entschluesseln, _testKey } from "@/lib/krypto";
import { testTageRest } from "@/lib/zugang";
import { fehlerText, liveCloseText } from "@/lib/gemini";

describe("Umleitung", () => {
  it("nationales Format, + und 0049 umgesetzt", () => {
    expect(nationaleNummer("+49 451 30433056")).toBe("045130433056");
    expect(nationaleNummer("0049 451/1234567")).toBe("04511234567");
    expect(nationaleNummer("0451 12")).toBe("");
    expect(nationaleNummer("12345")).toBe("");
  });
  it("Code **67*<nr># und tel-URI mit %23", () => {
    expect(umleitungEin("+49 451 30433056")).toBe("**67*045130433056#");
    expect(telUri("**67*0451#")).toBe("tel:**67*0451%23");
    expect(umleitungEin("quatsch")).toBe("");
  });
});
describe("SIP-Eingaben", () => {
  const gut = { modus: "fritzbox", server: "abcd.myfritz.net", port: 5060, user: "gemma", pass: "langeskennwort", nummer: "0451 1234567" };
  it("gültig", () => expect(pruefeSip(gut, true)).toEqual([]));
  it("Injection/ungültig abgelehnt", () => {
    expect(pruefeSip({ ...gut, server: "x.de\n[evil]" }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, user: "a b" }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, pass: "a\nb" }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, port: 70000 }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, nummer: "" }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, pass: "" }, true).length).toBeGreaterThan(0);
    expect(pruefeSip({ ...gut, pass: "" }, false)).toEqual([]);
  });
  it("IPv6-Literal erlaubt", () => expect(pruefeSip({ ...gut, server: "[2a02:8108::1]" }, true)).toEqual([]));
});
describe("Name/Key", () => {
  it("Name", () => { expect(pruefeName("Jörg")).toBeNull(); expect(pruefeName("A")).not.toBeNull(); expect(pruefeName("<script>")).not.toBeNull(); });
  it("Key-Form", () => { expect(geminiKeyForm("AIza" + "x".repeat(35))).toBe(true); expect(geminiKeyForm("abc")).toBe(false); expect(geminiKeyForm("AQ.Ab8" + "x".repeat(40) + "-y_z")).toBe(true); expect(geminiKeyForm("AIza x" + "y".repeat(30))).toBe(false); });
  it("Limit-Text", () => { expect(limitText(3, 300, false)).toMatch(/3 von 300/); expect(limitText(5, 0, true)).toMatch(/unbegrenzt/); });
});
describe("SSO", () => {
  const S = "testgeheim";
  it("gültig, abgelaufen, falsche Signatur, sub fehlt", () => {
    const t = signSso({ sub: 990001, email: "t@x.de", exp: Math.floor(Date.now() / 1000) + 60 }, S);
    expect(verifySso(t, S)?.sub).toBe(990001);
    expect(verifySso(t, "anders")).toBeNull();
    expect(verifySso(signSso({ sub: 990001, exp: 1 }, S), S)).toBeNull();
    expect(verifySso(signSso({ email: "x" }, S), S)).toBeNull();
    expect(verifySso(undefined, S)).toBeNull();
  });
});
describe("Krypto (gleiches Format wie Engine)", () => {
  it("rund + Engine-kompatibel", async () => {
    _testKey("22".repeat(32));
    const e = verschluesseln("pw;mit;semikolon");
    expect(entschluesseln(e)).toBe("pw;mit;semikolon");
    // Engine (CommonJS) entschluesselt dasselbe Format
    const M = await import("../../../server/mandant.js");
    (M as any).default._setKey("22".repeat(32));
    expect((M as any).default.entschluesseln(e)).toBe("pw;mit;semikolon");
    expect(entschluesseln((M as any).default.verschluesseln("zurück"))).toBe("zurück");
  });
});
describe("Testphase (Paywall vorbereitet, aus)", () => {
  it("14 Tage ab Einrichtung", () => {
    const j = Date.parse("2026-11-20T12:00:00Z");
    expect(testTageRest("2026-11-10T12:00:00Z", 14, j)).toBe(4);
    expect(testTageRest("2026-10-01T00:00:00Z", 14, j)).toBe(0);
  });
});
describe("Gemini-Fehlertexte", () => {
  it("klare Meldungen", () => {
    expect(fehlerText(400, "API key not valid")).toMatch(/ungültig/);
    expect(fehlerText(402, "")).toMatch(/Guthaben/);
    expect(fehlerText(429, "")).toMatch(/Limit/);
    expect(liveCloseText(1011, "You exceeded your current quota")).toMatch(/Guthaben|Kontingent/);
  });
});
