// Erfundene Testberichte als echte .docx (ZIP) – keine echten Berichtstexte, keine Kundennamen.
// docx(spec) baut eine Word-Datei: Absätze mit fett/unterstrichen/Formatvorlage, Tabellen, ein eingebettetes „Foto“.
const zlib = require('node:zlib'), crypto = require('node:crypto');

/* ---------- ZIP schreiben (ohne Bibliothek) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(eintraege) {   // [{ name, daten: Buffer, packen: bool }]
  const lokal = [], zentral = []; let ofs = 0;
  for (const e of eintraege) {
    const name = Buffer.from(e.name, 'utf8'), roh = e.daten, daten = e.packen ? zlib.deflateRawSync(roh) : roh, m = e.packen ? 8 : 0, crc = crc32(roh);
    const k = Buffer.alloc(30); k.writeUInt32LE(0x04034b50, 0); k.writeUInt16LE(20, 4); k.writeUInt16LE(0x0800, 6); k.writeUInt16LE(m, 8);
    k.writeUInt32LE(crc, 14); k.writeUInt32LE(daten.length, 18); k.writeUInt32LE(roh.length, 22); k.writeUInt16LE(name.length, 26);
    lokal.push(k, name, daten);
    const z = Buffer.alloc(46); z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x0800, 8); z.writeUInt16LE(m, 10);
    z.writeUInt32LE(crc, 16); z.writeUInt32LE(daten.length, 20); z.writeUInt32LE(roh.length, 24); z.writeUInt16LE(name.length, 28); z.writeUInt32LE(ofs, 42);
    zentral.push(z, name);
    ofs += 30 + name.length + daten.length;
  }
  const cd = Buffer.concat(zentral), ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0); ende.writeUInt16LE(eintraege.length, 8); ende.writeUInt16LE(eintraege.length, 10); ende.writeUInt32LE(cd.length, 12); ende.writeUInt32LE(ofs, 16);
  return Buffer.concat([...lokal, cd, ende]);
}

/* ---------- document.xml ---------- */
const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function run(r) {
  const pr = (r.b ? '<w:b/><w:bCs/>' : '') + (r.u ? '<w:u w:val="single"/>' : '');
  const teile = String(r.t).split(/(\t|\n)/).map(t => t === '\t' ? '<w:tab/>' : t === '\n' ? '<w:br/>' : t ? `<w:t xml:space="preserve">${x(t)}</w:t>` : '').join('');
  return `<w:r w:rsidR="00A1B2C3">${pr ? `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${pr}<w:sz w:val="24"/></w:rPr>` : ''}${teile}</w:r>`;
}
function absatz(a) {
  if (typeof a === 'string') a = { t: a };
  const runs = a.runs || [{ t: a.t, b: a.b, u: a.u }];
  const ppr = `<w:pPr>${a.stil ? `<w:pStyle w:val="${a.stil}"/>` : ''}<w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:b/></w:rPr></w:pPr>`;
  return `<w:p w:rsidR="00A1B2C3" w:rsidRDefault="00A1B2C3">${ppr}<w:proofErr w:type="spellStart"/>${runs.map(run).join('')}<w:bookmarkStart w:id="0" w:name="_GoBack"/><w:bookmarkEnd w:id="0"/></w:p>`;
}
const tabelle = zeilen => `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${zeilen.map(z => `<w:tr>${z.map(c => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${absatz({ t: c, b: true })}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
const bild = () => `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Bild 1"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId9"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
// Textfeld (wie Word: mc:AlternateContent mit Choice und Fallback – der Text darf nur einmal ankommen)
const textfeld = t => `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>${absatz(t)}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>${absatz(t)}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`;

function documentXml(teile) {
  const body = teile.map(t => t.tabelle ? tabelle(t.tabelle) : t.bild ? bild() : t.textfeld ? textfeld(t.textfeld) : t.geloescht ? `<w:p><w:del w:id="1" w:author="A"><w:r><w:delText>${x(t.geloescht)}</w:delText></w:r></w:del>${run({ t: t.t })}</w:p>` : absatz(t)).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml" mc:Ignorable="w14 wp14">'
    + `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;
}
/** Word-Datei. fotoBytes: Größe des eingebetteten „Fotos“ (liegt im ZIP VOR dem Text – der Leser darf es nicht lesen) */
function docx(teile, fotoBytes = 0, saat = 'x') {
  const ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/></Relationships>';
  const e = [{ name: '[Content_Types].xml', daten: Buffer.from(ct), packen: true }, { name: '_rels/.rels', daten: Buffer.from(rels), packen: true }];
  if (fotoBytes) {   // zufällige Bytes, ungepackt wie ein JPG
    const foto = Buffer.alloc(fotoBytes); let h = crypto.createHash('sha256').update(saat).digest();
    for (let i = 0; i < fotoBytes; i += 32) { h = crypto.createHash('sha256').update(h).digest(); h.copy(foto, i, 0, Math.min(32, fotoBytes - i)); }
    e.push({ name: 'word/media/image1.jpeg', daten: foto, packen: false });
  }
  e.push({ name: 'word/document.xml', daten: Buffer.from(documentXml(teile)), packen: true }, { name: 'word/_rels/document.xml.rels', daten: Buffer.from(drels), packen: true });
  return zip(e);
}

/* ---------- Bausteine der erfundenen Berichte ---------- */
const BRIEFKOPF = [{ t: 'Musterbüro für Brandschadenchemie', stil: 'Kopfzeile' }, { t: 'Beispielstraße 1 · 00000 Musterstadt', stil: 'Kopfzeile' }];
const KOPF = (nr, form) => [
  { t: form, stil: 'Titel', b: true },
  { t: 'Projektnummer:\t' + nr },
  { t: 'Schaden vom:\t01.02.2026' },
  { t: 'VN:\tErika Beispielperson' },
  { t: 'Risiko:\tBeispielweg 7' },
  { t: '\t00000 Musterhausen' },
  { t: 'Versicherer:\tMuster Versicherung AG' },
  { t: 'Schaden-Nr.:\tXY-0000-123' },
];

/** Die Testberichte. Jeder: { pfad (im Archiv), teile, foto } */
const BERICHTE = {
  // neuer Kurzbericht: fett ohne Nummer, Titel mit Datum, Kopfblock nach der Marke, Textfeld, gelöschter Text, Foto
  fett: [...BRIEFKOPF, { t: 'Untersuchungsbericht vom 03.03.2026', stil: 'berschrift1' }, { t: '(1. Mitteilung)' }, ...KOPF('99.0137', '').slice(1),
    { t: 'Probenahme', b: true },
    'Im Rahmen des Ortstermins wurden zwei Wasserproben aus dem Keller entnommen und auf Fäkalkeime untersucht.',
    { textfeld: 'Hinweis im Textfeld: Probenahme durch das Büro.' },
    { t: 'Befunde', b: true },
    { t: 'In der Probe aus dem Heizungsraum wurde E. coli nachgewiesen, außerdem coliforme Bakterien.', geloescht: 'Dieser Satz wurde gelöscht. ' },
    { bild: true },
    { t: 'Tabelle 1: Ergebnisse der Wasserproben', b: true },
    { tabelle: [['Probe', 'Parameter', 'Ergebnis'], ['W1', 'Escherichia coli', 'nachgewiesen'], ['W2', 'Enterokokken', 'nicht nachgewiesen']] },
    { t: 'Schlussfolgerungen', b: true },
    'Der Estrich im Heizungsraum ist nach Rückbau des Bodenaufbaus zu desinfizieren.'],
  // älterer Bericht: numerierte, unterstrichene Überschriften, Tabelle mit Abfallschlüssel, Löschwasser
  unter: [...BRIEFKOPF, { t: 'Sanierungsvorschlag', stil: 'Titel', b: true }, ...KOPF('99.0502', '').slice(1), { t: '(2. Mitteilung)' },
    { t: '1. Veranlassung', u: true },
    'Wie in der ersten Mitteilung berichtet, wurde zusätzlich eine Probe des aufstehenden Löschwassers untersucht.',
    { t: '2. Befund', u: true },
    'Die Auswertung zeigt im Löschwasser eine Überschreitung des Zuordnungswertes für den TOC. Der Estrich ist durchfeuchtet.',
    { tabelle: [['Abfall', 'Abfallschlüssel', 'Entsorgungsweg'], ['Brandschutt', 'AVV 17 09 04', 'Deponieklasse I']] },
    { runs: [{ t: '3. ', u: true }, { t: 'Entsorgung', u: true, b: true }] },
    'Es wurde eine Brandschuttmischprobe entnommen und nach Deponieverordnung (DepV) untersucht.',
    'Für die Entsorgung ist ein Nachweis nach DepV zu führen; ein sehr langer Satz, der nur zeigt, dass ein langer unterstrichener Absatz keine Überschrift ist, auch wenn er ganz unterstrichen wäre.',
    { t: 'Ein ganz unterstrichener langer Absatz mit mehr als neunzig Zeichen ist keine Überschrift, sondern ein normaler Absatz im Text.', u: true }],
  // Kurzbericht ganz ohne Überschriften (Asbest)
  ohne: [...BRIEFKOPF, { t: 'Untersuchungsbericht', stil: 'Titel' }, { t: '(1. Mitteilung)' },
    'An der Rohrisolierung im Keller wurde eine Materialprobe entnommen. Asbest wurde nachgewiesen (Chrysotil).',
    'Die Isolierung ist nach TRGS 519 durch einen Fachbetrieb zu entfernen.'],
  // Bericht ohne Marke „(n. Mitteilung)“, Kopf als Tabelle, Schimmel
  ohneMarke: [{ t: 'Untersuchungsbericht', stil: 'Titel' }, { tabelle: [['Projektnummer', '99.0300'], ['VN', 'Max Beispielmensch'], ['Schaden-Nr.', 'AB-1']] },
    { t: '1. Veranlassung', u: true }, 'Im Schlafzimmer zeigte sich Schimmelpilzbewuchs; die KBE-Werte der Luftprobe waren erhöht.'],
  // ohne Marke, Titel ohne bekannte Berichtsform, Briefkopf mit Überschrift-Formatvorlage (Codex-Hinweis PR #1)
  ohneMarkeTitel: [{ t: 'Musterbüro für Brandschadenchemie', stil: 'berschrift1' }, 'Beispielstraße 1 · 00000 Musterstadt', { t: 'Brandursachenbericht', stil: 'Titel' },
    { t: '1. Veranlassung', u: true }, 'Im Lager wurde Löschpulver aus einem ABC-Pulverlöscher großflächig verteilt; die Rückstände sind zu entfernen.'],
  // Rohdatei Gutachten_… (Stub)
  stub: [...BRIEFKOPF, ...KOPF('99.0001', 'Untersuchungsbericht'), { t: '1. Veranlassung', u: true }],
};

/** Archiv mit erfundenen Projektordnern: Pfad → Inhalt (Buffer) oder Text */
function archiv() {
  const d = (k, foto) => docx(BERICHTE[k], foto, k);
  return {
    '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx': d('fett', 1500000),
    '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/Anschreiben 1. Mitteilung.docx': d('ohne'),
    '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/~$Mitteilung.docx': 'gesperrt',
    '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung_Entwurf.docx': d('ohne'),
    '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/Gutachten_20260301_1200.docx': d('stub'),
    '26.0137 Beispielweg Musterstadt Tst/Fotos/IMG_0001.jpg': Buffer.alloc(2000, 1),
    '26.0137 Beispielweg Musterstadt Tst/_Projekt.json': '{"projektnummer":"26.0137"}',
    '25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung.docx': d('ohne'),
    '25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung_korrigiert.docx': d('ohne'),
    '24.0300 Musterhof Probedorf Tst/Altbau/1. Mitteilung.docx': d('ohneMarke'),
    '24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx': d('ohne'),
    '23.0502 Baumarkt Musterstadt Tst/2. Mitteilung.docx': d('unter', 300000),
    '23.0502 Baumarkt Musterstadt Tst/2. Mitteilung.pdf': Buffer.alloc(100, 2),
    '22.00114 Musterweg Beispielbad Tst/1. Mitteilung.doc': Buffer.alloc(100, 3),
    '22.00114 Musterweg Beispielbad Tst/Mitteilungen/1.Mitteilung .docx': d('ohne'),
    'ALT_2022/22.00001 Altstadt Tst/1. Mitteilung.docx': d('ohne'),
    'Sonstige/1. Mitteilung.docx': d('ohne'),
    '_Spektron-Mitarbeiter.json': '{"format":"spektron-mitarbeiter"}',
    '_LexiKit/': null,
  };
}

module.exports = { docx, zip, documentXml, BERICHTE, archiv };
