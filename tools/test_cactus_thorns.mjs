// Exercise the actual hurt callback with two cactus-sword wielders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/worldEvents.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const callbacks = {};
const signals = new Proxy({}, { get: (_t, k) => ({ subscribe(fn) { callbacks[k] = fn; } }) });
class Player {
  constructor(id) { this.id = id; this.isValid = true; this.hits = []; }
  applyDamage(amount, source) {
    this.hits.push([amount, source.cause]);
    assert.ok(this.hits.length < 4, 'thorns reflection must not recurse');
    callbacks.entityHurt({ hurtEntity: this, damageSource: source });
  }
}
const ctx = vm.createContext({ Player, EntityDamageCause: { thorns: 'thorns' },
  getMainhandItem: () => ({ typeId: 'effect:cactus_sword' }),
  world: { afterEvents: signals, getDynamicProperty() {} },
  system: { afterEvents: signals, runInterval() {} }, registerAirSwingEvents() {} });
vm.runInContext(`${code}\nthis.start=registerWorldEvents`, ctx); ctx.start();
const a = new Player('a'), b = new Player('b');
callbacks.entityHurt({ hurtEntity: a, damageSource: { cause: 'entityAttack', damagingEntity: b } });
assert.deepEqual(b.hits, [[2, 'thorns']]);
assert.deepEqual(a.hits, []);
callbacks.entityHurt({ hurtEntity: a, damageSource: { cause: 'thorns', damagingEntity: b } });
assert.equal(b.hits.length, 1, 'external thorns damage must not be reflected');
console.log('Cactus thorns: normal hit reflected once, thorns damage does not recurse');
