// Exact 2.8.8 Sponge Sword: water becomes sponge and sponge becomes air only
// while the holder is in water or rain, and the counter converts the sword at
// 150 ticks of absorption.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('packs/Swords_B/scripts/swordSkills.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '')
  .replace(/\bexport /g, '');

const WET = 'minecraft:water';
const blocks = new Map();
const key = (p) => `${p.x},${p.y},${p.z}`;
// A 5x5x5 lake of water centred on the player.
for (let x = -2; x <= 2; x++) {
  for (let y = -2; y <= 2; y++) {
    for (let z = -2; z <= 2; z++) {
      blocks.set(key({ x, y: 64 + y, z }), { typeId: WET });
    }
  }
}
const tile = (loc) => {
  const k = key(loc);
  if (!blocks.has(k)) blocks.set(k, { typeId: 'minecraft:air' });
  const b = blocks.get(k);
  return {
    get typeId() { return b.typeId; },
    isAir: b.typeId === 'minecraft:air',
    setType(t) { b.typeId = t; blocks.set(k, b); },
  };
};

const equipped = { typeId: 'effect:sponge_sword' };
const player = {
  id: 'p',
  isValid: true,
  location: { x: 0, y: 64, z: 0 },
  isInWater: true,
  dimension: {
    id: 'minecraft:overworld',
    getBlock: tile,
    playSound() {},
    spawnParticle() {},
  },
  onScreenDisplay: { setActionBar() {} },
  getComponent: () => ({
    setEquipment: (_slot, item) => { equipped.typeId = item.typeId; },
  }),
};

const ctx = vm.createContext({
  system: { currentTick: 0 },
  EntityComponentTypes: { Equippable: 'equippable' },
  EquipmentSlot: { Mainhand: 'Mainhand' },
  ItemStack: class { constructor(typeId) { this.typeId = typeId; } },
  isInRain: () => false,
  getMainhandItem: () => ({ typeId: equipped.typeId }),
});
vm.runInContext(`${code}\nthis.api = { tryConvertSpongeSword }`, ctx);
const { tryConvertSpongeSword } = ctx.api;

// In water: each tick absorbs water and advances the counter.
assert.equal(tryConvertSpongeSword(player), false);
assert.equal(equipped.typeId, 'effect:sponge_sword', 'a single tick must not convert the sword');
for (let i = 0; i < 148; i++) tryConvertSpongeSword(player);
assert.equal(equipped.typeId, 'effect:sponge_sword', 'must not convert before 150 absorption ticks');
assert.equal(tryConvertSpongeSword(player), true, 'the 150th tick converts the sword');
assert.equal(equipped.typeId, 'effect:wet_sponge_sword');

// A dry player never advances the counter, so a second player with fresh water
// around them still needs the full 150 ticks.
player.id = 'q';
for (let x = -2; x <= 2; x++) {
  for (let y = -2; y <= 2; y++) {
    for (let z = -2; z <= 2; z++) blocks.set(key({ x, y: 64 + y, z }), { typeId: WET });
  }
}
equipped.typeId = 'effect:sponge_sword';
player.isInWater = false;
for (let i = 0; i < 200; i++) tryConvertSpongeSword(player);
assert.equal(equipped.typeId, 'effect:sponge_sword', 'no conversion without water or rain');

console.log('Sponge Sword: converts only in water/rain, at the 150-tick counter');
