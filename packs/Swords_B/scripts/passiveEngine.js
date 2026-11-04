import { BlockPermutation, EntityComponentTypes, EntityDamageCause, EquipmentSlot, GameMode, MoonPhase, system, world, } from '@minecraft/server';
import { BRIGHT_LIGHT_SWORDS, LIGHT_EMITTING_SWORDS } from './blockComponents.js';
import { resetSpongeSwordState, tryConvertSpongeSword } from './swordSkills.js';
import { recoverRandomTickSpeed, setTimeSwordActive } from './randomTickManager.js';
import { getMainhandItem, getOffhandItem, isFullMoonNight, isInVillage, isProtectedEntity, } from './utils.js';
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
    'time_sword',
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
// Exact 2.8.8 `bee_sword_flower`: eight equal-weight `setblock ~ ~ ~ red_flower <0..7>`,
// i.e. poppy, blue orchid, allium, azure bluet, red, orange, white and pink tulips.
const SMALL_FLOWERS = [
    'minecraft:poppy',
    'minecraft:blue_orchid',
    'minecraft:allium',
    'minecraft:azure_bluet',
    'minecraft:red_tulip',
    'minecraft:orange_tulip',
    'minecraft:white_tulip',
    'minecraft:pink_tulip',
];
const SMALL_FLOWER_SET = new Set([...SMALL_FLOWERS, 'minecraft:torchflower']);
// Exact 2.8.8 `jungle_sword.mcfunction`: the surfaces it `detect`s next to the
// player's head block, expanded from the legacy ids to modern block names.
//   log 0..3 -> oak/spruce/birch/jungle, log2 0..1 -> acacia/dark_oak,
//   planks 0..5, leaves 0..3 + 11, leaves2 0..1, stone 0/1/3/5 (granite,
//   diorite, andesite), grass, dirt, sand, sandstone, snow, cobblestone,
//   obsidian, end_stone, gravel, packed_ice, ice, glass, netherrack, nether_brick.
const JUNGLE_VINE_SURFACES = new Set([
    'minecraft:oak_log',
    'minecraft:spruce_log',
    'minecraft:birch_log',
    'minecraft:jungle_log',
    'minecraft:acacia_log',
    'minecraft:dark_oak_log',
    'minecraft:oak_planks',
    'minecraft:spruce_planks',
    'minecraft:birch_planks',
    'minecraft:jungle_planks',
    'minecraft:acacia_planks',
    'minecraft:dark_oak_planks',
    'minecraft:oak_leaves',
    'minecraft:spruce_leaves',
    'minecraft:birch_leaves',
    'minecraft:jungle_leaves',
    'minecraft:acacia_leaves',
    'minecraft:dark_oak_leaves',
    'minecraft:stone',
    'minecraft:granite',
    'minecraft:diorite',
    'minecraft:andesite',
    'minecraft:grass_block',
    'minecraft:dirt',
    'minecraft:sand',
    'minecraft:sandstone',
    'minecraft:snow_layer',
    'minecraft:cobblestone',
    'minecraft:obsidian',
    'minecraft:end_stone',
    'minecraft:gravel',
    'minecraft:packed_ice',
    'minecraft:ice',
    'minecraft:glass',
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
    const isBright = BRIGHT_LIGHT_SWORDS.has(mainId) ||
        offId === 'effect:glowstone_sword' ||
        offId === 'effect:fire_sword';
    const isLight = isBright || LIGHT_EMITTING_SWORDS.has(mainId);
    if (!isLight) {
        clearTrackedLight(player.id);
        return;
    }
    // Exact 2.8.8: Glowstone/Fire/Ultra Instinct use `lightblock` (level 15); Blaze/Lightning/Time/Wither/Spectral use `lightblock2` (level 11)
    const targetType = isBright ? 'effect99:lightblock' : 'effect99:lightblock2';
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
        prev.loc.z === headLoc.z &&
        prev.typeId === targetType) {
        return;
    }
    clearTrackedLight(player.id);
    try {
        const b = player.dimension.getBlock(headLoc);
        if (b && b.isAir) {
            b.setType(targetType);
            lastLightBlock.set(player.id, { dim: player.dimension, loc: headLoc, typeId: targetType });
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
// A mount belongs to one player; never claim an arbitrary nearby player's mount.
export function mountPlayerSlime(player) {
    let slime = playerSlimeMount.get(player.id);
    if (!slime || !slime.isValid || slime.dimension.id !== player.dimension.id) {
        cleanupHelperEntity(playerSlimeMount, player.id, 'despawn');
        slime = player.dimension.spawnEntity('entity:mountable_slime', player.location, {
            spawnEvent: 'minecraft:entity_spawned',
        });
        playerSlimeMount.set(player.id, slime);
    }
    slime.triggerEvent('default_slime');
    const rideable = slime.getComponent(EntityComponentTypes.Rideable);
    rideable?.addRider(player);
}
function cleanupAllHelpersForPlayer(playerId) {
    clearTrackedLight(playerId);
    cleanupHelperEntity(playerShulkerShield, playerId);
    cleanupHelperEntity(playerWitherBossbar, playerId);
    cleanupHelperEntity(playerSpectralCrystal, playerId, 'effect:despawn');
    cleanupHelperEntity(playerSpiderMount, playerId, 'effect:despawn_mount');
    cleanupHelperEntity(playerSlimeMount, playerId, 'despawn');
}
export function startPassiveEngine() {
    let tick = 0;
    recoverRandomTickSpeed();
    // Lifecycle cleanup on disconnect, respawn, world-rejoin, and portal dimension travel
    world.afterEvents.playerLeave.subscribe((ev) => {
        cleanupAllHelpersForPlayer(ev.playerId);
        lastEquipKey.delete(ev.playerId);
        lastMainhandId.delete(ev.playerId);
        shulkerToggleCooldown.delete(ev.playerId);
        nextLapisTick.delete(ev.playerId);
        nextBeeFlowerTick.delete(ev.playerId);
        werewolfCursedPlayers.delete(ev.playerId);
    });
    world.afterEvents.playerDimensionChange.subscribe((ev) => {
        const pid = ev.player.id;
        cleanupAllHelpersForPlayer(pid);
        lastEquipKey.delete(pid);
        lastMainhandId.delete(pid);
    });
    world.afterEvents.playerSpawn.subscribe((ev) => {
        const p = ev.player;
        lastEquipKey.delete(p.id);
        lastMainhandId.delete(p.id);
        // Timers must restart with the new life; otherwise the first Lapis/Bee tick
        // after a respawn is measured against a `tick` value from before the death and
        // the passive appears to hang for one whole interval.
        nextLapisTick.delete(p.id);
        nextBeeFlowerTick.delete(p.id);
        resetSpongeSwordState(p.id);
        if (!ev.initialSpawn) {
            werewolfCursedPlayers.delete(p.id);
            cleanupAllHelpersForPlayer(p.id);
        }
    });
    // The 2.8.8 component timers are measured in game ticks, so the engine must
    // tick at 20 Hz; the default (every game tick) is exactly that.
    // Exact 2.8.8 `minecraft:jungle_sword` event: fires once when the sword is held
    // — `effect @s absorption 1 2 true` plus the `jungle_sword` mcfunction, which
    // checks one random direction and grows a vine on the player's head block.
    const runJungleSwordEvent = (player) => {
        try {
            player.addEffect('absorption', 20, { amplifier: 1, showParticles: false });
        }
        catch { }
        const dim = player.dimension;
        const dirs = [
            { x: 1, z: 0, bit: 8 },
            { x: -1, z: 0, bit: 2 },
            { x: 0, z: 1, bit: 1 },
            { x: 0, z: -1, bit: 4 },
        ];
        const px = Math.floor(player.location.x);
        const py = Math.floor(player.location.y) + 1;
        const pz = Math.floor(player.location.z);
        // The mcfunction runs all four `detect`s in this order; each `fill ... replace
        // air` stops as soon as the head block is no longer air, so the first matching
        // side wins and only one vine is placed per equip.
        try {
            const center = dim.getBlock({ x: px, y: py, z: pz });
            if (!center || !center.isAir)
                return;
            for (const off of dirs) {
                const wall = dim.getBlock({ x: px + off.x, y: py, z: pz + off.z });
                if (wall && JUNGLE_VINE_SURFACES.has(wall.typeId)) {
                    center.setPermutation(BlockPermutation.resolve('minecraft:vine', { vine_direction_bits: off.bit }));
                    break;
                }
            }
        }
        catch { }
    };
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
                if (prevMainId === 'effect:lapis_sword' && mainId !== prevMainId)
                    nextLapisTick.delete(player.id);
                if (mainId === 'effect:jungle_sword' && prevMainId !== 'effect:jungle_sword') {
                    runJungleSwordEvent(player);
                }
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
                        mountPlayerSlime(player);
                    }
                    catch { }
                }
                // Exact 2.8.8 equip/unequip FX & effect cleanups
                if ((mainId === 'effect:ultra_instinct_sword' || prevMainId === 'effect:ultra_instinct_sword') &&
                    mainId !== prevMainId) {
                    try {
                        dim.spawnParticle('minecraft:example_flipbook', player.location);
                        dim.spawnParticle('minecraft:example_flipbook', {
                            x: player.location.x,
                            y: player.location.y + 1.5,
                            z: player.location.z,
                        });
                        dim.playSound('mob.wither.ambient', player.location, { volume: 2.0, pitch: 0.6 });
                    }
                    catch { }
                }
                if (mainId === 'effect:lightning_sword' && prevMainId !== 'effect:lightning_sword') {
                    // Exact 2.8.8: equipping fires `summon lightning_bolt ~ 255 ~
                    // default_lightning_bolt` — one cosmetic bolt high above the player.
                    try {
                        dim.spawnEntity('minecraft:lightning_bolt', {
                            x: player.location.x,
                            y: Math.min(dim.heightRange.max - 2, 255),
                            z: player.location.z,
                        });
                    }
                    catch { }
                }
                if ((mainId === 'effect:blaze_sword' || prevMainId === 'effect:blaze_sword') && mainId !== prevMainId) {
                    try {
                        dim.spawnParticle('minecraft:example_linearcurve', {
                            x: player.location.x,
                            y: player.location.y + 1.0,
                            z: player.location.z,
                        });
                        for (const [ox, oy, oz] of [
                            [0, 0, 0],
                            [0, 1, 0],
                            [0.4, 0.5, 0],
                            [-0.4, 1.2, 0],
                            [0, 0.8, 0.4],
                            [0, 0.3, -0.4],
                        ]) {
                            dim.spawnParticle('minecraft:mobflame_single', {
                                x: player.location.x + ox,
                                y: player.location.y + oy,
                                z: player.location.z + oz,
                            });
                        }
                        dim.playSound('random.fizz', player.location, { volume: 0.9, pitch: 1.0 });
                        if (prevMainId === 'effect:blaze_sword') {
                            player.removeEffect('levitation');
                            player.removeEffect('slow_falling');
                        }
                    }
                    catch { }
                }
                if ((mainId === 'effect:sea_sword' || prevMainId === 'effect:sea_sword') && mainId !== prevMainId) {
                    try {
                        dim.spawnParticle('minecraft:example_bounce', player.location);
                        dim.playSound('random.splash', player.location, { volume: 0.5, pitch: 1.0 });
                        if (prevMainId === 'effect:sea_sword') {
                            player.removeEffect('conduit_power');
                            player.removeEffect('water_breathing');
                        }
                    }
                    catch { }
                }
                if (mainId === 'effect:ender_sword' && prevMainId !== 'effect:ender_sword') {
                    try {
                        dim.playSound('mob.endermen.portal', player.location, { volume: 0.9, pitch: 1.0 });
                    }
                    catch { }
                }
                if (mainId === 'effect:wither_sword' && prevMainId !== 'effect:wither_sword') {
                    try {
                        dim.playSound('mob.wither.spawn', player.location, { volume: 0.9, pitch: 1.0 });
                    }
                    catch { }
                }
                if (prevMainId === 'effect:emerald_sword' && mainId !== 'effect:emerald_sword') {
                    try {
                        player.removeEffect('village_hero');
                    }
                    catch { }
                }
                // Auto-summon Wall-Climbing Spider Mount when equipping Spider Sword!
                if (mainId === 'effect:spider_sword' && prevMainId !== 'effect:spider_sword') {
                    try {
                        cleanupHelperEntity(playerSpiderMount, player.id, 'effect:despawn_mount');
                        const spider = dim.spawnEntity('minecraft:spider', player.location, {
                            spawnEvent: 'effect:spider_sword',
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
                        // Exact 2.8.8 `minecraft:bee_sword` timer: `time [3, 8]`, looping,
                        // randomInterval. `bee_sword_flower` then picks one of the eight
                        // `red_flower` data values and only places it on top of grass.
                        const due = nextBeeFlowerTick.get(player.id) ?? 0;
                        if (tick >= due) {
                            nextBeeFlowerTick.set(player.id, tick + 60 + Math.floor(Math.random() * 101));
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
                        // Exact 2.8.8 `cactus_sword_skills` (timer 0.5 s): `damage @e[r=1.4] 1
                        // contact` and `damage @s 1 contact` — the radius is 1.4, not 1.5.
                        if (tick % 10 === 0) {
                            if (player.getGameMode() !== GameMode.Creative) {
                                player.applyDamage(1, { cause: EntityDamageCause.contact });
                            }
                            for (const e of dim.getEntities({ location: player.location, maxDistance: 1.4 })) {
                                if (!isProtectedEntity(e, player)) {
                                    e.applyDamage(1, { cause: EntityDamageCause.contact, damagingEntity: player });
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:sea_sword': {
                        // Exact 2.8.8 `minecraft:sea_sword`: a 0.5 s timer drives the whole
                        // group. In water: conduction 1 s renewed every timer tick. Out of
                        // water: `camerashake` + `conduit_power 0` and the fish flop sound.
                        // Suffocation and the 0.06/0.07 mermaid speeds come from the
                        // component group itself, not from damage applied here.
                        if (player.isInWater) {
                            if (tick % 10 === 0) {
                                player.addEffect('conduit_power', 20, { amplifier: 0, showParticles: false });
                            }
                        }
                        else if (tick % 10 === 0) {
                            try {
                                player.runCommand('camerashake add @s 0.01 1 positional');
                            }
                            catch { }
                            try {
                                player.removeEffect('conduit_power');
                            }
                            catch { }
                            dim.playSound('mob.fish.flop', player.location, { volume: 1.0, pitch: 0.6 });
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
                        // Exact 2.8.8 `minecraft:ice_sword`: in lava the sword is destroyed
                        // (`setblock ~ ~ ~ flowing_water` in non-Nether biomes first).
                        if (tick % 4 === 0) {
                            const foot = dim.getBlock(player.location);
                            const inLava = !!foot && (foot.typeId === 'minecraft:lava' || foot.typeId === 'minecraft:flowing_lava');
                            if (inLava) {
                                const eq = player.getComponent(EntityComponentTypes.Equippable);
                                eq?.setEquipment(EquipmentSlot.Mainhand, undefined);
                                if (dim.id !== 'minecraft:nether' && foot) {
                                    foot.setType('minecraft:flowing_water');
                                }
                                dim.playSound('random.fizz', player.location, { volume: 1.2, pitch: 0.8 });
                                dim.spawnParticle('minecraft:cauldron_explosion_emitter', player.location);
                                break;
                            }
                            // Every tick the sword also freezes the water in its footprint:
                            // a 5x5 square plus the four 3-block arms, all at foot level -1.
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            const freeze = (dx, dz) => {
                                const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                if (!b || (b.typeId !== 'minecraft:water' && b.typeId !== 'minecraft:flowing_water'))
                                    return;
                                const isSource = b.typeId === 'minecraft:water' &&
                                    (b.permutation.getState('liquid_depth') ?? 0) === 0;
                                b.setPermutation(BlockPermutation.resolve('effect99:fake_ice', {
                                    'effect99:crack_stage': 0,
                                    'effect99:from_water': isSource,
                                }));
                            };
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dz = -2; dz <= 2; dz++)
                                    freeze(dx, dz);
                            }
                            for (let d = -2; d <= 2; d++) {
                                freeze(3, d);
                                freeze(-3, d);
                                freeze(d, 3);
                                freeze(d, -3);
                            }
                        }
                        break;
                    }
                    case 'effect:magma_sword': {
                        // Magma blocks won't hurt you (player.json), lava under feet turns into magma blocks + underwater bubble FX!
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
                        if (tick % 16 === 0) {
                            dim.spawnParticle('minecraft:guardian_attack_particle', {
                                x: player.location.x,
                                y: player.location.y + 0.9,
                                z: player.location.z,
                            });
                            if (player.isInWater && Math.random() < 0.25) {
                                dim.playSound('bubble.up', player.location, { volume: 1.0, pitch: 0.9 });
                            }
                        }
                        break;
                    }
                    case 'effect:blaze_sword': {
                        // Small fireballs cannot approach within radius 7 + flame particles (water & rain damage handled natively in player.json!)
                        if (tick % 20 === 0) {
                            dim.spawnParticle('minecraft:mobflame_single', {
                                x: player.location.x + (Math.random() - 0.5) * 0.6,
                                y: player.location.y + 0.2,
                                z: player.location.z + (Math.random() - 0.5) * 0.6,
                            });
                            if (Math.random() < 0.25) {
                                dim.playSound('mob.blaze.breathe', player.location, { volume: 0.5, pitch: 1.0 });
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
                            // The equip event already melts snow/ice and sets nearby mobs alight;
                            // its `fire_sword_sound` timer only replays the crackle every 0.2–0.7 s.
                            if (Math.random() < 0.5) {
                                dim.playSound('fire.fire', player.location, { volume: 0.6, pitch: 1.0 });
                            }
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
                        // `bone_sword_skills` timer is 1 s, i.e. one `entity:grows_crop` per 20 ticks.
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
                        // Exact 2.8.8 timer: `time [2.5, 6.0]`, looping, randomInterval — one
                        // `xp 5 @s` + `playsound random.orb` per 50..120 ticks.
                        let due = nextLapisTick.get(player.id);
                        if (due === undefined) {
                            due = tick + 50 + Math.floor(Math.random() * 71);
                            nextLapisTick.set(player.id, due);
                        }
                        if (tick >= due) {
                            nextLapisTick.set(player.id, tick + 50 + Math.floor(Math.random() * 71));
                            player.addExperience(5);
                            dim.playSound('random.orb', player.location, { volume: 0.3, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:sponge_sword': {
                        // Exact 2.8.8 keeps a counter that converts the sword at 150–160
                        // ticks of absorbing; two engine ticks per step keeps that under
                        // fifteen seconds instead of over a minute.
                        if (tick % 2 === 0) {
                            tryConvertSpongeSword(player);
                        }
                        break;
                    }
                    case 'effect:grass_sword': {
                        // Exact 2.8.8 `minecraft:grass_sword` timer (0.2 s = 4 ticks):
                        // `tag @e[tag=grass,rm=9,r=10] remove grass`,
                        // `fill ~2 ~-1 ~2 ~-2 ~-1 ~-2 grass 0 replace dirt` (flat, foot -1),
                        // `detect ~ ~-1 ~ grass` -> `fill ~ ~ ~ ~ ~ ~ tallgrass 0 replace air`,
                        // then the `grass_sword_skills` pass buries mobs up to r=8.
                        if (tick % 4 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dz = -2; dz <= 2; dz++) {
                                    const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                    if (b && b.typeId === 'minecraft:dirt') {
                                        b.setType('minecraft:grass_block');
                                    }
                                }
                            }
                            const foot = dim.getBlock({ x: px, y: py + 1, z: pz });
                            const below = dim.getBlock({ x: px, y: py, z: pz });
                            // `~ ~-1 ~` is the same block the 5x5 fill just turned to grass, so it
                            // is always `grass` here; no chance roll in the original.
                            if (below?.typeId === 'minecraft:grass_block' && foot?.isAir) {
                                foot.setType('minecraft:short_grass');
                            }
                            for (const target of dim.getEntities({ location: player.location, maxDistance: 13.0 })) {
                                const dist = Math.hypot(target.location.x - player.location.x, target.location.y - player.location.y, target.location.z - player.location.z);
                                if (dist > 8.5) {
                                    if (target.hasTag('grass')) {
                                        try {
                                            target.removeTag('grass');
                                        }
                                        catch { }
                                    }
                                    continue;
                                }
                                if (isProtectedEntity(target, player) || target.hasTag('grass'))
                                    continue;
                                const tBelow = dim.getBlock({
                                    x: Math.floor(target.location.x),
                                    y: Math.floor(target.location.y - 0.1),
                                    z: Math.floor(target.location.z),
                                });
                                if (tBelow && tBelow.typeId === 'minecraft:grass_block') {
                                    dim.spawnEntity('entity:grass', target.location);
                                    // Original grass_sword_skills tags buried entities with `grass`
                                    // and removes the tag beyond r=9; without it the same mob spawns
                                    // another grass block every 0.5 s.
                                    try {
                                        target.addTag('grass');
                                    }
                                    catch { }
                                }
                            }
                        }
                        break;
                    }
                    case 'effect:emerald_sword': {
                        // Exact 2.8.8: `is_in_village` gates the whole thing; inside a village
                        // the holder gets Village Hero and every villager within 64 blocks
                        // gets Resistance I for one second, re-applied every tick.
                        if (!isInVillage(player))
                            break;
                        try {
                            player.addEffect('village_hero', 20, { amplifier: 0, showParticles: false });
                        }
                        catch { }
                        for (const v of dim.getEntities({
                            location: player.location,
                            maxDistance: 64,
                            families: ['villager'],
                        })) {
                            try {
                                v.addEffect('resistance', 20, { amplifier: 0, showParticles: false });
                            }
                            catch { }
                        }
                        break;
                    }
                    case 'effect:slime_sword': {
                        // Keep companion mountable_slime alive (`slime_despawn = 0`) & teleported near owner if > 12 blocks away!
                        if (tick % 10 === 0) {
                            let slime = playerSlimeMount.get(player.id);
                            if (!slime || !slime.isValid) {
                                slime = dim.spawnEntity('entity:mountable_slime', player.location, {
                                    spawnEvent: 'minecraft:entity_spawned',
                                });
                                playerSlimeMount.set(player.id, slime);
                            }
                            try {
                                world.scoreboard.getObjective('slime_despawn')?.setScore(slime, 0);
                            }
                            catch { }
                            const dist = Math.hypot(slime.location.x - player.location.x, slime.location.z - player.location.z);
                            if (dist > 12) {
                                slime.teleport(player.location);
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
                                    spawnEvent: 'effect:spider_sword',
                                });
                                const rideable = spider.getComponent(EntityComponentTypes.Rideable);
                                rideable?.addRider(player);
                                playerSpiderMount.set(player.id, spider);
                            }
                        }
                        break;
                    }
                    case 'effect:ender_sword': {
                        if (tick % 8 === 0) {
                            dim.spawnParticle('minecraft:end_chest', {
                                x: player.location.x,
                                y: player.location.y + 0.6,
                                z: player.location.z,
                            });
                        }
                        if (tick % 160 === 0 && Math.random() < 0.45) {
                            const snds = ['mob.endermen.idle', 'mob.endermen.stare', 'mob.endermen.scream'];
                            dim.playSound(snds[Math.floor(Math.random() * snds.length)], player.location, {
                                volume: 0.7,
                                pitch: 1.0,
                            });
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
                                    const rideable = player.getComponent(EntityComponentTypes.Rideable);
                                    const existingRider = rideable
                                        ?.getRiders()
                                        .find((r) => r.typeId === 'minecraft:ender_crystal');
                                    if (existingRider) {
                                        crystal = existingRider;
                                    }
                                    else {
                                        crystal = dim.spawnEntity('minecraft:ender_crystal', { x: player.location.x, y: player.location.y + 2.0, z: player.location.z }, { spawnEvent: 'effect:spectral_rider' });
                                        rideable?.addRider(crystal);
                                    }
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
                                const rideable = player.getComponent(EntityComponentTypes.Rideable);
                                const existingRider = rideable?.getRiders().find((r) => r.typeId === 'entity:name');
                                if (existingRider) {
                                    bossEnt = existingRider;
                                }
                                else {
                                    bossEnt = dim.spawnEntity('entity:name', { x: player.location.x, y: player.location.y + 1.5, z: player.location.z }, { spawnEvent: 'minecraft:wither_sword' });
                                    rideable?.addRider(bossEnt);
                                }
                                playerWitherBossbar.set(player.id, bossEnt);
                            }
                            // Decorative wither effect (player.json makes wielder 100% immune to wither damage!)
                            player.addEffect('wither', 60, { amplifier: 0, showParticles: false });
                            if (tick % 160 === 0 && Math.random() < 0.45) {
                                dim.playSound(Math.random() < 0.5 ? 'mob.wither.hurt' : 'mob.wither.death', player.location, {
                                    volume: 0.6,
                                    pitch: 1.0,
                                });
                            }
                            // Leaves & vines wither, flowers & mushrooms turn into wither roses, grass -> coarse_dirt, farmland -> dirt, ice -> water!
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y);
                            const pz = Math.floor(player.location.z);
                            for (let dx = -3; dx <= 3; dx++) {
                                for (let dy = -1; dy <= 3; dy++) {
                                    for (let dz = -3; dz <= 3; dz++) {
                                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                        if (!b)
                                            continue;
                                        const bt = b.typeId;
                                        if (SMALL_FLOWER_SET.has(bt) ||
                                            bt === 'minecraft:red_mushroom' ||
                                            bt === 'minecraft:brown_mushroom') {
                                            b.setType('minecraft:wither_rose');
                                        }
                                        else if (bt === 'minecraft:grass_block' && Math.random() < 0.25) {
                                            b.setType('minecraft:coarse_dirt');
                                        }
                                        else if (bt === 'minecraft:farmland' && Math.random() < 0.25) {
                                            b.setType('minecraft:dirt');
                                        }
                                        else if ((bt.includes('leaves') || bt === 'minecraft:vine') && Math.random() < 0.2) {
                                            b.setType('minecraft:air');
                                        }
                                        else if (bt === 'minecraft:ice' && Math.random() < 0.25) {
                                            b.setType(dim.id === 'minecraft:nether' ? 'minecraft:air' : 'minecraft:water');
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
                        // Exact 2.8.8 `minecraft:ultra_instinct_sword` timer: `time [0.1, 0.2]`,
                        // randomInterval, re-applied continuously — camerashake for everyone
                        // nearby plus removal of eight debuffs from the holder.
                        if (tick % 6 === 0) {
                            try {
                                player.runCommand('camerashake add @a[r=32] 0.1 0.016 positional');
                            }
                            catch { }
                            for (const debuff of [
                                'hunger',
                                'blindness',
                                'slowness',
                                'weakness',
                                'mining_fatigue',
                                'nausea',
                                'wither',
                                'instant_damage',
                            ]) {
                                try {
                                    player.removeEffect(debuff);
                                }
                                catch { }
                            }
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
                        // Exact 2.8.8 `minecraft:time_sword` event:
                        //   gamerule randomtickspeed 300, effect @e[type=!player] speed 1 15,
                        //   time add 30, movement 1. The holder themselves gets no Speed
                        //   effect — their walk speed comes from the component group.
                        anyTimeSword = true;
                        world.setTimeOfDay((world.getTimeOfDay() + 30) % 24000);
                        if (tick % 10 === 0) {
                            for (const e of dim.getEntities({ location: player.location, maxDistance: 32 })) {
                                if (e.typeId === 'minecraft:player' || e.typeId === 'minecraft:item' || e.typeId === 'minecraft:xp_orb') {
                                    continue;
                                }
                                try {
                                    // `effect ... speed 1 15 true` = 1 s, amplifier 15.
                                    e.addEffect('speed', 20, { amplifier: 15, showParticles: false });
                                }
                                catch { }
                            }
                        }
                        break;
                    }
                }
            }
            catch { }
        }
        setTimeSwordActive(anyTimeSword);
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
