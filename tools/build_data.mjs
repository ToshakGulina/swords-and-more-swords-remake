import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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

// Deterministic fresh UUIDs (v4 format) so Android & Windows never hit "Duplicate pack detected"
const UUIDS = {
  bp_header: '94e87f3a-51c2-4d9e-8b31-7a01c56d2901',
  bp_data:   '94e87f3a-51c2-4d9e-8b31-7a01c56d2902',
  bp_script: '94e87f3a-51c2-4d9e-8b31-7a01c56d2903',
  rp_header: '94e87f3a-51c2-4d9e-8b31-7a01c56d2904',
  rp_res:    '94e87f3a-51c2-4d9e-8b31-7a01c56d2905',
};

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Manifests (Swords_B & Swords_R) — Zero experimental toggles required!
// ---------------------------------------------------------------------------
writeJson(path.join(BP, 'manifest.json'), {
  format_version: 2,
  header: {
    name: '§6§lSwords and More Swords §r§a(1.26+ Remake)',
    description: '§eПолное восстановление всех 38 мечей, боссов, руд и способностей мода Effect99 для Minecraft Bedrock 1.26.60+ (Android & Windows) без экспериментальных режимов.',
    uuid: UUIDS.bp_header,
    version: [3, 0, 2],
    min_engine_version: [1, 26, 20],
  },
  modules: [
    {
      description: 'Swords and More Swords Behavior Data',
      type: 'data',
      uuid: UUIDS.bp_data,
      version: [3, 0, 2],
    },
    {
      description: 'Swords and More Swords Script Engine',
      type: 'script',
      language: 'javascript',
      uuid: UUIDS.bp_script,
      version: [3, 0, 2],
      entry: 'scripts/main.js',
    },
  ],
  dependencies: [
    {
      uuid: UUIDS.rp_header,
      version: [3, 0, 2],
    },
    {
      module_name: '@minecraft/server',
      version: '2.6.0',
    },
  ],
  metadata: {
    authors: ['Effect99 (Original Creator)', 'Remake for Bedrock 1.26.60+'],
  },
});

writeJson(path.join(RP, 'manifest.json'), {
  format_version: 2,
  header: {
    name: '§6§lSwords and More Swords §r§bResources (1.26+)',
    description: '§eРесурс-пак мода Swords and More Swords (текстуры, 3D-модели, анимации, звуки и встроенный справочник на русском и английском языках) для Minecraft Bedrock 1.26.60+.',
    uuid: UUIDS.rp_header,
    version: [3, 0, 2],
    min_engine_version: [1, 26, 20],
  },
  modules: [
    {
      description: 'Swords and More Swords Resource Assets',
      type: 'resources',
      uuid: UUIDS.rp_res,
      version: [3, 0, 2],
    },
  ],
  dependencies: [
    {
      uuid: UUIDS.bp_header,
      version: [3, 0, 2],
    },
  ],
  metadata: {
    authors: ['Effect99 (Original Creator)', 'Remake for Bedrock 1.26.60+'],
  },
});

// ---------------------------------------------------------------------------
// 2. Resource Pack JSON fixes (`null.geo.json`, `blocks.json`, `item_texture.json`)
// ---------------------------------------------------------------------------
writeJson(path.join(RP, 'models/blocks/null.geo.json'), {
  format_version: '1.12.0',
  'minecraft:geometry': [
    {
      description: {
        identifier: 'geometry.null',
        texture_width: 16,
        texture_height: 16,
        visible_bounds_width: 1,
        visible_bounds_height: 1,
        visible_bounds_offset: [0, 0, 0],
      },
      bones: [
        {
          name: 'root',
          pivot: [0, 0, 0],
        },
      ],
    },
  ],
});

writeJson(path.join(RP, 'blocks.json'), {
  format_version: [1, 1, 0],
  'effect99:spectral_block': {
    textures: 'spectral_block',
    sound: 'stone',
  },
  'effect99:silver_ore': {
    textures: 'silver_ore',
    sound: 'stone',
  },
  'effect99:quartz_diamond_ore': {
    textures: 'quartz_diamond_ore',
    sound: 'glass',
  },
  'effect99:quartz_diamond_block': {
    textures: 'quartz_diamond_block',
    sound: 'metal',
  },
  'effect99:lightblock': {
    textures: 'lightblock',
    sound: 'stone',
  },
  'effect99:lightblock2': {
    textures: 'lightblock2',
    sound: 'stone',
  },
  'effect99:fake_ice': {
    textures: 'fake_ice',
    sound: 'glass',
  },
  'effect99:sapling3': {
    textures: 'sapling_jungle',
    sound: 'grass',
  },
});

const itemTex = jsonc.parse(fs.readFileSync(path.join(SRC_288_RP, 'textures/item_texture.json'), 'utf8'));
writeJson(path.join(RP, 'textures/item_texture.json'), itemTex);

// ---------------------------------------------------------------------------
// 3. Migrate all 42 Original Items (`format_version: "1.26.0"`)
// ---------------------------------------------------------------------------
const FIRE_RESISTANT_ITEMS = new Set([
  'effect:bedrock_sword',
  'effect:bedrock_stick',
]);

