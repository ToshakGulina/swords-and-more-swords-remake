import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/swordSkills.js','utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const pending = [];
class Player {
  constructor(mode) { this.id = 'p'; this.mode = mode; this.killed = false; this.equipment = 'sword'; }
  getGameMode() { return this.mode; }
  getComponent() { return { setEquipment: (_slot, value) => { this.equipment = value; } }; }
  kill() { this.killed = true; }
}
const ctx = vm.createContext({ Player, system: { currentTick: 1, run: cb => pending.push(cb) },
  GameMode: { Creative: 'creative', Survival: 'survival' }, EntityComponentTypes: { Equippable:'equippable' },
  isFullMoonNight: () => true });
vm.runInContext(`${code}\nthis.register = registerItemComponents`, ctx);
let component; ctx.register({registerCustomComponent(_id, c) {component = c;}});
const dim = { spawnParticle() {}, playSound() {} };
for (const mode of ['survival', 'creative']) {
  const player = new Player(mode); let extraDamage = 0;
  const victim = { isValid: true, typeId: 'minecraft:zombie', dimension: dim, location: {x:0,y:0,z:0}, applyDamage(d) { extraDamage += d; } };
  component.onHitEntity({ attackingEntity: player, hitEntity: victim, itemStack: {typeId:'effect:quartz_sword'} });
  while (pending.length) pending.shift()();
  assert.equal(extraDamage, 0, 'quartz item damage must not be applied a second time');
  assert.equal(player.killed, mode === 'survival');
  component.onHitEntity({ attackingEntity: player, hitEntity: victim, itemStack: {typeId:'effect:wolf_sword'} });
  assert.equal(extraDamage, 0, 'werewolf attack must not be applied twice');
}
const ent = JSON.parse(fs.readFileSync('packs/Swords_B/entities/player.json'))['minecraft:entity'];
assert.equal(ent.component_groups['effect:wolf_transformation']['minecraft:attack'].damage, 15);
console.log('Quartz and wolf combat callbacks: no duplicate scripted hit; creative sacrifice excluded');
