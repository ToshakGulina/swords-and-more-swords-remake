// `minecraft:instant_despawn` may only be a top-level component, never a component group.
//
// Vanilla honours `minecraft:instant_despawn` when the entity is created. Adding it
// later through a component group is a documented no-op, so every "despawn now" event
// in the remake used to fire, do nothing, and leave the entity alive: the Nether Star
// turrets, the objective marker, the spectral crystal, the mini creeper and every
// projectile that was supposed to clean itself up.
//
// 2.8.8 gets away with the pattern because it uses plain `minecraft:despawn`, which is
// evaluated every tick. The remake now does the same. This test pins that down:
//   * no component group may carry `minecraft:instant_despawn`;
//   * any event named `*despawn*` must add a group that exists;
//   * groups reached by such an event must contain `minecraft:despawn`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = 'packs/Swords_B/entities';
const offenders = [];
const dangling = [];

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const file = path.join(dir, name);
  let entity;
  try {
    entity = JSON.parse(fs.readFileSync(file, 'utf8'))['minecraft:entity'];
  } catch {
    continue; // JSONC files are covered by the build step, not here
  }
  const groups = entity?.component_groups ?? {};

  for (const [groupName, group] of Object.entries(groups)) {
    if (Object.prototype.hasOwnProperty.call(group ?? {}, 'minecraft:instant_despawn')) {
      offenders.push(`${name}: component group "${groupName}"`);
    }
  }

  for (const [eventName, body] of Object.entries(entity?.events ?? {})) {
    if (!/despawn/i.test(eventName)) continue;
    const text = JSON.stringify(body);
    for (const m of text.matchAll(/"component_groups":\s*\[([^\]]*)\]/g)) {
      for (const raw of m[1].split(',')) {
        const ref = raw.trim().replace(/^"|"$/g, '');
        if (!ref) continue;
        if (!groups[ref]) {
          dangling.push(`${name}: event "${eventName}" -> missing group "${ref}"`);
          continue;
        }
        const carriesDespawn =
          Object.prototype.hasOwnProperty.call(groups[ref], 'minecraft:despawn') ||
          Object.prototype.hasOwnProperty.call(groups[ref], 'minecraft:instant_despawn');
        // `mountable_slime` is the documented exception: 2.8.8's own
        // `minecraft:despawn` event adds `defense_mode_slime`, which carries no
        // despawn component at all. Faithfulness beats the general rule there.
        const isKnownException = name === 'mountable_slime.json' && ref === 'defense_mode_slime';
        if (!carriesDespawn && !isKnownException) {
          dangling.push(`${name}: event "${eventName}" -> group "${ref}" has no despawn component`);
        }
      }
    }
  }
}

assert.deepEqual(offenders, [], `instant_despawn inside component groups: ${offenders.join('; ')}`);
assert.deepEqual(dangling, [], `despawn events with broken groups: ${dangling.join('; ')}`);
console.log('Despawn groups: native despawn components, no dangling references OK');
