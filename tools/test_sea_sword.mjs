// Exact 2.8.8 Sea Sword behaviour: conduction in water, camera shake and the
// fish-flop sound out of water. The original never applies scripted damage —
// drowning comes from the `minecraft:breathable` group.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '')
  .replace(/\bexport /g, '');

const signal = { subscribe() {} };
const calls = { sounds: [], commands: [], effects: [] };
const dim = {
  id: 'minecraft:overworld',
  getEntities() { return []; },
  getBlock() { return undefined; },
  playSound(id) { calls.sounds.push(id); },
};
const player = {
  id: 'p',
  isValid: true,
  dimension: dim,
  location: { x: 0, y: 64, z: 0 },
  isInWater: true,
  item: 'effect:sea_sword',
  triggerEvent() {},
  getGameMode() { return 'survival'; },
  getComponent() {},
  getVelocity() { return { x: 0, y: 0, z: 0 }; },
  getViewDirection() { return { x: 0, y: 0, z: 1 }; },
  addEffect(id, ticks, opts) { calls.effects.push([id, ticks, opts?.amplifier]); },
  removeEffect(id) { calls.effects.push(['remove:' + id]); },
  applyDamage() { throw new Error('the Sea Sword must not apply scripted damage'); },
  runCommand(cmd) { calls.commands.push(cmd); },
};

let tick;
const ctx = vm.createContext({
  world: {
    afterEvents: { playerLeave: signal, playerSpawn: signal, playerDimensionChange: signal },
    getAllPlayers: () => [player],
    getTimeOfDay: () => 6000,
    getMoonPhase: () => 0,
    getDimension: () => dim,
  },
  system: { runInterval(cb) { tick = cb; } },
  recoverRandomTickSpeed() {},
  setTimeSwordActive() {},
  tryConvertSpongeSword() {},
  isFullMoonNight: () => false,
  isProtectedEntity: () => false,
  getMainhandItem: (p) => (p.item ? { typeId: p.item } : undefined),
  getOffhandItem: () => undefined,
  BRIGHT_LIGHT_SWORDS: new Set(),
  LIGHT_EMITTING_SWORDS: new Set(),
  BRIGHT_LIGHT_TYPE: 'effect99:lightblock', DIM_LIGHT_TYPE: 'effect99:lightblock2',
  lightVolumeForSword: () => undefined,
  EntityComponentTypes: { Rideable: 'rideable', Equippable: 'equippable' },
  EntityDamageCause: { magic: 'magic', drowning: 'drowning' },
  GameMode: { Creative: 'creative' },
  MoonPhase: { FullMoon: 0 },
  EquipmentSlot: { Mainhand: 'Mainhand' },
  BlockPermutation: { resolve: () => ({}) },
});

vm.runInContext(`${code}\nthis.start = startPassiveEngine`, ctx);
ctx.start();

// Ten 2-tick iterations ≈ one second of the original 0.5 s timer.
for (let i = 0; i < 10; i++) tick();
assert.ok(calls.effects.some(([id]) => id === 'conduit_power'), 'in water the sword must grant conduit power');
assert.equal(calls.commands.length, 0, 'no camera shake while swimming');

calls.effects.length = 0;
player.isInWater = false;
for (let i = 0; i < 10; i++) tick();
assert.ok(calls.commands.some((c) => c.startsWith('camerashake add @s')), 'out of water the original shakes the camera');
assert.ok(calls.sounds.includes('mob.fish.flop'), 'out of water the original plays the fish flop sound');
assert.ok(calls.effects.some(([id]) => id === 'remove:conduit_power'), 'conduction is cleared out of water');

console.log('Sea Sword: conduction in water, shake/sound on land, no scripted damage');
