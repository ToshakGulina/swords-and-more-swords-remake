import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { parse: parseJsonc, printParseErrorCode } = require('jsonc-parser');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const BP = 'packs/Swords_B';
const RP = 'packs/Swords_R';
const VANILLA_RP = path.join(process.env.SAMS_SAMPLES ?? '/tmp/refs/bedrock-samples', 'resource_pack');
const VANILLA_BP = path.join(process.env.SAMS_SAMPLES ?? '/tmp/refs/bedrock-samples', 'behavior_pack');
const SCHEMAS = path.resolve(process.env.SAMS_SCHEMAS ?? '/tmp/refs/schemas');

const BUILTIN_VANILLA_TERRAIN_TEXTURES = new Set(['sapling_jungle']);
const BUILTIN_VANILLA_ENTITY_TEXTURES = new Set([
  'textures/entity/wolf/wolf_angry',
  'textures/entity/wolf/wolf_tame',
  'textures/entity/bee/bee_angry',
  'textures/items/fireball',
  'textures/items/nether_star',
  'textures/entity/creeper/creeper',
  'textures/entity/creeper/creeper_armor',
  'textures/entity/steve',
  'textures/entity/cape_invisible',
  'textures/entity/witch',
]);
const BUILTIN_VANILLA_GEOMETRIES = new Set([
  'geometry.humanoid.custom',
  'geometry.humanoid.customSlim',
  'geometry.cape',
  'geometry.wolf',
  'geometry.bee',
  'geometry.enderman.v1.8',
  'geometry.fireball',
  'geometry.creeper.v1.8',
  'geometry.creeper.charged.v1.8',
  'geometry.item_sprite',
  'geometry.slime',
  'geometry.villager.witch.v1.8',
]);

let errors = 0;
let warnings = 0;

