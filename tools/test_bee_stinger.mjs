// Bee Stinger: original drops it from a perishing vanilla bee, never from a sting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/worldEvents.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const callbacks = {};
const signals = new Proxy({}, { get: (_t, k) => ({ subscribe(fn) { callbacks[k] = fn; } }) });
const drops = [];
const dim = { id: 'minecraft:overworld', spawnItem(stack, loc) { drops.push([stack.typeId, loc]); }, playSound() {} };
class ItemStack { constructor(typeId) { this.typeId = typeId; } }
class Player {}
let roll = 0;
const math = Object.create(Math);
math.random = () => roll;
const ctx = vm.createContext({ Math: math, ItemStack, Player, EntityDamageCause: { thorns: 'thorns' },
  getMainhandItem: () => undefined, handleOreBreak() {}, registerAirSwingEvents() {},
  world: { afterEvents: signals, getDynamicProperty() {}, getDimension() { return dim; } },
  system: { currentTick: 100, afterEvents: signals, runInterval() {} } });
vm.runInContext(`${code}\nthis.start=registerWorldEvents`, ctx); ctx.start();
const bee = { typeId: 'minecraft:bee', dimension: dim, location: { x: 1, y: 64, z: 1 }, isValid: true };
const die = (entity, damageSource = {}) => callbacks.entityDie({ deadEntity: entity, damageSource });
roll = 0.01; die(bee);
assert.equal(drops.length, 1, 'a perishing bee must be able to drop the stinger');
assert.equal(drops[0][0], 'effect:bee_sword');
roll = 0.5; die(bee);
assert.equal(drops.length, 1, '2% chance must not always drop');
roll = 0.01; die({ ...bee, typeId: 'entity:bee_sword' });
assert.equal(drops.length, 1, 'a sword-summoned bee must never create a new sword');
die(bee, { cause: 'entityAttack', damagingEntity: { typeId: 'minecraft:player' } });
die(bee, { cause: 'entityAttack', damagingEntity: { typeId: 'minecraft:wolf' } });
die(bee, { cause: 'projectile', damagingProjectile: { typeId: 'minecraft:arrow' } });
assert.equal(drops.length, 1, 'player, pet and projectile kills must not drop the sword');
callbacks.entityHurt({ hurtEntity: new Player(), damageSource: { cause: 'entityAttack', damagingEntity: bee } });
assert.equal(drops.length, 1, 'being stung must not spawn a sword');
console.log('Bee stinger: perishing bee drop, 2% chance, summoned bees and stings excluded');
