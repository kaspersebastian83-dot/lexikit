// LexiKit im echten Browser (Chromium): Archivordner im privaten Dateisystem des Browsers (OPFS) mit erfundenen Berichten.
// Geprüft: erstes Einlesen, Auswahl der Berichte, Dateien in _LexiKit, nichts in den Projektordnern geändert, Suche,
// Themen anlegen/ändern/löschen mit einem „anderen PC“, nur Neues nachlesen, Schreibprobe schlägt fehl.
// node tests/browser.cjs   (Playwright wird in CI installiert; lokal: NODE_PATH auf ein playwright, CHROME=Pfad zu Chrome optional)
// LEXIKIT_BILDER=<Ordner> legt Bildschirmfotos ab.
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { archiv, docx, BERICHTE } = require('./daten/berichte.cjs');
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
  await context.addInitScript(() => {
    const orig = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (k) {
      if (k !== 'archiv' || this.name !== 'kv') return orig.call(this, k);
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      navigator.storage.getDirectory().then(r => r.getDirectoryHandle('Archiv')).then(
        h => { req.result = h; if (req.onsuccess) req.onsuccess({ target: req }); },
        () => { if (req.onsuccess) req.onsuccess({ target: req }); });
      return req;
    };
    if (sessionStorage.getItem('schreibprobe-kaputt')) {   // Schreibprobe in _LexiKit schlägt fehl
      const cw = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = function () { if (this.name.startsWith('.lexikit-schreibprobe')) return Promise.reject(new DOMException('Zugriff verweigert', 'NotAllowedError')); return cw.apply(this, arguments); };
    }
  });
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
    const vorher = await projektDateien();

    /* ---------- 1. Erster Start: Einlesen ---------- */
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('#einlesen:not([hidden])');
    await lauf();
    await bild('1-einlesen-fertig');
    assert.match(await page.textContent('#einZahl'), /6 Berichte im Index/);
    const lx = Object.keys(await page.evaluate(() => __liste())).filter(k => k.startsWith('_LexiKit/')).sort();
    assert.deepEqual(lx, ['_LexiKit/lexikit-index-2022.json', '_LexiKit/lexikit-index-2023.json', '_LexiKit/lexikit-index-2024.json', '_LexiKit/lexikit-index-2025.json', '_LexiKit/lexikit-index-2026.json', '_LexiKit/lexikit-themen.json'], 'nur Index und Themen in _LexiKit, Schreibprobe wieder weg');
    assert.deepEqual(await projektDateien(), vorher, 'in den Projektordnern hat sich nichts geändert');
    const idx = {}; for (const j of [2022, 2023, 2024, 2025, 2026]) Object.assign(idx, JSON.parse(await page.evaluate(p => __lies(p), `_LexiKit/lexikit-index-${j}.json`)).berichte);
    assert.deepEqual(Object.keys(idx).sort(), [
      '22.00114 Musterweg Beispielbad Tst/Mitteilungen/1.Mitteilung .docx',
      '23.0502 Baumarkt Musterstadt Tst/2. Mitteilung.docx',
      '24.0300 Musterhof Probedorf Tst/Altbau/1. Mitteilung.docx',
      '24.0300 Musterhof Probedorf Tst/Neubau/1. Mitteilung.docx',
      '25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung_korrigiert.docx',
      '26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx'], 'Auswahl: ohne Anschreiben, Entwurf, Gutachten_, ~$, PDF, .doc, ALT_2022, Sonstige; nur die korrigierte Fassung');
    const roh = JSON.stringify(idx);
    for (const v of ['Beispielperson', 'Beispielmensch', 'XY-0000', 'Muster Versicherung', 'Musterhausen', '_klein']) assert.ok(!roh.includes(v), 'nicht im Index: ' + v);
    assert.equal(idx['26.0137 Beispielweg Musterstadt Tst/Mitteilungen/1. Mitteilung.docx'].form, 'Untersuchungsbericht');

    /* ---------- 2. Suche ---------- */
    await page.click('#btnSchonSuchen');
    await page.waitForSelector('#suche:not([hidden])');
    assert.deepEqual(await page.$$eval('#themen .thema span', x => x.map(e => e.textContent)), ['Löschpulver', 'Löschmittel', 'Löschwasser', 'Brandschutt', 'Entsorgungswege', 'Abfallschlüssel', 'Asbest', 'Schimmel', 'Fäkalkeime']);
    assert.equal(await page.textContent('#ergebnisZeile'), 'Wähle ein Thema oder tippe ein Wort.');
    await page.click('#themen [data-thema="t-fäkalkeime"]');
    assert.match(await page.textContent('#ergebnisZeile'), /^4 Textstellen in 1 Bericht · neueste zuerst$/);
    const k1 = page.locator('.treffer').first();
    assert.equal(await k1.locator('.t-kopf b').textContent(), '26.0137 Beispielweg Musterstadt Tst');
    assert.equal(await k1.locator('.t-kopf span').textContent(), '2026 · 1. Mitteilung · Untersuchungsbericht');
    assert.equal(await k1.locator('.t-abschnitt').textContent(), 'Probenahme');
    assert.deepEqual(await page.$$eval('.treffer mark', x => [...new Set(x.map(e => e.textContent))]).then(a => a.sort()), ['E. coli', 'Enterokokken', 'Escherichia coli', 'Fäkalkeime', 'coliforme'].sort());
    assert.match(await page.textContent('#themen [data-thema="t-fäkalkeime"] small'), /4 Stellen/);
    const href = await k1.locator('[data-word]').getAttribute('href');
    assert.equal(href, 'ms-word:ofv|u|file:///C:/Daten/Mosaik%20Archivordner/26.0137%20Beispielweg%20Musterstadt%20Tst/Mitteilungen/1.%20Mitteilung.docx');
    await k1.locator('[data-ordner]').click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'C:\\Daten\\Mosaik Archivordner\\26.0137 Beispielweg Musterstadt Tst');
    await bild('2-thema-faekalkeime');
    // ganzer Abschnitt
    await page.click('#themen [data-thema="t-abfallschlüssel"]');
    const k2 = page.locator('.treffer').first();
    assert.equal(await k2.locator('.t-abschnitt').textContent(), '2. Befund');
    await k2.locator('[data-abschnitt]').click();
    assert.equal(await page.locator('.treffer').first().locator('.t-text p').count(), 3, 'Satz + zwei Tabellenzeilen');
    assert.equal(await page.locator('.treffer').first().locator('[data-abschnitt]').textContent(), 'Weniger zeigen');
    // eigene Suche + Jahr
    await page.fill('#q', 'Estrich'); await page.waitForTimeout(400);
    assert.match(await page.textContent('#ergebnisZeile'), /^2 Textstellen in 2 Berichten/);
    assert.equal(await page.locator('#themen [aria-pressed="true"]').count(), 0, 'eigene Suche: kein Thema gewählt');
    await page.click('#jahre [data-jahr="2023"]');
    assert.match(await page.textContent('#ergebnisZeile'), /^1 Textstelle in 1 Bericht/);
    await page.fill('#q', 'Kellerassel'); await page.waitForTimeout(400);
    assert.equal(await page.textContent('#ergebnisZeile'), 'Keine Textstelle gefunden');
    assert.match(await page.textContent('.leer'), /steht in den eingelesenen Berichten nichts aus 2023/);
    await bild('3-leer');
    await page.click('#jahre [data-jahr=""]'); await page.fill('#q', ''); await page.waitForTimeout(400);
    // Bericht ohne Überschriften: Treffer ohne Abschnittsnamen
    await page.click('#themen [data-thema="t-asbest"]');
    assert.ok((await page.$$eval('.treffer', x => x.map(e => !!e.querySelector('.t-abschnitt')))).includes(false));

    /* ---------- 3. Themen: anlegen, anderer PC ändert, Konflikt, löschen ---------- */
    const themen = async () => JSON.parse(await page.evaluate(() => __lies('_LexiKit/lexikit-themen.json')));
    await page.click('#btnNeuesThema');
    await page.fill('#themaName', 'Estrich'); await page.fill('#themaWoerter', 'Trittschall\n');
    await page.waitForFunction(() => /Findet jetzt: 2 Stellen in 2 Berichten/.test(document.getElementById('themaZahl').textContent));
    await page.click('#btnThemaSpeichern');
    await page.waitForSelector('#themaForm', { state: 'hidden' });
    let t = await themen();
    assert.deepEqual(t.themen.at(-1).woerter, ['Trittschall']); assert.equal(t.themen.at(-1).name, 'Estrich');
    assert.equal(await page.locator('#themen [aria-pressed="true"] span').textContent(), 'Estrich');
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
    assert.deepEqual(t.themen.find(x => x.name === 'Asbest').woerter, ['Chrysotil', 'Amphibol']);
    assert.ok(t.themen.some(x => x.name === 'Gips') && t.themen.some(x => x.name === 'Estrich'), 'Thema des anderen PCs und eigenes bleiben');
    assert.ok(await page.locator('#themen [data-thema="t-gips"]').count(), 'Thema des anderen PCs erscheint');
    // löschen (mit Rückfrage im Ablauf, kein Browser-Dialog)
    await page.click('#themen [data-thema="t-estrich"]'); await page.click('[data-aktion="thema-bearbeiten"]');
    await page.click('#btnThemaLoeschen'); await page.click('#btnLoeschenJa');
    await page.waitForSelector('#themaForm', { state: 'hidden' });
    assert.equal(await page.locator('#themen [data-thema="t-estrich"]').count(), 0);
    t = await themen(); assert.equal(t.themen.find(x => x.id === 't-estrich').geloescht, true, 'gelöscht bleibt als Vermerk');
    await bild('4-themen');

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
    assert.deepEqual(Object.keys(i25.berichte), ['25.0075 Musterallee Beispielstadt Tst/Mitteilungen/1. Mitteilung.docx']);
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

    /* ---------- 5. Schreibprobe schlägt fehl ---------- */
    await page.evaluate(() => sessionStorage.setItem('schreibprobe-kaputt', '1'));
    await page.reload(); await page.evaluate(H);
    await page.waitForSelector('#suche:not([hidden])');
    await page.waitForSelector('.meldung.err');
    assert.match(await page.textContent('.meldung.err'), /lässt sich nicht schreiben/);
    await lauf();
    assert.match(await page.textContent('#stand'), /nur in dieser Sitzung/);
    await page.click('#themen [data-thema="t-löschwasser"]');
    assert.match(await page.textContent('#ergebnisZeile'), /^2 Textstellen in 1 Bericht/, 'Suche geht trotzdem');
    await page.click('#btnNeuesThema'); await page.fill('#themaName', 'Test'); await page.click('#btnThemaSpeichern');
    assert.match(await page.textContent('#themaFehler'), /nicht gespeichert werden/);
    await bild('5-nur-lesen');

    assert.deepEqual(fehler, [], 'keine Fehler in der Konsole');
    console.log('Browser: alle Schritte bestanden');
  } catch (e) {
    await bild('fehler').catch(() => {});
    console.error(fehler.join('\n')); throw e;
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
