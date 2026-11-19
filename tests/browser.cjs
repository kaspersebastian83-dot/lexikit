// LexiKit im echten Browser (Chromium): Archivordner im privaten Dateisystem des Browsers (OPFS) mit erfundenen Berichten.
// Geprüft: erstes Einlesen, Auswahl der Berichte, Dateien in _LexiKit, nichts in den Projektordnern geändert, Themenliste aus
// LexiKit 0.1.0 wird gehoben, Fälle (Karte, Reiter, Verlauf, Stränge, Schildchen „Untersucht“ mit Fundstelle), Suche mit Thema
// und eigenen Wörtern, Rangfolge, Filter, Themen anlegen/ändern/löschen mit einem „anderen PC“, Start mit vorhandenem Index
// (nichts gelesen, nichts geschrieben), nur Neues nachlesen, Archivwechsel, Schreibprobe schlägt fehl, Für ChatGPT kopieren,
// ab 0.4.0 Praxisprofil, Unsere Absätze (Familien, Sortierung, Kopieren mit Platzhaltern, Markierungen, zweiter PC, Ähnlichkeit).
// node tests/browser.cjs   (Playwright wird in CI installiert; lokal: NODE_PATH auf ein playwright, CHROME=Pfad zu Chrome optional)
// LEXIKIT_BILDER=<Ordner> legt Bildschirmfotos ab.
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { archiv, docx, BERICHTE, archivKopie, KOPIE_ORDNER_OPFS: KO } = require('./daten/berichte.cjs');
const K = require('./kern-laden.cjs');
// Themenliste, wie LexiKit 0.1.0 sie hinterlassen hat (Fassung 1, ohne Gruppen): eigenes Thema des Büros, ein gelöschtes
const THEMEN_010 = { format: 'lexikit-themen', version: 1, themen: [
  ...K.ERSTE_THEMEN.map(([name, w]) => Object.assign({ id: K.themaId(name), name, woerter: w, geaendert: '2026-11-13T09:00:00.000Z' }, name === 'Löschmittel' ? { woerter: [], geloescht: true } : {})),
  { id: 't-parkett', name: 'Parkett', woerter: ['Laminat'], geaendert: '2026-11-13T09:30:00.000Z' }] };
