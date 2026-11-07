// E2E gegen die echte Instanz (auf gemivo ausfuehren): node tests/e2e/run.mjs
// Testkonten NUR sub >= 990000 (nie 8). Testdaten werden am Ende geloescht.
import { createRequire } from "module";
import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: ["/usr/lib/node_modules"] }));
const BASE = process.env.BASE || "https://anruf.gemivo.de";
const DB = "/opt/callagent/data/calls.db";
const SHOTS = process.env.SHOTS || "/opt/gemivo-anruf-shots";
const SECRET = (fs.readFileSync("/etc/gemivo/gemivo.env", "utf8").match(/^GEMIVO_SSO_SECRET=["']?([^"'\n]+)/m) || [])[1];
const CHROME = process.env.CHROME_PATH || "/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const A = 990001, B = 990002;
fs.mkdirSync(SHOTS, { recursive: true });
const b64 = b => Buffer.from(b).toString("base64url");
function jwt(sub, name) {
  const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64(JSON.stringify({ sub, email: `test${sub}@example.invalid`, name, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return h + "." + p + "." + crypto.createHmac("sha256", SECRET).update(h + "." + p).digest("base64url");
}
const sql = q => execFileSync("sqlite3", ["-cmd", ".timeout 5000", DB, q]).toString().trim();
let fehler = 0; const ok = (n, b, info = "") => { console.log((b ? "PASS " : "FAIL ") + n + (info ? " – " + info : "")); if (!b) fehler++; };
async function kontext(browser, sub, name, opts = {}) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: opts.dunkel ? "dark" : "light", locale: "de-DE" });
  await c.addCookies([{ name: "gemivo_sso", value: jwt(sub, name), domain: "anruf.gemivo.de", path: "/", secure: true, httpOnly: true }]);
  return c;
}
async function apiAls(page, pfad, method = "GET", body) {
  return page.evaluate(async ([p, m, b]) => { const r = await fetch(p, { method: m, headers: b ? { "Content-Type": "application/json" } : {}, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; }, [pfad, method, body]);
}
async function keinOverflow(page, n) {
  for (const w of [360, 390]) { await page.setViewportSize({ width: w, height: 800 }); ok(`${n} kein H-Overflow @${w}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); }
  await page.setViewportSize({ width: 390, height: 844 });
}
const aufraeumen = () => { for (const t of ["calls", "ca_geraet", "ca_kopplung", "ca_tg_link", "ca_push", "ca_feedback", "ca_funnel", "ca_mandant"]) sql(`DELETE FROM ${t} WHERE user_id BETWEEN 990000 AND 999999;`); };

const browser = await chromium.launch({ executablePath: CHROME });
try {
  aufraeumen();
  // --- oeffentlich ---
  const pub = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  const p0 = await pub.newPage();
  let r = await p0.goto(BASE + "/"); ok("Landing 200", r.status() === 200);
  ok("Landing: kostenlos (Beta)", (await p0.content()).includes("kostenlos"));
  await keinOverflow(p0, "Landing");
  await p0.screenshot({ path: SHOTS + "/landing.png" });
  r = await p0.goto(BASE + "/anleitung"); ok("Anleitung 200 ohne Login", r.status() === 200);
  const txt = await p0.textContent("main");
  for (const s of ["Anmeldung aus dem Internet erlauben", "DS-Lite", "**67*", "##67#", "Set up billing", "0,018", "Hintergrundaktivität"]) ok("Anleitung enthält " + s, txt.includes(s));
  await keinOverflow(p0, "Anleitung");
  r = await p0.goto(BASE + "/app", { waitUntil: "commit" }).catch(e => null);
  ok("Dashboard ohne Login -> gemivo-Login", p0.url().startsWith("https://gemivo.de/konto/login.php"));
  r = await p0.request.get(BASE + "/api/intern/zugang?uid=8"); ok("intern von aussen gesperrt", r.status() === 404);
  r = await p0.request.get(BASE + "/api/anrufe"); ok("API ohne Login 401", r.status() === 401);

  // --- Nutzer A ---
  const ca = await kontext(browser, A, "Testa Anrufer");
  const pa = await ca.newPage();
  await pa.goto(BASE + "/app"); await pa.waitForSelector("[data-testid=leer]");
  ok("A: leerer Zustand ehrlich", (await pa.textContent("[data-testid=leer]")).includes("Noch keine Anrufe"));
  let x = await apiAls(pa, "/api/profil", "PUT", { vorname: "Testa", aussprache: "" }); ok("A: Name speichern", x.j.ok);
  x = await apiAls(pa, "/api/profil", "PUT", { vorname: "<b>" }); ok("A: ungültiger Name abgelehnt", !x.j.ok);
  x = await apiAls(pa, "/api/sip", "POST", { modus: "fritzbox", server: "test990001.example.invalid", port: 5060, user: "gemma", pass: "testkennwort123", nummer: "0451 9999999" });
  ok("A: SIP speichern", x.j.ok, JSON.stringify(x.j).slice(0, 120));
  ok("A: Passwort verschlüsselt in DB", sql(`SELECT sip_pass_enc FROM ca_mandant WHERE user_id=${A}`).startsWith("v1:") && !sql(`SELECT sip_pass_enc FROM ca_mandant WHERE user_id=${A}`).includes("testkennwort"));
  x = await apiAls(pa, "/api/sip", "POST", { modus: "fritzbox", server: "evil.de\n[x]", user: "gemma", pass: "abcdefgh", nummer: "04519999999" });
  ok("A: Config-Injection abgelehnt", !x.j.ok);
  x = await apiAls(pa, "/api/me"); ok("A: Umleitungscode mit eigener Nummer", x.j.umleitung?.ein === "**67*04519999999#");
  ok("A: ohne Gemini-Key nicht registriert", x.j.sip.status === "nicht-konfiguriert", x.j.sip.status);
  x = await apiAls(pa, "/api/gemini", "POST", { key: "AIzaSyDUMMY_UNGUELTIG_0000000000000000" });
  ok("A: ungültiger Gemini-Key -> klare Meldung", x.j.ok && !x.j.test.ok && /ungültig|abgelehnt|Unerwartet/.test(x.j.test.fehler || ""), x.j.test?.fehler);

  // Testanruf-Daten fuer A und B direkt in der DB
  const idA = Number(sql(`INSERT INTO calls(nummer,start,ende,grund,transkript,zusammenfassung,user_id) VALUES('+4915100000001','${new Date(Date.now() - 60000).toISOString()}','${new Date().toISOString()}','sip-gemma-beendet','[{"ich":true,"text":"Hallo"},{"ich":false,"text":"Bitte Rückruf wegen Test A"}]','Testanrufer A bittet um Rückruf.',${A}); SELECT last_insert_rowid();`));
  const idB = Number(sql(`INSERT INTO calls(nummer,start,transkript,zusammenfassung,user_id) VALUES('+4915100000002','${new Date().toISOString()}','[]','Geheim B',${B}); SELECT last_insert_rowid();`));
  await pa.goto(BASE + "/app"); await pa.waitForSelector(`[data-testid=anruf-${idA}]`);
  ok("A sieht eigenen Anruf", true);
  ok("A sieht B NICHT", !(await pa.content()).includes("Geheim B"));
  x = await apiAls(pa, `/api/anrufe/${idB}`); ok("A: fremdes Transkript 404", x.s === 404);
  x = await apiAls(pa, `/api/anrufe/${idB}`, "DELETE"); ok("A: fremden Anruf löschen 404", x.s === 404);
  ok("B-Anruf existiert noch", sql(`SELECT COUNT(*) FROM calls WHERE id=${idB}`) === "1");
  await pa.click(`[data-testid=anruf-${idA}] >> text=Transkript`);
  await pa.waitForSelector("text=Bitte Rückruf wegen Test A"); ok("A: Transkript aufklappbar", true);
  await pa.click(`[data-testid=anruf-${idA}] [aria-label="Gespräch war gut"]`); await pa.waitForTimeout(800);
  ok("A: Daumen hoch gespeichert", sql(`SELECT daumen FROM ca_feedback WHERE call_id=${idA} AND user_id=${A}`) === "1");
  x = await apiAls(pa, "/api/feedback", "POST", { art: "anruf", callId: idB, daumen: 1 }); ok("A: fremden Anruf bewerten 404", x.s === 404);
  await keinOverflow(pa, "Dashboard");
  await pa.screenshot({ path: SHOTS + "/dashboard-hell.png" });
  // Feedback-Dialog
  await pa.click("text=Feedback"); await pa.fill("textarea", "E2E-Test Feedback"); await pa.click("[role=dialog] >> text=Senden");
  await pa.waitForSelector("text=Danke!"); ok("A: Feedback gesendet", sql(`SELECT COUNT(*) FROM ca_feedback WHERE user_id=${A} AND art='feedback'`) === "1");
  // Einrichtung
  await pa.goto(BASE + "/einrichtung?schritt=umleitung"); await pa.waitForSelector("[data-testid=umleitung]");
  ok("Einrichtung: Umleitungscode", (await pa.textContent("[data-testid=umleitung]")) === "**67*04519999999#");
  await keinOverflow(pa, "Einrichtung");
  await pa.goto(BASE + "/einrichtung?schritt=anschluss"); await pa.waitForSelector("[data-testid=regstatus]");
  await pa.screenshot({ path: SHOTS + "/einrichtung-hell.png" });
  await pa.waitForTimeout(500);
  ok("Funnel-Ereignisse gespeichert", Number(sql(`SELECT COUNT(*) FROM ca_funnel WHERE user_id=${A}`)) >= 2);
  // Kopplung App
  x = await apiAls(pa, "/api/koppeln", "POST"); ok("A: Kopplungscode", /^[A-Z2-9]{8}$/.test(x.j.code || ""));
  const tok = await pa.request.post(BASE + "/api/app/koppeln", { data: { code: x.j.code, name: "E2E" } }).then(r => r.json());
  ok("App: Code -> Token", !!tok.token);
  const me = await pa.request.get(BASE + "/api/me", { headers: { Authorization: "Bearer " + tok.token, Cookie: "" } }).then(r => r.json());
  ok("App: Token = Nutzer A", me.nutzer?.uid === A);
  const nochmal = await pa.request.post(BASE + "/api/app/koppeln", { data: { code: x.j.code } }); ok("Code nur einmal", nochmal.status() === 404);
  // Admin nur Owner
  x = await apiAls(pa, "/api/admin/feedback"); ok("Admin für Nicht-Owner 403", x.s === 403);
  // Loeschen eigener Anruf
  x = await apiAls(pa, `/api/anrufe/${idA}`, "DELETE"); ok("A: eigenen Anruf löschen", x.j.ok && sql(`SELECT COUNT(*) FROM calls WHERE id=${idA}`) === "0");

  // Dunkel-Screenshot (Store) mit Beispiel-Anruf fuer B
  const cb = await kontext(browser, B, "Testb", { dunkel: true });
  const pb = await cb.newPage();
  await pb.goto(BASE + "/app"); await pb.waitForSelector(`[data-testid=anruf-${idB}]`);
  ok("B sieht eigenen Anruf", true);
  await pb.screenshot({ path: SHOTS + "/dashboard-dunkel.png" });
  // Datenloeschung B
  x = await apiAls(pb, "/api/konto", "DELETE", { bestaetigung: "LÖSCHEN" }); ok("B: Meine Daten löschen", x.j.ok && sql(`SELECT COUNT(*) FROM calls WHERE user_id=${B}`) === "0" && sql(`SELECT COUNT(*) FROM ca_mandant WHERE user_id=${B}`) === "0");
  ok("Kays Anrufe unberührt", Number(sql(`SELECT COUNT(*) FROM calls WHERE user_id=8`)) >= 48);
  ok("Kays Mandant unberührt", sql(`SELECT vorname||'/'||sip_modus||'/'||owner FROM ca_mandant WHERE user_id=8`) === "Kay/legacy/1");
} catch (e) { console.log("FAIL Ausnahme: " + e.stack); fehler++; }
finally {
  await browser.close();
  aufraeumen();
  try { execFileSync("curl", ["-s", "-X", "POST", "-H", "X-App-Token: " + fs.readFileSync("/opt/callagent/.app-token", "utf8").trim(), "http://127.0.0.1:3114/api/intern/pjsip-sync"]); } catch {}
  console.log("Testdaten gelöscht: " + sql("SELECT COUNT(*) FROM ca_mandant WHERE user_id BETWEEN 990000 AND 999999") + " Rest");
  console.log(fehler ? `ERGEBNIS: ${fehler} FEHLER` : "ERGEBNIS: ALLE PASS");
  process.exit(fehler ? 1 : 0);
}
