// Spektron-Look byte-gleich mit BerichtKit, Offline-Dateien vollständig, kein Netz in der App.
// node tests/dateien.cjs   (liegt ../berichtkit daneben, wird der Look verglichen; mit LEXIKIT_LOOK_PFLICHT=1 muss es daneben liegen)
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 1. Spektron-Look
const look = t => { const a = t.indexOf('/* ===== SPEKTRON-LOOK v'), e = t.indexOf('/* ===== Ende SPEKTRON-LOOK v'); return a < 0 || e < 0 ? null : t.slice(a, e); };
const eigen = look(html);
assert.ok(eigen && eigen.startsWith('/* ===== SPEKTRON-LOOK v1'), 'Look-Block v1 in index.html');
assert.equal(html.split('/* ===== SPEKTRON-LOOK v').length, 2, 'Look-Block genau einmal');
assert.match(html.slice(html.indexOf('/* ===== Ende SPEKTRON-LOOK v')), /--sp-app:#[0-9a-f]{6};\s*--sp-app-dunkel:#[0-9a-f]{6}/i, 'App-Farbe nach dem Block');
const bk = path.join(ROOT, '..', 'berichtkit', 'index.html');
if (fs.existsSync(bk)) assert.equal(eigen, look(fs.readFileSync(bk, 'utf8')), 'Spektron-Look nicht byte-gleich mit BerichtKit');
else assert.ok(!process.env.LEXIKIT_LOOK_PFLICHT, '../berichtkit fehlt – Look nicht verglichen');
// 2. Offline: jede Datei im Service Worker gibt es, jede eingebundene Datei ist dabei
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(ROOT, a)), 'fehlt: ' + a);
for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) assert.ok(assets.includes('./' + m[1]), 'nicht offline: ' + m[1]);
// 3. Kein Netz: keine Netzaufrufe in der App, Inhaltsregel lässt nur die eigene Adresse zu
for (const v of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', 'import(']) assert.ok(!html.includes(v), 'Netzaufruf in index.html: ' + v);
assert.match(html, /connect-src 'self'/);
assert.ok(!/<script[^>]+src="https?:/.test(html), 'kein fremdes Skript');
console.log(`Dateien: Look ${fs.existsSync(bk) ? 'gleich wie BerichtKit' : '(BerichtKit nicht daneben)'}, ${assets.length} Offline-Dateien, kein Netz`);
