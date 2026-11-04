// 2.8.8 block parity: temporary blocks must melt on their own, not be minable,
// and keep the original timing. `ticking.range` in 2.8.8 is in SECONDS, so the
// modern `minecraft:tick.interval_range` must be seconds × 20.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const block = (n) => JSON.parse(fs.readFileSync(`packs/Swords_B/blocks/${n}.json`, 'utf8'))['minecraft:block'];
const comp = (n, k) => block(n).components[k];

// fake_ice: destroy_time 9999, explosion_resistance 10, 4 models × 2 s each.
const ice = block('fake_ice');
assert.deepEqual(comp('fake_ice', 'minecraft:destructible_by_mining'), { seconds_to_destroy: 9999 });
assert.deepEqual(comp('fake_ice', 'minecraft:destructible_by_explosion'), { explosion_resistance: 10 });
assert.deepEqual(comp('fake_ice', 'minecraft:tick'), { interval_range: [40, 40], looping: true },
  'fake_ice must advance one model every 2 s (40 ticks) so the cage lasts ~8 s');
assert.equal(ice.permutations.length, 3, 'four models total: base + three permutations');
assert.deepEqual(ice.description.states['effect99:crack_stage'], [0, 1, 2, 3]);

// lightblock / lightblock2: 0.2 s placeholder (4 ticks), level 15 and 11.
for (const [name, level] of [['lightblock', 15], ['lightblock2', 11]]) {
  assert.deepEqual(comp(name, 'minecraft:tick'), { interval_range: [4, 4], looping: true },
    `${name} is a 0.2 s placeholder in 2.8.8`);
  assert.equal(comp(name, 'minecraft:light_emission'), level);
  assert.equal(comp(name, 'minecraft:destructible_by_mining'), false);
}

// spectral_block: unbreakable (destroy_time 9999), explosion_resistance 999.
assert.deepEqual(comp('spectral_block', 'minecraft:destructible_by_mining'), { seconds_to_destroy: 9999 });
assert.deepEqual(comp('spectral_block', 'minecraft:destructible_by_explosion'), { explosion_resistance: 999 });

// sapling3: destroy_time 0.1, explosion_resistance 1, self-plants immediately.
assert.deepEqual(comp('sapling3', 'minecraft:destructible_by_mining'), { seconds_to_destroy: 0.1 });
assert.deepEqual(comp('sapling3', 'minecraft:destructible_by_explosion'), { explosion_resistance: 1 });
assert.equal(comp('sapling3', 'minecraft:tick').looping, false);

// The sapling plants a real vanilla jungle sapling instead of a hand-built tree.
const utils = fs.readFileSync('src/utils.ts', 'utf8');
const fn = utils.slice(utils.indexOf('export function plantJungleSapling'));
assert.ok(fn.includes("'minecraft:jungle_sapling'"), 'sapling3 must plant minecraft:jungle_sapling');
const blockComponents = fs.readFileSync('src/blockComponents.ts', 'utf8');
const sapComponent = blockComponents.slice(blockComponents.indexOf("'effect99:sapling3'"));
assert.ok(sapComponent.includes('plantJungleSapling'), 'sapling3 component must use plantJungleSapling');
assert.ok(!sapComponent.slice(0, 400).includes('growInstantJungleTree'),
  'sapling3 must not hand-build a tree (that is not what 2.8.8 does)');

// Ores are loot-less and drop through the scripted break handler.
for (const ore of ['quartz_diamond_ore', 'silver_ore']) {
  assert.equal(comp(ore, 'minecraft:loot'), 'loot_tables/empty.json');
}

// Every table referenced from a shipped JSON must exist, otherwise the engine
// silently rolls nothing (this is how the Spider Sword mount lost its no-loot
// table and the village bundle pool disappeared).
{
  const refs = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/"loot_tables\/([^"]+)"/g)) refs.add(m[1]);
      }
    }
  };
  walk('packs/Swords_B');
  const missing = [...refs].filter((rel) =>
    !fs.existsSync(`packs/Swords_B/loot_tables/${rel}`) &&
    !fs.existsSync(`packs/Swords_B/loot_tables/${rel}.json`));
  assert.deepEqual(missing, [], 'every referenced loot table must exist');
}

console.log('Blocks: fake ice lifetime, light placeholders, spectral walls and sapling parity OK');
