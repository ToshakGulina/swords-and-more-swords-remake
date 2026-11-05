import { BlockPermutation, EntityComponentTypes, EntityDamageCause, EquipmentSlot, GameMode, MoonPhase, system, world, } from '@minecraft/server';
import { BRIGHT_LIGHT_SWORDS, BRIGHT_LIGHT_TYPE, DIM_LIGHT_TYPE, lightVolumeForSword, } from './blockComponents.js';
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
const nextLapisTick = new Map();
const nextBeeFlowerTick = new Map();
// 2.8.8 drives the Ender and Wither Sword ambience from a random-interval
// timer (`time [6, 18]` and `time [4, 18]`), so each player needs a due tick.
const nextEnderSoundTick = new Map();
const nextWitherSoundTick = new Map();
const werewolfCursedPlayers = new Set();
// Wolf Sword animation-controller state: whether the Full Moon transformation
// is active, whether the 0.20/0.80 startup line was already shown tonight, and
// the next `wolf_sword_sounds` growl (`time [3, 6]`).
const werewolfTransformed = new Set();
const werewolfStartupShown = new Map();
const nextWolfGrowlTick = new Map();
// `minecraft:sea_sword`'s equip branch (`is_family != sea_sword`) fires once.
const seaSwordEquipped = new Set();
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
/**
 * The overhead Ender Crystal of the Spectral Sword.
 *
 * 2.8.8 never tracks it in a map: every target is an entity selector.
 * `spectral_sword_skills` summons `ender_crystal ~ ~1.8 ~ minecraft:detect_player`
 * on a 0.4 s timer unless the biome is the End; that group adds an
 * `environment_sensor` which fires `ride_player` (`ride @s start_riding
 * @p[family=spectral_sword,r=3] teleport_rider`) as soon as it is spawned;
 * `mount_crystal` then swaps it to the `spectral_sword` family;
 * `spectral_sword` on the item calls `event entity
 * @e[type=ender_crystal,family=!ender_crystal_default,family=!ender_crystal_scale,c=1,r=4]
 * minecraft:ender_crystal_scale` (18 s ageable back to full size) and the `weapon`
 * 1 % branch calls `minecraft:crystal_explode` on the same selector.
 *
 * The remake looked the crystal up through the player's riders, and the crystal it
 * spawned was never actually riding, so the explosions silently did nothing.
 * Selector-by-family is the faithful lookup, so use it everywhere.
 */
