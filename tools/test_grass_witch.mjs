// Exact 2.8.8 Grass Witch: the component group ships an EMPTY loot component, so
// the entity itself drops nothing; the Grass Sword comes from a scripted 20 %
// on-death roll that also plants tall grass and plays `dig.grass`.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const witch = JSON.parse(fs.readFileSync('packs/Swords_B/entities/witch.json', 'utf8'))['minecraft:entity'];
const group = witch.component_groups['effect:grass_witch'];
assert.deepEqual(group['minecraft:loot'], {}, 'a Grass Witch must drop no loot table at all');
assert.equal(witch.components['minecraft:loot'].table, 'loot_tables/entities/witch.json',
  'a plain witch keeps the vanilla table');

// No custom witch table may be shipped: it would add vanilla witch drops.
assert.equal(fs.existsSync('packs/Swords_B/loot_tables/entities/grass_witch.json'), false);

const events = fs.readFileSync('packs/Swords_B/scripts/worldEvents.js', 'utf8');
const start = events.indexOf("deadEntity.matches({ families: ['grass_witch'] })");
assert.ok(start > 0, 'grass witch death branch must exist');
const branch = events.slice(start, start + 1200);
assert.ok(branch.includes('Math.random() < 0.2'), 'the sword drop is a 20 % roll');
assert.ok(branch.includes("new ItemStack('effect:grass_sword', 1)"), 'the roll spawns a Grass Sword');
assert.ok(branch.includes("setType('minecraft:short_grass')"), 'the original also places tall grass');

// The roll is NOT gated on the killer: any death can drop it.
assert.ok(!/killer\s*(===|instanceof)/.test(branch), 'grass witch drop must not depend on the killer');

console.log('Grass Witch: empty loot component, 20% scripted sword drop, no vanilla drops');
