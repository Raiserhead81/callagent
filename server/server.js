#!/usr/bin/env node
/*
 * CallAgent - Telefon-KI fuer Kay (Gemma-Assistentin)
 * Nimmt von der Android-App (Default-Dialer) Transkripte an,
 * antwortet mit Gemini-Text + Gemini-TTS (Kore) als WAV (24kHz PCM 16bit mono).
 * Protokolliert jedes Gespraech in SQLite.
 *
 * Endpunkte (Auth: Header X-App-Token):
 *   POST /api/start {nummer}        -> {session, begruessung_text, audio_b64} (WAV)
 *   POST /api/turn  {session,text}  -> {antwort_text, audio_b64, ende:false|true}
 *   POST /api/end   {session,grund} -> {ok:true, zusammenfassung}
 *   GET  /log                          -> HTML-Protokoll der Anrufe
 *   GET  /health                       -> {ok:true}
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');
const { execFile } = require('child_process');

const PORT = process.env.CALLAGENT_PORT || 3114;
const HOST = '127.0.0.1';
const GEMINI_TEXT_MODEL = 'gemini-3.8-flash';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const STIMME = 'Kore';
// Keys lazy + ENV-faehig: erlaubt Unit-Tests ohne Server-Dateien
function safeRead(p) { try { return fs.readFileSync(p, 'utf8').trim(); } catch (e) { return ''; } }
const APP_TOKEN = process.env.CALLAGENT_TOKEN || safeRead('/opt/callagent/.app-token');
const KEY_PAID = process.env.CALLAGENT_GEMINI_KEY || safeRead('/opt/gemma-live/gemini-key-paid');
const LLM_KEY = process.env.CALLAGENT_LLM_KEY || safeRead('/etc/gemma-live/llm-key');
const LLM_MODEL = 'gemma4';
const MINI_TIMEOUT_MS = parseInt(process.env.CALLAGENT_MINI_TIMEOUT_MS || '7000', 10);
const DB_DIR = '/opt/callagent/data';
const DB = DB_DIR + '/calls.db';

const SYSTEM_PROMPT = `Du bist Gemma, Kays persoenliche Assistentin, und nimmst gerade SEINEN Telefonanruf entgegen.
Kay ist nicht erreichbar. DU sprichst fuer ihn am Telefon.
Stil: warm, menschlich, kurz (max. 2 Saetze pro Antwort), Umgangston, kein Amtsdeutsch, keine Emojis.
Ehrlich sein: Du bist Gemma, Kays Assistentin. Wenn jemand fragt, ob du ein Mensch oder eine KI bist: ehrlich bleiben, locker ("Ich bin Kays digitale Assistentin Gemma, Kay ist gerade nicht dran - aber ich kann alles aufnehmen.").
Typische Gespraechsfuehrung:
- Begruesse, frag was das Anliegen ist.
- Nimm auf, was der Anrufer von sich aus sagt (Name, Firma, Anliegen, Dringlichkeit). Frag NICHT aktiv nach Name, Firma oder Details, wenn das Anliegen schon klar ist.
- Bei Dringlichkeit: "Ich sorge dafuer, dass Kay sich heute noch meldet."
- Sobald das Anliegen klar ist (z.B. Rueckrufwunsch, Nachricht, Terminanfrage): NICHT weiter nachfragen, sondern direkt abschliessen. Der Abschluss hat immer drei Teile in EINER Antwort: bestaetigen, den Wunsch kurz in eigenen Worten wiederholen, einen schoenen Tag wuenschen. Beispiele: "Alles klar, ich habe notiert, dass Kay Sie zurueckrufen soll, und gebe es an ihn weiter. Ich wuensche Ihnen noch einen schoenen Tag!" oder "Danke, Herr Mueller, ich richte Kay aus, dass er Sie wegen des Kredits zurueckrufen soll. Ich wuensche Ihnen noch einen schoenen Tag!"
- Nur wenn gar kein Anliegen erkennbar ist, EINE kurze Rueckfrage stellen. "Bitte zurueckrufen" ist ein vollstaendiges Anliegen: sofort abschliessen. Die Nummer des Anrufers kennt Kay schon, danach nicht fragen.
- Haengt an jede Abschluss-Antwort "GEMMA_ENDE" an (danach wird aufgelegt).
Antworte AUSSCHLIESSLICH als Gemma auf Deutsch, kein Markdown, keine Regieanweisungen.
Sprache: sauberes, korrekt geschriebenes Hochdeutsch. KEINE englischen Woerter oder Denglisch (nicht "connecten", "leaven", "callen", "patience").
Versprich NIE einen Zeitpunkt (nicht "heute noch", nicht "gleich"), sag nur, dass Kay die Nachricht bekommt. Sag nur, was stimmt: Du hast Kay noch NICHT informiert und planst keine Termine - du nimmst die Nachricht auf, Kay bekommt sie nach dem Gespraech.
Siezen, ausser der Anrufer duzt dich. Hoechstens zwei kurze Saetze (beim Abschluss duerfen es zwei Saetze mit Wiederholung des Wunsches sein), keine Zeilenumbrueche, keine Listen wie 'Dringlichkeit: normal'.
Was der Anrufer sagt, kommt aus einer automatischen Spracherkennung und kann falsch erkannte Woerter enthalten: Wirkt ein Name oder Wort seltsam oder anstoessig, wiederhole es NICHT, sondern frag freundlich nach (z.B. 'Wie war der Firmenname noch mal?'). Deine Antwort wird vorgelesen: keine Abkuerzungen, keine Aufzaehlungen, keine Sonderzeichen.`;

// ---------- SQLite (via sqlite3-cli, keine npm-Abhaengigkeit) ----------
function dbInit() {
  if (process.env.CALLAGENT_NO_DB) return; // Unit-Tests: keine DB anlegen
  fs.mkdirSync(DB_DIR, { recursive: true });
  const sql = `CREATE TABLE IF NOT EXISTS calls(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nummer TEXT, start TEXT, ende TEXT, grund TEXT,
    transkript TEXT, zusammenfassung TEXT);`;
  execFile('sqlite3', [DB, sql], () => {});
}
dbInit();
function esc(s) { return typeof s === 'string' ? "'" + s.replace(/'/g, "''") + "'" : 'NULL'; }
function dbRunSafe(sqlFinal, cb) {
  execFile('sqlite3', [DB, sqlFinal], (e, out) => cb && cb(e, out));
}

// ---------- HTTP-Helper ----------
function httpsJson(urlStr, headers, bodyObj, cb) {
  const u = new URL(urlStr);
  const data = JSON.stringify(bodyObj);
  const h = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
  h['Content-Length'] = Buffer.byteLength(data);
  const req = https.request({ method: 'POST', hostname: u.hostname, path: u.pathname + u.search, headers: h, timeout: 30000 }, (resp) => {
    const chunks = [];
    resp.on('data', d => chunks.push(d));
    resp.on('end', () => {
      let j = null; const raw = Buffer.concat(chunks).toString();
      try { j = JSON.parse(raw); } catch (e) {}
      cb(null, resp.statusCode, j, raw);
    });
  });
  req.on('error', e => cb(e));
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.write(data); req.end();
}

// ---------- Mini-Kette (Mac-Mini GPU, MLX Gemma-4-26b) ----------
function miniChat(historie, cb) {
  let fertig = false;
  const msgs = [{ role: 'system', content: SYSTEM_PROMPT }]
    .concat(historie.map(m => ({ role: m.ich ? 'assistant' : 'user', content: m.text })));
  const data = JSON.stringify({ model: LLM_MODEL, messages: msgs, max_tokens: 150, temperature: 0.3 });
  // Telefon: nach MINI_TIMEOUT_MS muss Gemini uebernehmen (GPU oft durch andere Jobs belegt, TTFT 2-40s)
  const req = http.request({ method: 'POST', hostname: '127.0.0.1', port: 11440, path: '/v1/chat/completions', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LLM_KEY, 'Content-Length': Buffer.byteLength(data) }, timeout: MINI_TIMEOUT_MS }, resp => {
    const chunks = [];
    resp.on('data', d => chunks.push(d));
    resp.on('end', () => {
      if (fertig) return; fertig = true;
      console.log('[miniChat] antwort', resp.statusCode);
      try {
        const j = JSON.parse(Buffer.concat(chunks).toString());
        const t = (j.choices[0].message.content || '').trim();
        if (t && denglisch(t)) return cb(new Error('mini denglisch: ' + denglisch(t)));
        if (t && (t.length > 320 || /\n/.test(t.trim()))) return cb(new Error('mini zu lang (' + t.length + ')'));
        if (t) return cb(null, t);
        cb(new Error('mini leer'));
      } catch (e) { cb(e); }
    });
  });
  req.on('error', e => { if (fertig) return; fertig = true; cb(new Error('mini: ' + e.message)); });
  req.on('timeout', () => { req.destroy(new Error('mini-timeout-' + MINI_TIMEOUT_MS + 'ms')) });
  req.write(data); req.end();
}

// Englische Woerter/Denglisch in Antworten erkennen (Mini-Gemma rutscht oft ins Englische)
const ENGLISCH = /\b(the|and|you|your|please|patience|sorry|okay then|connect\w*|leave\w*|call(en|ing|ed)?|meeting|feedback|appointment|message|thanks|thank|request\w*|urgent|callback|note[ds]?|anything|else|personally|personal|soon|today|asap|sure|of course|great|perfect|nice day|have a)\b/i;
// Endlosschleifen erkennen: derselbe Satz (>30 Zeichen) kommt mehrfach vor
function wiederholt(t) { const z = (t || '').split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 30); return new Set(z).size < z.length; }
// Fremdschrift (z.B. chinesische Zeichen aus dem Mini-Modell) gilt wie Denglisch -> Gemini-Fallback
const FREMDSCHRIFT = /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20AC\s]/;
function denglisch(t) {
  const m = (t || '').match(ENGLISCH); if (m) return m[0];
  const f = (t || '').match(FREMDSCHRIFT); return f ? f[0] : '';
}

// LLM: erst Mini-GPU, Fallback Gemini-Text (idempotent)
function antwortText(historie, cb) {
  let fertig = false;
  miniChat(historie, (e, t) => {
    if (fertig) return; if (!e && t) { fertig = true; return cb(null, t, 'mini'); }
    console.log('[llm] Mini-Kette nicht da (' + (e ? e.message : '?') + ') -> Gemini-Fallback');
    geminiText(historie, (e2, t2) => { if (fertig) return; fertig = true; cb(e2, t2, 'gemini'); });
  });
}

// ---------- Gemini-Text (Fallback) ----------
function geminiText(historie, cb, system) {
  const body = {
    system_instruction: { parts: [{ text: system || SYSTEM_PROMPT }] },
    contents: historie.map(m => ({ role: m.ich ? 'model' : 'user', parts: [{ text: m.text }] })),
    generationConfig: { maxOutputTokens: 300, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
  httpsJson(url, { 'x-goog-api-key': KEY_PAID }, body, (e, status, j) => {
    if (e || !j || !j.candidates) return cb(new Error('text: ' + (e ? e.message : 'status ' + status)));
    const t = (j.candidates[0].content.parts || []).map(p => p.text || '').join(' ').trim();
    cb(null, t);
  });
}

// ---------- Gemini-TTS (Kore) -> WAV base64 ----------
// Aussprache: "Kay" wird sonst englisch "Key" gesprochen -> fuer die Stimme "Kai" (deutsch "Kaai")
function ausspracheText(text) {
  return String(text).replace(/\bKay(s?)\b/g, 'Kai$1');
}

function geminiTTS(text, cb) {
  text = ausspracheText(text);
  const body = {
    contents: [{ parts: [{ text: text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: STIMME } } }
    }
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
  httpsJson(url, { 'x-goog-api-key': KEY_PAID }, body, (e, status, j) => {
    if (e || !j || !j.candidates) return cb(new Error('tts: ' + (e ? e.message : 'status ' + status)));
    try {
      const part = j.candidates[0].content.parts.find(p => p.inlineData);
      const b64 = part.inlineData.data;
      const pcm = Buffer.from(b64, 'base64');
      const wav = wavHeader(pcm.length, 24000, 1, 16); pcm - 0; // Header + PCM unten
      const out = Buffer.concat([Buffer.from(wav), pcm]);
      cb(null, out.toString('base64'));
    } catch (err) { cb(err); }
  });
}
function wavHeader(datenLen, rate, kanal, bits) {
  const b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + datenLen, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(kanal, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * kanal * bits / 8, 28); b.writeUInt16LE(kanal * bits / 8, 32);
  b.writeUInt16LE(bits, 34); b.write('data', 36); b.writeUInt32LE(datenLen, 40);
  return b;
}


// Freie LLM-Frage ohne Telefon-Persona (erst Mini, dann Gemini)
function llmFrage(frage, cb) {
  llmFrageMini(frage, (e, t) => {
    if (!e && t && wiederholt(t)) e = new Error('mini wiederholt sich');
    if (!e && t && denglisch(t)) e = new Error('mini denglisch');
    if (!e && t) return cb(null, t);
    console.log('[llmfrage] Mini weg (' + (e ? e.message : '?') + ') -> Gemini');
    geminiText([{ ich: false, text: frage }], cb, 'Du fasst Telefonate sachlich auf Deutsch zusammen.');
  });
}
function llmFrageMini(frage, cb) {
  let fertig = false;
  const msgs = [{ role: 'user', content: frage }];
  const data = JSON.stringify({ model: LLM_MODEL, messages: msgs, max_tokens: 200, temperature: 0.3 });
  const req = http.request({ method: 'POST', hostname: '127.0.0.1', port: 11440, path: '/v1/chat/completions', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LLM_KEY, 'Content-Length': Buffer.byteLength(data) }, timeout: 30000 }, resp => {
    const chunks = [];
    resp.on('data', d => chunks.push(d));
    resp.on('end', () => {
      if (fertig) return; fertig = true;
      console.log('[llmfrage] antwort', resp.statusCode);
      try { const j = JSON.parse(Buffer.concat(chunks).toString()); const t = (j.choices[0].message.content || '').trim(); if (t) return cb(null, t); cb(new Error('leer')); } catch (e) { cb(e); }
    });
  });
  req.on('error', e => { if (fertig) return; fertig = true; console.log('[llmfrage] error:', e.message); cb(new Error('mini: ' + e.message)); });
  req.on('timeout', () => { req.destroy(new Error('llmfrage-timeout')) });
  req.write(data); req.end();
}

// ---------- Sessions ----------
const SESSIONS = new Map(); // id -> {nummer, start, historie:[], dbId, letzteAktiv}
let sid = 0;
// Netz gegen doppelte Callbacks/Exceptions: Prozess darf nicht sterben (Anrufe!)
process.on('uncaughtException', e => console.log('[uncaught]', e.message));

// ---------- Telegram an Kay nach jedem echten Anruf (Hermes-Bot) ----------
const TG_ENV = process.env.CALLAGENT_TG_ENV || '/opt/callagent/telegram.env';
const TG_CHAT = process.env.CALLAGENT_TG_CHAT || '805026354';
function anrufMeldung(nummer, sum, dbId) {
  const nr = String(nummer || '').trim() || 'unterdrückt';
  return '📞 Gemma hat einen Anruf angenommen\n' +
    'Von: ' + nr + '\n\n' + sum + '\n\n' +
    (/^\+?\d{4,}$/.test(nr) ? 'Zurückrufen: tel:' + nr + '\n' : '') +
    'Protokoll #' + dbId + ': https://callagent.gemivo.de/log';
}
function telegramMelden(text) {
  const m = safeRead(TG_ENV).match(/^TELEGRAM_BOT_TOKEN=["']?([^"'\n]+)/m);
  if (!m) { console.log('[telegram] kein Token in ' + TG_ENV); return; }
  const data = JSON.stringify({ chat_id: TG_CHAT, text: text, disable_web_page_preview: true });
  const rq = https.request({ hostname: 'api.telegram.org', path: '/bot' + m[1] + '/sendMessage', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, timeout: 15000 },
    r => { console.log('[telegram] status ' + r.statusCode); r.resume(); });
  rq.on('error', e => console.log('[telegram] fehler ' + e.message));
  rq.on('timeout', () => rq.destroy(new Error('timeout')));
  rq.end(data);
}

function begruessungsText(nummer) {
  return 'Schönen guten Tag, hier spricht Gemma, die Assistentin von Kay. ' +
    'Kay ist gerade leider nicht erreichbar - kann ich etwas für Sie aufnehmen?';
}

function protokollNeu(nummer, cb) {
  const sql = `INSERT INTO calls(nummer,start,transkript) VALUES(${esc(nummer)},${esc(new Date().toISOString())},'[]'); SELECT last_insert_rowid();`;
  dbRunSafe(sql, (e, out) => cb((out || '').trim()));
}
function protokollAppend(dbId, ich, text, cb) {
  const lese = `SELECT transkript FROM calls WHERE id=${dbId};`;
  dbRunSafe(lese, (e, out) => {
    let arr = []; try { arr = JSON.parse(out || '[]'); } catch (x) {}
    arr.push({ ich, text, t: new Date().toISOString() });
    dbRunSafe(`UPDATE calls SET transkript=${esc(JSON.stringify(arr))} WHERE id=${dbId};`, () => cb && cb());
  });
}
function protokollEnde(dbId, grund, cb) {
  dbRunSafe(`UPDATE calls SET ende=${esc(new Date().toISOString())}, grund=${esc(grund || '')} WHERE id=${dbId};`, () => cb && cb());
}
function zusammenfassung(dbId, cb) {
  const lese = `SELECT transkript FROM calls WHERE id=${dbId};`;
  dbRunSafe(lese, (e, out) => {
    let arr = []; try { arr = JSON.parse(out || '[]'); } catch (x) {}
    const dial = arr.map(m => (m.ich ? 'Gemma: ' : 'Anrufer: ') + m.text).join('\n').slice(0, 4000);
    if (!dial) return cb(null, 'kein Inhalt');
    // Anrufer hat nichts gesagt -> nichts erfinden lassen (Mini halluzinierte sonst ganze Geschichten)
    if (!arr.some(m => !m.ich)) return cb(null, 'Anrufer hat nichts gesagt (nur Begrüßung von Gemma).');
    llmFrage('Fasse dieses Telefonat knapp in 2-3 Saetzen auf Deutsch zusammen. Nenne Name/Firma/Anliegen und ob ein Rueckruf noetig ist, soweit genannt. Erfinde NICHTS, was nicht im Gespraech steht. Die Anrufer-Zeilen stammen aus automatischer Spracherkennung: offensichtlich falsch erkannte oder anstoessige Woerter nicht uebernehmen, sondern als (unklar) kennzeichnen:\n' + dial, (e, t) => { if (e) console.log('[zusammenfassung] LLM-Fehler:', e.message); if (t && typeof t === 'string' && t.trim()) return cb(null, t.trim()); cb(null, 'keine Zusammenfassung'); });
  });
}

// ---------- HTTP-Router ----------
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function leseBody(req, cb) {
  let b = '';
  req.on('data', d => { b += d; if (b.length > 2e6) req.destroy(); });
  req.on('end', () => { let j = {}; try { j = JSON.parse(b || '{}'); } catch (e) {} cb(j); });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  // /health ohne Token
  if (u.pathname === '/health') return json(res, 200, { ok: true, stimme: STIMME });
  if (req.headers['x-app-token'] !== APP_TOKEN && u.searchParams.get('token') !== APP_TOKEN) return json(res, 401, { ok: false, fehler: 'token' });

  if (u.pathname === '/api/start' && req.method === 'POST') {
    leseBody(req, body => {
      const id = 'c' + Date.now() + '-' + (++sid);
      const s = { nummer: body.nummer || 'unbekannt', start: new Date(), historie: [], letzteAktiv: Date.now() };
      SESSIONS.set(id, s);
      protokollNeu(s.nummer, dbId => { s.dbId = dbId; });
      const begr = begruessungsText(s.nummer);
      geminiTTS(begr, (e, b64) => {
        if (e) { console.log('[tts] Start fehlgeschlagen', e.message); return json(res, 500, { ok: false, fehler: 'tts ' + e.message }); }
        s.historie.push({ ich: true, text: begr });
        const merke = () => s.dbId ? protokollAppend(s.dbId, true, begr) : setTimeout(merke, 200);
        merke();
        json(res, 200, { ok: true, session: id, begruessung_text: begr, audio_b64: b64 });
      });
    });
  } else if (u.pathname === '/api/turn' && req.method === 'POST') {
    leseBody(req, body => {
      const s = SESSIONS.get(body.session);
      if (!s) return json(res, 404, { ok: false, fehler: 'session' });
      s.letzteAktiv = Date.now();
      if (!body.text || !body.text.trim()) return json(res, 400, { ok: false, fehler: 'text' });
      s.historie.push({ ich: false, text: body.text.trim() });
      protokollAppend(s.dbId, false, body.text.trim());
      let geantwortet = false;
      antwortText(s.historie, (e, t, motor) => {
        if (geantwortet) return; geantwortet = true;
        if (e || !t) return json(res, 500, { ok: false, fehler: 'llm ' + (e ? e.message : '?') });
        const ende = /GEMMA_ENDE/.test(t);
        t = t.replace(/GEMMA_ENDE/g, '').trim();
        geminiTTS(t, (e2, b64) => {
          if (e2) return json(res, 500, { ok: false, fehler: 'tts ' + e2.message });
          s.historie.push({ ich: true, text: t });
          protokollAppend(s.dbId, true, t);
          json(res, 200, { ok: true, antwort_text: t, audio_b64: b64, ende, motor });
        });
      });
    });
  } else if (u.pathname === '/api/end' && req.method === 'POST') {
    leseBody(req, body => {
      const s = SESSIONS.get(body.session);
      if (!s) return json(res, 404, { ok: false, fehler: 'session' });
      // Serialisieren: erst Ende speichern, DANN zusammenfassen (SQLite-Lock-Race vermeiden)
      protokollEnde(s.dbId, body.grund || 'aufgelegt', () => {
        zusammenfassung(s.dbId, (err, sum) => {
          if (!sum || typeof sum !== 'string') sum = 'keine Zusammenfassung';
          console.log('[end] Zusammenfassung db=' + s.dbId + ':', sum.slice(0, 80));
          dbRunSafe(`UPDATE calls SET zusammenfassung=${esc(sum)} WHERE id=${s.dbId};`);
          if (!/^test|handshake/.test(String(s.nummer || '')) && body.grund !== 'test') {
            telegramMelden(anrufMeldung(s.nummer, sum, s.dbId));
          }
          SESSIONS.delete(body.session);
          json(res, 200, { ok: true, zusammenfassung: sum });
        });
      });
    });
  } else if (u.pathname === '/handshake') {
    // Test-Seite: Handy-Browser ruft /api/start und spielt Gemmas Begruessung ab
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CallAgent Handshake</title><style>body{font-family:system-ui;background:#111;color:#fff;text-align:center;padding:2rem}button{font-size:1.3rem;padding:1rem 2rem;border-radius:12px;border:0;background:#2ecc71;color:#fff}#s{margin-top:1.5rem;color:#aaa}</style></head><body><h1>📞 CallAgent Handshake</h1><p id="s">Tippen, dann spricht Gemma (Kore) vom Server.</p><button onclick="los()">🤖 Gemma sagt Hallo</button><script>const T=new URLSearchParams(location.search).get('token');async function los(){document.getElementById('s').textContent='Verbinde mit callagent.gemivo.de ...';try{const r=await fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json','X-App-Token':T},body:JSON.stringify({nummer:'handshake-browser'})});const j=await r.json();if(!j.ok)throw new Error(j.fehler||'Server-No');const b=atob(j.audio_b64);const buf=new Uint8Array(b.length);for(let i=0;i<b.length;i++)buf[i]=b.charCodeAt(i);const ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();const ab=await ctx.decodeAudioData(buf.buffer);const src=ctx.createBufferSource();src.buffer=ab;src.connect(ctx.destination);src.start();document.getElementById('s').textContent='\u2705 Handshake OK: '+(j.beguessung_text||j.begruessung_text||'').slice(0,60);}catch(e){document.getElementById('s').textContent='\u274c FEHLER: '+e.message;}}</script></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
  } else if (u.pathname === '/log') {
    dbRunSafe('SELECT id,nummer,start,ende,grund,zusammenfassung FROM calls ORDER BY id DESC LIMIT 50;', (e, out) => {
      let html = '<html><head><meta charset="utf-8"><title>CallAgent-Protokoll</title></head><body style="font-family:system-ui;max-width:860px;margin:2rem auto"><h1>📞 CallAgent-Protokoll</h1>';
      (out || '').split('\n').filter(Boolean).forEach(zeile => {
        const z = zeile.split('|');
        if (!z[0]) return;
        html += `<div style="border:1px solid #ccc;border-radius:8px;padding:10px;margin:8px 0"><b>#${z[0]}</b> 📱 ${z[1] || '?'} · ${z[2] || ''} ${z[3] ? ' → ' + z[3] : ''} ${z[4] ? ' (' + z[4] + ')' : ''}<br><span style="color:#555">${(z[5] || '').replace(/</g, '&lt;')}</span><br><a href="/log/${z[0]}">Transkript</a></div>`;
      });
      html += '</body></html>';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
    });
  } else if (u.pathname.startsWith('/log/') && req.method === 'GET') {
    const id = parseInt(u.pathname.split('/')[2], 10);
    if (!id) return json(res, 400, { ok: false });
    dbRunSafe(`SELECT transkript FROM calls WHERE id=${id};`, (e, out) => {
      let arr = []; try { arr = JSON.parse((out || '').replace(/^"|"$/g, '').replace(/""/g, '"')); } catch (x) {}
      let html = '<html><head><meta charset="utf-8"></head><body style="font-family:system-ui;max-width:860px;margin:2rem auto"><h1>Transkript Anruf #' + id + '</h1>';
      arr.forEach(m => { html += `<p><b>${m.ich ? '🤖 Gemma' : '👤 Anrufer'}:</b> ${m.text.replace(/</g, '&lt;')}</p>`; });
      html += '</body></html>';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
    });
  } else json(res, 404, { ok: false });
});
if (require.main === module) {
  server.listen(PORT, HOST, () => console.log('callagent listening on ' + HOST + ':' + PORT));
  // Session-Aufraeumen (aelter als 2h)
  setInterval(() => { const jetzt = Date.now(); for (const [k, s] of SESSIONS) if (jetzt - s.letzteAktiv > 7.2e6) SESSIONS.delete(k); }, 6e5);
}

// Unit-Test-Exporte
module.exports = { wavHeader, esc, begruessungsText, ausspracheText, anrufMeldung, safeRead, denglisch, wiederholt, zusammenfassung };

