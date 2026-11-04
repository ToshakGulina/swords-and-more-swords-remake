// Wither Sword: the original only rolls it for a fatal hit from a player who
// holds the Nether Star Sword, and the roll is 13 against 87 (never 5%/25%).
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
let mainhand = undefined;
const ctx = vm.createContext({ Math: math, ItemStack, Player, EntityDamageCause: { thorns: 'thorns' },
  getMainhandItem: () => mainhand, handleOreBreak() {}, registerAirSwingEvents() {},
  world: { afterEvents: signals, getDynamicProperty() {}, getDimension() { return dim; } },
  system: { currentTick: 100, afterEvents: signals, runInterval() {} } });
vm.runInContext(`${code}\nthis.start=registerWorldEvents`, ctx); ctx.start();
const wither = (tags = []) => ({
  typeId: 'minecraft:wither', dimension: dim, location: { x: 0, y: 64, z: 0 }, isValid: true,
  hasTag: (t) => tags.includes(t),
});
const die = (entity, damageSource = {}) => callbacks.entityDie({ deadEntity: entity, damageSource });
const player = Object.assign(new Player(), { typeId: 'minecraft:player' });

roll = 0.01;
die(wither(), { cause: 'entityAttack', damagingEntity: player });
assert.equal(drops.length, 0, 'a wither killed while the player holds another item drops nothing');

mainhand = { typeId: 'effect:nether_star_sword' };
roll = 0.01;
die(wither(), { cause: 'entityAttack', damagingEntity: player });
assert.deepEqual(drops.at(-1)[0], 'effect:wither_sword', 'a fatal Nether Star Sword hit must be able to drop the sword');

roll = 0.14;
const before = drops.length;
die(wither(), { cause: 'entityAttack', damagingEntity: player });
assert.equal(drops.length, before, '13% is the ceiling, so 0.14 must not drop');
roll = 0.129;
die(wither(), { cause: 'entityAttack', damagingEntity: player });
assert.equal(drops.length, before + 1, 'the roll must sit just below 13%');

mainhand = undefined;
roll = 0.01;
die(wither(['slain_by_nether_star_sword']), { cause: 'projectile', damagingProjectile: { typeId: 'minecraft:arrow' } });
assert.equal(drops.length, before + 2, 'the tag alone is enough once the sword actually struck the wither');
console.log('Wither sword drop: only from a Nether Star Sword kill, 13% roll');
