// LexiKit-Kern ohne Browser: Word lesen (nur Text, Fotos nie), Abschnitte, Berichtskopf weg, Berichte auswählen,
// Fälle (Abschnittsklassen, Stränge, „Was war“, „Untersucht“), Suche und Rangfolge, Markierung, Zusammenführen der gemeinsamen
// Dateien (Index Fassung 1 unverändert, Themenliste Fassung 2). node tests/kern.cjs
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

  /* ---------- ab 0.2.0: Fälle ---------- */
  await test('Abschnittsklassen nach Stichwort in der Überschrift (Liste aus der Zählung am echten Archiv)', async () => {
    const soll = { '1. Veranlassung': 'veranlassung', '2. Aufgabenstellung': 'veranlassung', '3. Ortstermin mit Probenahmen': 'probenahme', '3. Ortsbesichtigung': 'probenahme',
      'Besichtigung der Schadenstelle und Probenahme': 'probenahme', 'Probenahme': 'probenahme', '5. Befund': 'befund', 'Befunde': 'befund', '4. Untersuchungsergebnisse': 'befund',
      'Mikrobiologie': 'befund', 'Sensorische Prüfung auf Brandgeruch': 'befund', 'Ergebnisse der Probenahme': 'befund', '5. Schlussfolgerungen': 'schluss', 'Schlußfolgerung': 'schluss',
      'Bewertung der Befunde': 'schluss', 'Stellungnahme': 'schluss', '6. Sanierungsmaßnahmen': 'massnahmen', 'Weiterführende Maßnahmen': 'massnahmen', 'Sanierung': 'massnahmen',
      '7. Arbeitsschutzmaßnahmen': 'arbeitsschutz', 'Arbeitsschutz': 'arbeitsschutz', 'Maßnahmen zum Arbeitsschutz': 'arbeitsschutz',
      '6. Entsorgung': '', '5.1 Wischproben': '', 'Anhang': '' };   // kein „Entsorgung“ als eigene Klasse
    for (const [h, k] of Object.entries(soll)) assert.equal(K.klasseVon(h), k, h);
    assert.deepEqual(K.KLASSEN.map(k => k.name), ['Veranlassung', 'Probenahme', 'Befund', 'Schlussfolgerungen', 'Sanierungsmaßnahmen', 'Arbeitsschutz', 'Weiteres'], 'kein „Bewertung“, kein „Entsorgung“');
  });
  await test('Sätze: Abkürzungen, „E. coli“ und Datumsangaben trennen nicht', async () => {
    assert.deepEqual(K.saetze('Es wurden z. B. 12 Wischproben entnommen. In W3 wurde E. coli nachgewiesen (vgl. Tab. 2). Am 3. März war der Keller trocken.'),
      ['Es wurden z. B. 12 Wischproben entnommen.', 'In W3 wurde E. coli nachgewiesen (vgl. Tab. 2).', 'Am 3. März war der Keller trocken.']);
  });
  await test('„Untersucht“ heißt gemessen: Satz mit Probe/Messung/Ergebnis, nicht „unterblieben“', async () => {
    const u = s => K.untersuchtImSatz(s, false), ids = s => (u(s) || { ids: null }).ids;
    // zählt
    assert.deepEqual(u('Zur Messung der Chloridbelastungen wurden zwölf Wischproben entnommen und zusätzlich auf Sulfat und Phosphat untersucht.'),
      { ids: ['chlorid', 'sap'], namen: ['Chlorid', 'Sulfat, Phosphat'], proben: [{ n: 12, art: 'Wischproben' }] });
    assert.deepEqual(ids('Asbest wurde in keiner Probe nachgewiesen.'), ['asbest'], '„nicht nachgewiesen“ ist ein Ergebnis');
    assert.deepEqual(ids('Die Proben wurden auf die 16 Einzelkomponenten der polycyclischen aromatischen Kohlenwasserstoffe analysiert.'), ['pak']);
    assert.deepEqual(ids('Es wurden dreizehn Abklatschproben entnommen und auf Enterobakterien untersucht.'), ['faekal']);
    assert.deepEqual(u('Zwei Luftproben ergaben 300 KBE/m³ Schimmelpilze.').proben, [{ n: 2, art: 'Luftproben' }]);
    assert.deepEqual(u('Zusätzlich wurde eine Brandschuttmischprobe entnommen und nach DepV untersucht.').proben, [{ n: 1, art: 'Brandschuttmischprobe' }]);
    assert.deepEqual(ids('Die Probe sollte auf holzzerstörende Pilze untersucht werden.'), ['holzpilze'], 'Aufgabe, keine Empfehlung');
    assert.deepEqual(K.untersuchtImSatz('Probe · Chlorid · PAK', true).ids, ['pak', 'chlorid'], 'Tabellenzeile zählt ohne Stichwort');
    // zählt nicht
    assert.equal(u('Die Dacheindeckung besteht augenscheinlich aus Asbestzement.'), null, 'nur erwähnt');
    assert.equal(u('Auf eine Untersuchung auf Dioxine wurde verzichtet.'), null);
    assert.equal(u('Asbest wurde nicht untersucht.'), null);
    assert.equal(u('Es wurden keine Proben auf PAK entnommen.'), null);
    assert.equal(u('Wir empfehlen Kontrollwischproben auf Chlorid.'), null);
    assert.equal(u('Vor dem Rückbau ist die Dacheindeckung mittels Materialprobe auf Asbest zu prüfen.'), null);
    assert.equal(u('Die Pakete aus Polyvinylchlorid wurden beprobt.'), null, 'PAK ≠ Paket, Chlorid ≠ Polyvinylchlorid');
    assert.equal(u('Die 300 KBE/m³ betreffen sonstige Bakterien.'), null, '„KBE“ allein ist kein Schimmel');
    assert.deepEqual(ids('Drei Materialproben der Mineralfaserdämmung wurden einer sensorischen Prüfung auf Brandgeruch unterzogen.'), ['geruch'], 'Mineralwolle als Material ist kein KMF-Befund');
    assert.deepEqual(ids('Die Probe wurde auf künstliche Mineralfasern (KMF) untersucht.'), ['kmf']);
    // Probenzahlen: keine Teilmengen
    assert.deepEqual(u('Jeweils eine Wischprobe wurde auf PAK analysiert.').proben, []);
    assert.deepEqual(u('In 3 Wischproben wurde PAK nachgewiesen.').proben, []);
    assert.deepEqual(u('Bei den weiteren sechs Wischproben wird der Richtwert für Chlorid überschritten.').proben, []);
    assert.deepEqual(u('In einer der drei Materialproben wurde Asbest nachgewiesen.').proben, [], '„der drei …“ verweist auf schon genannte Proben');
    assert.deepEqual(u('Es wurden insgesamt fünfzehn Materialproben entnommen.').proben, [{ n: 15, art: 'Materialproben' }]);
    assert.ok(K.PARAMETER.length >= 19 && new Set(K.PARAMETER.map(p => p.id)).size === K.PARAMETER.length);
  });

  // Die Testberichte lesen und wie die App als Index-Einträge (Fassung 1) ablegen
  const ARCHIV = [
    ['24.0412 Musterlager Beispielheim Tst/Mitteilungen/1. Mitteilung.docx', 'lager1'], ['24.0412 Musterlager Beispielheim Tst/Mitteilungen/2. Mitteilung.docx', 'lager2'],
    ['24.0412 Musterlager Beispielheim Tst/Mitteilungen/1. Mitteilung_Englisch.docx', 'lagerEn'], ['25.0300 Musterwerk Probestadt Tst/Mitteilungen/1. Mitteilung.docx', 'werk'],
    ['23.0700 Beispielhalle Musterdorf Tst/Mitteilungen/1. Mitteilung.docx', 'halle'], ['24.0300 Musterhof Probedorf Tst/Altbau/1. Mitteilung.docx', 'ohneMarke'],
    ['24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx', 'ohne'], ['26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx', 'fett'],
    ['23.0502 Baumarkt Musterstadt Tst/2. Mitteilung.docx', 'unter'], ['25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung.docx', 'ohne']];
  const eintraege = [];
  for (const [pfad, k] of ARCHIV) {
    const t = pfad.split('/'), po = K.projektOrdner(t[0]), b = (await lesen(BERICHTE[k])).b;
    eintraege.push({ pfad, projekt: t[0], datei: t.at(-1), jahr: po.jahr, pnr: po.nr, nr: K.mitteilungNr(t.at(-1)), form: b.form, abschnitte: b.abschnitte });
  }
  const FAELLE = K.faelleBauen(eintraege), fall = k => FAELLE.find(f => f.kennung === k);
  const schilder = f => f.tags.map(t => K.tagText(t, f));

  await test('Zweite Kopf-Form und E-Mail-Adresse kommen nicht in den Index (neu gelesene Berichte)', async () => {
    const { b } = await lesen(BERICHTE.lager2), t = alles(b);
    for (const v of ['Auftraggeber', 'Muster Sanierung', 'Musterweg 3', 'Beispielgasse', 'Beispielort', '12-3456', '@']) assert.ok(!t.includes(v), v);
    assert.deepEqual(b.abschnitte.map(a => a.h), ['', 'Befunde', 'Schlussfolgerungen']);
    assert.ok(t.includes('weiterer Ortstermin'), 'die Einleitung bleibt');
  });
  await test('Fall = Projektordner mit allen Mitteilungen; englische Fassung nur im Verlauf', async () => {
    assert.deepEqual(FAELLE.map(f => f.kennung), ['26.0137', '25.0300', '25.0075', '24.0412', '24.0300', '23.0700', '23.0502'], 'neueste zuerst');
    const f = fall('24.0412');
    assert.deepEqual(f.berichte.map(b => b.datei), ['1. Mitteilung.docx', '1. Mitteilung_Englisch.docx', '2. Mitteilung.docx']);
    assert.deepEqual(f.deutsch.map(b => b.datei), ['1. Mitteilung.docx', '2. Mitteilung.docx']);
    assert.deepEqual(f.klassen, ['veranlassung', 'probenahme', 'befund', 'schluss', 'massnahmen', 'arbeitsschutz', 'weiteres']);
    assert.equal(K.sucheFaelle(FAELLE, { woerter: ['warehouse'] }).treffer.length, 0, 'englischer Text wird nicht durchsucht');
    for (const k of ['alles', ...f.klassen]) assert.ok(!K.bloecke(f, k).some(x => x.b.datei.includes('Englisch')), 'englischer Text in keinem Reiter');
    // Unterüberschrift „5.1 Wischproben“ bleibt im Befund; Betreffzeile „Brandschaden“ vor der 1. Überschrift ist kein Abschnitt
    assert.deepEqual(K.bloecke(f, 'befund').map(x => x.h), ['5. Befund', '5.1 Wischproben', 'Befunde']);
    assert.deepEqual(K.bloecke(f, 'weiteres').map(x => [x.b.datei, x.h, x.p.length]), [['2. Mitteilung.docx', '', 2]], 'nur die Einleitung der 2. Mitteilung');
    assert.deepEqual(K.bloecke(f, 'massnahmen').map(x => x.h), ['6. Sanierungsmaßnahmen']);
  });
  await test('„Was war“: Veranlassung, sonst Aufgabenstellung, sonst erster Textblock', async () => {
    assert.equal(fall('24.0412').wasWar.art, 'Veranlassung'); assert.match(fall('24.0412').wasWar.text, /^Am 02\.02\.2024 kam es in einer Lagerhalle/);
    assert.equal(fall('23.0700').wasWar.art, 'Aufgabenstellung'); assert.match(fall('23.0700').wasWar.text, /^Nach einem Rohrbruch/);
    assert.equal(fall('25.0075').wasWar.art, 'erster Textblock'); assert.match(fall('25.0075').wasWar.text, /^An der Rohrisolierung/);
    assert.equal(fall('26.0137').wasWar.art, 'erster Textblock');
    const lang = { pfad: '21.0001 X Tst/1. Mitteilung.docx', projekt: '21.0001 X Tst', datei: '1. Mitteilung.docx', jahr: 2021, pnr: 1, nr: 1,
      abschnitte: [{ h: '1. Veranlassung', p: ['Sehr geehrte Damen und Herren,', 'Probe · Ort', 'Erster Satz der Veranlassung mit etwas Länge. '.repeat(8).trim(), 'Zweiter Absatz. '.repeat(30).trim()] }] };
    const w = K.faelleBauen([lang])[0].wasWar.text;
    assert.ok(w.length <= 482 && w.startsWith('Erster Satz') && /\.( …)?$/.test(w), 'ohne Anrede und Tabellenzeile, am Satzende gekürzt');
  });
  await test('Gebäude-Ordner sind eigene Stränge; „Was war“ nennt den Strang', async () => {
    const f = fall('24.0300');
    assert.deepEqual(f.straenge.map(s => [s.name, s.berichte.length]), [['Altbau', 1], ['Neubau', 1]]);
    assert.deepEqual([f.wasWar.strang, f.wasWar.bericht, f.wasWar.art], ['Altbau', '1. Mitteilung', 'Veranlassung']);
    assert.equal(K.berichtBeschriftung(f, f.deutsch[1]), 'Neubau · 1. Mitteilung');
    assert.deepEqual(schilder(f), ['1 Materialprobe (Neubau · 1. Mitteilung)', 'Asbest']);
    assert.equal(f.ohne, false); assert.deepEqual(f.klassen, ['veranlassung', 'weiteres'], 'Neubau-Bericht ohne Überschriften steht unter „Weiteres“');
    // Gebäude im Dateinamen, Hauptstrang zuerst
    const e = (pfad, nr) => ({ pfad, projekt: '21.0002 Y Tst', datei: pfad.split('/').at(-1), jahr: 2021, pnr: 2, nr, abschnitte: [{ h: '1. Veranlassung', p: ['Text der Veranlassung in ausreichender Länge für die Karte.'] }] });
    const g = K.faelleBauen([e('21.0002 Y Tst/Mitteilungen/1. Mitteilung Gebäude B.docx', 1), e('21.0002 Y Tst/Mitteilungen/2. Mitteilung Gebäude A.docx', 2), e('21.0002 Y Tst/Mitteilungen/1. Mitteilung Gebäude A.docx', 1), e('21.0002 Y Tst/Mitteilungen/1. Mitteilung.docx', 1)])[0];
    assert.deepEqual(g.straenge.map(s => [s.name, s.berichte.map(b => b.nr)]), [['', [1]], ['Gebäude A', [1, 2]], ['Gebäude B', [1]]]);
    assert.equal(K.strangVon('21.0002 Y Tst/21.0002 Y Tst/1. Mitt/1. Mitteilung_korrigiert.docx', '21.0002 Y Tst').name, '', 'Mitteilungsordner, Projektkopie und Korrektur sind kein Strang');
    assert.equal(K.strangVon('21.0002 Y Tst/Mitteilungen/1. Mitteilung Geb. 2.docx', '21.0002 Y Tst').name, 'Geb. 2');
  });
  await test('Fall-Schildchen „Untersucht“: Zahlen aus der Probenahme, Parameter aus Probenahme und Befund, mit Fundstelle', async () => {
    const f = fall('24.0412');
    assert.deepEqual(schilder(f), ['12 Wischproben · Chlorid, Sulfat, Phosphat', '12 Wischproben · PAK', '1 Brandschuttmischprobe · DepV', '3 Materialproben · Brandgeruch', '6 Kontrollwischproben · Chlorid (2. Mitteilung)']);
    assert.deepEqual(Object.keys(f.params).sort(), ['chlorid', 'depv', 'geruch', 'pak', 'sap'], 'kein Asbest (nur gesehen / zu prüfen / Arbeitsschutz), keine Dioxine (verzichtet), kein KMF, kein Schimmel');
    // Fundstelle: Abschnitt und Absatz des Berichts
    const t = f.tags[2], teil = K.ableiten(t.b).teile.find(x => x.ai === t.ai);
    assert.equal(teil.h, '4. Probenahme'); assert.match(teil.p[t.pi], /Brandschuttmischprobe/);
    const t6 = f.tags[4]; assert.equal(t6.b.datei, '2. Mitteilung.docx'); assert.match(K.ableiten(t6.b).teile.find(x => x.ai === t6.ai).p[t6.pi], /sechs Kontrollwischproben/, 'Einleitung ohne Überschrift zählt');
    // andere Fälle
    assert.deepEqual(schilder(fall('26.0137')), ['2 Wasserproben · Fäkalkeime']);
    assert.deepEqual(schilder(fall('25.0300')), ['Phosphat']);
    assert.deepEqual(schilder(fall('23.0700')), ['Schimmel'], '„In zwei Materialproben“ ist keine Gesamtzahl; Asbest im Arbeitsschutz zählt nicht');
    assert.deepEqual(schilder(fall('23.0502')), ['1 Brandschuttmischprobe · DepV'], 'ohne Probenahme-Abschnitt: Zahl aus dem Befund (Unterabschnitt „3. Entsorgung“)');
    assert.deepEqual(schilder(fall('25.0075')), ['1 Materialprobe', 'Asbest'], 'Bericht ohne Überschriften: ganzer Text, gleiche Satzregel');
    assert.equal(fall('25.0075').ohne, true); assert.deepEqual(fall('25.0075').klassen, []);
  });
  await test('Index aus LexiKit 0.1.0: Kopfzeilen der zweiten Form und E-Mail-„Überschriften“ fallen beim Ableiten heraus', async () => {
    const alt = { pfad: '21.0003 Z Tst/Mitteilungen/1. Mitteilung.docx', projekt: '21.0003 Z Tst', datei: '1. Mitteilung.docx', jahr: 2021, pnr: 3, nr: 1, abschnitte: [
      { h: '', p: ['Wasserschaden', 'Auftraggeber: Muster Sanierung GmbH', 'Musterweg 3', '00000 Beispielort', 'Schadenort: Beispielgasse 9', '00000 Beispielort', 'Bestell-Nr.: 4711', 'Mit freundlichen Grüßen', 'max.muster@beispiel.example'] },
      { h: 'erika.beispiel@musterfirma.example', p: [] },
      { h: '1. Veranlassung', p: ['In der Küche trat Leitungswasser aus; der Estrich wurde durchfeuchtet.'] }] };
    const d = K.ableiten(alt);
    assert.deepEqual(d.teile.map(t => [t.k, t.h]), [['veranlassung', '1. Veranlassung']]);
    const f = K.faelleBauen([alt])[0]; assert.deepEqual(f.klassen, ['veranlassung']);
    assert.equal(K.sucheFaelle([f], { woerter: ['Beispielgasse'] }).treffer.length, 0); assert.equal(K.sucheFaelle([f], { woerter: ['Musterweg'] }).treffer.length, 0);
    assert.equal(K.sucheFaelle([f], { woerter: ['Estrich'] }).treffer.length, 1);
  });
  await test('Suche: Thema und eigene Wörter zusammen, Überschriften zählen nicht, Jahr, „Untersucht auf“', async () => {
    const LP = ['Löschpulver', 'ABC-Pulver', 'Pulverlöscher'], k = r => r.treffer.map(t => t.f.kennung);
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { thema: LP, woerter: ['Lagerhalle', 'Elektronik'] })), ['24.0412']);
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { thema: LP, woerter: ['Lagerhalle'] })), ['24.0412', '23.0700']);
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { thema: LP, woerter: ['Lagerhalle', 'Kellerassel'] })), [], 'jedes eigene Wort muss vorkommen');
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { woerter: ['schaltschränke'] })), ['24.0412'], 'Groß/Klein egal, Wort aus der 2. Mitteilung');
    assert.equal(K.sucheFaelle(FAELLE, { woerter: ['Schlussfolgerungen'] }).treffer.length, 0, 'nur in Überschriften → kein Fall');
    assert.equal(K.sucheFaelle(FAELLE, { woerter: ['Arbeitsschutzmaßnahmen'] }).treffer.length, 0);
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { thema: LP, jahr: 2025 })), ['25.0300']);
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { parameter: ['sap'] })), ['25.0300', '24.0412'], 'ohne Begriffe: neueste zuerst');
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { parameter: ['sap', 'chlorid'] })), ['24.0412'], 'mehrere Filter: alle');
    assert.deepEqual(k(K.sucheFaelle(FAELLE, { thema: ['Asbest'], parameter: ['asbest'] })), ['25.0075', '24.0300']);
    assert.equal(K.zaehleFaelle(FAELLE, LP), 3); assert.equal(K.zaehleFaelle(FAELLE, ['Asbest']), 4); assert.equal(K.zaehleFaelle(FAELLE, []), 0);
  });
  await test('Rangfolge: Fund in Veranlassung/Aufgabenstellung zuerst, nur Arbeitsschutz zuletzt, sonst neueste zuerst', async () => {
    const r = K.sucheFaelle(FAELLE, { thema: ['Löschpulver', 'ABC-Pulver', 'Pulverlöscher'] });
    assert.deepEqual(r.treffer.map(t => [t.f.kennung, t.rang, t.nurAS]), [['24.0412', 1, false], ['25.0300', 0, false], ['23.0700', 0, true]],
      'Veranlassung (2024) vor Befund (2025, neuer); Fall nur mit Fund im Arbeitsschutz am Ende');
    assert.deepEqual([...r.treffer[0].orte].sort(), ['massnahmen', 'veranlassung']);
    // Aufgabenstellung zählt wie Veranlassung; zwei Begriffe in der Veranlassung vor einem
    const r2 = K.sucheFaelle(FAELLE, { woerter: ['Lagerhalle'] });
    assert.deepEqual(r2.treffer.map(t => [t.f.kennung, t.rang]), [['24.0412', 1], ['23.0700', 1]]);
    const r3 = K.sucheFaelle(FAELLE, { thema: ['Schimmel'], woerter: ['Lagerhalle'] });
    assert.deepEqual(r3.treffer.map(t => [t.f.kennung, t.rang]), [['24.0412', 1], ['23.0700', 1]], 'gleicher Rang: neueste zuerst');
    assert.equal(r3.treffer[0].nurAS, false, '„Schimmel“ steht dort nur im Arbeitsschutz, „Lagerhalle“ aber in der Veranlassung');
    // Fall ohne Veranlassung: der „Was war“-Text zählt ersatzweise
    const r4 = K.sucheFaelle(FAELLE, { woerter: ['Rohrisolierung'] }); assert.deepEqual(r4.treffer.map(t => [t.f.kennung, t.rang]), [['25.0075', 1], ['24.0300', 0]], '24.0300 hat eine Veranlassung – dort steht das Wort nicht');
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
  await test('Themenliste (Fassung 2): zwei Gruppen, ändern, löschen bleibt gelöscht, Konflikt wird erkannt', async () => {
    const t0 = K.ersteThemen('2026-11-13T09:00');
    assert.equal(t0.version, 2);
    assert.deepEqual(t0.themen.filter(t => K.gruppeVon(t) === 'thema').map(t => t.name), ['Löschpulver', 'Löschmittel', 'Löschwasser', 'Brandschutt', 'Entsorgungswege', 'Abfallschlüssel', 'Asbest', 'Schimmel', 'Fäkalkeime']);
    assert.deepEqual(t0.themen.filter(t => K.gruppeVon(t) === 'fall').map(t => t.name), ['Photovoltaik', 'Lithium-Akku', 'Tiefgarage', 'Warenvorräte', 'Kühlhaus', 'Technische Einrichtung']);
    assert.ok(!K.ERSTE_FAELLE.flat(2).some(w => /^waren$/i.test(w)), '„Waren“ allein träfe das Verb');
    assert.deepEqual(K.themaWoerter(t0.themen[8]), ['Fäkalkeime', 'E. coli', 'Escherichia coli', 'coliforme', 'Enterokokken']);
    const id = K.neueThemaId(t0, 'Serverraum');
    let r = K.themaEinspielen(t0, { id, name: ' Serverraum ', woerter: ['Rechenzentrum', ' '], gruppe: 'fall', geaendert: '2026-11-13T10:00', basis: '' });
    const t1 = r.themen; assert.deepEqual(t1.themen.at(-1), { id, name: 'Serverraum', woerter: ['Rechenzentrum'], geaendert: '2026-11-13T10:00', gruppe: 'fall' });
    // anderer PC hat Asbest geändert, ich will mit altem Stand ändern → Konflikt; die Gruppe bleibt ohne Angabe erhalten
    const asb = t1.themen.find(t => t.name === 'Asbest');
    const anders = K.themaEinspielen(t1, { id: asb.id, name: 'Asbest', woerter: ['Chrysotil'], geaendert: '2026-11-13T11:00', basis: asb.geaendert }).themen;
    assert.equal(anders.themen.find(t => t.id === asb.id).gruppe, 'thema');
    r = K.themaEinspielen(anders, { id: asb.id, name: 'Asbest', woerter: ['Amphibol'], geaendert: '2026-11-13T11:05', basis: asb.geaendert });
    assert.ok(r.konflikt && r.konflikt.woerter[0] === 'Chrysotil');
    r = K.themaEinspielen(anders, { id, name: 'Serverraum', geloescht: true, geaendert: '2026-11-13T12:00', basis: '2026-11-13T10:00' });
    assert.equal(r.themen.themen.find(t => t.id === id).geloescht, true, 'gelöscht bleibt als Vermerk');
    assert.notEqual(K.neueThemaId(r.themen, 'Serverraum'), id, 'neues Thema mit gleichem Namen bekommt eine neue id');
    assert.ok(K.themenLesen('nicht json').kaputt); assert.equal(K.themenLesen(''), null);
  });
  await test('Themenliste aus 0.1.0 (Fassung 1) wird gehoben, nichts geht verloren; 0.1.0 fasst Fassung 2 nicht an', async () => {
    // so hat LexiKit 0.1.0 geschrieben: Fassung 1, ohne Gruppe – mit einem Thema des Büros, einem geänderten und einem gelöschten
    const v1 = { format: 'lexikit-themen', version: 1, themen: [
      { id: 't-asbest', name: 'Asbest', woerter: ['Chrysotil'], geaendert: '2026-11-12T08:00' },
      { id: 't-estrich', name: 'Estrich', woerter: ['Trittschall'], geaendert: '2026-11-12T09:00' },
      { id: 't-schimmel', name: 'Schimmel', woerter: [], geaendert: '2026-11-12T10:00', geloescht: true },
      { id: 't-kühlhaus', name: 'Kühlhaus', woerter: ['Kühlzelle Büro'], geaendert: '2026-11-12T11:00' }] };   // das Büro hatte „Kühlhaus“ schon selbst angelegt
    const gelesen = K.themenLesen(JSON.stringify(v1)); assert.ok(!gelesen.kaputt, '0.2.0 liest Fassung 1');
    const v2 = K.themenHeben(gelesen);
    assert.equal(v2.version, 2);
    assert.deepEqual(v2.themen.slice(0, 4), v1.themen, 'alle Themen des Büros unverändert, auch der Lösch-Vermerk');
    assert.deepEqual(v2.themen.slice(4).map(t => [t.name, t.gruppe, t.geaendert]), [['Photovoltaik', 'fall', ''], ['Lithium-Akku', 'fall', ''], ['Tiefgarage', 'fall', ''], ['Warenvorräte', 'fall', ''], ['Technische Einrichtung', 'fall', '']], 'fünf neue – „Kühlhaus“ gab es schon');
    assert.equal(K.gruppeVon(v2.themen[3]), 'thema', 'das eigene „Kühlhaus“ des Büros bleibt, wo es war');
    assert.deepEqual(K.themenHeben(v2), v2, 'noch einmal heben ändert nichts'); assert.deepEqual(K.themenHeben(JSON.parse(JSON.stringify(v1))), v2, 'zwei PCs schreiben dasselbe');
    assert.equal(v1.version, 1, 'Eingabe unverändert');
    // wer mit 0.2.0 ein Thema speichert, schreibt Fassung 2
    const r = K.themaEinspielen(gelesen, { id: 't-estrich', name: 'Estrich', woerter: ['Trittschall', 'Zementestrich'], geaendert: '2026-11-13T12:00', basis: '2026-11-12T09:00' });
    assert.equal(r.themen.version, 2); assert.equal(r.themen.themen.length, 9);
    // LexiKit 0.1.0 prüft „version > 1“ → neuere Fassung → schreibt nicht. Dieselbe Regel gilt in 0.2.0 für Fassung 3.
    assert.ok(v2.version > 1); assert.ok(K.themenLesen(JSON.stringify(Object.assign({}, v2, { version: 3 }))).neuer);
  });
  await test('Der Index bleibt Fassung 1: 0.2.0 liest und schreibt dasselbe Format wie 0.1.0', async () => {
    assert.equal(K.VERSION, 1);
    const wie010 = JSON.stringify({ format: 'lexikit-index', version: 1, jahr: 2024, geaendert: '2026-11-13T10:00', berichte: { [eintraege[0].pfad]: Object.assign({ stempel: { groesse: 1, geaendert: 1 }, gelesenAm: '2026-11-13T10:00' }, eintraege[0]) } });
    const idx = K.indexLesen(wie010, 2024); assert.ok(!idx.kaputt);
    const f = K.faelleBauen(Object.values(idx.berichte))[0];
    assert.equal(f.kennung, '24.0412'); assert.ok(f.tags.length >= 4, 'Fall direkt aus dem alten Index');
    const neu = K.indexMergen(idx, { neu: {}, weg: [] }, '2026-11-13T12:00');
    assert.equal(neu.version, 1);
    const text = JSON.stringify(neu, (k, v) => k[0] === '_' ? undefined : v);
    assert.ok(!text.includes('_d') && !text.includes('"kl"'), 'Abgeleitetes wird nicht gespeichert');
    assert.deepEqual(Object.keys(JSON.parse(text).berichte[eintraege[0].pfad]).sort(), ['abschnitte', 'datei', 'form', 'gelesenAm', 'jahr', 'nr', 'pfad', 'pnr', 'projekt', 'stempel'], 'dieselben Felder wie in 0.1.0');
  });
  console.log(`\nKern: ${n} Prüfungen bestanden`);
})().catch(e => { console.error(e); process.exit(1); });