for (const fileName of fs.readdirSync(path.join(SRC_288_BP, 'items')).sort()) {
  const srcItem = jsonc.parse(fs.readFileSync(path.join(SRC_288_BP, 'items', fileName), 'utf8'))['minecraft:item'];
  const id = srcItem.description.identifier;
  const oldC = srcItem.components;
  const shortName = id.split(':')[1];

  const isMaterial = id === 'effect:quartz_diamond' || id === 'effect:silver_ingot';
  const isStick = id === 'effect:bedrock_stick' || id === 'effect:quartz_diamond_stick';
  const isSword = !isMaterial && !isStick;

  const menuCategory = isSword
    ? { category: 'equipment', group: 'minecraft:itemGroup.name.sword' }
    : { category: 'items' };

  const components = {};

  // Icon
  const iconName = typeof oldC['minecraft:icon'] === 'string'
    ? oldC['minecraft:icon']
    : oldC['minecraft:icon']?.texture || shortName;
  components['minecraft:icon'] = {
    textures: { default: iconName },
  };

  // Display name referencing exact localization key in en_US.lang & ru_RU.lang
  components['minecraft:display_name'] = {
    value: `item.${id}`,
  };

  // Stack size & hand equipped
  components['minecraft:max_stack_size'] = oldC['minecraft:max_stack_size'] ?? (isMaterial ? 64 : 1);
  if (oldC['minecraft:hand_equipped']) {
    components['minecraft:hand_equipped'] = { value: true };
  }
  if (oldC['minecraft:allow_off_hand']) {
    components['minecraft:allow_off_hand'] = { value: true };
  }
  if (oldC['minecraft:can_destroy_in_creative'] === false) {
    components['minecraft:can_destroy_in_creative'] = { value: false };
  }
  if (oldC['minecraft:foil'] === true) {
    components['minecraft:glint'] = { value: true };
  }
  if (oldC['minecraft:should_despawn'] === false) {
    components['minecraft:should_despawn'] = { value: false };
  }
  if (FIRE_RESISTANT_ITEMS.has(id)) {
    components['minecraft:fire_resistant'] = { value: true };
  }

  // Damage (positive integer in 1.26.0; fractional part & ghost_sword -666 handled in TS + weakness)
  if (typeof oldC['minecraft:damage'] === 'number' && oldC['minecraft:damage'] >= 1) {
    components['minecraft:damage'] = {
      value: Math.floor(oldC['minecraft:damage']),
    };
  }

  // Durability
  if (oldC['minecraft:durability']) {
    components['minecraft:durability'] = {
      max_durability: oldC['minecraft:durability'].max_durability,
      damage_chance: { min: 100, max: 100 },
    };
  }

  // Enchantable
  if (oldC['minecraft:enchantable'] && oldC['minecraft:enchantable'].slot && oldC['minecraft:enchantable'].slot !== 'none') {
    components['minecraft:enchantable'] = {
      slot: oldC['minecraft:enchantable'].slot,
      value: oldC['minecraft:enchantable'].value ?? 9,
    };
  }

  // Repairable
  if (oldC['minecraft:repairable']?.repair_items?.length) {
    const repairItems = oldC['minecraft:repairable'].repair_items.map((entry) => ({
      items: entry.items,
      repair_amount: entry.repair_amount,
    }));
    if (id === 'effect:cursed_pumpkin_sword') {
      repairItems.push({
        items: ['minecraft:pumpkin', 'minecraft:carved_pumpkin'],
        repair_amount: 150,
      });
    }
    components['minecraft:repairable'] = { repair_items: repairItems };
  }

  // Cooldown
  if (oldC['minecraft:cooldown']) {
    components['minecraft:cooldown'] = {
      category: oldC['minecraft:cooldown'].category,
      duration: oldC['minecraft:cooldown'].duration,
    };
  }

  // Fuel (`coal_sword`)
  if (oldC['minecraft:fuel']) {
    components['minecraft:fuel'] = {
      duration: oldC['minecraft:fuel'].duration,
    };
  }

  // Digger (fixing `pumkin` -> `pumpkin` typo on `bedrock_sword` + adding deepslate tags)
  if (oldC['minecraft:digger']) {
    const speeds = oldC['minecraft:digger'].destroy_speeds.map((ds) => {
      if (typeof ds.block === 'object' && ds.block.tags) {
        return {
          block: {
            tags: ds.block.tags.replace('pumkin', 'pumpkin'),
          },
          speed: ds.speed,
        };
      }
      return { block: ds.block, speed: ds.speed };
    });
    if (id === 'effect:bedrock_sword') {
      // Ensure deepslate, obsidian, crying_obsidian, ancient_debris also mine at 999 speed in 1.26!
      for (const extraBlock of [
        'minecraft:deepslate',
        'minecraft:cobbled_deepslate',
        'minecraft:obsidian',
        'minecraft:crying_obsidian',
        'minecraft:ancient_debris',
        'minecraft:reinforced_deepslate',
        'minecraft:end_stone',
        'minecraft:netherrack',
      ]) {
        speeds.push({ block: extraBlock, speed: 999 });
      }
    }
    components['minecraft:digger'] = {
      use_efficiency: Boolean(oldC['minecraft:digger'].use_efficiency),
      destroy_speeds: speeds,
    };
  }

  // Tags (`minecraft:is_sword`, `minecraft:is_tool`, `minecraft:is_pickaxe` for bedrock_sword)
  if (isSword) {
    const tags = ['minecraft:is_sword', 'minecraft:is_tool'];
    if (id === 'effect:bedrock_sword') {
      tags.push('minecraft:is_pickaxe', 'minecraft:netherite_tier', 'minecraft:digger');
    }
    components['minecraft:tags'] = { tags };
  } else if (isStick) {
    components['minecraft:tags'] = { tags: ['minecraft:is_tool'] };
  }

  // Custom Component V2 binding for swords & magic sticks
  if (isSword || isStick) {
    components['effect:sword'] = {
      id: shortName,
    };
  }

  writeJson(path.join(BP, 'items', fileName), {
    format_version: '1.26.0',
    'minecraft:item': {
      description: {
        identifier: id,
        menu_category: menuCategory,
      },
      components,
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Custom Blocks (`packs/Swords_B/blocks/*.json`, `format_version: "1.26.0"`)
// ---------------------------------------------------------------------------
// 4.1 `effect99:fake_ice` (4 cracking stages -> melts cleanly!)
writeJson(path.join(BP, 'blocks/fake_ice.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:fake_ice',
      menu_category: { category: 'none', is_hidden_in_commands: false },
      states: {
        'effect99:crack_stage': [0, 1, 2, 3],
      },
    },
    components: {
      'minecraft:display_name': 'tile.effect99:fake_ice.name',
      'minecraft:destructible_by_mining': { seconds_to_destroy: 0.4 },
      'minecraft:destructible_by_explosion': { explosion_resistance: 0.5 },
      'minecraft:friction': 0.02,
      'minecraft:light_dampening': 2,
      'minecraft:light_emission': 0,
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:map_color': '#9fd8ff',
      'minecraft:geometry': 'geometry.fake_ice',
      'minecraft:material_instances': {
        '*': {
          texture: 'fake_ice',
          render_method: 'blend',
          ambient_occlusion: 1.0,
          face_dimming: true,
        },
      },
      'minecraft:tick': {
        interval_range: [35, 55],
        looping: true,
      },
      'effect99:fake_ice': {},
    },
    permutations: [
      {
        condition: "q.block_state('effect99:crack_stage') == 1",
        components: { 'minecraft:geometry': 'geometry.fake_ice2' },
      },
      {
        condition: "q.block_state('effect99:crack_stage') == 2",
        components: { 'minecraft:geometry': 'geometry.fake_ice3' },
      },
      {
        condition: "q.block_state('effect99:crack_stage') == 3",
        components: { 'minecraft:geometry': 'geometry.fake_ice4' },
      },
    ],
  },
});

// 4.2 `effect99:lightblock` & `effect99:lightblock2` (Dynamic sword light blocks)
for (const [id, lightVal, tex] of [
  ['effect99:lightblock', 15, 'lightblock'],
  ['effect99:lightblock2', 11, 'lightblock2'],
]) {
  const short = id.split(':')[1];
  writeJson(path.join(BP, `blocks/${short}.json`), {
    format_version: '1.26.0',
    'minecraft:block': {
      description: {
        identifier: id,
        menu_category: { category: 'none', is_hidden_in_commands: true },
      },
      components: {
        'minecraft:collision_box': false,
        'minecraft:selection_box': false,
        'minecraft:replaceable': {},
        'minecraft:destructible_by_mining': false,
        'minecraft:destructible_by_explosion': { explosion_resistance: 0 },
        'minecraft:light_dampening': 0,
        'minecraft:light_emission': lightVal,
        'minecraft:loot': 'loot_tables/empty.json',
        'minecraft:geometry': 'geometry.null',
        'minecraft:material_instances': {
          '*': {
            texture: tex,
            render_method: 'alpha_test',
            ambient_occlusion: 0.0,
            face_dimming: false,
          },
        },
        'minecraft:tick': {
          interval_range: [8, 12],
          looping: true,
        },
        'effect99:lightblock': {},
      },
    },
  });
}

// 4.3 `effect99:quartz_diamond_block` (Requires Iron/Diamond/Netherite Pickaxe or Bedrock Sword + arcane backlash on break, exact 2.8.8!)
writeJson(path.join(BP, 'blocks/quartz_diamond_block.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:quartz_diamond_block',
      menu_category: {
        category: 'construction',
      },
    },
    components: {
      'minecraft:display_name': 'tile.effect99:quartz_diamond_block.name',
      'minecraft:destructible_by_mining': {
        seconds_to_destroy: 18.0,
        item_specific_speeds: [
          { item: 'minecraft:iron_pickaxe', destroy_speed: 2.2 },
          { item: 'minecraft:diamond_pickaxe', destroy_speed: 1.5 },
          { item: 'minecraft:netherite_pickaxe', destroy_speed: 1.1 },
          { item: 'effect:bedrock_sword', destroy_speed: 0.05 },
        ],
      },
      'minecraft:destructible_by_explosion': { explosion_resistance: 999.0 },
      'minecraft:light_dampening': 15,
      'minecraft:light_emission': 4,
      'minecraft:map_color': '#e8f4ff',
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:material_instances': {
        '*': {
          texture: 'quartz_diamond_block',
          render_method: 'opaque',
          ambient_occlusion: 1.0,
          face_dimming: true,
        },
      },
      'effect99:quartz_diamond_block': {},
    },
  },
});

