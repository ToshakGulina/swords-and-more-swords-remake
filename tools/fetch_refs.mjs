// Rebuild the out-of-repo references the parity tooling needs.
//
// Nothing under /tmp survives a sandbox restart, and none of the references may be
// committed: the 2.8.8 original is Effect99's addon and bedrock-samples plus the
// Blockception schemas are ~1 GB of upstream sources. This script fetches them on
// demand and prints the environment variables the other tools honour.
//
//   node tools/fetch_refs.mjs                 # /tmp/mcaddons/2.8.8 + /tmp/refs
//   node tools/fetch_refs.mjs --samples-only   # only the Mojang + Blockception refs
//
// `validate` needs /tmp/refs/bedrock-samples and /tmp/refs/schemas; `npm test` only
// needs the 2.8.8 original for tools/test_original_items.mjs (it skips otherwise).
import fs from 'fs';
import path from 'path';
import {execFileSync} from 'child_process';

const REFS = process.env.SAMS_REFS ?? '/tmp/refs';
const ADDONS = process.env.SAMS_MCADDONS ?? '/tmp/mcaddons';
const samplesOnly = process.argv.includes('--samples-only');

const git = (...args) => execFileSync('git', args, {stdio: 'inherit'});

const REQUIRED = {
  [path.join(REFS, 'bedrock-samples')]: ['behavior_pack/entities/zombie.json', 'resource_pack/textures/terrain_texture.json'],
  [path.join(REFS, 'schemas')]: ['behavior/items/items.json', 'behavior/blocks/blocks.json'],
};

function cloneSparse(url, dir, phases) {
  // A sparse clone is only useful when its checkout really contains the files the
  // validators read. A half-applied sparse-checkout leaves a directory that looks
  // installed but is 2% of the tree, and `validate` then reports six bogus schema
  // errors. Verify, repair, and only then report success.
  const present = fs.existsSync(path.join(dir, '.git'));
  if (present) {
    const missing = (REQUIRED[dir] ?? []).filter((rel) => !fs.existsSync(path.join(dir, rel)));
    if (missing.length === 0) {
      console.log(`refs: ${dir} already present`);
      return;
    }
    console.log(`refs: ${dir} is incomplete (${missing.join(', ')}) — repairing`);
    execFileSync('git', ['sparse-checkout', 'disable'], {cwd: dir, stdio: 'inherit'});
  } else {
    fs.mkdirSync(dir, {recursive: true});
    git('clone', '--depth', '1', '--filter=blob:none', '--sparse', url, dir);
    if (phases) execFileSync('git', phases, {cwd: dir, stdio: 'inherit'});
  }
  const still = (REQUIRED[dir] ?? []).filter((rel) => !fs.existsSync(path.join(dir, rel)));
  if (still.length > 0) {
    throw new Error(`refs: ${dir} still missing ${still.join(', ')} after checkout`);
  }
}

cloneSparse('https://github.com/Mojang/bedrock-samples.git',
  path.join(REFS, 'bedrock-samples'),
  ['sparse-checkout', 'set', 'resource_pack', 'behavior_pack', 'metadata']);
cloneSparse('https://github.com/Blockception/Minecraft-bedrock-json-schemas.git',
  path.join(REFS, 'schemas'));

if (!samplesOnly) {
  // The original addon lives in the user's Google Drive folder "Swords and more
  // swords" and is NOT in the repository: it is Effect99's work, and the parity
  // tools only need it locally. A .mcaddon is a zip, so an already-fetched
  // archive is reused instead of calling Drive again on every restart.
  const original = path.join(ADDONS, '2.8.8');
  const archive = path.join(ADDONS, 'swordsandmoreswords_2_8_8.mcaddon');
  if (fs.existsSync(path.join(original, 'Swords_B'))) {
    console.log(`refs: ${original} already present`);
  } else if (fs.existsSync(archive)) {
    fs.mkdirSync(original, {recursive: true});
    execFileSync('unzip', ['-q', '-o', archive, '-d', original], {stdio: 'inherit'});
    console.log(`refs: unpacked ${archive} into ${original}`);
  } else {
    console.log(
      `refs: MISSING original 2.8.8 — download "swordsandmoreswords_2_8_8.mcaddon"\n` +
      `      from the Google Drive folder "Swords and more swords" to ${archive}\n` +
      `      (or unpack it into ${original} yourself).\n` +
      `      tools/test_original_items.mjs skips without it; nothing else needs it.`
    );
  }
}

console.log(`
Point the tools at these paths if they are not the defaults:
  SAMS_SAMPLES=${path.join(REFS, 'bedrock-samples')}
  SAMS_SCHEMAS=${path.join(REFS, 'schemas')}
  SAMS_ORIGINAL=${path.join(ADDONS, '2.8.8')}
`);