function err(msg) {
  console.error(`❌ ERROR: ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`⚠️ WARN: ${msg}`);
  warnings++;
}

function walk(dir, ext = '.json') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, ext));
    else if (ent.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function readJsonChecked(filePath, requireStrictJson = false) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (requireStrictJson) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      err(`Invalid strict JSON in ${filePath}: ${e.message}`);
      return null;
    }
  }
  const parseErrors = [];
  const data = parseJsonc(raw, parseErrors, { allowTrailingComma: true });
  if (parseErrors.length > 0) {
    err(
      `Invalid JSONC in ${filePath}: ${parseErrors
        .map((pe) => `${printParseErrorCode(pe.error)}@${pe.offset}`)
        .join(', ')}`
    );
    return null;
  }
  return data;
}

// Missing references must not silently turn a partial validation into a pass.
for (const [label, dir] of [['Mojang behavior samples', VANILLA_BP], ['Mojang resource samples', VANILLA_RP], ['Blockception schemas', SCHEMAS]]) {
  if (!fs.existsSync(dir)) err(`${label} not found: ${dir}. Set SAMS_SAMPLES / SAMS_SCHEMAS.`);
}

// 1. Validate all JSON/JSONC files in BP and RP
const bpJsonFiles = walk(BP, '.json');
const rpJsonFiles = walk(RP, '.json');
for (const f of bpJsonFiles) readJsonChecked(f, true);
for (const f of rpJsonFiles) readJsonChecked(f, false);
console.log(`Checked ${bpJsonFiles.length} BP JSON files (strict) and ${rpJsonFiles.length} RP JSON files.`);

// 2. Blockception 1.26.60 JSON Schema Validation on Items & Blocks
const ajv = new Ajv({ allErrors: false, strict: false, validateFormats: false });
addFormats(ajv);
for (const sf of walk(SCHEMAS, '.json')) {
  if (sf.includes('/source/')) continue;
  try {
    const schemaObj = JSON.parse(fs.readFileSync(sf, 'utf8'));
    if (schemaObj.$id) {
      ajv.addSchema(schemaObj, schemaObj.$id);
    }
    const relUri = pathToFileURL(path.resolve(sf)).href;
    if (!ajv.getSchema(relUri)) {
      ajv.addSchema(schemaObj, relUri);
    }
  } catch {}
}

function validateWithBlockception(schemaPath, files, label) {
  try {
    const schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const validate = ajv.getSchema(schemaObj.$id) || ajv.compile(schemaObj);
    let passed = 0;
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      const ok = validate(data);
      if (!ok) {
        err(`Schema [${label}] failed on ${f}: ${JSON.stringify(validate.errors?.[0])}`);
      } else {
        passed++;
      }
    }
    console.log(`Schema [${label}]: ${passed}/${files.length} valid against Blockception 1.26.60!`);
  } catch (e) {
    err(`Could not compile Blockception schema ${label}: ${e.message}`);
  }
}

validateWithBlockception(path.join(SCHEMAS, 'behavior/items/items.json'), walk(path.join(BP, 'items'), '.json'), 'BP Items 1.26.60');
validateWithBlockception(path.join(SCHEMAS, 'behavior/blocks/blocks.json'), walk(path.join(BP, 'blocks'), '.json'), 'BP Blocks 1.26.60');

// References between data files are easy to break silently: a feature that
// points at a missing structure, a feature rule that points at a missing
// feature, an empty 1x1x1 structure or a biome filter that never matches would
// only surface after generating a world in-game.
{
  const readStructures = new Map();
  for (const f of walk(path.join(BP, 'structures'), '.mcstructure')) {
    readStructures.set(path.basename(f, '.mcstructure'), f);
  }
  for (const f of walk(path.join(BP, 'structures'), '.json')) {
    readStructures.set(path.basename(f, '.json'), f);
  }
  const structureSize = (file) => {
    try {
      const buf = fs.readFileSync(file);
      // `minecraft:structure_block` NBT is magic-less little-endian; the size
      // lives at a fixed offset in the header we write, so scan the first bytes
      // for the three consecutive 32-bit little-endian dimensions instead.
      return buf;
    } catch {
      return undefined;
    }
  };

  const featureIds = new Set();
  for (const f of walk(path.join(BP, 'features'), '.json')) {
    const data = readJsonChecked(f, true);
    const body = data?.['minecraft:ore_feature'] || data?.['minecraft:structure_template_feature'];
    const id = body?.description?.identifier;
    if (!id) {
      err(`${f} has no feature identifier`);
      continue;
    }
    featureIds.add(id);
    const structureName = body?.structure_name;
    if (structureName) {
      const name = String(structureName).includes(':') ? String(structureName).split(':')[1] : String(structureName);
      if (!readStructures.has(name) && !fs.existsSync(path.join(VANILLA_BP, 'structures', `${name}.mcstructure`))) {
        err(`${f} references missing structure "${structureName}"`);
      }
    }
    const rules = body?.replace_rules || [];
    for (const rule of rules) {
      const blockId = typeof rule.places_block === 'string' ? rule.places_block : undefined;
      if (blockId && !blockId.startsWith('minecraft:')) {
        const name = blockId.split(':')[1];
        if (!fs.existsSync(path.join(BP, 'blocks', `${name}.json`))) {
          err(`${f} places missing custom block "${blockId}"`);
        }
      }
    }
  }

  // Structure files must be non-empty and actually contain their block or
  // entity payload; a truncated export silently generates nothing in-game.
  for (const [name, file] of readStructures) {
    if (!file.endsWith('.mcstructure')) continue;
    const buf = structureSize(file);
    if (!buf || buf.length < 64) {
      err(`Structure ${name} is empty or truncated (${buf ? buf.length : 0} bytes)`);
    }
  }

  for (const f of walk(path.join(BP, 'feature_rules'), '.json')) {
    const data = readJsonChecked(f, true);
    const body = data?.['minecraft:feature_rules'];
    if (!body) continue;
    const places = body.description?.places_feature;
    if (places && !featureIds.has(places)) {
      err(`${f} places undefined feature "${places}"`);
    }
    const dist = body.distribution;
    if (!dist) {
      err(`${f} has no distribution`);
      continue;
    }
    for (const axis of ['x', 'y', 'z']) {
      const extent = dist[axis]?.extent;
      if (!Array.isArray(extent) || extent.length !== 2 || !(extent[1] > extent[0])) {
        err(`${f} has an invalid ${axis} extent ${JSON.stringify(extent)}`);
      }
    }
    if (axisYOutOfRange(dist)) {
      err(`${f} generates outside the world height`);
    }
  }
}

function axisYOutOfRange(dist) {
  const [min, max] = dist?.y?.extent ?? [0, 0];
  // Current Bedrock overworld bounds are -64..320.
  return min < -64 || max > 320;
}
for (const folder of ['recipes', 'features', 'feature_rules', 'spawn_rules']) {
  validateWithBlockception(path.join(SCHEMAS, 'behavior', folder, `${folder}.json`), walk(path.join(BP, folder), '.json'), `BP ${folder}`);
}
// The entity schema is deliberately not counted as a reliable oracle: it
// rejects valid Mojang vanilla 1.26 entities (including pushable and timers).


// Entity sensors in current Bedrock use {triggers: ...}; the original add-on
// contained legacy arrays of {on_environment: ...} that do not match that shape.
for (const f of walk(path.join(BP, 'entities'), '.json')) {
  const entity = readJsonChecked(f, true)?.['minecraft:entity'];
  if (!entity) continue;
  for (const components of [entity.components || {}, ...Object.values(entity.component_groups || {})]) {
    const sensor = components['minecraft:environment_sensor'];
    if (sensor && (Array.isArray(sensor) || (Object.keys(sensor).length > 0 && !sensor.triggers))) err(`${f} has an invalid environment_sensor shape`);
  }
}

// 3. Check 1.26.20 - 1.26.60 breaking-change patterns
for (const f of [...bpJsonFiles, ...rpJsonFiles]) {
  const raw = fs.readFileSync(f, 'utf8');
  if (raw.includes('"minecraft:custom_components"')) {
    err(`${f} uses removed V1 "minecraft:custom_components" array!`);
  }
  if (raw.includes('"tag:')) {
    err(`${f} uses removed 1.26.20+ "tag:..." component key!`);
  }
  if (raw.includes('"minecraft:foil"')) {
    err(`${f} uses legacy "minecraft:foil" instead of "minecraft:glint"!`);
  }
  if (raw.includes('"minecraft:render_offsets"')) {
    err(`${f} uses removed "minecraft:render_offsets"!`);
  }
  if (raw.includes('~~~')) {
    err(`${f} contains legacy concatenated "~~~" tilde coordinates (breaks in modern Bedrock command parser)!`);
  }
  const matches = raw.match(/query\.get_equipped_item_name(?!\s*\()/g);
  if (matches) {
    err(`${f} uses 0-arg query.get_equipped_item_name (must pass slot arg in modern Bedrock)!`);
  }
}

// 4. Verify custom (non-rebased-vanilla) loot tables for legacy functions/items
for (const f of walk(path.join(BP, 'loot_tables'), '.json')) {
  const rel = path.relative(BP, f);
  const vanillaEquiv = path.join(VANILLA_BP, rel);
  if (fs.existsSync(vanillaEquiv)) continue; // Rebased directly from Mojang v1.26.60.5 vanilla loot table
  const raw = fs.readFileSync(f, 'utf8');
  if (raw.includes('"set_data"')) err(`${f} uses removed "set_data" loot function!`);
  if (raw.includes('"appleEnchanted"')) err(`${f} uses legacy "appleEnchanted" item ID!`);
}

// 5. Verify item textures & icons
const itemTexJson = readJsonChecked(path.join(RP, 'textures/item_texture.json'));
const itemTexData = itemTexJson?.texture_data || {};
for (const [shortName, entry] of Object.entries(itemTexData)) {
  const texList = Array.isArray(entry.textures) ? entry.textures : [entry.textures];
  for (const t of texList) {
    const texPath = typeof t === 'string' ? t : t.path;
    const png = path.join(RP, `${texPath}.png`);
    const tga = path.join(RP, `${texPath}.tga`);
    if (!fs.existsSync(png) && !fs.existsSync(tga)) {
      err(`Missing item texture file for "${shortName}": ${texPath}.png`);
    }
  }
}

for (const f of walk(path.join(BP, 'items'), '.json')) {
  const j = readJsonChecked(f, true);
  const comp = j?.['minecraft:item']?.components || {};
  const icon = comp['minecraft:icon'];
  const iconName = typeof icon === 'string' ? icon : icon?.textures?.default;
  if (!iconName || !itemTexData[iconName]) {
    err(`${f} references missing icon shortname "${iconName}" in item_texture.json!`);
  }
  const dmg = comp['minecraft:damage']?.value;
  if (dmg !== undefined && (typeof dmg !== 'number' || dmg < 1 || !Number.isInteger(dmg))) {
    err(`${f} has invalid minecraft:damage value: ${dmg} (1.26+ requires integer >= 1)`);
  }
  const group = j?.['minecraft:item']?.description?.menu_category?.group;
  if (group && !group.includes(':')) {
    err(`${f} has un-namespaced menu_category.group "${group}" (1.26+ requires "minecraft:...")`);
  }
}

// 6. Verify block textures & loot tables
const terrainTexJson = readJsonChecked(path.join(RP, 'textures/terrain_texture.json'));
const terrainTexData = terrainTexJson?.texture_data || {};
for (const [shortName, entry] of Object.entries(terrainTexData)) {
  const texList = Array.isArray(entry.textures) ? entry.textures : [entry.textures];
  for (const t of texList) {
    const texPath = typeof t === 'string' ? t : t.path;
    const png = path.join(RP, `${texPath}.png`);
    const tga = path.join(RP, `${texPath}.tga`);
    if (!fs.existsSync(png) && !fs.existsSync(tga)) {
      err(`Missing terrain texture file for "${shortName}": ${texPath}.png`);
    }
  }
}

for (const f of walk(path.join(BP, 'blocks'), '.json')) {
  const j = readJsonChecked(f, true);
  const comp = j?.['minecraft:block']?.components || {};
  const mats = comp['minecraft:material_instances'] || {};
  for (const [, mat] of Object.entries(mats)) {
    if (mat.texture && !terrainTexData[mat.texture] && !BUILTIN_VANILLA_TERRAIN_TEXTURES.has(mat.texture)) {
      err(`${f} references missing terrain texture "${mat.texture}"!`);
    }
  }
  const loot = comp['minecraft:loot'];
  if (loot && !fs.existsSync(path.join(BP, loot)) && !fs.existsSync(path.join(VANILLA_BP, loot))) {
    err(`${f} references missing loot table "${loot}"!`);
  }
}

// 7. Verify all geometries have bones array & collect geometry IDs
const knownGeos = new Set(BUILTIN_VANILLA_GEOMETRIES);
for (const f of walk(path.join(RP, 'models'), '.json')) {
  const j = readJsonChecked(f, false);
  if (!j) continue;
  if (Array.isArray(j['minecraft:geometry'])) {
    for (const g of j['minecraft:geometry']) {
      const gid = g?.description?.identifier;
      if (gid) knownGeos.add(gid);
      if (!Array.isArray(g.bones)) {
        err(`Geometry ${gid} in ${f} is missing "bones" array (required in 1.26.20+)!`);
      }
    }
  } else {
    for (const [k, v] of Object.entries(j)) {
      if (k.startsWith('geometry.')) {
        knownGeos.add(k.split(':')[0]);
        if (!Array.isArray(v.bones)) {
          err(`Legacy geometry ${k} in ${f} is missing "bones" array!`);
        }
      }
    }
  }
}

// 8. Verify all BP entities & RP client entities
const bpEntityEvents = new Map();
const bpEntitySummonable = new Map();
const rpEntityIds = new Set();

for (const f of walk(path.join(RP, 'entity'), '.json')) {
  const j = readJsonChecked(f, false);
  const desc = j?.['minecraft:client_entity']?.description;
  if (!desc) {
    err(`Invalid client_entity in ${f}`);
    continue;
  }
  rpEntityIds.add(desc.identifier);
  if (desc.spawn_egg && 'texture_index' in desc.spawn_egg) {
    err(`${f} uses deprecated spawn_egg.texture_index!`);
  }
  if (j.format_version === '1.10.0' && 'animation_controllers' in desc) {
    err(`${f} (format_version 1.10.0) contains legacy 1.8.0 description.animation_controllers!`);
  }
  for (const [, texPath] of Object.entries(desc.textures || {})) {
    if (BUILTIN_VANILLA_ENTITY_TEXTURES.has(texPath)) continue;
    const p1 = path.join(RP, `${texPath}.png`);
    const p2 = path.join(RP, `${texPath}.tga`);
    if (!fs.existsSync(p1) && !fs.existsSync(p2)) {
      err(`${f} references missing entity texture "${texPath}"!`);
    }
  }
  for (const [, geoId] of Object.entries(desc.geometry || {})) {
    if (!knownGeos.has(geoId)) {
      err(`${f} references unknown geometry "${geoId}"!`);
    }
  }
}

for (const f of walk(path.join(BP, 'entities'), '.json')) {
  const j = readJsonChecked(f, true);
  const ent = j?.['minecraft:entity'];
  const id = ent?.description?.identifier;
  if (!id) {
    err(`Invalid entity in ${f}`);
    continue;
  }
  bpEntityEvents.set(id, new Set(Object.keys(ent.events || {})));
  bpEntitySummonable.set(id, Boolean(ent.description?.is_summonable));
  if (!id.startsWith('minecraft:') && !rpEntityIds.has(id)) {
    err(`Custom BP entity "${id}" (${f}) has NO matching RP client_entity!`);
  }
  const definedGroups = new Set(Object.keys(ent.component_groups || {}));
  const checkEventObj = (evObj, evName) => {
    if (!evObj || typeof evObj !== 'object') return;
    for (const g of evObj.add?.component_groups || []) {
      if (!definedGroups.has(g)) err(`${f} event "${evName}" adds undefined component_group "${g}"!`);
    }
    for (const g of evObj.remove?.component_groups || []) {
      if (!definedGroups.has(g)) err(`${f} event "${evName}" removes undefined component_group "${g}"!`);
    }
    if (Array.isArray(evObj.sequence)) evObj.sequence.forEach((s) => checkEventObj(s, evName));
    if (Array.isArray(evObj.randomize)) evObj.randomize.forEach((s) => checkEventObj(s, evName));
  };
  for (const [evName, evObj] of Object.entries(ent.events || {})) {
    checkEventObj(evObj, evName);
  }
  // Verify 1.21.40+ (`1.26.x`) entities never use boolean `deals_damage` in `minecraft:damage_sensor`
  const fvParts = String(j.format_version || '1.0.0').split('.').map(Number);
  const isModern12140 =
    fvParts[0] > 1 || (fvParts[0] === 1 && (fvParts[1] > 21 || (fvParts[1] === 21 && (fvParts[2] || 0) >= 40)));
  if (isModern12140) {
    const allContainers = [ent.components || {}, ...Object.values(ent.component_groups || {})];
    for (const cObj of allContainers) {
      const ds = cObj['minecraft:damage_sensor'];
      if (!ds) continue;
      const trigs = Array.isArray(ds.triggers) ? ds.triggers : [ds.triggers];
      for (const trig of trigs) {
        if (trig && typeof trig.deals_damage === 'boolean') {
          err(`${f} (format_version ${j.format_version}) uses boolean deals_damage=${trig.deals_damage} instead of "yes"/"no"!`);
        }
      }
    }
  }
  const raw = JSON.stringify(ent);
  for (const m of raw.matchAll(/"table"\s*:\s*"([^"]+)"/g)) {
    const lt = m[1];
    if (!fs.existsSync(path.join(BP, lt)) && !fs.existsSync(path.join(VANILLA_BP, lt))) {
      err(`${f} references missing loot table "${lt}"!`);
    }
  }
}

// 8b. Verify every custom entity / item / sound / particle referenced by the
// compiled scripts actually exists. A typo here only appears as a silent
// failure during gameplay.
{
  const entityIds = new Set();
  for (const f of walk(path.join(BP, 'entities'), '.json')) {
    const id = readJsonChecked(f, true)?.['minecraft:entity']?.description?.identifier;
    if (id) entityIds.add(id);
  }
  const vanillaEntityIds = new Set();
  for (const f of walk(path.join(VANILLA_BP, 'entities'), '.json')) {
    const id = readJsonChecked(f, false)?.['minecraft:entity']?.description?.identifier;
    if (id) vanillaEntityIds.add(id);
  }
  const itemIds = new Set();
  for (const f of walk(path.join(BP, 'items'), '.json')) {
    const id = readJsonChecked(f, true)?.['minecraft:item']?.description?.identifier;
    if (id) itemIds.add(id);
  }
  const vanillaItemIds = new Set(['minecraft:bedrock', 'minecraft:arrow', 'minecraft:snowball', 'minecraft:carved_pumpkin', 'minecraft:short_grass']);

  const spawnCalls = new Set();
  const itemCalls = new Set();
  for (const f of walk(path.join(BP, 'scripts'), '.js')) {
    const code = fs.readFileSync(f, 'utf8');
    for (const m of code.matchAll(/spawnEntity\(\s*['"]([a-z0-9_]+:[a-z0-9_]+)['"]/g)) spawnCalls.add(m[1]);
    for (const m of code.matchAll(/new ItemStack\(\s*['"]([a-z0-9_]+:[a-z0-9_]+)['"]/g)) itemCalls.add(m[1]);
    for (const m of code.matchAll(/type:\s*['"]([a-z0-9_]+:[a-z0-9_]+)['"]/g)) spawnCalls.add(m[1]);
  }
  // `minecraft:item` / `minecraft:xp_orb` appear only in getEntities filters.
  const QUERY_ONLY_ENTITY_IDS = new Set(['minecraft:item', 'minecraft:xp_orb']);
  for (const id of spawnCalls) {
    if (QUERY_ONLY_ENTITY_IDS.has(id)) continue;
    if (!entityIds.has(id) && !vanillaEntityIds.has(id)) {
      err(`Scripts spawn entity "${id}" that is defined neither in this pack nor in vanilla 1.26.60`);
    }
  }
  for (const id of itemCalls) {
    if (!itemIds.has(id) && !vanillaItemIds.has(id)) {
      const vanillaPath = path.join(VANILLA_BP, 'items');
      if (!fs.existsSync(vanillaPath) || !walk(vanillaPath, '.json').some((f) => f.endsWith(`/${id.split(':')[1]}.json`))) {
        err(`Scripts create item "${id}" that is defined neither in this pack nor in vanilla 1.26.60`);
      }
    }
  }
}

// 8c. Localization: every referenced key must exist in both languages, and the
// two language files must stay in sync (a missing key shows a raw key in-game).
{
  const readLang = (file) => {
    const map = new Map();
    if (!fs.existsSync(file)) return map;
    for (const line of fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
      const idx = line.indexOf('=');
      if (idx <= 0 || line.startsWith('#')) continue;
      map.set(line.slice(0, idx).trim(), line.slice(idx + 1));
    }
    return map;
  };
  const en = readLang(path.join(RP, 'texts/en_US.lang'));
  const ru = readLang(path.join(RP, 'texts/ru_RU.lang'));
  for (const [label, map] of [['en_US', en], ['ru_RU', ru]]) {
    for (const f of walk(path.join(BP, 'items'), '.json')) {
      const name = readJsonChecked(f, true)?.['minecraft:item']?.components?.['minecraft:display_name']?.value;
      if (typeof name === 'string' && !map.has(name)) err(`${label}.lang is missing item name key "${name}" (${f})`);
    }
    for (const f of walk(path.join(BP, 'blocks'), '.json')) {
      const name = readJsonChecked(f, true)?.['minecraft:block']?.components?.['minecraft:display_name'];
      const key = typeof name === 'string' ? name : name?.value;
      if (key && typeof key === 'string' && !map.has(key)) err(`${label}.lang is missing block name key "${key}" (${f})`);
    }
    for (const f of walk(path.join(RP, 'ui'), '.json')) {
      const raw = fs.readFileSync(f, 'utf8');
      for (const m of raw.matchAll(/"(?:\$text|text|title)":\s*"([a-z0-9_.]+\.[a-z0-9_.:]+)"/gi)) {
        const key = m[1];
        if (key.includes('@') || key.startsWith('textures/')) continue;
        if (!map.has(key)) err(`${label}.lang is missing UI key "${key}" (${f})`);
      }
    }
  }
  for (const key of en.keys()) {
    if (!ru.has(key)) err(`ru_RU.lang is missing key "${key}" that exists in en_US.lang`);
  }
  for (const key of ru.keys()) {
    if (!en.has(key)) err(`en_US.lang is missing key "${key}" that exists in ru_RU.lang`);
  }
}

// 8d. Loot tables: every table reached from another table must exist, and the
// rewards the original added must still be present. A table that silently falls
// back to vanilla makes a sword unobtainable.
{
  const tableFiles = walk(path.join(BP, 'loot_tables'), '.json');
  const existing = (rel) => fs.existsSync(path.join(BP, rel)) || fs.existsSync(path.join(VANILLA_BP, rel));
  for (const f of tableFiles) {
    const raw = fs.readFileSync(f, 'utf8');
    for (const m of raw.matchAll(/"name":\s*"(loot_tables\/[^"]+\.json)"/g)) {
      if (!existing(m[1])) err(`${f} references missing loot table "${m[1]}"`);
    }
  }
  // Rewards added by Effect99 that must remain reachable.
  const required = {
    'loot_tables/entities/blaze.json': ['effect:blaze_sword'],
    'loot_tables/gameplay/fishing/treasure.json': ['effect:jungle_sword'],
    'loot_tables/entities/slime_king.json': ['effect:slime_sword'],
    'loot_tables/entities/shulker.json': ['effect:shulker_sword'],
    'loot_tables/entities/elder_guardian.json': ['effect:sponge_sword'],
    'loot_tables/entities/wither_skeleton.json': ['effect:wither_skeleton_sword'],
    'loot_tables/entities/red_enderman.json': ['effect:ender_sword'],
    'loot_tables/entities/living_flame.json': ['effect:fire_sword'],
  };
  for (const [rel, items] of Object.entries(required)) {
    const file = path.join(BP, rel);
    if (!fs.existsSync(file)) {
      err(`Missing loot table ${rel}`);
      continue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    for (const item of items) {
      if (!raw.includes(`"${item}`)) err(`${rel} lost the "${item}" reward`);
    }
  }
  // The 2.8.8 pack ships a single treasure table; a second one drifts out of
  // sync with the first and one of the two silently loses its Jungle Sword.
  for (const name of ['fishing.json', 'jungle_fishing.json', 'gameplay/fishing/jungle_fishing.json']) {
    const file = path.join(BP, 'loot_tables', name);
    if (!fs.existsSync(file)) continue;
    if (fs.readFileSync(file, 'utf8').includes('jungle_treasure')) {
      err(`${file} references loot_tables/gameplay/fishing/jungle_treasure.json; the pack must use the single treasure.json like 2.8.8`);
    }
  }
  if (fs.existsSync(path.join(BP, 'loot_tables/gameplay/fishing/jungle_treasure.json'))) {
    err('loot_tables/gameplay/fishing/jungle_treasure.json must not exist; the Jungle Sword lives in treasure.json');
  }
}