function findOverheadCrystal(player, maxDistance = 4) {
    try {
        return player.dimension
            .getEntities({
            location: player.location,
            maxDistance,
            type: 'minecraft:ender_crystal',
            excludeFamilies: ['ender_crystal_default', 'ender_crystal_scale'],
        })
            .find((e) => e.isValid);
    }
    catch {
        return undefined;
    }
}
function clearTrackedLight(playerId) {
    const prev = lastLightBlock.get(playerId);
    if (!prev)
        return;
    lastLightBlock.delete(playerId);
    for (const loc of prev.locs) {
        try {
            const b = prev.dim.getBlock(loc);
            if (b && (b.typeId === BRIGHT_LIGHT_TYPE || b.typeId === DIM_LIGHT_TYPE)) {
                b.setType('minecraft:air');
            }
        }
        catch { }
    }
}
function updateDynamicLight(player, mainId, offId) {
    // 2.8.8 re-ran the two `fill` commands on every environment_sensor tick, so the
    // volume tracked the player while the sword was held.
    const volume = lightVolumeForSword(mainId, offId);
    if (!volume) {
        clearTrackedLight(player.id);
        return;
    }
    // 2.8.8: `lightblock` (emission 1) for Glowstone/Fire/Ultra Instinct,
    // `lightblock2` (emission 0.5) for Blaze/Lightning/Time/Wither/Spectral.
    const isBright = BRIGHT_LIGHT_SWORDS.has(mainId) ||
        offId === 'effect:glowstone_sword' || offId === 'effect:fire_sword';
    const targetType = isBright ? BRIGHT_LIGHT_TYPE : DIM_LIGHT_TYPE;
    const base = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y) + volume.yOffset,
        z: Math.floor(player.location.z),
    };
    const locs = [];
    const levels = volume.topOnly ? [0] : [-1, 0, 1];
    for (const dy of levels) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                locs.push({ x: base.x + dx, y: base.y + dy, z: base.z + dz });
            }
        }
    }
    // Only rewrite when the footprint actually moved; the placeholder blocks expire
    // on their own after 0.2 s, so a skipped pass is harmless.
    const prev = lastLightBlock.get(player.id);
    if (prev &&
        prev.dim.id === player.dimension.id &&
        prev.typeId === targetType &&
        prev.locs.length === locs.length &&
        prev.locs.every((p, i) => p.x === locs[i].x && p.y === locs[i].y && p.z === locs[i].z)) {
        return;
    }
    clearTrackedLight(player.id);
    const placed = [];
    for (const loc of locs) {
        try {
            const b = player.dimension.getBlock(loc);
            // `replace air` / `replace effect99:lightblock` — never overwrite real blocks.
            if (b && (b.isAir || b.typeId === BRIGHT_LIGHT_TYPE || b.typeId === DIM_LIGHT_TYPE)) {
                b.setType(targetType);
                placed.push(loc);
            }
        }
        catch { }
    }
    if (placed.length > 0) {
        lastLightBlock.set(player.id, { dim: player.dimension, locs: placed, typeId: targetType });
    }
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
        // `cleanupAllHelpersForPlayer` starts with `clearTrackedLight`, which works off
        // the saved `dim`/`locs` and therefore still runs once the player handle is gone.
        cleanupAllHelpersForPlayer(ev.playerId);
        lastEquipKey.delete(ev.playerId);
        lastMainhandId.delete(ev.playerId);
        shulkerToggleCooldown.delete(ev.playerId);
        nextLapisTick.delete(ev.playerId);
        nextBeeFlowerTick.delete(ev.playerId);
        nextEnderSoundTick.delete(ev.playerId);
        nextWitherSoundTick.delete(ev.playerId);
        werewolfCursedPlayers.delete(ev.playerId);
        seaSwordEquipped.delete(ev.playerId);
        werewolfTransformed.delete(ev.playerId);
        werewolfStartupShown.delete(ev.playerId);
        nextWolfGrowlTick.delete(ev.playerId);
    });
    world.afterEvents.playerDimensionChange.subscribe((ev) => {
        const pid = ev.player.id;
        cleanupAllHelpersForPlayer(pid);
        lastEquipKey.delete(pid);
        lastMainhandId.delete(pid);
    });
    // 2.8.8 releases the player through the shell's own entity event:
    //   enter  -> ride @s summon_ride entity:shulker_shield ...  + effect:shulker_hiding
    //   leave  -> event entity @p[family=shulker_sword,r=6] stop_shulker_sword_event
    //             (ride @s stop_riding, strip shulker_sword, back to default_player)
    // The remake had no `stop_*_event` plumbing at all, so hiding had to be undone by
    // a script guess. Listen for the real event instead: whether the player left the
    // shell by sneak or the shell was destroyed, the handler restores the sword state.
    try {
        world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
            if (ev.eventId !== 'stop_shulker_sword_event')
                return;
            const entity = ev.entity;
            // `entityTypes: ['minecraft:player']` already narrows the event; the typeId
            // check keeps this readable and mirrors the rest of the engine.
            if (entity.typeId !== 'minecraft:player')
                return;
            playerShulkerShield.delete(entity.id);
            shulkerToggleCooldown.set(entity.id, system.currentTick + 16);
            try {
                entity.triggerEvent('effect:equip_shulker_sword');
            }
            catch { }
        }, 
        // Narrow to the player and the one event this handler cares about: every
        // player-triggered data event would otherwise cross into the script.
        { entityTypes: ['minecraft:player'], eventTypes: ['stop_shulker_sword_event'] });
    }
    catch { }
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
                // `controller.animation.end_wolf_sword` ends the transformation as soon
                // as the Wolf Sword leaves the main hand, so the growl timer and the
                // transformed flag must be dropped here too.
                if (prevMainId === 'effect:wolf_sword' && mainId !== 'effect:wolf_sword') {
                    werewolfTransformed.delete(player.id);
                    werewolfStartupShown.delete(player.id);
                    nextWolfGrowlTick.delete(player.id);
                    try {
                        player.removeTag('effect_wolf_form');
                    }
                    catch { }
                }
                if (prevMainId === 'effect:sea_sword' && mainId !== 'effect:sea_sword') {
                    seaSwordEquipped.delete(player.id);
                }
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
                        // `is_family != sea_sword` fires once per equip, so the splash and
                        // the bounce particle must not repeat every 0.5 s.
                        const justEquippedSea = !seaSwordEquipped.has(player.id);
                        if (justEquippedSea)
                            seaSwordEquipped.add(player.id);
                        // Exact 2.8.8 `minecraft:sea_sword`: a 0.5 s timer drives the whole
                        // group. In water: conduction 1 s renewed every timer tick. Out of
                        // water: `camerashake` + `conduit_power 0` and the fish flop sound.
                        // Suffocation and the 0.06/0.07 mermaid speeds come from the
                        // component group itself, not from damage applied here.
                        // The `is_family != sea_sword` branch runs once on equip and gives
                        // `particle minecraft:example_bounce` + `playsound random.splash`;
                        // the in-water branch adds `mermaid_movement_in_water`
                        // (`underwater_movement: 0.07`) and `effect @s conduit_power 1 0`;
                        // the out-of-water branch adds `mermaid_movement_out_water`
                        // (`movement: 0.06`), `camerashake add @s 0.01 1 positional`, clears
                        // `conduit_power` and plays the fish flop cry. The two speeds are
                        // mutually exclusive in the original; Bedrock has no runtime
                        // `movement` setter, so both stay on the component group and the
                        // engine picks the right one (`underwater_movement` only while
                        // swimming, `movement` only on land).
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
                            // The flop only carries the sound in 2.8.8; the splash and the
                            // bounce particle belong to equipping the sword.
                            if (justEquippedSea) {
                                dim.spawnParticle('minecraft:example_bounce', player.location);
                                dim.playSound('random.splash', player.location, { volume: 0.5, pitch: 1.0 });
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
                        // 2.8.8 `ghost_movement` is only `minecraft:movement: 0.14` — the
                        // Ghost Sword has no wall X-ray at all. The remake had moved the
                        // Spectral Sword's `spectral_sword_function` here, which turned stone
                        // into see-through spectral blocks while holding the ghost blade.
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
                        // Exact 2.8.8 `minecraft:magma_sword`: five `fill ... magma 0 replace
                        // lava` cells — the block under the player plus the four horizontal
                        // neighbours at `~1 ~-1 ~`, `~ ~-1 ~1`, `~-1 ~-1 ~`, `~ ~-1 ~-1` —
                        // then `execute @s ~ ~1 ~ particle minecraft:guardian_attack_particle
                        // ^-0.4 ^ ^0.2` in front of the chest. The bubble sound is a 1/100
                        // roll (`weight 99` empty) while standing in water.
                        if (tick % 4 === 0) {
                            const px = Math.floor(player.location.x);
                            const py = Math.floor(player.location.y) - 1;
                            const pz = Math.floor(player.location.z);
                            for (const [dx, dz] of [
                                [0, 0],
                                [1, 0],
                                [0, 1],
                                [-1, 0],
                                [0, -1],
                            ]) {
                                const b = dim.getBlock({ x: px + dx, y: py, z: pz + dz });
                                if (b && (b.typeId === 'minecraft:lava' || b.typeId === 'minecraft:flowing_lava')) {
                                    b.setType('minecraft:magma');
                                }
                            }
                            // `^ ^ ^` is local to the player, so `^-0.4 ^ ^0.2` sits 0.2 blocks
                            // forward and 0.4 to the left of the chest.
                            const view = player.getViewDirection();
                            const right = { x: -view.z, z: view.x };
                            dim.spawnParticle('minecraft:guardian_attack_particle', {
                                x: player.location.x + view.x * 0.2 + right.x * -0.4,
                                y: player.location.y + 1.9,
                                z: player.location.z + view.z * 0.2 + right.z * -0.4,
                            });
                            if (player.isInWater && Math.random() < 0.01) {
                                dim.playSound('bubble.up', player.location, { volume: 1.0, pitch: 0.9 });
                            }
                        }
                        break;
                    }
                    case 'effect:blaze_sword': {
                        // Small fireballs cannot approach within radius 7 + flame particles (water & rain damage handled natively in player.json!)
                        if (tick % 20 === 0) {
                            // Exact 2.8.8 `blaze_sword_effects`: five particles on a fixed
                            // cross (centre plus four 0.3-away points, all at y+0.2) and one
                            // `mob.blaze.breathe` at volume 0.5 — the sound is unconditional.
                            for (const [ox, oz] of [
                                [0, 0],
                                [0.3, 0],
                                [0, 0.3],
                                [-0.3, 0],
                                [0, -0.3],
                            ]) {
                                dim.spawnParticle('minecraft:mobflame_single', {
                                    x: player.location.x + ox,
                                    y: player.location.y + 0.2,
                                    z: player.location.z + oz,
                                });
                            }
                            dim.playSound('mob.blaze.breathe', player.location, { volume: 0.5, pitch: 1.0 });
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
                        // gets resistance for one second, re-applied every tick. The
                        // original command is `effect @e[family=villager,r=64] resistance 1
                        // 1 true` — amplifier 1, i.e. Resistance II, not Resistance I.
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
                                v.addEffect('resistance', 20, { amplifier: 1, showParticles: false });
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
                        // Exact 2.8.8: sneak enters the Shulker Shell. `shulker_sword` in
                        // `player.json` runs
                        //   ride @s summon_ride entity:shulker_shield <no_ride_change> <shulker_hiding>
                        // so the shell is spawned as part of the ride, the player is switched to
                        // the `shulker_hiding` group (scale 0.7, immune) and `entity:shulker_shield`
                        // is left riding. Leaving is driven by the shell itself
                        // (`stop_shulker_sword_event`), handled in `startPassiveEngine`.
                        const existingShield = playerShulkerShield.get(player.id);
                        const ridingComp = player.getComponent(EntityComponentTypes.Riding);
                        const currentlyMountedOn = ridingComp?.entityRidingOn;
                        if (existingShield) {
                            if (!existingShield.isValid || currentlyMountedOn?.id !== existingShield.id) {
                                // The shell vanished without its own despawn event (chunk unload,
                                // /kill, explosion). Restore the player instead of leaving them
                                // shrunk and damage-immune forever.
                                cleanupHelperEntity(playerShulkerShield, player.id);
                                shulkerToggleCooldown.set(player.id, tick + 16);
                                try {
                                    player.triggerEvent('effect:equip_shulker_sword');
                                    dim.playSound('mob.shulker.open', player.location, { volume: 0.9, pitch: 1.0 });
                                }
                                catch { }
                            }
                            // No invented Resistance V while hiding: 2.8.8 relies purely on the
                            // `shulker_hiding` group's `damage_sensor` (cause all, no damage).
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
                        // Climbing assist on spider mount + re-mount on sneak.
                        //
                        // 2.8.8 `controller.animation.climb_spider` fires as soon as the spider
                        // has a rider: `/effect @s levitation 10 3 true`, i.e. 10 ticks at
                        // amplifier 3. `not_climb` clears it only when ALL four horizontal
                        // neighbours of the spider are air (`detect` on ~0.8, ~-0.8, ~0.8 on z
                        // and ~-0.8 on z), so the mount keeps levitating while it is still up
                        // against a wall. The remake used 8 ticks at amplifier 2 and only while
                        // `isClimbing`.
                        const spiderMount = playerSpiderMount.get(player.id);
                        if (spiderMount && spiderMount.isValid) {
                            const loc = spiderMount.location;
                            const sides = [
                                [0.8, 0],
                                [-0.8, 0],
                                [0, 0.8],
                                [0, -0.8],
                            ];
                            const allAir = sides.every(([dx, dz]) => {
                                try {
                                    return dim.getBlock({ x: Math.floor(loc.x + dx), y: Math.floor(loc.y), z: Math.floor(loc.z + dz) })?.isAir;
                                }
                                catch {
                                    return true;
                                }
                            });
                            if (allAir) {
                                try {
                                    spiderMount.removeEffect('levitation');
                                }
                                catch { }
                            }
                            else {
                                spiderMount.addEffect('levitation', 10, { amplifier: 3, showParticles: false });
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
                        // Exact 2.8.8 `minecraft:ender_sword` timer: `time [6, 18]`, looping,
                        // randomInterval, and `ender_sword_sound` picks one of three cries
                        // every time — there is no extra chance roll on top.
                        let enderDue = nextEnderSoundTick.get(player.id) ?? 0;
                        if (tick >= enderDue) {
                            nextEnderSoundTick.set(player.id, tick + 120 + Math.floor(Math.random() * 241));
                            const snds = ['mob.endermen.idle', 'mob.endermen.stare', 'mob.endermen.scream'];
                            dim.playSound(snds[Math.floor(Math.random() * snds.length)], player.location, {
                                volume: 1.0,
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
                                // 2.8.8 summons the crystal 1.8 blocks above the player, not 2:
                                // `summon ender_crystal ~ ~1.8 ~ minecraft:detect_player`.
                                let crystal = playerSpectralCrystal.get(player.id);
                                if (!crystal || !crystal.isValid) {
                                    crystal = findOverheadCrystal(player);
                                    if (!crystal) {
                                        crystal = dim.spawnEntity('minecraft:ender_crystal', { x: player.location.x, y: player.location.y + 1.8, z: player.location.z }, { spawnEvent: 'effect:spectral_rider' });
                                    }
                                    playerSpectralCrystal.set(player.id, crystal);
                                }
                            }
                        }
                        // Exact 2.8.8 `spectral_sword_function`: `fill ~6 ~6 ~6 ~-6 ~-6 ~-6
                        // effect99:spectral_block 0 replace <base>` and then seven frame fills
                        // that put plain `<base>` back into the outer slabs, so exactly the
                        // 12x12x12 cube around the player becomes see-through. `<base>` is
                        // stone in the Overworld, netherrack in the Nether and end stone in
                        // the End — deepslate is never mentioned, so it stays solid.
                        const isOverworld = dim.id === 'minecraft:overworld';
                        const baseBlock = isOverworld
                            ? 'minecraft:stone'
                            : dim.id === 'minecraft:nether'
                                ? 'minecraft:netherrack'
                                : 'minecraft:end_stone';
                        const originKey = isOverworld ? 'stone' : dim.id === 'minecraft:nether' ? 'netherrack' : 'end_stone';
                        if (isOverworld || dim.id === 'minecraft:nether' || dim.id === 'minecraft:the_end') {
                            if (tick % 6 === 0) {
                                const px = Math.floor(player.location.x);
                                const py = Math.floor(player.location.y + 1);
                                const pz = Math.floor(player.location.z);
                                for (let dx = -5; dx <= 6; dx++) {
                                    for (let dy = -6; dy <= 5; dy++) {
                                        for (let dz = -5; dz <= 6; dz++) {
                                            const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                                            if (b?.typeId !== baseBlock)
                                                continue;
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
                            // Exact 2.8.8 `wither_sword_effects`: `time [4, 18]` loop, a 50/50
                            // split between `mob.wither.death` and `mob.wither.hurt`.
                            let witherDue = nextWitherSoundTick.get(player.id) ?? 0;
                            if (tick >= witherDue) {
                                nextWitherSoundTick.set(player.id, tick + 80 + Math.floor(Math.random() * 281));
                                dim.playSound(Math.random() < 0.5 ? 'mob.wither.death' : 'mob.wither.hurt', player.location, {
                                    volume: 1.0,
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
                        // 2.8.8 drives the Wolf Sword from three animation controllers:
                        //  * `controller.animation.start_wolf_sword` — on a Full Moon
                        //    (`q.moon_phase == 0`) at `q.time_of_day <= 0.20 || >= 0.80` the
                        //    sword runs `wolf_sword_start_events`, which only stops the
                        //    sword's own howl and shows the `tellraw1` nausea line.
                        //  * `controller.animation.wolf_sword` — between 0.77 and 0.78 it
                        //    starts `wolf_transformation`: the `complete_wolf_transformation`
                        //    group gives `minecraft:attack: 15`, the `wolf`/`monster` type
                        //    families, a 3-6 s `wolf_sword_sounds` growl loop and a
                        //    `wolf_damage_sound` bark on every non-void hit.
                        //  * `controller.animation.end_wolf_sword` — unequipping or the
                        //    0.20 tick ends it.
                        // The remake had replaced all of that with Speed II + Jump Boost II.
                        const moonPhase = world.getMoonPhase();
                        if (moonPhase === MoonPhase.FullMoon) {
                            // `q.time_of_day` is a 0..1 fraction of the day, not ticks.
                            const dayFraction = timeOfDay / 24000;
                            if (dayFraction >= 0.77 && dayFraction <= 0.78 && !werewolfTransformed.has(player.id)) {
                                werewolfTransformed.add(player.id);
                                werewolfCursedPlayers.delete(player.id);
                                try {
                                    player.triggerEvent('effect:wolf_transform');
                                }
                                catch { }
                                dim.playSound('random.fizz', player.location, { volume: 1.0, pitch: 1.0 });
                                dim.playSound('wolf_sword.howl', player.location, { volume: 1.0, pitch: 1.0 });
                                for (const dy of [0, 0.5, 0.8]) {
                                    dim.spawnParticle('minecraft:egg_destroy_emitter', {
                                        x: player.location.x,
                                        y: player.location.y + dy,
                                        z: player.location.z,
                                    });
                                }
                            }
                            if (werewolfTransformed.has(player.id)) {
                                // `complete_wolf_transformation` timer: `time [3, 6]`, looping.
                                const due = nextWolfGrowlTick.get(player.id) ?? 0;
                                if (tick >= due) {
                                    nextWolfGrowlTick.set(player.id, tick + 60 + Math.floor(Math.random() * 61));
                                    dim.playSound('mob.wolf.growl', player.location, { volume: 1.0, pitch: 0.9 });
                                }
                            }
                            if ((dayFraction <= 0.20 || dayFraction >= 0.80) && werewolfStartupShown.get(player.id) !== true) {
                                werewolfStartupShown.set(player.id, true);
                                player.onScreenDisplay.setActionBar('§fFor some reason you feel nauseous...');
                            }
                        }
                        else {
                            werewolfTransformed.delete(player.id);
                            werewolfStartupShown.delete(player.id);
                            nextWolfGrowlTick.delete(player.id);
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
                            // `ultra_instinct_sword_effects` is 15 fixed offsets, each with its
                            // own `mob.wither.spawn` (volume 1, pitch 0.3) — not one random
                            // particle and an occasional sound.
                            for (const [ox, oy, oz] of [
                                [0.3, 1, 0],
                                [0, 2, 0.3],
                                [-0.3, 0, 0],
                                [0, 0.3, -0.3],
                                [0.3, 1.5, 0.3],
                                [-0.3, 0.8, -0.3],
                                [-0.3, 2, 0.3],
                                [0.2, 1, 0.3],
                                [0.3, 0.9, 0.1],
                                [0.2, 2.3, -0.2],
                                [-0.3, 1.2, 0],
                                [0.3, 0.3, 0.3],
                                [0.3, 0.6, 0.1],
                                [-0.3, 0.2, 0.3],
                                [0.1, 0.7, -0.3],
                            ]) {
                                dim.spawnParticle('minecraft:balloon_gas_particle', {
                                    x: player.location.x + ox,
                                    y: player.location.y + oy,
                                    z: player.location.z + oz,
                                });
                                dim.playSound('mob.wither.spawn', player.location, { volume: 1.0, pitch: 0.3 });
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
                        // `effect @e[type=!player] speed 1 15 true` targets exactly that
                        // selector: 1 s at amplifier 15, no `r=` limit, so every non-player
                        // entity in the dimension is hit, not only those within 32 blocks.
                        // `@e` also picks up items and XP orbs, which accept the effect as a
                        // no-op — the selector here mirrors the original.
                        if (tick % 10 === 0) {
                            for (const e of dim.getEntities()) {
                                if (e.typeId === 'minecraft:player')
                                    continue;
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
        // NO scripted landing stomp.
        //
        // `entities/mountable_slime.json` already carries the 2.8.8 landing attack:
        //   damage_sensor `has_damage fall` -> `fall_damage`
        //   fall_damage -> instant_damage 1 1 to everything in 1 block except the
        //                  `slime_sword`/`undead` families, instant_health 3 to undead,
        //                  then `not_baby`.
        // The remake repeated that in script with `applyDamage(6, entityAttack)` from the
        // rider, which (a) dealt a second, larger hit on every landing — 8 instead of the
        // original's single instant_damage, (b) healed nothing: undead were damaged, and
        // (c) reported the RIDER as the damaging entity, so the swing-free damage could
        // fire the rider's own on-hit sword events. The data-driven event is the whole
        // mechanic; nothing belongs here.
    }, 1);
}
