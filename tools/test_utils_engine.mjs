// Execute the shipped utils.js against a small deterministic mock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/utils.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const properties = new Map();
const soundCalls = [];
let moonPhase = 0;
let timeOfDay = 18000;
const world = {
  getDynamicProperty: (k) => properties.get(k),
  setDynamicProperty: (k, v) => (v === undefined ? properties.delete(k) : properties.set(k, v)),
  getMoonPhase: () => moonPhase,
  getTimeOfDay: () => timeOfDay,
};
class ItemStack {}
const math = Object.create(Math);
const ctx = vm.createContext({ Math: math, world, ItemStack,
  EntityComponentTypes: { Equippable: 'e', Inventory: 'i' },
  EquipmentSlot: { Mainhand: 'Mainhand', Offhand: 'Offhand' },
  GameMode: { Creative: 'creative', Survival: 'survival' },
  ItemComponentTypes: { Durability: 'd', Enchantable: 'en' },
  MoonPhase: { FullMoon: 0 }, EntityDamageCause: {} });
vm.runInContext(`${code}
this.api = { isFullMoonNight, isProtectedEntity, consumeMainhandDurability, safeRandomTeleport, giveOrDropItem };`, ctx);
const { isFullMoonNight, isProtectedEntity, consumeMainhandDurability, safeRandomTeleport } = ctx.api;

const moon = (phase, time) => { moonPhase = phase; timeOfDay = time; return isFullMoonNight(); };
assert.equal(moon(0, 18000), true, 'full moon at night');
assert.equal(moon(0, 6000), false, 'full moon during the day');
assert.equal(moon(1, 18000), false, 'other phases are not a full moon');
assert.equal(moon(0, 12999), false, 'just before night');
assert.equal(moon(0, 23001), false, 'just after night');

assert.equal(safeRandomTeleport({ dimension: {}, location: { x: 0, y: 0, z: 0 } }, 1, 2), false,
  'a broken dimension must return false, not throw');

const broken = { isValid: false, typeId: 'minecraft:zombie', id: 'e1', matches() { throw new Error('stale'); } };
assert.equal(isProtectedEntity(broken), true, 'an invalid entity is treated as protected');
const utility = { isValid: true, typeId: 'minecraft:item', id: 'i1', matches() { return false; } };
assert.equal(isProtectedEntity(utility), true, 'dropped items are protected');
const self = { isValid: true, typeId: 'minecraft:zombie', id: 'e2', matches: () => false };
assert.equal(isProtectedEntity(self, self), true, 'the caster is never hit by their own AoE');
const monster = { isValid: true, typeId: 'minecraft:zombie', id: 'e3', matches: () => false };
assert.equal(isProtectedEntity(monster), false, 'ordinary monsters are targetable');

// A real ItemStack returns a live durability component for the same stack, so
// the mock keeps one component object per stack.
const durab = (max, damage) => {
  const component = { damage, maxDurability: max, getEnchantment: () => undefined };
  const stack = { getComponent: () => component };
  return stack;
};

function equipped(mode) {
  const state = { mainhand: undefined };
  const player = {
    dimension: { playSound: (s) => soundCalls.push(s) },
    location: { x: 0, y: 64, z: 0 },
    getGameMode: () => mode,
    getComponent: () => ({
      getEquipment: () => state.mainhand,
      setEquipment: (_slot, value) => { state.mainhand = value; },
    }),
  };
  return { player, state };
}
{
  const { player, state } = equipped('creative');
  state.mainhand = { typeId: 'effect:time_sword', ...durab(100, 10) };
  consumeMainhandDurability(player, 64);
  assert.equal(state.mainhand.getComponent().damage, 10, 'creative must not consume durability');
}
{
  const { player, state } = equipped('survival');
  state.mainhand = { typeId: 'effect:time_sword', ...durab(100, 10) };
  assert.equal(consumeMainhandDurability(player, 0), true, 'zero cost is a no-op');
  assert.equal(state.mainhand.getComponent().damage, 10);
  assert.equal(consumeMainhandDurability(player, 5), true);
  assert.equal(state.mainhand.getComponent().damage, 15, 'durability is applied to the very same stack');
  state.mainhand = { typeId: 'effect:time_sword', ...durab(100, 95) };
  assert.equal(consumeMainhandDurability(player, 10), false, 'breaking the sword reports failure');
  assert.equal(state.mainhand, undefined, 'a broken sword is removed from the hand');
  assert.ok(soundCalls.includes('random.break'));
  assert.equal(consumeMainhandDurability(player, 1), false, 'no sword in hand cannot pay durability');
}
console.log('Utils: moon window, teleport failure, protection rules, empty hand and durability cost OK');
