// Compare all generated item identities and key properties to the unpacked original.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {parse} = createRequire(import.meta.url)('jsonc-parser');
const original = path.join(process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8', 'Swords_B/items');
const generated = 'packs/Swords_B/items';
// Swords whose 2.8.8 right-click behaviour lives in `player.json` rather than in
// `minecraft:on_use`, plus the ones that do have `on_use`.
const SKILL_ON_USE = new Set(['blaze_sword','clock_sword','creeper_sword','ender_sword','fire_sword','ghost_sword','ice_sword','lightning_sword','shulker_sword','spectral_sword','spider_sword','tnt_sword','ultra_instinct_sword','wither_sword']);
// `slime_sword` and `sponge_sword` are driven entirely by `player.json` in 2.8.8.
const SKILL_ONLY_SWORDS = new Set();
const files = fs.readdirSync(original).filter(x => x.endsWith('.json')).sort();
assert.equal(files.length,42);
assert.deepEqual(fs.readdirSync(generated).filter(x => x.endsWith('.json')).sort(), files);
for (const f of files) {
  const old = parse(fs.readFileSync(path.join(original,f),'utf8'))['minecraft:item'];
  const cur = JSON.parse(fs.readFileSync(path.join(generated,f),'utf8'))['minecraft:item'];
  assert.equal(cur.description.identifier,old.description.identifier,f);
  const a=old.components,b=cur.components;
  for (const [key, field] of [['minecraft:durability','max_durability'],['minecraft:cooldown','duration'],['minecraft:cooldown','category']]) {
    if (a[key]) assert.equal(b[key]?.[field],a[key][field],`${f}: ${key}.${field}`);
  }
  if (typeof a['minecraft:damage']==='number' && a['minecraft:damage']>=1)
    assert.equal(b['minecraft:damage']?.value,Math.floor(a['minecraft:damage']),`${f}: base damage`);
  if (a['minecraft:max_stack_size']!==undefined)
    assert.equal(b['minecraft:max_stack_size'],a['minecraft:max_stack_size'],`${f}: stack size`);
  // A lost `block_placer` silently removes the Jungle Sword's tree planting.
  if (a['minecraft:block_placer']) {
    assert.equal(b['minecraft:block_placer']?.block,a['minecraft:block_placer'].block,`${f}: block_placer.block`);
    assert.equal(b['minecraft:block_placer']?.use_on?.length,
      (a['minecraft:block_placer'].use_on ?? []).length,`${f}: block_placer.use_on`);
  }
  // The original drives combat from `minecraft:weapon`; nothing needs `on_use`
  // in 1.26 because every right-click skill lives in a script component.
  assert.ok(!b['minecraft:on_use'],`${f}: minecraft:on_use is legacy in 1.26`);
  // A sword that had no `on_use` in 2.8.8 must not gain a right-click skill in
  // the script either: the skill set has to stay identical to the original.
  assert.equal(SKILL_ON_USE.has(f.slice(0,-5)), Boolean(a['minecraft:on_use']) || SKILL_ONLY_SWORDS.has(f.slice(0,-5)),
    `${f}: right-click skill set differs from 2.8.8`);
}
console.log('Original item identity, damage, durability, cooldown and stack size: 42/42 OK');
