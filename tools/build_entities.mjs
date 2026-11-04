import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const jsonc = require('jsonc-parser');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BP = path.join(ROOT, 'packs/Swords_B');
const RP = path.join(ROOT, 'packs/Swords_R');
const SRC_288_BP = path.join(process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8', 'Swords_B');
const SRC_288_RP = path.join(process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8', 'Swords_R');
const VANILLA_BP = path.join(process.env.SAMS_SAMPLES ?? '/tmp/refs/bedrock-samples', 'behavior_pack');
const VANILLA_RP = path.join(process.env.SAMS_SAMPLES ?? '/tmp/refs/bedrock-samples', 'resource_pack');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function readVanillaBP(name) {
  return jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'entities', name), 'utf8'));
}

function readVanillaRP(name) {
  return jsonc.parse(fs.readFileSync(path.join(VANILLA_RP, 'entity', name), 'utf8'));
}

// Also generate individual sword loot tables `loot_tables/swords/<short>.json`
for (const fileName of fs.readdirSync(path.join(BP, 'items'))) {
  const itemData = JSON.parse(fs.readFileSync(path.join(BP, 'items', fileName), 'utf8'));
  const id = itemData['minecraft:item'].description.identifier;
  const short = id.split(':')[1];
  writeJson(path.join(BP, `loot_tables/swords/${short}.json`), {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: id, weight: 1 }] }],
  });
}

// ===========================================================================
// PART A: RESOURCE PACK CLIENT ENTITIES (`packs/Swords_R/entity/*.json`)
// ===========================================================================

// A.1 Rebase `player.entity.json` onto Mojang v1.26.60.5 (`format_version: "1.26.0"`)
const playerClient = readVanillaRP('player.entity.json');
const pcDesc = playerClient['minecraft:client_entity'].description;

Object.assign(pcDesc.materials, {
  ultra_instinct_aura: 'ultra_instinct_aura',
  player_ghost: 'player_ghost',
  wolf_vision: 'wolf_vision',
  blaze_aura: 'blaze_aura',
});
Object.assign(pcDesc.textures, {
  ultra_instinct_aura: 'textures/entity/ultra_instinct_aura',
  wolf_transformation: 'textures/entity/wolf_transformation',
  wolf_vision: 'textures/entity/wolf_vision',
  ghost: 'textures/entity/ghost',
  mermaid_player: 'textures/entity/mermaid_player',
  blaze_rods: 'textures/entity/blaze_rods',
  blaze_aura: 'textures/entity/blaze_rods',
});
Object.assign(pcDesc.geometry, {
  ultra_instinct_aura: 'geometry.ultra_instinct_aura',
  wolf_transformation: 'geometry.wolf_transformation',
  player_ghost: 'geometry.player_ghost',
  wolf_vision: 'geometry.wolf_vision',
  mermaid_player: 'geometry.mermaid_player.tail',
  blaze_rods: 'geometry.blaze_rods',
  blaze_aura: 'geometry.blaze_aura',
});

pcDesc.scripts.pre_animation.push(
  "variable.ultra_instinct_sword = query.is_item_name_any('slot.weapon.mainhand', 'effect:ultra_instinct_sword');",
  "variable.wolf_transformation = (!variable.is_first_person && query.is_item_name_any('slot.weapon.mainhand', 'effect:wolf_sword') && query.moon_phase == 0 && (query.time_of_day <= 0.22 || query.time_of_day >= 0.78));",
  "variable.wolf_vision = (variable.is_first_person && query.is_item_name_any('slot.weapon.mainhand', 'effect:wolf_sword') && query.moon_phase == 0 && (query.time_of_day <= 0.22 || query.time_of_day >= 0.78));",
  "variable.player_ghost = query.is_item_name_any('slot.weapon.mainhand', 'effect:ghost_sword');",
  "variable.mermaid_player = !variable.is_first_person && query.is_item_name_any('slot.weapon.mainhand', 'effect:sea_sword');",
  "variable.blaze_rods = query.is_item_name_any('slot.weapon.mainhand', 'effect:blaze_sword');"
);

pcDesc.scripts.animate.push(
  { 'attack.ultra_instinct_sword': 'variable.ultra_instinct_sword && variable.attack_body_rot_y' },
  { 'ultra_instinct.move': 'variable.ultra_instinct_sword && !query.is_spectator' },
  { 'move.player_ghost': 'variable.player_ghost && !variable.is_first_person && !query.is_spectator' },
  { 'vision.player_ghost': 'variable.player_ghost && variable.is_first_person && !query.is_spectator' },
  { 'mermaid_player.tail': 'variable.mermaid_player && !variable.is_first_person && !query.is_spectator' },
  { 'mermaid_player.swimming': 'variable.mermaid_player && query.is_swimming && !query.is_spectator' },
  { 'mermaid_player.drowning': 'variable.mermaid_player && !query.is_in_water && !query.is_spectator' },
  { 'mermaid_player.default_pose': 'variable.mermaid_player && !query.is_swimming && query.is_in_water && !query.is_spectator' },
  { 'blaze_rods.move': 'variable.blaze_rods && !query.is_spectator' }
);

Object.assign(pcDesc.animations, {
  'blaze_rods.move': 'animation.blaze_rods',
  'mermaid_player.default_pose': 'animation.mermaid_player.default_pose',
  'mermaid_player.tail': 'animation.mermaid_player.tail',
  'mermaid_player.swimming': 'animation.mermaid_player.swimming',
  'mermaid_player.drowning': 'animation.mermaid_player.drowning',
  'ultra_instinct.move': 'animation.ultra_instinct.move',
  'vision.player_ghost': 'animation.player_ghost.vision',
  'move.player_ghost': 'animation.player_ghost.move',
  'attack.ultra_instinct_sword': 'animation.ultra_instinct_sword.attack',
  'player_explode': 'animation.player.explode',
});

pcDesc.render_controllers.push(
  { 'controller.render.ultra_instinct_aura': 'variable.ultra_instinct_sword && !query.is_spectator' },
  { 'controller.render.wolf_transformation': 'variable.wolf_transformation && !query.is_spectator' },
  { 'controller.render.wolf_vision': 'variable.wolf_vision && !query.is_spectator' },
  { 'controller.render.player_ghost': 'variable.player_ghost && !query.is_spectator' },
  { 'controller.render.mermaid_player': 'variable.mermaid_player && !query.is_spectator' },
  { 'controller.render.blaze_rods': 'variable.blaze_rods && !query.is_spectator' },
  { 'controller.render.blaze_aura': 'variable.blaze_rods && !variable.is_first_person && !query.is_spectator' }
);

writeJson(path.join(RP, 'entity/player.entity.json'), playerClient);

