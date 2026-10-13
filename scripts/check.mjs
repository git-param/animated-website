// Post-build sanity check: every local asset referenced by dist/index.html exists, and bundle sizes are reported.
import fs from 'node:fs';
import path from 'node:path';
const dist = path.resolve(import.meta.dirname, '../dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('Run `npm run build` first.'); process.exit(1); }
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#?]+)"/g)].map((m) => m[1]);
const missing = refs.filter((r) => !fs.existsSync(path.join(dist, r)));
const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
let total = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : (total += fs.statSync(path.join(d, e.name)).size)));
walk(dist);
console.log(`Referenced local assets: ${refs.length}, missing: ${missing.length}`);
console.log(`External requests in HTML: ${external.length}${external.length ? ' -> ' + external.join(', ') : ''}`);
console.log(`dist size: ${(total / 1024).toFixed(0)} KB`);
if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
