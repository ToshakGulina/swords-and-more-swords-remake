import { EntityComponentTypes, EntityDamageCause, GameMode, ItemStack, Player, system, WeatherType, world, } from '@minecraft/server';
import { getActiveShulkerShieldOwner } from './passiveEngine.js';
import { registerAirSwingEvents } from './swordSkills.js';
import { getMainhandItem, isDesertWellWater, safeRandomTeleport } from './utils.js';
let isRainingOverworld = false;
let lastCentellaDeathTick = -1000;
let lastCentellaDeathLoc;
const manuallyDroppedBedrock = new Set();
const fadingFireSwordTicks = new Map();
function isNonRainingBiome(biomeId) {
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
function convertSurroundingSand(dim, center, targetBlockId) {
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);
    try {
        for (let dx = -8; dx <= 8; dx++) {
            for (let dy = -6; dy <= 5; dy++) {
                for (let dz = -8; dz <= 8; dz++) {
                    const b = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz });
                    if (b && b.typeId === 'minecraft:sand') {
                        b.setType(targetBlockId);
                    }
                }
            }
        }
    }
    catch { }
}
export function registerWorldEvents() {
    // Enable exact 2.8.8 `on_not_hurt_entity` ranged air-swing attacks for all 12 projectile swords!
    registerAirSwingEvents();
    // Restore persisted Overworld rain state across world reloads & track weather changes
    try {
        isRainingOverworld = Boolean(world.getDynamicProperty('effect:overworld_raining'));
    }
    catch { }
    world.afterEvents.weatherChange.subscribe((ev) => {
        if (!ev.dimension || ev.dimension === 'minecraft:overworld' || ev.dimension === 'overworld') {
            isRainingOverworld = ev.newWeather !== WeatherType.Clear;
            try {
                world.setDynamicProperty('effect:overworld_raining', isRainingOverworld);
            }
            catch { }
        }
    });
    // 1. Handle player.json pre-damage dodges & blast-safe Charged Creeper Sword drop
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
        if (ev.id === 'effect:dodge' && ev.sourceEntity instanceof Player) {
            const player = ev.sourceEntity;
            if (ev.message === 'ultra_instinct') {
                safeRandomTeleport(player, 1.0, 3.5);
                try {
                    player.dimension.playSound('mob.endermen.portal', player.location, { volume: 1.0, pitch: 0.6 });
                }
                catch { }
            }
            else if (ev.message === 'ender_always' || ev.message === 'ender_melee') {
                safeRandomTeleport(player, 2.0, 16.0);
            }
        }
        else if (ev.id === 'effect:creeper_sword_drop' && ev.sourceEntity) {
            const dim = ev.sourceEntity.dimension;
            const dropPos = {
                x: ev.sourceEntity.location.x,
                y: ev.sourceEntity.location.y + 0.6,
                z: ev.sourceEntity.location.z,
            };
            system.runTimeout(() => {
                try {
                    dim.spawnItem(new ItemStack('effect:creeper_sword', 1), dropPos);
                }
                catch { }
            }, 6);
        }
        else if (ev.id === 'effect:ender_crystal_exploded' && ev.sourceEntity) {
            const dim = ev.sourceEntity.dimension;
            if (dim.id === 'minecraft:nether' && Math.random() < 0.02) {
                const dropPos = {
                    x: ev.sourceEntity.location.x,
                    y: ev.sourceEntity.location.y + 0.6,
                    z: ev.sourceEntity.location.z,
                };
                // Spawn 6 ticks later so the Ender Crystal's Power-6 explosion has already finished!
                system.runTimeout(() => {
                    try {
                        dim.spawnItem(new ItemStack('effect:spectral_sword', 1), dropPos);
                    }
                    catch { }
                }, 6);
            }
        }
    });
    // 3. Bedrock Block Drop when shattered by Ultra Instinct Projectile or Nether Star Fire Explosion!
    world.afterEvents.blockExplode.subscribe((ev) => {
        try {
            if (ev.explodedBlockPermutation.type.id === 'minecraft:bedrock') {
                const key = `${ev.dimension.id}:${ev.block.location.x},${ev.block.location.y},${ev.block.location.z}`;
                if (manuallyDroppedBedrock.delete(key))
                    return;
                const center = {
                    x: ev.block.location.x + 0.5,
                    y: ev.block.location.y + 0.5,
                    z: ev.block.location.z + 0.5,
                };
                ev.dimension.spawnItem(new ItemStack('minecraft:bedrock', 1), center);
            }
        }
        catch { }
    });
    // 4. Breaking any Pumpkin block (except stem) has a 0.5% (5/1000) chance to drop Cursed Pumpkin Sword!
    world.afterEvents.playerBreakBlock.subscribe((ev) => {
        try {
            const bId = ev.brokenBlockPermutation.type.id;
            if (bId.includes('pumpkin') && !bId.includes('stem') && Math.random() < 0.005) {
                const center = {
                    x: ev.block.location.x + 0.5,
                    y: ev.block.location.y + 0.5,
                    z: ev.block.location.z + 0.5,
                };
                ev.dimension.spawnItem(new ItemStack('effect:cursed_pumpkin_sword', 1), center);
                ev.dimension.playSound('mob.witch.celebrate', center, { volume: 1.0, pitch: 0.8 });
            }
        }
        catch { }
    });
    // 5. Combat reactions: Cactus Sword Thorns & Bee Sting (2% Bee Sword)
    world.afterEvents.entityHurt.subscribe((ev) => {
        const { hurtEntity, damageSource } = ev;
        const attacker = damageSource.damagingEntity;
        try {
            // Cactus Sword natural Thorns recoil when wielder is struck
            if (hurtEntity instanceof Player && attacker && attacker.isValid && attacker.id !== hurtEntity.id) {
                if (getMainhandItem(hurtEntity)?.typeId === 'effect:cactus_sword') {
                    attacker.applyDamage(2, { cause: EntityDamageCause.thorns, damagingEntity: hurtEntity });
                }
            }
            // Angry Bee stinging a player -> 2% chance to drop Bee Stinger (effect:bee_sword)
            if (hurtEntity instanceof Player && attacker?.typeId === 'minecraft:bee') {
                if (Math.random() < 0.02) {
                    hurtEntity.dimension.spawnItem(new ItemStack('effect:bee_sword', 1), attacker.location);
                    hurtEntity.dimension.playSound('random.orb', hurtEntity.location, { volume: 1.0, pitch: 1.2 });
                }
            }
        }
        catch { }
    });
    // 6. Natural Lightning Strike -> 20% Centella spawn + `ultra_instinct_explode` 1.26.60 Bedrock shattering!
    world.afterEvents.entitySpawn.subscribe((ev) => {
        try {
            if (ev.entity.typeId === 'entity:ultra_instinct_explode') {
                // In 1.26.60+, C++ `minecraft:explode` no longer breaks `minecraft:bedrock` (blast resistance 3,600,000),
                // so carve non-void-floor bedrock in radius 2.6 and spawn collectible `minecraft:bedrock` items post-blast!
                if (world.gameRules.mobGriefing === false)
                    return;
                const dim = ev.entity.dimension;
                const loc = ev.entity.location;
                const cx = Math.floor(loc.x);
                const cy = Math.floor(loc.y);
                const cz = Math.floor(loc.z);
                const minSafeY = dim.id === 'minecraft:the_end' ? dim.heightRange.min : dim.heightRange.min + 1;
                const brokenDrops = [];
                for (let dx = -2; dx <= 2; dx++) {
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dz = -2; dz <= 2; dz++) {
                            if (dx * dx + dy * dy + dz * dz > 7)
                                continue;
                            const bx = cx + dx;
                            const by = cy + dy;
                            const bz = cz + dz;
                            if (by < minSafeY)
                                continue;
                            const b = dim.getBlock({ x: bx, y: by, z: bz });
                            if (b && b.typeId === 'minecraft:bedrock') {
                                const key = `${dim.id}:${bx},${by},${bz}`;
                                manuallyDroppedBedrock.add(key);
                                b.setType('minecraft:air');
                                brokenDrops.push({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
                            }
                        }
                    }
                }
                if (brokenDrops.length > 0) {
                    dim.playSound('random.anvil_break', loc, { volume: 1.2, pitch: 0.6 });
                    system.runTimeout(() => {
                        for (const dropPos of brokenDrops) {
                            try {
                                dim.spawnItem(new ItemStack('minecraft:bedrock', 1), dropPos);
                            }
                            catch { }
                        }
                        manuallyDroppedBedrock.clear();
                    }, 5);
                }
                return;
            }
            if (ev.entity.typeId === 'minecraft:lightning_bolt') {
                const dim = ev.entity.dimension;
                const loc = ev.entity.location;
                // Skip lightning bolts summoned by a dying Centella or by a Lightning Sword wielder
                if (system.currentTick - lastCentellaDeathTick <= 10 &&
                    lastCentellaDeathLoc &&
                    Math.hypot(loc.x - lastCentellaDeathLoc.x, loc.z - lastCentellaDeathLoc.z) < 6) {
                    return;
                }
                const nearbyHolder = dim
                    .getPlayers({ location: loc, maxDistance: 64 })
                    .some((p) => getMainhandItem(p)?.typeId === 'effect:lightning_sword');
                if (!nearbyHolder && Math.random() < 0.2) {
                    dim.spawnEntity('entity:centella', loc);
                }
            }
        }
        catch { }
    });
    // 7. Special Mob & Boss Sword Drops on Death + Shulker Shield destruction penalty!
    world.afterEvents.entityDie.subscribe((ev) => {
        const { deadEntity, damageSource } = ev;
        const killer = damageSource.damagingEntity;
        const proj = damageSource.damagingProjectile;
        const dim = deadEntity.dimension;
        const loc = deadEntity.location;
        try {
            switch (deadEntity.typeId) {
                case 'entity:shulker_shield': {
                    // Exact 2.8.8: "if they destroy the shell with you inside you will die too."
                    const owner = getActiveShulkerShieldOwner(deadEntity.id);
                    if (owner && owner.isValid && owner.getGameMode() !== GameMode.Creative) {
                        owner.kill();
                    }
                    break;
                }
                case 'entity:alpha_wolf': {
                    // Drops Wolf Sword (10%) when slain with Silver Sword!
                    const usedSilver = deadEntity.hasTag('hit_by_silver') ||
                        (killer instanceof Player && getMainhandItem(killer)?.typeId === 'effect:silver_sword');
                    if (usedSilver && Math.random() < 0.1) {
                        dim.spawnItem(new ItemStack('effect:wolf_sword', 1), loc);
                    }
                    break;
                }
                case 'minecraft:wither': {
                    // Kill the Wither with Nether Star Sword -> 25% chance to drop Wither Sword (5% otherwise)!
                    const usedNetherStar = deadEntity.hasTag('slain_by_nether_star_sword') ||
                        (killer instanceof Player && getMainhandItem(killer)?.typeId === 'effect:nether_star_sword');
                    if (Math.random() < (usedNetherStar ? 0.25 : 0.05)) {
                        dim.spawnItem(new ItemStack('effect:wither_sword', 1), loc);
                    }
                    break;
                }
                case 'entity:centella': {
                    lastCentellaDeathTick = system.currentTick;
                    lastCentellaDeathLoc = { ...loc };
                    // Exact 2.8.8: 2% Lightning Sword drop when killed by a player (works for both melee and Bow/Trident, spawned post-lightning!)
                    if (killer instanceof Player && Math.random() < 0.02) {
                        const dropLoc = { x: loc.x, y: loc.y + 1.0, z: loc.z };
                        system.runTimeout(() => {
                            try {
                                dim.spawnItem(new ItemStack('effect:lightning_sword', 1), dropLoc);
                            }
                            catch { }
                        }, 5);
                    }
                    break;
                }
                case 'minecraft:witch': {
                    if (deadEntity.matches({ families: ['grass_witch'] })) {
                        const foot = dim.getBlock(loc);
                        if (foot && foot.isAir) {
                            foot.setType('minecraft:short_grass');
                        }
                        dim.playSound('dig.grass', loc, { volume: 1.0, pitch: 1.0 });
                    }
                    break;
                }
                case 'minecraft:blaze': {
                    // Exact 2.8.8 combined Snow Golem drop chance (loot table 2.5% + entity event 0.5% = 3.0%)!
                    if ((killer?.typeId === 'minecraft:snow_golem' || proj?.typeId === 'minecraft:snowball') &&
                        killer?.typeId !== 'minecraft:player' &&
                        Math.random() < 0.03) {
                        dim.spawnItem(new ItemStack('effect:blaze_sword', 1), loc);
                    }
                    break;
                }
                case 'minecraft:skeleton': {
                    // Nighttime Skeleton in a Desert biome -> 0.7% Bone Sword!
                    const time = world.getTimeOfDay();
                    if (time >= 13000 && time <= 23000 && Math.random() < 0.007) {
                        const biomeId = dim.getBiome(loc).id;
                        if (biomeId.includes('desert')) {
                            dim.spawnItem(new ItemStack('effect:bone_sword', 1), loc);
                        }
                    }
                    break;
                }
                case 'minecraft:ghast': {
                    // Slain by reflected fireball -> 6% Spectral Sword!
                    if ((proj?.typeId === 'minecraft:fireball' || damageSource.cause === EntityDamageCause.projectile) &&
                        Math.random() < 0.06) {
                        dim.spawnItem(new ItemStack('effect:spectral_sword', 1), loc);
                    }
                    break;
                }
            }
        }
        catch { }
    });
    // 8. Periodic Dropped-Item Elemental Reactions & Desert Well Fountain of Wishes (every 10 ticks)
    system.runInterval(() => {
        const activeRainSwordIds = new Set();
        for (const dimName of ['overworld', 'nether', 'the_end']) {
            try {
                const dim = world.getDimension(dimName);
                const items = dim.getEntities({ type: 'minecraft:item' });
                for (const itemEnt of items) {
                    if (!itemEnt.isValid || itemEnt.hasTag('effect_processed'))
                        continue;
                    const itemComp = itemEnt.getComponent(EntityComponentTypes.Item);
                    const stack = itemComp?.itemStack;
                    if (!stack)
                        continue;
                    const id = stack.typeId;
                    const loc = itemEnt.location;
                    const block = dim.getBlock(loc);
                    if (!block)
                        continue;
                    const bType = block.typeId;
                    const inWater = bType === 'minecraft:water' || bType === 'minecraft:flowing_water';
                    const inFire = bType === 'minecraft:fire' ||
                        bType === 'minecraft:soul_fire' ||
                        bType === 'minecraft:lava' ||
                        bType === 'minecraft:flowing_lava';
                    // Check outdoor liquid rain exposure in Overworld (excluding arid & snowy biomes)
                    let inRain = false;
                    if (dimName === 'overworld' && isRainingOverworld && !inWater) {
                        const top = dim.getTopmostBlock({ x: Math.floor(loc.x), z: Math.floor(loc.z) });
                        if (!top || top.location.y <= Math.floor(loc.y)) {
                            const biomeId = dim.getBiome(loc).id;
                            if (!isNonRainingBiome(biomeId)) {
                                inRain = true;
                            }
                        }
                    }
                    // A. Dropped Fire Sword elemental transformations (100% faithful to 2.8.8 item.json!)
                    if (id === 'effect:fire_sword') {
                        if (inWater) {
                            fadingFireSwordTicks.delete(itemEnt.id);
                            itemEnt.remove();
                            dim.spawnItem(new ItemStack('effect:glass_sword', 1), loc);
                            dim.playSound('random.fizz', loc, { volume: 0.8, pitch: 1.0 });
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                            continue;
                        }
                        if (inRain) {
                            // Exact 2.8.8 `fading_fire_sword`: 5s fizzing countdown in rain before turning into Obsidian Sword!
                            activeRainSwordIds.add(itemEnt.id);
                            const rainChecks = (fadingFireSwordTicks.get(itemEnt.id) ?? 0) + 1;
                            fadingFireSwordTicks.set(itemEnt.id, rainChecks);
                            dim.playSound('random.fizz', loc, { volume: 0.7, pitch: 1.1 });
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                            if (rainChecks >= 10) {
                                fadingFireSwordTicks.delete(itemEnt.id);
                                itemEnt.remove();
                                dim.spawnItem(new ItemStack('effect:obsidian_sword', 1), loc);
                                dim.playSound('random.fizz', loc, { volume: 1.0, pitch: 0.8 });
                            }
                            continue;
                        }
                        else {
                            fadingFireSwordTicks.delete(itemEnt.id);
                        }
                        if (bType === 'minecraft:fire' || bType === 'minecraft:soul_fire') {
                            itemEnt.remove();
                            block.setType('minecraft:air');
                            for (const [ox, oz] of [
                                [0, 0],
                                [1, 1],
                                [1, -1],
                                [-1, 1],
                                [-1, -1],
                                [1, 0],
                                [0, 1],
                                [0, -1],
                                [-1, 0],
                            ]) {
                                dim.spawnParticle('minecraft:mobflame_single', {
                                    x: loc.x + ox,
                                    y: loc.y + 0.5,
                                    z: loc.z + oz,
                                });
                            }
                            for (let i = 0; i < 5; i++) {
                                dim.spawnEntity('entity:living_flame', {
                                    x: loc.x + (Math.random() - 0.5) * 1.5,
                                    y: loc.y + 0.3,
                                    z: loc.z + (Math.random() - 0.5) * 1.5,
                                }, { spawnEvent: 'hostile_entity' });
                            }
                            dim.playSound('mob.wither.spawn', loc, { volume: 1.0, pitch: 2.0 });
                            continue;
                        }
                    }
                    // B. Dropped Sponge Sword -> Wet Sponge Sword
                    if (id === 'effect:sponge_sword' && (inWater || inRain)) {
                        itemEnt.remove();
                        if (inWater)
                            block.setType('minecraft:air');
                        dim.spawnItem(new ItemStack('effect:wet_sponge_sword', 1), loc);
                        dim.playSound('random.fizz', loc, { volume: 0.6, pitch: 1.1 });
                        dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                        continue;
                    }
                    // C. Dropped Ice Sword melts into water in Overworld/End!
                    if (id === 'effect:ice_sword' && inFire) {
                        itemEnt.remove();
                        if (dimName !== 'nether') {
                            block.setType('minecraft:water');
                        }
                        dim.playSound('random.fizz', loc, { volume: 0.8, pitch: 1.0 });
                        dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                        continue;
                    }
                    // D. Dropped Lightning Sword in fire summons lightning!
                    if (id === 'effect:lightning_sword' && inFire) {
                        itemEnt.remove();
                        dim.spawnEntity('minecraft:lightning_bolt', loc);
                        continue;
                    }
                    // E. Dropped TNT Sword in fire/lava -> Giant Explosion
                    if (id === 'effect:tnt_sword' && inFire) {
                        itemEnt.remove();
                        dim.spawnEntity('entity:instant_giant_explode', loc);
                        continue;
                    }
                    // F. Dropped Nether Star Sword in fire -> Bedrock-carving Ultra Instinct Explosion!
                    if (id === 'effect:nether_star_sword' && (bType === 'minecraft:fire' || bType === 'minecraft:soul_fire')) {
                        itemEnt.remove();
                        block.setType('minecraft:air');
                        dim.spawnEntity('entity:ultra_instinct_explode', loc);
                        continue;
                    }
                    // F2. Exact 2.8.8 fire/lava reactions for Bedrock Sword (fireproof!), Ender Sword & Wither Sword!
                    if (id === 'effect:bedrock_sword' && inFire) {
                        const safeStack = stack.clone();
                        itemEnt.remove();
                        const safeItem = dim.spawnItem(safeStack, { x: loc.x, y: loc.y + 1.4, z: loc.z });
                        safeItem.applyImpulse({ x: (Math.random() - 0.5) * 0.25, y: 0.35, z: (Math.random() - 0.5) * 0.25 });
                        continue;
                    }
                    if (id === 'effect:ender_sword' && inFire) {
                        itemEnt.remove();
                        dim.spawnParticle('minecraft:example_linearcurve', loc);
                        dim.playSound('mob.endermen.death', loc, { volume: 1.0, pitch: 0.5 });
                        continue;
                    }
                    if (id === 'effect:wither_sword' && inFire) {
                        itemEnt.remove();
                        dim.spawnParticle('minecraft:example_linearcurve', loc);
                        dim.playSound('mob.wither.death', loc, { volume: 1.0, pitch: 0.5 });
                        continue;
                    }
                    // G. Desert Well (Fountain of Wishes) in Overworld (100% faithful to item.json wish_1/2/3!)
                    if (dimName === 'overworld' &&
                        inWater &&
                        (id === 'effect:quartz_diamond' ||
                            id === 'effect99:quartz_diamond_block' ||
                            id === 'effect:clock_sword')) {
                        if (isDesertWellWater(dim, loc)) {
                            const count = stack.amount;
                            itemEnt.addTag('effect_processed');
                            itemEnt.remove();
                            const chancePerItem = id === 'effect:quartz_diamond' ? 0.008 : 0.025;
                            const isClockWish = id === 'effect:clock_sword';
                            const rewardId = isClockWish ? 'effect:time_sword' : 'effect:ultra_instinct_sword';
                            let won = false;
                            for (let i = 0; i < count; i++) {
                                if (Math.random() < chancePerItem) {
                                    won = true;
                                    dim.spawnItem(new ItemStack(rewardId, 1), { x: loc.x, y: loc.y + 1.2, z: loc.z });
                                }
                            }
                            if (won) {
                                if (isClockWish) {
                                    world.setTimeOfDay((world.getTimeOfDay() + 6000) % 24000);
                                    convertSurroundingSand(dim, loc, 'minecraft:yellow_concrete_powder');
                                    dim.spawnParticle('minecraft:knockback_roar_particle', { x: loc.x, y: loc.y + 0.3, z: loc.z });
                                    dim.playSound('random.levelup', loc, { volume: 1.0, pitch: 0.5 });
                                }
                                else {
                                    convertSurroundingSand(dim, loc, 'minecraft:white_concrete_powder');
                                    dim.spawnParticle('minecraft:example_flipbook', loc);
                                    dim.spawnParticle('minecraft:example_flipbook', { x: loc.x, y: loc.y + 1.5, z: loc.z });
                                    dim.playSound('mob.wither.ambient', loc, { volume: 2.0, pitch: 0.6 });
                                }
                            }
                            else {
                                if (isClockWish) {
                                    world.setTimeOfDay((world.getTimeOfDay() + 1000) % 24000);
                                    dim.spawnParticle('minecraft:knockback_roar_particle', { x: loc.x, y: loc.y + 0.3, z: loc.z });
                                    dim.playSound('random.orb', loc, { volume: 1.0, pitch: 0.5 });
                                }
                                else {
                                    dim.spawnParticle('minecraft:example_flipbook', loc);
                                }
                            }
                        }
                    }
                }
                // Alpha Wolf boss periodic regeneration re-application if NOT yet struck by Silver Sword
                const alphas = dim.getEntities({ type: 'entity:alpha_wolf' });
                for (const alpha of alphas) {
                    if (!alpha.hasTag('hit_by_silver')) {
                        alpha.addEffect('regeneration', 60, { amplifier: 2, showParticles: false });
                        alpha.addEffect('resistance', 60, { amplifier: 2, showParticles: false });
                    }
                }
            }
            catch { }
        }
        // Prune picked-up or despawned Fire Sword entity IDs from rain countdown map
        for (const oldId of fadingFireSwordTicks.keys()) {
            if (!activeRainSwordIds.has(oldId)) {
                fadingFireSwordTicks.delete(oldId);
            }
        }
    }, 10);
}
