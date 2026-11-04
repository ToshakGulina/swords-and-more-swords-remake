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

export const LIGHT_EMITTING_SWORDS = new Set([
  'effect:glowstone_sword',
  'effect:fire_sword',
  'effect:blaze_sword',
  'effect:time_sword',
  'effect:lightning_sword',
  'effect:wither_sword',
  'effect:spectral_sword',
]);

export function registerBlockComponents(registry: BlockComponentRegistry): void {
  // 1. Fake Ice (cracking temporary ice cage from Ice Sword, melts after ~8s)
  registry.registerCustomComponent('effect99:fake_ice', {
    onTick(event) {
      const { block, dimension } = event;
      try {
        const stage = (block.permutation.getState('effect99:crack_stage' as never) as number | undefined) ?? 0;
        if (stage < 3) {
          block.setPermutation(block.permutation.withState('effect99:crack_stage' as never, (stage + 1) as never));
        } else {
          dimension.playSound('random.glass', block.location, { volume: 0.7, pitch: 1.1 });
          block.setType('minecraft:air');
        }
      } catch {}
    },
  });

  // 2. Dynamic Light Blocks (Glowstone, Fire, Time, Lightning, Wither, Spectral Swords)
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

  // 5. Quartz-Diamond Ore (Close-range magic sting + XP + Fortune bonus)
  registry.registerCustomComponent('effect99:quartz_diamond_ore', {
    onPlayerBreak(event) {
      const { block, dimension, player } = event;
      if (!player) return;
      try {
        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        const dist = Math.hypot(
          player.location.x - center.x,
          player.location.y + 0.9 - center.y,
          player.location.z - center.z
        );

        // Original Effect99 mechanic: mining Quartz-Diamond Ore at close range shocks the miner with magic damage!
        if (player.getGameMode() !== GameMode.Creative && dist < 3.4) {
          player.applyDamage(6, { cause: EntityDamageCause.magic });
          dimension.playSound('mob.guardian.attack', center, { volume: 0.9, pitch: 1.3 });
          dimension.spawnParticle('minecraft:elec_hit_emitter', center);
        }

        if (player.getGameMode() !== GameMode.Creative) {
          const tool = getMainhandItem(player);
          const ench = tool?.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
          const fortune = ench?.getEnchantment('fortune')?.level ?? 0;
          if (fortune > 0 && Math.random() < fortune * 0.25) {
            dimension.spawnItem(new ItemStack('effect:quartz_diamond', 1 + Math.floor(Math.random() * fortune)), center);
          }
          for (let i = 0; i < 3; i++) {
            dimension.spawnEntity('minecraft:xp_orb', center);
          }
        }
      } catch {}
    },
  });
}
