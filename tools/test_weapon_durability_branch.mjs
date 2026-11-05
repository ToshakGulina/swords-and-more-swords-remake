// The 2.8.8 `weapon` events wear a sword out twice on a normal hit.
//
// Every one of those events is a `sequence` whose FIRST step is
// `damage: { type: durability, amount: 1 }`, and whose `randomize` block has a
// losing branch that is *another* `damage: durability 1` — the winning branch
// fires a projectile instead. So a hit costs either 1 point (projectile fired)
// or 2 points, never a flat 1.
//
// The engine's own durability damage covers the first point. This test pins the
// chance table the script uses for the second one, read straight from the 2.8.8
// item files, and checks the script actually calls the helper on those swords.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const swordSkills = fs.readFileSync('src/swordSkills.ts', 'utf8');

// chance to fire the projectile == chance the second durability point is skipped
const EXPECTED = {
  'effect:bee_sword': 0.3,
  'effect:blaze_sword': 0.15, // 14 % small fireball + 1 % fireball
  'effect:bone_sword': 0.2,
  'effect:creeper_sword': 0.2,
  'effect:ice_sword': 0.3,
  'effect:pumpkin_sword': 0.2,
  'effect:shulker_sword': 0.1,
  'effect:spider_sword': 0.05,
  'effect:tnt_sword': 0.9,
  'effect:wither_sword': 0.1,
};

const table = swordSkills.slice(
  swordSkills.indexOf('const PROJECTILE_BRANCH_CHANCE'),
  swordSkills.indexOf('/** The 70/80/85/90/95% branch'),
);

for (const [id, chance] of Object.entries(EXPECTED)) {
  // only real entries, not the doc comment that also lists the percentages
  const line = table
    .split('\n')
    .filter((l) => !l.trim().startsWith('*'))
    .find((l) => l.includes(`'${id}':`));
  assert.ok(line, `${id} must be in the second-durability table`);
  // the id itself contains a colon, so take everything AFTER the quoted key
  const raw = line.slice(line.lastIndexOf(':') + 1);
  const value = Number(raw.replace(/[^0-9.]/g, ''));
  assert.equal(value, chance, `${id} keeps the 2.8.8 projectile chance (${chance})`);
}

// Swords with no projectile branch must NOT be in the table: their event has no
// losing durability branch, so they must keep the plain one-point wear.
for (const id of ['effect:coal_sword', 'effect:emerald_sword', 'effect:sea_sword',
  'effect:slime_sword', 'effect:wolf_sword', 'effect:grass_sword']) {
  assert.ok(!table.includes(`'${id}'`), `${id} has no extra durability branch in 2.8.8`);
}

// Every sword in the table must actually call the helper from its hit handler.
const calls = (swordSkills.match(/applyProjectileBranchDurability\(id, attackingEntity\)/g) ?? []).length;
assert.equal(calls, Object.keys(EXPECTED).length,
  'each sword with a projectile branch calls the helper exactly once');

console.log('Weapon wear: second durability point on the 2.8.8 chance table');
