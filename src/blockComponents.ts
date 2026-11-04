import {
  BlockComponentRegistry,
  EntityDamageCause,
  GameMode,
  ItemComponentTypes,
  ItemEnchantableComponent,
  ItemStack,
} from '@minecraft/server';
import { getMainhandItem, getOffhandItem, growInstantJungleTree } from './utils.js';

const ORIGIN_MAP: Record<string, string> = {
  stone: 'minecraft:stone',
  deepslate: 'minecraft:deepslate',
  netherrack: 'minecraft:netherrack',
  end_stone: 'minecraft:end_stone',
};

const VALID_ORE_MINING_TOOLS = new Set([
  'minecraft:iron_pickaxe',
  'minecraft:diamond_pickaxe',
  'minecraft:netherite_pickaxe',
  'effect:bedrock_sword',
]);

export const BRIGHT_LIGHT_SWORDS = new Set([
  'effect:glowstone_sword',
  'effect:fire_sword',
  'effect:ultra_instinct_sword',
]);

export const LIGHT_EMITTING_SWORDS = new Set([
  'effect:glowstone_sword',
  'effect:fire_sword',
  'effect:ultra_instinct_sword',
  'effect:blaze_sword',
  'effect:time_sword',
  'effect:lightning_sword',
  'effect:wither_sword',
  'effect:spectral_sword',
]);