// A.2 Rebase vanilla clients while retaining the original variant appearances.
// Dedicated controllers avoid replacing a vanilla controller globally.
for (const [kind, alias] of [['enderman', 'red_enderman'], ['witch', 'grass_witch']]) {
  const client = readVanillaRP(`${kind}.entity.json`);
  const desc = client['minecraft:client_entity'].description;
  desc.textures[alias] = kind === 'enderman'
    ? 'textures/entity/enderman/red_enderman' : 'textures/entity/grass_witch';
  const source = jsonc.parse(fs.readFileSync(path.join(VANILLA_RP, 'render_controllers', `${kind}.render_controllers.json`), 'utf8'));
  const controller = source.render_controllers[`controller.render.${kind}`];
  controller.textures = [`query.variant == 1 ? Texture.${alias} : Texture.default`];
  const controllerName = `controller.render.effect_${kind}`;
  desc.render_controllers = [controllerName];
  writeJson(path.join(RP, 'entity', `${kind}.entity.json`), client);
  writeJson(path.join(RP, 'render_controllers', `effect_${kind}.render_controllers.json`), {
    format_version: '1.8.0', render_controllers: { [controllerName]: controller },
  });
}

// A.3 Custom visible client entities (copy & clean spawn egg on alpha_wolf)
const customClientFiles = [
  'alpha_wolf.entity.json',
  'bee_sword.json',
  'fake_fireball.entity.json',
  'ghost.v1.0.json',
  'grass.v1.0.json',
  'mountable_slime.v1.0.json',
  'nether_star.v1.0.json',
  'pumpkin_projectile.entity.json',
  'shulker_shield.v1.0.json',
  'slime_king.entity.json',
  'ultra_instinct_projectile.json',
  'web.v1.0.json',
];
for (const f of customClientFiles) {
  const c = jsonc.parse(fs.readFileSync(path.join(SRC_288_RP, 'entity', f), 'utf8'));
  if (f === 'alpha_wolf.entity.json') {
    const desc = c['minecraft:client_entity'].description;
    desc.spawn_egg = {
      base_color: '#3b3b42',
      overlay_color: '#a81c1c',
    };
    // 1.26.60 compatibility: `controller.render.wolf` now requires 27 wolf-variant texture aliases (`pale_default` etc.),
    // and `controller.animation.wolf.sitting` requires `wolf_baby_sitting`!
    desc.animations.wolf_baby_sitting = 'animation.wolf.baby_sitting';
    desc.animation_controllers = (desc.animation_controllers || []).filter(
      (entry) => !Object.prototype.hasOwnProperty.call(entry, 'wolf_baby_scaling')
    );
    desc.render_controllers = ['controller.render.alpha_wolf'];
  }
  writeJson(path.join(RP, 'entity', f), c);
}

writeJson(path.join(RP, 'render_controllers/alpha_wolf.render_controllers.json'), {
  format_version: '1.8.0',
  render_controllers: {
    'controller.render.alpha_wolf': {
      geometry: 'Geometry.default',
      materials: [{ '*': 'Material.default' }],
      textures: ['query.is_angry ? Texture.angry : (query.is_tamed ? Texture.tame : Texture.default)'],
    },
  },
});

// Add `minicreeper` client entity so `entity:minicreeper` renders as a cute 0.3x Creeper without overriding vanilla creepers if summoned directly
const creeperClient = readVanillaRP('creeper.entity.json');
creeperClient['minecraft:client_entity'].description.identifier = 'entity:minicreeper';
delete creeperClient['minecraft:client_entity'].description.spawn_egg;
delete creeperClient['minecraft:client_entity'].description.animation_controllers;
writeJson(path.join(RP, 'entity/minicreeper.entity.json'), creeperClient);

// Silent `geometry.null` client entities for invisible particle/logic entities
const invisibleHelperIds = [
  'entity:centella',
  'entity:ender_crystal_projectile',
  'entity:fire',
  'entity:ghost_projectile',
  'entity:grows_crop',
  'entity:instant_creeper_explode',
  'entity:instant_giant_explode',
  'entity:lightning_projectile',
  'entity:living_flame',
  'entity:name',
  'entity:nether_star',
  'entity:objective',
  'entity:slime_damage',
  'entity:tnt',
  'entity:ultra_instinct_explode',
  'entity:wither_effect',
];
for (const id of invisibleHelperIds) {
  const short = id.split(':')[1];
  writeJson(path.join(RP, `entity/${short}.entity.json`), {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: id,
        materials: { default: 'entity_alphatest' },
        textures: { default: 'textures/blocks/lightblock' },
        geometry: { default: 'geometry.null' },
        render_controllers: ['controller.render.default'],
      },
    },
  });
}

// ===========================================================================
// PART B: BEHAVIOR PACK `player.json` (Rebased onto Mojang v1.26.60.5)
// ===========================================================================
const playerBP = readVanillaBP('player.json');
const pEnt = playerBP['minecraft:entity'];

