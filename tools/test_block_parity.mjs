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

// lightblock / lightblock2: 0.2 s placeholder (4 ticks).
// 2.8.8 `block_light_emission` was a 0-1 fraction (1 and 0.5). The modern
// `minecraft:light_emission` is an integer 0-15, so the equivalent levels are
// 15 and 7 — not 11, which would be a third of the original's 0.5.
for (const [name, level] of [['lightblock', 15], ['lightblock2', 7]]) {
  assert.deepEqual(comp(name, 'minecraft:tick'), { interval_range: [4, 4], looping: true },
    `${name} is a 0.2 s placeholder in 2.8.8`);
  assert.equal(comp(name, 'minecraft:light_emission'), level);
  assert.equal(comp(name, 'minecraft:destructible_by_mining'), false);
}


// --- destroy time / explosion resistance / light dampening (2.8.8 values) --------
// The remake once carried invented numbers here (18 s and 15 s for the ores,
// 12 s / resistance 6 for silver, dampening 2 for fake ice).
for (const [name, seconds, resistance, dampening] of [
  ['quartz_diamond_block', 20, 999, 15],
  ['quartz_diamond_ore', 10, 999, 15],
  ['silver_ore', 8, 1, 15],
]) {
  assert.equal(comp(name, 'minecraft:destructible_by_mining').seconds_to_destroy, seconds,
    `${name} keeps the 2.8.8 destroy_time`);
  assert.equal(comp(name, 'minecraft:destructible_by_explosion').explosion_resistance, resistance,
    `${name} keeps the 2.8.8 explosion_resistance`);
  assert.equal(comp(name, 'minecraft:light_dampening'), dampening,
    `${name} keeps the 2.8.8 block_light_absorption`);
}
assert.equal(comp('fake_ice', 'minecraft:light_dampening'), 0,
  '2.8.8 fake_ice has block_light_absorption 0');

// lightblock / lightblock2 keep 2.8.8 `explosion_resistance: 999` (an explosion must
// not pop the placeholders early) and 2.8.8 `render_method: blend`.
for (const name of ['lightblock', 'lightblock2']) {
  assert.equal(comp(name, 'minecraft:destructible_by_explosion').explosion_resistance, 999,
    `${name} survives explosions like the 2.8.8 original`);
  assert.equal(comp(name, 'minecraft:material_instances')['*'].render_method, 'blend',
    `${name} renders with blend, as in 2.8.8`);
}

// 2.8.8 `effect99:fake_ice` does not change friction; the 0.02 the remake carried
// made the ice cage slippery in a way the original never was.
assert.equal(comp('fake_ice', 'minecraft:friction'), undefined,
  'fake_ice keeps the default friction (no `minecraft:friction` in 2.8.8)');

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
