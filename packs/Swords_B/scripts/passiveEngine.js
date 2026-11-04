import { BlockPermutation, EntityComponentTypes, EntityDamageCause, EquipmentSlot, GameMode, MoonPhase, system, world, } from '@minecraft/server';
import { LIGHT_EMITTING_SWORDS } from './blockComponents.js';
import { tryConvertSpongeSword } from './swordSkills.js';
import { getMainhandItem, getOffhandItem, isFullMoonNight, isProtectedEntity, } from './utils.js';
const PLAYER_COMPONENT_KEYS = new Set([
    'sea_sword',
    'ghost_sword',
    'wolf_transformation',
    'ultra_instinct_sword',
    'ender_sword',
    'nether_star_sword',
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
const playerSlimeMount = new Map();
const shulkerToggleCooldown = new Map();
const airborneSlimeIds = new Set();
const nextLapisTick = new Map();
const nextBeeFlowerTick = new Map();
const werewolfCursedPlayers = new Set();
let timeSwordActiveInWorld = false;
const SMALL_FLOWERS = [
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
];
const SMALL_FLOWER_SET = new Set([...SMALL_FLOWERS, 'minecraft:torchflower']);
const JUNGLE_VINE_SURFACES = new Set([
    'minecraft:jungle_log',
    'minecraft:oak_log',
    'minecraft:spruce_log',
    'minecraft:birch_log',
    'minecraft:acacia_log',
    'minecraft:dark_oak_log',
    'minecraft:grass_block',
    'minecraft:dirt',
    'minecraft:sand',
    'minecraft:cobblestone',
    'minecraft:stone',
    'minecraft:obsidian',
    'minecraft:end_stone',
    'minecraft:gravel',
    'minecraft:ice',
    'minecraft:netherrack',
    'minecraft:nether_brick',
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
    const isModerateBlaze = mainId === 'effect:blaze_sword' &&
        offId !== 'effect:glowstone_sword' &&
        offId !== 'effect:fire_sword';
    const isLight = LIGHT_EMITTING_SWORDS.has(mainId) ||
        offId === 'effect:glowstone_sword' ||
        offId === 'effect:fire_sword';
    if (!isLight) {
        clearTrackedLight(player.id);
        return;
    }
    // Exact 2.8.8: Blaze Sword uses `lightblock2` (level 11); Glowstone/Fire/Lightning/Time/Wither/Spectral use `lightblock` (level 15)
    const targetType = isModerateBlaze ? 'effect99:lightblock2' : 'effect99:lightblock';
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
export function getActiveShulkerShieldOwner(shieldId) {
    for (const [playerId, shield] of playerShulkerShield.entries()) {
        if (shield.id === shieldId) {
            return world.getAllPlayers().find((p) => p.id === playerId);
        }
    }
    return undefined;
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
            if (werewolfCursedPlayers.size > 0) {
                for (const p of players) {
                    if (werewolfCursedPlayers.has(p.id)) {
                        try {
                            p.removeEffect('nausea');
                            p.removeEffect('blindness');
                        }
                        catch { }
                    }
                }
                werewolfCursedPlayers.clear();
            }
        }
        for (const player of players) {
            if (!player.isValid)
                continue;
            const mainItem = getMainhandItem(player);
            const offItem = getOffhandItem(player);
            const mainId = mainItem?.typeId ?? '';
            const offId = offItem?.typeId ?? '';
            const dim = player.dimension;
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
                // Werewolf Full Moon transformation howl & particle FX!
                if (equipKey === 'wolf_transformation' && prevKey !== 'wolf_transformation') {
                    try {
                        dim.playSound('random.fizz', player.location, { volume: 1.0, pitch: 1.0 });
                        dim.playSound('wolf_sword.howl', player.location, { volume: 1.2, pitch: 1.0 });
                        dim.spawnParticle('minecraft:egg_destroy_emitter', player.location);
                    }
                    catch { }
                }
                // Quartz-Diamond Sword equip AND unequip 14-magic-damage curse!
                if ((prevMainId === 'effect:quartz_sword' || mainId === 'effect:quartz_sword') &&
                    prevMainId !== mainId &&
                    player.getGameMode() !== GameMode.Creative) {
                    try {
                        player.applyDamage(14, { cause: EntityDamageCause.magic });
                        dim.playSound('random.glass', player.location, { volume: 1.0, pitch: 0.6 });
                    }
                    catch { }
                }
                // Werewolf mid-full-moon unequip curse (nausea + blindness until dawn!)
                if (prevKey === 'wolf_transformation' && equipKey !== 'wolf_transformation' && fullMoon) {
                    werewolfCursedPlayers.add(player.id);
                }
                // Auto-summon Baby Slime Mount when equipping Slime Sword!
                if (mainId === 'effect:slime_sword' && prevMainId !== 'effect:slime_sword') {
                    try {
                        let slime = playerSlimeMount.get(player.id);
                        if (!slime || !slime.isValid) {
                            slime = dim.spawnEntity('entity:mountable_slime', player.location);
                            playerSlimeMount.set(player.id, slime);
                        }
                        const rideable = slime.getComponent(EntityComponentTypes.Rideable);
                        rideable?.addRider(player);
                    }
                    catch { }
                }
                // Auto-summon Wall-Climbing Spider Mount when equipping Spider Sword!
                if (mainId === 'effect:spider_sword' && prevMainId !== 'effect:spider_sword') {
                    try {
                        cleanupHelperEntity(playerSpiderMount, player.id, 'effect:despawn_mount');
                        const spider = dim.spawnEntity('minecraft:spider', player.location, {
                            spawnEvent: 'spider_player_jockey',
                        });
                        const rideable = spider.getComponent(EntityComponentTypes.Rideable);
                        rideable?.addRider(player);
                        playerSpiderMount.set(player.id, spider);
                    }
                    catch { }
                }
                // Clear Ghost Sword effects when unequipping
                if (prevMainId === 'effect:ghost_sword' && mainId !== 'effect:ghost_sword') {
                    try {
                        player.removeEffect('weakness');
                        player.removeEffect('levitation');
                        player.removeEffect('slow_falling');
                        player.removeEffect('invisibility');
                        dim.spawnParticle('minecraft:ghost_spiral', player.location);
                    }
                    catch { }
                }
                // Clear Jungle Sword absorption when unequipping
                if (prevMainId === 'effect:jungle_sword' && mainId !== 'effect:jungle_sword') {
                    try {
                        player.removeEffect('absorption');
                    }
                    catch { }
                }
                // Clear Wither Sword decorative wither when unequipping
                if (prevMainId === 'effect:wither_sword' && mainId !== 'effect:wither_sword') {
                    try {
                        player.removeEffect('wither');
                    }
                    catch { }
                }
                // Cleanup sword-specific helper entities when switching off
                if (equipKey !== 'shulker_sword')
                    cleanupHelperEntity(playerShulkerShield, player.id);
                if (equipKey !== 'wither_sword')
                    cleanupHelperEntity(playerWitherBossbar, player.id);
                if (equipKey !== 'spectral_sword')
                    cleanupHelperEntity(playerSpectralCrystal, player.id, 'effect:despawn');
                if (equipKey !== 'spider_sword')
                    cleanupHelperEntity(playerSpiderMount, player.id, 'effect:despawn_mount');
                if (equipKey !== 'slime_sword')
                    cleanupHelperEntity(playerSlimeMount, player.id, 'despawn');
            }
            // 2. Dynamic Light (every 2 ticks)
            if (tick % 2 === 0) {
                updateDynamicLight(player, mainId, offId);
            }
            // Clean up Spider mount if player dismounted, or re-mount when sneaking with Spider Sword
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
                    player.addEffect('nausea', 160, { amplifier: 0, showParticles: true });
                    player.addEffect('blindness', 160, { amplifier: 0, showParticles: true });
                }
                catch { }
            }
            if (!mainId.startsWith('effect:'))
                continue;
            // 3. Per-sword active/passive behaviors (100% faithful to 2.8.8 / 2.8.14 / 1.6!)
            try {
                switch (mainId) {
                    case 'effect:bee_sword': {
                        // Flowers appear from time to time (3-8s) when walking on grass!
                        const due = nextBeeFlowerTick.get(player.id) ?? 0;
                        if (tick >= due) {
                            nextBeeFlowerTick.set(player.id, tick + 60 + Math.floor(Math.random() * 100));
                            const below = dim.getBlock({
                                x: Math.floor(player.location.x),
                                y: Math.floor(player.location.y) - 1,
                                z: Math.floor(player.location.z),
                            });
                            const foot = dim.getBlock(player.location);
                            if (below?.typeId === 'minecraft:grass_block' && foot?.isAir) {
                                foot.setType(SMALL_FLOWERS[Math.floor(Math.random() * SMALL_FLOWERS.length)]);
                            }
                        }
                        break;
                    }
                    case 'effect:cactus_sword': {
                        // Every 0.5s (10 ticks): pricks wielder for 1 contact dmg & damages very close entities (r = 1.5)!
                        if (tick % 10 === 0) {
                            if (player.getGameMode() !== GameMode.Creative) {
                                player.applyDamage(1, { cause: EntityDamageCause.contact });
                            }
                            for (const e of dim.getEntities({ location: player.location, maxDistance: 1.5 })) {
                                if (!isProtectedEntity(e, player)) {
                                    e.applyDamage(1, { cause: EntityDamageCause.contact, damagingEntity: player });
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:sea_sword': {
                        if (player.isInWater) {
                            if (tick % 10 === 0) {
                                player.addEffect('water_breathing', 100, { amplifier: 0, showParticles: false });
                                player.addEffect('conduit_power', 100, { amplifier: 1, showParticles: false });
                            }
                            // Swim as fast as dolphins!
                            const vel = player.getVelocity();
                            const dir = player.getViewDirection();
                            if (Math.hypot(vel.x, vel.z) > 0.08 && tick % 4 === 0) {
                                player.applyKnockback({ x: dir.x * 0.45, z: dir.z * 0.45 }, dir.y * 0.15);
                            }
                        }
                        else if (tick % 12 === 0 && player.getGameMode() !== GameMode.Creative) {
                            // Mermaid jumps like a fish and suffocates on dry land!
                            const footBlock = dim.getBlock(player.location);
                            if (!footBlock || !footBlock.typeId.includes('water')) {
                                player.applyKnockback({ x: (Math.random() - 0.5) * 0.25, z: (Math.random() - 0.5) * 0.25 }, 0.32);
                                player.applyDamage(1, { cause: EntityDamageCause.drowning });
                                dim.playSound('mob.fish.flop', player.location, { volume: 1.0, pitch: 0.6 });
                            }
                        }
                        break;
                    }
                    case 'effect:ghost_sword': {
                        // Cannot harm any entity + invisible legs + slow_falling + sneak flight + lava/water float + cave wall X-ray!
                        if (tick % 10 === 0) {
                            player.addEffect('weakness', 40, { amplifier: 255, showParticles: false });
                            player.addEffect('slow_falling', 40, { amplifier: 0, showParticles: false });
                            player.addEffect('saturation', 40, { amplifier: 1, showParticles: false });
                        }
                        const footBlock = dim.getBlock(player.location);
                        const inLava = footBlock && (footBlock.typeId === 'minecraft:lava' || footBlock.typeId === 'minecraft:flowing_lava');
                        if (inLava) {
                            player.addEffect('fire_resistance', 30, { amplifier: 0, showParticles: false });
                            player.addEffect('levitation', 10, { amplifier: 1, showParticles: false });
                        }
                        else if (player.isSneaking || player.isInWater) {
                            player.addEffect('levitation', 10, { amplifier: player.isSneaking ? 3 : 0, showParticles: false });
                        }
                        else {
                            player.removeEffect('levitation');
                        }
                        // Getting very close to walls lets player see nearby caves!
                        if (tick % 6 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y + 1);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    for (let dz = -2; dz <= 2; dz++) {
                                        if (dx * dx + dy * dy + dz * dz > 5)
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
                                            b.setPermutation(BlockPermutation.resolve('effect99:spectral_block', { 'effect99:origin': originKey }));
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:ice_sword': {
                        // Exact description: "If the player is on fire the sword will turn into water."
                        if (tick % 4 === 0) {
                            const foot = dim.getBlock(player.location);
                            const onFireComp = player.getComponent('minecraft:onfire');
                            const inLava = foot && (foot.typeId === 'minecraft:lava' || foot.typeId === 'minecraft:flowing_lava');
                            if ((onFireComp || inLava) && player.getGameMode() !== GameMode.Creative) {
                                const eq = player.getComponent(EntityComponentTypes.Equippable);
                                eq?.setEquipment(EquipmentSlot.Mainhand, undefined);
                                if (dim.id !== 'minecraft:nether' && foot && (foot.isAir || foot.typeId.includes('fire') || inLava)) {
                                    foot.setType('minecraft:water');
                                }
                                dim.playSound('random.fizz', player.location, { volume: 1.2, pitch: 0.8 });
                                dim.spawnParticle('minecraft:cauldron_explosion_emitter', player.location);
                                break;
                            }
                            // All water under your feet turns to cracking Fake Ice (exact 2.8.8!)
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dz = -2; dz <= 2; dz++) {
                                    if (dx * dx + dz * dz > 5)
                                        continue;
                                    const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                    if (b && (b.typeId === 'minecraft:water' || b.typeId === 'minecraft:flowing_water')) {
                                        b.setType('effect99:fake_ice');
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:magma_sword': {
                        // Magma blocks won't hurt you (player.json), lava under feet turns into magma blocks!
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
                        // Small fireballs cannot approach within radius 7 + flame particles + water hurts wielder!
                        if (tick % 20 === 0) {
                            dim.spawnParticle('minecraft:mobflame_single', {
                                x: player.location.x + (Math.random() - 0.5) * 0.6,
                                y: player.location.y + 0.2,
                                z: player.location.z + (Math.random() - 0.5) * 0.6,
                            });
                            if (player.isInWater && player.getGameMode() !== GameMode.Creative) {
                                player.applyDamage(1, { cause: EntityDamageCause.drowning });
                            }
                        }
                        if (tick % 2 === 0) {
                            const fireballs = dim.getEntities({
                                location: player.location,
                                maxDistance: 7.0,
                                type: 'minecraft:small_fireball',
                            });
                            for (const fb of fireballs) {
                                if (fb.hasTag('effect_player_shot'))
                                    continue;
                                try {
                                    fb.clearVelocity();
                                    fb.triggerEvent('minecraft:inertia_disable');
                                }
                                catch { }
                            }
                        }
                        break;
                    }
                    case 'effect:fire_sword': {
                        // Exact description: disappears if you enter water, burns very close entities, melts ice and snow!
                        if (player.isInWater && player.getGameMode() !== GameMode.Creative) {
                            const eq = player.getComponent(EntityComponentTypes.Equippable);
                            eq?.setEquipment(EquipmentSlot.Mainhand, undefined);
                            dim.playSound('random.fizz', player.location, { volume: 1.0, pitch: 0.8 });
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', player.location);
                            break;
                        }
                        if (tick % 10 === 0) {
                            for (const e of dim.getEntities({ location: player.location, maxDistance: 2.2 })) {
                                if (!isProtectedEntity(e, player)) {
                                    e.setOnFire(4, true);
                                }
                            }
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dy = -1; dy <= 2; dy++) {
                                    for (let dz = -2; dz <= 2; dz++) {
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (!b)
                                            continue;
                                        if (b.typeId === 'minecraft:snow_layer') {
                                            b.setType('minecraft:air');
                                        }
                                        else if (b.typeId === 'minecraft:ice' ||
                                            b.typeId === 'minecraft:packed_ice' ||
                                            b.typeId === 'minecraft:blue_ice' ||
                                            b.typeId === 'minecraft:frosted_ice' ||
                                            b.typeId === 'effect99:fake_ice' ||
                                            b.typeId === 'minecraft:snow') {
                                            b.setType(dim.id === 'minecraft:nether' ? 'minecraft:air' : 'minecraft:water');
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:bone_sword': {
                        // Enemy arrows within radius 8 slow down + crops grow much faster within 2-block radius!
                        if (tick % 2 === 0) {
                            const arrows = dim.getEntities({
                                location: player.location,
                                maxDistance: 8.0,
                                type: 'minecraft:arrow',
                            });
                            for (const arr of arrows) {
                                if (arr.hasTag('effect_player_shot'))
                                    continue;
                                try {
                                    const vel = arr.getVelocity();
                                    if (Math.hypot(vel.x, vel.y, vel.z) < 0.05)
                                        continue;
                                    arr.clearVelocity();
                                    arr.triggerEvent('minecraft:inertia_disable');
                                }
                                catch { }
                            }
                        }
                        if (tick % 20 === 0) {
                            const grower = dim.spawnEntity('entity:grows_crop', { x: player.location.x, y: player.location.y + 0.1, z: player.location.z }, { spawnEvent: 'grows_crop_event' });
                            system.runTimeout(() => {
                                try {
                                    if (grower.isValid)
                                        grower.remove();
                                }
                                catch { }
                            }, 15);
                        }
                        break;
                    }
                    case 'effect:lapis_sword': {
                        // Exact description: 5 XP in a random period of between 2.5 and 6 seconds (50..120 ticks)
                        const due = nextLapisTick.get(player.id) ?? tick + 60;
                        if (tick >= due) {
                            nextLapisTick.set(player.id, tick + 50 + Math.floor(Math.random() * 70));
                            player.addExperience(5);
                            dim.playSound('random.orb', player.location, { volume: 0.3, pitch: 1.0 });
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
                        // 4 max hearts (player.json) + absorption effect + vines placed on nearby blocks (exact 2.8.8 vine_direction_bits)!
                        if (tick % 30 === 0) {
                            player.addEffect('absorption', 120, { amplifier: 1, showParticles: false });
                            const dirs = [
                                { x: 1, z: 0, bit: 8 },
                                { x: -1, z: 0, bit: 2 },
                                { x: 0, z: 1, bit: 1 },
                                { x: 0, z: -1, bit: 4 },
                            ];
                            const off = dirs[Math.floor(Math.random() * dirs.length)];
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) + 1;
                            const pz = Math.floor(player.location.z);
                            const wall = dim.getBlock({ x: px + off.x, y: py, z: pz + off.z });
                            const centerAir = dim.getBlock({ x: px, y: py, z: pz });
                            if (wall &&
                                (JUNGLE_VINE_SURFACES.has(wall.typeId) || wall.typeId.includes('planks') || wall.typeId.includes('leaves')) &&
                                centerAir &&
                                centerAir.isAir) {
                                centerAir.setPermutation(BlockPermutation.resolve('minecraft:vine', { vine_direction_bits: off.bit }));
                            }
                        }
                        break;
                    }
                    case 'effect:grass_sword': {
                        // Dirt turns into grass + nearby entities within radius 8 on grass are buried/attacked by entity:grass!
                        if (tick % 10 === 0) {
                            const below = dim.getBlock({
                                x: Math.floor(player.location.x),
                                y: Math.floor(player.location.y) - 1,
                                z: Math.floor(player.location.z),
                            });
                            if (below && below.typeId === 'minecraft:dirt') {
                                below.setType('minecraft:grass_block');
                            }
                            for (const target of dim.getEntities({ location: player.location, maxDistance: 8.0 })) {
                                if (isProtectedEntity(target, player) || target.hasTag('grass'))
                                    continue;
                                const tBelow = dim.getBlock({
                                    x: Math.floor(target.location.x),
                                    y: Math.floor(target.location.y - 0.1),
                                    z: Math.floor(target.location.z),
                                });
                                if (tBelow && tBelow.typeId === 'minecraft:grass_block') {
                                    dim.spawnEntity('entity:grass', target.location);
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:emerald_sword': {
                        // Village Hero inside a village & gives villagers Resistance within radius 64!
                        if (tick % 40 === 0) {
                            const villagers = dim.getEntities({
                                location: player.location,
                                maxDistance: 64,
                                type: 'minecraft:villager_v2',
                            });
                            if (villagers.length > 0) {
                                player.addEffect('village_hero', 120, { amplifier: 0, showParticles: false });
                                for (const v of villagers) {
                                    v.addEffect('resistance', 120, { amplifier: 1, showParticles: true });
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:slime_sword': {
                        // Keep companion mountable_slime alive (`slime_despawn = 0`) & teleported near owner if > 12 blocks away!
                        if (tick % 20 === 0) {
                            let slime = playerSlimeMount.get(player.id);
                            if (!slime || !slime.isValid) {
                                slime = dim.spawnEntity('entity:mountable_slime', player.location);
                                playerSlimeMount.set(player.id, slime);
                            }
                            else {
                                try {
                                    world.scoreboard.getObjective('slime_despawn')?.setScore(slime, 0);
                                }
                                catch { }
                                const dist = Math.hypot(slime.location.x - player.location.x, slime.location.z - player.location.z);
                                if (dist > 12) {
                                    slime.teleport(player.location);
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:shulker_sword': {
                        // Immune to levitation effect!
                        player.removeEffect('levitation');
                        // Exact 2.8.8: pressing Sneak enters the Shulker Shell (`shulker_shield`, scale 0.7, damage-immune);
                        // the player stays inside until pressing Sneak again to dismount (or until the 20-HP shell is destroyed)!
                        const existingShield = playerShulkerShield.get(player.id);
                        const ridingComp = player.getComponent(EntityComponentTypes.Riding);
                        const currentlyMountedOn = ridingComp?.entityRidingOn;
                        if (existingShield) {
                            if (!existingShield.isValid || currentlyMountedOn?.id !== existingShield.id) {
                                // Player dismounted via Sneak or shell was destroyed -> restore normal player state!
                                cleanupHelperEntity(playerShulkerShield, player.id);
                                shulkerToggleCooldown.set(player.id, tick + 16);
                                try {
                                    player.triggerEvent('effect:equip_shulker_sword');
                                    dim.playSound('mob.shulker.open', player.location, { volume: 0.9, pitch: 1.0 });
                                }
                                catch { }
                            }
                            else {
                                player.addEffect('resistance', 15, { amplifier: 4, showParticles: false });
                            }
                        }
                        else if (player.isSneaking &&
                            !currentlyMountedOn &&
                            tick >= (shulkerToggleCooldown.get(player.id) ?? 0)) {
                            const shield = dim.spawnEntity('entity:shulker_shield', player.location);
                            try {
                                player.triggerEvent('effect:equip_shulker_hiding');
                            }
                            catch { }
                            const rideable = shield.getComponent(EntityComponentTypes.Rideable);
                            rideable?.addRider(player);
                            playerShulkerShield.set(player.id, shield);
                            shulkerToggleCooldown.set(player.id, tick + 12);
                            dim.playSound('mob.shulker.close', player.location, { volume: 0.9, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:spider_sword': {
                        // Climbing assist on spider mount + re-mount on sneak
                        const spiderMount = playerSpiderMount.get(player.id);
                        if (spiderMount && spiderMount.isValid) {
                            if (spiderMount.isClimbing) {
                                spiderMount.addEffect('levitation', 8, { amplifier: 2, showParticles: false });
                            }
                        }
                        else if (player.isSneaking) {
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
                        // Overhead Ender Crystal follows you everywhere (outside The End so it never beams the Ender Dragon, exact 2.8.8!)
                        if (tick % 20 === 0) {
                            if (dim.id === 'minecraft:the_end') {
                                cleanupHelperEntity(playerSpectralCrystal, player.id, 'effect:despawn');
                            }
                            else {
                                let crystal = playerSpectralCrystal.get(player.id);
                                if (!crystal || !crystal.isValid) {
                                    crystal = dim.spawnEntity('minecraft:ender_crystal', { x: player.location.x, y: player.location.y + 2.0, z: player.location.z }, { spawnEvent: 'effect:spectral_rider' });
                                    const rideable = player.getComponent(EntityComponentTypes.Rideable);
                                    rideable?.addRider(crystal);
                                    playerSpectralCrystal.set(player.id, crystal);
                                }
                            }
                        }
                        // Makes ONLY the main block of the current dimension transparent!
                        if (tick % 6 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y + 1);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -4; dx <= 4; dx++) {
                                for (let dy = -4; dy <= 4; dy++) {
                                    for (let dz = -4; dz <= 4; dz++) {
                                        if (dx * dx + dy * dy + dz * dz > 18)
                                            continue;
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (!b)
                                            continue;
                                        let originKey;
                                        if (dim.id === 'minecraft:overworld') {
                                            if (b.typeId === 'minecraft:stone')
                                                originKey = 'stone';
                                            else if (b.typeId === 'minecraft:deepslate')
                                                originKey = 'deepslate';
                                        }
                                        else if (dim.id === 'minecraft:nether') {
                                            if (b.typeId === 'minecraft:netherrack')
                                                originKey = 'netherrack';
                                        }
                                        else if (dim.id === 'minecraft:the_end') {
                                            if (b.typeId === 'minecraft:end_stone')
                                                originKey = 'end_stone';
                                        }
                                        if (originKey) {
                                            b.setPermutation(BlockPermutation.resolve('effect99:spectral_block', { 'effect99:origin': originKey }));
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:wither_sword': {
                        if (tick % 20 === 0) {
                            // Decorative "Wither Sword" bossbar & dark sky via entity:name!
                            let bossEnt = playerWitherBossbar.get(player.id);
                            if (!bossEnt || !bossEnt.isValid) {
                                bossEnt = dim.spawnEntity('entity:name', { x: player.location.x, y: player.location.y + 1.5, z: player.location.z }, { spawnEvent: 'minecraft:wither_sword' });
                                const rideable = player.getComponent(EntityComponentTypes.Rideable);
                                rideable?.addRider(bossEnt);
                                playerWitherBossbar.set(player.id, bossEnt);
                            }
                            // Decorative wither effect (player.json makes wielder 100% immune to wither damage!)
                            player.addEffect('wither', 60, { amplifier: 0, showParticles: false });
                            // Leaves wither, flowers turn into wither roses, grass turns to dirt!
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -3; dx <= 3; dx++) {
                                for (let dy = -1; dy <= 3; dy++) {
                                    for (let dz = -3; dz <= 3; dz++) {
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (!b)
                                            continue;
                                        if (SMALL_FLOWER_SET.has(b.typeId)) {
                                            b.setType('minecraft:wither_rose');
                                        }
                                        else if (b.typeId === 'minecraft:grass_block' && Math.random() < 0.25) {
                                            b.setType('minecraft:dirt');
                                        }
                                        else if (b.typeId.includes('leaves') && Math.random() < 0.2) {
                                            b.setType('minecraft:air');
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:wolf_sword': {
                        if (world.getMoonPhase() === MoonPhase.FullMoon &&
                            timeOfDay >= 12000 &&
                            timeOfDay < 13000 &&
                            tick % 60 === 0) {
                            // Sunset dizziness before Full Moon night (exact 2.8.8 tellraw1.mcfunction)!
                            player.addEffect('nausea', 100, { amplifier: 0, showParticles: false });
                            player.onScreenDisplay.setActionBar('§fFor some reason you feel nauseous...');
                        }
                        else if (fullMoon && tick % 20 === 0) {
                            werewolfCursedPlayers.delete(player.id);
                            player.addEffect('speed', 60, { amplifier: 2, showParticles: false });
                            player.addEffect('jump_boost', 60, { amplifier: 2, showParticles: false });
                            if (Math.random() < 0.15) {
                                dim.playSound('mob.wolf.growl', player.location, { volume: 1.0, pitch: 0.9 });
                            }
                        }
                        break;
                    }
                    case 'effect:ultra_instinct_sword': {
                        if (tick % 6 === 0) {
                            player.addEffect('speed', 40, { amplifier: 3, showParticles: false });
                            dim.spawnParticle('minecraft:balloon_gas_particle', {
                                x: player.location.x + (Math.random() - 0.5) * 0.6,
                                y: player.location.y + Math.random() * 2.0,
                                z: player.location.z + (Math.random() - 0.5) * 0.6,
                            });
                            if (tick % 24 === 0) {
                                dim.playSound('mob.wither.spawn', player.location, { volume: 0.35, pitch: 0.3 });
                            }
                        }
                        break;
                    }
                    case 'effect:time_sword': {
                        // Time advances faster, player & all entities move much faster, plants grow much faster!
                        anyTimeSword = true;
                        world.setTimeOfDay((world.getTimeOfDay() + 30) % 24000);
                        if (tick % 15 === 0) {
                            player.addEffect('speed', 40, { amplifier: 3, showParticles: false });
                            for (const e of dim.getEntities({ location: player.location, maxDistance: 24 })) {
                                if (e.typeId !== 'minecraft:item' && e.typeId !== 'minecraft:xp_orb') {
                                    try {
                                        e.addEffect('speed', 40, { amplifier: 2, showParticles: false });
                                    }
                                    catch { }
                                }
                            }
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
        // Handle Winged Mountable Slime landing stomp AoE ONLY when landing from a jump while ridden!
        if (tick % 3 === 0) {
            for (const dimName of ['overworld', 'nether', 'the_end']) {
                try {
                    const dim = world.getDimension(dimName);
                    const mounts = dim.getEntities({ type: 'entity:mountable_slime' });
                    for (const slime of mounts) {
                        const rideable = slime.getComponent(EntityComponentTypes.Rideable);
                        const riders = rideable?.getRiders() ?? [];
                        if (riders.length === 0) {
                            airborneSlimeIds.delete(slime.id);
                            continue; // Keep alive in defense_mode_slime!
                        }
                        const rider = riders[0];
                        if (!slime.isOnGround) {
                            airborneSlimeIds.add(slime.id);
                        }
                        else if (airborneSlimeIds.delete(slime.id)) {
                            dim.playSound('mob.slime.big', slime.location, { volume: 0.9, pitch: 0.9 });
                            for (const victim of dim.getEntities({ location: slime.location, maxDistance: 2.6 })) {
                                if (victim.id !== slime.id && !isProtectedEntity(victim, rider)) {
                                    victim.applyDamage(6, { cause: EntityDamageCause.entityAttack, damagingEntity: rider });
                                }
                            }
                        }
                    }
                }
                catch { }
            }
        }
    }, 1);
}
