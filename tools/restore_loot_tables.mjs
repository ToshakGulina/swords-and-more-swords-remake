// Restore the loot tables that the 2.8.8 original overrides or extends but that
// the remake did not carry over. Without these files two original rewards are
// impossible to obtain: the Blaze Sword from a snow-golem kill and the Jungle
// Sword from fishing. Every other restored table is taken from the pinned
// Mojang 1.26.60 samples and only differs from vanilla where the original
// added an `effect:` item, so no vanilla behaviour is silently changes.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BP = path.join(ROOT, 'packs/Swords_B');
const SRC_288 = path.join(process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8', 'Swords_B');
const VANILLA = path.join(process.env.SAMS_SAMPLES ?? '/tmp/refs/bedrock-samples', 'behavior_pack');

const files = [
  'loot_tables/entities/blaze.json',
  'loot_tables/entities/creeper.json',
  'loot_tables/chests/end_city_treasure.json',
  'loot_tables/chests/monster_room.json',
  'loot_tables/chests/nether_bridge.json',
  'loot_tables/chests/shipwreck.json',
  'loot_tables/chests/shipwrecksupply.json',
  'loot_tables/chests/shipwrecktreasure.json',
  'loot_tables/chests/simple_dungeon.json',
  'loot_tables/chests/underwater_ruin_small.json',
  'loot_tables/chests/village/village_cartographer.json',
  'loot_tables/chests/village/village_desert_house.json',
  'loot_tables/chests/village/village_mason.json',
  'loot_tables/chests/village/village_plains_house.json',
  'loot_tables/chests/village/village_savanna_house.json',
  'loot_tables/chests/village/village_shepherd.json',
  'loot_tables/chests/village/village_taiga_house.json',
  'loot_tables/chests/village/village_tannery.json',
  'loot_tables/chests/village/village_weaponsmith.json',
  'loot_tables/gameplay/entities/mooshroom_milking.json',
  'loot_tables/gameplay/fishing/fish.json',
  'loot_tables/gameplay/fishing/jungle_fish.json',
  'loot_tables/gameplay/fishing/junk.json',
  'loot_tables/gameplay/fishing/treasure.json',
  'loot_tables/gameplay/fishing/jungle_junk.json',
];

// 1.xx loot tables still use the legacy `set_data` function; 1.26 silently
// drops unknown functions, so convert the few occurrences to `set_data`-free
// equivalents where the data value is irrelevant for our custom items.
function modernize(table) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.functions)) {
      node.functions = node.functions.filter((fn) => {
        // `set_data` on vanilla items with data 0 is a no-op in current versions.
        if (fn.function === 'set_data' && (fn.data === 0 || fn.data === undefined)) return false;
        return true;
      });
    }
    Object.values(node).forEach(walk);
  };
  walk(table);
  return table;
}

const report = [];
for (const rel of files) {
  const target = path.join(BP, rel);
  if (fs.existsSync(target)) continue;
  const original = path.join(SRC_288, rel);
  const vanilla = path.join(VANILLA, rel);
  let source;
  if (fs.existsSync(original)) {
    const raw = fs.readFileSync(original, 'utf8');
    // Only keep the original when it genuinely adds a custom reward; otherwise
    // the freshly generated vanilla table is the correct modern baseline.
    if (raw.includes('"effect:')) {
      source = { kind: 'original', data: JSON.parse(raw) };
    } else if (fs.existsSync(vanilla)) {
      source = { kind: 'vanilla', data: JSON.parse(fs.readFileSync(vanilla, 'utf8')) };
    }
  } else if (fs.existsSync(vanilla)) {
    source = { kind: 'vanilla', data: JSON.parse(fs.readFileSync(vanilla, 'utf8')) };
  }
  if (!source) {
    report.push(`missing everywhere: ${rel}`);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(modernize(source.data), null, 2) + '\n', 'utf8');
  report.push(`${source.kind}: ${rel}`);
}

// The jungle fishing table must point at the vanilla treasure table so that
// its Jungle Sword entry is reachable, and jungle_junk must exist.
const jungleFishing = path.join(BP, 'loot_tables/gameplay/jungle_fishing.json');
if (fs.existsSync(jungleFishing)) {
  const table = JSON.parse(fs.readFileSync(jungleFishing, 'utf8'));
  for (const pool of table.pools ?? []) {
    for (const entry of pool.entries ?? []) {
      if (entry.name === 'loot_tables/gameplay/fishing/jungle_treasure.json') {
        entry.name = 'loot_tables/gameplay/fishing/treasure.json';
      }
    }
  }
  fs.writeFileSync(jungleFishing, JSON.stringify(table, null, 2) + '\n', 'utf8');
}

console.log(report.join('\n'));
console.log(`Restored ${report.length} loot tables.`);