// 4.4 `effect99:quartz_diamond_ore` (Requires Iron/Diamond/Netherite Pickaxe or Bedrock Sword + arcane backlash + XP, exact 2.8.8!)
writeJson(path.join(BP, 'blocks/quartz_diamond_ore.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:quartz_diamond_ore',
      menu_category: {
        category: 'nature',
        group: 'minecraft:itemGroup.name.ore',
      },
    },
    components: {
      'minecraft:display_name': 'tile.effect99:quartz_diamond_ore.name',
      'minecraft:destructible_by_mining': {
        seconds_to_destroy: 15.0,
        item_specific_speeds: [
          { item: 'minecraft:iron_pickaxe', destroy_speed: 1.8 },
          { item: 'minecraft:diamond_pickaxe', destroy_speed: 1.3 },
          { item: 'minecraft:netherite_pickaxe', destroy_speed: 1.0 },
          { item: 'effect:bedrock_sword', destroy_speed: 0.05 },
        ],
      },
      'minecraft:destructible_by_explosion': { explosion_resistance: 999.0 },
      'minecraft:light_dampening': 15,
      'minecraft:light_emission': 3,
      'minecraft:map_color': '#b8d8e8',
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:material_instances': {
        '*': {
          texture: 'quartz_diamond_ore',
          render_method: 'opaque',
          ambient_occlusion: 1.0,
          face_dimming: true,
        },
      },
      'effect99:quartz_diamond_ore': {},
    },
  },
});