const SWORD_PLAYER_GROUPS = {
  'effect:default_stats': {
    'minecraft:collision_box': { width: 0.6, height: 1.8 },
    'minecraft:scale': { value: 1.0 },
    'minecraft:breathable': {
      generates_bubbles: false,
      inhale_time: 3.75,
      suffocate_time: -1,
      total_supply: 15,
      breathes_air: true,
      breathes_water: false,
    },
    'minecraft:type_family': { family: ['player'] },
    'minecraft:health': { value: 20, max: 20 },
    'minecraft:attack': { damage: 1 },
    'minecraft:movement': { value: 0.1 },
    'minecraft:underwater_movement': { value: 0.02 },
    'minecraft:knockback_resistance': { value: 0.0 },
    'minecraft:damage_sensor': { triggers: [] },
    'minecraft:hurt_on_condition': {
      damage_conditions: [
        {
          cause: 'lava',
          damage_per_tick: 4,
          filters: { test: 'in_lava', subject: 'self', operator: '==', value: true },
        },
      ],
    },
    'minecraft:rideable': pEnt.components['minecraft:rideable'],
  },

  'effect:sea_sword': {
    // Exact 2.8.8 `minecraft:sea_sword` + `mermaid_movement_in_water`/`_out_water`.
    'minecraft:collision_box': { width: 0.6, height: 0.9 },
    'minecraft:breathable': {
      generates_bubbles: false,
      inhale_time: 3.75,
      suffocate_time: -1,
      total_supply: 2,
      breathes_air: false,
      breathes_water: true,
      breathes_lava: false,
    },
    'minecraft:movement': { value: 0.06 },
    'minecraft:underwater_movement': { value: 0.07 },
    'minecraft:type_family': { family: ['player', 'sea_sword'] },
  },

  'effect:ghost_sword': {
    // Exact 2.8.8 `minecraft:ghost_sword` (+ `ghost_movement` 0.14): the ghost
    // has no collision box at all, walks slightly faster and takes no damage
    // from any source.
    'minecraft:scale': { value: 1.05 },
    'minecraft:collision_box': { width: 0.0, height: 0.0 },
    'minecraft:breathable': {
      total_supply: 15,
      suffocate_time: 0,
      inhale_time: 3.75,
      generates_bubbles: false,
      breathes_water: true,
      breathes_air: true,
      breathes_lava: true,
    },
    'minecraft:type_family': { family: ['ghost_sword'] },
    'minecraft:knockback_resistance': { value: 1.0 },
    'minecraft:movement': { value: 0.14 },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: 'no' }],
    },
  },

  'effect:wolf_transformation': {
    'minecraft:scale': { value: 1.05 },
    'minecraft:health': { value: 40, max: 40 },
    'minecraft:type_family': { family: ['monster', 'wolf_sword'] },
    'minecraft:attack': { damage: 15 },
    'minecraft:movement': { value: 0.16 },
    'minecraft:knockback_resistance': { value: 0.4 },
  },

  'effect:ultra_instinct_sword': {
    // Exact 2.8.8 `ultra_instinct_sword_movement` = 0.22.
    'minecraft:type_family': { family: ['player', 'ultra_instinct_sword'] },
    'minecraft:movement': { value: 0.22 },
    'minecraft:knockback_resistance': { value: 1.0 },
    'minecraft:damage_sensor': {
      triggers: [
        {
          on_damage: {
            filters: {
              all_of: [
                { test: 'has_damage', operator: '!=', value: 'lava' },
                { test: 'has_damage', operator: '!=', value: 'drowning' },
                { test: 'has_damage', operator: '!=', value: 'void' },
                { test: 'has_damage', operator: '!=', value: 'thorns' },
                { test: 'has_damage', operator: '!=', value: 'suicide' },
                { test: 'has_damage', operator: '!=', value: 'starve' },
                { test: 'has_damage', operator: '!=', value: 'fire' },
                { test: 'has_damage', operator: '!=', value: 'fire_tick' },
                { test: 'has_damage', operator: '!=', value: 'fall' },
                { test: 'has_damage', operator: '!=', value: 'block_explosion' },
                { test: 'has_damage', operator: '!=', value: 'entity_explosion' },
              ],
            },
            event: 'effect:ui_dodge',
          },
          deals_damage: false,
        },
        { cause: 'entity_explosion', deals_damage: false },
        { cause: 'block_explosion', deals_damage: false },
        { cause: 'fire', deals_damage: false },
        { cause: 'fire_tick', deals_damage: false },
        { cause: 'hot_floor', deals_damage: false },
        { cause: 'fall', deals_damage: false },
        { cause: 'wither', deals_damage: false },
      ],
    },
  },

  'effect:ender_sword': {
    'minecraft:type_family': { family: ['player', 'ender_sword'] },
    'minecraft:hurt_on_condition': {
      damage_conditions: [
        {
          cause: 'lava',
          damage_per_tick: 4,
          filters: { test: 'in_lava', subject: 'self', operator: '==', value: true },
        },
        {
          cause: 'drowning',
          damage_per_tick: 1,
          filters: { test: 'in_water_or_rain', subject: 'self', operator: '==', value: true },
        },
      ],
    },
    'minecraft:damage_sensor': {
      triggers: [
        {
          cause: 'projectile',
          deals_damage: false,
          on_damage: { event: 'effect:ender_dodge' },
        },
        {
          cause: 'entity_attack',
          deals_damage: true,
          on_damage: { event: 'effect:ender_melee_dodge' },
        },
        {
          on_damage: {
            filters: { test: 'in_water_or_rain', subject: 'self', value: true },
            event: 'effect:ender_dodge',
          },
          deals_damage: true,
        },
      ],
    },
  },

  'effect:nether_star_sword': {
    'minecraft:type_family': { family: ['player', 'nether_star_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        {
          on_damage: {
            filters: { test: 'is_family', subject: 'other', value: 'nether_star_projectile' },
          },
          deals_damage: false,
        },
      ],
    },
  },

  'effect:obsidian_sword': {
    'minecraft:type_family': { family: ['player', 'obsidian_sword'] },
    'minecraft:knockback_resistance': { value: 1.0 },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'entity_explosion', deals_damage: false },
        { cause: 'block_explosion', deals_damage: false },
      ],
    },
  },

  'effect:blaze_sword': {
    'minecraft:type_family': { family: ['player', 'blaze_sword'] },
    'minecraft:hurt_on_condition': {
      damage_conditions: [
        {
          cause: 'drowning',
          damage_per_tick: 1,
          filters: { test: 'in_water_or_rain', subject: 'self', operator: '==', value: true },
        },
      ],
    },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'fire', deals_damage: false },
        { cause: 'fire_tick', deals_damage: false },
        { cause: 'lava', deals_damage: false },
        { cause: 'hot_floor', deals_damage: false },
      ],
    },
  },

  'effect:fire_sword': {
    'minecraft:type_family': { family: ['player', 'fire_sword'] },
    'minecraft:hurt_on_condition': { damage_conditions: [] },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'fire', deals_damage: false },
        { cause: 'fire_tick', deals_damage: false },
        { cause: 'lava', deals_damage: false },
        { cause: 'hot_floor', deals_damage: false },
      ],
    },
  },

  'effect:magma_sword': {
    'minecraft:type_family': { family: ['player', 'magma_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'hot_floor', deals_damage: false },
        { cause: 'fire_tick', deals_damage: false },
      ],
    },
  },

  'effect:lightning_sword': {
    'minecraft:type_family': { family: ['player', 'lightning_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'lightning', deals_damage: false },
      ],
    },
  },

  'effect:wither_sword': {
    'minecraft:type_family': { family: ['player', 'wither_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'wither', deals_damage: false },
      ],
    },
    'minecraft:rideable': {
      seat_count: 1,
      family_types: ['entity_name'],
      pull_in_entities: false,
      seats: [{ position: [0.0, 0.4, 0.0], lock_rider_rotation: 0 }],
    },
  },

  'effect:spectral_sword': {
    'minecraft:type_family': { family: ['player', 'spectral_sword'] },
    'minecraft:rideable': {
      seat_count: 1,
      family_types: ['spectral_sword', 'ender_crystal'],
      pull_in_entities: false,
      seats: [{ position: [0.0, 0.4, 0.0], lock_rider_rotation: 0 }],
    },
  },

  'effect:jungle_sword': {
    'minecraft:type_family': { family: ['player', 'jungle_sword'] },
    'minecraft:health': { value: 8, max: 8 },
  },

  'effect:tnt_sword': {
    'minecraft:type_family': { family: ['player', 'tnt_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        {
          on_damage: {
            filters: { test: 'is_family', subject: 'other', value: 'effect99_entities' },
          },
          deals_damage: false,
        },
      ],
    },
  },

  'effect:shulker_sword': {
    'minecraft:scale': { value: 1.0 },
    'minecraft:type_family': { family: ['player', 'shulker_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        {
          on_damage: {
            filters: { test: 'is_riding', subject: 'self', value: true },
          },
          deals_damage: false,
        },
      ],
    },
  },

  'effect:shulker_hiding': {
    'minecraft:scale': { value: 0.7 },
    'minecraft:type_family': { family: ['player', 'shulker_sword'] },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: false }],
    },
  },

  'effect:slime_sword': {
    'minecraft:type_family': { family: ['player', 'slime_sword'] },
    'minecraft:damage_sensor': {
      triggers: [
        { cause: 'fall', deals_damage: false },
        {
          on_damage: {
            filters: { test: 'is_family', subject: 'other', value: 'tamed_slime' },
          },
          deals_damage: false,
        },
      ],
    },
  },

  'effect:time_sword': {
    // Exact 2.8.8 `minecraft:time_sword` (+ `time_sword_movement`): the holder
    // walks at movement 1 while the sword is in hand.
    'minecraft:movement': { value: 1.0 },
    'minecraft:type_family': { family: ['player', 'time_sword'] },
  },

  'effect:spider_sword': {
    'minecraft:type_family': { family: ['player', 'spider_sword'] },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'fall', deals_damage: false }],
    },
  },
};

