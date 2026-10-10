/** Dependency-free static source checks. Browser interaction QA is still required. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const errors = [];
for (const file of ['site.js', 'docs.js', 'docs-content.js']) new vm.Script(read(file), { filename: file });
const scope = { window: {} };
vm.runInNewContext(read('docs-content.js'), scope, { timeout: 1000 });
const docs = scope.window.WORKBENCH_DOCS;
const ids = new Set();
for (const doc of docs) {
  if (!/^[a-z0-9-]+$/.test(doc.id) || ids.has(doc.id)) errors.push(`Invalid or duplicate guide ID: ${doc.id}`);
  ids.add(doc.id);
  if (!doc.title || !doc.description || !doc.body || !doc.minutes) errors.push(`Incomplete guide: ${doc.id}`);
}
let checked = 0;
const sources = [['index.html', read('index.html')], ['docs.html', read('docs.html')], ...docs.map(d => [`docs.html?guide=${d.id}`, d.body])];
for (const [file, html] of sources) {
  const anchorIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
  if (new Set(anchorIds).size !== anchorIds.length) errors.push(`Duplicate anchors in ${file}`);
  for (const [, ref] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    if (/^(https?:|mailto:|data:)/.test(ref)) continue;
    const url = new URL(ref, `http://site/${file}`);
    const name = decodeURIComponent(url.pathname.slice(1));
    const full = path.resolve(root, name);
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) { errors.push(`Missing local target: ${file} → ${ref}`); continue; }
    const guide = url.searchParams.get('guide');
    if (guide && !ids.has(guide)) errors.push(`Unknown guide: ${ref}`);
    if (url.hash) {
      const target = name === 'docs.html' && guide ? docs.find(d => d.id === guide)?.body || '' : read(name);
      const hash = decodeURIComponent(url.hash.slice(1));
      if (![...target.matchAll(/\bid=["']([^"']+)["']/g)].some(m => m[1] === hash)) errors.push(`Missing anchor: ${ref}`);
    }
    checked++;
  }
}
const release = JSON.parse(read('release.json'));
const expectedIds = ['windows-setup', 'windows-portable', 'macos-arm64', 'macos-x64', 'linux-deb'];
for (const id of expectedIds) if (!release.packages.some(p => p.id === id)) errors.push(`Missing download option ${id}`);
for (const item of release.packages) {
  if (item.url !== `dl/${item.filename}` || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isInteger(item.size) || item.size <= 0) errors.push(`Invalid manifest entry: ${item.id}`);
}
if (!read('index.html').includes(`v${release.version}`)) errors.push('Homepage and release version differ');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`OK: JavaScript syntax, ${docs.length} guides, ${checked} local links/anchors, ${release.packages.length} download entries.\nBinary availability and SHA-256 require: python3 scripts/release.py verify`);