// 4.5 `effect99:silver_ore` (Requires Iron/Diamond/Netherite Pickaxe or Bedrock Sword, exact 2.8.8!)
writeJson(path.join(BP, 'blocks/silver_ore.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:silver_ore',
      menu_category: {
        category: 'nature',
        group: 'minecraft:itemGroup.name.ore',
      },
    },
    components: {
      'minecraft:display_name': 'tile.effect99:silver_ore.name',
      'minecraft:destructible_by_mining': {
        seconds_to_destroy: 12.0,
        item_specific_speeds: [
          { item: 'minecraft:iron_pickaxe', destroy_speed: 1.3 },
          { item: 'minecraft:diamond_pickaxe', destroy_speed: 0.9 },
          { item: 'minecraft:netherite_pickaxe', destroy_speed: 0.75 },
          { item: 'effect:bedrock_sword', destroy_speed: 0.05 },
        ],
      },
      'minecraft:destructible_by_explosion': { explosion_resistance: 6.0 },
      'minecraft:light_dampening': 15,
      'minecraft:light_emission': 0,
      'minecraft:map_color': '#c0c8d0',
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:material_instances': {
        '*': {
          texture: 'silver_ore',
          render_method: 'opaque',
          ambient_occlusion: 1.0,
          face_dimming: true,
        },
      },
      'effect99:silver_ore': {},
    },
  },
});

// 4.6 `effect99:sapling3` (Instant giant jungle tree from Jungle Sword)
writeJson(path.join(BP, 'blocks/sapling3.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:sapling3',
      menu_category: { category: 'none', is_hidden_in_commands: false },
    },
    components: {
      'minecraft:display_name': 'tile.effect99:sapling3.name',
      'minecraft:collision_box': false,
      'minecraft:selection_box': {
        origin: [-6, 0, -6],
        size: [12, 12, 12],
      },
      'minecraft:destructible_by_mining': { seconds_to_destroy: 0.0 },
      'minecraft:destructible_by_explosion': { explosion_resistance: 0.0 },
      'minecraft:light_dampening': 0,
      'minecraft:light_emission': 0,
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:geometry': 'minecraft:geometry.cross',
      'minecraft:material_instances': {
        '*': {
          texture: 'sapling_jungle',
          render_method: 'alpha_test',
          ambient_occlusion: 0.0,
          face_dimming: false,
        },
      },
      'minecraft:tick': {
        interval_range: [2, 4],
        looping: false,
      },
      'effect99:sapling3': {},
    },
  },
});

// 4.7 `effect99:spectral_block` (Dimensional X-Ray block with semi-transparent blend & exact original block restoration!)
writeJson(path.join(BP, 'blocks/spectral_block.json'), {
  format_version: '1.26.0',
  'minecraft:block': {
    description: {
      identifier: 'effect99:spectral_block',
      menu_category: { category: 'none', is_hidden_in_commands: true },
      states: {
        'effect99:origin': ['stone', 'deepslate', 'netherrack', 'end_stone'],
      },
    },
    components: {
      'minecraft:destructible_by_mining': false,
      'minecraft:destructible_by_explosion': { explosion_resistance: 999.0 },
      'minecraft:light_dampening': 0,
      'minecraft:light_emission': 0,
      'minecraft:loot': 'loot_tables/empty.json',
      'minecraft:geometry': 'geometry.spectral_block',
      'minecraft:material_instances': {
        '*': {
          texture: 'spectral_block',
          render_method: 'blend',
          ambient_occlusion: 0.0,
          face_dimming: false,
        },
      },
      'minecraft:tick': {
        interval_range: [20, 35],
        looping: true,
      },
      'effect99:spectral_block': {},
    },
  },
});