// Normalize all `deals_damage` booleans in `player.json` (`format_version: 1.26.30`) to 1.21.40+ enum strings ('no' / 'yes')!
for (const grp of Object.values(SWORD_PLAYER_GROUPS)) {
  const ds = grp['minecraft:damage_sensor'];
  if (ds && Array.isArray(ds.triggers)) {
    for (const trig of ds.triggers) {
      if (typeof trig.deals_damage === 'boolean') {
        trig.deals_damage = trig.deals_damage ? 'yes' : 'no';
      }
    }
  }
}

Object.assign(pEnt.component_groups, SWORD_PLAYER_GROUPS);

const ALL_CUSTOM_GROUP_NAMES = Object.keys(SWORD_PLAYER_GROUPS).filter((g) => g !== 'effect:default_stats');

pEnt.events['effect:reset_player'] = {
  remove: { component_groups: ALL_CUSTOM_GROUP_NAMES },
  add: { component_groups: ['effect:default_stats'] },
};

for (const groupName of ALL_CUSTOM_GROUP_NAMES) {
  const shortKey = groupName.split(':')[1];
  pEnt.events[`effect:equip_${shortKey}`] = {
    remove: { component_groups: ALL_CUSTOM_GROUP_NAMES.filter((g) => g !== groupName) },
    add: { component_groups: ['effect:default_stats', groupName] },
  };
}

// Pre-damage dodge events triggered directly from C++ `damage_sensor`
pEnt.events['effect:ui_dodge'] = {
  queue_command: {
    command: [
      'scriptevent effect:dodge ultra_instinct',
    ],
  },
};
pEnt.events['effect:ender_dodge'] = {
  queue_command: {
    command: [
      'scriptevent effect:dodge ender_always',
    ],
  },
};
pEnt.events['effect:ender_melee_dodge'] = {
  sequence: [
    {
      queue_command: {
        command: ['playsound mob.endermen.hit @a[r=8] ~ ~ ~'],
      },
    },
    {
      randomize: [
        { weight: 50 },
        {
          weight: 50,
          queue_command: {
            command: ['scriptevent effect:dodge ender_melee'],
          },
        },
      ],
    },
  ],
};

writeJson(path.join(BP, 'entities/player.json'), playerBP);

// ===========================================================================
// PART C: REBASED VANILLA ENTITIES (`v1.26.60.5`)
// ===========================================================================

// C.1 `enderman.json` — Adds Red-eyed Enderman (variant 1, 20% Overworld spawn, 120 HP, 12 dmg, 2.5% Ender Sword drop)
{
  const data = readVanillaBP('enderman.json');
  const ent = data['minecraft:entity'];
  ent.component_groups['effect:default_enderman'] = {
    'minecraft:variant': { value: 0 },
  };
  ent.component_groups['effect:red_enderman'] = {
    'minecraft:variant': { value: 1 },
    'minecraft:scale': { value: 1.2 },
    'minecraft:attack': { damage: 12 },
    'minecraft:health': { value: 120, max: 120 },
    'minecraft:follow_range': { value: 64, max: 64 },
    'minecraft:loot': { table: 'loot_tables/entities/red_enderman.json' },
  };
  // Preserve vanilla initialization even when the red variant's biome filter
  // fails (the End / Nether) and for entities that are not riding.
  const vanillaSpawn = ent.events['minecraft:entity_spawned'];
  ent.events['minecraft:entity_spawned'] = {
    sequence: [
      vanillaSpawn,
      {
        randomize: [
          { weight: 80, add: { component_groups: ['effect:default_enderman'] } },
          {
            weight: 20,
            filters: { test: 'has_biome_tag', operator: '==', value: 'overworld' },
            add: { component_groups: ['effect:red_enderman'] },
          },
        ],
      },
    ],
  };
  ent.events['red_enderman'] = {
    add: { component_groups: ['minecraft:enderman_calm', 'minecraft:not_riding', 'effect:red_enderman'] },
  };
  writeJson(path.join(BP, 'entities/enderman.json'), data);
}

// C.2 `witch.json` — Adds Grass Witch (variant 1, 20% spawn, 32 HP, summons `entity:grass` root traps, 20% Grass Sword drop)
{
  const data = readVanillaBP('witch.json');
  const ent = data['minecraft:entity'];
  ent.component_groups['effect:default_witch'] = {
    'minecraft:variant': { value: 0 },
  };
  ent.component_groups['effect:grass_witch'] = {
    'minecraft:variant': { value: 1 },
    'minecraft:scale': { value: 1.1 },
    'minecraft:type_family': { family: ['witch', 'grass_witch', 'monster', 'mob'] },
    'minecraft:health': { value: 32, max: 32 },
    'minecraft:follow_range': { value: 80, max: 80 },
    // Exact 2.8.8: the group carries `"minecraft:loot": {}` — a Grass Witch drops
    // nothing at all; the sword comes from the scripted 20% `on_death` roll.
    'minecraft:loot': {},
    'minecraft:timer': {
      time: [1.5, 2.5],
      looping: true,
      randomInterval: true,
      time_down_event: { event: 'effect:grass_witch_skill', target: 'self' },
    },
  };
  ent.events['minecraft:entity_spawned'] = {
    randomize: [
      { weight: 80, add: { component_groups: ['effect:default_witch'] } },
      { weight: 20, add: { component_groups: ['effect:grass_witch'] } },
    ],
  };
  ent.events['grass_witch'] = {
    add: { component_groups: ['effect:grass_witch'] },
  };
  ent.events['minecraft:grass_witch'] = {
    add: { component_groups: ['effect:grass_witch'] },
  };
  ent.events['effect:grass_witch_skill'] = {
    queue_command: {
      command: [
        'execute at @e[family=!grass_witch,family=!grass_sword,family=!ghost_sword,type=!item,type=!entity:grass,type=!xp_orb,type=!arrow,r=8,tag=!grass,family=!shulker_sword] if block ~ ~-0.1 ~ grass_block if block ~ ~ ~ air run summon entity:grass ~ ~ ~',
        'execute at @e[family=!grass_witch,family=!grass_sword,family=!ghost_sword,type=!item,type=!entity:grass,type=!xp_orb,type=!arrow,r=8,tag=!grass,family=!shulker_sword] if block ~ ~-0.1 ~ grass_block if block ~ ~ ~ short_grass run summon entity:grass ~ ~ ~',
      ],
    },
  };
  writeJson(path.join(BP, 'entities/witch.json'), data);
}

