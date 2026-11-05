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


// --- Projectile lifetimes --------------------------------------------------------
// 2.8.8 gives both of these a 0.1 s looping timer that fires `despawn`, so the
// projectile is gone a tenth of a second after it spawns. The remake once let the
// lightning projectile fly for 1.2 s and the star tracer for 1.0 s, which left a
// visible bolt/star hanging in the air.
const lightningTimer = ent('lightning_projectile').components['minecraft:timer'];
assert.deepEqual(lightningTimer.time, [0.1, 0.1], '2.8.8 lightning projectile lives 0.1 s');
assert.equal(lightningTimer.looping, true);
assert.equal(lightningTimer.time_down_event.event, 'despawn');

const starTimer = ent('nether_star_projectile').component_groups.nether_star_sword['minecraft:timer'];
assert.deepEqual(starTimer.time, [0.1, 0.1], '2.8.8 star tracer lives 0.1 s');
assert.equal(starTimer.looping, true);
assert.equal(starTimer.time_down_event.event, 'minecraft:despawn');

// --- No invented speed boost ------------------------------------------------------
// 2.8.8 launches every one of these with the projectile entity's own `power`; there
// is no `player_shot` component group anywhere in the original packs.
for (const name of ['fireball', 'wither_skull', 'wither_skull_dangerous', 'shulker_bullet', 'snowball']) {
  const groups = ent(name).component_groups ?? {};
  assert.ok(!('effect:player_shot' in groups), `${name} must not carry an invented player_shot group`);
}
assert.equal(proj('arrow').inertia, 1, '2.8.8 arrows keep their speed (inertia 1, not 0.05)');
assert.equal(proj('arrow').on_hit.impact_damage.knockback, true);
assert.equal(proj('small_fireball').on_hit.impact_damage.knockback, false,
  '2.8.8 small fireball does not knock back');

console.log('Projectiles: arrow 1-4, fireball catches fire, skulls flat, bullet Levitation II, 0.1 s timers');
