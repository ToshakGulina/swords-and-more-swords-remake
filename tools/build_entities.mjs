import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jsonc = require('/tmp/refs/node_modules/jsonc-parser');

const ROOT = '/home/user/swords-and-more-swords-remake';
const BP = path.join(ROOT, 'packs/Swords_B');
const RP = path.join(ROOT, 'packs/Swords_R');
const SRC_288_BP = '/tmp/mcaddons/2.8.8/Swords_B';
const SRC_288_RP = '/tmp/mcaddons/2.8.8/Swords_R';
const VANILLA_BP = '/tmp/refs/bedrock-samples/behavior_pack';
const VANILLA_RP = '/tmp/refs/bedrock-samples/resource_pack';

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

// A.2 Rebase `enderman.entity.json` & `witch.entity.json` onto Mojang v1.26.60.5
const endermanClient = readVanillaRP('enderman.entity.json');
endermanClient['minecraft:client_entity'].description.textures.red_enderman = 'textures/entity/enderman/red_enderman';
writeJson(path.join(RP, 'entity/enderman.entity.json'), endermanClient);

const witchClient = readVanillaRP('witch.entity.json');
witchClient['minecraft:client_entity'].description.textures.grass_witch = 'textures/entity/grass_witch';
writeJson(path.join(RP, 'entity/witch.entity.json'), witchClient);

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
    c['minecraft:client_entity'].description.spawn_egg = {
      base_color: '#3b3b42',
      overlay_color: '#a81c1c',
    };
  }
  writeJson(path.join(RP, 'entity', f), c);
}