// C.3 `spider.json` — Adds `spider_player_jockey` mount for Spider Sword
{
  const data = readVanillaBP('spider.json');
  const ent = data['minecraft:entity'];
  // Exact 2.8.8 `minecraft:spider_player_jockey`: no loot, 20 HP, jump 0.4–0.7,
  // ridden through `behavior.controlled_by_player`, seat at y=0.54 and an
  // `environment_sensor` that fires `not_climb` so the mount does not climb walls.
  ent.component_groups['effect:spider_player_jockey'] = {
    'minecraft:type_family': { family: ['spider', 'monster', 'mob', 'arthropod', 'spider_sword'] },
    'minecraft:input_ground_controlled': {},
    'minecraft:behavior.controlled_by_player': { priority: 0 },
    'minecraft:can_power_jump': {},
    'minecraft:horse.jump_strength': { value: { range_min: 0.4, range_max: 0.7 } },
    'minecraft:loot': { table: 'loot_tables/entities/empty.json' },
    'minecraft:health': { value: 20, max: 20 },
    'minecraft:rideable': {
      seat_count: 1,
      family_types: ['player'],
      seats: [{ position: [0.0, 0.54, 0.0] }],
    },
    'minecraft:environment_sensor': {
      triggers: [{ filters: {}, event: 'not_climb' }],
    },
  };
  // The 2.8.8 entity attacks for 3, not for the vanilla 2.
  ent.components['minecraft:attack'] = { damage: 3 };
  ent.component_groups['effect:instant_despawn'] = {
    'minecraft:instant_despawn': {},
  };
  // Same shape as 2.8.8: strip the hostile/neutral/default groups, then become a mount.
  // The 1.26.60 spider has no `minecraft:default_spider` group, so only the two
  // groups that actually exist there are removed.
  ent.events['effect:spider_sword'] = {
    remove: {
      component_groups: ['minecraft:spider_hostile', 'minecraft:spider_neutral'],
    },
    add: { component_groups: ['effect:spider_player_jockey'] },
  };
  ent.events['effect:despawn_mount'] = {
    add: { component_groups: ['effect:instant_despawn'] },
  };
  writeJson(path.join(BP, 'entities/spider.json'), data);
}

// C.4 `ender_crystal.json` — Overhead Spectral Sword crystal + 18s scale recharge + 2% Spectral Sword drop in Nether (post-blast!)
{
  const data = readVanillaBP('ender_crystal.json');
  const ent = data['minecraft:entity'];
  // Keep vanilla on_hurt in the base components: crystals saved before the pack
  // was installed will not necessarily receive entity_spawned again on reload.
  // The sword rider's damage sensor prevents ordinary damage.
  ent.component_groups['effect:spectral_rider'] = {
    'minecraft:type_family': { family: ['ender_crystal', 'spectral_sword', 'effect99_entities'] },
    'minecraft:scale': { value: 0.55 },
    'minecraft:collision_box': { width: 0.0, height: 0.0 },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: 'no' }],
    },
  };
  ent.component_groups['effect:ender_crystal_scale'] = {
    'minecraft:type_family': {
      family: ['ender_crystal', 'spectral_sword', 'ender_crystal_scale', 'effect99_entities'],
    },
    'minecraft:scale': { value: 0.2 },
    'minecraft:collision_box': { width: 0.0, height: 0.0 },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: 'no' }],
    },
    'minecraft:timer': {
      time: 18.0,
      looping: false,
      time_down_event: { event: 'effect:end_scale', target: 'self' },
    },
  };
  ent.component_groups['effect:instant_despawn'] = {
    'minecraft:instant_despawn': {},
  };

  ent.events['minecraft:crystal_explode'] = {
    sequence: [
      {
        filters: { test: 'is_family', subject: 'self', operator: '!=', value: 'spectral_sword' },
        queue_command: {
          command: ['scriptevent effect:ender_crystal_exploded ~'],
        },
      },
      {
        add: { component_groups: ['crystal_exploding'] },
      },
    ],
  };
  ent.events['effect:spectral_rider'] = {
    remove: { component_groups: ['effect:ender_crystal_scale'] },
    add: { component_groups: ['effect:spectral_rider'] },
  };
  ent.events['effect:end_scale'] = {
    remove: { component_groups: ['effect:ender_crystal_scale'] },
    add: { component_groups: ['effect:spectral_rider'] },
    queue_command: {
      command: [
        'playsound portal.travel @a[r=16] ~ ~ ~ 0.6 7',
        'particle minecraft:example_flipbook ~ ~0.8 ~',
      ],
    },
  };
  ent.events['effect:ender_crystal_scale'] = {
    remove: { component_groups: ['effect:spectral_rider'] },
    add: { component_groups: ['effect:ender_crystal_scale'] },
  };
  ent.events['effect:despawn'] = {
    add: { component_groups: ['effect:instant_despawn'] },
  };
  writeJson(path.join(BP, 'entities/ender_crystal.json'), data);
}

// C.5 `creeper.json` — Charged Creeper ignited with Flint & Steel (`forced_charged_exploding`) drops `effect:creeper_sword` (5%)
// Spawns AFTER the t=1.5s Power-6 explosion via `scriptevent effect:creeper_sword_drop` so the blast never destroys the dropped sword!
{
  const data = readVanillaBP('creeper.json');
  const ent = data['minecraft:entity'];
  if (ent.component_groups['minecraft:forced_charged_exploding']) {
    ent.component_groups['minecraft:forced_charged_exploding']['minecraft:timer'] = {
      time: 1.4,
      looping: false,
      time_down_event: { event: 'effect:creeper_sword_drop', target: 'self' },
    };
  }
  ent.events['effect:creeper_sword_drop'] = {
    randomize: [
      { weight: 95 },
      {
        weight: 5,
        queue_command: {
          command: ['scriptevent effect:creeper_sword_drop ~'],
        },
      },
    ],
  };
  writeJson(path.join(BP, 'entities/creeper.json'), data);
}

// C.6 `parrot.json` — Wild parrots tempted by `effect:jungle_sword`
{
  const data = readVanillaBP('parrot.json');
  const ent = data['minecraft:entity'];
  ent.components['minecraft:behavior.tempt'] = {
    priority: 4,
    speed_multiplier: 1.1,
    items: ['effect:jungle_sword', 'minecraft:wheat_seeds', 'minecraft:melon_seeds', 'minecraft:pumpkin_seeds', 'minecraft:beetroot_seeds', 'minecraft:torchflower_seeds', 'minecraft:pitcher_pod'],
  };
  writeJson(path.join(BP, 'entities/parrot.json'), data);
}

// C.7 `tnt.json` — Adds `giant_tnt` (2.5x scale, 8s fuse, power 16 + camera shake) for TNT Sword
{
  const data = readVanillaBP('tnt.json');
  const ent = data['minecraft:entity'];
  ent.component_groups['giant_tnt'] = {
    'minecraft:scale': { value: 2.5 },
    'minecraft:explode': {
      fuse_length: 8.0,
      fuse_lit: true,
      power: 16.0,
      causes_fire: true,
      destroy_affected_by_griefing: true,
    },
    'minecraft:timer': {
      time: 7.9,
      looping: false,
      time_down_event: { event: 'effect:giant_tnt_fx', target: 'self' },
    },
  };
  ent.events['giant_tnt'] = {
    add: { component_groups: ['giant_tnt'] },
  };
  ent.events['effect:giant_tnt_fx'] = {
    queue_command: {
      command: [
        'camerashake add @a[r=32] 0.25 0.8 positional',
        'playsound random.explode @a[r=32] ~ ~ ~ 2.0 0.4',
      ],
    },
  };
  writeJson(path.join(BP, 'entities/tnt.json'), data);
}

