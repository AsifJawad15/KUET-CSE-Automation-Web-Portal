const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const manifest = require('../docs/migration-manifest.json');
const expectedAcademic = manifest.files.filter(item => item.path.startsWith('supabase/migrations/'));
const actualAcademic = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
const expectedNames = expectedAcademic.map(item => path.basename(item.path)).sort();
const errors = [];
if (JSON.stringify(actualAcademic) !== JSON.stringify(expectedNames)) {
  errors.push('The academic migration filenames do not match docs/migration-manifest.json.');
}
for (const item of manifest.files) {
  const file = path.join(root, item.path);
  if (!fs.existsSync(file)) {
    errors.push(`Missing ${item.path}`);
    continue;
  }
  // Normalize line endings so a Git checkout on Windows and Linux agrees.
  const sql = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const digest = createHash('sha256').update(sql).digest('hex');
  if (digest !== item.sha256) errors.push(`Checksum mismatch: ${item.path}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error('Restore the complete evaluated SQL set. Do not run historical schema snapshots as a substitute.');
  process.exitCode = 1;
} else {
  console.log(`Verified ${expectedAcademic.length} academic migrations and the separate CMS boundary (SHA-256, LF-normalized).`);
}
