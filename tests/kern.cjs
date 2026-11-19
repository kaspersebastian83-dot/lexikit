// LexiKit-Kern ohne Browser: Word lesen (nur Text, Fotos nie), Abschnitte, Berichtskopf weg, Berichte auswählen,
// Fälle (Abschnittsklassen, Stränge, „Was war“, „Untersucht“), Suche und Rangfolge, Markierung, Zusammenführen der gemeinsamen
// Dateien (Index Fassung 1 unverändert, Themenliste Fassung 2), ab 0.4.0 Absätze, Familien, Zähler, Markierungen. node tests/kern.cjs
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
    assert.deepEqual(ids('Es wurden dreizehn Abklatschproben entnommen und auf Enterobakterien untersucht.'), ['faekal'], 'Enterobakterien sind Fäkalkeime, nicht „Bakterien“ allgemein');
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
    assert.deepEqual(ids('Die 300 KBE/m³ betreffen sonstige Bakterien.'), ['bakterien'], '„KBE“ allein ist kein Schimmel');
    assert.deepEqual(ids('Die Proben wurden auf Schimmelpilze und Bakterien untersucht.'), ['schimmel', 'bakterien']);
    assert.deepEqual(ids('Die bakterielle Belastung der Materialprobe war gering.'), ['bakterien']);
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
    assert.deepEqual(f.klassen, ['veranlassung', 'probenahme', 'befund', 'schluss', 'massnahmen', 'arbeitsschutz'], 'kein „Weiteres“');
    assert.equal(K.sucheFaelle(FAELLE, { woerter: ['warehouse'] }).treffer.length, 0, 'englischer Text wird nicht durchsucht');
    for (const k of ['alles', ...f.klassen]) assert.ok(!K.bloecke(f, k).some(x => x.b.datei.includes('Englisch')), 'englischer Text in keinem Reiter');
    // Unterüberschrift „5.1 Wischproben“ bleibt im Befund; Betreffzeile „Brandschaden“ vor der 1. Überschrift ist kein Abschnitt
    assert.deepEqual(K.bloecke(f, 'befund').map(x => x.h), ['5. Befund', '5.1 Wischproben', 'Befunde']);
    // Einleitung ohne Überschrift der 2. Mitteilung steht unter „Veranlassung“
    assert.deepEqual(K.bloecke(f, 'veranlassung').map(x => [x.b.datei, x.h, x.p.length]), [['1. Mitteilung.docx', '1. Veranlassung', 1], ['1. Mitteilung.docx', '2. Aufgabenstellung', 1], ['2. Mitteilung.docx', '', 2]]);
    assert.deepEqual(K.bloecke(f, 'weiteres'), []);
    assert.deepEqual(K.bloecke(f, 'massnahmen').map(x => x.h), ['6. Sanierungsmaßnahmen']);
  });
  await test('„Was war“: Veranlassung, sonst Aufgabenstellung, sonst erster Textblock', async () => {
    assert.equal(fall('24.0412').wasWar.art, 'Veranlassung'); assert.match(fall('24.0412').wasWar.text, /^Am 02\.02\.2024 kam es in einer Lagerhalle/);
    assert.equal(fall('23.0700').wasWar.art, 'Aufgabenstellung'); assert.match(fall('23.0700').wasWar.text, /^Nach einem Rohrbruch/);
    assert.equal(fall('25.0075').wasWar.art, 'erster Textblock'); assert.match(fall('25.0075').wasWar.text, /^An der Rohrisolierung/);
    assert.equal(fall('26.0137').wasWar.art, 'erster Textblock');
    // Bericht, der mit einer Einleitung ohne Überschrift beginnt: sie ist der erste Textblock, steht unter „Veranlassung“ und zählt in der Rangfolge so
    const kurz = (pfad, p0, rest) => ({ pfad, projekt: pfad.split('/')[0], datei: '1. Mitteilung.docx', jahr: 2021, pnr: +pfad.slice(3, 7), nr: 1, abschnitte: [{ h: '', p: p0 }, ...rest] });
    const k1 = K.faelleBauen([kurz('21.0010 K Tst/1. Mitteilung.docx', ['Wasserschaden', 'Am 03.03.2021 fand im Kellerraum ein weiterer Ortstermin statt; dabei wurde die Kellerassel-Falle geprüft.'], [{ h: 'Befunde', p: ['Der Estrich war trocken.'] }])])[0];
    assert.deepEqual([k1.wasWar.art, k1.klassen], ['erster Textblock', ['veranlassung', 'befund']]); assert.match(k1.wasWar.text, /^Wasserschaden Am 03\.03\.2021|^Am 03\.03\.2021/);
    assert.equal(K.sucheFaelle([k1], { woerter: ['Kellerassel'] }).treffer[0].rang, 1);
    // … aber eine Veranlassung mit Überschrift geht vor (z. B. nach einem Satz aus dem Anschreiben)
    const k2 = K.faelleBauen([kurz('21.0011 K Tst/1. Mitteilung.docx', ['als Anlage übersende ich Ihnen meinen Sanierungsvorschlag zu dem oben genannten Schaden'], [{ h: '1. Veranlassung', p: ['In der Werkstatt kam es zu einem Schwelbrand an einer Ladestation.'] }])])[0];
    assert.match(k2.wasWar.text, /^In der Werkstatt/); assert.equal(k2.wasWar.art, 'Veranlassung');
    // Bericht mit Überschriften, aber keiner bekannten: bleibt ganz unter „Weiteres“
    const k3 = K.faelleBauen([kurz('21.0012 K Tst/1. Mitteilung.docx', ['Eine Einleitung, die lang genug ist, um als Text zu zählen, steht hier.'], [{ h: 'Anhang', p: ['Text im Anhang.'] }])])[0];
    assert.deepEqual(k3.klassen, ['weiteres']);
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
    const t6 = f.tags[4], teil6 = K.ableiten(t6.b).teile.find(x => x.ai === t6.ai);
    assert.equal(t6.b.datei, '2. Mitteilung.docx'); assert.match(teil6.p[t6.pi], /sechs Kontrollwischproben/, 'Einleitung ohne Überschrift zählt');
    assert.deepEqual([teil6.k, teil6.h, teil6.vor], ['veranlassung', '', true]);
    // … eine Veranlassung mit Überschrift dagegen nicht: „Untersucht“ sucht dort nicht
    const nurV = K.faelleBauen([{ pfad: '21.0020 V Tst/1. Mitteilung.docx', projekt: '21.0020 V Tst', datei: '1. Mitteilung.docx', jahr: 2021, pnr: 20, nr: 1,
      abschnitte: [{ h: '1. Veranlassung', p: ['Wir wurden beauftragt, zwölf Wischproben auf PAK zu untersuchen.'] }, { h: '2. Befund', p: ['Die Flächen waren sichtbar verrußt.'] }] }])[0];
    assert.deepEqual(schilder(nurV), []);
    // andere Fälle
    assert.deepEqual(schilder(fall('26.0137')), ['2 Wasserproben · Fäkalkeime', 'Bakterien']);
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

  /* ---------- ab 0.3.0: „Für ChatGPT kopieren“ ---------- */
  const { KOPIE, KOPIE_ORDNER: KO } = require('./daten/berichte.cjs');
  const leseKopie = async k => { const buf = docx(KOPIE[k]); return K.docxLesen(async (a, e) => new Uint8Array(buf.subarray(a, e)), buf.length, inflate, { kopf: true }); };
  const kEintrag = async (k, projekt, rel, nr) => { const r = await leseKopie(k); return { b: { pfad: projekt + '/' + rel, projekt, datei: rel.split('/').pop(), jahr: 2000 + +projekt.slice(0, 2), pnr: 1, nr, form: r.form, abschnitte: r.abschnitte }, r }; };
  const kopieFaelle = async () => {
    const xs = [await kEintrag('a1', KO.a, 'Mitteilungen/1. Mitteilung.docx', 1), await kEintrag('a1en', KO.a, 'Mitteilungen/1. Mitteilung_Englisch.docx', 1),
      await kEintrag('a1erg', KO.a, 'Mitteilungen/1. Mitteilung Ergänzung.docx', 1), await kEintrag('a2', KO.a, 'Mitteilungen/2. Mitteilung.docx', 2),
      await kEintrag('b1', KO.b, 'Beispielstraße 5/1. Mitteilung.docx', 1), await kEintrag('b2', KO.b, 'Neubau/1. Mitteilung.docx', 1),
      await kEintrag('c1', KO.c, 'Mitteilungen/1. Mitteilung.docx', 1)];
    return K.faelleBauen(xs.map(x => x.b)).map(f => ({ f, berichte: f.deutsch.map(b => ({ b, frisch: xs.find(x => x.b === b).r, gewaehlt: true })) }));
  };
  const FW = K.fachwoerter(K.ersteThemen('').themen);
  const alleKlassen = ['veranlassung', 'probenahme', 'befund', 'schluss', 'massnahmen', 'arbeitsschutz', 'weiteres'];
  const auszuege = t => t.split('--- Auszüge ---')[1];

  await test('Berichtskopf beim Kopieren: beide Kopf-Formen, Tabelle, Fortsetzungszeilen – nur für die Kopie', async () => {
    const a1 = await leseKopie('a1');
    assert.deepEqual(a1.kopf.map(k => [k.key, k.zeilen.map(z => z.t)]), [['VN', ['Herr Konrad Probemann-Lindtal']], ['Risikoort', ['Backstube, Hauptstraße 12 a', '52999 Probehausen']],
      ['Versicherer', ['Beispiel Versicherung AG']], ['Schaden-Nr.', ['77-123 456/24']], ['VS-Nr.', ['KV 9988776', 'Brandschaden']]]);
    assert.deepEqual((await leseKopie('a2')).kopf.map(k => [k.key, k.zeilen.map(z => z.t)]), [['Auftraggeber', ['Schimmel Sanierungstechnik GmbH', 'Musterweg 3', '52999 Probehausen']], ['Schadenort', ['Hauptstraße 12a']], ['Az.', ['12-3456']]]);
    assert.deepEqual((await lesen(BERICHTE.ohneMarke)).b.kopf, undefined, 'ohne opt.kopf kein Kopf – der Index bekommt ihn nie');
    const tab = await K.docxLesen(async (a, e) => new Uint8Array(docx(BERICHTE.ohneMarke).subarray(a, e)), docx(BERICHTE.ohneMarke).length, inflate, { kopf: true });
    assert.deepEqual(tab.kopf.map(k => [k.key, k.zeilen.map(z => z.t)]), [['VN', ['Max Beispielmensch']], ['Schaden-Nr.', ['AB-1']]], 'Kopf als Tabelle');
    assert.deepEqual((await leseKopie('d1')).kopf, [], 'kein Kopf erkannt');
  });
  await test('Projektordner: Wörter ohne Nummer und ohne Kürzel am Ende', async () => {
    assert.equal(K.ordnerWoerter('25.0815 Musterbäckerei Probehausen Tst'), 'Musterbäckerei Probehausen');
    assert.equal(K.ordnerWoerter('24.0777 Beispielstraße 5 Musterort Dr. Ka'), 'Beispielstraße 5 Musterort');
    assert.equal(K.ordnerWoerter('23.0450 Kurzweg Prüfstadt Ben Luc'), 'Kurzweg Prüfstadt');
    assert.equal(K.ordnerWoerter('22.00999 Ohnekopf Teststadt (Ric)'), 'Ohnekopf Teststadt');
  });
  await test('Kopie: nie kopierte Abschnitte fehlen – auch wenn alles angehakt und jede Klasse verlangt ist', async () => {
    const k = K.kopieBauen({ faelle: await kopieFaelle(), klassen: alleKlassen, untersucht: true, frage: 'Wie?', fachwoerter: FW });
    for (const m of ['VERANLASSUNGSMARKE', 'AUFGABENMARKE', 'ORTSTERMINMARKE', 'EINLEITUNGSMARKE', 'EINLEITUNG2MARKE', 'ENGLISCHMARKE', 'WEITERESMARKE', 'OHNEMARKE'])
      assert.ok(!k.text.includes(m), m + ' darf nicht in die Kopie');
    // Vor jedem Auszug nur Projektnummer, Gebäude als Nummer, Mitteilung, Abschnitt
    const labels = auszuege(k.text).split('\n').filter(z => z.startsWith('['));
    for (const l of labels) assert.match(l, /^\[\d{2}\.\d{3,5}(?: · Gebäude \d)?(?: · Untersucht| · \d+\. Mitteilung(?: Ergänzung)? · (?:Befund|Schlussfolgerungen|Maßnahmen|Arbeitsschutz))\]$/, l);
    assert.deepEqual(labels, ['[25.0815 · Untersucht]', '[25.0815 · 1. Mitteilung · Befund]', '[25.0815 · 1. Mitteilung · Schlussfolgerungen]', '[25.0815 · 1. Mitteilung · Maßnahmen]',
      '[25.0815 · 1. Mitteilung · Arbeitsschutz]', '[25.0815 · 2. Mitteilung · Befund]', '[25.0815 · 2. Mitteilung · Schlussfolgerungen]',
      '[24.0777 · Gebäude 1 · 1. Mitteilung · Befund]', '[24.0777 · Gebäude 1 · 1. Mitteilung · Maßnahmen]', '[24.0777 · Gebäude 2 · 1. Mitteilung · Befund]', '[23.0450 · Untersucht]']);
    assert.match(k.text, /\[23\.0450 · Untersucht\]\n2 Materialproben · Asbest$/, 'Bericht ohne Überschriften: nur die Zeile „Untersucht“');
    for (const ordner of Object.values(KO)) assert.ok(!k.text.includes(ordner.slice(8)), 'kein Ordnername: ' + ordner);
    assert.ok(!k.text.includes('Neubau]') && !k.text.includes('· Neubau'), 'Gebäude-Ordner nur als Nummer');
    assert.equal(k.faelle, 3); assert.equal(k.abschnitte, 9);
    // nur Befund + Sanierungsmaßnahmen, ohne „Untersucht“
    const k2 = K.kopieBauen({ faelle: await kopieFaelle(), klassen: ['befund', 'massnahmen'], untersucht: false, frage: 'Wie?', fachwoerter: FW });
    assert.ok(!/Schlussfolgerungen\]|Arbeitsschutz\]|Untersucht\]/.test(k2.text)); assert.equal(k2.faelle, 2, 'Fall ohne Überschriften fällt ohne „Untersucht“ ganz weg');
    assert.ok(k.text.startsWith(K.PROMPT.replace('<Frage>', 'Wie?')), 'Prompt aus dem Stufe-2-Plan, dann die Frage');
  });
  await test('Kopie: Kopfwerte und Ordnerwörter werden nach Namensteilen ersetzt, nur als ganzes Wort', async () => {
    const k = K.kopieBauen({ faelle: await kopieFaelle(), klassen: K.KOPIER_KLASSEN, untersucht: true, frage: 'Wie?', fachwoerter: FW });
    const t = auszuege(k.text);
    for (const v of ['Probemann', 'Lindtal', 'Konrad', 'Hauptstr', 'Hauptstraße', 'Probehausen', 'Musterbäckerei', '9988776', '77 123 456', '77-123', 'Beispiel Versicherung',
      '12-3456', 'Sanierungstechnik', 'Feldmohn', 'Beispielstraße', 'Musterort', 'Kurzweg', ' 52999'])
      assert.ok(!t.includes(v), `„${v}“ steht noch in der Kopie`);
    for (const v of ['Herrn [VN] ([Risikoort])', 'Die [VN] hatten', '; [VN] bestätigte', 'Schaden [Schaden-Nr.] ist bei der [Versicherer] Versicherung', 'Vertrag [VS-Nr.]', 'Auftrag [Az.]',
      'W1 · [Projekt] [Risikoort] · 14', 'Frau Dr. [VN] ist', 'in [Risikoort] ist trocken', 'Im Gebäude [Risikoort] wurde', 'Frau [VN] war'])
      assert.ok(t.includes(v), 'erwartet: ' + v);
    // Laborproben-Nummern bleiben – auch wenn die PLZ darin steckt; Kürzel und KG (Kellergeschoss) bleiben
    for (const v of ['Labornummer 925-2025-00052999', 'Die Probe 24-123456 aus dem KG', 'Chlorid (Tst).', 'Telefonische Rückfrage unter 02405 123456.']) assert.ok(t.includes(v), 'bleibt: ' + v);
    assert.equal(k.ersetzt, (t.match(/\[(?:VN|Risikoort|Versicherer|Schaden-Nr\.|VS-Nr\.|Auftraggeber|Schadenort|Az\.|Projekt)\]/g) || []).length, 'Zahl der ersetzten Namen = Platzhalter im Text');
  });
  await test('Kopie: verdächtige Stellen – Mitarbeiter mit Herr/Frau im Befund, Telefon, Firma, E-Mail, Straße, Kopfwort = Themenwort', async () => {
    const f = await kopieFaelle(), basis = { faelle: f, klassen: K.KOPIER_KLASSEN, untersucht: true, frage: 'Wie?', fachwoerter: FW };
    const k = K.kopieBauen(basis);
    assert.deepEqual(k.stellen.map(s => [s.art, s.t]), [['anrede', 'Herrn Probenehmer'], ['telefon', '02405 123456'], ['firma', 'Firma Kältebau Nord GmbH'],
      ['email', 'info@musterbaeckerei.example'], ['strasse', 'Beispielallee 4'], ['kopf', 'Schimmel'], ['kopf', 'Schimmel']]);
    assert.equal(k.stellen[0].wo, '25.0815 · 1. Mitteilung · Befund', 'Mitarbeitername mit „Herrn“ im Befund wird gefunden');
    assert.ok(!k.stellen.some(s => /Eurofins|KG$|925-2025|24-123456/.test(s.t)), 'keine Stelle: Labor, KG, Laborproben-Nummern');
    // Regel 4: „Schimmel“ ist ein Thema – das Kopfwort wird nicht ersetzt, sondern markiert; „Sanierungstechnik“ ist keines → ersetzt
    assert.ok(auszuege(k.text).includes('Die Kontrollwischproben der Schimmel [Auftraggeber] waren'));
    assert.equal(k.offen, 7);
    // Satz entfernen und „ist kein Name“
    const entfernt = new Set(k.stellen.filter(s => s.art !== 'kopf').map(s => s.satz)), ok = new Set(['schimmel']);
    const k2 = K.kopieBauen(Object.assign({}, basis, { entfernt, ok }));
    assert.equal(k2.offen, 0); assert.equal(k2.entfernt, 4, 'E-Mail und Straße stehen im selben Satz');
    for (const v of ['Probenehmer', '02405', 'Kältebau', 'info@', 'Beispielallee']) assert.ok(!k2.text.includes(v), 'entfernt: ' + v);
    assert.ok(k2.text.includes('Schimmel wurde in keiner Probe nachgewiesen.'), 'bestätigt, bleibt stehen');
    assert.ok(k2.text.includes('Die Probe 24-123456 aus dem KG'), 'nur die Sätze mit Stellen fallen weg');
    // die eigene Frage wird geprüft, aber nicht ersetzt und nicht entfernt
    const k3 = K.kopieBauen(Object.assign({}, basis, { entfernt, ok, frage: 'Passt das auf den Fall von Herrn Meier?', meinFall: 'Bäckerei, Tel. 0241 998877' }));
    assert.deepEqual(k3.stellen.filter(s => s.offen).map(s => [s.art, s.t, s.entfernbar]), [['anrede', 'Herrn Meier', false], ['telefon', 'Tel. 0241 998877', false]]);
    assert.ok(k3.text.includes('Meine Frage: Passt das auf den Fall von Herrn Meier?\nMein Fall: Bäckerei, Tel. 0241 998877\n\n--- Auszüge ---'));
  });
  await test('Keine Stelle: Laborproben-Nummern, Labore und Verbände (Fehlalarme aus der Prüfung an echten Berichten)', async () => {
    const t = 'In den Proben (22W09435-001 und 002) sowie 05408-003 wurde Asbest nachgewiesen. Anlage: Ergebnisse (Labor Urbanus GmbH), Untersuchungsbericht (Umweltmykologie GmbH), '
      + 'Prüfbericht (eco-Luftqualität + Raumklima GmbH). Gesamtverband der deutschen Versicherungswirtschaft e. V. (GDV); Deutsche Gesetzliche Unfallversicherung e.V. (DGUV).';
    assert.deepEqual(K.stellenIn(t, []), []);
    assert.deepEqual(K.stellenIn('Rückruf unter 0241 1234 oder (02405) 12 34 56, Fax 02405-998877.', []).map(s => s.t), ['0241 1234', '(02405) 12 34 56', 'Fax 02405-998877'], 'echte Telefonnummern bleiben Stellen');
  });
  await test('Kopfwort-Regel: Parameter-, Themen- und Abschnittswörter werden markiert, alle anderen ersetzt', async () => {
    const kopf = [{ key: 'VN', art: 'name', zeilen: [{ t: 'Max Brand und Erika Keller' }] }];
    const E = K.ersetzerBauen([kopf], [], FW);
    assert.deepEqual(E.kollisionen.map(k => k.wort), ['Brand'], '„Brand“ steckt in „Brandgeruch“/„Brandschutt“');
    // „Keller“ ist weder Parameter- noch Themenwort → wird ersetzt, auch „im Keller“ (Grenze der Regel; siehe Stand)
    assert.equal(K.ersetzen('Im Keller von Max Keller roch es nach Brand.', E).t, 'Im [VN] von [VN] roch es nach Brand.');
    assert.deepEqual(K.stellenIn('Der Brand bei [VN].', E.kollisionen).map(s => s.t), ['Brand']);
    assert.equal(K.ersetzen('der kleine keller', E).t, 'der kleine keller', 'klein geschrieben bleibt');
  });
  await test('Erzeugte Fälle: 300 erfundene Köpfe, Kopfwerte in vielen Schreibweisen – nichts bleibt stehen', async () => {
    let s = 7; const zz = n => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
    const sil = ['bra', 'kel', 'mor', 'tan', 'vil', 'gru', 'sen', 'dor', 'lim', 'wes', 'rup', 'hag', 'nol', 'fie', 'zan', 'bek'];
    const wort = (n = 2) => { let w = ''; for (let i = 0; i < n + zz(2); i++) w += sil[zz(sil.length)]; return w[0].toUpperCase() + w.slice(1); };
    const STR = ['straße', 'weg', 'allee', 'gasse', 'ring'], ORT = ['hausen', 'dorf', 'heim', 'berg'];
    let lecks = 0, faelle = 0, spot = 0;
    for (let i = 0; i < 300; i++) {
      const vor = wort(1), nach = wort(2), nach2 = wort(2), str = wort(2) + STR[zz(STR.length)], hnr = 1 + zz(80), plz = String(10000 + zz(89999)), ort = wort(2) + ORT[zz(ORT.length)];
      const vers = wort(2), sn = `${10 + zz(89)}-${100 + zz(899)} ${100 + zz(899)}/${20 + zz(7)}`, doppel = zz(2);
      const kopf = [{ key: 'VN', art: 'name', zeilen: [{ t: `${zz(2) ? 'Herr ' : ''}${vor} ${nach}${doppel ? '-' + nach2 : ''}` }] },
        { key: 'Risikoort', art: 'adresse', zeilen: [{ t: `Wohnhaus, ${str} ${hnr}` }, { t: `${plz} ${ort}`, tab: true }] },
        { key: 'Versicherer', art: 'name', zeilen: [{ t: `${vers} Versicherung AG` }] }, { key: 'Schaden-Nr.', art: 'nummer', zeilen: [{ t: sn }] }];
      const kurz = str.replace(/straße$/, 'str.');
      const text = [`Bei ${vor} ${nach} wurde gemessen.`, `In ${nach}s Keller lag Ruß.`, `Herrn ${nach} war nicht da.`, `Adresse ${str} ${hnr}, ${plz} ${ort}.`, `Auch ${kurz} ${hnr}a war betroffen.`,
        `Die Feuerwehr aus ${ort} half.`, `Schaden ${sn.replace(/[-/]/g, ' ')} bei der ${vers}.`, `Nummer ${sn.replace(/\s/g, '')} gemeldet.`, doppel ? `${nach2}-${nach} und ${nach2} waren dort.` : 'Sonst nichts.'].join(' ');
      const E = K.ersetzerBauen([kopf], [], FW), r = K.ersetzen(text, E), st = K.stellenIn(r.t, E.kollisionen).map(x => x.t);
      faelle++;
      for (const v of [vor, nach, doppel ? nach2 : null, str.replace(/straße$/, ''), ort, plz, vers, sn, sn.replace(/[-/]/g, ' '), sn.replace(/\s/g, '')].filter(Boolean)) {
        if (!r.t.includes(v)) continue;
        if (st.some(x => x.includes(v))) { spot++; continue; }   // Kollision mit einem Fachwort: markiert statt ersetzt
        lecks++; console.log('  Leck:', v, '→', r.t);
      }
    }
    assert.equal(lecks, 0, `${lecks} Kopfwerte in ${faelle} erzeugten Fällen nicht ersetzt`);
    console.log(`  ${faelle} erzeugte Fälle, 0 Lecks, ${spot} Kopfwörter als Stelle markiert statt ersetzt`);
  });

  /* ---------- ab 0.4.0: „So machen wir es meist“ und „Unsere Absätze“ ---------- */
  const D = require('./daten/berichte.cjs'), AB = D.ABSATZ;
  const absFaelle = async () => {
    const berichte = [];
    for (const [k, o] of Object.entries(D.ABS_ORDNER)) {
      const buf = D.docx(D.ABS_BERICHTE[k]), b = await K.docxLesen(async (a, e) => new Uint8Array(buf.subarray(a, e)), buf.length, inflate), p = K.projektOrdner(o);
      berichte.push({ pfad: o + '/Mitteilungen/1. Mitteilung.docx', projekt: o, datei: '1. Mitteilung.docx', jahr: p.jahr, pnr: p.nr, nr: 1, form: b.form, abschnitte: b.abschnitte });
    }
    return K.faelleBauen(berichte);
  };
  const name = F => Object.keys(AB).find(k => AB[k] === F.neu.p);
  const fam = E => E.familien.filter(f => f.k === 'massnahmen').map(f => f.mitglieder.map(name).join('+')).sort();
  await test('Fassung: Zahlen, Proben-/Labornummern, Straße + Nummer, PLZ + Ort, Groß/Klein, Satzzeichen werden angeglichen', async () => {
    const w = t => K.absatzWoerter(t).join(' ');
    assert.equal(w('Probe 22W09435-001 an der Musterstraße 12 a in 52999 Probehausen: 14 µg/cm² Chlorid, W1, W2.'), 'probe # an der #adr in #ort # µgcm chlorid #');
    assert.equal(K.absatzSchluessel(AB.A1), K.absatzSchluessel(AB.A2), 'andere Anschrift und Probennummern → dieselbe Fassung');
    assert.equal(K.absatzSchluessel('Die  Oberflächen, sind ZU reinigen!'), K.absatzSchluessel('die Oberflächen sind zu reinigen.'));
    assert.notEqual(K.absatzSchluessel(AB.T1), K.absatzSchluessel(AB.T2));
    assert.ok(!K.absatzWoerter('Bei Herrn Fenneberg').includes('#'), 'Namen ohne Muster bleiben (kein Kopfwert beim Vergleich)');
  });
  await test('Ähnlichkeit = gleiche Wörter in derselben Reihenfolge; Kippwörter trennen nur, wenn sie der einzige Unterschied sind', async () => {
    const w = K.absatzWoerter;
    assert.ok(K.aehnlichkeit(w(AB.T1), w(AB.T2)) > 0.95);
    const l = K.aehnlichkeit(w(AB.T1), w(AB.L1)); assert.ok(l > 0.75 && l < 0.85, 'L1 liegt zwischen locker und normal: ' + l);
    assert.ok(K.nurKippwoerter(w(AB.T1), w(AB.F1)), 'trocken → feucht');
    assert.ok(K.nurKippwoerter(w(AB.K1), w(AB.K2)), 'nicht');
    assert.ok(K.nurKippwoerter(w('Die Proben sind vor der Reinigung und nach dem Trocknen zu nehmen.'), w('Die Proben sind nach der Reinigung und vor dem Trocknen zu nehmen.')), 'vor/nach vertauscht');
    assert.ok(!K.nurKippwoerter(w(AB.T1), w(AB.T2)));
    assert.ok(!K.nurKippwoerter(w('Die Flächen sind trocken abzusaugen.'), w('Die Flächen sind feucht abzuwischen.')), 'Kippwort und mehr → darf zusammen');
  });
  await test('Familien je Einstellung; Zahlen/Anschriften gleich, Kippwörter getrennt, keine Kette über eine dritte Fassung', async () => {
    const A = K.absaetzeBauen(await absFaelle());
    assert.ok(!A.liste.some(F => F.neu.p === 'Kurz.'), 'unter fünf Wörtern nicht in der Liste');
    assert.equal(A.von.get('massnahmen|' + K.absatzSchluessel(AB.A1)).faelle.size, 2);
    const normal = ['A1', 'ALT', 'F1', 'K1', 'K2', 'L1', 'N1', 'T1+T2'];
    assert.deepEqual(fam(K.familienBauen(A, K.AEHNLICHKEIT.normal)), normal);
    assert.deepEqual(fam(K.familienBauen(A, K.AEHNLICHKEIT.streng)), normal);
    assert.deepEqual(fam(K.familienBauen(A, K.AEHNLICHKEIT.locker)), ['A1', 'ALT', 'F1', 'K1', 'K2', 'N1', 'T1+T2+L1']);
    // F1 (feucht) ist L1 ähnlich, aber nie mit T1 in einer Familie
    const E = K.familienBauen(A, 0.5);
    assert.notEqual(E.von.get('massnahmen|' + K.absatzSchluessel(AB.F1)), E.von.get('massnahmen|' + K.absatzSchluessel(AB.T1)));
    const En = K.familienBauen(A, K.AEHNLICHKEIT.normal), t = En.von.get('massnahmen|' + K.absatzSchluessel(AB.T1));
    const ae = K.aehnlicheFamilien(En, t, K.lockerer('normal')).map(x => name(x.fam.leit));
    assert.deepEqual(ae, ['F1', 'L1'], '„Ähnliche Absätze“ eine Stufe lockerer');
    assert.equal(K.lockerer('locker'), 0.6);
    // in Schritten gebaut = in einem Zug gebaut
    const b = K.familienBauer(A, 0.85); let runden = 0; while (!b.weiter(0)) runden++;
    assert.deepEqual(fam(b.ergebnis), normal);
  });
  await test('Sortierung: Oft verwendet (zwei Jahre, Gleichstand → Archiv) und Oft im Archiv; Zähler je Fassung, Summe je Familie', async () => {
    const F = await absFaelle(), A = K.absaetzeBauen(F), E = K.familienBauen(A, 0.85), alle = new Set(F.map(f => f.projekt));
    const jetzt = '2026-11-19T12:00:00.000Z', s = x => K.absatzSchluessel(AB[x]);
    const kopien = [{ id: 1, w: s('K1'), am: '2026-10-01T00:00:00Z' }, { id: 2, w: s('K1'), am: '2025-01-01T00:00:00Z' },
      { id: 3, w: s('A1'), am: '2024-11-18T00:00:00Z' }, { id: 4, w: s('A1'), am: '2023-05-01T00:00:00Z' },   // knapp über zwei Jahre: zählt nicht mehr
      { id: 5, w: s('T2'), am: '2026-11-01T00:00:00Z' }, { id: 6, w: s('T1'), am: '2026-11-02T00:00:00Z' }];
    const st = K.standBauen(kopien, [], jetzt, w => A.schluessel.has(w));
    assert.equal(K.vorZweiJahren(jetzt), '2024-11-19T12:00:00.000Z');
    assert.deepEqual([st.get(s('K1')).k2, st.get(s('A1')).k2, st.get(s('A1')).alle], [2, 0, 2]);
    const r = K.absatzZeilen(E, 'massnahmen', alle, st, 'oft');
    assert.deepEqual(r.zeilen.map(z => name(z.rep) + ':' + z.k2), ['T1:2', 'K1:2', 'A1:0', 'ALT:0', 'N1:0', 'K2:0', 'F1:0', 'L1:0'], 'T1+T2 zusammen 2 Kopien; bei 2:2 entscheidet das Archiv (2 Fälle vor 1)');
    assert.deepEqual(K.absatzZeilen(E, 'massnahmen', alle, st, 'archiv').zeilen.map(z => name(z.rep)).slice(0, 4), ['T1', 'A1', 'ALT', 'K1']);
    // ohne Kopien (erster Tag): Archiv entscheidet
    assert.deepEqual(K.absatzZeilen(E, 'massnahmen', alle, new Map(), 'oft').zeilen.map(z => name(z.rep)).slice(0, 3), ['T1', 'A1', 'ALT']);
    const a1 = r.zeilen.find(z => name(z.rep) === 'A1'); assert.equal(a1.jahr, 2025, 'zuletzt verwendet: Jahr des neuesten Falls (oder der neuesten Kopie)');
    // nur Familien aus den passenden Fällen, gezählt im ganzen Archiv
    const nurP2 = K.absatzZeilen(E, 'massnahmen', new Set([D.ABS_ORDNER.p2]), st, 'oft');
    assert.deepEqual(nurP2.zeilen.map(z => name(z.rep) + ':' + z.faelle.size), ['T1:2', 'A1:2', 'K2:1']);
  });
  await test('Markierungen: Grund Pflicht, nur Leute aus der Liste; „so nicht mehr“ ans Ende, Vorbild vorn; Zurücknehmen mit Verlauf', async () => {
    const F = await absFaelle(), A = K.absaetzeBauen(F), E = K.familienBauen(A, 0.85), alle = new Set(F.map(f => f.projekt)), s = x => K.absatzSchluessel(AB[x]);
    const ma = K.mitarbeiterLesen(JSON.stringify(D.MITARBEITER));
    assert.deepEqual(ma.personen.map(p => p.kuerzel), ['Dr. Ka', 'Ben'], 'nur aktive');
    assert.equal(K.mitarbeiterLesen(null), null); assert.ok(K.mitarbeiterLesen('{kaputt').kaputt); assert.ok(K.mitarbeiterLesen('{"format":"spektron-mitarbeiter"}').kaputt);
    assert.match(K.markeNeu({ w: s('ALT'), art: 'nicht', wer: 'Dr. Ka', warum: ' ' }, ma.personen, 'x').fehler, /Pflicht/);
    assert.match(K.markeNeu({ w: s('ALT'), art: 'nicht', wer: 'Alt', warum: 'Weil.' }, ma.personen, 'x').fehler, /Wer bist du/);
    assert.match(K.markeNeu({ w: s('ALT'), art: 'nicht', wer: 'Dr. Ka', warum: 'Weil so.' }, null, 'x').fehler, /Mitarbeiterliste fehlt/);
    const m1 = K.markeNeu({ w: s('ALT'), art: 'nicht', wer: 'Dr. Ka', warum: 'Verschmiert das Pulver.', statt: s('T1'), beispiel: AB.ALT, k: 'massnahmen' }, ma.personen, '2026-11-19T10:00:00Z').marke;
    const m2 = K.markeNeu({ w: s('T2'), art: 'vorbild', wer: 'Ben', warum: 'So übernehmen.', beispiel: AB.T2 }, ma.personen, '2026-11-19T10:01:00Z').marke;
    let st = K.standBauen([], [m1, m2], '2026-11-19T12:00:00Z', w => A.schluessel.has(w));
    let r = K.absatzZeilen(E, 'massnahmen', alle, st, 'oft');
    assert.equal(name(r.zeilen[0].rep), 'T2', 'Vorbild steht für die Familie');
    assert.deepEqual(r.ende.map(z => name(z.rep)), ['ALT']); assert.ok(!r.zeilen.some(z => name(z.rep) === 'ALT'));
    assert.deepEqual(K.familieFassungen(E.von.get('massnahmen|' + s('T1')), st).map(x => [name(x.F), x.aktuell]), [['T1', true], ['T2', false]], 'aktuelle (neueste) oben, auch wenn die andere Vorbild ist');
    // Zurücknehmen: braucht Name und Grund; die Markierung bleibt als Verlauf
    assert.match(K.markeZurueck(m1, { wer: 'Ben', warum: '' }, ma.personen, 'y').fehler, /Pflicht/);
    const z1 = K.markeZurueck(m1, { wer: 'Ben', warum: 'Für Glas passt es.' }, ma.personen, '2026-11-20T08:00:00Z').marke;
    st = K.standBauen([], [z1, m2], '2026-11-20T12:00:00Z', w => A.schluessel.has(w));
    assert.equal(st.get(s('ALT')).aktiv, null); assert.equal(st.get(s('ALT')).marken.length, 1);
    r = K.absatzZeilen(E, 'massnahmen', alle, st, 'oft'); assert.equal(r.ende.length, 0);
    // Markierung, deren Schlüssel nicht mehr passt, findet über ihr Beispiel zurück
    st = K.standBauen([], [Object.assign({}, m1, { w: 'falsch' })], '2026-11-19T00:00:00Z', w => A.schluessel.has(w));
    assert.ok(st.get(s('ALT')).aktiv);
    // Einstellung umstellen: gezählt wird je Fassung → nichts geht verloren
    const kop = [{ id: 'a', w: s('L1'), am: '2026-11-01T00:00:00Z' }, { id: 'b', w: s('T1'), am: '2026-11-01T00:00:00Z' }];
    const st2 = K.standBauen(kop, [m2], '2026-11-19T00:00:00Z', w => A.schluessel.has(w));
    const zl = K.absatzZeilen(K.familienBauen(A, 0.75), 'massnahmen', alle, st2, 'oft').zeilen.find(z => z.fam.mitglieder.length === 3);
    assert.equal(zl.k2, 2); assert.equal(name(zl.rep), 'T2');
    const zn = K.absatzZeilen(K.familienBauen(A, 0.85), 'massnahmen', alle, st2, 'oft').zeilen;
    assert.deepEqual([zn.find(z => name(z.rep) === 'T2').k2, zn.find(z => name(z.rep) === 'L1').k2], [1, 1]);
  });
  await test('Gemeinsame Dateien: zwei PCs schreiben gleichzeitig – nichts geht verloren; unlesbare Datei wird nie überschrieben', async () => {
    const platte = {}; const io = { lesen: async n => platte[n] ?? null, schreiben: async (n, t) => { platte[n] = t; }, warten: async () => {} };
    const m = (id, extra) => Object.assign({ id, w: 'f1', art: 'nicht', wer: 'Ben', warum: 'Grund.', am: '2026-11-19T10:00:00Z' }, extra);
    // PC B schreibt seine Markierung zwischen Schreiben und Nachprüfen von PC A mit einem alten Stand (A ist überschrieben)
    let einmal = true;
    const zwischen = async () => { if (!einmal) return; einmal = false; platte['lexikit-markierungen.json'] = JSON.stringify({ format: 'lexikit-markierungen', version: 1, marken: [m('b')] }); };
    const nach = await K.gemeinsamSchreiben(io, 'marken', [m('a')], { zwischen });
    assert.deepEqual(nach.marken.map(x => x.id).sort(), ['a', 'b'], 'A hat neu gelesen, vereinigt und noch einmal geschrieben');
    // Zurücknehmen geht nie verloren, auch wenn der andere PC die Markierung ohne Vermerk zurückschreibt
    await K.gemeinsamSchreiben(io, 'marken', [m('a', { zurueck: { wer: 'Ben', warum: 'Doch.', am: 'x' } })], { zwischen: async v => { if (!v) platte['lexikit-markierungen.json'] = JSON.stringify({ format: 'lexikit-markierungen', version: 1, marken: [m('a'), m('b')] }); } });
    assert.ok(JSON.parse(platte['lexikit-markierungen.json']).marken.find(x => x.id === 'a').zurueck);
    // Kopien: beide Zähler bleiben
    await K.gemeinsamSchreiben(io, 'kopien', [{ id: 'k1', w: 'f1', am: '1' }]);
    await K.gemeinsamSchreiben(io, 'kopien', [{ id: 'k2', w: 'f1', am: '2' }], { zwischen: async v => { if (!v) platte['lexikit-kopien.json'] = JSON.stringify({ format: 'lexikit-kopien', version: 1, kopien: [{ id: 'k1', w: 'f1', am: '1' }, { id: 'k3', w: 'f2', am: '3' }] }); } });
    assert.deepEqual(JSON.parse(platte['lexikit-kopien.json']).kopien.map(x => x.id).sort(), ['k1', 'k2', 'k3']);
    // Einstellung: die jüngere gilt
    await K.gemeinsamSchreiben(io, 'einstellung', { aehnlichkeit: 'locker', geaendert: '2026-11-19T10:00:00Z' });
    await K.gemeinsamSchreiben(io, 'einstellung', { aehnlichkeit: 'streng', geaendert: '2026-11-19T09:00:00Z' });
    assert.equal(JSON.parse(platte['lexikit-einstellungen.json']).aehnlichkeit, 'locker', 'ältere Änderung überschreibt die jüngere nicht');
    // unlesbar / neuere Fassung: Fehler, Datei unverändert
    platte['lexikit-markierungen.json'] = '{kaputt';
    await assert.rejects(K.gemeinsamSchreiben(io, 'marken', [m('c')]), /nicht lesbar/); assert.equal(platte['lexikit-markierungen.json'], '{kaputt');
    platte['lexikit-kopien.json'] = JSON.stringify({ format: 'lexikit-kopien', version: 9, kopien: [] });
    await assert.rejects(K.gemeinsamSchreiben(io, 'kopien', [{ id: 'k9' }]), /neueren LexiKit-Fassung/);
    // ein PC, der dauernd dazwischenfunkt: Fehler statt stiller Verlust
    await assert.rejects(K.gemeinsamSchreiben(io, 'einstellung', { aehnlichkeit: 'normal', geaendert: '2027' }, { zwischen: async () => { platte['lexikit-einstellungen.json'] = JSON.stringify({ format: 'lexikit-einstellungen', version: 1, aehnlichkeit: 'locker', geaendert: '2026' }); } }), /nicht sicher schreiben/);
  });
  await test('Kopieren: Platzhalter aus dem frisch gelesenen Kopf und dem Projektordner; ohne Kopf nur der Ordner', async () => {
    const buf = D.docx(D.ABS_BERICHTE.p1), b = await K.docxLesen(async (a, e) => new Uint8Array(buf.subarray(a, e)), buf.length, inflate, { kopf: true });
    let r = K.absatzErsetzen(AB.N1, b.kopf, D.ABS_ORDNER.p1, K.fachwoerter(K.ersteThemen('').themen));
    assert.equal(r.t, 'Die Lagerhalle von Herrn [VN] am [Risikoort] ist vor der Wiederinbetriebnahme vollständig zu reinigen und abzunehmen.');
    assert.deepEqual(r.platzhalter, ['[VN]', '[Risikoort]']);
    assert.equal(K.absatzErsetzen(AB.T1, b.kopf, D.ABS_ORDNER.p1, []).t, AB.T1, 'ohne Namen bleibt der Text');
    r = K.absatzErsetzen('Im Musterlager Monheim lag Ruß bei Herrn Fenneberg.', null, D.ABS_ORDNER.p1, []);
    assert.equal(r.t, 'Im [Projekt] lag Ruß bei Herrn Fenneberg.', 'ohne Kopf: nur die Wörter des Projektordners');
    assert.equal(JSON.stringify(b).includes('Tobias') && !JSON.stringify(Object.assign({}, b, { kopf: undefined })).includes('Tobias'), true, 'Kopfwerte nur mit opt.kopf');
  });
  await test('Praxisprofil: Untersucht auf, Proben je Fall, Berichtsform, Mitteilungen, mit Maßnahmen', async () => {
    const P = K.profilBauen(await absFaelle());
    assert.deepEqual([P.n, P.von, P.bis], [5, 2022, 2026]);
    assert.deepEqual(P.params.map(x => x.name + ' ' + x.n), ['Chlorid 5', 'PAK 2', 'Sulfat · Ammonium · Phosphat 1']);
    assert.deepEqual(P.proben, [{ art: 'Wischproben', von: 8, bis: 10, faelle: 5 }]);
    assert.deepEqual(P.formen, [{ form: 'Sanierungsvorschlag', n: 3 }, { form: 'Untersuchungsbericht', n: 2 }]);
    assert.deepEqual([P.mitteilungen, P.mitMassnahmen], [1, 5]);
    assert.equal(K.profilBauen([]).n, 0);
  });
  await test('„Ähnliche Absätze“: ein Fall mit zwei Fassungen zählt einmal (Codex-Hinweis PR #4)', async () => {
    const F = (id, ids, faelle) => ({ id, k: 'massnahmen', ids: Int32Array.from(ids), sid: Int32Array.from(ids).sort(), faelle: new Set(faelle), neu: { f: { jahr: 2026, pnr: 1 } } });
    const a = F('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['p1']), b1 = F('b1', [1, 2, 3, 4, 5, 6, 7, 8, 11, 12], ['p2']), b2 = F('b2', [1, 2, 3, 4, 5, 6, 7, 8, 11, 13], ['p2', 'p3']);
    const E = { familien: [{ k: 'massnahmen', leit: a, mitglieder: [a] }, { k: 'massnahmen', leit: b1, mitglieder: [b1, b2] }] };
    const r = K.aehnlicheFamilien(E, E.familien[0], 0.6);
    assert.equal(r.length, 1); assert.equal(r[0].faelle, 2, 'p2 steht in beiden Fassungen – zusammen 2 Fälle, nicht 3');
  });
  await test('Unterschiede innerhalb einer Familie markieren', async () => {
    const d = K.wortUnterschiede(AB.T1, AB.T2);
    assert.deepEqual(d.filter(x => x.anders).map(x => x.t), ['Lager']);
    assert.equal(d.map(x => x.t).join(''), AB.T1, 'Text bleibt vollständig');
    assert.deepEqual(K.wortUnterschiede('Die Flächen sind trocken abzusaugen und anschließend feucht zu reinigen.', 'Die Flächen sind zunächst trocken abzusaugen.').filter(x => x.anders).map(x => x.t), ['und anschließend feucht zu reinigen.']);
  });
  console.log(`\nKern: ${n} Prüfungen bestanden`);
})().catch(e => { console.error(e); process.exit(1); });
