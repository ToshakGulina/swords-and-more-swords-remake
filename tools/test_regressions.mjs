// Structural regression checks for recently repaired entity events and generated pack metadata.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const json = p => JSON.parse(read(p));
const bp = 'packs/Swords_B/';
const crystal = json(bp + 'entities/ender_crystal.json')['minecraft:entity'];
assert.equal(crystal.component_groups['effect:ender_crystal_scale']['minecraft:timer'].time, 18);
assert.ok(crystal.component_groups['effect:ender_crystal_scale']['minecraft:type_family'].family.includes('ender_crystal_scale'));
assert.ok(JSON.stringify(crystal.events['minecraft:crystal_explode']).includes('scriptevent effect:ender_crystal_exploded'));
const creeper = json(bp + 'entities/creeper.json')['minecraft:entity'];
assert.ok(JSON.stringify(creeper.events['effect:creeper_sword_drop']).includes('scriptevent effect:creeper_sword_drop'));
const events = read(bp + 'scripts/worldEvents.js');
for (const [event, item] of [['effect:creeper_sword_drop', 'effect:creeper_sword'], ['effect:ender_crystal_exploded', 'effect:spectral_sword']]) {
  const start = events.indexOf("ev.id === '" + event + "'");
  assert.ok(start >= 0, `missing ${event}`);
  const part = events.slice(start, events.indexOf("\n        }", start) + 10);
  assert.ok(part.includes(`new ItemStack('${item}', 1)`), `missing delayed drop for ${event}`);
  assert.ok(part.includes('system.runTimeout'), `missing timer for ${event}`);
}
const sword = read(bp + 'scripts/swordSkills.js');
const air = sword.slice(sword.indexOf('export function registerAirSwingEvents'));
for (const id of ['ice_sword', 'glass_sword', 'quartz_sword', 'spectral_sword', 'time_sword', 'clock_sword', 'emerald_sword', 'ghost_sword']) {
  assert.ok(air.includes(`case 'effect:${id}':`), `missing air swing ${id}`);
}
const b = json(bp + 'manifest.json');
const r = json('packs/Swords_R/manifest.json');
assert.deepEqual(b.header.version, r.header.version);
assert.ok(b.dependencies.some(d => d.uuid === r.header.uuid && JSON.stringify(d.version) === JSON.stringify(r.header.version)));
assert.ok(fs.existsSync('packs/Swords_R/render_controllers/alpha_wolf.render_controllers.json'));
console.log('Gameplay regression structure and pack dependencies: OK');
