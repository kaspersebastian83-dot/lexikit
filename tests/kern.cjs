// LexiKit-Kern ohne Browser: Word lesen (nur Text, Fotos nie), Abschnitte, Berichtskopf weg, Berichte auswählen,
// Suche und Markierung, Zusammenführen der gemeinsamen Dateien. node tests/kern.cjs
const assert = require('node:assert/strict'), zlib = require('node:zlib');
const K = require('./kern-laden.cjs');
const { docx, BERICHTE } = require('./daten/berichte.cjs');

const inflate = async b => new Uint8Array(zlib.inflateRawSync(b));
/** Datei-Leser mit Zähler: wie viele Bytes wurden wirklich gelesen? */
function leser(buf) { const z = { bytes: 0 }; z.lies = async (a, e) => { z.bytes += e - a; return new Uint8Array(buf.subarray(a, e)); }; return z; }
const lesen = async (teile, foto) => { const buf = docx(teile, foto); const l = leser(buf); const b = await K.docxLesen(l.lies, buf.length, inflate); return { b, gelesen: l.bytes, groesse: buf.length }; };
const alles = b => b.abschnitte.map(a => a.h + '\n' + a.p.join('\n')).join('\n');
let n = 0; const test = async (name, f) => { await f(); n++; console.log('ok', name); };

