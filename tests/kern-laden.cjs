// Den Kern-Block aus index.html holen und in Node ausführen (die App bleibt eine einzige HTML-Datei).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('/* ===== LEXIKIT-KERN'), e = html.indexOf('/* ===== Ende LEXIKIT-KERN ===== */');
if (a < 0 || e < a) throw new Error('LEXIKIT-KERN-Block fehlt in index.html');
vm.runInThisContext(html.slice(a, e), { filename: 'index.html#kern' });
module.exports = globalThis.LexiKern;