// ---------------------------------------------------------------------------
// 5. Modernize all 17 Original Recipes (`1.20.10`)
// ---------------------------------------------------------------------------
for (const fileName of fs.readdirSync(path.join(SRC_288_BP, 'recipes')).sort()) {
  const raw = jsonc.parse(fs.readFileSync(path.join(SRC_288_BP, 'recipes', fileName), 'utf8'));
  raw.format_version = '1.20.10';

  if (raw['minecraft:recipe_shaped']) {
    const r = raw['minecraft:recipe_shaped'];
    // Fix `clock_sword.json` broken key `" "` -> `"X"`
    if (fileName === 'clock_sword.json') {
      r.pattern = ['GGG', 'GCG', 'XSX'];
      r.key = {
        G: { item: 'minecraft:gold_block' },
        C: { item: 'minecraft:clock' },
        S: { item: 'minecraft:golden_sword' },
        X: { item: 'minecraft:gold_ingot' },
      };
    }
    // Strip legacy `data: 0` from keys & result
    for (const k of Object.keys(r.key)) {
      if (r.key[k] && typeof r.key[k] === 'object') {
        delete r.key[k].data;
      }
    }
    if (r.result && typeof r.result === 'object') {
      delete r.result.data;
    }
    // Add unlock context so recipe shows up in the 1.20.10+ Recipe Book!
    const firstKey = Object.values(r.key)[0];
    if (firstKey?.item) {
      r.unlock = [{ item: firstKey.item }];
    }
  } else if (raw['minecraft:recipe_shapeless']) {
    const r = raw['minecraft:recipe_shapeless'];
    for (const ing of r.ingredients) {
      delete ing.data;
    }
    if (r.result && typeof r.result === 'object') {
      delete r.result.data;
    }
    if (r.ingredients[0]?.item) {
      r.unlock = [{ item: r.ingredients[0].item }];
    }
  } else if (raw['minecraft:recipe_furnace']) {
    const r = raw['minecraft:recipe_furnace'];
    if (typeof r.input === 'object') delete r.input.data;
    if (typeof r.output === 'object') delete r.output.data;
    const inItem = typeof r.input === 'string' ? r.input : r.input.item;
    r.unlock = [{ item: inItem }];
  }

  writeJson(path.join(BP, 'recipes', fileName), raw);
}

// ---------------------------------------------------------------------------
// 6. Modern `1.21.10` Worldgen (`features/` & `feature_rules/`) — Stone, Deepslate & End!
// ---------------------------------------------------------------------------
writeJson(path.join(BP, 'features/quartz_diamond_ore_feature.json'), {
  format_version: '1.21.10',
  'minecraft:ore_feature': {
    description: {
      identifier: 'effect99:quartz_diamond_ore_feature',
    },
    count: 4,
    replace_rules: [
      {
        places_block: 'effect99:quartz_diamond_ore',
        may_replace: [
          'minecraft:stone',
          'minecraft:deepslate',
          'minecraft:tuff',
          'minecraft:granite',
          'minecraft:diorite',
          'minecraft:andesite',
          'minecraft:end_stone',
        ],
      },
    ],
  },
});

writeJson(path.join(BP, 'features/silver_ore_feature.json'), {
  format_version: '1.21.10',
  'minecraft:ore_feature': {
    description: {
      identifier: 'effect99:silver_ore_feature',
    },
    count: 7,
    replace_rules: [
      {
        places_block: 'effect99:silver_ore',
        may_replace: [
          'minecraft:stone',
          'minecraft:deepslate',
          'minecraft:tuff',
          'minecraft:granite',
          'minecraft:diorite',
          'minecraft:andesite',
        ],
      },
    ],
  },
});

writeJson(path.join(BP, 'feature_rules/quartz_diamond_ore_overworld_rule.json'), {
  format_version: '1.21.10',
  'minecraft:feature_rules': {
    description: {
      identifier: 'effect99:quartz_diamond_ore_overworld_rule',
      places_feature: 'effect99:quartz_diamond_ore_feature',
    },
    conditions: {
      placement_pass: 'underground_pass',
      'minecraft:biome_filter': [
        { test: 'has_biome_tag', operator: '==', value: 'overworld' },
      ],
    },
    distribution: {
      iterations: 4,
      x: { distribution: 'uniform', extent: [0, 15] },
      y: { distribution: 'triangle', extent: [-63, 16] },
      z: { distribution: 'uniform', extent: [0, 15] },
    },
  },
});

writeJson(path.join(BP, 'feature_rules/quartz_diamond_ore_end_rule.json'), {
  format_version: '1.21.10',
  'minecraft:feature_rules': {
    description: {
      identifier: 'effect99:quartz_diamond_ore_end_rule',
      places_feature: 'effect99:quartz_diamond_ore_feature',
    },
    conditions: {
      placement_pass: 'underground_pass',
      'minecraft:biome_filter': [
        { test: 'has_biome_tag', operator: '==', value: 'the_end' },
      ],
    },
    distribution: {
      iterations: 3,
      x: { distribution: 'uniform', extent: [0, 15] },
      y: { distribution: 'uniform', extent: [4, 32] },
      z: { distribution: 'uniform', extent: [0, 15] },
    },
  },
});

writeJson(path.join(BP, 'feature_rules/silver_ore_overworld_rule.json'), {
  format_version: '1.21.10',
  'minecraft:feature_rules': {
    description: {
      identifier: 'effect99:silver_ore_overworld_rule',
      places_feature: 'effect99:silver_ore_feature',
    },
    conditions: {
      placement_pass: 'underground_pass',
      'minecraft:biome_filter': [
        { test: 'has_biome_tag', operator: '==', value: 'overworld' },
      ],
    },
    distribution: {
      iterations: 9,
      x: { distribution: 'uniform', extent: [0, 15] },
      y: { distribution: 'uniform', extent: [-58, 35] },
      z: { distribution: 'uniform', extent: [0, 15] },
    },
  },
});