// 8e. Every behavior entity needs a client entity (own or vanilla), otherwise
// it spawns invisibly and looks like a broken feature in-game.
{
  const clientIds = new Set();
  for (const f of walk(path.join(RP, 'entity'), '.json')) {
    const id = readJsonChecked(f, false)?.['minecraft:client_entity']?.description?.identifier;
    if (id) clientIds.add(id);
  }
  for (const f of walk(path.join(VANILLA_RP, 'entity'), '.json')) {
    const id = readJsonChecked(f, false)?.['minecraft:client_entity']?.description?.identifier;
    if (id) clientIds.add(id);
  }
  // Vanilla client entities whose definition lives inside the engine rather
  // than in the sample resource pack (e.g. primed TNT, falling blocks).
  const ENGINE_CLIENT_IDS = new Set(['minecraft:tnt']);
  for (const f of walk(path.join(BP, 'entities'), '.json')) {
    const desc = readJsonChecked(f, true)?.['minecraft:entity']?.description;
    if (!desc?.identifier) continue;
    if (ENGINE_CLIENT_IDS.has(desc.identifier)) continue;
    const runtime = desc.runtime_identifier;
    if (!clientIds.has(desc.identifier) && !(runtime && clientIds.has(runtime))) {
      err(`${desc.identifier} has no client entity in this pack or in vanilla 1.26.60 (it would spawn invisible)`);
    }
  }
}

