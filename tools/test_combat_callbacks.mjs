// Quartz Sword and Wolf Sword hit callbacks, pinned to the 2.8.8 item events.
//
// Quartz: `weapon` step 2 is `effect @a[r=1] instant_damage 1 99 true` plus the
// roar particle. `@a` is players only and is centred on the holder, so the blast
// hits every player within one block — the holder included — and never touches
// mobs. 2.8.8 has no creative exemption on that command, so the holder dies in
// Creative too.
//
// Wolf: the extra 15 damage comes from the `complete_wolf_transformation` attack
// component in C++, so the script must not add a second hit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/swordSkills.js', 'utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const pending = [];
class Player {
  constructor(id, mode) { this.id = id; this.mode = mode; this.effects = []; }
  getGameMode() { return this.mode; }
  getComponent() { return undefined; }
  addEffect(effect, duration, options) { this.effects.push({ effect, duration, options }); }
}
const ctx = vm.createContext({
  Player,
  system: { currentTick: 1, run: cb => pending.push(cb) },
  GameMode: { Creative: 'creative', Survival: 'survival' },
  EntityComponentTypes: { Equippable: 'equippable' },
  isFullMoonNight: () => true,
});
vm.runInContext(`${code}\nthis.register = registerItemComponents`, ctx);
let component;
ctx.register({ registerCustomComponent(_id, c) { component = c; } });

const dim = { spawnParticle() {}, playSound() {} };
for (const mode of ['survival', 'creative']) {
  const holder = new Player('holder', mode);
  const bystander = new Player('bystander', mode);
  const mob = { id: 'mob', isValid: true, typeId: 'minecraft:zombie', dimension: dim, location: { x: 0, y: 0, z: 0 } };
  dim.getEntities = ({ maxDistance }) => (maxDistance === 1 ? [holder, bystander, mob] : []);
  holder.dimension = dim;

  let extraDamage = 0;
  const victim = { isValid: true, typeId: 'minecraft:zombie', dimension: dim, location: { x: 0, y: 0, z: 0 }, applyDamage(d) { extraDamage += d; } };
  component.onHitEntity({ attackingEntity: holder, hitEntity: victim, itemStack: { typeId: 'effect:quartz_sword' } });
  while (pending.length) pending.shift()();

  assert.equal(extraDamage, 0, 'quartz item damage must not be applied a second time');
  const hit = [holder, bystander].filter((p) => p.effects.some((e) => e.effect === 'instant_damage' && e.options.amplifier === 99));
  assert.deepEqual(hit.map((p) => p.id).sort(), ['bystander', 'holder'],
    '@a[r=1] hits every player within one block, the holder included, in every game mode');
  assert.equal(mob.effects, undefined, '@a never touches mobs');

  holder.effects.length = 0;
  bystander.effects.length = 0;
  component.onHitEntity({ attackingEntity: holder, hitEntity: victim, itemStack: { typeId: 'effect:wolf_sword' } });
  assert.equal(extraDamage, 0, 'werewolf attack must not be applied twice');
}

const ent = JSON.parse(fs.readFileSync('packs/Swords_B/entities/player.json'))['minecraft:entity'];
assert.equal(ent.component_groups['effect:wolf_transformation']['minecraft:attack'].damage, 15);
assert.equal(ent.component_groups['effect:wolf_transformation']['minecraft:movement'].value, 0.18,
  '2.8.8 wolf_movement is 0.18 and there is no health or scale override');
assert.ok(!ent.component_groups['effect:wolf_transformation']['minecraft:health'],
  'the werewolf keeps the holder 20 hearts, like the original');
console.log('Quartz @a blast and wolf combat callbacks: exact 2.8.8 targets, no duplicate hit');
