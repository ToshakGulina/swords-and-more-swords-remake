// The Spectral Sword's overhead crystal is addressed by selector, exactly like 2.8.8.
//
// 2.8.8 never stores the crystal: every call is
//   @e[type=ender_crystal,family=!ender_crystal_default,family=!ender_crystal_scale,c=1,r=4]
// The remake regressed to `getRiders()`, and because the crystal it spawned was not
// actually riding the player, the 1 % explosion branches became no-ops.
//
// Two kinds of checks, both cheap:
//   1. source contract — explodeSpectralCrystal must resolve through a selector by
//      type/family and no crystal lookup may use the rider list;
//   2. shipped bundle — the generated swordSkills.js must carry the same selector
//      before the build step is trusted.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('src/swordSkills.ts', 'utf8');
const bundle = fs.readFileSync('packs/Swords_B/scripts/swordSkills.js', 'utf8');

// 1) The lookup goes through getEntities with the crystal's type and both excluded
//    families — never through `getRiders()`.
for (const [name, text] of [['source', src], ['bundle', bundle]]) {
  assert.ok(
    /type:\s*'minecraft:ender_crystal'/.test(text),
    `${name}: the overhead crystal must be looked up by type`
  );
  assert.ok(
    text.includes("excludeFamilies: ['ender_crystal_default', 'ender_crystal_scale']"),
    `${name}: the default and shrunken crystal families must be excluded`
  );
  const riderLookup = text.slice(0, text.indexOf('function explodeSpectralCrystal'));
  assert.ok(
    !/getRiders\(\)[\s\S]{0,300}ender_crystal/.test(riderLookup),
    `${name}: no rider lookup may be used to find the overhead crystal`
  );
}

// 2) explodeSpectralCrystal must route through the shared helper, so every caller
//    (on_use, weapon branch, air swing) picks up the selector.
assert.ok(
  /function explodeSpectralCrystal\(player: Player\): void \{\s*\n\s*findOverheadCrystal\(player\)\?\.triggerEvent\('minecraft:crystal_explode'\);/.test(
    src
  ),
  'explodeSpectralCrystal must fire on the selector match'
);

// 3) on_use shrinks the crystal through the same helper with the 2.8.8 event name,
//    and the crystal is summoned 1.8 blocks up as `summon ender_crystal ~ ~1.8 ~` does.
assert.ok(
  /findOverheadCrystal\(player\)\?\.triggerEvent\('effect:ender_crystal_scale'\)/.test(src),
  'on_use must shrink the crystal through the selector'
);
const engine = fs.readFileSync('src/passiveEngine.ts', 'utf8');
assert.ok(
  /player\.location\.y \+ 1\.8/.test(engine),
  'the overhead crystal must spawn 1.8 blocks above the player'
);

console.log('Spectral crystal: selector lookup, empty rider list tolerated, 1.8 spawn OK');
