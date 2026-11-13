// Messung bei Archivgröße – NICHT in CI (dauert einige Minuten). Erfundenes Archiv im privaten Dateisystem des Browsers (OPFS):
// 3.158 Projektordner, 4.663 Berichte mit je rund 6.000 Zeichen erfundenem Text (zusammen etwa 27 MB, wie im echten Archiv gezählt).
// Gemessen wird der Start von LexiKit mit vorhandenem Index: Index laden, Fälle bauen, Themen zählen – und einzelne Suchen.
//   NODE_PATH=<playwright> CHROME=<chrome> node tests/zeit-archivgroesse.cjs
// Die Zahlen gelten für den Rechner, auf dem die Messung läuft; das erste Einlesen aus dem OPFS sagt nichts über das Netzlaufwerk.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { docx } = require('./daten/berichte.cjs');
const ROOT = path.join(__dirname, '..');
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYP[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

/* ---------- erfundene Berichte ---------- */
let saat = 20261113; const zufall = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
const aus = l => l[Math.floor(zufall() * l.length)];
const ORT = ['Lagerhalle', 'Fertigungshalle', 'Tiefgarage', 'Wohnung im Erdgeschoss', 'Kellerraum', 'Serverraum', 'Werkstatt', 'Küche', 'Dachgeschoss', 'Technikraum', 'Kühlhaus', 'Büro'];
const DING = ['Gabelstapler', 'Wäschetrockner', 'Schaltschrank', 'Photovoltaik-Wechselrichter', 'Lithium-Akku eines Elektrofahrrads', 'Adventskranz', 'Kühlaggregat', 'Fritteuse', 'Kopierer'];
const FLAECHE = ['Regalboden', 'Fensterbank', 'Türzarge', 'Schaltschranktür', 'Wandfliese', 'Lüftungskanal', 'Arbeitsplatte', 'Kabeltrasse', 'Heizkörper', 'Maschinengehäuse'];
const STOFF = ['Chlorid', 'PAK', 'Sulfat', 'Phosphat', 'Asbest', 'Schimmelpilze', 'Fäkalkeime', 'Löschpulver', 'Löschwasser', 'Brandschutt', 'Ruß', 'KMF'];
const SATZ = [
  () => `Die Oberfläche ${aus(FLAECHE)} war sichtbar mit ${aus(STOFF)} beaufschlagt und wurde im Rahmen der Besichtigung dokumentiert.`,
  () => `Im Bereich ${aus(ORT)} zeigten sich deutliche Ablagerungen auf den waagerechten Flächen, insbesondere auf ${aus(FLAECHE)} und ${aus(FLAECHE)}.`,
  () => `Die Auswertung der Analysenergebnisse zeigt für ${aus(STOFF)} Werte zwischen ${Math.ceil(zufall() * 40)} und ${40 + Math.ceil(zufall() * 300)} µg/m² je nach Entnahmestelle.`,
  () => `Der Bodenaufbau im Raum ${aus(ORT)} ist nach derzeitigem Kenntnisstand durchfeuchtet und muss weiter beobachtet werden.`,
  () => `Die betroffenen Bauteile sind durch einen Fachbetrieb zu reinigen; poröse Materialien wie ${aus(['Dämmung', 'Teppichboden', 'Akustikdecke', 'Gipskarton'])} sind zurückzubauen.`,
  () => `Nach Abschluss der Arbeiten empfiehlt sich eine Kontrolle der gereinigten Flächen an den zuvor beprobten Stellen.`,
  () => `Die Entsorgung der anfallenden Abfälle erfolgt getrennt nach Abfallschlüssel über einen zugelassenen Entsorgungsweg.`,
];
const absatz = n => Array.from({ length: n }, () => aus(SATZ)()).join(' ');
function bericht(nr) {
  const n = 4 + Math.floor(zufall() * 20), ort = aus(ORT);
  const t = [{ t: nr === 1 ? 'Sanierungsvorschlag' : 'Untersuchungsbericht', stil: 'Titel' }, { t: `(${nr}. Mitteilung)` }, 'Projektnummer:\t99.0000', 'VN:\tErika Beispielperson',
    { t: '1. Veranlassung', u: true }, `In einer ${ort} kam es zu einem Brand an einem ${aus(DING)}. ` + absatz(3),
    { t: '2. Aufgabenstellung', u: true }, 'Unser Büro wurde beauftragt, das Ausmaß der Beaufschlagung festzustellen und Maßnahmen vorzuschlagen. ' + absatz(1),
    { t: '3. Ortsbesichtigung', u: true }, absatz(4),
    { t: '4. Probenahme', u: true }, `Zur Messung der Chloridbelastungen wurden ${n} Wischproben entnommen.`, `Zur Messung der PAK-Belastungen wurden ${n + 2} Wischproben entnommen, die auf die 16 Einzelkomponenten analysiert wurden.`, absatz(2),
    { t: '5. Befund', u: true }, absatz(8), absatz(7), { tabelle: [['Probe', 'Chlorid', 'PAK'], ['W1', '12', '310'], ['W2', '4', '95']] },
    { t: '6. Sanierungsmaßnahmen', u: true }, absatz(8), absatz(7),
    { t: '7. Arbeitsschutzmaßnahmen', u: true }, 'Bei Arbeiten an Bauteilen mit Asbestverdacht sind die Vorgaben der TRGS 519 einzuhalten. ' + absatz(4)];
  return docx(t, 0, 'z' + saat);
}
function archiv() {
  const JAHRE = [[22, 227, 5], [23, 892, 4], [24, 752, 4], [25, 758, 4], [26, 529, 4]], dateien = []; let rest = 4663 - 3158;
  for (const [j, anzahl, stellen] of JAHRE) for (let i = 1; i <= anzahl; i++) {
    const ordner = `${j}.${String(i).padStart(stellen, '0')} Musterobjekt ${aus(['Lager', 'Halle', 'Garage', 'Wohnung', 'Keller', 'Werkstatt', 'Dach', 'Technik'])} Tst`;   // ohne Umlaute: das OPFS listet sie ohne UTF-8-Umgebung nicht
    const mehr = rest > 0 && zufall() < 0.42 ? (zufall() < 0.25 && rest > 1 ? 2 : 1) : 0; rest -= mehr;
    for (let nr = 1; nr <= 1 + mehr; nr++) dateien.push([`${ordner}/Mitteilungen/${nr}. Mitteilung.docx`, bericht(nr)]);
  }
  for (let i = 0; rest > 0; i++, rest--) { const [p] = dateien[i * 3]; dateien.push([p.replace(/\d\. Mitteilung/, '4. Mitteilung'), bericht(4)]); }
  return dateien;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const context = await browser.newContext({ viewport: { width: 1320, height: 1000 } });
  await context.addInitScript(() => {   // Archiv-Handle wie aus „mosaik-suite“/„archiv“ – direkt aus dem OPFS
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (k) {
      if (k !== 'archiv' || this.name !== 'kv') return orig.call(this, k);
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      navigator.storage.getDirectory().then(r => r.getDirectoryHandle('Archiv')).then(h => { req.result = h; if (req.onsuccess) req.onsuccess({ target: req }); }, () => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(1800000);
  const fehler = []; page.on('pageerror', e => fehler.push(e.message));
  try {
    await page.goto(url); await page.waitForSelector('#zugang:not([hidden])');
    const dateien = archiv(), bytes = dateien.reduce((s, d) => s + d[1].length, 0);
    console.log(`Archiv: ${new Set(dateien.map(d => d[0].split('/')[0])).size} Projektordner, ${dateien.length} Berichte, ${(bytes / 1e6).toFixed(1)} MB Word-Dateien`);
    await page.evaluate(async () => { const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv', { create: true }); await a.getDirectoryHandle('_LexiKit', { create: true }); });
    for (let i = 0; i < dateien.length; i += 200) {
      await page.evaluate(async stapel => {
        const a = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv');
        for (const [pfad, b] of stapel) { const t = pfad.split('/'); let d = a; for (const x of t.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true });
          const w = await (await d.getFileHandle(t.at(-1), { create: true })).createWritable(); await w.write(Uint8Array.from(atob(b), c => c.charCodeAt(0))); await w.close(); }
      }, dateien.slice(i, i + 200).map(([p, b]) => [p, b.toString('base64')]));
    }
    const fertig = () => page.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende);
    // erstes Einlesen (nur zur Einordnung – OPFS, kein Netzlaufwerk)
    let t0 = Date.now(); await page.reload(); await page.waitForSelector('#einlesen:not([hidden])'); await fertig();
    console.log(`Erstes Einlesen aus dem OPFS: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const zeichen = await page.evaluate(() => [...LexiKit.S.berichte.values()].reduce((s, b) => s + (b.zeichen || 0), 0));
    const indexBytes = await page.evaluate(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle('_LexiKit'); let n = 0; for await (const [, h] of d.entries()) n += (await h.getFile()).size; return n; });
    console.log(`Im Index: ${(zeichen / 1e6).toFixed(1)} Mio. Zeichen Text, Dateien in _LexiKit zusammen ${(indexBytes / 1e6).toFixed(1)} MB`);

    // Start mit vorhandenem Index – fünfmal
    const laeufe = [];
    for (let i = 0; i < 5; i++) {
      t0 = Date.now(); await page.reload();
      await page.waitForFunction(() => !document.getElementById('suche').hidden && document.querySelector('#chips [data-param]'), null, { polling: 'raf' }); const tSuche = Date.now() - t0;   // Index geladen, Fälle gebaut, Suche und Filter sichtbar
      await page.waitForFunction(() => { const k = [...document.querySelectorAll('.thema small')]; return k.length >= 15 && k.every(e => e.textContent !== '…'); }, null, { polling: 'raf' }); const tZahlen = Date.now() - t0;   // alle Themen gezählt
      await fertig(); const tPruefung = Date.now() - t0;   // Hintergrund: Archiv auf neue Berichte durchgesehen (wie 0.1.0)
      laeufe.push({ tSuche, tZahlen, tPruefung });
    }
    const med = k => laeufe.map(l => l[k]).sort((a, b) => a - b)[2], s = ms => (ms / 1000).toFixed(2) + ' s';
    console.log(`Start mit vorhandenem Index (Median aus 5): Suche mit Fällen benutzbar ${s(med('tSuche'))} · alle Themen gezählt ${s(med('tZahlen'))} · Hintergrund-Prüfung auf neue Berichte fertig ${s(med('tPruefung'))}`);
    console.log('  einzeln: ' + laeufe.map(l => `${s(l.tSuche)}/${s(l.tZahlen)}/${s(l.tPruefung)}`).join('  '));
    // Einzelschritte im Kern (ohne Oberfläche)
    const einzeln = await page.evaluate(() => {
      const K = LexiKern, liste = [...LexiKit.S.berichte.values()], z = f => { const a = performance.now(); const r = f(); return [Math.round(performance.now() - a), r]; };
      for (const b of liste) delete b._d;
      const [tBau, faelle] = z(() => K.faelleBauen(liste)), [tBau2] = z(() => K.faelleBauen(liste));
      const themen = LexiKit.S.themen.themen.filter(t => !t.geloescht);
      const [tZahl] = z(() => themen.map(t => K.zaehleFaelle(faelle, K.themaWoerter(t))));
      const [tSuche, r] = z(() => K.sucheFaelle(faelle, { thema: ['Löschpulver', 'ABC-Pulver', 'Pulverlöscher'], woerter: ['Lagerhalle', 'Schaltschrank'] }));
      const [tFilter, r2] = z(() => K.sucheFaelle(faelle, { parameter: ['chlorid', 'pak'], jahr: 2025 }));
      return { faelle: faelle.length, berichte: liste.length, tBau, tBau2, tZahl, themen: themen.length, tSuche, treffer: r.treffer.length, tFilter, treffer2: r2.treffer.length };
    });
    console.log(`Kern: ${einzeln.faelle} Fälle aus ${einzeln.berichte} Berichten bauen ${einzeln.tBau} ms (erneut, schon abgeleitet: ${einzeln.tBau2} ms) · ${einzeln.themen} Themen zählen ${einzeln.tZahl} ms · Suche Thema + 2 Wörter ${einzeln.tSuche} ms (${einzeln.treffer} Fälle) · nur Filter ${einzeln.tFilter} ms (${einzeln.treffer2} Fälle)`);
    if (fehler.length) console.log('Fehler in der Seite:', fehler);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
