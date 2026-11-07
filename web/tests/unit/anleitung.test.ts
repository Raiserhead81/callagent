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
import { HINWEISE } from "@/lib/anleitung";
describe("Gut zu wissen", () => {
  it("alle Kay-Punkte drin, jeder Hinweis haengt an echten Schritten", () => {
    const ids = HINWEISE.map(h => h.id);
    for (const i of ["besetzt", "unbekannt", "akku", "kosten", "grenzen", "verhoeren", "erreichbar", "datenschutz", "sicherheit", "aus"]) expect(ids).toContain(i);
    const schritte = new Set(SCHRITTE.map(s => s.id));
    for (const h of HINWEISE) for (const s of h.schritte) expect(schritte.has(s)).toBe(true);
  });
  it("keine unbelegten Behauptungen (Firewall-Sperren/fail2ban sind NICHT gebaut)", () => {
    const t = JSON.stringify(HINWEISE);
    expect(t).not.toMatch(/automatisch gesperrt|nur eingetragene Boxen/);
  });
});