const ROOT = path.join(__dirname, '..');
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYP[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const BILDER = process.env.LEXIKIT_BILDER;
const b64 = x => (Buffer.isBuffer(x) ? x : Buffer.from(String(x))).toString('base64');

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const context = await browser.newContext({ viewport: { width: 1320, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  // Archiv-Handle wie aus „mosaik-suite“/„archiv“ der Projektzentrale – direkt aus dem OPFS (wie BerichtKit tests/browser.cjs)
  const initSkript = () => {
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (k) {
      if (k !== 'archiv' || this.name !== 'kv') return orig.call(this, k);
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      navigator.storage.getDirectory().then(r => r.getDirectoryHandle('Archiv')).then(
        h => { req.result = h; if (req.onsuccess) req.onsuccess({ target: req }); },
        () => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    };
    const ab = Blob.prototype.arrayBuffer;   // mit window.__langsam liest jede Datei 300 ms (Einlesen „läuft“ sichtbar lange)
    Blob.prototype.arrayBuffer = async function () { if (window.__langsam) await new Promise(r => setTimeout(r, 300)); return ab.call(this); };
    if (sessionStorage.getItem('schreibprobe-kaputt')) {   // Schreibprobe in _LexiKit schlägt fehl
      const cw = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = function () { if (this.name.startsWith('.lexikit-schreibprobe')) return Promise.reject(new DOMException('Zugriff verweigert', 'NotAllowedError')); return cw.apply(this, arguments); };
    }
  };
  await context.addInitScript(initSkript);
  const page = await context.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(e.message)); page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('dialog', d => { fehler.push('Browser-Dialog: ' + d.message()); d.dismiss(); });
  const bild = async name => { if (BILDER) { fs.mkdirSync(BILDER, { recursive: true }); await page.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); } };
  // Helfer im Browser: Dateien schreiben/lesen/auflisten im OPFS-Archiv
  const H = `
    window.__arch = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv', { create: true });
    window.__dir = async (teile, create) => { let d = await __arch(); for (const t of teile) d = await d.getDirectoryHandle(t, { create }); return d; };
    window.__schreib = async (pfad, b64) => { const t = pfad.split('/'); const d = await __dir(t.slice(0, -1), true); if (!t.at(-1)) return;
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const w = await (await d.getFileHandle(t.at(-1), { create: true })).createWritable(); await w.write(bin); await w.close(); };
    window.__lies = async pfad => { const t = pfad.split('/'); const d = await __dir(t.slice(0, -1), false); return (await (await d.getFileHandle(t.at(-1))).getFile()).text(); };
    window.__weg = async pfad => { const t = pfad.split('/'); const d = await __dir(t.slice(0, -1), false); await d.removeEntry(t.at(-1)); };
    window.__liste = async () => { const aus = {}; const geh = async (d, p) => { for await (const [n, h] of d.entries()) { const q = p ? p + '/' + n : n;
      if (h.kind === 'directory') await geh(h, q); else { const f = await h.getFile(); aus[q] = f.size + '|' + f.lastModified; } } }; await geh(await __arch(), ''); return aus; };`;
  const lauf = () => page.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende, null, { timeout: 30000 });
  const projektDateien = async () => Object.fromEntries(Object.entries(await page.evaluate(() => __liste())).filter(([k]) => !k.startsWith('_LexiKit/')));
  try {
    await page.goto(url);
    await page.waitForSelector('#zugang:not([hidden])');   // noch kein Archiv
    await page.evaluate(H);
    for (const [pfad, inhalt] of Object.entries(archiv())) {
      await page.evaluate(([p, b]) => __schreib(p, b), [pfad, inhalt == null ? '' : b64(inhalt)]);
      if (/korrigiert/.test(pfad)) await page.waitForTimeout(20);
    }
    await page.evaluate(([p, b]) => __schreib(p, b), ['25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung_korrigiert.docx', b64(docx(BERICHTE.ohne, 0, 'korr'))]);   // jünger als die erste Fassung
    await page.evaluate(b => __schreib('_LexiKit/lexikit-themen.json', b), b64(JSON.stringify(THEMEN_010, null, 1)));
    const vorher = await projektDateien();

    /* ---------- 1. Erster Start: Einlesen ---------- */
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('#einlesen:not([hidden])');
    await lauf();
    await bild('1-einlesen-fertig');
    assert.match(await page.textContent('#einZahl'), /11 Berichte im Index/);
    const lx = Object.keys(await page.evaluate(() => __liste())).filter(k => k.startsWith('_LexiKit/')).sort();
    assert.deepEqual(lx, ['_LexiKit/lexikit-index-2022.json', '_LexiKit/lexikit-index-2023.json', '_LexiKit/lexikit-index-2024.json', '_LexiKit/lexikit-index-2025.json', '_LexiKit/lexikit-index-2026.json', '_LexiKit/lexikit-themen.json'], 'nur Index und Themen in _LexiKit, Schreibprobe wieder weg');
    assert.deepEqual(await projektDateien(), vorher, 'in den Projektordnern hat sich nichts geändert');
    const idx = {}; for (const j of [2022, 2023, 2024, 2025, 2026]) Object.assign(idx, JSON.parse(await page.evaluate(p => __lies(p), `_LexiKit/lexikit-index-${j}.json`)).berichte);
    assert.deepEqual(Object.keys(idx).sort(), [
      '22.00114 Musterweg Beispielbad Tst/Mitteilungen/1.Mitteilung .docx',
      '23.0502 Baumarkt Musterstadt Tst/2. Mitteilung.docx',
      '23.0700 Beispielhalle Musterdorf Tst/Mitteilungen/1. Mitteilung.docx',
      '24.0300 Musterhof Probedorf Tst/Altbau/1. Mitteilung.docx',
      '24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx',
      '24.0412 Musterlager Beispielheim Tst/Mitteilungen/1. Mitteilung.docx',
      '24.0412 Musterlager Beispielheim Tst/Mitteilungen/1. Mitteilung_Englisch.docx',
      '24.0412 Musterlager Beispielheim Tst/Mitteilungen/2. Mitteilung.docx',
      '25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung_korrigiert.docx',
      '25.0300 Musterwerk Probestadt Tst/Mitteilungen/1. Mitteilung.docx',
      '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx'], 'Auswahl: ohne Anschreiben, Entwurf, Gutachten_, ~$, PDF, .doc, ALT_2022, Sonstige; nur die korrigierte Fassung');
    const roh = JSON.stringify(idx);
    for (const v of ['Beispielperson', 'Beispielmensch', 'XY-0000', 'Muster Versicherung', 'Musterhausen', 'Muster Sanierung', 'Beispielgasse', '12-3456', '@', '"_d"', '"kl"', '"tags"']) assert.ok(!roh.includes(v), 'nicht im Index: ' + v);
    // Index bleibt Fassung 1 (dasselbe Format wie 0.1.0); die Themenliste aus 0.1.0 ist jetzt Fassung 2 – nichts verloren
    for (const j of [2022, 2023, 2024, 2025, 2026]) assert.equal(JSON.parse(await page.evaluate(p => __lies(p), `_LexiKit/lexikit-index-${j}.json`)).version, 1);
    const tStart = JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-themen.json')));
    assert.equal(tStart.version, 2);
    assert.deepEqual(tStart.themen.slice(0, THEMEN_010.themen.length), THEMEN_010.themen, 'Themen des Büros unverändert, auch der Lösch-Vermerk');
    assert.deepEqual(tStart.themen.slice(THEMEN_010.themen.length).map(x => [x.name, x.gruppe]), K.ERSTE_FAELLE.map(([n]) => [n, 'fall']));
    assert.equal(idx['26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx'].form, 'Untersuchungsbericht');

    /* ---------- 2. Fälle: Suche, Fallkarte, geöffneter Fall ---------- */
    await page.click('#btnSchonSuchen');
    await page.waitForSelector('#suche:not([hidden])');
    assert.deepEqual(await page.$$eval('#themen .thema span', x => x.map(e => e.textContent)), ['Löschpulver', 'Löschwasser', 'Brandschutt', 'Entsorgungswege', 'Abfallschlüssel', 'Asbest', 'Schimmel', 'Fäkalkeime', 'Parkett'], 'Themen des Büros aus 0.1.0, ohne das gelöschte');
    assert.deepEqual(await page.$$eval('#themenFall .thema span', x => x.map(e => e.textContent)), ['Photovoltaik', 'Lithium-Akku', 'Tiefgarage', 'Warenvorräte', 'Kühlhaus', 'Technische Einrichtung'], 'zweite Gruppe „Art des Falls“');
    assert.equal(await page.textContent('#ergebnisZeile'), 'Wähle ein Thema, beschreibe den Fall oder wähle unter „Untersucht auf“.');
    await page.waitForFunction(() => /^8 Fälle · 11 Berichte · aktuell$/.test(document.getElementById('stand').textContent));
    const faelleH = () => page.$$eval('.fall h2', x => x.map(e => e.textContent.slice(0, 7)));
    const LAGER = '24.0412 Musterlager Beispielheim Tst', karteVon = p => page.locator(`.fall[data-fall="${p}"]`);
    // Thema: Fälle statt Textstellen, Fund in der Veranlassung zuerst, nur Arbeitsschutz zuletzt
    await page.click('#themen [data-thema="t-löschpulver"]');
    assert.equal(await page.textContent('#ergebnisZeile'), '3 Fälle · ähnlichste zuerst');
    assert.deepEqual(await faelleH(), ['24.0412', '25.0300', '23.0700']);
    await page.waitForFunction(() => /^3 Fälle$/.test(document.querySelector('[data-thema="t-löschpulver"] small').textContent));
    const k1 = karteVon(LAGER);
    assert.equal(await k1.locator('.f-kopf .meta').textContent(), '2024 · 2 Mitteilungen', 'englische Fassung zählt nicht mit');
    assert.deepEqual(await k1.locator('.gitter .lab').allTextContents(), ['Was war', 'Untersucht']);
    assert.deepEqual(await k1.locator('.gitter mark').allTextContents(), ['Pulverlöscher', 'Löschpulver']);
    assert.deepEqual(await k1.locator('.tag').allTextContents(), ['12 Wischproben · Chlorid, Sulfat, Phosphat', '12 Wischproben · PAK', '1 Brandschuttmischprobe · DepV', '3 Materialproben · Brandgeruch', '6 Kontrollwischproben · Chlorid (2. Mitteilung)']);
    assert.deepEqual(await k1.locator('.f-knoepfe button').allTextContents(), ['Fall öffnen', 'Maßnahmen zeigen']);
    assert.deepEqual(await karteVon('23.0700 Beispielhalle Musterdorf Tst').locator('.f-knoepfe button').allTextContents(), ['Fall öffnen', 'Schlussfolgerungen zeigen'], 'ohne Sanierungsmaßnahmen: Schlussfolgerungen');
    await bild('2-thema-loeschpulver');
    // Thema + eigene Wörter
    await page.fill('#q', 'Lagerhalle Elektronik'); await page.waitForTimeout(400);
    assert.equal(await page.textContent('#ergebnisZeile'), '1 Fall · ähnlichste zuerst');
    assert.match(await page.textContent('#woerterZeile'), /^Thema Löschpulver \+ „Lagerhalle Elektronik“ · Thema bearbeiten$/);
    assert.equal(await page.locator('#themen [aria-pressed="true"] span').textContent(), 'Löschpulver', 'Thema bleibt gewählt');
    // Fall öffnen: Reiter nur für vorhandene Klassen, erster Reiter mit Fund, Verlauf mit englischer Fassung
    await k1.locator('[data-oeffnen=""]').click();
    assert.deepEqual(await k1.locator('.tab').allTextContents(), ['Veranlassung', 'Probenahme', 'Befund', 'Schlussfolgerungen', 'Sanierungsmaßnahmen', 'Arbeitsschutz']);
    assert.equal(await k1.locator('.tab[aria-selected="true"]').textContent(), 'Veranlassung');
    assert.deepEqual(await k1.locator('.gitter .lab').allTextContents(), ['Was war', 'Untersucht', 'Verlauf']);
    assert.match(await k1.locator('.gitter').nth(1).textContent(), /1\. Mitteilung · Sanierungsvorschlag → 1\. Mitteilung_Englisch · englische Fassung → 2\. Mitteilung · Untersuchungsbericht/);
    assert.deepEqual(await k1.locator('.block-kopf span').allTextContents(), ['1. Mitteilung · 1. Veranlassung', '1. Mitteilung · 2. Aufgabenstellung', '2. Mitteilung'], 'Einleitung der 2. Mitteilung steht unter „Veranlassung“');
    await k1.locator('[data-zu]').click();
    assert.equal(await k1.locator('.tab').count(), 0, 'wieder zu');
    // „Maßnahmen zeigen“
    await k1.locator('[data-oeffnen="massnahmen"]').click();
    assert.equal(await k1.locator('.tab[aria-selected="true"]').textContent(), 'Sanierungsmaßnahmen');
    assert.equal(await k1.locator('.block-kopf span').textContent(), '1. Mitteilung · 6. Sanierungsmaßnahmen');
    assert.deepEqual(await k1.locator('.txt mark').allTextContents(), ['Löschpulver']);
    assert.deepEqual(await k1.locator('.f-knoepfe .sp-knopf').allTextContents().then(a => a.map(s => s.trim())), ['Bericht in Word öffnen', 'Abschnitt kopieren', 'Projektordner', 'Für ChatGPT kopieren', 'Fall schließen'], 'ab 0.3.0 mit „Für ChatGPT kopieren“');
    assert.equal(await k1.locator('.f-knoepfe [data-word]').getAttribute('href'), 'ms-word:ofv|u|file:///C:/Daten/Mosaik%20Archivordner/24.0412%20Musterlager%20Beispielheim%20Tst/Mitteilungen/1.%20Mitteilung.docx');
    await k1.locator('[data-ordner]').click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'C:\\Daten\\Mosaik Archivordner\\24.0412 Musterlager Beispielheim Tst');
    await k1.locator('[data-kopieren]').click();   // ab 0.4.0 liest es erst den Berichtskopf (Namen → Platzhalter)
    for (let i = 0; i < 100 && (await page.evaluate(() => navigator.clipboard.readText())).startsWith('C:'); i++) await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '1. Mitteilung · 6. Sanierungsmaßnahmen\nDie mit Löschpulver beaufschlagten Oberflächen sind zunächst trocken abzusaugen. Eine feuchte Reinigung erfolgt erst danach.\nVor dem Rückbau ist die Dacheindeckung auf Asbest zu prüfen. Wir empfehlen Kontrollwischproben auf Chlorid.', 'Abschnitt kopieren: nur Zwischenablage');
    await bild('3-fall-offen');
    // Reiter Befund: beide Mitteilungen, Unterüberschrift bleibt im Befund
    await k1.locator('[data-tab="befund"]').click();
    assert.deepEqual(await k1.locator('.block-kopf span').allTextContents(), ['1. Mitteilung · 5. Befund', '1. Mitteilung · 5.1 Wischproben', '2. Mitteilung · Befunde']);
    assert.equal(await k1.locator('.block-kopf [data-word]').count(), 3, 'mehrere Berichte im Reiter: Word-Link je Block');
    // Schildchen „Untersucht“ zeigt die Stelle
    await k1.locator('.tag', { hasText: '1 Brandschuttmischprobe' }).click();
    assert.equal(await k1.locator('.tab[aria-selected="true"]').textContent(), 'Probenahme');
    assert.match(await k1.locator('p.fund').textContent(), /^Zusätzlich wurde eine Brandschuttmischprobe entnommen/);
    await k1.locator('.tag', { hasText: '6 Kontrollwischproben' }).click();
    assert.equal(await k1.locator('.tab[aria-selected="true"]').textContent(), 'Veranlassung');
    assert.match(await k1.locator('p.fund').textContent(), /sechs Kontrollwischproben entnommen/);
    assert.equal(await k1.locator('.block', { has: page.locator('p.fund') }).locator('.block-kopf span').textContent(), '2. Mitteilung');
    // weder Berichtskopf (beide Formen) noch englischer Text in irgendeinem Reiter
    let allerText = '';
    for (const k of ['veranlassung', 'probenahme', 'befund', 'schluss', 'massnahmen', 'arbeitsschutz']) { await k1.locator(`[data-tab="${k}"]`).click(); allerText += await k1.textContent(); }
    for (const v of ['Muster Sanierung', 'Beispielgasse', 'Musterweg 3', '12-3456', '@', 'Beispielperson', 'Muster Versicherung', 'forklift', 'warehouse']) assert.ok(!allerText.includes(v), 'nicht gezeigt: ' + v);
    await k1.locator('[data-zu]').click();
    // Thema abwählen (noch einmal antippen); englischer Text und Überschriften werden nicht gefunden
    await page.click('#themen [data-thema="t-löschpulver"]');
    assert.equal(await page.locator('#themen [aria-pressed="true"]').count(), 0);
    assert.equal(await page.textContent('#ergebnisZeile'), '1 Fall · ähnlichste zuerst', 'nur noch die eigenen Wörter');
    await page.fill('#q', 'Lagerhalle'); await page.waitForTimeout(400);
    assert.deepEqual(await faelleH(), ['24.0412', '23.0700'], 'Veranlassung und Aufgabenstellung zählen gleich, neueste zuerst');
    for (const wort of ['warehouse', 'Schlussfolgerungen']) {
      await page.fill('#q', wort); await page.waitForTimeout(400);
      assert.equal(await page.textContent('#ergebnisZeile'), 'Kein Fall gefunden', wort);
    }
    await page.fill('#q', 'Lagerhalle Kellerassel'); await page.waitForTimeout(400);
    assert.match(await page.textContent('.leer'), /keinen Fall\. Jedes Wort muss im Fall vorkommen/);
    await bild('4-leer');
    await page.fill('#q', ''); await page.waitForTimeout(400);
    // Filter „Untersucht auf“ (aus dem Wörterbuch, nur was erkannt wurde) und Jahr
    assert.deepEqual(await page.$$eval('#chips [data-param]', x => x.map(e => e.textContent)), ['PAK', 'Chlorid', 'Sulfat · Ammonium · Phosphat', 'Asbest', 'DepV', 'Schimmel', 'Fäkalkeime', 'Bakterien', 'Brandgeruch']);
    await page.click('#chips [data-param="sap"]');
    assert.equal(await page.textContent('#ergebnisZeile'), '2 Fälle · neueste zuerst');
    assert.deepEqual(await faelleH(), ['25.0300', '24.0412']);
    await page.click('#chips [data-param="chlorid"]');
    assert.deepEqual(await faelleH(), ['24.0412'], 'zwei Filter: beide');
    await page.click('#chips [data-param="chlorid"]');
    await page.click('#jahre [data-jahr="2025"]');
    assert.deepEqual(await faelleH(), ['25.0300']);
    await page.click('#jahre [data-jahr="2023"]');
    assert.equal(await page.textContent('#ergebnisZeile'), 'Kein Fall gefunden');
    assert.match(await page.textContent('.leer'), /keinen Fall aus 2023\..*Filter „Untersucht auf“ ist gesetzt/);
    await page.click('#jahre [data-jahr=""]'); await page.click('#chips [data-param="sap"]');
    assert.equal(await page.locator('#chips [aria-pressed="true"]').count(), 0);
    // Bericht ohne Überschriften: Zusammenfassung und ganzer Text, keine Reiter. Gebäude-Ordner: Stränge im Verlauf.
    await page.click('#themen [data-thema="t-asbest"]');
    assert.deepEqual(await faelleH(), ['25.0075', '22.0011', '24.0412', '24.0300', '23.0700'], '„Was war“ zählt ersatzweise wie die Veranlassung; nur Arbeitsschutz zuletzt');
    const k2 = karteVon('25.0075 Musterallee Beispielstadt Tst');
    assert.deepEqual(await k2.locator('.tag').allTextContents(), ['1 Materialprobe', 'Asbest']);
    assert.deepEqual(await k2.locator('.f-knoepfe button').allTextContents(), ['Fall öffnen'], 'kein „Maßnahmen zeigen“ ohne solchen Abschnitt');
    await k2.locator('[data-oeffnen]').click();
    assert.equal(await k2.locator('.tab').count(), 0, 'keine Reiter');
    assert.equal(await k2.locator('.block-kopf').first().textContent(), 'Bericht ohne Überschriften – ganzer Text');
    assert.equal(await k2.locator('.txt p').count(), 2, 'der ganze Text');
    await k2.locator('.tag', { hasText: 'Asbest' }).click();
    assert.match(await k2.locator('p.fund').textContent(), /Asbest wurde nachgewiesen/);
    const k3 = karteVon('24.0300 Musterhof Probedorf Tst');
    assert.equal(await k3.locator('.aus').textContent(), 'aus: Altbau · 1. Mitteilung', '„Was war“ nennt den Strang');
    await k3.locator('[data-oeffnen]').click();
    assert.equal(await k3.locator('.gitter').nth(1).innerText().then(s => s.replace(/\s+/g, ' ')), 'VERLAUF Altbau: 1. Mitteilung · Untersuchungsbericht Neubau: 1. Mitteilung · Untersuchungsbericht');
    assert.deepEqual(await k3.locator('.tab').allTextContents(), ['Veranlassung', 'Weiteres']);
    assert.equal(await k3.locator('.tab[aria-selected="true"]').textContent(), 'Weiteres', 'erster Reiter mit Fund');
    assert.equal(await k3.locator('.block-kopf span').textContent(), 'Neubau · 1. Mitteilung');
    await bild('5-straenge');
    await page.click('#themen [data-thema="t-asbest"]');

    /* ---------- 3. Themen: anlegen, anderer PC ändert, Konflikt, löschen ---------- */
    const themen = async () => JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-themen.json')));
    await page.click('#btnNeuesThema');
    await page.fill('#themaName', 'Estrich'); await page.fill('#themaWoerter', 'Trittschall\n');
    await page.check('input[name="themaGruppe"][value="fall"]');
    await page.waitForFunction(() => /^Findet jetzt: 3 Fälle$/.test(document.getElementById('themaZahl').textContent));
    await page.click('#btnThemaSpeichern');
    await page.waitForSelector('#themaForm', { state: 'hidden' });
    let t = await themen();
    assert.deepEqual(t.themen.at(-1).woerter, ['Trittschall']); assert.equal(t.themen.at(-1).name, 'Estrich'); assert.equal(t.themen.at(-1).gruppe, 'fall'); assert.equal(t.version, 2);
    assert.equal(await page.locator('#themenFall [aria-pressed="true"] span').textContent(), 'Estrich', 'steht in der Gruppe „Art des Falls“');
    assert.equal(await page.textContent('#ergebnisZeile'), '3 Fälle · ähnlichste zuerst');
    // anderer PC: ändert Asbest und legt „Gips“ an
    t.themen.find(x => x.name === 'Asbest').woerter = ['Chrysotil']; t.themen.find(x => x.name === 'Asbest').geaendert = '2099-01-01T00:00:00.000Z';
    t.themen.push({ id: 't-gips', name: 'Gips', woerter: ['Sulfat'], geaendert: '2099-01-01T00:00:00.000Z' });
    await page.evaluate(b => __schreib('_LexiKit/lexikit-themen.json', b), b64(JSON.stringify(t)));
    await page.click('#themen [data-thema="t-asbest"]');
    await page.click('[data-aktion="thema-bearbeiten"]');
    await page.fill('#themaWoerter', 'Amphibol'); await page.click('#btnThemaSpeichern');
    await page.waitForFunction(() => /an einem anderen PC geändert/.test(document.getElementById('themaFehler').textContent));
    assert.equal(await page.inputValue('#themaWoerter'), 'Chrysotil', 'Formular zeigt den neuen Stand');
    await page.fill('#themaWoerter', 'Chrysotil\nAmphibol'); await page.click('#btnThemaSpeichern');
    await page.waitForSelector('#themaForm', { state: 'hidden' });
    t = await themen();
    assert.deepEqual(t.themen.find(x => x.name === 'Asbest').woerter, ['Chrysotil', 'Amphibol']); assert.equal(t.themen.find(x => x.name === 'Asbest').gruppe, 'thema');
    assert.ok(t.themen.some(x => x.name === 'Gips') && t.themen.some(x => x.name === 'Estrich'), 'Thema des anderen PCs und eigenes bleiben');
    assert.ok(await page.locator('#themen [data-thema="t-gips"]').count(), 'Thema des anderen PCs erscheint');
    // löschen (mit Rückfrage im Ablauf, kein Browser-Dialog)
    await page.click('#themenFall [data-thema="t-estrich"]'); await page.click('[data-aktion="thema-bearbeiten"]');
    assert.equal(await page.isChecked('input[name="themaGruppe"][value="fall"]'), true, 'Formular zeigt die Gruppe');
    await page.click('#btnThemaLoeschen'); await page.click('#btnLoeschenJa');
    await page.waitForSelector('#themaForm', { state: 'hidden' });
    assert.equal(await page.locator('[data-thema="t-estrich"]').count(), 0);
    t = await themen(); assert.equal(t.themen.find(x => x.id === 't-estrich').geloescht, true, 'gelöscht bleibt als Vermerk');
    await bild('6-themen');

    /* ---------- 3b. Start mit vorhandenem Index: nichts wird neu eingelesen, kein Index neu geschrieben ---------- */
    const indexStand = async () => Object.fromEntries(Object.entries(await page.evaluate(() => __liste())).filter(([k]) => /^_LexiKit\/lexikit-index-/.test(k)));
    const idxVor = await indexStand(), themenVor = await page.evaluate(() => __lies('_LexiKit/lexikit-themen.json'));
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('#suche:not([hidden])'); await lauf();
    assert.equal(await page.evaluate(() => LexiKit.L.gelesen), 0, 'vorhandener Index (Fassung 1) reicht – kein Bericht neu gelesen');
    assert.deepEqual(await indexStand(), idxVor, 'Index-Dateien unberührt (Größe und Zeit)');
    assert.equal(await page.evaluate(() => __lies('_LexiKit/lexikit-themen.json')), themenVor, 'Themenliste der Fassung 2 wird nicht noch einmal geschrieben');
    await page.waitForFunction(() => /^8 Fälle · 11 Berichte · aktuell$/.test(document.getElementById('stand').textContent));
    await page.click('#themen [data-thema="t-löschpulver"]');
    assert.deepEqual(await faelleH(), ['24.0412', '25.0300', '23.0700'], 'Fälle direkt aus dem gespeicherten Index');
    await page.click('#themen [data-thema="t-löschpulver"]');

    /* ---------- 4. Nur Neues nachlesen ---------- */
    const lxZeit = async n => (await page.evaluate(() => __liste()))['_LexiKit/' + n];
    const z2026 = await lxZeit('lexikit-index-2026.json');
    await page.evaluate(() => LexiKit.einlesen({ alle: false })); await lauf();
    assert.equal(await page.evaluate(() => LexiKit.L.gelesen), 0, 'nichts geändert → nichts gelesen');
    let vorher2 = await projektDateien();
    await page.evaluate(b => __schreib('24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx', b), b64(docx(BERICHTE.fett, 0, 'neu')));
    await page.evaluate(() => __weg('25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung_korrigiert.docx'));
    vorher2 = await projektDateien();
    await page.evaluate(() => LexiKit.einlesen({ alle: false })); await lauf();
    assert.equal(await page.evaluate(() => LexiKit.L.gelesen), 2, 'geänderte Datei + wieder gültige erste Fassung');
    assert.equal(await page.evaluate(() => LexiKit.L.weg), 1);
    assert.equal(await lxZeit('lexikit-index-2026.json'), z2026, '2026 unverändert → nicht neu geschrieben');
    const i25 = JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-index-2025.json')));
    assert.deepEqual(Object.keys(i25.berichte).sort(), ['25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung.docx', '25.0300 Musterwerk Probestadt Tst/Mitteilungen/1. Mitteilung.docx']);
    assert.deepEqual(await projektDateien(), vorher2, 'Projektordner wieder unverändert');
    // Index eines anderen PCs bleibt beim Zusammenführen erhalten
    const i24 = JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-index-2024.json')));
    const fremd = '24.0300 Musterhof Probedorf Tst/Altbau/1. Mitteilung.docx';
    i24.berichte[fremd].gelesenAm = '2099-01-01T00:00:00.000Z'; i24.berichte[fremd].abschnitte = [{ h: 'Vom anderen PC', p: ['Text'] }];
    await page.evaluate(b => __schreib('_LexiKit/lexikit-index-2024.json', b), b64(JSON.stringify(i24)));
    await page.evaluate(b => __schreib('24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx', b), b64(docx(BERICHTE.ohne, 0, 'nochmal')));
    await page.evaluate(() => LexiKit.einlesen({ alle: false })); await lauf();
    const i24b = JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-index-2024.json')));
    assert.equal(i24b.berichte[fremd].abschnitte[0].h, 'Vom anderen PC', 'Eintrag des anderen PCs nicht überschrieben');

    /* ---------- 5. Archiv wechseln, während eingelesen wird (Codex-Hinweis PR #1) ---------- */
    const ZWEIT = '21.0001 Zweitarchiv Musterort Tst';
    await page.evaluate(async ([p, b]) => {
      const a2 = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv2', { create: true });
      await a2.getDirectoryHandle('_LexiKit', { create: true });
      const d = await (await a2.getDirectoryHandle(p, { create: true })).getDirectoryHandle('Mitteilungen', { create: true });
      const w = await (await d.getFileHandle('1. Mitteilung.docx', { create: true })).createWritable(); await w.write(Uint8Array.from(atob(b), c => c.charCodeAt(0))); await w.close();
    }, [ZWEIT, b64(docx(BERICHTE.ohne, 0, 'zweit'))]);
    await page.evaluate(() => { window.__langsam = true; LexiKit.einlesen({ alle: true }); });
    await page.waitForFunction(() => LexiKit.L.gelesen >= 1);
    await page.evaluate(async () => { const a2 = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv2'); await LexiKit.archivWechseln(a2); window.__langsam = false; });
    await lauf();
    assert.deepEqual(await page.evaluate(() => [...LexiKit.S.berichte.keys()]), [ZWEIT + '/Mitteilungen/1. Mitteilung.docx'], 'nur das neue Archiv im Speicher');
    const lx2 = await page.evaluate(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv2')).getDirectoryHandle('_LexiKit'); const aus = {};
      for await (const [n, h] of d.entries()) aus[n] = await (await h.getFile()).text(); return aus; });
    assert.deepEqual(Object.keys(lx2).sort(), ['lexikit-index-2021.json', 'lexikit-themen.json'], 'neues _LexiKit: nur Jahr 2021 und Themen');
    assert.deepEqual(Object.keys(JSON.parse(lx2['lexikit-index-2021.json']).berichte), [ZWEIT + '/Mitteilungen/1. Mitteilung.docx']);
    for (const j of [2022, 2023, 2024, 2025, 2026]) assert.ok(!(await page.evaluate(p => __lies(p), `_LexiKit/lexikit-index-${j}.json`)).includes('Zweitarchiv'), 'altes _LexiKit ohne Einträge des neuen Archivs: ' + j);
    const altIdx = {}; for (const j of [2022, 2023, 2024, 2025, 2026]) Object.assign(altIdx, JSON.parse(await page.evaluate(p => __lies(p), `_LexiKit/lexikit-index-${j}.json`)).berichte);
    assert.equal(Object.keys(altIdx).length, 11, 'altes Archiv: kein Bericht als „verschwunden“ entfernt');
    const t2 = JSON.parse(lx2['lexikit-themen.json']);
    assert.equal(t2.version, 2); assert.equal(t2.themen.length, 15, 'neue Themenliste: neun Themen und sechs „Art des Falls“');
    await page.click('#btnSchonSuchen'); await page.click('#themen [data-thema="t-asbest"]');
    assert.equal(await page.textContent('#ergebnisZeile'), '1 Fall · ähnlichste zuerst');
    assert.equal(await page.locator('.fall h2').first().textContent(), ZWEIT);

    /* ---------- 6. Schreibprobe schlägt fehl ---------- */
    await page.evaluate(() => sessionStorage.setItem('schreibprobe-kaputt', '1'));
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('#suche:not([hidden])');
    await page.waitForSelector('.meldung.err');
    assert.match(await page.textContent('.meldung.err'), /lässt sich nicht schreiben/);
    await lauf();
    assert.match(await page.textContent('#stand'), /nur in dieser Sitzung/);
    await page.click('#themen [data-thema="t-löschwasser"]');
    assert.equal(await page.textContent('#ergebnisZeile'), '1 Fall · ähnlichste zuerst', 'Suche geht trotzdem');
    await page.click('#btnNeuesThema'); await page.fill('#themaName', 'Test'); await page.click('#btnThemaSpeichern');
    assert.match(await page.textContent('#themaFehler'), /nicht gespeichert werden/);
    await bild('7-nur-lesen');

    /* ---------- 8. Für ChatGPT kopieren – eigenes Archiv mit erfundenen Fällen und Fallen ---------- */
    {
      const ctx2 = await browser.newContext({ viewport: { width: 1320, height: 1000 } });
      await ctx2.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
      await ctx2.addInitScript(initSkript);
      const p = await ctx2.newPage();
      p.on('pageerror', e => fehler.push(e.message)); p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
      p.on('dialog', d => { fehler.push('Browser-Dialog: ' + d.message()); d.dismiss(); });
      const bild2 = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); };
      await p.goto(url); await p.waitForSelector('#zugang:not([hidden])'); await p.evaluate(H);
      for (const [pfad, inhalt] of Object.entries(archivKopie())) await p.evaluate(([q, b]) => __schreib(q, b), [pfad, inhalt == null ? "" : b64(inhalt)]).catch(e => { throw new Error(pfad + ": " + e.message); });
      const dateien = async () => Object.fromEntries(Object.entries(await p.evaluate(() => __liste())).filter(([k]) => !k.startsWith('_LexiKit/')));
      const vorher2 = await dateien();
      await p.reload(); await p.evaluate(H);
      await p.waitForSelector('#einlesen:not([hidden])');
      await p.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende, null, { timeout: 30000 });
      await p.click('#btnSchonSuchen');
      await p.fill('#q', 'Musterfall');
      await p.waitForFunction(() => /^4 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      const box = o => p.locator(`.fall[data-fall="${o}"] [data-waehlen]`);
      // nichts in der Zwischenablage ohne Vorschau
      await p.evaluate(() => navigator.clipboard.writeText('VORHER'));
      assert.ok(await p.locator('#auswahlLeiste').isHidden(), 'ohne Auswahl keine Leiste');
      await box(KO.a).check(); await box(KO.b).check();
      assert.equal(await p.textContent('#auswahlText'), '2 Fälle ausgewählt');
      await box(KO.c).check();
      assert.equal(await p.textContent('#auswahlText'), '3 Fälle ausgewählt – mehr geht nicht');
      assert.ok(await box(KO.d).isDisabled(), 'höchstens 3 Fälle');
      // die Auswahl bleibt beim Weitersuchen
      await p.fill('#q', 'Kontrollwischproben'); await p.waitForFunction(() => /^1 Fall/.test(document.getElementById('ergebnisZeile').textContent));
      assert.equal(await p.textContent('#auswahlText'), '3 Fälle ausgewählt – mehr geht nicht');
      await p.fill('#q', 'Musterfall'); await p.waitForFunction(() => /^4 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      assert.ok(await box(KO.a).isChecked() && await box(KO.d).isDisabled());
      await box(KO.b).uncheck(); assert.ok(!(await box(KO.d).isDisabled())); await box(KO.d).check();
      await bild2('8-auswahl');
      await p.click('#btnAuswahlKopieren');
      await p.waitForSelector('#kopieren:not([hidden])');
      await p.waitForFunction(() => window.LexiKit.S.kopie && !window.LexiKit.S.kopie.laden);
      assert.equal(await p.evaluate(() => navigator.clipboard.readText()), 'VORHER', 'Öffnen der Vorschau kopiert nichts');
      // Fälle und Berichte: Bericht ohne Überschriften wird nicht mitkopiert, ohne erkannten Kopf erst abgewählt, englische Fassung fehlt
      assert.equal(await p.locator('#kopieFaelle [data-kfall]').count(), 3);
      const ber = await p.$$eval('#kopieFaelle [data-kber]', x => x.map(e => [e.closest('label').textContent.trim(), e.checked, e.disabled]));
      assert.deepEqual(ber.map(x => [x[0].replace(/\s+/g, ' ').split(' (')[0], x[1], x[2]]), [
        ['1. Mitteilung Ergänzung · Stellungnahme', false, true], ['1. Mitteilung · Sanierungsvorschlag', true, false], ['2. Mitteilung · Untersuchungsbericht', true, false],
        ['1. Mitteilung · Untersuchungsbericht', false, true], ['1. Mitteilung · Sanierungsvorschlag', false, false]]);
      const notizen = await p.$$eval('#kopieFaelle .knotiz', x => x.map(e => e.textContent));
      assert.ok(notizen.some(t => /ohne Überschriften – wird nicht mitkopiert/.test(t)) && notizen.some(t => /Berichtskopf nicht erkannt/.test(t)));
      const vor = () => p.textContent('#kopieVorschau');
      let t = await vor();
      for (const v of ['VERANLASSUNGSMARKE', 'AUFGABENMARKE', 'ORTSTERMINMARKE', 'EINLEITUNGSMARKE', 'EINLEITUNG2MARKE', 'ENGLISCHMARKE', 'WEITERESMARKE', 'OHNEMARKE',
        'Probemann', 'Lindtal', 'Probehausen', 'Hauptstr', '9988776', 'Sanierungstechnik', 'Kurzweg', ...Object.values(KO)]) assert.ok(!t.includes(v), 'nicht in der Vorschau: ' + v);
      assert.match(t, /\[23\.0450 · Untersucht\]\n2 Materialproben · Asbest/);
      assert.ok(!t.includes('[22.00999 · 1. Mitteilung') && t.includes('[22.00999 · Untersucht]'), 'Bericht ohne Kopf erst abgewählt, die Zeile „Untersucht“ des Falls bleibt');
      assert.match(await p.textContent('#kopieMeta'), /^ca\. [\d.]+ Zeichen · 3 Fälle · 5 Abschnitte · \d+ Namen ersetzt$/, "Arbeitsschutz ist erst abgewählt");
      assert.ok(await p.locator('#btnKopieKopieren').isDisabled(), 'Stellen offen → kein Kopieren');
      assert.match(await p.textContent('#kopieWarn'), /7 Stellen sehen nach einem Namen oder einer Adresse aus/);
      assert.match(await p.textContent('#kopieStatus'), /Noch 7 Stellen offen/);
      await bild2('9-vorschau-stellen');
      // Bericht ohne Kopf von Hand wählen: der Ordnername ersetzt auch dort den Namen
      await p.locator('#kopieFaelle [data-kber="2:0"]').check();
      t = await vor(); assert.ok(t.includes('[22.00999 · 1. Mitteilung · Befund]\nMusterfall: Herr [Projekt] zeigte uns den Keller.'));
      // Stellen abarbeiten: Satz entfernen, „Schimmel“ (Thema = Kopfwort) ist kein Name
      for (let i = 0; i < 12; i++) {
        const st = p.locator('#kopieWarn .kstelle').first(); if (!(await st.count())) break;
        if ((await st.locator('[data-zeige]').textContent()) === 'Schimmel') await st.locator('[data-ok]').click(); else await st.locator('[data-entfernen]').click();
      }
      assert.ok(await p.locator('#btnKopieKopieren').isEnabled(), 'alle Stellen erledigt');
      t = await vor();
      for (const v of ['Probenehmer', '02405', 'Kältebau', 'info@', 'Beispielallee']) assert.ok(!t.includes(v), 'Satz entfernt: ' + v);
      assert.ok(t.includes('Die Probe 24-123456 aus dem KG') && t.includes('Schimmel wurde in keiner Probe nachgewiesen.'), 'nur die Sätze mit Stellen fallen weg');
      assert.match(await p.textContent('#kopieWarn'), /4 entfernte Sätze zurückholen/);
      // Fragen: Vorlagen füllen die Frage; „Vergleich mit meinem Fall“ zeigt das Feld für den eigenen Fall – auch dort zählen Stellen
      await p.check('input[name="kFrage"][value="gemessen"]');
      assert.equal(await p.inputValue('#kFrageText'), 'Was wurde in diesen Fällen gemessen, mit wie vielen Proben, und warum? Welche Ergebnisse führten zu welchen Schlussfolgerungen?');
      assert.ok((await vor()).includes('Meine Frage: Was wurde in diesen Fällen gemessen'));
      await p.check('input[name="kFrage"][value="vergleich"]');
      assert.ok(await p.locator('#kFallBox').isVisible());
      await p.fill('#kMeinFall', 'Herr Meier hat eine Bäckerei mit Ofenbrand.');
      await p.waitForFunction(() => document.getElementById('btnKopieKopieren').disabled);
      assert.match(await p.textContent('#kopieWarn'), /1 Stelle sieht nach einem Namen/);
      assert.equal(await p.locator('#kopieWarn .kstelle [data-entfernen]').count(), 0, 'eigener Text: nicht entfernen, nur ändern oder bestätigen');
      await p.locator('#kopieWarn .kstelle [data-ok]').click();
      await bild2('10-vorschau-fertig');
      // Kopieren: die Zwischenablage ist genau die Vorschau
      await p.click('#btnKopieKopieren');
      await p.waitForFunction(() => /^Kopiert/.test(document.getElementById('kopieStatus').textContent));
      const ab = await p.evaluate(() => navigator.clipboard.readText());
      assert.equal(ab, await vor(), 'Zwischenablage = Vorschau');
      assert.ok(ab.startsWith('Du unterstützt ein Sachverständigenbüro') && ab.includes('\nMein Fall: Herr Meier hat eine Bäckerei mit Ofenbrand.\n\n--- Auszüge ---\n[25.0815 · Untersucht]'));
      for (const v of ['VERANLASSUNGSMARKE', 'ORTSTERMINMARKE', 'Probemann', 'Probenehmer', KO.a]) assert.ok(!ab.includes(v), 'nicht kopiert: ' + v);
      // Fall abwählen: fällt aus der Kopie
      await p.locator('#kopieFaelle [data-kfall="0"]').uncheck();
      assert.ok(!(await vor()).includes('[25.0815') && await p.locator('#kopieFaelle [data-kber="0:1"]').isDisabled());
      // zurück: Auswahl ist nach dem Kopieren leer; „Für ChatGPT kopieren“ im geöffneten Fall
      await p.click('#btnKopieZurueck'); await p.waitForSelector('#suche:not([hidden])');
      assert.ok(await p.locator('#auswahlLeiste').isHidden() && !(await box(KO.a).isChecked()));
      await p.locator(`.fall[data-fall="${KO.b}"] [data-oeffnen=""]`).click();
      await p.locator(`.fall[data-fall="${KO.b}"] [data-chatgpt]`).click();
      await p.waitForFunction(() => window.LexiKit.S.kopie && !window.LexiKit.S.kopie.laden);
      assert.equal(await p.locator('#kopieFaelle [data-kfall]').count(), 1);
      assert.match(await p.textContent('#kopieFaelle'), /Beispielstrasse 5 – in der Kopie „Gebäude 1“[\s\S]*Neubau – in der Kopie „Gebäude 2“/);
      t = await vor();
      // „Beispielstrasse 5“ steht im Kopf und im Ordnernamen – welcher Platzhalter, ist gleich
      assert.match(t, /\[24\.0777 · Gebäude 1 · 1\. Mitteilung · Befund\]\nMusterfall: Im Gebäude \[(?:Risikoort|Projekt)\] wurde Ruß festgestellt; Frau \[VN\] war nicht anwesend\.\n\[24\.0777 · Gebäude 1 · 1\. Mitteilung · Maßnahmen\][\s\S]*\[24\.0777 · Gebäude 2 · 1\. Mitteilung · Befund\]/);
      assert.ok(!/Beispielstra(?:ß|ss)e/.test(t) && !t.includes('Feldmohn') && !t.includes('Musterort'));
      // nichts in die Projektordner geschrieben, der Index bleibt Fassung 1 ohne Kopfwerte
      assert.deepEqual(await dateien(), vorher2, 'Projektordner unverändert');
      const lx = await p.evaluate(() => __liste());
      for (const k of Object.keys(lx).filter(k => /lexikit-index/.test(k))) {
        const j = await p.evaluate(q => __lies(q), k); assert.equal(JSON.parse(j).version, 1);
        // nur Werte, die allein im Berichtskopf stehen (der Index enthält Berichtstext – im Text genannte Namen stehen darin wie in 0.2.0)
        for (const v of ['Konrad', 'Probemann-Lindtal', 'Gerda', 'Hanna', 'Beispiel Versicherung AG', 'KV 9988776', '77-123 456/24', 'Musterweg 3']) assert.ok(!j.includes(v), k + ': ' + v);
      }
      await ctx2.close();
    }

    /* ---------- 9. „So machen wir es meist“ und „Unsere Absätze“ (ab 0.4.0) – eigenes Archiv mit fast gleichen Absätzen ---------- */
    {
      const { ABSATZ: AB, ABS_ORDNER: AO, archivAbsaetze } = require('./daten/berichte.cjs');
      const ctx3 = await browser.newContext({ viewport: { width: 1320, height: 1000 } });
      await ctx3.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
      await ctx3.addInitScript(initSkript);
      await ctx3.addInitScript(() => { window.LEXIKIT_NACHPRUEF_MS = 30; });   // Nachprüfung nach dem Schreiben: im Test kurz
      const p = await ctx3.newPage();
      p.on('pageerror', e => fehler.push(e.message)); p.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
      p.on('dialog', d => { fehler.push('Browser-Dialog: ' + d.message()); d.dismiss(); });
      const bild3 = async name => { if (BILDER) await p.screenshot({ path: path.join(BILDER, name + '.png'), fullPage: true }); };
      await p.goto(url); await p.waitForSelector('#zugang:not([hidden])'); await p.evaluate(H);
      for (const [pfad, inhalt] of Object.entries(archivAbsaetze())) await p.evaluate(([q, b]) => __schreib(q, b), [pfad, inhalt == null ? '' : b64(inhalt)]);
      // Kopier-Zähler, wie andere PCs sie hinterlassen haben: K1 dreimal vor gut einem Monat, die Fassung A fünfmal vor drei Jahren
      const tag = 864e5, vor = n => new Date(Date.now() - n * tag).toISOString(), w = x => K.absatzSchluessel(AB[x]);
      const kopien0 = { format: 'lexikit-kopien', version: 1, kopien: [...[1, 2, 3].map(i => ({ id: 'alt-k1-' + i, w: w('K1'), am: vor(30 + i) })), ...[1, 2, 3, 4, 5].map(i => ({ id: 'alt-a-' + i, w: w('A1'), am: vor(3 * 365 + i) }))] };
      await p.evaluate(b => __schreib('_LexiKit/lexikit-kopien.json', b), b64(JSON.stringify(kopien0)));
      const dateien3 = async () => Object.fromEntries(Object.entries(await p.evaluate(() => __liste())).filter(([k]) => !k.startsWith('_LexiKit/')));
      const vorher3 = await dateien3();
      await p.reload(); await p.evaluate(H);
      await p.waitForSelector('#einlesen:not([hidden])');
      await p.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende, null, { timeout: 30000 });
      await p.click('#btnSchonSuchen');
      await p.click('#themen [data-thema="t-löschpulver"]');
      await p.waitForFunction(() => /^5 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      // Praxisprofil
      assert.equal(await p.textContent('#profilTitel'), 'Löschpulver – so machen wir es meist');
      assert.match(await p.textContent('#profil .pr-kopf'), /aus 5 Fällen · 2022–2026/);
      assert.deepEqual(await p.$$eval('#profil .pr-bl', x => x.map(e => e.textContent)), ['Chlorid', 'PAK', 'Sulfat · Ammonium · Phosphat']);
      assert.deepEqual(await p.$$eval('#profil .pr-zahl', x => x.map(e => e.textContent)), ['5 von 5', '2 von 5', '1 von 5']);
      assert.deepEqual(await p.$$eval('#profil .pr-fakt', x => x.map(e => e.textContent)), ['Wischproben je Fallmeist 8 bis 10', 'Berichtsform3 × Sanierungsvorschlag\n2 × Untersuchungsbericht', 'Mitteilungen je Fallmeist 1', 'Mit Abschnitt Sanierungsmaßnahmen5 von 5']);
      // ein Klick auf einen Balken zeigt genau diese Fälle – derselbe Filter wie „Untersucht auf“; das Profil bleibt
      await p.click('#profil [data-param="pak"]');
      await p.waitForFunction(() => /^2 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      assert.match(await p.textContent('#profil .pr-kopf'), /aus 5 Fällen/);
      assert.equal(await p.getAttribute('#chips [data-param="pak"]', 'aria-pressed'), 'true');
      assert.deepEqual(await p.$$eval('.fall h2', x => x.map(e => e.textContent.slice(0, 7))), ['26.0544', '23.0100']);
      await p.click('#profil [data-param="pak"]');
      await p.waitForFunction(() => /^5 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      // Unsere Absätze: warten, bis verglichen ist
      await p.waitForSelector('#absaetze .ab-zeile');
      const tabs = () => p.$$eval('#absaetze .tab', x => x.map(e => e.textContent));
      const zeilen = () => p.$$eval('#absaetze .ab-zeile', x => x.map(e => ({ n: e.querySelector('.ab-zahl').firstChild.textContent.trim(), t: e.querySelector('.ab-text').textContent, meta: e.querySelector('.ab-meta').textContent, alt: e.classList.contains('alt'), kopieren: !!e.querySelector('[data-fkopieren]') })));
      const welche = z => z.map(x => Object.keys(AB).find(k => AB[k] === x.t) || x.t);
      assert.deepEqual(await tabs(), ['Sanierungsmaßnahmen · 8', 'Schlussfolgerungen · 1', 'Arbeitsschutz · 1']);
      assert.equal(await p.textContent('#absaetzeTitel'), 'Unsere Absätze zu Löschpulver');
      let z = await zeilen();
      // Oft verwendet: Kopien der letzten zwei Jahre; Gleichstand → Archiv, dann neuester
      assert.deepEqual(welche(z), ['K1', 'T1', 'A1', 'ALT', 'N1'], 'Oft verwendet (die ersten fünf)');
      assert.equal(z[0].n, '3 ×');
      assert.match(z[1].meta, /^zuletzt verwendet 2026 · in 2 Fällen im Archiv · 2 Fassungen seit 2025 · Ähnliche Absätze zeigen$/, 'T1 und T2 sind eine Familie');
      assert.equal(z[2].n, '0 ×', 'zwei Jahre: die fünf alten Kopien zählen nicht');
      assert.match(z[2].meta, /^zuletzt verwendet 2025 · in 2 Fällen im Archiv · 1 Fassung/, 'andere Anschrift und Probennummern: dieselbe Fassung in zwei Fällen');
      assert.equal(z[2].t, AB.A1, 'gezeigt wie geschrieben (neueste Stelle)');
      await p.click('#absaetze [data-aballe]');
      z = await zeilen();
      assert.equal(z.length, 8);
      for (const k of ['F1', 'K2', 'L1']) assert.ok(welche(z).includes(k), 'eigene Zeile: ' + k);
      assert.ok(z.find(x => x.t === AB.N1), 'Absatz mit Name und Anschrift wird gezeigt, wie er im Bericht steht');
      await p.click('#absaetze [data-sort="archiv"]');
      assert.deepEqual(welche(await zeilen()).slice(0, 4), ['T1', 'A1', 'ALT', 'K1'], 'Oft im Archiv');
      await p.click('#absaetze [data-sort="oft"]');
      await bild3('11-so-machen-wir-es-meist');
      // Kopieren: Platzhalter in der Zwischenablage, Liste zeigt den Text wie geschrieben, gezählt für genau diese Fassung
      await p.evaluate(() => navigator.clipboard.writeText('VORHER'));
      await p.click(`#absaetze [data-fkopieren="massnahmen|${w('N1')}"]`);
      for (let i = 0; i < 100 && (await p.evaluate(() => navigator.clipboard.readText())) === 'VORHER'; i++) await p.waitForTimeout(50);
      assert.equal(await p.evaluate(() => navigator.clipboard.readText()), 'Die Lagerhalle von Herrn [VN] am [Risikoort] ist vor der Wiederinbetriebnahme vollständig zu reinigen und abzunehmen.');
      assert.match(await p.textContent('#toast'), /\[VN\], \[Risikoort\] eingesetzt/);
      await p.waitForFunction(() => !window.LexiKit.S.abs.ausstehend.kopien.length);
      z = await zeilen();
      assert.deepEqual(welche(z).slice(0, 2), ['K1', 'N1'], 'eine Kopie: steht jetzt vor den Absätzen ohne Kopie');
      assert.equal(z[1].n, '1 ×'); assert.equal(z[1].t, AB.N1);
      const kop = JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-kopien.json')));
      assert.equal(kop.kopien.length, 9, 'alte Kopien bleiben, eine neue dazu');
      assert.equal(kop.kopien.filter(c => c.w === w('N1')).length, 1);
      // Abschnitt kopieren (Fallkarte) ersetzt jetzt auch
      await p.locator(`.fall[data-fall="${AO.p1}"] [data-oeffnen="massnahmen"]`).click();
      await p.evaluate(() => navigator.clipboard.writeText('VORHER'));
      await p.locator(`.fall[data-fall="${AO.p1}"] [data-kopieren]`).click();
      for (let i = 0; i < 100 && (await p.evaluate(() => navigator.clipboard.readText())) === 'VORHER'; i++) await p.waitForTimeout(50);
      const ab = await p.evaluate(() => navigator.clipboard.readText());
      assert.ok(ab.startsWith('1. Mitteilung · 4. Sanierungsmaßnahmen\n') && ab.includes('Herrn [VN] am [Risikoort]') && !ab.includes('Fenneberg') && !ab.includes('Lagerweg'), 'Abschnitt kopieren: ' + ab);
      await p.locator(`.fall[data-fall="${AO.p1}"] [data-zu]`).click();
      // Familie: Fassungen nach Zeitraum, Unterschied markiert, aktuelle oben
      await p.click(`#absaetze [data-familie="massnahmen|${w('T1')}"]`);
      await p.waitForSelector('#absatz:not([hidden])');
      assert.equal(await p.textContent('#absatzHaupt h1'), 'Ein Absatz, zwei Fassungen');
      assert.match(await p.textContent('#absatzHaupt .pr-kopf'), /zusammen 2 Berichte in 2 Fällen/);
      const fas = await p.$$eval('#absatzHaupt .fa-fassung', x => x.map(e => ({ jahr: e.querySelector('.fa-jahr').textContent, diff: [...e.querySelectorAll('.diff')].map(d => d.textContent), schild: [...e.querySelectorAll('.schild')].map(d => d.textContent) })));
      assert.deepEqual(fas, [{ jahr: '20261 Fall', diff: ['Lager'], schild: ['aktuelle Fassung'] }, { jahr: '20251 Fall', diff: ['Werk'], schild: [] }]);
      assert.equal(await p.textContent('#btnAbsatzZurueck'), 'Zurück zu Löschpulver');
      await bild3('12-familie');
      // Zweiter PC: setzt inzwischen „Vorbild“ auf K1 – LexiKit hat das noch nicht gelesen
      const fremd = { id: 'fremd-1', w: w('K1'), art: 'vorbild', wer: 'Ben', warum: 'So ist es klar.', am: vor(0), beispiel: AB.K1, k: 'massnahmen' };
      await p.evaluate(b => __schreib('_LexiKit/lexikit-markierungen.json', b), b64(JSON.stringify({ format: 'lexikit-markierungen', version: 1, marken: [fremd] })));
      // „So nicht mehr“ auf ALT: Grund ist Pflicht
      await p.click('#btnAbsatzZurueck'); await p.waitForSelector('#suche:not([hidden])');
      await p.click(`#absaetze [data-familie="massnahmen|${w('ALT')}"]`);
      await p.click(`#absatzHaupt [data-marke="nicht"]`);
      await p.waitForSelector('#markForm');
      assert.deepEqual(await p.$$eval('#mWer option', x => x.map(e => e.textContent)), ['– bitte wählen –', 'Dr. Ka', 'Ben'], 'nur aktive Personen aus der Mitarbeiterliste');
      await p.click('#btnMarkeOk');
      await p.waitForFunction(() => /Wer bist du/.test(document.getElementById('mFehler').textContent));
      await p.selectOption('#mWer', 'Dr. Ka');
      await p.click('#btnMarkeOk');
      await p.waitForFunction(() => /warum \(Pflicht\)/.test(document.getElementById('mFehler').textContent));
      await p.fill('#mWarum', 'Feuchtes Wischen verschmiert das Pulver.');
      await p.selectOption('#mStatt', w('T1'));
      await p.click('#btnMarkeOk');
      await p.waitForFunction(() => !document.getElementById('markForm'));
      let mk = JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-markierungen.json')));
      assert.deepEqual(mk.marken.map(m => [m.id === 'fremd-1' ? 'fremd' : 'eigen', m.art, m.wer]), [['fremd', 'vorbild', 'Ben'], ['eigen', 'nicht', 'Dr. Ka']], 'zweiter PC: beide Markierungen in der Datei');
      const eigen = mk.marken[1];
      assert.equal(eigen.w, w('ALT')); assert.equal(eigen.warum, 'Feuchtes Wischen verschmiert das Pulver.'); assert.equal(eigen.statt, w('T1')); assert.equal(eigen.beispiel, AB.ALT);
      assert.deepEqual(await p.$$eval('#absatzHaupt .fa-fassung .schild', x => x.map(e => e.textContent)), ['so nicht mehr']);
      assert.match(await p.textContent('#absatzHaupt .ab-notiz'), /Dr\. Ka, \d\d\.\d\d\.\d{4}: Feuchtes Wischen verschmiert das Pulver\. · Stattdessen: „Die mit Löschpulver/);
      assert.equal(await p.locator('#absatzHaupt [data-fkopieren]').count(), 0, '„so nicht mehr“: nicht zum Kopieren angeboten');
      // In der Liste: ans Ende, grau, mit Grund – Vorbild des anderen PCs ist da
      await p.click('#btnAbsatzZurueck'); await p.waitForSelector('#absaetze .ab-zeile');
      z = await zeilen();
      assert.deepEqual(welche(z).slice(-1), ['ALT']); assert.ok(z.at(-1).alt && !z.at(-1).kopieren);
      assert.match(z.at(-1).meta, /^so nicht mehrzuletzt verwendet 2024 · in 2 Fällen im Archiv/);
      assert.match(await p.textContent('#absaetze'), /Ans Ende gestellt · bleibt in Suche, Fall und Word sichtbar/);
      assert.match(z[0].meta, /^Vorbild/, 'Vorbild vom anderen PC übernommen');
      await bild3('13-so-nicht-mehr');
      // „so nicht mehr“ bleibt in der Suche und im Fall
      await p.fill('#q', 'klarem Wasser'); await p.waitForFunction(() => /^2 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      await p.locator(`.fall[data-fall="${AO.p3}"] [data-oeffnen="massnahmen"]`).click();
      assert.ok((await p.locator(`.fall[data-fall="${AO.p3}"] .txt`).textContent()).includes(AB.ALT), 'im Fall sichtbar');
      await p.locator(`.fall[data-fall="${AO.p3}"] [data-zu]`).click();
      await p.fill('#q', ''); await p.waitForFunction(() => /^5 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      // Zurücknehmen braucht Name und Grund, die Markierung bleibt als Verlauf
      await p.waitForSelector('#absaetze .ab-zeile');
      await p.click(`#absaetze [data-familie="massnahmen|${w('ALT')}"]`);
      await p.click('#absatzHaupt [data-marke="zurueck"]'); await p.waitForSelector('#markForm');
      assert.equal(await p.inputValue('#mWer'), 'Dr. Ka', 'eigener Name vom letzten Mal vorgewählt');
      await p.selectOption('#mWer', 'Ben');
      await p.click('#btnMarkeOk');
      await p.waitForFunction(() => /warum \(Pflicht\)/.test(document.getElementById('mFehler').textContent));
      await p.fill('#mWarum', 'Für Glasflächen passt es doch.');
      await p.click('#btnMarkeOk'); await p.waitForFunction(() => !document.getElementById('markForm'));
      assert.match(await p.textContent('#absatzHaupt .fa-fassung'), /So nicht mehr – Dr\. Ka, [\d.]+: Feuchtes Wischen verschmiert das Pulver\.[\s\S]*zurückgenommen – Ben, [\d.]+: Für Glasflächen passt es doch\./);
      assert.deepEqual(await p.$$eval('#absatzHaupt .fa-fassung .schild', x => x.map(e => e.textContent)), ['aktuelle Fassung'], 'nicht mehr markiert');
      mk = JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-markierungen.json')));
      assert.equal(mk.marken.length, 2); assert.equal(mk.marken[1].zurueck.wer, 'Ben'); assert.equal(mk.marken[1].warum, 'Feuchtes Wischen verschmiert das Pulver.', 'frühere Markierung bleibt');
      // Mitarbeiterliste fehlt / ist unlesbar: Markieren geht nicht, mit Hinweis
      await p.evaluate(() => __weg('_Spektron-Mitarbeiter.json'));
      await p.click('#absatzHaupt [data-marke="vorbild"]'); await p.waitForSelector('#markForm');
      assert.match(await p.textContent('#markForm'), /_Spektron-Mitarbeiter\.json fehlt im Archivordner\. Markieren geht erst, wenn sie da ist/);
      assert.equal(await p.locator('#btnMarkeOk').count(), 0);
      await p.click('#btnMarkeAbbrechen');
      await p.evaluate(b => __schreib('_Spektron-Mitarbeiter.json', b), b64('{kaputt'));
      await p.click('#absatzHaupt [data-marke="vorbild"]'); await p.waitForSelector('#markForm');
      assert.match(await p.textContent('#markForm'), /_Spektron-Mitarbeiter\.json ist nicht lesbar/);
      await p.click('#btnMarkeAbbrechen');
      // Einstellung „Ähnlichkeit“: umstellen gilt fürs Büro; Zähler und Markierungen bleiben
      await p.click('#btnAbsatzZurueck'); await p.waitForSelector('#absaetze .ab-zeile');
      await p.click('#mehr summary'); await p.click('[data-mehr="aehnlichkeit"]');
      await p.waitForSelector('#aehnlichkeitSeite:not([hidden])');
      assert.deepEqual(await p.$$eval('#stufen [data-stufe]', x => x.map(e => [e.dataset.stufe, e.getAttribute('aria-pressed')])), [['streng', 'false'], ['normal', 'true'], ['locker', 'false']]);
      await p.click('#stufen [data-stufe="locker"]');
      await p.waitForFunction(() => window.LexiKit.S.abs.stufe === 'locker' && window.LexiKit.S.abs.E);
      assert.equal(JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-einstellungen.json'))).aehnlichkeit, 'locker');
      await p.click('#aehnlichkeitSeite [data-zurueck]'); await p.waitForSelector('#absaetze .ab-zeile');
      z = await zeilen();
      assert.equal(z.length, 7, 'L1 gehört bei „locker“ zur Familie von T1');
      assert.match(z.find(x => x.t === AB.T1).meta, /in 3 Fällen im Archiv · 3 Fassungen seit 2023/);
      assert.equal(z.find(x => x.t === AB.N1).n, '1 ×', 'Kopier-Zähler bleibt');
      assert.match(z.find(x => x.t === AB.K1).meta, /^Vorbild/, 'Markierung bleibt');
      await p.click('#mehr summary'); await p.click('[data-mehr="aehnlichkeit"]'); await p.click('#stufen [data-stufe="normal"]');
      await p.waitForFunction(() => window.LexiKit.S.abs.stufe === 'normal' && window.LexiKit.S.abs.E);
      await p.click('#aehnlichkeitSeite [data-zurueck]'); await p.waitForSelector('#absaetze .ab-zeile');
      assert.equal((await zeilen()).length, 8);
      // „Fälle zeigen“: genau die Fälle der Familie aus dem ganzen Archiv
      await p.click(`#absaetze [data-fzeigen="massnahmen|${w('A1')}"]`);
      await p.waitForSelector('#nurLeiste:not([hidden])');
      assert.match(await p.textContent('#nurLeiste'), /^2 Fälle mit dem Absatz „Die Halle an der Musterstraße 5/);
      assert.deepEqual(await p.$$eval('.fall h2', x => x.map(e => e.textContent.slice(0, 7))), ['25.0712', '24.0300']);
      assert.ok(await p.locator('#profil').isHidden() && await p.locator('#absaetze').isHidden());
      await p.click('#nurLeiste [data-aktion="nur-aus"]');
      await p.waitForFunction(() => /^5 Fälle/.test(document.getElementById('ergebnisZeile').textContent));
      // Neu laden: alles aus den Dateien in _LexiKit
      await p.reload(); await p.evaluate(H); await p.waitForSelector('#suche:not([hidden])');
      await p.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende, null, { timeout: 30000 });
      await p.click('#themen [data-thema="t-löschpulver"]'); await p.waitForSelector('#absaetze .ab-zeile');
      z = await zeilen();
      assert.deepEqual(welche(z).slice(0, 2), ['K1', 'N1']); assert.match(z[0].meta, /^Vorbild/);
      // Nur in _LexiKit geschrieben; Projektordner unverändert; Index Fassung 1 ohne Kopfwerte
      assert.deepEqual(await dateien3(), Object.assign({}, vorher3, { '_Spektron-Mitarbeiter.json': (await dateien3())['_Spektron-Mitarbeiter.json'] }), 'Projektordner unverändert');
      const lx3 = Object.keys(await p.evaluate(() => __liste())).filter(k => k.startsWith('_LexiKit/')).sort();
      assert.deepEqual(lx3, ['_LexiKit/lexikit-einstellungen.json', '_LexiKit/lexikit-index-2022.json', '_LexiKit/lexikit-index-2023.json', '_LexiKit/lexikit-index-2024.json', '_LexiKit/lexikit-index-2025.json', '_LexiKit/lexikit-index-2026.json', '_LexiKit/lexikit-kopien.json', '_LexiKit/lexikit-markierungen.json', '_LexiKit/lexikit-themen.json']);
      for (const k of lx3.filter(k => /index/.test(k))) { const j = await p.evaluate(q => __lies(q), k); assert.equal(JSON.parse(j).version, 1); for (const v of ['Tobias', 'Probe Versicherung', '55-1234567', 'Gisela', '"_d"']) assert.ok(!j.includes(v), k + ': ' + v); }
      // Archiv wechseln, während ein Kopier-Zähler noch geschrieben wird (Codex-Hinweis PR #4): er landet im alten _LexiKit, nicht im neuen
      await p.evaluate(async ([pr, b]) => {
        const a2 = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv3', { create: true });
        await a2.getDirectoryHandle('_LexiKit', { create: true });
        const d = await (await a2.getDirectoryHandle(pr, { create: true })).getDirectoryHandle('Mitteilungen', { create: true });
        const wr = await (await d.getFileHandle('1. Mitteilung.docx', { create: true })).createWritable(); await wr.write(Uint8Array.from(atob(b), c => c.charCodeAt(0))); await wr.close();
      }, ['21.0002 Drittarchiv Musterort Tst', b64(require('./daten/berichte.cjs').docx(require('./daten/berichte.cjs').BERICHTE.ohne, 0, 'dritt'))]);
      await p.evaluate(() => { window.LEXIKIT_NACHPRUEF_MS = 1500; });   // Nachprüfung läuft noch, wenn gewechselt wird
      const vorWechsel = JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-kopien.json'))).kopien.length;
      await p.evaluate(() => navigator.clipboard.writeText('VORHER'));
      await p.click(`#absaetze [data-fkopieren="massnahmen|${w('T1')}"]`);
      await p.waitForFunction(() => window.LexiKit.S.abs.ausstehend.kopien.length > 0);
      await p.evaluate(async () => { const a3 = await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv3'); await LexiKit.archivWechseln(a3); });
      await p.waitForFunction(() => window.LexiKit && !window.LexiKit.L.aktiv && window.LexiKit.L.ende, null, { timeout: 30000 });
      await p.waitForTimeout(4000);   // die Nachprüfung (1,5 s) und ein möglicher zweiter Versuch sind vorbei
      const alt = JSON.parse(await p.evaluate(() => __lies('_LexiKit/lexikit-kopien.json'))).kopien;
      assert.equal(alt.length, vorWechsel + 1, 'Kopie im alten Archiv gezählt'); assert.equal(alt.at(-1).w, w('T1'));
      const neuLx = await p.evaluate(async () => { const d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv3')).getDirectoryHandle('_LexiKit'); const n = []; for await (const [k] of d.entries()) n.push(k); return n.sort(); });
      assert.deepEqual(neuLx, ['lexikit-index-2021.json', 'lexikit-themen.json'], 'neues _LexiKit ohne Kopien und Markierungen');
      assert.deepEqual(await p.evaluate(() => [LexiKit.S.abs.kopien.length, LexiKit.S.abs.ausstehend.kopien.length]), [0, 0], 'neuer Stand bleibt leer');
      await ctx3.close();
    }

    assert.deepEqual(fehler, [], 'keine Fehler in der Konsole');
    console.log('Browser: alle Schritte bestanden');
  } catch (e) {
    await bild('fehler').catch(() => {});
    console.error(fehler.join('\n')); throw e;
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