(async () => {
  await test('fette Überschriften, Titel aus Formatvorlage, Foto nicht gelesen', async () => {
    const { b, gelesen, groesse } = await lesen(BERICHTE.fett, 1500000);
    assert.equal(b.form, 'Untersuchungsbericht');
    assert.deepEqual(b.abschnitte.map(a => a.h), ['Probenahme', 'Befunde', 'Schlussfolgerungen']);
    assert.ok(gelesen < groesse * 0.02, `nur der Text gelesen (${gelesen} von ${groesse} Bytes)`);
    const t = alles(b);
    assert.ok(t.includes('E. coli nachgewiesen'));
    assert.ok(!t.includes('gelöscht'), 'gelöschter Text (Änderungsverfolgung) fehlt');
    assert.equal(t.split('Hinweis im Textfeld').length, 2, 'Textfeld genau einmal (ohne Fallback)');
    assert.ok(t.includes('W1 · Escherichia coli · nachgewiesen'), 'Tabellenzeile als Textstelle');
    assert.ok(!b.abschnitte.some(a => a.h.startsWith('Tabelle')), '„Tabelle 1: …“ ist keine Überschrift');
    assert.ok(t.includes('Tabelle 1: Ergebnisse'), '… bleibt aber Text');
  });
  await test('Berichtskopf fällt weg (vor und nach der Marke, mit Fortsetzungszeile, als Tabelle)', async () => {
    for (const k of ['fett', 'unter', 'ohneMarke', 'stub']) {
      const t = alles((await lesen(BERICHTE[k])).b);
      for (const verboten of ['Beispielperson', 'Beispielmensch', 'Musterhausen', 'Beispielweg 7', 'XY-0000', 'AB-1', 'Muster Versicherung', 'Projektnummer', '99.0', 'Musterbüro', 'Beispielstraße 1'])
        assert.ok(!t.includes(verboten), `${k}: „${verboten}“ darf nicht im Index stehen`);
    }
  });
  await test('unterstrichene numerierte Überschriften, langer Absatz ist keine Überschrift', async () => {
    const { b } = await lesen(BERICHTE.unter, 300000);
    assert.equal(b.form, 'Sanierungsvorschlag');
    assert.deepEqual(b.abschnitte.map(a => a.h), ['1. Veranlassung', '2. Befund', '3. Entsorgung']);
    assert.ok(b.abschnitte[1].p.includes('Abfall · Abfallschlüssel · Entsorgungsweg'));
    assert.equal(b.abschnitte[2].p.length, 3);
  });
  await test('Bericht ohne Überschriften: Textstellen ohne Abschnittsnamen', async () => {
    const { b } = await lesen(BERICHTE.ohne);
    assert.equal(b.abschnitte.length, 1); assert.equal(b.abschnitte[0].h, ''); assert.equal(b.abschnitte[0].p.length, 2);
  });
  await test('Bericht ohne Marke „(n. Mitteilung)“ beginnt nach dem Titel', async () => {
    const { b } = await lesen(BERICHTE.ohneMarke);
    assert.deepEqual(b.abschnitte.map(a => a.h), ['1. Veranlassung']);
  });
  await test('ohne Marke und mit unbekanntem Titel: Briefkopf bleibt draußen', async () => {
    const { b } = await lesen(BERICHTE.ohneMarkeTitel);
    assert.equal(b.form, '');
    assert.deepEqual(b.abschnitte.map(a => a.h), ['1. Veranlassung']);
    const t = alles(b); for (const v of ['Musterbüro', 'Beispielstraße', 'Brandursachenbericht']) assert.ok(!t.includes(v), v);
  });
  await test('kaputte Datei → Fehler statt Absturz', async () => {
    const l = leser(Buffer.from('keine Word-Datei'));
    await assert.rejects(K.docxLesen(l.lies, 16, inflate), /keine Word-Datei/);
  });

  await test('Welche Dateien sind Berichte?', async () => {
    const ja = ['1. Mitteilung.docx', '2.Mitteilung.docx', '1. Mitteilung .docx', '1. Mitteilung_.docx', '3. Mitteillung.docx', '2. Mitteilung_25.0501.docx',
      '1. Mitteilung_korrigiert.docx', '1. Mitteilung Korrektur.docx', '1. Mitteilung Ergänzung.docx', '1. Mitteilung_Englisch.docx', '1. Mitteilung Gebäude A.docx', '1. Mitteilung - Kopie.docx', '1. MITTEILUNG.DOCX'];
    const nein = ['Anschreiben 1. Mitteilung.docx', 'Anschreiben_1. Mitteilung.docx', 'Text_Anschreiben_San_1. Mitteilung.docx', 'An schreiben 1. Mitteilung.docx', '1. Mitteilung_Entwurf.docx',
      'Vorbereitung 1. Mitteilung.docx', 'Vorlage Mitteilung.docx', '~$Mitteilung.docx', '1. Mitteilung.pdf', '1. Mitteilung.doc', 'Gutachten_20260301_1200.docx', 'Mitteilung.zip'];
    for (const x of ja) assert.ok(K.istBerichtName(x), 'Bericht: ' + x);
    for (const x of nein) assert.ok(!K.istBerichtName(x), 'kein Bericht: ' + x);
    assert.equal(K.mitteilungNr('2. Mitteilung_25.0501.docx'), 2); assert.equal(K.mitteilungNr('12.Mitteilung.docx'), 12); assert.equal(K.mitteilungNr('Mitteilung.docx'), null);
  });
  await test('Projektordner nur direkt im Archiv', async () => {
    assert.deepEqual(K.projektOrdner('26.0137 Beispielweg Musterstadt Tst'), { jahr: 2026, nr: 137, kennung: '26.0137' });
    assert.equal(K.projektOrdner('22.00114 Musterweg').nr, 114);
    for (const x of ['ALT_2022', 'Sonstige', '_LexiKit', 'Div Kunden', '2022.00012 x', 'Test']) assert.equal(K.projektOrdner(x), null, x);
  });
  await test('Nur die neueste Fassung je Mitteilung – Zusätze und Gebäude bleiben eigene Berichte', async () => {
    const P = '25.0075 Musterallee Beispielstadt Tst';
    const d = (pfad, t) => ({ teile: pfad.split('/'), geaendert: t, groesse: 1 });
    const gew = K.auswaehlen([
      d('Mitteilungen/1. Mitteilung.docx', 1), d('Mitteilungen/1. Mitteilung_korrigiert.docx', 3), d('1. Mitteilung - Kopie.docx', 2),
      d(P + '/Mitteilungen/1. Mitteilung.docx', 2.5), d('1. Mitt/1. Mitteilung (2).docx', 2.7),   // verschachtelte Kopie, Mitteilungsordner
      d('Mitteilungen/2. Mitteilung.docx', 5), d('Mitteilungen/2. Mitteilung_25.0075.docx', 4),
      d('Mitteilungen/1. Mitteilung Gebäude A.docx', 1), d('Mitteilungen/1. Mitteilung Gebäude B.docx', 1),
      d('Mitteilungen/1. Mitteilung_Englisch.docx', 1), d('Mitteilungen/1. Mitteilung Ergänzung.docx', 1),
      d('Altbau/1. Mitteilung.docx', 1), d('Neubau/1. Mitteilung.docx', 1),
      d('Mitteilungen/Anschreiben 1. Mitteilung.docx', 9), d('Mitteilungen/Mitteilung.docx', 1)], P).map(x => x.teile.join('/')).sort();
    assert.deepEqual(gew, ['Altbau/1. Mitteilung.docx', 'Mitteilungen/1. Mitteilung Ergänzung.docx', 'Mitteilungen/1. Mitteilung Gebäude A.docx', 'Mitteilungen/1. Mitteilung Gebäude B.docx',
      'Mitteilungen/1. Mitteilung_Englisch.docx', 'Mitteilungen/1. Mitteilung_korrigiert.docx', 'Mitteilungen/2. Mitteilung.docx', 'Mitteilungen/Mitteilung.docx', 'Neubau/1. Mitteilung.docx'].sort());
  });

  const B = (pfad, jahr, pnr, nr, abschnitte) => ({ pfad, projekt: pfad.split('/')[0], jahr, pnr, nr, abschnitte });
  const IDX = [
    B('22.00114 A/1. Mitteilung.docx', 2022, 114, 1, [{ h: '', p: ['Das Löschwasser stand im Keller.'] }]),
    B('26.0137 B/Mitteilungen/1. Mitteilung.docx', 2026, 137, 1, [{ h: 'Befunde', p: ['Im Löschwasser wurde E. coli gefunden.', 'Kein Löschmittel.'] }, { h: 'Löschpulver', p: ['Siehe oben.'] }]),
    B('26.0137 B/Mitteilungen/2. Mitteilung.docx', 2026, 137, 2, [{ h: '4. Befund', p: ['Estrich und Löschwasser.'] }]),
    B('23.0502 C/2. Mitteilung.docx', 2023, 502, 2, [{ h: '5. Probenahme', p: ['Brandschuttmischprobe nach DepV.'] }]),
  ];
  await test('Suche: Thema (eines der Wörter), neueste zuerst, Jahr, nur Überschrift passt', async () => {
    const r = K.suche(IDX, ['Löschwasser', 'Löschmittel'], { modus: 'oder' });
    assert.equal(r.treffer.length, 4); assert.equal(r.berichte, 3);
    assert.deepEqual(r.treffer.map(t => t.b.pfad + '#' + t.ai + '.' + t.pi), ['26.0137 B/Mitteilungen/2. Mitteilung.docx#0.0', '26.0137 B/Mitteilungen/1. Mitteilung.docx#0.0', '26.0137 B/Mitteilungen/1. Mitteilung.docx#0.1', '22.00114 A/1. Mitteilung.docx#0.0']);
    assert.equal(K.suche(IDX, ['löschwasser'], { jahr: 2022 }).treffer.length, 1, 'Groß/Klein egal, Jahr');
    assert.equal(K.suche(IDX, ['Pulver'], {}).treffer.length, 1, 'Überschrift „Löschpulver“ als Teilwort');
    assert.equal(K.zaehle(IDX, ['DepV']), 1);
  });
  await test('Eigene Suche: alle Wörter, Anführungszeichen halten zusammen', async () => {
    assert.deepEqual(K.woerterAus('  Estrich  "E. coli" x „Brand schutt“ '), ['Estrich', 'E. coli', 'Brand schutt']);
    assert.equal(K.suche(IDX, ['Estrich', 'Löschwasser'], { modus: 'und' }).treffer.length, 1);
    assert.equal(K.suche(IDX, ['Befund', 'coli'], { modus: 'und' }).treffer.length, 1, 'Wort aus der Überschrift zählt mit');
    assert.equal(K.suche(IDX, ['Estrich', 'Asbest'], { modus: 'und' }).treffer.length, 0);
  });
  await test('Markieren und Ausschnitt', async () => {
    assert.deepEqual(K.markiere('Löschwasser und asbesthaltig', ['asbest', 'LÖSCH']), [{ t: 'Lösch', hit: true }, { t: 'wasser und ', hit: false }, { t: 'asbest', hit: true }, { t: 'haltig', hit: false }]);
    assert.deepEqual(K.markiere('abcabc', ['abc', 'bca']).filter(t => t.hit).map(t => t.t), ['abcabc'], 'überlappende Funde zusammen');
    const lang = 'Wort '.repeat(300) + 'Asbest ' + 'Wort '.repeat(300), a = K.ausschnitt(lang, ['asbest'], 200);
    assert.ok(a.length < 230 && a.includes('Asbest') && a.startsWith('… ') && a.endsWith(' …'));
  });

  await test('Index zusammenführen: nichts vom anderen PC geht verloren oder kommt zurück', async () => {
    const e = (pfad, geaendert, gelesenAm) => ({ pfad, stempel: { groesse: 1, geaendert }, gelesenAm });
    const disk = { format: 'lexikit-index', version: 1, jahr: 2026, berichte: { a: e('a', 1, '2026-11-13T10:00'), b: e('b', 1, '2026-11-13T10:00'), c: e('c', 9, '2026-11-13T12:00'), d: e('d', 1, '2026-11-13T12:30') } };
    const neu = K.indexMergen(disk, { neu: { x: e('x', 1, '2026-11-13T12:00'), c: e('c', 5, '2026-11-13T12:00') }, weg: [{ pfad: 'b', am: '2026-11-13T11:00' }, { pfad: 'd', am: '2026-11-13T12:00' }] }, '2026-11-13T12:05');
    assert.deepEqual(Object.keys(neu.berichte).sort(), ['a', 'c', 'd', 'x'], 'a (anderer PC) bleibt, b weg, d nach meiner Prüfung neu gelesen → bleibt');
    assert.equal(neu.berichte.c.stempel.geaendert, 9, 'neuere Fassung vom anderen PC bleibt');
    assert.equal(Object.keys(disk.berichte).length, 4, 'disk unverändert');
    assert.ok(K.indexLesen('{', 2026).kaputt); assert.ok(K.indexLesen('{"format":"lexikit-index","version":9,"berichte":{}}', 2026).neuer);
    assert.deepEqual(K.indexLesen(null, 2025).berichte, {});
  });
  await test('Themenliste: neun Themen, ändern, löschen bleibt gelöscht, Konflikt wird erkannt', async () => {
    const t0 = K.ersteThemen('2026-11-13T09:00');
    assert.deepEqual(t0.themen.map(t => t.name), ['Löschpulver', 'Löschmittel', 'Löschwasser', 'Brandschutt', 'Entsorgungswege', 'Abfallschlüssel', 'Asbest', 'Schimmel', 'Fäkalkeime']);
    assert.deepEqual(K.themaWoerter(t0.themen[8]), ['Fäkalkeime', 'E. coli', 'Escherichia coli', 'coliforme', 'Enterokokken']);
    const id = K.neueThemaId(t0, 'Estrich');
    let r = K.themaEinspielen(t0, { id, name: ' Estrich ', woerter: ['Trittschall', ' '], geaendert: '2026-11-13T10:00', basis: '' });
    const t1 = r.themen; assert.deepEqual(t1.themen.at(-1), { id, name: 'Estrich', woerter: ['Trittschall'], geaendert: '2026-11-13T10:00' });
    // anderer PC hat Asbest geändert, ich will mit altem Stand ändern → Konflikt
    const asb = t1.themen.find(t => t.name === 'Asbest');
    const anders = K.themaEinspielen(t1, { id: asb.id, name: 'Asbest', woerter: ['Chrysotil'], geaendert: '2026-11-13T11:00', basis: asb.geaendert }).themen;
    r = K.themaEinspielen(anders, { id: asb.id, name: 'Asbest', woerter: ['Amphibol'], geaendert: '2026-11-13T11:05', basis: asb.geaendert });
    assert.ok(r.konflikt && r.konflikt.woerter[0] === 'Chrysotil');
    r = K.themaEinspielen(anders, { id, name: 'Estrich', geloescht: true, geaendert: '2026-11-13T12:00', basis: '2026-11-13T10:00' });
    assert.equal(r.themen.themen.find(t => t.id === id).geloescht, true, 'gelöscht bleibt als Vermerk');
    assert.notEqual(K.neueThemaId(r.themen, 'Estrich'), id, 'neues Thema mit gleichem Namen bekommt eine neue id');
    assert.ok(K.themenLesen('nicht json').kaputt); assert.equal(K.themenLesen(''), null);
  });
  console.log(`\nKern: ${n} Prüfungen bestanden`);
})().catch(e => { console.error(e); process.exit(1); });
