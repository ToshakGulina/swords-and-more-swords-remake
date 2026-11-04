import { BlockPermutation, EntityComponentTypes, EquipmentSlot, GameMode, ItemComponentTypes, MoonPhase, world, } from '@minecraft/server';
export function getMainhandItem(player) {
    try {
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        return eq?.getEquipment(EquipmentSlot.Mainhand);
    }
    catch {
        return undefined;
    }
}
export function getOffhandItem(player) {
    try {
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        return eq?.getEquipment(EquipmentSlot.Offhand);
    }
    catch {
        return undefined;
    }
}
export function consumeMainhandDurability(player, amount) {
    if (amount <= 0)
        return true;
    try {
        if (player.getGameMode() === GameMode.Creative)
            return true;
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        const item = eq?.getEquipment(EquipmentSlot.Mainhand);
        if (!item)
            return false;
        const dur = item.getComponent(ItemComponentTypes.Durability);
        if (!dur)
            return true;
        let actualLoss = 0;
        const ench = item.getComponent(ItemComponentTypes.Enchantable);
        const unbreakingLevel = ench?.getEnchantment('unbreaking')?.level ?? 0;
        for (let i = 0; i < amount; i++) {
            if (unbreakingLevel > 0) {
                // Vanilla weapon Unbreaking formula: chance to take durability damage = 1 / (level + 1)
                if (Math.random() * (unbreakingLevel + 1) >= 1)
                    continue;
            }
            actualLoss++;
        }
        if (actualLoss <= 0)
            return true;
        if (dur.damage + actualLoss >= dur.maxDurability) {
            eq?.setEquipment(EquipmentSlot.Mainhand, undefined);
            player.dimension.playSound('random.break', player.location, { volume: 1.0, pitch: 0.9 + Math.random() * 0.2 });
            return false;
        }
        else {
            dur.damage += actualLoss;
            eq?.setEquipment(EquipmentSlot.Mainhand, item);
            return true;
        }
    }
    catch {
        return false;
    }
}
export function giveOrDropItem(player, itemStack) {
    let pending = itemStack;
    try {
        const inv = player.getComponent(EntityComponentTypes.Inventory);
        if (inv?.container)
            pending = inv.container.addItem(itemStack);
    }
    catch {
        // Inventory unavailable: fall back to dropping the original stack.
    }
    if (!pending)
        return;
    try {
        player.dimension.spawnItem(pending, player.location);
    }
    catch {
        // Never retry with the original stack: part may already be in the inventory.
        try {
            player.dimension.spawnItem(pending, player.location);
        }
        catch { }
    }
}
const PROTECTED_UTILITY_TYPES = new Set([
    'minecraft:item',
    'minecraft:xp_orb',
    'minecraft:npc',
    'minecraft:armor_stand',
    'minecraft:item_frame',
    'minecraft:glow_item_frame',
    'minecraft:painting',
    'minecraft:leash_knot',
    'minecraft:boat',
    'minecraft:chest_boat',
    'minecraft:minecart',
    'minecraft:chest_minecart',
    'minecraft:hopper_minecart',
    'minecraft:tnt_minecart',
    'minecraft:ender_crystal',
    'minecraft:falling_block',
    'minecraft:area_effect_cloud',
    'minecraft:evocation_fang',
    'entity:bee_sword',
]);
export function isProtectedEntity(entity, owner) {
    if (!entity.isValid)
        return true;
    if (owner && entity.id === owner.id)
        return true;
    const typeId = entity.typeId;
    if (PROTECTED_UTILITY_TYPES.has(typeId) || typeId.startsWith('effect:')) {
        return true;
    }
    try {
        // Protect tamed pets (wolves, cats, parrots, horses, etc.)
        if (entity.getComponent('minecraft:is_tamed'))
            return true;
        // Allow AoE sword skills to hit hostile Centella & wild hostile Living Flames, while protecting all player helper entities!
        if (typeId === 'entity:centella')
            return false;
        if (typeId === 'entity:living_flame') {
            return entity.hasTag('player_summoned') || !entity.matches({ families: ['living_flame_hostile'] });
        }
        if (entity.matches({ families: ['effect99_entities'] }))
            return true;
    }
    catch { }
    return false;
}
export function shootCustomProjectile(player, entityId, speed, spawnEvent, forwardOffset = 1.6, inaccuracy = 0) {
    try {
        const head = player.getHeadLocation();
        const dir = player.getViewDirection();
        const spawnPos = {
            x: head.x + dir.x * forwardOffset,
            y: head.y + dir.y * forwardOffset - 0.15,
            z: head.z + dir.z * forwardOffset,
        };
        const proj = spawnEvent
            ? player.dimension.spawnEntity(entityId, spawnPos, { spawnEvent })
            : player.dimension.spawnEntity(entityId, spawnPos);
        proj.addTag('effect_player_shot');
        const vx = dir.x + (inaccuracy > 0 ? (Math.random() - 0.5) * inaccuracy : 0);
        const vy = dir.y + (inaccuracy > 0 ? (Math.random() - 0.5) * inaccuracy : 0);
        const vz = dir.z + (inaccuracy > 0 ? (Math.random() - 0.5) * inaccuracy : 0);
        const projComp = proj.getComponent(EntityComponentTypes.Projectile);
        if (projComp) {
            projComp.owner = player;
            projComp.shoot({ x: vx * speed, y: vy * speed, z: vz * speed });
        }
        else {
            proj.applyImpulse({ x: vx * speed, y: vy * speed, z: vz * speed });
        }
        return proj;
    }
    catch {
        return undefined;
    }
}
export function safeRandomTeleport(entity, minRadius, maxRadius) {
    try {
        const dim = entity.dimension;
        const origin = entity.location;
        const heightRange = dim.heightRange;
        for (let attempt = 0; attempt < 24; attempt++) {
            try {
                const angle = Math.random() * Math.PI * 2;
                const dist = minRadius + Math.random() * (maxRadius - minRadius);
                const tx = Math.floor(origin.x + Math.cos(angle) * dist);
                const tz = Math.floor(origin.z + Math.sin(angle) * dist);
                const startY = Math.min(heightRange.max - 3, Math.floor(origin.y) + 12);
                const endY = Math.max(heightRange.min + 1, Math.floor(origin.y) - 12);
                for (let y = startY; y >= endY; y--) {
                    const below = dim.getBlock({ x: tx, y: y - 1, z: tz });
                    const foot = dim.getBlock({ x: tx, y, z: tz });
                    const head = dim.getBlock({ x: tx, y: y + 1, z: tz });
                    if (!below || !foot || !head)
                        continue;
                    if (!below.isAir &&
                        !below.isLiquid &&
                        below.typeId !== 'minecraft:magma' &&
                        below.typeId !== 'minecraft:cactus' &&
                        below.typeId !== 'effect99:lightblock' &&
                        below.typeId !== 'effect99:lightblock2' &&
                        (foot.isAir ||
                            foot.typeId === 'minecraft:short_grass' ||
                            foot.typeId === 'minecraft:snow_layer' ||
                            foot.typeId === 'effect99:lightblock' ||
                            foot.typeId === 'effect99:lightblock2') &&
                        (head.isAir ||
                            head.typeId === 'effect99:lightblock' ||
                            head.typeId === 'effect99:lightblock2')) {
                        try {
                            dim.spawnParticle('minecraft:portal_directional', entity.location);
                        }
                        catch { }
                        try {
                            dim.playSound('mob.endermen.portal', entity.location, { volume: 1.0, pitch: 1.0 });
                        }
                        catch { }
                        entity.teleport({ x: tx + 0.5, y, z: tz + 0.5 });
                        try {
                            dim.spawnParticle('minecraft:portal_directional', { x: tx + 0.5, y: y + 1.0, z: tz + 0.5 });
                        }
                        catch { }
                        try {
                            dim.playSound('mob.endermen.portal', { x: tx + 0.5, y, z: tz + 0.5 }, { volume: 1.0, pitch: 1.1 });
                        }
                        catch { }
                        return true;
                    }
                }
            }
            catch { } // A single unloaded candidate must not abort the other attempts.
        }
    }
    catch { }
    return false;
}
export function isFullMoonNight() {
    const time = world.getTimeOfDay();
    // Nighttime in Minecraft is roughly 13000..23000, Full Moon is MoonPhase.FullMoon (0)
    return time >= 13000 && time <= 23000 && world.getMoonPhase() === MoonPhase.FullMoon;
}
/**
 * The original `fountain_of_wishes_*` events chain `execute ... detect` checks,
 * so every one of these blocks must match exactly (no count-based shortcut):
 * water at the item and at its 4 neighbours, sandstone directly underneath all
 * five, sandstone four blocks above the item and sandstone on the four upper
 * diagonals two blocks above. Any other shape is not the desert well.
 */