// ---------------------------------------------------------------------------
// 7. Custom + Rebased `1.26.60` Loot Tables & Villager Trades
// ---------------------------------------------------------------------------
// 7.1 Custom Loot Tables (clean, zero deprecated `set_data`)
const customLootTables = {
  'empty.json': { pools: [] },
  'bee_sword.json': {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: 'effect:bee_sword', weight: 1 }] }],
  },
  'pumpkin_sword.json': {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: 'effect:cursed_pumpkin_sword', weight: 1 }] }],
  },
  'blocks/quartz_diamond_block.json': {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: 'effect99:quartz_diamond_block', weight: 1 }] }],
  },
  'blocks/silver_ore.json': {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: 'effect99:silver_ore', weight: 1 }] }],
  },
  'blocks/quartz_diamond_ore.json': {
    pools: [
      {
        rolls: 1,
        entries: [
          { type: 'item', name: 'effect:quartz_diamond', weight: 89, functions: [{ function: 'set_count', count: { min: 1, max: 1 } }] },
          { type: 'item', name: 'effect:quartz_diamond', weight: 10, functions: [{ function: 'set_count', count: { min: 1, max: 2 } }] },
          { type: 'item', name: 'effect:quartz_diamond', weight: 1, functions: [{ function: 'set_count', count: { min: 2, max: 4 } }] },
        ],
      },
    ],
  },
  'entities/living_flame.json': {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: 'effect:fire_sword', weight: 1 }] }],
  },
  'entities/red_enderman.json': {
    pools: [
      {
        conditions: [
          { condition: 'killed_by_player' },
          { condition: 'random_chance_with_looting', chance: 0.025, looting_multiplier: 0.02 },
        ],
        rolls: 1,
        entries: [{ type: 'item', name: 'effect:ender_sword', weight: 1 }],
      },
      {
        rolls: 1,
        entries: [
          {
            type: 'item',
            name: 'minecraft:ender_pearl',
            weight: 1,
            functions: [
              { function: 'set_count', count: { min: 1, max: 2 } },
              { function: 'looting_enchant', count: { min: 0, max: 1 } },
            ],
          },
        ],
      },
    ],
  },
  'entities/slime_king.json': {
    pools: [
      {
        conditions: [
          { condition: 'killed_by_player' },
          { condition: 'random_chance_with_looting', chance: 0.04, looting_multiplier: 0.02 },
        ],
        rolls: 1,
        entries: [{ type: 'item', name: 'effect:slime_sword', weight: 1 }],
      },
      {
        rolls: 1,
        entries: [
          {
            type: 'item',
            name: 'minecraft:slime_ball',
            weight: 1,
            functions: [
              { function: 'set_count', count: { min: 8, max: 16 } },
              { function: 'looting_enchant', count: { min: 0, max: 4 } },
            ],
          },
        ],
      },
    ],
  },
};

for (const [rel, data] of Object.entries(customLootTables)) {
  writeJson(path.join(BP, 'loot_tables', rel), data);
}

// 7.1b Grass Witch loot table = vanilla Witch drops + 20% Grass Sword drop (exact 2.8.8!)
{
  const grassWitchLoot = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables/entities/witch.json'), 'utf8'));
  grassWitchLoot.pools.push({
    conditions: [
      { condition: 'killed_by_player' },
      { condition: 'random_chance_with_looting', chance: 0.2, looting_multiplier: 0.05 },
    ],
    rolls: 1,
    entries: [{ type: 'item', name: 'effect:grass_sword', weight: 1 }],
  });
  writeJson(path.join(BP, 'loot_tables/entities/grass_witch.json'), grassWitchLoot);
}

// Remove stale `gameplay/fishing/treasure.json` override so regular Ocean/River fishing stays 100% vanilla,
// while Jungle biome fishing (`gameplay/jungle_fishing.json` -> `jungle_treasure.json`) drops `effect:jungle_sword`!
const staleTreasurePath = path.join(BP, 'loot_tables/gameplay/fishing/treasure.json');
if (fs.existsSync(staleTreasurePath)) {
  fs.unlinkSync(staleTreasurePath);
}
{
  const jungleTreasure = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables/gameplay/fishing/treasure.json'), 'utf8'));
  jungleTreasure.pools[0].entries.push({ type: 'item', name: 'effect:jungle_sword', weight: 5 });
  writeJson(path.join(BP, 'loot_tables/gameplay/fishing/jungle_treasure.json'), jungleTreasure);

  const jungleFishing = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables/gameplay/jungle_fishing.json'), 'utf8'));
  for (const entry of jungleFishing.pools[0].entries) {
    if (entry.name === 'loot_tables/gameplay/fishing/treasure.json') {
      entry.name = 'loot_tables/gameplay/fishing/jungle_treasure.json';
    }
  }
  writeJson(path.join(BP, 'loot_tables/gameplay/jungle_fishing.json'), jungleFishing);
}

// 7.2 Rebase ONLY the modified vanilla chest loot tables onto Mojang v1.26.60!
// This preserves 100% of 1.20–1.26 Armor Trims, Pottery Sherds, Bundles, Heart of the Sea & Starter Tools!
const chestInjections = [
  ['chests/abandoned_mineshaft.json', 1, [{ type: 'item', name: 'effect:spider_sword', weight: 5 }]],
  ['chests/desert_pyramid.json', 0, [{ type: 'item', name: 'effect:tnt_sword', weight: 15 }]],
  ['chests/igloo_chest.json', 0, [{ type: 'item', name: 'effect:ice_sword', weight: 4 }]],
  ['chests/jungle_temple.json', 0, [{ type: 'item', name: 'effect:jungle_sword', weight: 25 }]],
  ['chests/pillager_outpost.json', 1, [
    { type: 'item', name: 'effect:emerald_sword', weight: 2 },
    { type: 'item', name: 'effect:lapis_sword', weight: 3 },
  ]],
  ['chests/stronghold_corridor.json', 0, [
    { type: 'item', name: 'effect:emerald_sword', weight: 10 },
    { type: 'item', name: 'effect:lapis_sword', weight: 12 },
  ]],
  ['chests/stronghold_library.json', 0, [{ type: 'item', name: 'effect:lapis_sword', weight: 15 }]],
  ['chests/underwater_ruin_big.json', 0, [{ type: 'item', name: 'effect:magma_sword', weight: 3 }]],
  ['chests/village/village_snowy_house.json', 0, [{ type: 'item', name: 'effect:ice_sword', weight: 4 }]],
  ['chests/woodland_mansion.json', 0, [{ type: 'item', name: 'effect:emerald_sword', weight: 35 }]],
];

