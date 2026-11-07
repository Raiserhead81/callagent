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