// C.8 Projectiles (`arrow`, `small_fireball`, `fireball`, `shulker_bullet`, `snowball`, `wither_skull`, `wither_skull_dangerous`)
// All custom-spawned projectiles MUST have `is_summonable: true` so `dimension.spawnEntity(...)` succeeds in 1.26.60!
for (const projFile of ['arrow.json', 'small_fireball.json']) {
  const data = readVanillaBP(projFile);
  const ent = data['minecraft:entity'];
  ent.description.is_summonable = true;
  const baseProj = JSON.parse(JSON.stringify(ent.components['minecraft:projectile']));
  baseProj.inertia = 0.05;
  baseProj.liquid_inertia = 0.05;
  ent.component_groups = ent.component_groups || {};
  ent.component_groups['minecraft:inertia_disable'] = {
    'minecraft:projectile': baseProj,
  };
  ent.component_groups['effect:instant_despawn'] = {
    'minecraft:instant_despawn': {},
  };
  ent.events = ent.events || {};
  ent.events['minecraft:inertia_disable'] = {
    add: { component_groups: ['minecraft:inertia_disable'] },
  };
  ent.events['effect:despawn'] = {
    add: { component_groups: ['effect:instant_despawn'] },
  };
  writeJson(path.join(BP, 'entities', projFile), data);
}

for (const projFile of ['fireball.json', 'wither_skull.json', 'wither_skull_dangerous.json']) {
  const data = readVanillaBP(projFile);
  const ent = data['minecraft:entity'];
  ent.description.is_summonable = true;
  const playerProj = JSON.parse(JSON.stringify(ent.components['minecraft:projectile']));
  playerProj.gravity = 0.02;
  playerProj.power = 1.8;
  ent.component_groups = ent.component_groups || {};
  ent.component_groups['effect:player_shot'] = {
    'minecraft:projectile': playerProj,
  };
  ent.events = ent.events || {};
  ent.events['effect:player_shot'] = {
    add: { component_groups: ['effect:player_shot'] },
  };
  writeJson(path.join(BP, 'entities', projFile), data);
}

{
  const data = readVanillaBP('shulker_bullet.json');
  const ent = data['minecraft:entity'];
  ent.description.is_summonable = true;
  const swordProj = JSON.parse(JSON.stringify(ent.components['minecraft:projectile']));
  swordProj.homing = false;
  swordProj.gravity = 0.01;
  swordProj.power = 1.8;
  swordProj.destroy_on_hurt = false;
  ent.component_groups = ent.component_groups || {};
  ent.component_groups['effect:shulker_sword'] = {
    'minecraft:projectile': swordProj,
  };
  ent.events = ent.events || {};
  ent.events['effect:shulker_sword'] = {
    add: { component_groups: ['effect:shulker_sword'] },
  };
  writeJson(path.join(BP, 'entities/shulker_bullet.json'), data);
}

{
  const data = readVanillaBP('snowball.json');
  const ent = data['minecraft:entity'];
  const iceProj = JSON.parse(JSON.stringify(ent.components['minecraft:projectile']));
  iceProj.on_hit = iceProj.on_hit || {};
  iceProj.on_hit.impact_damage = { damage: { min: 2, max: 2 }, knockback: true };
  iceProj.on_hit.definition_event = {
    affect_projectile: true,
    event_trigger: { event: 'effect:place_snow', target: 'self' },
  };
  ent.component_groups = ent.component_groups || {};
  ent.component_groups['effect:ice_sword_snowball'] = {
    'minecraft:projectile': iceProj,
  };
  ent.events = ent.events || {};
  ent.events['effect:ice_sword_snowball'] = {
    add: { component_groups: ['effect:ice_sword_snowball'] },
  };
  ent.events['effect:place_snow'] = {
    queue_command: {
      command: ['fill ~ ~ ~ ~ ~ ~ snow_layer [] replace air'],
    },
  };
  writeJson(path.join(BP, 'entities/snowball.json'), data);
}

// ===========================================================================
// PART D: ALL 29 CUSTOM `entity:*` DEFINITIONS (Modernized for 1.26.60!)
// ===========================================================================

// Helper to modernize legacy 1.16 commands inside custom entity JSONs
function modernizeCommand(cmd) {
  let c = cmd.trim();
  // Replace unspaced `~~~` legacy coordinate shorthand BEFORE regex matching!
  c = c.replace(/(^|\s)~~~(?=\s|$)/g, '$1~ ~ ~');
  // Replace `structure load <sword> ...` with clean 1.26 `loot spawn ~ ~ ~ loot "swords/<sword>"`
  c = c.replace(/structure\s+load\s+([a-z0-9_]+)\s+([^\s]+(?:\s+[^\s]+){0,2})/g, 'loot spawn $2 loot "swords/$1"');
  // Replace legacy block data
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+effect99:lightblock\s+0\s+replace\s+air/g, 'fill $1 effect99:lightblock [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+effect99:lightblock\s+0\s+replace\s+effect99:lightblock/g, '');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+fire\s+0\s+replace\s+air/g, 'fill $1 fire [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+air\s+0\s+replace\s+fire/g, 'fill $1 air [] replace fire');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+tallgrass\s+0\s+replace\s+air/g, 'fill $1 short_grass [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+web\s+0\s+replace\s+air/g, 'fill $1 web [] replace air');
  c = c.replace(/summon\s+lightning_bolt\s+([^\s]+(?:\s+[^\s]+){0,2})\s+default_lightning_bolt/g, 'summon lightning_bolt $1');
  c = c.replace(/^effect\s+(@[^\s]+)\s+([a-z0-9_:]+)\s+0\s+0$/g, 'effect $1 $2 0');
  c = c.replace(/^say\s+\d+$/g, '');
  c = c.replace(/tp\s+@s\s+~\s+-103\s+~/g, 'event entity @s effect:instant_despawn');
  // Legacy execute conversions
  if (c.includes('execute @')) {
    c = c
      .replace(/execute @e\[type=!entity:grass,c=1,r=1,tag=grass\] ~ ~ ~ detect ~ ~-1 ~ grass 0 execute @s ~ ~ ~ detect ~ ~ ~ air 0 tp @s ~ ~-1 ~/g,
        'execute as @e[type=!entity:grass,c=1,r=2,tag=grass] at @s if block ~ ~-1 ~ grass_block if block ~ ~ ~ air run tp @s ~ ~-0.85 ~')
      .replace(/execute @e\[type=!entity:grass,c=1,r=1,tag=grass\] ~ ~ ~ detect ~ ~-1 ~ grass 0 execute @s ~ ~ ~ detect ~ ~ ~ tallgrass 0 tp @s ~ ~-1 ~/g,
        'execute as @e[type=!entity:grass,c=1,r=2,tag=grass] at @s if block ~ ~-1 ~ grass_block if block ~ ~ ~ short_grass run tp @s ~ ~-0.85 ~')
      .replace(/execute @e\[family=!grass_witch,type=!entity:grass,type=!xp_orb,type=!arrow,r=1,tag=!grass\] ~ ~ ~ tag @s add grass/g,
        'tag @e[family=!grass_witch,family=!grass_sword,family=!shulker_sword,family=!ghost_sword,type=!entity:grass,type=!item,type=!xp_orb,type=!arrow,r=2,tag=!grass] add grass')
      .replace(/execute @s ~ ~ ~ detect ~ ~ ~ air 0 event entity @s teleport_enable/g,
        'execute as @s at @s if block ~ ~ ~ air run event entity @s teleport_enable')
      .replace(/execute @s ~ ~ ~ detect ~ ~-1 ~ air 0 execute @s ~ ~ ~ detect ~ ~-2 ~ air 0 event entity @s is_baby/g,
        'execute as @s at @s if block ~ ~-1 ~ air if block ~ ~-2 ~ air run event entity @s is_baby')
      .replace(/execute @e\[r=1,family=monster\] ~ ~ ~ summon entity:slime_damage/g,
        'execute at @e[r=1.5,family=monster] run summon entity:slime_damage ~ ~ ~')
      .replace(/execute @s\[scores=\{slime_despawn=100\}\] ~ ~ ~ event entity @s despawn/g,
        'execute as @s[scores={slime_despawn=100..}] run event entity @s despawn');
  }
  return c.trim();
}

