import { EntityDamageCause, GameMode, ItemComponentTypes, ItemStack, } from '@minecraft/server';
import { getMainhandItem, getOffhandItem, plantJungleSapling } from './utils.js';
const ORIGIN_MAP = {
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
export function registerBlockComponents(registry) {
    // 1. Fake Ice (cracking temporary ice cage / Frost Walker ice from Ice Sword, melts after ~8s)
    registry.registerCustomComponent('effect99:fake_ice', {
        onTick(event) {
            const { block, dimension } = event;
            try {
                const stage = block.permutation.getState('effect99:crack_stage') ?? 0;
                if (stage < 3) {
                    block.setPermutation(block.permutation.withState('effect99:crack_stage', (stage + 1)));
                }
                else {
                    const fromWater = Boolean(block.permutation.getState('effect99:from_water'));
                    dimension.playSound('random.glass', block.location, { volume: 0.7, pitch: 1.1 });
                    block.setType(fromWater && dimension.id !== 'minecraft:nether' ? 'minecraft:water' : 'minecraft:air');
                }
            }
            catch { }
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
            }
            catch { }
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
                    const originKey = block.permutation.getState('effect99:origin') ?? 'stone';
                    block.setType(ORIGIN_MAP[originKey] ?? 'minecraft:stone');
                }
            }
            catch { }
        },
    });
}
// Use the pre-break snapshot: the tool may have broken or been replaced by
// the time a block custom component's onPlayerBreak callback runs.
export function handleOreBreak(event) {
    const { block, dimension, player, itemStackBeforeBreak: tool } = event;
    const id = event.brokenBlockPermutation.type.id;
    if (!['effect99:silver_ore', 'effect99:quartz_diamond_block', 'effect99:quartz_diamond_ore'].includes(id))
        return;
    try {
        if (player.getGameMode() === GameMode.Creative || !tool || !VALID_ORE_MINING_TOOLS.has(tool.typeId))
            return;
        const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        if (id === 'effect99:silver_ore') {
            dimension.spawnItem(new ItemStack(id, 1), center);
            return;
        }
        if (id === 'effect99:quartz_diamond_block') {
            dimension.spawnItem(new ItemStack(id, 1), center);
        }
        else {
            const ench = tool.getComponent(ItemComponentTypes.Enchantable);
            const silkTouch = ench?.getEnchantment('silk_touch')?.level ?? 0;
            if (silkTouch > 0) {
                dimension.spawnItem(new ItemStack(id, 1), center);
            }
            else {
                const r = Math.random() * 100;
                let count = r >= 99 ? 2 + Math.floor(Math.random() * 3) : r >= 89 ? 1 + Math.floor(Math.random() * 2) : 1;
                const fortune = ench?.getEnchantment('fortune')?.level ?? 0;
                if (fortune > 0 && Math.random() < fortune * 0.25)
                    count += 1 + Math.floor(Math.random() * fortune);
                dimension.spawnItem(new ItemStack('effect:quartz_diamond', count), center);
                for (let i = 0; i < 6; i++) {
                    try {
                        dimension.spawnEntity('minecraft:xp_orb', center);
                    }
                    catch { }
                }
            }
        }
        // Cosmetic failures must not cancel the gameplay backlash.
        try {
            dimension.spawnParticle('minecraft:knockback_roar_particle', { x: center.x, y: center.y + 0.5, z: center.z });
        }
        catch { }
        try {
            dimension.playSound('damage.thorns', center, { volume: 1.0, pitch: id === 'effect99:quartz_diamond_block' ? 0.9 : 1.2 });
        }
        catch { }
        const dist = Math.hypot(player.location.x - center.x, player.location.y + 0.9 - center.y, player.location.z - center.z);
        if (dist <= 6.0)
            player.applyDamage(6, { cause: EntityDamageCause.magic });
    }
    catch { }
}