export function isDesertWellWater(dim, loc) {
    const isWater = (id) => id === 'minecraft:water' || id === 'minecraft:flowing_water';
    const isSandstone = (id) => !!id && id.includes('sandstone');
    try {
        const bx = Math.floor(loc.x);
        const by = Math.floor(loc.y);
        const bz = Math.floor(loc.z);
        const idAt = (dx, dy, dz) => dim.getBlock({ x: bx + dx, y: by + dy, z: bz + dz })?.typeId;
        if (!isWater(idAt(0, 0, 0)))
            return false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (!isWater(idAt(dx, 0, dz)))
                return false;
            if (!isSandstone(idAt(dx, -1, dz)))
                return false;
        }
        if (!isSandstone(idAt(0, -1, 0)))
            return false;
        if (!isSandstone(idAt(0, 4, 0)))
            return false;
        for (const [dx, dz] of [[1, 1], [-1, -1], [-1, 1], [1, -1]]) {
            if (!isSandstone(idAt(dx, 2, dz)))
                return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
export function growInstantJungleTree(dim, baseLoc) {
    const bx = Math.floor(baseLoc.x);
    const by = Math.floor(baseLoc.y);
    const bz = Math.floor(baseLoc.z);
    const height = 11 + Math.floor(Math.random() * 5);
    try {
        // 2x2 Giant Jungle Trunk
        for (let y = 0; y < height; y++) {
            for (let dx = 0; dx <= 1; dx++) {
                for (let dz = 0; dz <= 1; dz++) {
                    const block = dim.getBlock({ x: bx + dx, y: by + y, z: bz + dz });
                    if (block && (block.isAir || block.typeId.includes('leaves') || block.typeId === 'effect99:sapling3' || block.typeId.includes('vine'))) {
                        block.setType('minecraft:jungle_log');
                    }
                }
            }
        }
        // Lush Canopy + Hanging Vines
        for (let y = height - 4; y <= height + 1; y++) {
            const layerRadius = y >= height ? 2 : y === height - 1 ? 3 : 4;
            for (let dx = -layerRadius; dx <= layerRadius + 1; dx++) {
                for (let dz = -layerRadius; dz <= layerRadius + 1; dz++) {
                    const dist = Math.hypot(dx - 0.5, dz - 0.5);
                    if (dist <= layerRadius + 0.35) {
                        const leafBlock = dim.getBlock({ x: bx + dx, y: by + y, z: bz + dz });
                        if (leafBlock && leafBlock.isAir) {
                            leafBlock.setType('minecraft:jungle_leaves');
                        }
                    }
                }
            }
        }
        // Add hanging vines around the outer canopy, anchored to adjacent canopy leaves (`vine_direction_bits`)
        for (let dx = -4; dx <= 5; dx++) {
            for (let dz = -4; dz <= 5; dz++) {
                const vx = bx + dx;
                const topY = by + height - 3;
                const vz = bz + dz;
                const topBlock = dim.getBlock({ x: vx, y: topY, z: vz });
                if (!topBlock || !topBlock.isAir || Math.random() >= 0.45)
                    continue;
                let dirBits = 0;
                if (dim.getBlock({ x: vx, y: topY, z: vz + 1 })?.typeId === 'minecraft:jungle_leaves')
                    dirBits |= 1; // South (+Z)
                if (dim.getBlock({ x: vx - 1, y: topY, z: vz })?.typeId === 'minecraft:jungle_leaves')
                    dirBits |= 2; // West (-X)
                if (dim.getBlock({ x: vx, y: topY, z: vz - 1 })?.typeId === 'minecraft:jungle_leaves')
                    dirBits |= 4; // North (-Z)
                if (dim.getBlock({ x: vx + 1, y: topY, z: vz })?.typeId === 'minecraft:jungle_leaves')
                    dirBits |= 8; // East (+X)
                if (dirBits === 0)
                    continue;
                const vinePerm = BlockPermutation.resolve('minecraft:vine', { vine_direction_bits: dirBits });
                const vineLen = 2 + Math.floor(Math.random() * 4);
                for (let vy = 0; vy < vineLen; vy++) {
                    const vb = dim.getBlock({ x: vx, y: topY - vy, z: vz });
                    if (vb && vb.isAir) {
                        vb.setPermutation(vinePerm);
                    }
                    else {
                        break;
                    }
                }
            }
        }
        dim.playSound('block.chorusflower.grow', { x: bx + 0.5, y: by + 2, z: bz + 0.5 }, { volume: 1.0, pitch: 0.9 });
        dim.spawnParticle('minecraft:villager_happy', { x: bx + 0.5, y: by + 1.5, z: bz + 0.5 });
    }
    catch { }
}
// Biomes where precipitation falls as snow (or not at all). Used by both the
// dropped-item rain reaction and the Sponge Sword, matching the original
// `test: in_water_or_rain` semantics as closely as the script API allows.
export function isNonRainingBiome(biomeId) {
    const b = biomeId.toLowerCase();
    return (b.includes('desert') ||
        b.includes('savanna') ||
        b.includes('mesa') ||
        b.includes('badlands') ||
        b.includes('snow') ||
        b.includes('frozen') ||
        b.includes('ice') ||
        b.includes('cold') ||
        b.includes('jagged_peaks') ||
        b.includes('grove'));
}
// `test: in_water_or_rain` replacement: rain in the Overworld, exposed to the
// sky, in a biome that actually rains.
export function isInRain(dimension, location) {
    if (dimension.id !== 'minecraft:overworld')
        return false;
    let raining = false;
    try {
        raining = world.getDynamicProperty('effect:overworld_raining') === true;
    }
    catch {
        return false;
    }
    if (!raining)
        return false;
    try {
        const top = dimension.getTopmostBlock({ x: Math.floor(location.x), z: Math.floor(location.z) });
        if (top && top.location.y > Math.floor(location.y))
            return false;
        return !isNonRainingBiome(dimension.getBiome(location).id);
    }
    catch {
        return false;
    }
}
// `test: is_in_village` replacement. The script API has no village query, so a
// village is recognised by its population: vanilla villages always contain a
// bed-anchored villager cluster, and the Emerald Sword already looks 64 blocks
// out for villagers. Keep the radius conservative so a lone wandering villager
// does not grant Village Hero.
export function isInVillage(player) {
    try {
        const villagers = player.dimension.getEntities({
            location: player.location,
            maxDistance: 32,
            families: ['villager'],
        });
        return villagers.length >= 2;
    }
    catch {
        return false;
    }
}