// 8f. Ore mining must stay tool-gated. The block scripts only award a drop for
// iron/diamond/netherite pickaxes and the Bedrock Sword, so the block itself
// must not also be breakable by hand or by any other tool, otherwise the ore
// becomes a free source of rewards.
{
  const ALLOWED_TOOLS = ['minecraft:iron_pickaxe', 'minecraft:diamond_pickaxe', 'minecraft:netherite_pickaxe', 'effect:bedrock_sword'];
  for (const f of walk(path.join(BP, 'blocks'), '.json')) {
    if (!/ore|block/i.test(path.basename(f))) continue;
    const body = readJsonChecked(f, true)?.['minecraft:block'];
    const id = body?.description?.identifier;
    if (!id?.startsWith('effect99:')) continue;
    if (!['effect99:silver_ore', 'effect99:quartz_diamond_ore', 'effect99:quartz_diamond_block'].includes(id)) continue;
    const mining = body.components?.['minecraft:destructible_by_mining'];
    if (!mining || typeof mining !== 'object') {
      err(`${f}: ${id} has no mineable component`);
      continue;
    }
    if (!Number.isFinite(mining.seconds_to_destroy) || mining.seconds_to_destroy <= 0) {
      err(`${f}: ${id} has an invalid seconds_to_destroy`);
    }
    const speeds = mining.item_specific_speeds ?? [];
    for (const tool of ALLOWED_TOOLS) {
      if (!speeds.some((entry) => entry.item === tool)) {
        err(`${f}: ${id} has no mining speed for ${tool}, so an allowed tool may not be able to break it`);
      }
    }
  }
}

