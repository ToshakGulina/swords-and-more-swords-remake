// Projectile parity with 2.8.8.
//
// A scripted `dimension.spawnEntity('minecraft:arrow')` has no bow behind it, so
// the modern vanilla `damage: {min: 0, max: 0}` (damage comes from the shooter)
// produced arrows and fireballs that hit for nothing. 2.8.8 shipped its own
// copies of these entities with the numbers baked in, and so must the remake.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ent = (n) => JSON.parse(fs.readFileSync(`packs/Swords_B/entities/${n}.json`, 'utf8'))['minecraft:entity'];
const proj = (n) => ent(n).components['minecraft:projectile'];

// --- Bone Sword arrow -----------------------------------------------------------
const arrow = proj('arrow');
assert.equal(arrow.power, 1.6, '2.8.8 arrow power 1.6');
assert.deepEqual(arrow.on_hit.impact_damage.damage, { min: 1, max: 4 },
  '2.8.8 arrow deals 1-4, not the vanilla 0-0');

// --- Blaze Sword small fireball --------------------------------------------------
const small = proj('small_fireball');
assert.equal(small.power, 1.3, '2.8.8 small fireball power 1.3');
assert.equal(small.on_hit.impact_damage.damage, 5, '2.8.8 small fireball deals a flat 5');
assert.equal(small.anchor, 'middle');
assert.deepEqual(small.offset, [0, 0.5, 0]);

// --- Ghast fireball --------------------------------------------------------------
const fireball = proj('fireball');
assert.equal(fireball.power, 1.6, '2.8.8 fireball power 1.6');
assert.equal(fireball.gravity, 0);
assert.equal(fireball.catch_fire, true, '2.8.8 fireball sets fire on impact');
assert.equal(fireball.anchor, 'eye_height', '2.8.8 anchored at eye height, not "middle"');
assert.deepEqual(fireball.offset, [0, -0.1, 0], '2.8.8 offset, not the vanilla [0,-1.5,0]');
assert.equal(fireball.on_hit.impact_damage, undefined,
  '2.8.8 has no direct hit damage — the power-1 blast does the work');

// --- Wither skulls --------------------------------------------------------------
for (const [name, power] of [['wither_skull', 1.2], ['wither_skull_dangerous', 0.6]]) {
  const p = proj(name);
  assert.equal(p.power, power, `${name} power ${power} like 2.8.8`);
  assert.equal(p.gravity, 0, `${name} flies flat in 2.8.8`);
  assert.equal(p.anchor, 'eye_height');
  assert.deepEqual(p.offset, [0, -0.1, 0]);
}

// --- Shulker Sword bullet --------------------------------------------------------
const bullet = ent('shulker_bullet');
const swordBullet = bullet.component_groups['effect:shulker_sword']['minecraft:projectile'];
const levitation = swordBullet.on_hit.mob_effect.effects?.[0] ?? swordBullet.on_hit.mob_effect;
assert.equal(levitation.effect, 'levitation');
assert.equal(levitation.amplifier, 1, '2.8.8 bullet applies Levitation II (amplifier 1), not I');
assert.equal(levitation.durationnormal, 200, '200 ticks on normal difficulty');
assert.deepEqual(swordBullet.on_hit.impact_damage.damage, { min: 4, max: 4 }, '2.8.8 bullet hits for 4');

// --- Player-launched variants stay boosted ---------------------------------------
for (const name of ['fireball', 'wither_skull', 'wither_skull_dangerous']) {
  const shot = ent(name).component_groups['effect:player_shot']?.['minecraft:projectile'];
  assert.ok(shot, `${name} keeps its player_shot group`);
  assert.equal(shot.power, 1.8, `${name} player shot keeps the 1.8 boost`);
  assert.equal(shot.gravity, 0.02);
}

console.log('Projectiles: arrow 1-4, fireball catches fire, skulls flat, bullet Levitation II');
