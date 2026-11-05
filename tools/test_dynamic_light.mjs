// 2.8.8 lit every sword's surroundings with two `fill` commands per sensor tick:
//   fill ~1 ~1 ~1 ~-1 ~-1 ~-1 effect99:lightblock 0 replace air
//   fill ~1 ~1 ~1 ~-1 ~-1 ~-1 effect99:lightblock 0 replace effect99:lightblock
// Ultra Instinct and Wither used a single 3x3 layer at `~ ~2 ~`.
// This test pins the geometry and the bright/dim split so a future refactor
// cannot quietly shrink the light back to a single block.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('src/passiveEngine.ts', 'utf8');
const blocks = fs.readFileSync('src/blockComponents.ts', 'utf8');

// --- footprint -------------------------------------------------------------
assert.ok(src.includes('const levels = volume.topOnly ? [0] : [-1, 0, 1];'),
  'a cube sword fills three vertical layers, a top-only sword fills one');
assert.ok(src.includes('for (let dx = -1; dx <= 1; dx++)') &&
  src.includes('for (let dz = -1; dz <= 1; dz++)'),
  'each layer is 3x3, matching ~1..~-1 in both horizontal axes');
assert.ok(blocks.includes("yOffset: TOP_LAYER_SWORDS.has(mainId) ? 1 : 0"),
  'cube swords centre on the feet, top-only swords sit one block above them');
assert.deepEqual([...blocks.match(/TOP_LAYER_SWORDS = new Set\(\[([^\]]+)\]/)[1]
  .matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(),
['effect:ultra_instinct_sword', 'effect:wither_sword'],
'only Ultra Instinct and Wither use the single top layer in 2.8.8');

// --- never overwrite real blocks ------------------------------------------
assert.ok(src.includes('b.isAir || b.typeId === BRIGHT_LIGHT_TYPE || b.typeId === DIM_LIGHT_TYPE'),
  'the fill must replace only air or an existing placeholder');

// --- bright / dim split ---------------------------------------------------
const bright = [...blocks.match(/BRIGHT_LIGHT_SWORDS = new Set\(\[([^\]]+)\]/)[1]
  .matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
assert.deepEqual(bright,
  ['effect:fire_sword', 'effect:glowstone_sword', 'effect:ultra_instinct_sword'],
  '2.8.8 used the bright lightblock for Glowstone, Fire and Ultra Instinct');

// --- emission levels follow the legacy 0-1 fraction ------------------------
const lightblock = JSON.parse(fs.readFileSync('packs/Swords_B/blocks/lightblock.json', 'utf8'))
  ['minecraft:block'].components['minecraft:light_emission'];
const lightblock2 = JSON.parse(fs.readFileSync('packs/Swords_B/blocks/lightblock2.json', 'utf8'))
  ['minecraft:block'].components['minecraft:light_emission'];
assert.equal(lightblock, 15, '2.8.8 block_light_emission 1.0 -> 15');
assert.equal(lightblock2, 7, '2.8.8 block_light_emission 0.5 -> 7');

// --- the placeholder cleans itself up -------------------------------------
for (const name of ['lightblock', 'lightblock2']) {
  const tick = JSON.parse(fs.readFileSync(`packs/Swords_B/blocks/${name}.json`, 'utf8'))
    ['minecraft:block'].components['minecraft:tick'];
  assert.deepEqual(tick.interval_range, [4, 4], `${name} expires after 0.2 s, like 2.8.8`);
}

console.log('Dynamic light: 3x3x3 cube, Ultra Instinct/Wither top layer, 15/7 emission');
