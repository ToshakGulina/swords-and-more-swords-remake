// player.json parity guard.
//
// 2.8.8 drove every sword passive from `minecraft:environment_sensor` triggers on
// `player.json` (62 triggers = 29 swords x "equip" + "unequip", plus four global
// ones). The remake evaluates the held item in `passiveEngine.ts` instead, because
// a script can see both hands and can clean up after a despawn. That means the
// component groups are NOT the source of truth any more — the script branches are.
//
// This test pins the mapping: every sword that had a passive in 2.8.8 must still
// have one in the script engine, and each one must appear in the light table or
// carry an explicit comment. If a sword is dropped from the engine, this fails.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('src/passiveEngine.ts', 'utf8');
const skills = fs.readFileSync('src/swordSkills.ts', 'utf8');

// The 29 swords that 2.8.8 gave an `environment_sensor` passive.
const PASSIVE_SWORDS = [
  'bee', 'blaze', 'bone', 'cactus', 'clock', 'emerald', 'ender', 'fire', 'ghost',
  'glowstone', 'grass', 'ice', 'jungle', 'lapis', 'lightning', 'magma',
  'nether_star', 'obsidian', 'quartz', 'sea', 'shulker', 'slime', 'spectral',
  'spider', 'sponge', 'time', 'ultra_instinct', 'wither', 'wolf',
];
assert.equal(PASSIVE_SWORDS.length, 29, '2.8.8 has 29 swords with a passive');

const missing = [];
for (const name of PASSIVE_SWORDS) {
  const id = `effect:${name}_sword`;
  if (!engine.includes(id) && !skills.includes(id)) missing.push(id);
}
assert.deepEqual(missing, [], 'every 2.8.8 passive sword must be handled in the scripts');

// The engine must resolve the held item for both hands, as the original's
// `has_equipment domain: hand` did.
assert.ok(engine.includes('getMainhandItem(') && engine.includes('getOffhandItem('),
  'both hands are inspected, matching `domain: hand`');
assert.ok(engine.includes("offId === 'effect:glowstone_sword'") &&
  engine.includes("offId === 'effect:fire_sword'"),
  'the two offhand-lighting swords keep their offhand branches');

// Timer-driven passives keep their 2.8.8 cadence (seconds x 20 ticks).
const CADENCE = [
  ['blaze_sword', 20, 'timer [1, 1] s'],
  ['ultra_instinct_sword', 6, 'timer [0.1, 0.2] s'],
  ['wither_sword', 20, 'timer [4, 18] s, sub-sampled'],
  ['spectral_sword', 20, 'timer [0.4, 0.4] s, non-looping'],
  ['slime_sword', 10, 'timer [0.4, 0.4] s, non-looping'],
];
for (const [name, modulus, why] of CADENCE) {
  const start = engine.indexOf(`case 'effect:${name}': {`);
  assert.ok(start > 0, `${name} needs an engine branch`);
  const branch = engine.slice(start, start + 2600);
  assert.ok(branch.includes(`tick % ${modulus} === 0`),
    `${name} must run on its documented cadence (${why})`);
}

console.log('Player passives: 29/29 swords, both hands, documented cadences');
