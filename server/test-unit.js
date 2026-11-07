// Lokale Unit-Tests (ohne Server-Abhaengigkeiten): node --test server/test-unit.js
const test = require('node:test');
const assert = require('node:assert');
process.env.CALLAGENT_NO_DB = '1';
const { wavHeader, esc, begruessungsText } = require('./server.js');

test('wavHeader: korrekter RIFF-Header fuer 1000 Bytes 24kHz mono 16bit', () => {
  const b = wavHeader(1000, 24000, 1, 16);
  assert.equal(b.length, 44);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.readUInt32LE(4), 1036); // 36 + datenLen
  assert.equal(b.toString('ascii', 8, 12), 'WAVE');
  assert.equal(b.readUInt16LE(20), 1);   // PCM
  assert.equal(b.readUInt16LE(22), 1);   // mono
  assert.equal(b.readUInt32LE(24), 24000);
  assert.equal(b.readUInt16LE(34), 16);  // bits
  assert.equal(b.readUInt32LE(40), 1000);
});

test('esc: Hochkommata werden verdoppelt, NULL fuer fehlende Werte', () => {
  assert.equal(esc("Tom's"), "'Tom''s'");
  assert.equal(esc(null), 'NULL');
  assert.equal(esc(undefined), 'NULL');
});

test('begruessungstext: nennt Gemma und Kay, bittet um Anliegen', () => {
  const t = begruessungsText('+49170');
  assert.match(t, /Gemma/);
  assert.match(t, /Kay/);
  assert.match(t, /aufnehmen|Anliegen/i);
});

const { denglisch } = require('./server.js');
test('denglisch: erkennt englische Woerter, laesst sauberes Deutsch durch', () => {
  assert.equal(denglisch('Ich kann ihn nicht connecten, bitte leaven Sie eine Nachricht'), 'connecten');
  assert.ok(denglisch('Thank you for your patience'));
  assert.equal(denglisch('Guten Tag, Herr Meier. Ich richte Kay gerne aus, dass Sie angerufen haben.'), '');
});

const { wiederholt } = require('./server.js');
test('wiederholt: erkennt Schleifen-Zusammenfassungen', () => {
  const satz = 'Gemma wird den Anruf zurueckgeben und sich mit Kay ueber das Projekt informieren.';
  assert.equal(wiederholt(satz + ' ' + satz), true);
  assert.equal(wiederholt('Thomas Becker von Solarfix bittet um Rueckruf morgen. Es geht um das Angebot fuer die Solaranlage.'), false);
});

const { ausspracheText } = require('./server.js');
test('aussprache: Kay -> Kai fuer die Stimme, Begruessung ohne Nachnamen', () => {
  assert.equal(ausspracheText('Assistentin von Kay. Kays Nummer'), 'Assistentin von Kai. Kais Nummer');
  assert.equal(ausspracheText('Okay, Kayak'), 'Okay, Kayak');
  assert.doesNotMatch(begruessungsText('+49170'), /Conrad/);
});

