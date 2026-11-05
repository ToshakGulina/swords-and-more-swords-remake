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

function cloneSparse(url, dir, phases) {
  if (fs.existsSync(path.join(dir, '.git'))) {
    console.log(`refs: ${dir} already present`);
    return;
  }
  fs.mkdirSync(dir, {recursive: true});
  git('clone', '--depth', '1', '--filter=blob:none', '--sparse', url, dir);
  if (phases) execFileSync('git', phases, {cwd: dir, stdio: 'inherit'});
}

cloneSparse('https://github.com/Mojang/bedrock-samples.git',
  path.join(REFS, 'bedrock-samples'),
  ['sparse-checkout', 'set', 'resource_pack', 'behavior_pack', 'metadata']);
cloneSparse('https://github.com/Blockception/Minecraft-bedrock-json-schemas.git',
  path.join(REFS, 'schemas'));

if (!samplesOnly) {
  const original = path.join(ADDONS, '2.8.8');
  if (fs.existsSync(path.join(original, 'Swords_B'))) {
    console.log(`refs: ${original} already present`);
  } else {
    // The original addon is not in the repository and there is no public copy of
    // 2.8.8 to download, so this step only explains what to drop in place.
    console.log(
      `refs: MISSING original 2.8.8 — unpack "Swords and More Swords 2.8.8.mcaddon"\n` +
      `      into ${original} so that ${original}/Swords_B and ${original}/Swords_R exist.\n` +
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
