import { BlockPermutation, EntityComponentTypes, EntityDamageCause, GameMode, MoonPhase, system, world, } from '@minecraft/server';
import { tryConvertSpongeSword } from './swordSkills.js';
import { consumeMainhandDurability, getMainhandItem, getOffhandItem, isFullMoonNight, isProtectedEntity, } from './utils.js';
const PLAYER_COMPONENT_KEYS = new Set([
    'sea_sword',
    'ghost_sword',
    'wolf_transformation',
    'ultra_instinct_sword',
    'ender_sword',
    'obsidian_sword',
    'blaze_sword',
    'fire_sword',
    'magma_sword',
    'lightning_sword',
    'wither_sword',
    'spectral_sword',
    'jungle_sword',
    'tnt_sword',
    'shulker_sword',
    'slime_sword',
    'spider_sword',
]);
const lastEquipKey = new Map();
const lastMainhandId = new Map();
const lastLightBlock = new Map();
const playerShulkerShield = new Map();
const playerWitherBossbar = new Map();
const playerSpectralCrystal = new Map();
const playerSpiderMount = new Map();
const werewolfCursedPlayers = new Set();
let timeSwordActiveInWorld = false;
const SMALL_FLOWERS = new Set([
    'minecraft:dandelion',
    'minecraft:poppy',
    'minecraft:blue_orchid',
    'minecraft:allium',
    'minecraft:azure_bluet',
    'minecraft:red_tulip',
    'minecraft:orange_tulip',
    'minecraft:white_tulip',
    'minecraft:pink_tulip',
    'minecraft:oxeye_daisy',
    'minecraft:cornflower',
    'minecraft:lily_of_the_valley',
    'minecraft:torchflower',
]);
function cleanupHelperEntity(map, playerId, despawnEvent) {
    const ent = map.get(playerId);
    if (!ent)
        return;
    map.delete(playerId);
    try {
        if (ent.isValid) {
            if (despawnEvent) {
                ent.triggerEvent(despawnEvent);
            }
            ent.remove();
        }
    }
    catch { }
}
function clearTrackedLight(playerId) {
    const prev = lastLightBlock.get(playerId);
    if (!prev)
        return;
    lastLightBlock.delete(playerId);
    try {
        const b = prev.dim.getBlock(prev.loc);
        if (b && (b.typeId === 'effect99:lightblock' || b.typeId === 'effect99:lightblock2')) {
            b.setType('minecraft:air');
        }
    }
    catch { }
}
function updateDynamicLight(player, mainId, offId) {
    const isFire = mainId === 'effect:fire_sword' || offId === 'effect:fire_sword';
    const isGlow = mainId === 'effect:glowstone_sword' || offId === 'effect:glowstone_sword';
    if (!isFire && !isGlow) {
        clearTrackedLight(player.id);
        return;
    }
    const targetType = isFire ? 'effect99:lightblock2' : 'effect99:lightblock';
    const headLoc = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y + 1),
        z: Math.floor(player.location.z),
    };
    const prev = lastLightBlock.get(player.id);
    if (prev &&
        prev.dim.id === player.dimension.id &&
        prev.loc.x === headLoc.x &&
        prev.loc.y === headLoc.y &&
        prev.loc.z === headLoc.z) {
        return;
    }
    clearTrackedLight(player.id);
    try {
        const b = player.dimension.getBlock(headLoc);
        if (b && b.isAir) {
            b.setType(targetType);
            lastLightBlock.set(player.id, { dim: player.dimension, loc: headLoc });
        }
    }
    catch { }
}
export function startPassiveEngine() {
    let tick = 0;
    system.runInterval(() => {
        tick++;
        const players = world.getAllPlayers();
        const fullMoon = isFullMoonNight();
        const timeOfDay = world.getTimeOfDay();
        let anyTimeSword = false;
        // Clear werewolf curse at dawn
        if (timeOfDay < 12500 || timeOfDay > 23500) {
            werewolfCursedPlayers.clear();
        }
        for (const player of players) {
            if (!player.isValid)
                continue;
            const mainItem = getMainhandItem(player);
            const offItem = getOffhandItem(player);
            const mainId = mainItem?.typeId ?? '';
            const offId = offItem?.typeId ?? '';
            // Compute C++ component-group equipment key
            let equipKey = mainId.startsWith('effect:') ? mainId.slice('effect:'.length) : '';
            if (equipKey === 'wolf_sword') {
                equipKey = fullMoon ? 'wolf_transformation' : '';
            }
            const prevKey = lastEquipKey.get(player.id) ?? '';
            const prevMainId = lastMainhandId.get(player.id) ?? '';
            // 1. Sync player.json component groups & equip/unequip triggers ONLY on change
            if (equipKey !== prevKey || mainId !== prevMainId) {
                lastEquipKey.set(player.id, equipKey);
                lastMainhandId.set(player.id, mainId);
                try {
                    player.triggerEvent('effect:reset_player');
                    if (PLAYER_COMPONENT_KEYS.has(equipKey)) {
                        player.triggerEvent(`effect:equip_${equipKey}`);
                    }
                }
                catch { }
                // Quartz-Diamond Sword equip/unequip 14-magic-damage curse
                if ((prevMainId === 'effect:quartz_sword' || mainId === 'effect:quartz_sword') &&
                    prevMainId !== mainId &&
                    player.getGameMode() !== GameMode.Creative) {
                    try {
                        player.applyDamage(14, { cause: EntityDamageCause.magic });
                        player.dimension.playSound('random.glass', player.location, { volume: 1.0, pitch: 0.6 });
                    }
                    catch { }
                }
                // Werewolf mid-full-moon unequip curse
                if (prevKey === 'wolf_transformation' && equipKey !== 'wolf_transformation' && fullMoon) {
                    werewolfCursedPlayers.add(player.id);
                }
                // Cleanup sword-specific helper entities when switching off
                if (equipKey !== 'shulker_sword')
                    cleanupHelperEntity(playerShulkerShield, player.id);
                if (equipKey !== 'wither_sword')
                    cleanupHelperEntity(playerWitherBossbar, player.id);
                if (equipKey !== 'spectral_sword')
                    cleanupHelperEntity(playerSpectralCrystal, player.id, 'effect:despawn');
            }
            // 2. Dynamic Light (every 2 ticks)
            if (tick % 2 === 0) {
                updateDynamicLight(player, mainId, offId);
            }
            // Clean up Spider mount as soon as player dismounts or stops holding Spider Sword
            const spiderMount = playerSpiderMount.get(player.id);
            if (spiderMount) {
                const riding = player.getComponent(EntityComponentTypes.Riding);
                if (!spiderMount.isValid || mainId !== 'effect:spider_sword' || riding?.entityRidingOn?.id !== spiderMount.id) {
                    cleanupHelperEntity(playerSpiderMount, player.id, 'effect:despawn_mount');
                }
            }
            // Apply lingering werewolf unequip curse if player took off Wolf Sword mid-Full-Moon
            if (werewolfCursedPlayers.has(player.id) && mainId !== 'effect:wolf_sword' && tick % 40 === 0) {
                try {
                    player.addEffect('nausea', 100, { amplifier: 0, showParticles: true });
                    player.addEffect('weakness', 100, { amplifier: 1, showParticles: true });
                    player.addEffect('poison', 60, { amplifier: 0, showParticles: true });
                }
                catch { }
            }
            if (!mainId.startsWith('effect:'))
                continue;
            const dim = player.dimension;
            // 3. Per-sword active/passive behaviors
            try {
                switch (mainId) {
                    case 'effect:sea_sword': {
                        if (player.isInWater) {
                            if (tick % 20 === 0) {
                                player.addEffect('water_breathing', 100, { amplifier: 0, showParticles: false });
                                player.addEffect('conduit_power', 100, { amplifier: 1, showParticles: false });
                                player.addEffect('night_vision', 260, { amplifier: 0, showParticles: false });
                            }
                        }
                        else if (tick % 18 === 0 && player.getGameMode() !== GameMode.Creative) {
                            // Mermaid flops and dries out on dry land!
                            const footBlock = dim.getBlock(player.location);
                            if (!footBlock || !footBlock.typeId.includes('water')) {
                                player.applyKnockback({ x: (Math.random() - 0.5) * 0.25, z: (Math.random() - 0.5) * 0.25 }, 0.32);
                                player.applyDamage(1, { cause: EntityDamageCause.drowning });
                                dim.playSound('mob.fish.flop', player.location, { volume: 0.8, pitch: 1.0 });
                            }
                        }
                        break;
                    }
                    case 'effect:ghost_sword': {
                        if (tick % 10 === 0) {
                            player.addEffect('invisibility', 60, { amplifier: 0, showParticles: false });
                        }
                        if (player.isSneaking) {
                            player.addEffect('levitation', 10, { amplifier: 2, showParticles: false });
                        }
                        else {
                            player.addEffect('slow_falling', 20, { amplifier: 0, showParticles: false });
                        }
                        break;
                    }
                    case 'effect:ice_sword': {
                        // Melt if player steps into lava!
                        if (tick % 5 === 0) {
                            const foot = dim.getBlock(player.location);
                            if (foot &&
                                (foot.typeId === 'minecraft:lava' || foot.typeId === 'minecraft:flowing_lava') &&
                                player.getGameMode() !== GameMode.Creative) {
                                const eq = player.getComponent(EntityComponentTypes.Equippable);
                                eq?.setEquipment('Mainhand', undefined);
                                dim.playSound('random.fizz', player.location, { volume: 1.2, pitch: 1.0 });
                                dim.spawnParticle('minecraft:large_explosion', player.location);
                                break;
                            }
                            // Frost Walker underfoot
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dz = -2; dz <= 2; dz++) {
                                    if (dx * dx + dz * dz > 5)
                                        continue;
                                    const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                    if (b && b.typeId === 'minecraft:water') {
                                        b.setType('minecraft:frosted_ice');
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:magma_sword': {
                        if (tick % 20 === 0) {
                            player.addEffect('fire_resistance', 80, { amplifier: 0, showParticles: false });
                        }
                        if (tick % 4 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dz = -2; dz <= 2; dz++) {
                                    if (dx * dx + dz * dz > 5)
                                        continue;
                                    const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                    if (b && (b.typeId === 'minecraft:lava' || b.typeId === 'minecraft:flowing_lava')) {
                                        b.setType('minecraft:magma');
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:blaze_sword': {
                        if (tick % 20 === 0) {
                            player.addEffect('fire_resistance', 80, { amplifier: 0, showParticles: false });
                        }
                        // Halt incoming small_fireball projectiles in mid-air
                        if (tick % 2 === 0) {
                            const fireballs = dim.getEntities({
                                location: player.location,
                                maxDistance: 4.5,
                                type: 'minecraft:small_fireball',
                            });
                            for (const fb of fireballs) {
                                fb.clearVelocity();
                                fb.triggerEvent('minecraft:inertia_disable');
                            }
                        }
                        break;
                    }
                    case 'effect:fire_sword': {
                        if (tick % 20 === 0) {
                            player.addEffect('fire_resistance', 80, { amplifier: 0, showParticles: false });
                        }
                        break;
                    }
                    case 'effect:bone_sword': {
                        // Halt incoming arrows in mid-air around wielder!
                        if (tick % 2 === 0) {
                            const arrows = dim.getEntities({
                                location: player.location,
                                maxDistance: 4.5,
                                type: 'minecraft:arrow',
                            });
                            for (const arr of arrows) {
                                arr.clearVelocity();
                                arr.triggerEvent('minecraft:inertia_disable');
                            }
                        }
                        break;
                    }
                    case 'effect:lapis_sword': {
                        if (tick % 80 === 0) {
                            player.addExperience(5);
                            dim.playSound('random.orb', player.location, { volume: 0.4, pitch: 1.2 });
                            consumeMainhandDurability(player, 1);
                        }
                        break;
                    }
                    case 'effect:sponge_sword': {
                        if (tick % 10 === 0) {
                            tryConvertSpongeSword(player);
                        }
                        break;
                    }
                    case 'effect:jungle_sword': {
                        if (tick % 30 === 0) {
                            player.addEffect('absorption', 100, { amplifier: 1, showParticles: false });
                            // Occasionally grow vines on adjacent solid blocks
                            if (Math.random() < 0.35) {
                                const offsets = [
                                    { x: 1, z: 0 },
                                    { x: -1, z: 0 },
                                    { x: 0, z: 1 },
                                    { x: 0, z: -1 },
                                ];
                                const off = offsets[Math.floor(Math.random() * offsets.length)];
                                const wall = dim.getBlock({
                                    x: Math.floor(player.location.x) + off.x * 2,
                                    y: Math.floor(player.location.y) + 1,
                                    z: Math.floor(player.location.z) + off.z * 2,
                                });
                                const airInFront = dim.getBlock({
                                    x: Math.floor(player.location.x) + off.x,
                                    y: Math.floor(player.location.y) + 1,
                                    z: Math.floor(player.location.z) + off.z,
                                });
                                if (wall && !wall.isAir && !wall.isLiquid && airInFront && airInFront.isAir) {
                                    airInFront.setType('minecraft:vine');
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:grass_sword': {
                        if (tick % 20 === 0) {
                            player.addEffect('speed', 60, { amplifier: 0, showParticles: false });
                            player.addEffect('jump_boost', 60, { amplifier: 0, showParticles: false });
                            const below = dim.getBlock({
                                x: Math.floor(player.location.x),
                                y: Math.floor(player.location.y) - 1,
                                z: Math.floor(player.location.z),
                            });
                            if (below && below.typeId === 'minecraft:dirt') {
                                below.setType('minecraft:grass_block');
                            }
                        }
                        break;
                    }
                    case 'effect:emerald_sword': {
                        if (tick % 40 === 0) {
                            player.addEffect('village_hero', 120, { amplifier: 0, showParticles: false });
                        }
                        break;
                    }
                    case 'effect:slime_sword': {
                        if (tick % 20 === 0) {
                            player.addEffect('jump_boost', 60, { amplifier: 1, showParticles: false });
                        }
                        if (player.isSneaking && tick % 10 === 0) {
                            player.addEffect('resistance', 30, { amplifier: 2, showParticles: true });
                            player.addEffect('slowness', 30, { amplifier: 2, showParticles: false });
                            dim.spawnParticle('minecraft:slime_particle', player.location);
                        }
                        break;
                    }
                    case 'effect:shulker_sword': {
                        if (player.isSneaking) {
                            player.addEffect('resistance', 15, { amplifier: 2, showParticles: false });
                            player.addEffect('slowness', 15, { amplifier: 3, showParticles: false });
                            let shield = playerShulkerShield.get(player.id);
                            if (!shield || !shield.isValid) {
                                shield = dim.spawnEntity('entity:shulker_shield', player.location);
                                playerShulkerShield.set(player.id, shield);
                                dim.playSound('mob.shulker.close', player.location, { volume: 0.9, pitch: 1.0 });
                            }
                            else {
                                shield.teleport(player.location);
                            }
                        }
                        else if (playerShulkerShield.has(player.id)) {
                            cleanupHelperEntity(playerShulkerShield, player.id);
                            dim.playSound('mob.shulker.open', player.location, { volume: 0.9, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:spider_sword': {
                        if (player.isSneaking && !playerSpiderMount.has(player.id)) {
                            const riding = player.getComponent(EntityComponentTypes.Riding);
                            if (!riding?.entityRidingOn) {
                                const spider = dim.spawnEntity('minecraft:spider', player.location, {
                                    spawnEvent: 'spider_player_jockey',
                                });
                                const rideable = spider.getComponent(EntityComponentTypes.Rideable);
                                rideable?.addRider(player);
                                playerSpiderMount.set(player.id, spider);
                            }
                        }
                        break;
                    }
                    case 'effect:spectral_sword': {
                        // Maintain overhead Ender Crystal rider
                        if (tick % 20 === 0) {
                            let crystal = playerSpectralCrystal.get(player.id);
                            if (!crystal || !crystal.isValid) {
                                crystal = dim.spawnEntity('minecraft:ender_crystal', {
                                    x: player.location.x,
                                    y: player.location.y + 2.5,
                                    z: player.location.z,
                                }, { spawnEvent: 'effect:spectral_rider' });
                                const rideable = player.getComponent(EntityComponentTypes.Rideable);
                                rideable?.addRider(crystal);
                                playerSpectralCrystal.set(player.id, crystal);
                            }
                        }
                        // Dimensional X-Ray: transform nearby stone/deepslate/netherrack/end_stone into stateful spectral_block
                        if (tick % 6 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y + 1);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -3; dx <= 3; dx++) {
                                for (let dy = -3; dy <= 3; dy++) {
                                    for (let dz = -3; dz <= 3; dz++) {
                                        if (dx * dx + dy * dy + dz * dz > 12)
                                            continue;
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (!b)
                                            continue;
                                        let originKey;
                                        if (b.typeId === 'minecraft:stone')
                                            originKey = 'stone';
                                        else if (b.typeId === 'minecraft:deepslate')
                                            originKey = 'deepslate';
                                        else if (b.typeId === 'minecraft:netherrack')
                                            originKey = 'netherrack';
                                        else if (b.typeId === 'minecraft:end_stone')
                                            originKey = 'end_stone';
                                        if (originKey) {
                                            b.setPermutation(BlockPermutation.resolve('effect99:spectral_block', {
                                                'effect99:origin': originKey,
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:wither_sword': {
                        if (tick % 20 === 0) {
                            let bossEnt = playerWitherBossbar.get(player.id);
                            if (!bossEnt || !bossEnt.isValid) {
                                bossEnt = dim.spawnEntity('entity:wither_effect', {
                                    x: player.location.x,
                                    y: player.location.y + 4,
                                    z: player.location.z,
                                });
                                playerWitherBossbar.set(player.id, bossEnt);
                            }
                            else {
                                bossEnt.teleport({
                                    x: player.location.x,
                                    y: player.location.y + 4,
                                    z: player.location.z,
                                });
                            }
                            // Wither nearby small flowers into Wither Roses
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -3; dx <= 3; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    for (let dz = -3; dz <= 3; dz++) {
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (b && SMALL_FLOWERS.has(b.typeId)) {
                                            b.setType('minecraft:wither_rose');
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:wolf_sword': {
                        if (world.getMoonPhase() === MoonPhase.FullMoon && timeOfDay >= 12000 && timeOfDay < 13000 && tick % 40 === 0) {
                            // Sunset pre-transformation warning
                            player.addEffect('nausea', 80, { amplifier: 0, showParticles: false });
                            dim.playSound('mob.wolf.growl', player.location, { volume: 0.7, pitch: 0.7 });
                        }
                        else if (fullMoon && tick % 20 === 0) {
                            werewolfCursedPlayers.delete(player.id);
                            player.addEffect('speed', 60, { amplifier: 2, showParticles: false });
                            player.addEffect('jump_boost', 60, { amplifier: 2, showParticles: false });
                            player.addEffect('night_vision', 260, { amplifier: 0, showParticles: false });
                            player.addEffect('regeneration', 60, { amplifier: 0, showParticles: false });
                        }
                        break;
                    }
                    case 'effect:ultra_instinct_sword': {
                        if (tick % 15 === 0) {
                            player.addEffect('speed', 60, { amplifier: 2, showParticles: false });
                            player.addEffect('jump_boost', 60, { amplifier: 1, showParticles: false });
                            player.addEffect('strength', 60, { amplifier: 1, showParticles: false });
                            dim.spawnParticle('minecraft:endrod', {
                                x: player.location.x + (Math.random() - 0.5) * 1.2,
                                y: player.location.y + Math.random() * 1.8,
                                z: player.location.z + (Math.random() - 0.5) * 1.2,
                            });
                        }
                        break;
                    }
                    case 'effect:time_sword': {
                        anyTimeSword = true;
                        world.setTimeOfDay((world.getTimeOfDay() + 30) % 24000);
                        if (tick % 20 === 0) {
                            consumeMainhandDurability(player, 1);
                        }
                        break;
                    }
                }
            }
            catch { }
        }
        // Toggle world randomTickSpeed when Time Sword is held vs released
        if (anyTimeSword !== timeSwordActiveInWorld) {
            timeSwordActiveInWorld = anyTimeSword;
            try {
                world.getDimension('overworld').runCommand(`gamerule randomtickspeed ${anyTimeSword ? 300 : 1}`);
            }
            catch { }
        }
        // Handle Winged Mountable Slime bounce & landing stomp AoE
        if (tick % 8 === 0) {
            for (const dimName of ['overworld', 'nether', 'the_end']) {
                try {
                    const dim = world.getDimension(dimName);
                    const mounts = dim.getEntities({ type: 'entity:mountable_slime' });
                    for (const slime of mounts) {
                        const rideable = slime.getComponent(EntityComponentTypes.Rideable);
                        const riders = rideable?.getRiders() ?? [];
                        if (riders.length === 0) {
                            slime.remove();
                            continue;
                        }
                        const rider = riders[0];
                        if (slime.isOnGround) {
                            for (const victim of dim.getEntities({ location: slime.location, maxDistance: 3.8 })) {
                                if (victim.id !== slime.id && !isProtectedEntity(victim, rider)) {
                                    victim.applyDamage(8, { cause: EntityDamageCause.entityAttack, damagingEntity: rider });
                                    victim.applyKnockback({ x: 0, z: 0 }, 0.55);
                                }
                            }
                            dim.playSound('mob.slime.big', slime.location, { volume: 0.7, pitch: 1.0 });
                        }
                    }
                }
                catch { }
            }
        }
    }, 1);
}