for (const [rel, poolIdx, entries] of chestInjections) {
  const base = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables', rel), 'utf8'));
  const targetPool = base.pools[Math.min(poolIdx, base.pools.length - 1)];
  targetPool.entries.push(...entries);
  writeJson(path.join(BP, 'loot_tables', rel), base);
}

// Dedicated bonus pools for `buriedtreasure.json` & `spawn_bonus_chest.json` so guaranteed `heart_of_the_sea` & starter axe are NEVER overwritten!
{
  const bt = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables/chests/buriedtreasure.json'), 'utf8'));
  bt.pools.push({
    rolls: 1,
    conditions: [{ condition: 'random_chance', chance: 0.35 }],
    entries: [{ type: 'item', name: 'effect:sea_sword', weight: 1 }],
  });
  writeJson(path.join(BP, 'loot_tables/chests/buriedtreasure.json'), bt);

  const sbc = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables/chests/spawn_bonus_chest.json'), 'utf8'));
  sbc.pools.push({
    rolls: 1,
    conditions: [{ condition: 'random_chance', chance: 0.35 }],
    entries: [{ type: 'item', name: 'effect:coal_sword', weight: 1 }],
  });
  writeJson(path.join(BP, 'loot_tables/chests/spawn_bonus_chest.json'), sbc);
}

// Rebase entity loot tables (`elder_guardian`, `shulker`, `wither_skeleton`) onto v1.26.60
// Note: Blaze killed by Snow Golem (0.5%) is handled cleanly in `worldEvents.ts` so snowball kills are 100% reliable without double-rolling!
const staleBlazeLoot = path.join(BP, 'loot_tables/entities/blaze.json');
if (fs.existsSync(staleBlazeLoot)) {
  fs.unlinkSync(staleBlazeLoot);
}
const entityPoolAdditions = [
  ['entities/elder_guardian.json', {
    conditions: [
      { condition: 'killed_by_player' },
      { condition: 'random_chance_with_looting', chance: 0.065, looting_multiplier: 0.02 },
    ],
    rolls: 1,
    entries: [{ type: 'item', name: 'effect:sponge_sword', weight: 1 }],
  }],
  ['entities/shulker.json', {
    conditions: [
      { condition: 'killed_by_player' },
      { condition: 'random_chance_with_looting', chance: 0.045, looting_multiplier: 0.02 },
    ],
    rolls: 1,
    entries: [{ type: 'item', name: 'effect:shulker_sword', weight: 1 }],
  }],
  ['entities/wither_skeleton.json', {
    conditions: [
      { condition: 'killed_by_player' },
      { condition: 'random_chance_with_looting', chance: 0.025, looting_multiplier: 0.02 },
    ],
    rolls: 1,
    entries: [{ type: 'item', name: 'effect:wither_skeleton_sword', weight: 1 }],
  }],
];

for (const [rel, pool] of entityPoolAdditions) {
  const base = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'loot_tables', rel), 'utf8'));
  base.pools.push(pool);
  writeJson(path.join(BP, 'loot_tables', rel), base);
}

// 7.3 Rebase Master Weaponsmith Trades (`effect:emerald_sword`) onto v1.26.60.5
const econWeaponsmith = jsonc.parse(fs.readFileSync(path.join(VANILLA_BP, 'trading/economy_trades/weapon_smith_trades.json'), 'utf8'));
econWeaponsmith.tiers[econWeaponsmith.tiers.length - 1].groups.push({
  num_to_select: 1,
  trades: [
    {
      wants: [{ item: 'minecraft:emerald_block', quantity: 32, price_multiplier: 0.0 }],
      gives: [
        {
          item: 'effect:emerald_sword',
          quantity: 1,
          functions: [
            { function: 'enchant_with_levels', treasure: false, levels: { min: 5, max: 60 } },
          ],
        },
      ],
      trader_exp: 30,
      max_uses: 2,
      reward_exp: true,
    },
  ],
});
writeJson(path.join(BP, 'trading/economy_trades/weapon_smith_trades.json'), econWeaponsmith);

// ---------------------------------------------------------------------------
// 8. Spawn Rules (`alpha_wolf`, `ghost`, `living_flame`, `slime_king`) — Updated for 1.26!
// ---------------------------------------------------------------------------
writeJson(path.join(BP, 'spawn_rules/alpha_wolf.json'), {
  format_version: '1.8.0',
  'minecraft:spawn_rules': {
    description: {
      identifier: 'entity:alpha_wolf',
      population_control: 'monster',
    },
    conditions: [
      {
        'minecraft:spawns_on_surface': {},
        'minecraft:spawns_on_block_filter': ['minecraft:grass_block', 'minecraft:podzol', 'minecraft:snow_layer'],
        'minecraft:brightness_filter': { min: 0, max: 7, adjust_for_weather: true },
        'minecraft:spawn_event': { event: 'effect:natural_spawn' },
        'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
        'minecraft:weight': { default: 10 },
        'minecraft:herd': { min_size: 1, max_size: 1 },
        'minecraft:biome_filter': {
          all_of: [
            { test: 'has_biome_tag', operator: '==', value: 'taiga' },
            { test: 'has_biome_tag', operator: '!=', value: 'mega' },
          ],
        },
      },
    ],
  },
});