// 8g. Every projectile the scripts shoot must declare the attack/reach payload
// it needs; a projectile that loses its `on_hit` (or an entity that loses its
// minecraft:attack) silently deals no damage in game.
{
  const checkEntity = (file) => {
    const body = readJsonChecked(file, true)?.['minecraft:entity'];
    if (!body) return;
    const containers = [body.components || {}, ...Object.values(body.component_groups || {})];
    for (const components of containers) {
      const projectile = components['minecraft:projectile'];
      if (projectile && !projectile.on_hit) {
        err(`${file}: minecraft:projectile has no on_hit, so it can never hurt anything`);
      }
      const attack = components['minecraft:attack'];
      if (attack && (typeof attack.damage !== 'number' || attack.damage < 0)) {
        err(`${file}: minecraft:attack has an invalid damage ${JSON.stringify(attack.damage)}`);
      }
      const health = components['minecraft:health'];
      if (health && !(health.value > 0)) {
        err(`${file}: minecraft:health has a non-positive value ${JSON.stringify(health)}`);
      }
    }
  };
  for (const f of walk(path.join(BP, 'entities'), '.json')) checkEntity(f);
}

// 8h. Every sword in the pack must carry the `effect:sword` custom component;
// without it the whole skill set (onUse, hit effects, durability rules) is dead
// even though the item exists, which is invisible to schema validation.
{
  const EXCLUDED = new Set(['effect:quartz_diamond', 'effect:silver_ingot']);
  for (const f of walk(path.join(BP, 'items'), '.json')) {
    const item = readJsonChecked(f, true)?.['minecraft:item'];
    const id = item?.description?.identifier;
    if (!id || EXCLUDED.has(id)) continue;
    if (!item.components?.['effect:sword']) {
      err(`${f}: ${id} is missing the effect:sword custom component`);
    }
  }
}