function walkTransformCommands(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) walkTransformCommands(item);
    return;
  }
  if (obj.run_command && Array.isArray(obj.run_command.command)) {
    const cleaned = obj.run_command.command.map(modernizeCommand).filter(Boolean);
    obj.queue_command = { command: cleaned };
    delete obj.run_command;
  }
  for (const k of Object.keys(obj)) {
    walkTransformCommands(obj[k]);
  }
}

const customEntityFiles = fs.readdirSync(path.join(SRC_288_BP, 'entities')).filter((f) => {
  const d = jsonc.parse(fs.readFileSync(path.join(SRC_288_BP, 'entities', f), 'utf8'));
  return !d['minecraft:entity'].description.identifier.startsWith('minecraft:');
});

for (const f of customEntityFiles.sort()) {
  const raw = jsonc.parse(fs.readFileSync(path.join(SRC_288_BP, 'entities', f), 'utf8'));
  const ent = raw['minecraft:entity'];
  ent.component_groups = ent.component_groups || {};
  ent.component_groups['despawn'] = { 'minecraft:instant_despawn': {} };
  ent.component_groups['effect:instant_despawn'] = { 'minecraft:instant_despawn': {} };
  ent.events = ent.events || {};
  ent.events['effect:instant_despawn'] = { add: { component_groups: ['effect:instant_despawn'] } };

  // Remove old animation controller references on custom entities where our TS or modern events drive them cleanly,
  // EXCEPT keep valid animation controllers we ship in `Swords_B/animation_controllers/`.
  if (f === 'ultra_instinct_projectile.json') {
    // Fix `ageable` (requires `is_baby` + valid `minecraft:end_scale` event) and `summon entity:ultra_instinct_explode ~ ~ ~`!
    ent.components['minecraft:is_baby'] = {};
    if (ent.components['minecraft:projectile']?.on_hit) {
      ent.components['minecraft:projectile'].on_hit.remove_on_hit = {};
    }
    ent.events['minecraft:end_scale'] = {};
    ent.events['minecraft:explode'] = {
      add: { component_groups: ['despawn'] },
      queue_command: {
        command: ['summon entity:ultra_instinct_explode ~ ~ ~'],
      },
    };
    // Do NOT delete `minecraft:bedrock` or `effect:*` sword items when carving tunnels!
    ent.events.projectile_particle = {
      queue_command: {
        command: [
          'particle minecraft:example_flipbook ~ ~ ~',
        ],
      },
    };
  }
  if (f === 'living_flame.json') {
    // Ensure `ageable` (`duration: 1 -> hostile_entity_detect`) genuinely ticks when summoned without a spawn event!
    ent.components['minecraft:is_baby'] = {};
  }
  if (f === 'shulker_shield.json') {
    // Clean despawn without calling nonexistent `stop_shulker_sword_event` on player
    ent.events['minecraft:despawn'] = {
      add: { component_groups: ['despawn'] },
      queue_command: {
        command: ['playsound mob.shulker.open @a[r=12] ~ ~ ~ 0.9 1.0'],
      },
    };
  }
  if (f === 'lightning_projectile.json') {
    // Extend flight lifetime for ranged swings & define `particle` event for environment_sensor!
    ent.components['minecraft:timer'] = {
      time: [1.2, 1.2],
      looping: false,
      time_down_event: { event: 'despawn', target: 'self' },
    };
    if (ent.components['minecraft:projectile']?.on_hit) {
      ent.components['minecraft:projectile'].on_hit.remove_on_hit = {};
    }
    ent.events.particle = {
      queue_command: {
        command: ['particle minecraft:electric_spark_particle ~ ~ ~'],
      },
    };
  }
  if (f === 'wither_effect.json') {
    ent.components['minecraft:timer'] = {
      time: [0.6, 0.6],
      looping: false,
      time_down_event: { event: 'despawn', target: 'self' },
    };
    if (ent.components['minecraft:projectile']?.on_hit) {
      ent.components['minecraft:projectile'].on_hit.remove_on_hit = {};
    }
    ent.events.particle = {
      queue_command: {
        command: ['particle minecraft:basic_smoke_particle ~ ~ ~'],
      },
    };
  }
  if (f === 'nether_star_projectile.json') {
    delete ent.events.objective;
    ent.events.set_objective = {
      queue_command: {
        command: ['summon entity:objective ~ ~ ~'],
      },
    };
    if (ent.component_groups?.nether_star_sword?.['minecraft:timer']) {
      ent.component_groups.nether_star_sword['minecraft:timer'].time = [1.0, 1.0];
      ent.component_groups.nether_star_sword['minecraft:timer'].looping = false;
    }
    ent.events['effect:nether_star_tracer'] = {
      add: { component_groups: ['nether_star_sword'] },
    };
  }
  if (f === 'alpha_wolf.json') {
    // Ensure Alpha Wolf is spawnable via Spawn Egg anytime (day or night), while natural Taiga spawns only persist & howl on Full Moon nights!
    ent.description.is_spawnable = true;
    delete ent.description.scripts;
    delete ent.description.animations;
    ent.component_groups['effect:natural_wolf'] = {
      'minecraft:is_sheared': {},
      'minecraft:environment_sensor': {
        triggers: [
          {
            filters: {
              any_of: [
                { test: 'moon_phase', operator: '!=', value: 0 },
                { test: 'is_daytime', value: true },
              ],
            },
            event: 'despawn',
          },
        ],
      },
    };
    ent.events['effect:natural_spawn'] = {
      sequence: [
        { add: { component_groups: ['effect:natural_wolf'] } },
        {
          filters: {
            all_of: [
              { test: 'moon_phase', operator: '==', value: 0 },
              { test: 'is_daytime', value: false },
            ],
          },
          queue_command: {
            command: ['playsound wolf_sword.distant_howl @a[rm=16,r=100]'],
          },
        },
      ],
    };
    ent.events['minecraft:entity_spawned'] = {
      queue_command: {
        command: ['playsound wolf_sword.distant_howl @a[r=64]'],
      },
    };
    // Handle the 10% Wolf Sword drop in `worldEvents.ts` so both Silver Sword melee AND +12 silver magic bonus hits roll once cleanly!
    ent.events['minecraft:wolf_sword'] = {};
  }
  if (f === 'ghost.json') {
    ent.description.is_spawnable = true;
  }
  if (f === 'slime_king.json') {
    ent.description.is_spawnable = true;
    // Deliberate fix, not a parity item: `loot_tables/entities/slime_king.json` ships in 2.8.8
    // (and in every later build) but no entity ever references it, so the Slime Sword never
    // dropped from the Slime King. The entity inherits `minecraft:slime` loot instead. We wire
    // the orphaned table up so the 4% (+2% per Looting level) drop finally works as authored.
    ent.components['minecraft:loot'] = { table: 'loot_tables/entities/slime_king.json' };
    ent.events['slime_effects'] = {
      queue_command: {
        command: [
          'effect @s jump_boost 1 0 true',
          'damage @p[r=1.8] 4 magic',
          'damage @e[r=1.5,type=!item,type=!xp_orb,family=!slime_king] 2 magic',
        ],
      },
    };
  }
  if (f === 'grows_crop.json') {
    // Fix entity-leak bug: `ageable` requires `is_baby`, plus add guaranteed 0.9s despawn timer!
    ent.components['minecraft:is_baby'] = {};
    ent.components['minecraft:timer'] = {
      time: [0.8, 1.0],
      looping: false,
      time_down_event: { event: 'despawn', target: 'self' },
    };
  }
  if (f === 'centella.json') {
    if (ent.components?.['minecraft:loot']) {
      ent.components['minecraft:loot'].table = 'loot_tables/empty.json';
    }
    // Let `worldEvents.ts` handle the 2% `effect:lightning_sword` drop for both melee and Bow/Trident kills (post-lightning, blast-safe!)
    ent.events['centella_death_by_player'] = {
      queue_command: {
        command: ['summon lightning_bolt ~ ~ ~'],
      },
    };
  }
  if (f === 'mountable_slime.json') {
    ent.events.default_slime = {
      remove: { component_groups: ['slime_random_direction', 'defense_mode_slime'] },
      add: { component_groups: ['default_slime'] },
    };
    if (ent.events.slime_events?.run_command?.command) {
      ent.events.slime_events.run_command.command = ent.events.slime_events.run_command.command.map((cmd) =>
        cmd.replace('scores={slime_despawn=0}', 'scores={slime_despawn=..30}')
      );
    }
  }

  // 1.26 expects a sensor object with triggers, not the old array of
  // on_environment wrappers used by several 2.8.8 entities.
  for (const components of [ent.components || {}, ...Object.values(ent.component_groups)]) {
    const sensor = components['minecraft:environment_sensor'];
    if (Array.isArray(sensor)) {
      components['minecraft:environment_sensor'] = {
        triggers: sensor.map((entry) => entry.on_environment ?? entry),
      };
    }
  }
  walkTransformCommands(ent);
  writeJson(path.join(BP, 'entities', f), raw);
}

