// Grass Sword must bury a mob once and clear the tag beyond r=9, as in 2.8.8.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const signals = new Proxy({}, { get: () => ({ subscribe() {} }) });
let loop;
const air = { isAir: true, typeId: 'minecraft:air', setType(t) { this.typeId = t; this.isAir = false; } };
const grassBlock = { isAir: false, typeId: 'minecraft:grass_block' };
const dim = { id: 'minecraft:overworld', heightRange: { min: -64, max: 320 },
  getBlock(pos) { return pos.y === 63 ? grassBlock : air; },
  getEntities() { return [mob]; }, spawnEntity(type, loc) { spawned.push([type, loc]); return { isValid: true, remove() {} }; },
  getPlayers() { return []; }, playSound() {}, spawnParticle() {} };
const spawned = [];
const mob = { id: 'mob', typeId: 'minecraft:zombie', location: { x: 0.5, y: 64, z: 0.5 }, isValid: true,
  tags: new Set(), hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); },
  getComponent() {}, matches() { return false; } };
const player = { id: 'p', isValid: true, dimension: dim, location: { x: 0.5, y: 64, z: 0.5 },
  getComponent() { return undefined; }, getGameMode() { return 'survival'; },
  addEffect() {}, removeEffect() {}, getVelocity() { return { x: 0, y: 0, z: 0 }; },
  getViewDirection() { return { x: 0, y: 0, z: 1 }; }, applyDamage() {}, applyKnockback() {},
  onScreenDisplay: { setActionBar() {} }, triggerEvent() {} };
const ctx = vm.createContext({ Math: Object.create(Math), system: { currentTick: 0, afterEvents: signals, runInterval(cb) { loop = cb; }, runTimeout() {} },
  world: { afterEvents: signals, getAllPlayers() { return [player]; }, getDimension() { return dim; },
    getTimeOfDay() { return 1000; }, getMoonPhase() { return 0; }, setTimeOfDay() {}, setDynamicProperty() {},
    getDynamicProperty() {}, gameRules: { randomTickSpeed: 1 }, scoreboard: { getObjective() { return undefined; } } },
  EntityComponentTypes: {}, EntityDamageCause: {}, EquipmentSlot: {}, GameMode: { Creative: 'creative' },
  MoonPhase: { FullMoon: 0 }, BlockPermutation: { resolve: (t, s) => ({ type: t, ...s }) },
  isProtectedEntity: (e, o) => e.id === o.id, tryConvertSpongeSword() {}, mountPlayerSlime() {},
  isFullMoonNight: () => false, isDesertWellWater: () => false, recoverRandomTickSpeed() {}, setTimeSwordActive() {},
  spawnSwordLightning() {}, getMainhandItem: () => ({ typeId: 'effect:grass_sword' }),
  getOffhandItem: () => undefined, BRIGHT_LIGHT_SWORDS: new Set(), LIGHT_EMITTING_SWORDS: new Set(),
  BRIGHT_LIGHT_TYPE: 'effect99:lightblock', DIM_LIGHT_TYPE: 'effect99:lightblock2',
  lightVolumeForSword: () => undefined,
  EntitySwingSource: {}, Player: class {}, Entity: class {} });
vm.runInContext(`${code}\nthis.start=startPassiveEngine`, ctx); ctx.start();
// The engine counts its own ticks: ten interval runs reach the tick%10 behaviour once.
for (let i = 1; i <= 10; i++) { ctx.system.currentTick = i; loop(); }
assert.equal(spawned.length, 1, 'the same mob must be buried only once');
assert.ok(mob.hasTag('grass'));
mob.location = { x: 40.5, y: 64, z: 0.5 };
for (let i = 11; i <= 20; i++) { ctx.system.currentTick = i; loop(); }
assert.equal(mob.hasTag('grass'), false, 'the tag must clear when the mob is beyond r=9');
mob.location = { x: 0.5, y: 64, z: 0.5 };
for (let i = 21; i <= 30; i++) { ctx.system.currentTick = i; loop(); }
assert.equal(spawned.length, 2, 'a mob that returns must be buried again');
console.log('Grass sword: one grass block per mob, tag cleared beyond radius, re-buried on return');
