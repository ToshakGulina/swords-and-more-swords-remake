// Exercise the actual compiled mount ownership function with two players.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const spawned = [];
const dimension = { id: 'minecraft:overworld', spawnEntity(type, loc) {
  const e = { typeId: type, location: loc, dimension, isValid: true, riders: [],
    triggerEvent() {}, remove() { this.isValid = false; },
    getComponent() { return { addRider: p => e.riders.push(p.id) }; } };
  spawned.push(e); return e;
} };
const context = vm.createContext({ EntityComponentTypes: { Rideable: 'rideable' } });
vm.runInContext(code + '\nthis.mount = mountPlayerSlime;', context);
const a = { id: 'a', dimension, location: {x: 0,y: 70,z: 0} };
const b = { id: 'b', dimension, location: {x: 1,y: 70,z: 0} };
context.mount(a); context.mount(b); context.mount(a);
assert.equal(spawned.length, 2);
assert.deepEqual(spawned[0].riders, ['a', 'a']);
assert.deepEqual(spawned[1].riders, ['b']);
spawned[0].isValid = false; context.mount(a);
assert.equal(spawned.length, 3);
assert.deepEqual(spawned[2].riders, ['a']);
assert.equal(spawned[1].isValid, true);
console.log('Slime mounts: nearby players keep separate, tracked companions');
