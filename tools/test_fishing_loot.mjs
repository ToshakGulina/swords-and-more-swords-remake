// Fishing and elder-guardian loot parity with 2.8.8.
//
// Two things went wrong here in the Remake:
//  * `minecraft:waterlily` lived in the JUNK pool at weight 17, while 2.8.8 had it in
//    the TREASURE pool at weight 5. The lily had effectively become the most common
//    junk drop instead of a rare treasure.
//  * the extra `clownfish` / `pufferfish` entries in `jungle_fish` are legitimately
//    part of the modern vanilla table, so they must NOT be stripped back.
// The elder guardian sponge is checked too: 2.8.8 wrote `minecraft:sponge` with
// `set_data 1`, which is the legacy spelling of a wet sponge, so the modern
// `minecraft:wet_sponge` entry is the correct translation.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loot = (p) => JSON.parse(fs.readFileSync(`packs/Swords_B/loot_tables/${p}`, 'utf8'));
const entries = (t, pool = 0) => t.pools[pool].entries;
const find = (t, name, pool = 0) => entries(t, pool).find((e) => e.name === name);

// --- Fishing: treasure keeps the 2.8.8 lily, junk does not invent one -------------
const treasure = loot('gameplay/fishing/treasure.json');
assert.equal(find(treasure, 'minecraft:waterlily')?.weight ?? 1, 5,
  '2.8.8 treasure pool has the lily at weight 5');
assert.equal(find(treasure, 'effect:jungle_sword')?.weight, 5,
  '2.8.8 treasure pool has the Jungle Sword at weight 5');
assert.equal(entries(treasure).length, 8, 'eight treasure entries, as in 2.8.8');

const junk = loot('gameplay/fishing/junk.json');
assert.equal(find(junk, 'minecraft:waterlily'), undefined,
  'the junk pool must not contain a lily');
// `minecraft:dye` + `set_data 0` became `minecraft:ink_sac`, both at weight 1.
// weight 1 is the loot-table default, so the entry may omit it
assert.equal(find(junk, 'minecraft:ink_sac')?.weight ?? 1, 1, 'ink sac keeps the 2.8.8 weight');
assert.equal(find(junk, 'minecraft:dye')?.weight ?? 1, 1, 'the modern dye entry is kept as well');

// --- Fishing: jungle_fish keeps the modern vanilla fish --------------------------
const jungleFish = loot('gameplay/fishing/jungle_fish.json');
for (const [name, weight] of [['minecraft:fish', 60], ['minecraft:salmon', 40],
  ['minecraft:clownfish', 2], ['minecraft:pufferfish', 13]]) {
  assert.equal(find(jungleFish, name)?.weight, weight, `${name} keeps weight ${weight}`);
}

// --- Elder guardian: wet sponge is the translated 2.8.8 sponge -------------------
const guardian = loot('entities/elder_guardian.json');
const wet = guardian.pools.flatMap((p) => p.entries).find((e) => e.name === 'minecraft:wet_sponge');
assert.ok(wet, 'elder guardian still drops a sponge');
assert.equal(wet.functions, undefined, 'no legacy set_data left behind');
assert.equal(wet.weight, 1, '2.8.8 sponge weight');
const spongeSword = guardian.pools.flatMap((p) => p.entries).find((e) => e.name === 'effect:sponge_sword');
assert.equal(spongeSword.weight, 1, 'the Sponge Sword drop is preserved');

console.log('Loot: fishing lily back in treasure, ink sac translated, guardian sponge intact');
