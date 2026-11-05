// Leaving the Shulker shell is driven by the entity event, not by a script guess.
//
// 2.8.8 `player.json`:
//   enter -> ride @s summon_ride entity:shulker_shield ... (group effect:shulker_hiding)
//   leave -> event entity @p[family=shulker_sword,r=6] stop_shulker_sword_event
// The remake implemented "leave" inside the passive tick (comparing riders every
// pass) and shipped NO handler for `stop_shulker_sword_event`, so the shell's own
// `minecraft:despawn` (2.8.8: `event entity @p[family=shulker_sword,r=6]
// stop_shulker_sword_event`) pointed at an event nothing listened to.
//
// This test runs the shipped passiveEngine.js against a mock world and fires the
// data-driven event, checking that the player is switched back to the sword state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js', 'utf8')
  .replace(/^import .*?;\s*$/gm, '')
  .replace(/\bexport /g, '');

const subscriptions = {};
const signal = (name) => ({
  subscribe(fn) {
    (subscriptions[name] ??= []).push(fn);
    return fn;
  },
  unsubscribe() {},
});

const context = vm.createContext({
  console,
  Math,
  JSON,
  Date,
  setTimeout,
  clearTimeout,
  Player: class {},
  EntityComponentTypes: {},
  EntityDamageCause: {},
  EquipmentSlot: { Mainhand: 'Mainhand' },
  GameMode: { creative: 'creative', survival: 'survival' },
  MoonPhase: { FullMoon: 0 },
  BlockPermutation: { resolve: () => undefined },
  Vector3: {},
  // The bundled engine imports these from sibling modules; the vm has them stripped.
  recoverRandomTickSpeed() {},
  setTimeSwordActive() {},
  getMainhandItem: () => undefined,
  getOffhandItem: () => undefined,
  isFullMoonNight: () => false,
  isInVillage: () => false,
  isProtectedEntity: () => false,
  tryConvertSpongeSword() {},
  resetSpongeSwordState() {},
  mountPlayerSlime() {},
  spawnSwordLightning() {},
  BRIGHT_LIGHT_SWORDS: new Set(),
  BRIGHT_LIGHT_TYPE: 'effect99:lightblock',
  DIM_LIGHT_TYPE: 'effect99:lightblock2',
  lightVolumeForSword: () => undefined,
  EntitySwingSource: {},
  Entity: class {},
  system: {
    currentTick: 0,
    run() {},
    runTimeout() {},
    runInterval() {},
    clearRun() {},
    afterEvents: {},
    beforeEvents: {},
  },
  world: {
    afterEvents: {
      playerLeave: signal('playerLeave'),
      playerDimensionChange: signal('playerDimensionChange'),
      playerSpawn: signal('playerSpawn'),
      entityDie: signal('entityDie'),
      entityHurt: signal('entityHurt'),
      itemUse: signal('itemUse'),
      dataDrivenEntityTrigger: signal('dataDrivenEntityTrigger'),
      projectileHitEntity: signal('projectileHitEntity'),
      entitySpawn: signal('entitySpawn'),
      explosion: signal('explosion'),
    },
    beforeEvents: {},
    getDynamicProperty: () => undefined,
    setDynamicProperty: () => {},
    getDimension: () => ({ id: 'minecraft:overworld', getEntities: () => [], getBlock: () => undefined }),
    getAllPlayers: () => [],
    sendMessage: () => {},
    getTimeOfDay: () => 6000,
    getMoonPhase: () => 0,
    gameRules: { randomTickSpeed: 1 },
    scoreboard: { getObjective: () => undefined },
  },
});
vm.runInContext(code + '\nthis.startEngine = startPassiveEngine;', context);

context.startEngine();
const handlers = subscriptions.dataDrivenEntityTrigger ?? [];
assert.ok(handlers.length > 0, 'the passive engine must listen for stop_shulker_sword_event');

const triggered = [];
const player = {
  typeId: 'minecraft:player',
  id: 'p-shulker',
  name: 'Tester',
  location: { x: 0, y: 64, z: 0 },
  dimension: { id: 'minecraft:overworld' },
  isValid: true,
  isSneaking: false,
  getComponent: () => undefined,
  triggerEvent: (name) => triggered.push(name),
  onScreenDisplay: { setActionBar() {} },
  playAnimation() {},
  addEffect() {},
  removeEffect() {},
  hasTag: () => false,
  addTag() {},
  removeTag() {},
  runCommand: () => ({ successCount: 1 }),
  matches: () => false,
};

for (const handler of handlers) {
  handler({ eventId: 'stop_shulker_sword_event', entity: player });
}
assert.ok(
  triggered.includes('effect:equip_shulker_sword'),
  `leaving the shell must restore the sword state, got ${JSON.stringify(triggered)}`
);

// An unrelated player event must not touch the shell state.
triggered.length = 0;
for (const handler of handlers) {
  handler({ eventId: 'minecraft:entity_spawned', entity: player });
}
assert.deepEqual(triggered, [], 'other data events must be ignored');

// The shipped shell entity must point its despawn at that event, which is what
// closes the loop when the 20 HP shell is destroyed with the player inside.
const shell = JSON.parse(fs.readFileSync('packs/Swords_B/entities/shulker_shield.json', 'utf8'))['minecraft:entity'];
const despawnText = JSON.stringify(shell.events['minecraft:despawn']);
assert.ok(
  despawnText.includes('stop_shulker_sword_event'),
  'the shell despawn must release the player through stop_shulker_sword_event'
);
assert.ok(
  shell.components['minecraft:health']?.value === 20,
  'the shell keeps its 20 HP from 2.8.8'
);
console.log('Shulker shell: exit driven by stop_shulker_sword_event, shell despawn closes the loop OK');