const { anrufMeldung } = require('./server.js');
test('anrufMeldung: Nummer, Zusammenfassung, Rueckruf-Link', () => {
  const t = anrufMeldung('01748275109', 'Bitte um Rueckruf.', 28);
  assert.match(t, /01748275109/); assert.match(t, /Bitte um Rueckruf/); assert.match(t, /tel:01748275109/); assert.match(t, /#28/);
  assert.match(anrufMeldung('', 'x', 1), /unterdrückt/);
});

test('denglisch: Fremdschrift (chinesisch) wird erkannt, Umlaute/Euro nicht', () => {
  assert.equal(denglisch('dass Kay您 zurückrufen soll'), '您');
  assert.equal(denglisch('Schöne Grüße, das kostet 5 € – danke!'), '');
});

// ---------- Multi-Tenant (gemivo Anrufassistent) ----------
const neu = require('./server.js');
const ALT = process.env.CALLAGENT_ALT_SERVER; // Pfad zur Vorversion (git show HEAD~:server/server.js)
test('Owner Kay: Prompt + Begruessung byte-gleich zur Einzelnutzer-Version', { skip: !ALT }, () => {
  const alt = require(ALT);
  assert.equal(neu.livePrompt(neu.begruessungsText('+49')), alt.livePrompt(alt.begruessungsText('+49')));
  assert.equal(neu.begruessungsText('+49'), alt.begruessungsText('+49'));
});
test('Mandant: eigener Name + KI-Hinweis + Aussprache nur fuer die Stimme', () => {
  const m = { user_id: 990001, owner: 0, vorname: 'Jörg', aussprache: 'Jörk' };
  const b = neu.begruessungsText('+49', m);
  assert.match(b, /digitale Assistentin von Jörg/);
  assert.doesNotMatch(b, /Kay/);
  const p = neu.livePrompt(b, m);
  assert.doesNotMatch(p, /\bKay\b|\bKai\b/);
  assert.match(p, /Jörk/);
  assert.equal(neu.protokollText('Ich sage es Jörk', 'Jörg', 'Jörk'), 'Ich sage es Jörg');
  assert.equal(neu.ausspracheText('Anna', 'Anna', ''), 'Anna');
});

const M = require('./mandant.js');
M._setKey('11'.repeat(32));
test('mandant: AES-GCM rund + manipuliert -> Fehler', () => {
  const e = M.verschluesseln('geheim;pass');
  assert.match(e, /^v1:/); assert.equal(M.entschluesseln(e), 'geheim;pass');
  const kaputt = 'v1:' + Buffer.from(Buffer.from(e.slice(3), 'base64').map((b, i) => i === 30 ? b ^ 1 : b)).toString('base64');
  assert.throws(() => M.entschluesseln(kaputt));
});
test('mandant: Freigabe Owner/Key/Limit/inaktiv', () => {
  const key = M.verschluesseln('AIzaTEST');
  assert.deepEqual(M.anrufFreigabe({ owner: 1, aktiv: 1 }, 9999, 'PAID'), { ok: true, key: 'PAID', owner: true });
  assert.equal(M.anrufFreigabe({ owner: 0, aktiv: 1, gemini_key_enc: key, gemini_status: 'ok', limit_monat: 300, vorname: 'Anna' }, 5).key, 'AIzaTEST');
  assert.equal(M.anrufFreigabe({ owner: 0, aktiv: 1, gemini_key_enc: key, gemini_status: 'ok', limit_monat: 3, vorname: 'Anna' }, 3).grund, 'limit');
  assert.equal(M.anrufFreigabe({ owner: 0, aktiv: 1, gemini_key_enc: key, gemini_status: 'ok', limit_monat: 3 }, 0).grund, 'kein-name');
  assert.equal(M.anrufFreigabe({ owner: 0, aktiv: 1, gemini_key_enc: key, gemini_status: 'fehler' }, 0).grund, 'kein-key');
  assert.equal(M.anrufFreigabe({ owner: 0, aktiv: 0 }, 0).grund, 'inaktiv');
  assert.equal(M.anrufFreigabe(null, 0).grund, 'unbekannt');
});
test('mandant: PJSIP-Text je Mandant, set_var Tenant, Semikolon escaped, IPv6', () => {
  const t = M.pjsipText([
    { m: { user_id: 990001, sip_modus: 'fritzbox', sip_server: 'abc.myfritz.net', sip_user: 'gemma', sip_port: 5060 }, pass: 'a;b', ipv: 'v6' },
    { m: { user_id: 990002, sip_modus: 'anbieter', sip_server: 'sipgate.de', sip_user: '1234567e0', sip_port: 5060 }, pass: 'x', ipv: 'v4' }]);
  assert.match(t, /\[m990001-reg\][^[]*transport=transport-m6/);
  assert.match(t, /set_var=CA_TENANT=990001/); assert.match(t, /set_var=CA_TENANT=990002/);
  assert.ok(t.includes('password=a\\;b')); assert.match(t, /rtp_ipv6=yes/);
  assert.match(t, /client_uri=sip:1234567e0@sipgate.de/);
  assert.doesNotMatch(t, /\[anbieter/); // Kays Altanschluss wird hier nie erzeugt
  assert.throws(() => M.confWert('a\nb'));
});
test('mandant: SIP-Eingaben pruefen + Owner nie konfigurierbar', () => {
  assert.equal(M.pruefeSip({ sip_server: 'x.myfritz.net', sip_user: 'gemma', sip_port: 5060 }).length, 0);
  assert.ok(M.pruefeSip({ sip_server: 'evil\n[x]', sip_user: 'a' }).length > 0);
  assert.ok(M.pruefeSip({ sip_server: 'ok.de', sip_user: 'a b' }).length > 0);
  assert.equal(M.istKonfigurierbar({ owner: 1, aktiv: 1, sip_modus: 'fritzbox', gemini_status: 'ok', sip_server: 'a.de', sip_user: 'u', sip_pass_enc: 'v1:x' }), false);
});
