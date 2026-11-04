// Custom ore density parity with 2.8.8.
//
// 2.8.8 placed its ores with the `minecraft:structure_feature` component, and both
// `silver_ore.mcstructure` and `quartz_diamond_ore.mcstructure` are 1x1x1 — a single
// block per rule iteration. Its rule was: 5 iterations, scatter_chance 160/200,
// y from the rule's own window. That is ~4 ore blocks per chunk.
//
// The remake switched to `minecraft:ore_feature` veins of 4 and 7 blocks and raised
// the iteration counts, ending up ~16x denser than the original. These assertions
// keep the effective density at the 2.8.8 value.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const feature = (n) => read(`packs/Swords_B/features/${n}.json`)['minecraft:ore_feature'];
const rule = (n) => read(`packs/Swords_B/feature_rules/${n}.json`)['minecraft:feature_rules'];

const density = (feat, r) => {
  const scatter = r.distribution.scatter_chance;
  const chance = scatter ? scatter.numerator / scatter.denominator : 1;
  return r.distribution.iterations * feat.count * chance;
};

const silver = feature('silver_ore_feature');
assert.equal(silver.count, 1, 'silver: one block per iteration, like the 1x1x1 structure');
const silverRule = rule('silver_ore_overworld_rule');
assert.equal(silverRule.distribution.iterations, 5, 'silver: 5 iterations like 2.8.8');
assert.deepEqual(silverRule.distribution.scatter_chance, { numerator: 160, denominator: 200 },
  'silver: 2.8.8 scatter chance');
assert.deepEqual(silverRule.distribution.y, { distribution: 'gaussian', extent: [10, 35] },
  'silver: 2.8.8 gaussian 10-35 window, not the whole world height');
assert.equal(density(silver, silverRule), 4, 'silver: ~4 blocks per chunk');

const quartz = feature('quartz_diamond_ore_feature');
assert.equal(quartz.count, 1, 'quartz: one block per iteration, like the 1x1x1 structure');
for (const name of ['quartz_diamond_ore_overworld_rule', 'quartz_diamond_ore_end_rule']) {
  const r = rule(name);
  assert.equal(r.distribution.iterations, 5, `${name}: 5 iterations like 2.8.8`);
  assert.deepEqual(r.distribution.scatter_chance, { numerator: 160, denominator: 200 },
    `${name}: 2.8.8 scatter chance`);
  assert.equal(density(quartz, r), 4, `${name}: ~4 blocks per chunk`);
}

// The ore must still be minable inside the modern world, so deepslate stays in the
// replace list even though 2.8.8 only allowed stone (silver) / stone+end_stone (quartz).
for (const [name, feat] of [['silver', silver], ['quartz', quartz]]) {
  const replace = feat.replace_rules[0].may_replace;
  assert.ok(replace.includes('minecraft:stone'), `${name}: still replaces stone`);
  assert.ok(replace.includes('minecraft:deepslate'), `${name}: still reachable in deepslate`);
}

console.log('Ores: 1 block per iteration, 5 iterations, 160/200 scatter, ~4 blocks per chunk');
