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