export function registerBlockComponents(registry: BlockComponentRegistry): void {
  // 1. Fake Ice (cracking temporary ice cage / Frost Walker ice from Ice Sword, melts after ~8s)
  registry.registerCustomComponent('effect99:fake_ice', {
    onTick(event) {
      const { block, dimension } = event;
      try {
        const stage = (block.permutation.getState('effect99:crack_stage' as never) as number | undefined) ?? 0;
        if (stage < 3) {
          block.setPermutation(block.permutation.withState('effect99:crack_stage' as never, (stage + 1) as never));
        } else {
          const fromWater = Boolean(block.permutation.getState('effect99:from_water' as never));
          dimension.playSound('random.glass', block.location, { volume: 0.7, pitch: 1.1 });
          block.setType(fromWater && dimension.id !== 'minecraft:nether' ? 'minecraft:water' : 'minecraft:air');
        }
      } catch {}
    },
  });

  // 2. Dynamic Light Blocks (Glowstone, Fire, Blaze, Time, Lightning, Wither, Spectral Swords & Centella)
  registry.registerCustomComponent('effect99:lightblock', {
    onTick(event) {
      const { block, dimension } = event;
      try {
        const players = dimension.getPlayers({ location: block.location, maxDistance: 4.0 });
        let keepLight = false;
        for (const p of players) {
          const mainId = getMainhandItem(p)?.typeId ?? '';
          const offId = getOffhandItem(p)?.typeId ?? '';
          if (LIGHT_EMITTING_SWORDS.has(mainId) || offId === 'effect:glowstone_sword' || offId === 'effect:fire_sword') {
            keepLight = true;
            break;
          }
        }
        if (!keepLight) {
          const centellas = dimension.getEntities({
            location: block.location,
            maxDistance: 3.0,
            type: 'entity:centella',
          });
          if (centellas.length === 0) {
            block.setType('minecraft:air');
          }
        }
      } catch {}
    },
  });

  // 3. Instant Giant Jungle Sapling (Jungle Sword)
  registry.registerCustomComponent('effect99:sapling3', {
    onPlace(event) {
      growInstantJungleTree(event.dimension, event.block.location);
    },
    onTick(event) {
      growInstantJungleTree(event.dimension, event.block.location);
    },
  });

  // 4. Stateful Spectral Block (Spectral Sword & Ghost Sword wall X-ray restoration)
  registry.registerCustomComponent('effect99:spectral_block', {
    onTick(event) {
      const { block, dimension } = event;
      try {
        const players = dimension.getPlayers({ location: block.location, maxDistance: 7.5 });
        let activeSpectral = false;
        for (const p of players) {
          const held = getMainhandItem(p)?.typeId;
          if (held === 'effect:spectral_sword' || held === 'effect:ghost_sword') {
            activeSpectral = true;
            break;
          }
        }
        if (!activeSpectral) {
          const originKey = (block.permutation.getState('effect99:origin' as never) as string | undefined) ?? 'stone';
          block.setType(ORIGIN_MAP[originKey] ?? 'minecraft:stone');
        }
      } catch {}
    },
  });

  // 5. Silver Ore (Exact 2.8.8: requires Iron/Diamond/Netherite Pickaxe or Bedrock Sword to drop)
  registry.registerCustomComponent('effect99:silver_ore', {
    onPlayerBreak(event) {
      const { block, dimension, player } = event;
      if (!player || player.getGameMode() === GameMode.Creative) return;
      try {
        const tool = getMainhandItem(player);
        if (!tool || !VALID_ORE_MINING_TOOLS.has(tool.typeId)) return;
        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        dimension.spawnItem(new ItemStack('effect99:silver_ore', 1), center);
      } catch {}
    },
  });

  // 6. Quartz-Diamond Block (Exact 2.8.8: requires Iron+ Pickaxe / Bedrock Sword + 6-block arcane shockwave!)
  registry.registerCustomComponent('effect99:quartz_diamond_block', {
    onPlayerBreak(event) {
      const { block, dimension, player } = event;
      if (!player || player.getGameMode() === GameMode.Creative) return;
      try {
        const tool = getMainhandItem(player);
        if (!tool || !VALID_ORE_MINING_TOOLS.has(tool.typeId)) return;
        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        dimension.spawnItem(new ItemStack('effect99:quartz_diamond_block', 1), center);

        dimension.spawnParticle('minecraft:knockback_roar_particle', {
          x: center.x,
          y: center.y + 0.5,
          z: center.z,
        });
        dimension.playSound('damage.thorns', center, { volume: 1.0, pitch: 0.9 });
        const dist = Math.hypot(
          player.location.x - center.x,
          player.location.y + 0.9 - center.y,
          player.location.z - center.z
        );
        if (dist <= 6.0) {
          player.applyDamage(6, { cause: EntityDamageCause.magic });
        }
      } catch {}
    },
  });

  // 7. Quartz-Diamond Ore (Exact 2.8.8: Iron+ Pickaxe / Bedrock Sword, 89/10/1 drop table, Silk Touch & Fortune, 6 XP orbs, arcane shockwave!)
  registry.registerCustomComponent('effect99:quartz_diamond_ore', {
    onPlayerBreak(event) {
      const { block, dimension, player } = event;
      if (!player || player.getGameMode() === GameMode.Creative) return;
      try {
        const tool = getMainhandItem(player);
        if (!tool || !VALID_ORE_MINING_TOOLS.has(tool.typeId)) return;

        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        const ench = tool.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
        const silkTouch = ench?.getEnchantment('silk_touch')?.level ?? 0;

        if (silkTouch > 0) {
          dimension.spawnItem(new ItemStack('effect99:quartz_diamond_ore', 1), center);
        } else {
          // Exact 2.8.8 loot weights: 89% -> 1, 10% -> 1..2, 1% -> 2..4
          const r = Math.random() * 100;
          let count = 1;
          if (r >= 99) {
            count = 2 + Math.floor(Math.random() * 3);
          } else if (r >= 89) {
            count = 1 + Math.floor(Math.random() * 2);
          }
          const fortune = ench?.getEnchantment('fortune')?.level ?? 0;
          if (fortune > 0 && Math.random() < fortune * 0.25) {
            count += 1 + Math.floor(Math.random() * fortune);
          }
          dimension.spawnItem(new ItemStack('effect:quartz_diamond', count), center);

          for (let i = 0; i < 6; i++) {
            dimension.spawnEntity('minecraft:xp_orb', center);
          }
        }

        // Exact 2.8.8: knockback_roar_particle + 6 magic damage within r=6
        dimension.spawnParticle('minecraft:knockback_roar_particle', {
          x: center.x,
          y: center.y + 0.5,
          z: center.z,
        });
        dimension.playSound('damage.thorns', center, { volume: 1.0, pitch: 1.2 });
        const dist = Math.hypot(
          player.location.x - center.x,
          player.location.y + 0.9 - center.y,
          player.location.z - center.z
        );
        if (dist <= 6.0) {
          player.applyDamage(6, { cause: EntityDamageCause.magic });
        }
      } catch {}
    },
  });
}
