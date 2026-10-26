'use strict';

// Checks that every translation key the UI uses exists in both languages and that both languages define the same keys.
//   node scripts/verify-i18n.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ui = path.join(__dirname, '..', 'ui');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ui, 'i18n.js'), 'utf8'), sandbox);
const { en, zh } = sandbox.window.I18N;

const html = fs.readFileSync(path.join(ui, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ui, 'app.js'), 'utf8');
const used = new Set();
for (const m of html.matchAll(/data-i18n(?:-title)?="(\w+)"/g)) used.add(m[1]);
for (const m of js.matchAll(/\b(?:t\(|setStatus\(|[A-Za-z]*[kK]ey:\s*)'(\w+)'/g)) used.add(m[1]);

const problems = [];
for (const key of used) {
  if (!(key in en)) problems.push(`missing in en: ${key}`);
  if (!(key in zh)) problems.push(`missing in zh: ${key}`);
}
for (const key of Object.keys(en)) if (!(key in zh)) problems.push(`only in en: ${key}`);
for (const key of Object.keys(zh)) if (!(key in en)) problems.push(`only in zh: ${key}`);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n ok: ${used.size} keys used, ${Object.keys(en).length} defined per language`);