// 9. Verify compiled JS imports & custom event names
for (const f of walk(path.join(BP, 'scripts'), '.js')) {
  const code = fs.readFileSync(f, 'utf8');
  for (const m of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const rel = m[1];
    if (!rel.endsWith('.js')) {
      err(`Script ${f} imports "${rel}" without explicit .js extension!`);
    }
    const resolved = path.resolve(path.dirname(f), rel);
    if (!fs.existsSync(resolved)) {
      err(`Script ${f} imports non-existent file "${rel}"!`);
    }
  }
}

const playerEvents = bpEntityEvents.get('minecraft:player') || new Set();
const expectedPlayerEvents = [
  'effect:reset_player',
  'effect:equip_sea_sword',
  'effect:equip_ghost_sword',
  'effect:equip_wolf_transformation',
  'effect:equip_ultra_instinct_sword',
  'effect:equip_ender_sword',
  'effect:equip_nether_star_sword',
  'effect:equip_obsidian_sword',
  'effect:equip_blaze_sword',
  'effect:equip_fire_sword',
  'effect:equip_magma_sword',
  'effect:equip_lightning_sword',
  'effect:equip_wither_sword',
  'effect:equip_spectral_sword',
  'effect:equip_jungle_sword',
  'effect:equip_tnt_sword',
  'effect:equip_shulker_sword',
  'effect:equip_shulker_hiding',
  'effect:equip_slime_sword',
  'effect:equip_spider_sword',
];
for (const evName of expectedPlayerEvents) {
  if (!playerEvents.has(evName)) {
    err(`player.json is missing expected event "${evName}"!`);
  }
}

