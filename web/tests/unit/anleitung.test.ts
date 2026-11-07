import { describe, it, expect } from "vitest";
import { SCHRITTE, zuHtml } from "@/lib/anleitung";
describe("Anleitung (eine Quelle fuer App + Web)", () => {
  it("8 Schritte in fester Reihenfolge", () => expect(SCHRITTE.map(s => s.id)).toEqual(["konto", "gemini", "anschluss", "name", "benachrichtigung", "rechte", "umleitung", "test"]));
  it("Auszeichnung: code schuetzt Sternchen, fett/kursiv, HTML escaped", () => {
    expect(zuHtml("wähle `**67*<nr>#` jetzt")).toBe('wähle <span class="mono">**67*&lt;nr&gt;#</span> jetzt');
    expect(zuHtml("**fett** und *kursiv*")).toBe("<b>fett</b> und <i>kursiv</i>");
    expect(zuHtml("<script>")).toBe("&lt;script&gt;");
  });
  it("Kernbegriffe belegt drin", () => {
    const alles = JSON.stringify(SCHRITTE);
    for (const w of ["Anmeldung aus dem Internet erlauben", "DS-Lite", "Set up billing", "Online-Monitor", "Anrufer-ID- und Spam-App"]) expect(alles).toContain(w);
  });
});