writeJson(path.join(BP, 'spawn_rules/ghost.json'), {
  format_version: '1.8.0',
  'minecraft:spawn_rules': {
    description: {
      identifier: 'entity:ghost',
      population_control: 'monster',
    },
    conditions: [
      {
        'minecraft:spawns_underground': {},
        'minecraft:spawns_on_block_filter': ['minecraft:stone', 'minecraft:deepslate', 'minecraft:tuff'],
        'minecraft:brightness_filter': { min: 0, max: 7, adjust_for_weather: true },
        'minecraft:spawn_event': { event: 'ghost_wailing' },
        'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
        'minecraft:weight': { default: 100 },
        'minecraft:herd': { min_size: 1, max_size: 2 },
        'minecraft:biome_filter': { test: 'has_biome_tag', operator: '==', value: 'monster' },
      },
      {
        'minecraft:spawns_on_surface': {},
        'minecraft:spawns_on_block_filter': ['minecraft:grass_block', 'minecraft:stone'],
        'minecraft:brightness_filter': { min: 0, max: 7, adjust_for_weather: true },
        'minecraft:spawn_event': { event: 'ghost_wailing' },
        'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
        'minecraft:weight': { default: 50 },
        'minecraft:density_limit': { surface: 3 },
        'minecraft:biome_filter': { test: 'has_biome_tag', operator: '==', value: 'monster' },
      },
    ],
  },
});

writeJson(path.join(BP, 'spawn_rules/living_flame.json'), {
  format_version: '1.8.0',
  'minecraft:spawn_rules': {
    description: {
      identifier: 'entity:living_flame',
      population_control: 'monster',
    },
    conditions: [
      {
        'minecraft:spawns_underground': {},
        'minecraft:spawns_on_surface': {},
        'minecraft:spawn_event': { event: 'hostile_entity' },
        'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
        'minecraft:weight': { default: 20 },
        'minecraft:herd': { min_size: 1, max_size: 4 },
        'minecraft:biome_filter': { test: 'has_biome_tag', operator: '==', value: 'nether' },
      },
    ],
  },
});

writeJson(path.join(BP, 'spawn_rules/slime_king.json'), {
  format_version: '1.8.0',
  'minecraft:spawn_rules': {
    description: {
      identifier: 'entity:slime_king',
      population_control: 'monster',
    },
    conditions: [
      {
        'minecraft:spawns_on_surface': {},
        'minecraft:brightness_filter': { min: 0, max: 7, adjust_for_weather: true },
        'minecraft:difficulty_filter': { min: 'easy', max: 'hard' },
        'minecraft:weight': { default: 10 },
        'minecraft:biome_filter': {
          any_of: [
            { test: 'has_biome_tag', operator: '==', value: 'swamp' },
            { test: 'has_biome_tag', operator: '==', value: 'mangrove_swamp' },
          ],
        },
      },
    ],
  },
});

// ---------------------------------------------------------------------------
// 9. `/function give` (`packs/Swords_B/functions/give.mcfunction`)
// ---------------------------------------------------------------------------
const giveLines = [
  'give @s effect:blaze_sword 1',
  'give @s effect:coal_sword 1',
  'give @s effect:shulker_sword 1',
  'give @s effect:spider_sword 1',
  'give @s effect:jungle_sword 1',
  'give @s effect:cactus_sword 1',
  'give @s effect:slime_sword 1',
  'give @s effect:emerald_sword 1',
  'give @s effect:spectral_sword 1',
  'give @s effect:lapis_sword 1',
  'give @s effect:sea_sword 1',
  'give @s effect:grass_sword 1',
  'give @s effect:ice_sword 1',
  'give @s effect:obsidian_sword 1',
  'give @s effect:glowstone_sword 1',
  'give @s effect:time_sword 1',
  'give @s effect:creeper_sword 1',
  'give @s effect:fire_sword 1',
  'give @s effect:magma_sword 1',
  'give @s effect:wither_sword 1',
  'give @s effect:tnt_sword 1',
  'give @s effect:lightning_sword 1',
  'give @s effect:ender_sword 1',
  'give @s effect:sponge_sword 1',
  'give @s effect:wet_sponge_sword 1',
  'give @s effect:bone_sword 1',
  'give @s effect:quartz_sword 1',
  'give @s effect:glass_sword 1',
  'give @s effect:wither_skeleton_sword 1',
  'give @s effect:ultra_instinct_sword 1',
  'give @s effect:wolf_sword 1',
  'give @s effect:silver_sword 1',
  'give @s effect:nether_star_sword 1',
  'give @s effect:bedrock_sword 1',
  'give @s effect:ghost_sword 1',
  'give @s effect:clock_sword 1',
  'give @s effect:bee_sword 1',
  'give @s effect:cursed_pumpkin_sword 1',
  'give @s effect:silver_ingot 16',
  'give @s effect:quartz_diamond 16',
  'give @s effect:quartz_diamond_stick 4',
  'give @s effect:bedrock_stick 4',
  'give @s effect99:quartz_diamond_block 16',
  'give @s effect99:silver_ore 16',
  'give @s effect99:quartz_diamond_ore 16',
];
fs.writeFileSync(path.join(BP, 'functions/give.mcfunction'), giveLines.join('\n') + '\n', 'utf8');

console.log('Step 1 data generation completed successfully!');