// 10. Verify localization keys in en_US.lang and ru_RU.lang
const enLang = fs.readFileSync(path.join(RP, 'texts/en_US.lang'), 'utf8');
const ruLang = fs.readFileSync(path.join(RP, 'texts/ru_RU.lang'), 'utf8');
for (const f of walk(path.join(BP, 'items'), '.json')) {
  const j = readJsonChecked(f, true);
  const key = j?.['minecraft:item']?.components?.['minecraft:display_name']?.value;
  if (key && !enLang.includes(`${key}=`)) err(`Missing "${key}" in en_US.lang!`);
  if (key && !ruLang.includes(`${key}=`)) err(`Missing "${key}" in ru_RU.lang!`);
}
for (const f of walk(path.join(BP, 'blocks'), '.json')) {
  const j = readJsonChecked(f, true);
  const key = j?.['minecraft:block']?.components?.['minecraft:display_name'];
  if (key && !enLang.includes(`${key}=`)) err(`Missing "${key}" in en_US.lang!`);
  if (key && !ruLang.includes(`${key}=`)) err(`Missing "${key}" in ru_RU.lang!`);
}

// 11. Verify spawn_rules spawn_event integrity
for (const f of walk(path.join(BP, 'spawn_rules'), '.json')) {
  const j = readJsonChecked(f, true);
  const sr = j?.['minecraft:spawn_rules'];
  const targetId = sr?.description?.identifier;
  for (const cond of sr?.conditions || []) {
    const sev = cond?.['minecraft:spawns_with_event']?.event || cond?.spawn_event?.event;
    if (sev && bpEntityEvents.has(targetId) && !bpEntityEvents.get(targetId).has(sev)) {
      err(`Spawn rule ${f} triggers missing spawn_event "${sev}" on "${targetId}"!`);
    }
  }
}

// 12. Verify all spawnEntity / shootCustomProjectile / spawnParticle / playSound calls in compiled JS
const knownParticles = new Set();
for (const dir of [path.join(RP, 'particles'), path.join(VANILLA_RP, 'particles')]) {
  for (const f of walk(dir, '.json')) {
    const j = readJsonChecked(f, false);
    const pid = j?.particle_effect?.description?.identifier;
    if (pid) knownParticles.add(pid);
  }
}
// Built-in engine particle emitters not stored as standalone files in bedrock-samples
for (const builtinP of [
  'minecraft:critical_hit_emitter',
  'minecraft:cauldron_explosion_emitter',
  'minecraft:egg_destroy_emitter',
  'minecraft:huge_explosion_emitter',
  'minecraft:knockback_roar_particle',
  'minecraft:mobflame_single',
  'minecraft:balloon_gas_particle',
  'minecraft:villager_happy',
  'minecraft:totem_particle',
]) {
  knownParticles.add(builtinP);
}

const knownSounds = new Set();
for (const sf of [
  path.join(RP, 'sounds/sound_definitions.json'),
  path.join(VANILLA_RP, 'sounds/sound_definitions.json'),
]) {
  if (fs.existsSync(sf)) {
    const sj = readJsonChecked(sf, false);
    const defs = sj?.sound_definitions || sj || {};
    for (const k of Object.keys(defs)) {
      if (k !== 'format_version' && k !== '__use_legacy_max_distance') knownSounds.add(k);
    }
  }
}

if (fs.existsSync(VANILLA_BP)) {
  for (const f of walk(path.join(VANILLA_BP, 'entities'), '.json')) {
    if (bpEntitySummonable.size > 0) {
      const j = readJsonChecked(f, false);
      const ent = j?.['minecraft:entity'];
      const id = ent?.description?.identifier;
      if (id && !bpEntitySummonable.has(id)) {
        bpEntitySummonable.set(id, Boolean(ent.description?.is_summonable));
        bpEntityEvents.set(id, new Set(Object.keys(ent.events || {})));
      }
    }
  }
}

for (const f of walk(path.join(BP, 'scripts'), '.js')) {
  const code = fs.readFileSync(f, 'utf8');
  for (const m of code.matchAll(/spawnEntity\(\s*['"]([^'"]+)['"](?:,\s*[^,)]+,\s*\{\s*spawnEvent:\s*['"]([^'"]+)['"]\s*\})?/g)) {
    const [, entId, spawnEv] = m;
    if (bpEntitySummonable.has(entId) && !bpEntitySummonable.get(entId)) {
      err(`${f} calls spawnEntity('${entId}') on an entity with is_summonable: false!`);
    }
    if (spawnEv && bpEntityEvents.has(entId) && !bpEntityEvents.get(entId).has(spawnEv)) {
      err(`${f} calls spawnEntity('${entId}') with non-existent spawnEvent '${spawnEv}'!`);
    }
  }
  for (const m of code.matchAll(/shootCustomProjectile\(\s*[^,]+,\s*['"]([^'"]+)['"](?:,\s*[^,)]+)?(?:,\s*['"]([^'"]+)['"])?/g)) {
    const [, entId, spawnEv] = m;
    if (bpEntitySummonable.has(entId) && !bpEntitySummonable.get(entId)) {
      err(`${f} calls shootCustomProjectile('${entId}') on an entity with is_summonable: false!`);
    }
    if (spawnEv && bpEntityEvents.has(entId) && !bpEntityEvents.get(entId).has(spawnEv)) {
      err(`${f} calls shootCustomProjectile('${entId}') with non-existent spawnEvent '${spawnEv}'!`);
    }
  }
  for (const m of code.matchAll(/spawnParticle\(\s*['"]([^'"]+)['"]/g)) {
    const pid = m[1];
    if (!knownParticles.has(pid)) {
      err(`${f} calls spawnParticle('${pid}') with unknown particle identifier!`);
    }
  }
  if (knownSounds.size > 50) {
    for (const m of code.matchAll(/playSound\(\s*['"]([^'"]+)['"]/g)) {
      const sid = m[1];
      if (!knownSounds.has(sid)) {
        err(`${f} calls playSound('${sid}') with unknown sound identifier!`);
      }
    }
  }
}

// 13. Verify 100% UI Encyclopedia localization coverage & 100% Russian translation coverage
const parseLangMap = (raw) => {
  const m = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx > 0) m.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return m;
};
const enMap = parseLangMap(enLang);
const ruMap = parseLangMap(ruLang);

const uiScreenPath = path.join(RP, 'ui/encyclopedia_screen.json');
if (fs.existsSync(uiScreenPath)) {
  const uiRaw = fs.readFileSync(uiScreenPath, 'utf8');
  for (const m of uiRaw.matchAll(/"(?:\$button_text|text)"\s*:\s*"((?:ui\.swords|howtoplay|tile|item|entity)\.[^"]+)"/g)) {
    const key = m[1];
    if (!enMap.has(key)) err(`UI screen references missing key "${key}" in en_US.lang!`);
    if (!ruMap.has(key)) err(`UI screen references missing key "${key}" in ru_RU.lang!`);
  }
}

