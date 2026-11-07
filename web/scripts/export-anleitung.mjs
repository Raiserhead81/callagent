// Offline-Kopie der Anleitung fuer die App: node scripts/export-anleitung.mjs (vor dem APK-Build)
import fs from "fs";
import { createRequire } from "module";
const src = fs.readFileSync(new URL("../src/lib/anleitung.ts", import.meta.url), "utf8");
// TS -> JS ohne Compiler: Typen/Interfaces entfernen reicht fuer diese Datei
const js = src.replace(/export interface[\s\S]*?\n}\n/g, "").replace(/: (Schritt|Skizze|Unterschritt)\[\]/g, "").replace(/: Record<string, string>/g, "")
  .replace(/export function zuHtml[\s\S]*$/, "").replace(/export const /g, "exports.");
const m = { exports: {} }; new Function("exports", js)(m.exports);
const ziel = new URL("../../android/app/src/main/assets/anleitung.json", import.meta.url);
fs.mkdirSync(new URL(".", ziel), { recursive: true });
fs.writeFileSync(ziel, JSON.stringify({ version: m.exports.ANLEITUNG_VERSION, schritte: m.exports.SCHRITTE }, null, 1));
console.log("anleitung.json:", m.exports.SCHRITTE.length, "Schritte, Version", m.exports.ANLEITUNG_VERSION);
