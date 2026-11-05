// Execute the compiled manager against a deterministic mock of the stable API.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/randomTickManager.js', 'utf8')
  .replace(/^import .*?;\s*/m, '').replace(/\bexport /g, '');
function environment(initial) {
  const properties = new Map();
  const callbacks = [];
  const world = {
    gameRules: { randomTickSpeed: initial },
    getDynamicProperty: k => properties.get(k),
    setDynamicProperty: (k, v) => v === undefined ? properties.delete(k) : properties.set(k, v),
  };
  const system = { currentTick: 0, runTimeout: (cb, ticks) => callbacks.push({ cb, at: system.currentTick + ticks }) };
  function load() {
    const ctx = vm.createContext({ world, system });
    vm.runInContext(`${code}\nthis.api = {recoverRandomTickSpeed, setTimeSwordActive, boostClockSword};`, ctx);
    return ctx.api;
  }
  function advance(ticks) {
    const target = system.currentTick + ticks;
    while (true) {
      callbacks.sort((a, b) => a.at - b.at);
      if (!callbacks.length || callbacks[0].at > target) break;
      const next = callbacks.shift(); system.currentTick = next.at; next.cb();
    }
    system.currentTick = target;
  }
  return { world, system, load, advance };
}
for (const initial of [0, 1, 7, 350]) {
  const e = environment(initial); const m = e.load(); m.recoverRandomTickSpeed();
  m.boostClockSword(); assert.equal(e.world.gameRules.randomTickSpeed, 100);
  e.advance(50); m.boostClockSword(); e.advance(50); assert.equal(e.world.gameRules.randomTickSpeed, 100);
  e.advance(50); assert.equal(e.world.gameRules.randomTickSpeed, initial);
  m.boostClockSword(); m.setTimeSwordActive(true); assert.equal(e.world.gameRules.randomTickSpeed, 300);
  e.advance(50); m.setTimeSwordActive(false); assert.equal(e.world.gameRules.randomTickSpeed, 100);
  e.advance(50); assert.equal(e.world.gameRules.randomTickSpeed, initial);
  m.setTimeSwordActive(true); e.world.gameRules.randomTickSpeed = 17; m.setTimeSwordActive(false);
  assert.equal(e.world.gameRules.randomTickSpeed, 17, 'external change must survive release');
}
{
  const e = environment(9); const first = e.load(); first.setTimeSwordActive(true);
  const afterReload = e.load(); afterReload.recoverRandomTickSpeed(); assert.equal(e.world.gameRules.randomTickSpeed, 9);
}
{
  const e = environment(9); e.load().setTimeSwordActive(true); e.world.gameRules.randomTickSpeed = 12;
  e.load().recoverRandomTickSpeed(); assert.equal(e.world.gameRules.randomTickSpeed, 12, 'recovery must not overwrite external change');
}
console.log('Random tick manager: overlapping players, both swords, custom rules, external edits and restart OK');