const ALLOWED_IDENTICAL_PROPER_NOUNS = new Set(['howtoplay.the_swords.button.discord']);
for (const [k, enVal] of enMap.entries()) {
  if (!ruMap.has(k)) {
    err(`Missing key "${k}" in ru_RU.lang!`);
    continue;
  }
  const ruVal = ruMap.get(k);
  if (
    ruVal === enVal &&
    /[A-Za-z]{3,}/.test(enVal) &&
    !ALLOWED_IDENTICAL_PROPER_NOUNS.has(k)
  ) {
    err(`Untranslated English value in ru_RU.lang: ${k}=${ruVal}`);
  }
}

for (const [k] of ruMap.entries()) {
  if (!enMap.has(k)) {
    err(`Key "${k}" exists in ru_RU.lang but is missing in en_US.lang!`);
  }
}

for (const f of walk(path.join(BP, 'blocks'), '.json')) {
  const bid = readJsonChecked(f, true)?.['minecraft:block']?.description?.identifier;
  if (bid) {
    const lk = `tile.${bid}.name`;
    if (!enMap.has(lk)) err(`Block "${bid}" missing "${lk}" in en_US.lang!`);
    if (!ruMap.has(lk)) err(`Block "${bid}" missing "${lk}" in ru_RU.lang!`);
  }
}

// 14. Verify RP render_controllers & 1.8/1.10 animation_controllers alias bindings across all client_entity files
const allRenderCtrls = {};
for (const dir of [path.join(VANILLA_RP, 'render_controllers'), path.join(RP, 'render_controllers')]) {
  for (const f of walk(dir, '.json')) {
    const j = readJsonChecked(f, false);
    for (const [k, v] of Object.entries(j?.render_controllers || {})) allRenderCtrls[k] = v;
  }
}
const allAnimCtrls = {};
for (const dir of [path.join(VANILLA_RP, 'animation_controllers'), path.join(RP, 'animation_controllers')]) {
  for (const f of walk(dir, '.json')) {
    const j = readJsonChecked(f, false);
    for (const [k, v] of Object.entries(j?.animation_controllers || {})) allAnimCtrls[k] = v;
  }
}

for (const f of walk(path.join(RP, 'entity'), '.json')) {
  const desc = readJsonChecked(f, false)?.['minecraft:client_entity']?.description;
  if (!desc) continue;
  const gAliases = new Set(Object.keys(desc.geometry || {}));
  const tAliases = new Set(Object.keys(desc.textures || {}));
  const mAliases = new Set(Object.keys(desc.materials || {}));
  const aAliases = new Set(Object.keys(desc.animations || {}));

  for (const rcEntry of desc.render_controllers || []) {
    const rcName = typeof rcEntry === 'string' ? rcEntry : Object.keys(rcEntry)[0];
    const rc = allRenderCtrls[rcName];
    if (!rc) {
      err(`${f} references unknown render_controller "${rcName}"!`);
      continue;
    }
    const rawRc = JSON.stringify(rc);
    for (const m of rawRc.matchAll(/Geometry\.([a-zA-Z0-9_]+)/g)) {
      if (!gAliases.has(m[1])) err(`${f} -> ${rcName} references unbound Geometry.${m[1]}!`);
    }
    for (const m of rawRc.matchAll(/Texture\.([a-zA-Z0-9_]+)/g)) {
      if (!tAliases.has(m[1])) err(`${f} -> ${rcName} references unbound Texture.${m[1]}!`);
    }
    for (const m of rawRc.matchAll(/Material\.([a-zA-Z0-9_]+)/g)) {
      if (!mAliases.has(m[1])) err(`${f} -> ${rcName} references unbound Material.${m[1]}!`);
    }
  }

  const checkAnimCtrl = (ctrlName) => {
    const ac = allAnimCtrls[ctrlName];
    if (!ac) return;
    for (const st of Object.values(ac.states || {})) {
      for (const aItem of st.animations || []) {
        const alias = typeof aItem === 'string' ? aItem : Object.keys(aItem)[0];
        if (!aAliases.has(alias)) err(`${f} -> ${ctrlName} references unbound animation alias "${alias}"!`);
      }
    }
  };
  for (const item of desc.animation_controllers || []) {
    for (const cv of Object.values(item)) checkAnimCtrl(cv);
  }
  for (const av of Object.values(desc.animations || {})) {
    if (typeof av === 'string' && av.startsWith('controller.animation.')) checkAnimCtrl(av);
  }
}

console.log(`\nValidation Summary: ${errors} errors, ${warnings} warnings.`);
if (errors > 0) process.exit(1);
