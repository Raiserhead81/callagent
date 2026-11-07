// Reine Funktionen (vitest): Eingabepruefung, Umleitungscodes, Telefonnummern
export const RE_HOST = /^[A-Za-z0-9.\-]+$|^\[?[0-9a-fA-F:]+\]?$/;
export const RE_USER = /^[A-Za-z0-9._\-+@]{1,64}$/;

export interface SipEingabe { modus: string; server?: string; port?: number | string; user?: string; authUser?: string; pass?: string; domain?: string; nummer?: string; ipv?: string }
export function pruefeSip(d: SipEingabe, passPflicht: boolean): string[] {
  const f: string[] = [];
  if (!["fritzbox", "anbieter", "aus"].includes(d.modus)) f.push("Modus ungültig");
  if (d.modus === "aus") return f;
  if (!d.server || d.server.length > 253 || !RE_HOST.test(d.server)) f.push("Registrar/Server ungültig (z. B. abcd1234.myfritz.net oder sipgate.de)");
  if (!d.user || !RE_USER.test(d.user)) f.push("Benutzername ungültig (Buchstaben, Ziffern, . _ - + @)");
  if (d.authUser && !RE_USER.test(d.authUser)) f.push("Auth-Benutzer ungültig");
  if (d.domain && !RE_HOST.test(d.domain)) f.push("Domain ungültig");
  const p = Number(d.port || 5060);
  if (!Number.isInteger(p) || p < 1 || p > 65535) f.push("Port ungültig");
  if (passPflicht && (!d.pass || d.pass.length < 4)) f.push("Kennwort fehlt");
  if (d.pass && /[\r\n]/.test(d.pass)) f.push("Kennwort enthält Zeilenumbruch");
  if (d.pass && d.pass.length > 128) f.push("Kennwort zu lang");
  if (!d.nummer || !nationaleNummer(d.nummer)) f.push("Rufnummer für die Umleitung fehlt/ungültig (z. B. 0451 1234567)");
  if (d.ipv && !["auto", "v4", "v6"].includes(d.ipv)) f.push("IP-Version ungültig");
  return f;
}

/** Deutsche Rufnummer -> nationales Format nur Ziffern (0451...). +49/0049 werden umgesetzt. */
export function nationaleNummer(eingabe: string): string {
  let s = String(eingabe || "").replace(/[\s\-/()]/g, "");
  if (s.startsWith("+49")) s = "0" + s.slice(3);
  else if (s.startsWith("0049")) s = "0" + s.slice(4);
  if (!/^0[1-9]\d{5,13}$/.test(s)) return "";
  return s;
}
/** GSM-Code Umleitung bei besetzt. "+" faellt bei tel:-URIs oft weg -> nationales Format. */
export function umleitungEin(nummer: string): string { const n = nationaleNummer(nummer); return n ? `**67*${n}#` : ""; }
export const UMLEITUNG_AUS = "##67#";
export const UMLEITUNG_STATUS = "*#67#";
/** tel:-URI fuer einen MMI-Code ('#' muss als %23 kodiert werden). */
export const telUri = (code: string) => "tel:" + code.replace(/#/g, "%23");

export function pruefeName(v: string): string | null {
  const t = String(v || "").trim();
  if (t.length < 2 || t.length > 40) return "Name: 2 bis 40 Zeichen";
  if (!/^[\p{L}][\p{L} .'\-]*$/u.test(t)) return "Name: nur Buchstaben, Leerzeichen, Punkt, Bindestrich";
  return null;
}
export function geminiKeyForm(k: string): boolean { return /^[A-Za-z0-9_.\-]{30,200}$/.test(String(k || "").trim()); } // AIza… oder neueres Format mit Punkt (AQ.…)
export function maskiere(s: string | null | undefined): string { if (!s) return ""; return s.length <= 8 ? "••••" : s.slice(0, 4) + "••••" + s.slice(-4); }

/** Monatszaehler-Anzeige (owner = unbegrenzt) */
export function limitText(anzahl: number, limit: number, owner: boolean): string {
  if (owner || limit <= 0) return `${anzahl} Anrufe diesen Monat (unbegrenzt)`;
  return `${anzahl} von ${limit} Anrufen diesen Monat (Missbrauchsschutz)`;
}

export const SCHRITTE = ["konto", "gemini", "anschluss", "name", "benachrichtigung", "rechte", "umleitung", "test"] as const;
export type Schritt = typeof SCHRITTE[number];
