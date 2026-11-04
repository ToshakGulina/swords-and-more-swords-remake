// Missing cosmetic assets must not stop the 5-6 second Fire Sword rain reaction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/worldEvents.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const signals = new Proxy({}, { get: () => ({ subscribe() {} }) });
let loop; const drops = [];
const item = { id: 'fire', isValid: true, location: { x: 0, y: 65, z: 0 },
  hasTag() { return false; }, getComponent() { return { itemStack: { typeId: 'effect:fire_sword' } }; },
  remove() { this.isValid = false; } };
const dim = { id: 'minecraft:overworld', getEntities(q) { return q.type === 'minecraft:item' && item.isValid ? [item] : []; },
  getBlock() { return { typeId: 'minecraft:air' }; }, getTopmostBlock() { return { location: { y: 64 } }; },
  getBiome() { return { id: 'minecraft:plains' }; },
  playSound() { throw Error('missing sound'); }, spawnParticle() { throw Error('missing particle'); },
  spawnItem(stack) { drops.push(stack.typeId); } };
const empty = { getEntities() { return []; } };
class ItemStack { constructor(typeId) { this.typeId = typeId; } }
const ctx = vm.createContext({ ItemStack, EntityComponentTypes: { Item: 'item' }, WeatherType: { Clear: 'clear' },
  world: { afterEvents: signals, getDynamicProperty() { return true; }, getDimension(name) { return name === 'overworld' ? dim : empty; } },
  system: { afterEvents: signals, runInterval(cb) { loop = cb; } }, registerAirSwingEvents() {},
  // Stripped utils import: the rain check asks whether the biome rains at all.
  isNonRainingBiome: (id) => /desert|snow|frozen/.test(id) });
vm.runInContext(`${code}\nthis.start=registerWorldEvents`, ctx); ctx.start();
// 2.8.8 runs a one-shot 5-6 s `randomInterval` timer, i.e. 10 to 12 ten-tick
// checks. It must not transform before the shortest window and must by the
// longest one.
for (let i = 0; i < 9; i++) { loop(); assert.deepEqual(drops, [], `no transformation before 5 s (check ${i + 1})`); }
for (let i = 10; i <= 12 && drops.length === 0; i++) loop();
assert.deepEqual(drops, ['effect:obsidian_sword'], 'transforms within the 5-6 s window');
assert.equal(item.isValid, false);
console.log('Rain reaction: missing cosmetics do not prevent Fire Sword transformation');