// Add `minicreeper` client entity so `entity:minicreeper` renders as a cute 0.3x Creeper without overriding vanilla creepers if summoned directly
const creeperClient = readVanillaRP('creeper.entity.json');
creeperClient['minecraft:client_entity'].description.identifier = 'entity:minicreeper';
delete creeperClient['minecraft:client_entity'].description.spawn_egg;
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
    'minecraft:collision_box': { width: 0.6, height: 0.9 },
    'minecraft:breathable': {
      generates_bubbles: true,
      inhale_time: 1.5,
      suffocate_time: -2,
      total_supply: 15,
      breathes_air: false,
      breathes_water: true,
    },
    'minecraft:underwater_movement': { value: 0.16 },
    'minecraft:movement': { value: 0.045 },
    'minecraft:type_family': { family: ['player', 'sea_sword'] },
  },

  'effect:ghost_sword': {
    'minecraft:collision_box': { width: 0.6, height: 0.9 },
    'minecraft:type_family': { family: ['monster', 'undead', 'ghost_sword'] },
    'minecraft:knockback_resistance': { value: 1.0 },
    'minecraft:movement': { value: 0.15 },
    'minecraft:hurt_on_condition': { damage_conditions: [] },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: false }],
    },
  },

  'effect:wolf_transformation': {
    'minecraft:scale': { value: 1.05 },
    'minecraft:type_family': { family: ['monster', 'wolf_sword'] },
    'minecraft:attack': { damage: 16 },
    'minecraft:movement': { value: 0.16 },
    'minecraft:knockback_resistance': { value: 0.4 },
  },

  'effect:ultra_instinct_sword': {
    'minecraft:type_family': { family: ['player', 'ultra_instinct_sword'] },
    'minecraft:movement': { value: 0.13 },
    'minecraft:knockback_resistance': { value: 1.0 },
    'minecraft:hurt_on_condition': { damage_conditions: [] },
    'minecraft:damage_sensor': {
      triggers: [
        {
          on_damage: {
            filters: {
              any_of: [
                { test: 'has_damage', value: 'attack' },
                { test: 'has_damage', value: 'projectile' },
              ],
            },
            event: 'effect:ui_dodge',
          },
          deals_damage: false,
        },
        { cause: 'entity_attack', deals_damage: false },
        { cause: 'projectile', deals_damage: false },
        { cause: 'entity_explosion', deals_damage: false },
        { cause: 'block_explosion', deals_damage: false },
        { cause: 'fire', deals_damage: false },
        { cause: 'fire_tick', deals_damage: false },
        { cause: 'lava', deals_damage: false },
        { cause: 'hot_floor', deals_damage: false },
        { cause: 'fall', deals_damage: false },
        { cause: 'wither', deals_damage: false },
        { cause: 'magic', deals_damage: false },
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
      seats: [{ position: [0.0, 2.1, 0.0] }],
    },
  },

  'effect:spectral_sword': {
    'minecraft:type_family': { family: ['player', 'spectral_sword'] },
    'minecraft:rideable': {
      seat_count: 1,
      family_types: ['spectral_sword', 'ender_crystal'],
      pull_in_entities: false,
      seats: [{ position: [0.0, 2.4, 0.0] }],
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

  'effect:slime_sword': {
    'minecraft:type_family': { family: ['player', 'slime_sword'] },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'fall', deals_damage: false }],
    },
  },

  'effect:spider_sword': {
    'minecraft:type_family': { family: ['player', 'spider_sword'] },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'fall', deals_damage: false }],
    },
  },
};

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
  randomize: [
    { weight: 50 },
    {
      weight: 50,
      queue_command: {
        command: ['scriptevent effect:dodge ender_melee'],
      },
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
  ent.events['minecraft:entity_spawned'] = {
    randomize: [
      {
        weight: 80,
        add: { component_groups: ['minecraft:enderman_calm', 'effect:default_enderman'] },
      },
      {
        weight: 20,
        filters: { test: 'has_biome_tag', operator: '==', value: 'overworld' },
        add: { component_groups: ['minecraft:enderman_calm', 'effect:red_enderman'] },
      },
    ],
  };
  ent.events['red_enderman'] = {
    add: { component_groups: ['minecraft:enderman_calm', 'effect:red_enderman'] },
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
    'minecraft:type_family': { family: ['witch', 'grass_witch', 'monster', 'mob'] },
    'minecraft:health': { value: 32, max: 32 },
    'minecraft:behavior.ranged_attack': {
      priority: 2,
      speed_multiplier: 1.0,
      attack_interval_min: 3.0,
      attack_interval_max: 3.5,
      attack_radius: 12.0,
    },
    'minecraft:shooter': {
      def: 'entity:nether_star_projectile',
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
  writeJson(path.join(BP, 'entities/witch.json'), data);
}

// C.3 `spider.json` — Adds `spider_player_jockey` mount for Spider Sword
{
  const data = readVanillaBP('spider.json');
  const ent = data['minecraft:entity'];
  ent.component_groups['effect:spider_player_jockey'] = {
    'minecraft:type_family': { family: ['spider', 'spider_mount', 'effect99_entities', 'arthropod'] },
    'minecraft:is_tamed': {},
    'minecraft:input_ground_controlled': {},
    'minecraft:can_power_jump': {},
    'minecraft:horse.jump_strength': { value: { range_min: 0.7, range_max: 1.1 } },
    'minecraft:movement': { value: 0.34 },
    'minecraft:rideable': {
      seat_count: 1,
      crouching_skip_interact: true,
      family_types: ['player'],
      seats: [{ position: [0.0, 0.55, -0.1] }],
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
  };
  ent.component_groups['effect:instant_despawn'] = {
    'minecraft:instant_despawn': {},
  };
  ent.events['spider_player_jockey'] = {
    add: { component_groups: ['effect:spider_player_jockey'] },
  };
  ent.events['effect:despawn_mount'] = {
    add: { component_groups: ['effect:instant_despawn'] },
  };
  writeJson(path.join(BP, 'entities/spider.json'), data);
}

// C.4 `ender_crystal.json` — Overhead Spectral Sword crystal + 2% Spectral Sword drop in Nether
{
  const data = readVanillaBP('ender_crystal.json');
  const ent = data['minecraft:entity'];
  ent.component_groups['effect:spectral_rider'] = {
    'minecraft:type_family': { family: ['ender_crystal', 'spectral_sword', 'effect99_entities'] },
    'minecraft:scale': { value: 0.55 },
    'minecraft:collision_box': { width: 0.0, height: 0.0 },
    'minecraft:damage_sensor': {
      triggers: [{ cause: 'all', deals_damage: false }],
    },
  };
  ent.component_groups['effect:instant_despawn'] = {
    'minecraft:instant_despawn': {},
  };
  ent.events['effect:spectral_rider'] = {
    add: { component_groups: ['effect:spectral_rider'] },
  };
  ent.events['effect:despawn'] = {
    add: { component_groups: ['effect:instant_despawn'] },
  };
  writeJson(path.join(BP, 'entities/ender_crystal.json'), data);
}

// C.5 `creeper.json` — Charged Creeper ignited with Flint & Steel (`forced_charged_exploding`) drops `effect:creeper_sword` (5%)
{
  const data = readVanillaBP('creeper.json');
  const ent = data['minecraft:entity'];
  if (ent.component_groups['minecraft:forced_charged_exploding']) {
    ent.component_groups['minecraft:forced_charged_exploding']['minecraft:timer'] = {
      time: [1.4, 1.4],
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
          command: ['loot spawn ~ ~ ~ loot "swords/creeper_sword"'],
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
      time: [7.9, 7.9],
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
for (const projFile of ['arrow.json', 'small_fireball.json']) {
  const data = readVanillaBP(projFile);
  const ent = data['minecraft:entity'];
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
  iceProj.on_hit.impact_damage = { damage: 2, knockback: true };
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
  // Replace `structure load <sword> ...` with clean 1.26 `loot spawn ~ ~ ~ loot "swords/<sword>"`
  c = c.replace(/structure\s+load\s+([a-z0-9_]+)\s+([^\s]+(?:\s+[^\s]+){0,2})/g, 'loot spawn $2 loot "swords/$1"');
  // Replace `~~~` shorthand spacing where needed & legacy block data
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+effect99:lightblock\s+0\s+replace\s+air/g, 'fill $1 effect99:lightblock [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+effect99:lightblock\s+0\s+replace\s+effect99:lightblock/g, '');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+fire\s+0\s+replace\s+air/g, 'fill $1 fire [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+air\s+0\s+replace\s+fire/g, 'fill $1 air [] replace fire');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+tallgrass\s+0\s+replace\s+air/g, 'fill $1 short_grass [] replace air');
  c = c.replace(/fill\s+([^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+)\s+web\s+0\s+replace\s+air/g, 'fill $1 web [] replace air');
  c = c.replace(/summon\s+lightning_bolt\s+([^\s]+(?:\s+[^\s]+){0,2})\s+default_lightning_bolt/g, 'summon lightning_bolt $1');
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
        'tag @e[family=!grass_witch,family=!player,type=!entity:grass,type=!item,type=!xp_orb,type=!arrow,r=2,tag=!grass] add grass')
      .replace(/execute @s ~~~ detect ~~~ air 0 event entity @s teleport_enable/g,
        'execute as @s at @s if block ~ ~ ~ air run event entity @s teleport_enable')
      .replace(/execute @s ~~~ detect ~ ~-1 ~ air 0 execute @s ~~~ detect ~ ~-2 ~ air 0 event entity @s is_baby/g,
        'execute as @s at @s if block ~ ~-1 ~ air if block ~ ~-2 ~ air run event entity @s is_baby')
      .replace(/execute @e\[r=1,family=monster\] ~~~ summon entity:slime_damage/g,
        'execute at @e[r=1.5,family=monster] run summon entity:slime_damage ~ ~ ~')
      .replace(/execute @s\[scores=\{slime_despawn=100\}\] ~~~ event entity @s despawn/g,
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
    // Do NOT delete `minecraft:bedrock` or `effect:*` sword items when carving tunnels!
    ent.events.projectile_particle = {
      queue_command: {
        command: [
          'particle minecraft:example_flipbook ~ ~ ~',
        ],
      },
    };
  }
  if (f === 'alpha_wolf.json') {
    // Ensure Alpha Wolf is spawnable via spawn egg in Creative too!
    ent.description.is_spawnable = true;
  }
  if (f === 'ghost.json' || f === 'slime_king.json') {
    ent.description.is_spawnable = true;
  }
  if (f === 'centella.json' && ent.components?.['minecraft:loot']) {
    ent.components['minecraft:loot'].table = 'loot_tables/empty.json';
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
        default: { transitions: [{ despawn: '!q.has_rider' }] },
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
        default: { transitions: [{ despawn2: '!q.is_riding' }] },
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
