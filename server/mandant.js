/*
 * CallAgent Multi-Tenant (gemivo Anrufassistent): Mandanten-Daten, Verschluesselung,
 * PJSIP-Konfig-Generator, Limits. Ohne npm-Abhaengigkeiten (sqlite3-CLI wie server.js).
 *
 * Jeder Nutzer (gemivo-uid) = ein Mandant (Tabelle ca_mandant). Kay (uid 8) = Owner,
 * sip_modus 'legacy' (Registrierung kommt weiter aus /opt/callagent/sip.env, wird hier NIE erzeugt).
 */
const fs = require('fs');
const crypto = require('crypto');
const dns = require('dns');
const { execFile } = require('child_process');

const DB = process.env.CALLAGENT_DB || '/opt/callagent/data/calls.db';
const KEY_DATEI = process.env.ANRUF_KEY_DATEI || '/etc/gemivo/anruf.key';
const OWNER_UID = 8;
const TRANSPORT_PORT = parseInt(process.env.ANRUF_SIP_PORT || '5070', 10);

// ---------- SQLite ----------
function sql(q, cb) { execFile('sqlite3', ['-cmd', '.timeout 5000', DB, q], (e, out) => cb && cb(e, out)); }
function sqlJson(q, cb) {
  execFile('sqlite3', ['-cmd', '.timeout 5000', '-json', DB, q], (e, out) => {
    if (e) return cb(e, []);
    let r = []; try { r = JSON.parse(out || '[]'); } catch (x) {}
    cb(null, r);
  });
}
function esc(s) { return s === null || s === undefined ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'"; }
function int(n) { const v = parseInt(n, 10); if (!Number.isFinite(v)) throw new Error('keine Zahl'); return v; }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ca_mandant(
  user_id INTEGER PRIMARY KEY,
  email TEXT, anzeige_name TEXT,
  vorname TEXT, aussprache TEXT,
  sip_modus TEXT NOT NULL DEFAULT 'aus',
  sip_server TEXT, sip_port INTEGER NOT NULL DEFAULT 5060, sip_user TEXT, sip_auth_user TEXT,
  sip_pass_enc TEXT, sip_domain TEXT, sip_nummer TEXT, sip_ipv TEXT NOT NULL DEFAULT 'auto',
  gemini_key_enc TEXT, gemini_status TEXT NOT NULL DEFAULT 'fehlt', gemini_geprueft TEXT, gemini_fehler TEXT,
  notify_email INTEGER NOT NULL DEFAULT 1, notify_push INTEGER NOT NULL DEFAULT 0, tg_chat_id TEXT,
  aktiv INTEGER NOT NULL DEFAULT 1, limit_monat INTEGER NOT NULL DEFAULT 300, owner INTEGER NOT NULL DEFAULT 0,
  erstellt TEXT, geaendert TEXT);
CREATE TABLE IF NOT EXISTS ca_geraet(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  name TEXT, erstellt TEXT, zuletzt TEXT);
CREATE TABLE IF NOT EXISTS ca_kopplung(code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, ablauf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ca_tg_link(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, ablauf TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ca_push(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT, auth TEXT, erstellt TEXT);
CREATE INDEX IF NOT EXISTS ca_geraet_user ON ca_geraet(user_id);
CREATE TABLE IF NOT EXISTS ca_feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  art TEXT NOT NULL, kategorie TEXT, sterne INTEGER, daumen INTEGER, text TEXT, call_id INTEGER,
  app_version TEXT, geraet TEXT, android TEXT, schritt TEXT, quelle TEXT, screenshot TEXT, erstellt TEXT);
CREATE INDEX IF NOT EXISTS ca_feedback_user ON ca_feedback(user_id);
CREATE TABLE IF NOT EXISTS ca_funnel(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  schritt TEXT NOT NULL, ereignis TEXT NOT NULL, quelle TEXT, erstellt TEXT);
`;

/** Idempotente, rein additive Migration (calls.user_id + neue Tabellen + Kay als Owner-Mandant). */
function migrieren(cb) {
  sqlJson('PRAGMA table_info(calls);', (e, spalten) => {
    const hatUser = spalten.some(s => s.name === 'user_id');
    const schritte = [SCHEMA];
    if (!hatUser) schritte.push('ALTER TABLE calls ADD COLUMN user_id INTEGER;');
    schritte.push('CREATE INDEX IF NOT EXISTS calls_user ON calls(user_id);');
    schritte.push('UPDATE calls SET user_id=' + OWNER_UID + ' WHERE user_id IS NULL;');
    schritte.push(`INSERT OR IGNORE INTO ca_mandant(user_id,vorname,aussprache,sip_modus,sip_nummer,gemini_status,notify_email,aktiv,limit_monat,owner,erstellt,geaendert)
      VALUES(${OWNER_UID},'Kay','Kai','legacy','045130433056','ok',0,1,0,1,${esc(new Date().toISOString())},${esc(new Date().toISOString())});`);
    sql('PRAGMA journal_mode=WAL;', () => sql(schritte.join('\n'), (e2) => cb && cb(e2)));
  });
}

// ---------- Verschluesselung (AES-256-GCM, Schluessel /etc/gemivo/anruf.key, 64 Hex) ----------
let _key = null;
function schluessel() {
  if (_key) return _key;
  const hex = (process.env.ANRUF_KEY || (() => { try { return fs.readFileSync(KEY_DATEI, 'utf8'); } catch (e) { return ''; } })()).trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('anruf.key fehlt/ungueltig');
  _key = Buffer.from(hex, 'hex');
  return _key;
}
function verschluesseln(klar) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', schluessel(), iv);
  const ct = Buffer.concat([c.update(String(klar), 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function entschluesseln(enc) {
  if (!enc || !String(enc).startsWith('v1:')) return '';
  const b = Buffer.from(String(enc).slice(3), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', schluessel(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

// ---------- Mandanten ----------
function laden(uid, cb) {
  let u; try { u = int(uid); } catch (e) { return cb(null); }
  sqlJson('SELECT * FROM ca_mandant WHERE user_id=' + u + ';', (e, r) => cb(r[0] || null));
}
function alle(cb) { sqlJson('SELECT * FROM ca_mandant;', (e, r) => cb(r)); }

/** Anrufe des Mandanten im laufenden Kalendermonat (Europe/Berlin ~ UTC-Monat reicht fuer Limit). */
function monatsZahl(uid, cb) {
  const m = new Date().toISOString().slice(0, 7);
  sqlJson(`SELECT COUNT(*) AS n FROM calls WHERE user_id=${int(uid)} AND substr(start,1,7)=${esc(m)};`, (e, r) => cb((r[0] && r[0].n) || 0));
}

/**
 * Entscheidet, ob ein Anruf fuer den Mandanten angenommen wird.
 * -> {ok:true, key, owner} oder {ok:false, grund:'inaktiv'|'kein-key'|'limit'|'unbekannt'}
 */
function anrufFreigabe(m, anzahlMonat, ownerKey) {
  if (!m) return { ok: false, grund: 'unbekannt' };
  if (!m.aktiv) return { ok: false, grund: 'inaktiv' };
  const owner = !!m.owner;
  let key = '';
  if (owner) key = ownerKey || '';
  else { try { key = entschluesseln(m.gemini_key_enc); } catch (e) { key = ''; } }
  if (!key || (!owner && m.gemini_status !== 'ok')) return { ok: false, grund: 'kein-key' };
  if (!owner && !String(m.vorname || '').trim()) return { ok: false, grund: 'kein-name' };
  if (!owner && m.limit_monat > 0 && anzahlMonat >= m.limit_monat) return { ok: false, grund: 'limit' };
  return { ok: true, key, owner };
}

// ---------- PJSIP ----------
const RE_HOST = /^[A-Za-z0-9.\-]+$|^\[?[0-9a-fA-F:]+\]?$/;
const RE_USER = /^[A-Za-z0-9._\-+@]{1,64}$/;
function pruefeSip(d) {
  const f = [];
  if (!d.sip_server || !RE_HOST.test(d.sip_server) || d.sip_server.length > 253) f.push('Registrar/Server ungültig');
  if (!d.sip_user || !RE_USER.test(d.sip_user)) f.push('Benutzername ungültig (nur Buchstaben, Ziffern, . _ - + @)');
  if (d.sip_auth_user && !RE_USER.test(d.sip_auth_user)) f.push('Auth-Benutzer ungültig');
  if (d.sip_domain && !RE_HOST.test(d.sip_domain)) f.push('Domain ungültig');
  const p = parseInt(d.sip_port || 5060, 10); if (!(p > 0 && p < 65536)) f.push('Port ungültig');
  return f;
}
function confWert(s) { // Asterisk-Config: Zeilenumbrueche verboten, ';' leitet Kommentar ein -> escapen
  if (/[\r\n]/.test(s)) throw new Error('Zeilenumbruch im Wert');
  return String(s).replace(/;/g, '\\;');
}
function hostUri(h) { return /:/.test(h) && !/^\[/.test(h) ? '[' + h + ']' : h; }

function istKonfigurierbar(m) {
  return m && !m.owner && m.aktiv && String(m.vorname || '').trim() && (m.sip_modus === 'fritzbox' || m.sip_modus === 'anbieter')
    && m.gemini_status === 'ok' && m.sip_server && m.sip_user && m.sip_pass_enc && pruefeSip(m).length === 0 ? true : false;
}

/** Reiner Generator (testbar): Liste [{m, pass, ipv:'v4'|'v6'}] -> Text fuer /etc/asterisk/pjsip_mandanten.conf */
function pjsipText(eintraege) {
  let t = '; erzeugt von callagent/mandant.js am ' + new Date().toISOString() + ' - NICHT von Hand aendern\n';
  t += `[transport-m4]\ntype=transport\nprotocol=udp\nbind=0.0.0.0:${TRANSPORT_PORT}\n\n`;
  t += `[transport-m6]\ntype=transport\nprotocol=udp\nbind=[::]:${TRANSPORT_PORT}\n\n`;
  for (const { m, pass, ipv } of eintraege) {
    const n = 'm' + int(m.user_id);
    const tp = ipv === 'v6' ? 'transport-m6' : 'transport-m4';
    const port = parseInt(m.sip_port || 5060, 10);
    const srv = hostUri(m.sip_server);
    const dom = m.sip_domain || m.sip_server;
    t += `; Mandant ${int(m.user_id)} (${m.sip_modus})
[${n}-auth]
type=auth
auth_type=userpass
username=${confWert(m.sip_auth_user || m.sip_user)}
password=${confWert(pass)}

[${n}]
type=aor
contact=sip:${srv}:${port}
qualify_frequency=0

[${n}]
type=endpoint
transport=${tp}
context=callagent-in
disallow=all
allow=alaw,ulaw
outbound_auth=${n}-auth
aors=${n}
from_user=${confWert(m.sip_user)}
from_domain=${hostUri(dom)}
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
dtmf_mode=rfc4733
${ipv === 'v6' ? 'rtp_ipv6=yes\n' : ''}set_var=CA_TENANT=${int(m.user_id)}

[${n}-reg]
type=registration
transport=${tp}
outbound_auth=${n}-auth
server_uri=sip:${srv}:${port}
client_uri=sip:${confWert(m.sip_user)}@${hostUri(dom)}
contact_user=gemma${int(m.user_id)}
retry_interval=60
forbidden_retry_interval=600
max_retries=10000
expiration=300
line=yes
endpoint=${n}

`;
  }
  return t;
}

function ipVersion(m, cb) {
  if (m.sip_ipv === 'v4' || m.sip_ipv === 'v6') return cb(m.sip_ipv);
  const h = String(m.sip_server).replace(/^\[|\]$/g, '');
  if (/:/.test(h)) return cb('v6');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return cb('v4');
  dns.resolve4(h, (e, a) => {
    if (!e && a && a.length) return cb('v4');
    dns.resolve6(h, (e6, a6) => cb(!e6 && a6 && a6.length ? 'v6' : 'v4'));
  });
}

const ZIEL = process.env.ANRUF_PJSIP_DATEI || '/etc/asterisk/pjsip_mandanten.conf';
let syncLaeuft = Promise.resolve();
/** Konfig aus DB neu schreiben + PJSIP neu laden (laufende Anrufe bleiben bestehen). Serialisiert. */
function pjsipSync(cb) {
  syncLaeuft = syncLaeuft.then(() => new Promise(fertig => {
    alle(liste => {
      const kand = liste.filter(istKonfigurierbar);
      const out = [];
      let offen = kand.length;
      const weiter = () => {
        out.sort((a, b) => a.m.user_id - b.m.user_id);
        const text = pjsipText(out);
        let alt = ''; try { alt = fs.readFileSync(ZIEL, 'utf8'); } catch (e) {}
        const ohneKopf = s => s.split('\n').slice(1).join('\n');
        if (alt && ohneKopf(alt) === ohneKopf(text)) { fertig(); return cb && cb(null, { geaendert: false, mandanten: out.length }); }
        const tmp = ZIEL + '.tmp';
        fs.writeFileSync(tmp, text, { mode: 0o640 });
        try { fs.chownSync(tmp, 0, asteriskGid()); } catch (e) {}
        fs.renameSync(tmp, ZIEL);
        execFile('asterisk', ['-rx', 'module reload res_pjsip.so'], (e) => {
          fertig();
          cb && cb(e, { geaendert: true, mandanten: out.length });
        });
      };
      if (!offen) return weiter();
      kand.forEach(m => {
        let pass = ''; try { pass = entschluesseln(m.sip_pass_enc); } catch (e) {}
        ipVersion(m, ipv => { if (pass) out.push({ m, pass, ipv }); if (--offen === 0) weiter(); });
      });
    });
  }));
}
function asteriskGid() {
  const z = fs.readFileSync('/etc/group', 'utf8').split('\n').find(l => l.startsWith('asterisk:'));
  return z ? parseInt(z.split(':')[2], 10) : 0;
}

/** Registrierungsstatus aus Asterisk: 'Registered' | 'Rejected' | 'Unregistered' | 'nicht-konfiguriert' ... */
function regStatus(uid, owner, cb) {
  const name = owner ? 'anbieter-reg' : 'm' + int(uid) + '-reg';
  execFile('asterisk', ['-rx', 'pjsip show registrations'], (e, out) => {
    if (e) return cb({ status: 'asterisk-fehler' });
    const z = String(out || '').split('\n').find(l => l.trim().startsWith(name + '/'));
    if (!z) return cb({ status: 'nicht-konfiguriert' });
    const m = z.match(/(Registered|Unregistered|Rejected|Stopped|Rejected|Retrying)\s*(\(exp\.[^)]*\))?\s*$/i);
    cb({ status: m ? m[1] : z.trim().split(/\s{2,}/).pop(), zeile: z.trim() });
  });
}

module.exports = {
  OWNER_UID, SCHEMA, migrieren, verschluesseln, entschluesseln, laden, alle, monatsZahl, anrufFreigabe,
  pruefeSip, pjsipText, istKonfigurierbar, pjsipSync, regStatus, confWert, esc, _setKey(hex) { _key = hex ? Buffer.from(hex, 'hex') : null; }
};
