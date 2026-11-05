// Launch speeds, read from the 2.8.8 originals.
//
// In 2.8.8 every projectile is launched by an item event's `shoot`, which always
// uses the projectile entity's own `power` — `launch_power: 1` is "as fast as the
// entity says". The scripted remake passes the speed itself, so each call has to
// repeat the `power` of the entity it spawns. Two systematic mistakes had crept in:
//
//   * an invented `effect:player_shot` component group pushed the fireball and both
//     wither skulls to 1.8, and
//   * hand-tuned numbers (1.1 for the shulker bullet, 1.35/1.4/1.45 elsewhere)
//     drifted away from the originals.
//
// This test reads `packs/Swords_B/entities/*.json` and asserts that every
// `shootCustomProjectile(...)` call in `src/swordSkills.ts` uses that entity's own
// base `power`.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spriteToFile = (id) => id.split(':')[1];
const entityPower = (id) => {
  const path = `packs/Swords_B/entities/${spriteToFile(id)}.json`;
  const data = JSON.parse(fs.readFileSync(path, 'utf8'))['minecraft:entity'];
  return data.components?.['minecraft:projectile']?.power;
};

const source = fs.readFileSync('src/swordSkills.ts', 'utf8');
const calls = [...source.matchAll(/shootCustomProjectile\(\s*[^,]+,\s*'([^']+)',\s*([0-9.]+)/g)];
assert.ok(calls.length > 15, `expected many projectile calls, found ${calls.length}`);

// Projectiles whose speed legitimately differs from the entity's own base `power`,
// because 2.8.8 swaps in a component group before the shot lands.
const GROUP_SPEED = {
  // `fire.json` -> `fire_sword` group: power 1 becomes 10 while the sword is held.
  'entity:fire': 1.3,
  // `living_flame` -> `living_flame_projectile`: power 1 (the base entity is not a
  // projectile at all, so there is no base `power` to compare against).
  'entity:living_flame': 1.0,
  // `minicreeper` is spawned straight into the `projectile` group at power 1.
  'entity:minicreeper': 1.0,
  // `nether_star_projectile` -> `nether_star_sword` group: power 5 in 2.8.8
  // (the base entity says 1, the group the sword adds says 5).
  'entity:nether_star_projectile': 5,
  // `bee_sword` is a mob, not a projectile: 2.8.8 `shoot`s it at launch_power 1.
  'entity:bee_sword': 1.0,
  // `tnt` is spawned as a primed block, launched at launch_power 1.
  'entity:tnt': 1.2,
};

for (const id of Object.keys(GROUP_SPEED)) {
  assert.ok(source.includes(`'${id}'`), `${id} is still launched somewhere`);
}

for (const [, id, rawSpeed] of calls) {
  if (id in GROUP_SPEED) continue;
  const power = entityPower(id);
  assert.ok(power !== undefined, `${id} must declare a base projectile power`);
  assert.equal(Number(rawSpeed), power,
    `${id} is launched at the entity's own power (${power}) like 2.8.8, not ${rawSpeed}`);
}

// The invented speed boost group must not come back.
assert.ok(!/effect:player_shot/.test(source), 'no invented player_shot spawn event in the scripts');
for (const file of ['fireball', 'wither_skull', 'wither_skull_dangerous']) {
  const data = JSON.parse(fs.readFileSync(`packs/Swords_B/entities/${file}.json`, 'utf8'))['minecraft:entity'];
  assert.ok(!('effect:player_shot' in (data.component_groups ?? {})),
    `${file} must not carry an invented player_shot group`);
}

// The Wither Sword swap-in, which 2.8.8 triggers itself through `has_equipment` on
// the shooter: a 0x0 box and its own gravity, applied by an explicit event here.
for (const [file, gravity] of [['wither_skull', 0.05], ['wither_skull_dangerous', 0.005]]) {
  const data = JSON.parse(fs.readFileSync(`packs/Swords_B/entities/${file}.json`, 'utf8'))['minecraft:entity'];
  const group = data.component_groups?.wither_sword;
  assert.ok(group, `${file} keeps its 2.8.8 wither_sword group`);
  assert.deepEqual(group['minecraft:collision_box'], { width: 0, height: 0 },
    `${file} shrinks to a 0x0 box on the Wither Sword`);
  assert.equal(group['minecraft:projectile'].gravity, gravity, `${file} wither_sword gravity`);
}

console.log('Launch speeds: every scripted shot matches the 2.8.8 projectile power, no invented boost');
