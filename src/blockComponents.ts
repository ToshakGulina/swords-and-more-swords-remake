import {
  BlockComponentRegistry,
  EntityDamageCause,
  GameMode,
  ItemComponentTypes,
  ItemEnchantableComponent,
  ItemStack,
  PlayerBreakBlockAfterEvent,
} from '@minecraft/server';
import { getMainhandItem, getOffhandItem, plantJungleSapling } from './utils.js';

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

// Exact 2.8.8 light footprint. Every sword that lit up ran two `fill` commands
// from its `environment_sensor` trigger and kept re-running them while the sword
// stayed in hand:
//   fill ~1 ~1 ~1 ~-1 ~-1 ~-1 effect99:lightblock 0 replace air
//   fill ~1 ~1 ~1 ~-1 ~-1 ~-1 effect99:lightblock 0 replace effect99:lightblock
// i.e. a 3x3x3 cube around the player's feet, so `yOffset` is measured from
// `player.location` (feet) exactly like the selector origin. Ultra Instinct and
// Wither used `~1 ~2 ~1 ~-1 ~2 ~-1`: the same 3x3 footprint, one layer only, one
// block above the player's feet.
// Each placeholder deletes itself 0.2 s later (`minecraft:ticking` + `setblock air`),
// so the volume is re-filled while the sword is held and clears on its own.
export type LightVolume = { yOffset: number; topOnly: boolean };

const TOP_LAYER_SWORDS = new Set(['effect:ultra_instinct_sword', 'effect:wither_sword']);

export function lightVolumeForSword(mainId: string, offId: string): LightVolume | undefined {
  const lit =
    LIGHT_EMITTING_SWORDS.has(mainId) ||
    offId === 'effect:glowstone_sword' ||
    offId === 'effect:fire_sword';
  if (!lit) return undefined;
  // `fill ~1 ~1 ~1 ~-1 ~-1 ~-1` is centred on the feet, so the cube spans
  // feet-1 .. feet+1; the top-only swords use `~ ~2 ~`, one block above feet.
  return { yOffset: TOP_LAYER_SWORDS.has(mainId) ? 1 : 0, topOnly: TOP_LAYER_SWORDS.has(mainId) };
}

// 2.8.8 `block_light_emission` was a 0-1 fraction: 1 for `lightblock` (Glowstone,
// Fire, Ultra Instinct), 0.5 for `lightblock2` (every other lit sword). The modern
// `minecraft:light_emission` component is an integer 0-15, so the matching values
// are 15 and 7.
export const BRIGHT_LIGHT_TYPE = 'effect99:lightblock';
export const DIM_LIGHT_TYPE = 'effect99:lightblock2';

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
          // 2.8.8 `destroy_block` is a bare `setblock ~ ~ ~ air 0 destroy` — the
          // cage always leaves air, even when it was frozen out of water. The
          // `effect99:from_water` flag is only kept for Frost-Walker bookkeeping;
          // restoring water here would be a remake-only behaviour.
          dimension.playSound('random.glass', block.location, { volume: 0.7, pitch: 1.1 });
          block.setType('minecraft:air');
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
  // Exact 2.8.8 `effect99:sapling3`: the block only exists for a couple of ticks
  // and its event does `playsound dig.grass` + `fill ~ ~ ~ ~ ~ ~ sapling 3`, i.e.
  // it plants a vanilla jungle sapling (data 3) and lets the game grow the tree.
  // Do NOT hand-build a tree here — vanilla decides the shape, and a sapling that
  // cannot grow on the target block simply stays a sapling, exactly as before.
  registry.registerCustomComponent('effect99:sapling3', {
    onPlace(event) {
      plantJungleSapling(event.dimension, event.block.location);
    },
    onTick(event) {
      plantJungleSapling(event.dimension, event.block.location);
    },
  });

  // 4. Stateful Spectral Block (Spectral Sword wall X-ray restoration)
  //
  // 2.8.8 pairs this with `spectral_sword_function_1`, which runs when the sword
  // leaves the hand and puts stone/netherrack/end stone back. Only the Spectral
  // Sword ever creates these blocks — the Ghost Sword has no X-ray in the
  // original (`ghost_movement` is just `movement: 0.14`), so it must not keep
  // the wall transparent either.
  registry.registerCustomComponent('effect99:spectral_block', {
    onTick(event) {
      const { block, dimension } = event;
      try {
        const players = dimension.getPlayers({ location: block.location, maxDistance: 7.5 });
        let activeSpectral = false;
        for (const p of players) {
          const held = getMainhandItem(p)?.typeId;
          if (held === 'effect:spectral_sword') {
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

}

// Use the pre-break snapshot: the tool may have broken or been replaced by
// the time a block custom component's onPlayerBreak callback runs.
export function handleOreBreak(event: PlayerBreakBlockAfterEvent): void {
  const { block, dimension, player, itemStackBeforeBreak: tool } = event;
  const id = event.brokenBlockPermutation.type.id;
  if (!['effect99:silver_ore', 'effect99:quartz_diamond_block', 'effect99:quartz_diamond_ore'].includes(id)) return;
  try {
    if (player.getGameMode() === GameMode.Creative || !tool || !VALID_ORE_MINING_TOOLS.has(tool.typeId)) return;
    const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    if (id === 'effect99:silver_ore') {
      dimension.spawnItem(new ItemStack(id, 1), center);
      return;
    }
    if (id === 'effect99:quartz_diamond_block') {
      dimension.spawnItem(new ItemStack(id, 1), center);
    } else {
      const ench = tool.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
      const silkTouch = ench?.getEnchantment('silk_touch')?.level ?? 0;
      if (silkTouch > 0) {
        dimension.spawnItem(new ItemStack(id, 1), center);
      } else {
        const r = Math.random() * 100;
        let count = r >= 99 ? 2 + Math.floor(Math.random() * 3) : r >= 89 ? 1 + Math.floor(Math.random() * 2) : 1;
        const fortune = ench?.getEnchantment('fortune')?.level ?? 0;
        if (fortune > 0 && Math.random() < fortune * 0.25) count += 1 + Math.floor(Math.random() * fortune);
        dimension.spawnItem(new ItemStack('effect:quartz_diamond', count), center);
        for (let i = 0; i < 6; i++) {
          try { dimension.spawnEntity('minecraft:xp_orb', center); } catch {}
        }
      }
    }
    // Cosmetic failures must not cancel the gameplay backlash.
    try { dimension.spawnParticle('minecraft:knockback_roar_particle', { x: center.x, y: center.y + 0.5, z: center.z }); } catch {}
    try { dimension.playSound('damage.thorns', center, { volume: 1.0, pitch: id === 'effect99:quartz_diamond_block' ? 0.9 : 1.2 }); } catch {}
    const dist = Math.hypot(player.location.x - center.x, player.location.y + 0.9 - center.y, player.location.z - center.z);
    if (dist <= 6.0) player.applyDamage(6, { cause: EntityDamageCause.magic });
  } catch {}
}