// D.29 Dedicated `entity:minicreeper` projectile entity for `creeper_sword` (20% on-hit mini creeper!)
writeJson(path.join(BP, 'entities/minicreeper.json'), {
  format_version: '1.16.0',
  'minecraft:entity': {
    description: {
      identifier: 'entity:minicreeper',
      is_spawnable: false,
      is_summonable: true,
      is_experimental: false,
    },
    component_groups: {
      exploding: {
        'minecraft:explode': {
          fuse_length: 1.2,
          fuse_lit: true,
          power: 1.5,
          causes_fire: false,
          destroy_affected_by_griefing: true,
        },
      },
      despawn: {
        'minecraft:instant_despawn': {},
      },
    },
    components: {
      'minecraft:type_family': { family: ['creeper', 'player', 'effect99_entities'] },
      'minecraft:scale': { value: 0.35 },
      'minecraft:collision_box': { width: 0.3, height: 0.6 },
      'minecraft:health': { value: 10, max: 10 },
      'minecraft:movement': { value: 0.32 },
      'minecraft:navigation.walk': { can_path_over_water: true },
      'minecraft:movement.basic': {},
      'minecraft:jump.static': {},
      'minecraft:can_climb': {},
      'minecraft:physics': {},
      'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
      'minecraft:behavior.melee_attack': { priority: 2, speed_multiplier: 1.25, track_target: true },
      'minecraft:behavior.nearest_attackable_target': {
        priority: 1,
        within_radius: 16,
        must_see: true,
        entity_types: [
          { filters: { test: 'is_family', subject: 'other', value: 'monster' }, max_dist: 16 },
        ],
      },
      'minecraft:target_nearby_sensor': {
        inside_range: 2.5,
        must_see: true,
        on_inside_range: { event: 'start_exploding', target: 'self' },
      },
      'minecraft:timer': {
        time: [6.0, 8.0],
        looping: false,
        time_down_event: { event: 'start_exploding', target: 'self' },
      },
      'minecraft:damage_sensor': {
        triggers: [
          { cause: 'fall', deals_damage: false },
          {
            on_damage: { filters: { test: 'is_family', subject: 'other', value: 'player' } },
            deals_damage: false,
          },
        ],
      },
    },
    events: {
      start_exploding: { add: { component_groups: ['exploding'] } },
      despawn: { add: { component_groups: ['despawn'] } },
    },
  },
});

// ===========================================================================
// PART E: BEHAVIOR PACK ANIMATION CONTROLLERS (`Swords_B/animation_controllers/`)
// ===========================================================================
writeJson(path.join(BP, 'animation_controllers/despawn.json'), {
  format_version: '1.10.0',
  animation_controllers: {
    'controller.animation.despawn': {
      states: {
        default: { transitions: [{ despawn: 'q.life_time > 0.25 && !q.has_rider' }] },
        despawn: { on_entry: ['@s minecraft:despawn'], transitions: [{ default: '1.0' }] },
      },
    },
    'controller.animation.despawn_wolf': {
      states: {
        default: {
          transitions: [
            { despawn: 'q.moon_phase != 0 || (q.time_of_day > 0.22 && q.time_of_day < 0.78)' },
          ],
        },
        despawn: { on_entry: ['@s despawn'], transitions: [{ default: '1.0' }] },
      },
    },
    'controller.animation.despawn2': {
      states: {
        default: { transitions: [{ despawn2: 'q.life_time > 0.25 && !q.is_riding' }] },
        despawn2: { on_entry: ['@s minecraft:despawn'], transitions: [{ default: '1.0' }] },
      },
    },
  },
});

writeJson(path.join(BP, 'animation_controllers/mountable_slime.json'), {
  format_version: '1.10.0',
  animation_controllers: {
    'controller.animation.mountable_slime': {
      states: {
        default: { transitions: [{ mountable_slime: 'q.has_rider' }] },
        mountable_slime: { on_entry: ['@s default_slime'], transitions: [{ default: '1.0' }] },
      },
    },
  },
});

console.log('Step 2 entities & client_entities generated successfully!');
