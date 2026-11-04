// Line-by-line parity report against the 2.8.8 original.
//
// Every file in the original pack is paired with its counterpart in `packs/`,
// then compared at field level (JSON) or byte level (everything else). The goal
// is not a pass/fail gate — the remake legitimately renames components and moves
// behaviour into scripts — but a complete, reviewable list of every deviation so
// none can hide.
//
//   node tools/parity_report.mjs            # summary by directory
//   node tools/parity_report.mjs items      # full field diff for a directory
//   node tools/parity_report.mjs --all      # full field diff for everything
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jsonc = require('jsonc-parser');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ORIGINAL = process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8';
const PACKS = path.join(ROOT, 'packs');

if (!fs.existsSync(ORIGINAL)) {
  console.error(`Original pack not found at ${ORIGINAL} (set SAMS_ORIGINAL)`);
  process.exit(1);
}

const filter = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const showAll = process.argv.includes('--all');

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  const errors = [];
  const value = jsonc.parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) throw new Error(`${path.basename(file)}: JSONC errors`);
  return value;
}

// Field-level comparison. Returns a list of `key: old -> new` strings.
function diffJson(a, b, prefix = '', out = []) {
  if (a === b) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a;
  const tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb) {
    out.push(`${prefix}: ${ta} -> ${tb}`);
    return out;
  }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${prefix}.length: ${a.length} -> ${b.length}`);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (i >= a.length) out.push(`${prefix}[${i}]: (missing) -> ${JSON.stringify(b[i])}`);
      else if (i >= b.length) out.push(`${prefix}[${i}]: ${JSON.stringify(a[i])} -> (removed)`);
      else diffJson(a[i], b[i], `${prefix}[${i}]`, out);
    }
    return out;
  }
  if (ta === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const next = prefix ? `${prefix}.${k}` : k;
      if (!(k in a)) out.push(`${next}: (missing) -> ${JSON.stringify(b[k])}`);
      else if (!(k in b)) out.push(`${next}: ${JSON.stringify(a[k])} -> (removed)`);
      else diffJson(a[k], b[k], next, out);
    }
    return out;
  }
  out.push(`${prefix}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  return out;
}

const files = walk(ORIGINAL);
const report = { same: [], changed: [], missing: [], binarySame: 0, binaryDiff: [] };

for (const rel of files) {
  const origFile = path.join(ORIGINAL, rel);
  const newFile = path.join(PACKS, rel);
  const isJson = rel.endsWith('.json');

  if (!fs.existsSync(newFile)) {
    report.missing.push(rel);
    continue;
  }

  if (!isJson) {
    const a = fs.readFileSync(origFile);
    const b = fs.readFileSync(newFile);
    if (a.equals(b)) report.binarySame++;
    else report.binaryDiff.push({ rel, sizes: `${a.length} -> ${b.length}` });
    continue;
  }

  let a;
  let b;
  try {
    a = readJson(origFile);
    b = readJson(newFile);
  } catch (e) {
    report.changed.push({ rel, diffs: [`unparsable: ${e.message}`] });
    continue;
  }

  const diffs = diffJson(a, b);
  if (diffs.length === 0) report.same.push(rel);
  else report.changed.push({ rel, diffs });
}

const byDir = (rel) => rel.split('/').slice(0, 2).join('/');
const groups = new Map();
for (const rel of report.same) {
  const g = byDir(rel);
  groups.set(g, { ...(groups.get(g) ?? { same: 0, changed: 0, missing: 0 }), same: (groups.get(g)?.same ?? 0) + 1 });
}
for (const { rel } of report.changed) {
  const g = byDir(rel);
  groups.set(g, { ...(groups.get(g) ?? { same: 0, changed: 0, missing: 0 }), changed: (groups.get(g)?.changed ?? 0) + 1 });
}
for (const rel of report.missing) {
  const g = byDir(rel);
  groups.set(g, { ...(groups.get(g) ?? { same: 0, changed: 0, missing: 0 }), missing: (groups.get(g)?.missing ?? 0) + 1 });
}

console.log(`Original files: ${files.length}`);
console.log(`  identical JSON:   ${report.same.length}`);
console.log(`  changed JSON:     ${report.changed.length}`);
console.log(`  missing:          ${report.missing.length}`);
console.log(`  identical binary: ${report.binarySame}`);
console.log(`  changed binary:   ${report.binaryDiff.length}`);
console.log('');
console.log('directory                       same  changed  missing');
for (const [g, c] of [...groups].sort((x, y) => (y[1].changed + y[1].missing) - (x[1].changed + x[1].missing))) {
  console.log(`${g.padEnd(30)} ${String(c.same).padStart(5)} ${String(c.changed).padStart(8)} ${String(c.missing).padStart(8)}`);
}

if (report.missing.length > 0) {
  console.log('\n--- missing files ---');
  for (const rel of report.missing) console.log(rel);
}

if (report.binaryDiff.length > 0) {
  console.log('\n--- changed binaries ---');
  for (const { rel, sizes } of report.binaryDiff) console.log(`${rel}  (${sizes} bytes)`);
}

const wanted = showAll ? report.changed : report.changed.filter((c) => !filter || c.rel.includes(filter));
if (wanted.length > 0) {
  console.log(`\n--- field diffs (${wanted.length} files) ---`);
  for (const { rel, diffs } of wanted) {
    console.log(`\n### ${rel}  (${diffs.length} fields)`);
    const limit = showAll || filter ? diffs.length : Math.min(diffs.length, 8);
    for (const d of diffs.slice(0, limit)) console.log(`  ${d}`);
    if (diffs.length > limit) console.log(`  ... ${diffs.length - limit} more`);
  }
}
