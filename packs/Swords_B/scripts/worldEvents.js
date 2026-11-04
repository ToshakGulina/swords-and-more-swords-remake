import { EntityComponentTypes, EntityDamageCause, GameMode, ItemStack, Player, system, WeatherType, world, } from '@minecraft/server';
import { openSwordsGuide } from './guideMenu.js';
import { getActiveShulkerShieldOwner } from './passiveEngine.js';
import { getMainhandItem, giveOrDropItem, isDesertWellWater, safeRandomTeleport } from './utils.js';
let isRainingOverworld = false;
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
    // Track Overworld rain/thunder for dropped Fire Sword & Sponge Sword outdoor reactions
    world.afterEvents.weatherChange.subscribe((ev) => {
        isRainingOverworld = ev.newWeather !== WeatherType.Clear;
    });
    // 1. Give Swords Encyclopedia on a player's very first join to the world
    world.afterEvents.playerSpawn.subscribe((ev) => {
        if (!ev.initialSpawn)
            return;
        const player = ev.player;
        try {
            if (!player.getDynamicProperty('effect:received_guide')) {
                player.setDynamicProperty('effect:received_guide', true);
                giveOrDropItem(player, new ItemStack('effect:swords_guide', 1));
            }
        }
        catch { }
    });
    // 2. Handle player.json pre-damage dodges & /scriptevent effect:guide
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
        if (ev.id === 'effect:guide' && ev.sourceEntity instanceof Player) {
            openSwordsGuide(ev.sourceEntity);
            return;
        }
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
    });
    // 3. Bedrock Block Drop when shattered by Ultra Instinct Projectile or Nether Star Fire Explosion!
    world.afterEvents.blockExplode.subscribe((ev) => {
        try {
            if (ev.explodedBlockPermutation.type.id === 'minecraft:bedrock') {
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
    // 6. Natural Lightning Strike -> 20% Centella spawn & Alpha Wolf distant howl!
    world.afterEvents.entitySpawn.subscribe((ev) => {
        try {
            if (ev.entity.typeId === 'minecraft:lightning_bolt') {
                const dim = ev.entity.dimension;
                const nearbyHolder = dim
                    .getPlayers({ location: ev.entity.location, maxDistance: 45 })
                    .some((p) => getMainhandItem(p)?.typeId === 'effect:lightning_sword');
                if (!nearbyHolder && Math.random() < 0.2) {
                    dim.spawnEntity('entity:centella', ev.entity.location);
                }
            }
            else if (ev.entity.typeId === 'entity:alpha_wolf') {
                const dim = ev.entity.dimension;
                for (const p of dim.getPlayers({ location: ev.entity.location, maxDistance: 96 })) {
                    p.playSound('wolf_sword.distant_howl', { volume: 1.0, pitch: 1.0 });
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
                    // Kill the Wither with Nether Star Sword -> 13% chance to drop Wither Sword!
                    const usedNetherStar = deadEntity.hasTag('slain_by_nether_star_sword') ||
                        (killer instanceof Player && getMainhandItem(killer)?.typeId === 'effect:nether_star_sword');
                    if (usedNetherStar && Math.random() < 0.13) {
                        dim.spawnItem(new ItemStack('effect:wither_sword', 1), loc);
                    }
                    break;
                }
                case 'minecraft:blaze': {
                    // Killed by a Snow Golem -> Blaze Sword!
                    if (killer?.typeId === 'minecraft:snow_golem' && Math.random() < 0.025) {
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
                case 'minecraft:ender_crystal': {
                    if (dim.id === 'minecraft:nether' && Math.random() < 0.02) {
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
                    // Check outdoor rain exposure in Overworld
                    let inRain = false;
                    if (dimName === 'overworld' && isRainingOverworld && !inWater) {
                        const top = dim.getTopmostBlock({ x: Math.floor(loc.x), z: Math.floor(loc.z) });
                        if (!top || top.location.y <= Math.floor(loc.y)) {
                            const biomeId = dim.getBiome(loc).id;
                            if (!biomeId.includes('desert') && !biomeId.includes('savanna') && !biomeId.includes('mesa')) {
                                inRain = true;
                            }
                        }
                    }
                    // A. Dropped Fire Sword elemental transformations (100% faithful to item.json!)
                    if (id === 'effect:fire_sword') {
                        if (inWater) {
                            itemEnt.remove();
                            dim.spawnItem(new ItemStack('effect:glass_sword', 1), loc);
                            dim.playSound('random.fizz', loc, { volume: 0.8, pitch: 1.0 });
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                            continue;
                        }
                        if (inRain) {
                            itemEnt.remove();
                            dim.spawnItem(new ItemStack('effect:obsidian_sword', 1), loc);
                            dim.playSound('random.fizz', loc, { volume: 1.0, pitch: 0.8 });
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', loc);
                            continue;
                        }
                        if (bType === 'minecraft:fire' || bType === 'minecraft:soul_fire') {
                            itemEnt.remove();
                            block.setType('minecraft:air');
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
    }, 10);
}
