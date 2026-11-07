// OFFEN 07.11.: Store-Eintrag noch nicht eingespielt (Lock gemivo-store war von fable-seo belegt).
// Ausfuehren auf gemivo: agent-lock acquire gemivo-store; cp apps-data*.js Backup; node deploy/store-einfuegen.js;
// Icon/Shot liegen fertig in /opt/gemivo-anruf-store/ (anruf.png -> store/assets/icons/, anruf.jpg -> store/screenshots/); Cache-Buster ?v bumpen.
// Fuegt den Anruf-Eintrag VOR dem abo-Objekt ein (beide Store-Dateien), prueft Syntax + Anzahl.
const fs = require("fs");
const basis = {
  slug: "anruf",
  sso: "https://anruf.gemivo.de/",
  shot: "/store/screenshots/anruf.jpg?v=20261107",
  name: "Gemma Anrufassistent",
  tagline: "Gemma geht ran, wenn Unbekannte anrufen",
  tagline_en: "Gemma answers when unknown numbers call",
  description: "Kontakte klingeln wie immer. Ruft eine unbekannte Nummer an, nimmt Gemma, deine digitale Assistentin, über deine FritzBox- oder SIP-Nummer ab, fragt nach dem Anliegen und schickt dir eine kurze Zusammenfassung. Du brauchst ein Android-Handy, eine FritzBox mit Festnetznummer oder einen SIP-Anbieter und einen eigenen Gemini-API-Schlüssel von Google. Beta, kostenlos; die Gemini-Nutzung zahlst du direkt bei Google.",
  description_en: "Your contacts ring as usual. When an unknown number calls, Gemma, your digital assistant, answers via your FRITZ!Box or SIP number, asks what it is about and sends you a short summary. Requires an Android phone, a FRITZ!Box landline number or a SIP provider and your own Google Gemini API key. Free beta; Gemini usage is billed by Google.",
  features: ["Nur unbekannte Nummern, Kontakte klingeln normal", "Anrufer hören sofort, dass eine KI spricht", "Zusammenfassung, Transkript und Rückruf-Knopf", "Einrichtung Schritt für Schritt in der Android-App"],
  features_en: ["Only unknown numbers, contacts ring normally", "Callers hear right away that an AI is speaking", "Summary, transcript and call-back button", "Step-by-step setup in the Android app"],
  category: "KI & Produktivität",
  icon: "📞",
  color: "#0f766e",
  status: "beta",
  access: "account",
  url: "https://anruf.gemivo.de",
  pwa: true,
  apk: "https://anruf.gemivo.de/download/gemivo-anruf.apk",
};
const v2extra = { value: "Kein Klingeln mehr bei unbekannten Nummern: Gemma nimmt das Anliegen auf und du entscheidest, ob du zurückrufst.", value_en: "No more ringing for unknown numbers: Gemma takes the message and you decide whether to call back." };
for (const [datei, obj] of [["apps-data.js", basis], ["apps-data-v2.js", { ...basis, ...v2extra }]]) {
  const p = "/var/www/html/store/assets/" + datei;
  let s = fs.readFileSync(p, "utf8");
  if (s.includes('"slug": "anruf"')) { console.log(datei, "schon drin"); continue; }
  const i = s.indexOf('"slug": "abo"');
  const start = s.lastIndexOf("{", i);
  const einr = s.slice(s.lastIndexOf("\n", start) + 1, start); // Einrueckung
  const txt = JSON.stringify(obj, null, 2).split("\n").map((z, k) => (k ? einr : "") + z).join("\n");
  s = s.slice(0, start) + txt + ",\n" + einr + s.slice(start);
  fs.writeFileSync(p, s);
  global.window = {}; delete global.GEMIVO_APPS;
  const vm = require("vm"); const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(s, ctx);
  const arr = ctx.GEMIVO_APPS || ctx.window.GEMIVO_APPS || ctx.GEMIVO_APPS_V2 || ctx.window.GEMIVO_APPS_V2 || Object.values(ctx.window).find(Array.isArray) || Object.values(ctx).find(Array.isArray);
  console.log(datei, "OK, Apps:", arr ? arr.length : "?", "anruf:", arr ? arr.some(a => a.slug === "anruf") : "?");
}
