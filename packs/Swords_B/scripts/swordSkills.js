import { spawnSwordLightning } from './lightningOrigin.js';
import { BlockPermutation, EntityComponentTypes, EntityDamageCause, EntitySwingSource, EquipmentSlot, GameMode, ItemStack, Player, system, world, } from '@minecraft/server';
import { boostClockSword } from './randomTickManager.js';
import { consumeMainhandDurability, getMainhandItem, growInstantJungleTree, isFullMoonNight, isInRain, isProtectedEntity, safeRandomTeleport, shootCustomProjectile, } from './utils.js';
function checkAndStartCooldown(player, category, seconds) {
    try {
        if (player.getItemCooldown(category) > 0)
            return false;
        player.startItemCooldown(category, Math.max(1, Math.round(seconds * 20)));
        return true;
    }
    catch {
        return true;
    }
}
// Exact 2.8.8 `minecraft:sponge_sword` event:
//   fill ~2 ~2 ~2 ~-2 ~-2 ~-2 sponge 0 replace water  (only while in water/rain)
//   fill ~2 ~2 ~2 ~-2 ~-2 ~-2 air 0 replace sponge
//   fill ~2 ~2 ~2 ~-2 ~-2 ~-2 air 0 replace seagrass
// The counter only advances when the player is in water or rain, and the sword
// turns wet at 150, 155 or 160 depending on where the cadence started.
function absorbSpongeWater(player) {
    const dim = player.dimension;
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    let removed = 0;
    try {
        // 2.8.8 runs the three fills as two separate steps: the `replace water` fill
        // is guarded by `in_water_or_rain`, while the `replace sponge` and
        // `replace seagrass` sweeps run unconditionally — so a dry holder still
        // clears the sponge the previous soak left behind.
        const soaking = player.isInWater || isInRain(dim, player.location);
        if (soaking) {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dz = -2; dz <= 2; dz++) {
                        const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                        if (b && (b.typeId === 'minecraft:water' || b.typeId === 'minecraft:flowing_water')) {
                            b.setType('minecraft:sponge');
                            removed++;
                        }
                    }
                }
            }
        }
        // The second pass always runs, exactly like the unconditional third command.
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                    if (b && (b.typeId === 'minecraft:sponge' || b.typeId === 'minecraft:seagrass')) {
                        b.setType('minecraft:air');
                    }
                }
            }
        }
    }
    catch { }
    return removed;
}
const spongeWaterTicks = new Map();
// Reset the soak counter when a player starts a new life.
export function resetSpongeSwordState(playerId) {
    spongeWaterTicks.delete(playerId);
}
const lastDirectActionTick = new Map();
function markDirectAction(player) {
    lastDirectActionTick.set(player.id, system.currentTick);
}
// `scoreboard objectives add sponge_sword dummy` starts every player at 0, and
// the original converts on reaching 150 — it keeps counting past 160 and simply
// matches each of the three thresholds in turn.
const SPONGE_WET_THRESHOLD = 150;
export function tryConvertSpongeSword(player) {
    absorbSpongeWater(player);
    // The counter is advanced by the `in_water_or_rain` branch only; a dry player
    // triggers the water→sponge commands without ever scoring.
    const soaking = player.isInWater || isInRain(player.dimension, player.location);
    if (!soaking)
        return false;
    const prev = (spongeWaterTicks.get(player.id) ?? 0) + 1;
    spongeWaterTicks.set(player.id, prev);
    try {
        player.dimension.playSound('random.fizz', player.location, { volume: 0.5, pitch: 1.1 });
    }
    catch { }
    // Exact 2.8.8: the conversion fires when the counter reaches 150, 155 or 160.
    if (prev < SPONGE_WET_THRESHOLD)
        return false;
    spongeWaterTicks.delete(player.id);
    try {
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        const current = getMainhandItem(player);
        if (eq && current && current.typeId === 'effect:sponge_sword') {
            const wet = new ItemStack('effect:wet_sponge_sword', 1);
            eq.setEquipment(EquipmentSlot.Mainhand, wet);
            player.onScreenDisplay.setActionBar('§l§gWet Sponge Sword');
            player.dimension.spawnParticle('minecraft:cauldron_explosion_emitter', player.location);
            player.dimension.playSound('random.splash', player.location, { volume: 0.9, pitch: 1.2 });
            return true;
        }
    }
    catch { }
    return false;
}
const LIGHTNING_RING_OFFSETS = [
    [0, 2, 0],
    [7, 0, 0],
    [0, 0, 7],
    [-7, 0, 0],
    [0, 0, -7],
    [6, 0, 6],
    [-6, 0, -6],
    [-6, 0, 6],
    [6, 0, -6],
    [14, 0, 0],
    [0, 0, 14],
    [-14, 0, 0],
    [0, 0, -14],
    [12, 0, 12],
    [-12, 0, -12],
    [-12, 0, 12],
    [12, 0, -12],
    [28, 0, 0],
    [0, 0, 28],
    [-28, 0, 0],
    [0, 0, -28],
    [24, 0, 24],
    [-24, 0, -24],
    [-24, 0, 24],
    [24, 0, -24],
    [34, 0, 0],
    [0, 0, 34],
    [-34, 0, 0],
    [0, 0, -34],
    [30, 0, 30],
    [-30, 0, -30],
    [-30, 0, 30],
    [30, 0, -30],
    [42, 0, 0],
    [0, 0, 42],
    [-42, 0, 0],
    [0, 0, -42],
    [38, 0, 38],
    [-38, 0, -38],
    [-38, 0, 38],
    [38, 0, -38],
];
/**
 * 2.8.8 `weapon` events wear the sword out TWICE on a normal hit: the sequence always
 * starts with `damage: durability 1`, and the losing branch of the `randomize` block
 * is another `damage: durability 1` (the winning branch fires a projectile instead).
 * The engine's own durability damage covers the first point; this covers the second.
 *
 * Chance table straight from the 2.8.8 item files:
 *   bee 30% / bone 20% / creeper 20% / blaze 14%+1% / ice 30% / pumpkin 20% /
 *   shulker 10% / spider 5% / tnt 90% / wither 10%.
 */
const PROJECTILE_BRANCH_CHANCE = {
    'effect:bee_sword': 0.3,
    'effect:blaze_sword': 0.15,
    'effect:bone_sword': 0.2,
    'effect:creeper_sword': 0.2,
    'effect:ice_sword': 0.3,
    'effect:pumpkin_sword': 0.2,
    'effect:shulker_sword': 0.1,
    'effect:spider_sword': 0.05,
    'effect:tnt_sword': 0.9,
    'effect:wither_sword': 0.1,
};
/** The 70/80/85/90/95% branch of those same events. */
function applyProjectileBranchDurability(itemId, attacker) {
    const chance = PROJECTILE_BRANCH_CHANCE[itemId];
    if (chance === undefined || !(attacker instanceof Player))
        return;
    if (Math.random() < chance)
        return;
    consumeMainhandDurability(attacker, 1);
}
/**
 * 2.8.8 target: `@e[type=ender_crystal,family=!ender_crystal_default,family=!ender_crystal_scale,c=1]`.
 * It is a plain selector around the player — NOT the rider list. The remake used
 * `getRiders()`, and the crystal it spawned was never actually riding, so the
 * 1 % `weapon`/air-swing explosion never happened at all.
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
function explodeSpectralCrystal(player) {
    findOverheadCrystal(player)?.triggerEvent('minecraft:crystal_explode');
}
export function registerItemComponents(registry) {
    // Unified V2 Custom Component for all 38 Swords + 2 Special Sticks
    registry.registerCustomComponent('effect:sword', {
        onBeforeDurabilityDamage(event) {
            const itemId = event.itemStack?.typeId ?? '';
            if (itemId === 'effect:bedrock_sword' || itemId === 'effect:bedrock_stick') {
                event.durabilityDamage = 0;
            }
            else if (itemId === 'effect:obsidian_sword') {
                // Exact 2.8.8 probabilities: 55% -> 1, 30% -> 2, 15% -> 3
                const r = Math.random() * 100;
                event.durabilityDamage = r < 55 ? 1 : r < 85 ? 2 : 3;
            }
            else if (itemId === 'effect:time_sword') {
                // Exact 2.8.8 probabilities: 90% -> 1, 6% -> 16, 3% -> 32, 1% -> 64
                const r = Math.random() * 100;
                event.durabilityDamage = r < 90 ? 1 : r < 96 ? 16 : r < 99 ? 32 : 64;
            }
        },
        onMineBlock(event) {
            const { itemStack, source } = event;
            if (!itemStack || !(source instanceof Player))
                return;
            markDirectAction(source);
            const id = itemStack.typeId;
            if (id === 'effect:bedrock_sword' || id === 'effect:bedrock_stick') {
                return;
            }
            if (id === 'effect:spectral_sword' && Math.random() < 0.01) {
                explodeSpectralCrystal(source);
                return;
            }
            if (id === 'effect:glass_sword') {
                source.dimension.playSound('random.glass', source.location, { volume: 1.2, pitch: 0.9 });
                consumeMainhandDurability(source, 10);
                return;
            }
            if (id === 'effect:quartz_sword') {
                source.dimension.spawnParticle('minecraft:knockback_roar_particle', {
                    x: source.location.x,
                    y: source.location.y + 1,
                    z: source.location.z,
                });
                if (source.getGameMode() !== GameMode.Creative) {
                    consumeMainhandDurability(source, 10);
                    system.run(() => {
                        try {
                            source.kill();
                        }
                        catch { }
                    });
                }
                return;
            }
            if (source.getGameMode() !== GameMode.Creative) {
                if (id === 'effect:time_sword') {
                    const r = Math.random() * 100;
                    consumeMainhandDurability(source, r < 90 ? 1 : r < 96 ? 16 : r < 99 ? 32 : 64);
                }
                else if (id === 'effect:obsidian_sword') {
                    const r = Math.random() * 100;
                    consumeMainhandDurability(source, r < 55 ? 1 : r < 85 ? 2 : 3);
                }
                else {
                    consumeMainhandDurability(source, 1);
                }
            }
        },
        onHitEntity(event) {
            const { attackingEntity, hitEntity, itemStack } = event;
            if (!itemStack || !hitEntity.isValid)
                return;
            if (attackingEntity instanceof Player) {
                markDirectAction(attackingEntity);
            }
            const dim = hitEntity.dimension;
            const id = itemStack.typeId;
            // If Alpha Wolf is struck by ANY weapon other than Silver Sword, strip `hit_by_silver` so its regeneration returns (exact 2.8.8!)
            if (hitEntity.typeId === 'entity:alpha_wolf' && id !== 'effect:silver_sword') {
                try {
                    hitEntity.removeTag('hit_by_silver');
                }
                catch { }
            }
            try {
                switch (id) {
                    case 'effect:bee_sword': {
                        // Exact 2.8.8: 30% chance to release aggressive defending bee (entity:bee_sword)
                        if (Math.random() < 0.3 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:bee_sword', 1.0);
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        hitEntity.addEffect('poison', 80, { amplifier: 0, showParticles: true });
                        break;
                    }
                    case 'effect:blaze_sword': {
                        hitEntity.setOnFire(8, true);
                        // Exact 2.8.8: 14% small_fireball, 1% large fireball on hit
                        if (attackingEntity instanceof Player) {
                            const r = Math.random() * 100;
                            if (r < 14) {
                                attackingEntity.addEffect('fire_resistance', 30, { amplifier: 0, showParticles: false });
                                shootCustomProjectile(attackingEntity, 'minecraft:small_fireball', 1.35);
                            }
                            else if (r < 15) {
                                attackingEntity.addEffect('fire_resistance', 30, { amplifier: 0, showParticles: false });
                                shootCustomProjectile(attackingEntity, 'minecraft:fireball', 1.35, 'effect:player_shot');
                            }
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:bone_sword': {
                        // Exact 2.8.8: 20% chance to shoot an arrow when attacking!
                        if (Math.random() < 0.2 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:arrow', 1.6);
                            dim.playSound('random.bow', attackingEntity.location, { volume: 0.9, pitch: 1.0 });
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:silver_sword': {
                        // Extra damage & strips regen/resistance from Alpha Wolf for 4s per Silver Sword hit!
                        if (hitEntity.typeId === 'entity:alpha_wolf') {
                            hitEntity.triggerEvent('clear_effects');
                            hitEntity.addTag('hit_by_silver');
                            const hitStamp = system.currentTick;
                            hitEntity.setDynamicProperty('effect:silver_tick', hitStamp);
                            hitEntity.applyDamage(12, { cause: EntityDamageCause.magic, damagingEntity: attackingEntity });
                            dim.playSound('random.anvil_land', hitEntity.location, { volume: 0.8, pitch: 1.5 });
                            dim.spawnParticle('minecraft:critical_hit_emitter', hitEntity.location);
                            system.runTimeout(() => {
                                try {
                                    if (hitEntity.isValid && hitEntity.getDynamicProperty('effect:silver_tick') === hitStamp) {
                                        hitEntity.removeTag('hit_by_silver');
                                    }
                                }
                                catch { }
                            }, 80);
                        }
                        break;
                    }
                    case 'effect:glass_sword': {
                        dim.playSound('random.glass', hitEntity.location, { volume: 1.2, pitch: 0.9 });
                        break;
                    }
                    case 'effect:cursed_pumpkin_sword': {
                        // Exact 2.8.8: 80% chance to launch entity:pumpkin_projectile on hit!
                        if (Math.random() < 0.8 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:pumpkin_projectile', 0.95);
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        if (Math.random() < 0.15) {
                            const eq = hitEntity.getComponent(EntityComponentTypes.Equippable);
                            if (eq && !eq.getEquipment('Head')) {
                                eq.setEquipment('Head', new ItemStack('minecraft:carved_pumpkin', 1));
                            }
                        }
                        break;
                    }
                    case 'effect:wither_skeleton_sword': {
                        // Exact 2.8.8 `weapon`: wither II for 6 s on the struck entity plus a
                        // `shoot entity:wither_effect` at launch_power 1. The projectile's own
                        // `mob_effect` is wither I, and Bedrock does not raise an existing
                        // wither II when a weaker one lands, so the two stack exactly as the
                        // original did.
                        hitEntity.addEffect('wither', 120, { amplifier: 1, showParticles: true });
                        if (attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:wither_effect', 2.0);
                        }
                        break;
                    }
                    case 'effect:magma_sword': {
                        // Preserve exact 7.2 damage (7 base + 0.2 bonus) + ignite
                        hitEntity.applyDamage(0.2, { cause: EntityDamageCause.fire, damagingEntity: attackingEntity });
                        hitEntity.setOnFire(5, true);
                        break;
                    }
                    case 'effect:nether_star_sword': {
                        // The original wither's damage_sensor fires `wither_sword` only for a
                        // *player* whose main hand is the Nether Star Sword and only when the
                        // hit is fatal, so the tag must not be set by any other attacker.
                        if (hitEntity.typeId === 'minecraft:wither' &&
                            attackingEntity instanceof Player &&
                            getMainhandItem(attackingEntity)?.typeId === 'effect:nether_star_sword') {
                            hitEntity.addTag('slain_by_nether_star_sword');
                        }
                        // Exact 2.8.8: mark target with `entity:objective` + summon 1 (80%) or 2 (20%) sky `entity:nether_star` turrets
                        // that rain glowing `entity:nether_star_projectile` stars (6 dmg each + thunder sound + nether_star_hit particle)!
                        dim.spawnEntity('entity:objective', hitEntity.location);
                        const count = Math.random() < 0.2 ? 2 : 1;
                        for (let i = 0; i < count; i++) {
                            const skyY = Math.min(dim.heightRange.max - 2, hitEntity.location.y + 18 + i * 2);
                            dim.spawnEntity('entity:nether_star', {
                                x: hitEntity.location.x + (Math.random() - 0.5) * 1.5,
                                y: skyY,
                                z: hitEntity.location.z + (Math.random() - 0.5) * 1.5,
                            });
                        }
                        // Exact 2.8.8: 0.01% (1/10000) unstable bedrock-shattering explosion on attack!
                        if (Math.random() < 0.0001) {
                            dim.spawnEntity('entity:ultra_instinct_explode', hitEntity.location);
                        }
                        break;
                    }
                    case 'effect:ice_sword': {
                        // Preserve exact 8.5 damage (8 base + 0.5 frost bonus) + 30% snowball throw!
                        hitEntity.applyDamage(0.5, { cause: EntityDamageCause.freezing, damagingEntity: attackingEntity });
                        if (Math.random() < 0.3 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:snowball', 1.4, 'effect:ice_sword_snowball');
                            dim.playSound('random.bow', attackingEntity.location, { volume: 1.0, pitch: 0.4 });
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:quartz_sword': {
                        // The item already deals its native 600 damage; do not apply it twice.
                        dim.spawnParticle('minecraft:knockback_roar_particle', {
                            x: hitEntity.location.x,
                            y: hitEntity.location.y + 1,
                            z: hitEntity.location.z,
                        });
                        dim.playSound('ambient.weather.thunder', hitEntity.location, { volume: 1.5, pitch: 0.8 });
                        if (attackingEntity instanceof Player && attackingEntity.getGameMode() !== GameMode.Creative) {
                            const eq = attackingEntity.getComponent(EntityComponentTypes.Equippable);
                            eq?.setEquipment('Mainhand', undefined);
                            system.run(() => {
                                try {
                                    attackingEntity.kill();
                                }
                                catch { }
                            });
                        }
                        break;
                    }
                    case 'effect:quartz_diamond_stick': {
                        // Exact 2.8.8 weights: 10% -> 1 magic, 85% -> 3 magic, 5% -> 6 magic
                        if (attackingEntity instanceof Player && attackingEntity.getGameMode() !== GameMode.Creative) {
                            const r = Math.random() * 100;
                            const dmg = r < 10 ? 1 : r < 95 ? 3 : 6;
                            attackingEntity.applyDamage(dmg, { cause: EntityDamageCause.magic });
                        }
                        break;
                    }
                    case 'effect:spider_sword': {
                        // Exact 2.8.8: 5% chance to shoot entity:web on attack
                        if (Math.random() < 0.05 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:web', 1.25);
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:tnt_sword': {
                        // Exact 2.8.8: 90% chance to shoot entity:tnt small explosion on hit
                        if (Math.random() < 0.9 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:tnt', 1.2);
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:wolf_sword': {
                        // Exact 2.8.8: 20 total melee damage during Full Moon night!
                        if (isFullMoonNight()) {
                            // Damage is supplied by the player's transformed attack component plus the held sword.
                            dim.playSound('mob.wolf.bark', hitEntity.location, { volume: 1.0, pitch: 0.55 });
                        }
                        break;
                    }
                    case 'effect:shulker_sword': {
                        // Exact 2.8.8: 10% chance to shoot shulker_bullet
                        if (Math.random() < 0.1 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:shulker_bullet', 1.1, 'effect:shulker_sword');
                            dim.playSound('random.bow', attackingEntity.location, { volume: 1.0, pitch: 0.4 });
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:creeper_sword': {
                        // Exact 2.8.8: 20% chance to launch small creeper on hit!
                        if (Math.random() < 0.2 && attackingEntity instanceof Player) {
                            // 2.8.8 turns the creeper into a projectile with `power: 1` and no
                            // extra sound; the blast audio comes from the mini creeper itself.
                            shootCustomProjectile(attackingEntity, 'entity:minicreeper', 1.0, 'effect:minicreeper_projectile');
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                    case 'effect:fire_sword': {
                        hitEntity.setOnFire(10, true);
                        // Exact 2.8.8: 85% shoot entity:fire, 15% launch entity:living_flame!
                        if (attackingEntity instanceof Player) {
                            if (Math.random() < 0.15) {
                                const lf = shootCustomProjectile(attackingEntity, 'entity:living_flame', 1.0, 'hostile_entity');
                                lf?.addTag('player_summoned');
                            }
                            else {
                                shootCustomProjectile(attackingEntity, 'entity:fire', 1.3);
                            }
                        }
                        break;
                    }
                    case 'effect:spectral_sword': {
                        if (Math.random() < 0.01 && attackingEntity instanceof Player) {
                            explodeSpectralCrystal(attackingEntity);
                        }
                        break;
                    }
                    case 'effect:lightning_sword': {
                        // Exact 2.8.8 `weapon` event: 85% chance to shoot one
                        // `entity:lightning_projectile`. The bolt itself is summoned by the
                        // projectile's own `on_hit` when the projectile lands, never on the
                        // swing, and never as a ring of 41 bolts.
                        if (Math.random() < 0.85 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:lightning_projectile', 1.5);
                        }
                        break;
                    }
                    case 'effect:wither_sword': {
                        hitEntity.addEffect('wither', 140, { amplifier: 1, showParticles: true });
                        // Exact 2.8.8: 10% chance to shoot wither_skull on hit!
                        if (Math.random() < 0.1 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:wither_skull', 1.4, 'effect:player_shot');
                            dim.playSound('mob.wither.shoot', attackingEntity.location, { volume: 1.0, pitch: 1.0 });
                        }
                        applyProjectileBranchDurability(id, attackingEntity);
                        break;
                    }
                }
            }
            catch { }
        },
        onUseOn(event) {
            const { block, blockFace, itemStack, source } = event;
            if (!itemStack || !(source instanceof Player))
                return;
            markDirectAction(source);
            const dim = block.dimension;
            try {
                if (itemStack.typeId === 'effect:jungle_sword') {
                    const soilTypes = new Set([
                        'minecraft:grass_block',
                        'minecraft:dirt',
                        'minecraft:podzol',
                        'minecraft:mud',
                        'minecraft:moss_block',
                        'minecraft:coarse_dirt',
                        'minecraft:rooted_dirt',
                        'minecraft:mycelium',
                    ]);
                    if (soilTypes.has(block.typeId) && blockFace === 'Up') {
                        const above = dim.getBlock({ x: block.location.x, y: block.location.y + 1, z: block.location.z });
                        if (above && above.isAir) {
                            growInstantJungleTree(dim, above.location);
                            consumeMainhandDurability(source, 8);
                        }
                    }
                }
            }
            catch { }
        },
        onUse(event) {
            const { itemStack, source: player } = event;
            if (!itemStack || !player.isValid)
                return;
            markDirectAction(player);
            const dim = player.dimension;
            const id = itemStack.typeId;
            try {
                switch (id) {
                    case 'effect:clock_sword': {
                        // Exact 2.8.8 `clock_sword` `on_use` only adds `clock_sword_skill`:
                        // `minecraft:clock_sword` then runs `gamerule randomtickspeed 100`,
                        // `effect @e[type=!player] speed 1 10 true`, `time add 10` and puts
                        // every player on `clock_sword_movement` (movement 1). The same event
                        // repeats every time the 5 s `clock_sword_skill` timer expires, and
                        // `stop_clock_sword_event` puts the gamerule back to 1 and strips the
                        // Speed effect. So the sword is NOT a one-shot "advance one hour":
                        // right-clicking starts a 5 s window of 10x random ticks that pushes
                        // the clock forward 10 ticks every 5 s for everything, and the holder
                        // gets no Speed effect of their own — only the movement component.
                        if (!checkAndStartCooldown(player, 'clock_sword', 30))
                            return;
                        // `clock_sword_skill` is a 5 s LOOPING timer whose `time_down_event`
                        // fires `minecraft:clock_sword` every 5 s — so the world only gets
                        // `time add 10` and `effect @e[type=!player] speed 1 10` ONCE per 5 s,
                        // while `gamerule randomtickspeed 100` runs for that same 5 s window
                        // and is set back to 1 by `stop_clock_sword_event`. The remake ran the
                        // 100-tick loop with a +10 tick push each tick, i.e. a full day of time
                        // in five seconds, roughly 70x the original.
                        boostClockSword();
                        const clockBurst = () => {
                            try {
                                world.setTimeOfDay((world.getTimeOfDay() + 10) % 24000);
                                for (const e of dim.getEntities()) {
                                    if (e.typeId === 'minecraft:player')
                                        continue;
                                    try {
                                        e.addEffect('speed', 20, { amplifier: 10, showParticles: false });
                                    }
                                    catch { }
                                }
                            }
                            catch { }
                        };
                        clockBurst();
                        // The loop's first pass fires on activation, the second one 5 s later.
                        system.runTimeout(() => {
                            if (player.isValid)
                                clockBurst();
                        }, 100);
                        dim.playSound('random.orb', player.location, { volume: 1.0, pitch: 0.6 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:blaze_sword': {
                        // Exact 2.8.8: levitate for 7s + slow_falling 10s, then launch volley of small fireballs! (-10 durability)
                        if (!checkAndStartCooldown(player, 'blaze_sword', 20))
                            return;
                        // 2.8.8 `on_use`: `effect @s levitation 7 0 true` and
                        // `effect @s slow_falling 10 3 true`, i.e. 7 s and 10 s.
                        player.addEffect('levitation', 140, { amplifier: 0, showParticles: false });
                        player.addEffect('slow_falling', 200, { amplifier: 3, showParticles: false });
                        dim.playSound('mob.blaze.breathe', player.location, { volume: 1.0, pitch: 1.0 });
                        // The volley is not immediate: `blaze_sword_skill` waits 6 s, then
                        // `shoot_small_fireball` spawns FOUR `entity:fake_fireball` projectiles
                        // (power 1.3, damage 5, sets fire) with a 0-1 tick stagger, and the
                        // whole group is removed 2 s later. The remake fired 8 real small
                        // fireballs starting after 1.5 s, which is a different move entirely.
                        system.runTimeout(() => {
                            if (!player.isValid)
                                return;
                            for (let shot = 0; shot < 4; shot++) {
                                system.runTimeout(() => {
                                    if (!player.isValid)
                                        return;
                                    shootCustomProjectile(player, 'entity:fake_fireball', 1.3, 'set_sound', 1.5, 0.06);
                                }, shot);
                            }
                        }, 120);
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:ice_sword': {
                        // Exact 2.8.8 `ice_sword` `on_use`: for every entity from 2 to 12
                        // blocks away the item runs ONE `fill ... effect99:fake_ice 0
                        // replace air 0` whose box depends on the target's size, plus a few
                        // carve-outs. Enclosing everything with one generic 3x3x4 shell was
                        // wrong: tall mobs get a 3-high box, slimes medium/small and horses
                        // get their ice carved back out, projectiles get a single block.
                        if (!checkAndStartCooldown(player, 'ice_sword', 5))
                            return;
                        const eye = player.location;
                        const targets = dim.getEntities({ location: eye, maxDistance: 12 }).filter((e) => {
                            if (isProtectedEntity(e, player))
                                return false;
                            const dx = e.location.x - eye.x;
                            const dy = e.location.y - eye.y;
                            const dz = e.location.z - eye.z;
                            return Math.sqrt(dx * dx + dy * dy + dz * dz) >= 2;
                        });
                        // `fill <a> <b> effect99:fake_ice 0 replace air 0` — only empty
                        // blocks are frozen, existing terrain is never overwritten.
                        const iceFill = (centre, a, b) => {
                            const x0 = Math.floor(centre.x);
                            const y0 = Math.floor(centre.y);
                            const z0 = Math.floor(centre.z);
                            for (let dx = Math.min(a[0], b[0]); dx <= Math.max(a[0], b[0]); dx++) {
                                for (let dy = Math.min(a[1], b[1]); dy <= Math.max(a[1], b[1]); dy++) {
                                    for (let dz = Math.min(a[2], b[2]); dz <= Math.max(a[2], b[2]); dz++) {
                                        const blk = dim.getBlock({ x: x0 + dx, y: y0 + dy, z: z0 + dz });
                                        if (blk?.isAir) {
                                            blk.setPermutation(BlockPermutation.resolve('effect99:fake_ice', {
                                                'effect99:crack_stage': 0,
                                                'effect99:from_water': false,
                                            }));
                                        }
                                    }
                                }
                            }
                        };
                        // `fill ... air 0 replace effect99:fake_ice` — carve the cage back
                        // open around the mob so it is not sealed inside its own ice.
                        const carve = (centre, a, b) => {
                            const x0 = Math.floor(centre.x);
                            const y0 = Math.floor(centre.y);
                            const z0 = Math.floor(centre.z);
                            for (let dx = Math.min(a[0], b[0]); dx <= Math.max(a[0], b[0]); dx++) {
                                for (let dy = Math.min(a[1], b[1]); dy <= Math.max(a[1], b[1]); dy++) {
                                    for (let dz = Math.min(a[2], b[2]); dz <= Math.max(a[2], b[2]); dz++) {
                                        const blk = dim.getBlock({ x: x0 + dx, y: y0 + dy, z: z0 + dz });
                                        if (blk?.typeId === 'effect99:fake_ice')
                                            blk.setType('minecraft:air');
                                    }
                                }
                            }
                        };
                        for (const t of targets) {
                            const c = t.location;
                            const id = t.typeId.replace('minecraft:', '');
                            const slimeFamily = t.matches({ families: ['slime_large'] })
                                ? 'large'
                                : t.matches({ families: ['slime_medium'] })
                                    ? 'medium'
                                    : t.matches({ families: ['slime_small'] })
                                        ? 'small'
                                        : '';
                            if (id === 'enderman') {
                                iceFill(c, [1, -1, 1], [-1, 3, -1]);
                            }
                            else if (slimeFamily === 'large') {
                                iceFill(c, [2, -1, 2], [-2, 3, -2]);
                                // Second command runs from ~ ~1 ~: a 3x3x3 void carved one step up.
                                carve({ x: c.x, y: c.y + 1, z: c.z }, [1, -1, 1], [-1, 1, -1]);
                            }
                            else if (slimeFamily === 'medium') {
                                iceFill(c, [1, -1, 1], [-1, 1, -1]);
                                carve(c, [0, 0, 0], [0, 0, 0]);
                            }
                            else if (slimeFamily === 'small') {
                                iceFill(c, [1, 1, 1], [-1, -1, -1]);
                                carve(c, [0, 0, 0], [0, 0, 0]);
                            }
                            else if (id === 'elder_guardian') {
                                iceFill(c, [2, -1, 2], [-2, 3, -2]);
                            }
                            else if (id === 'ghast') {
                                iceFill(c, [4, -3, 4], [-4, 4, -4]);
                                carve(c, [3, -2, 3], [-3, 3, -3]);
                            }
                            else if (id === 'horse') {
                                iceFill(c, [1, -1, 1], [-1, 1, -1]);
                                carve(c, [0, 0, 0], [0, 0, 0]);
                            }
                            else if (id === 'player') {
                                // `@e[type=player,rm=3,r=12]` — other players are caged from 3
                                // blocks away, a 3x4x3 shell.
                                if (Math.sqrt((c.x - eye.x) ** 2 + (c.y - eye.y) ** 2 + (c.z - eye.z) ** 2) < 3)
                                    continue;
                                iceFill(c, [1, -1, 1], [-1, 2, -1]);
                            }
                            else if (['silverfish', 'small_fireball', 'fireball', 'arrow', 'lingering_potion', 'dragon_fireball', 'thrown_trident'].includes(id)) {
                                // Single-block cages for the small mobs and every projectile.
                                iceFill(c, [0, 0, 0], [0, 0, 0]);
                            }
                            else {
                                // Everything else in the sweep: spiders, animals, guardians,
                                // bats, shulkers, phantoms, vexes, TNT, ... 3x3x3 shell.
                                iceFill(c, [1, -1, 1], [-1, 1, -1]);
                            }
                        }
                        player.onScreenDisplay.setActionBar('§l§bIce Skill');
                        dim.playSound('random.fizz', player.location, { volume: 1.0, pitch: 2.3 });
                        dim.spawnParticle('minecraft:knockback_roar_particle', {
                            x: player.location.x,
                            y: player.location.y + 1,
                            z: player.location.z,
                        });
                        consumeMainhandDurability(player, 6);
                        break;
                    }
                    case 'effect:spider_sword': {
                        // 2.8.8 `spider_sword_skill`: a `minecraft:spawn_entity` with
                        // min/max_wait_time 0 (one web per tick) held for 2 s by a
                        // `minecraft:timer`, i.e. ~40 webs over 2 seconds. The remake fired
                        // only 12 webs over 2.4 s, so the web wall was far too thin.
                        if (!checkAndStartCooldown(player, 'spider_sword', 28))
                            return;
                        for (let i = 0; i < 40; i++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                shootCustomProjectile(player, 'entity:web', 1.35, undefined, 1.5, 0.08);
                                player.dimension.playSound('mob.spider.step', player.location, { volume: 0.8, pitch: 1.4 });
                            }, i);
                        }
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:tnt_sword': {
                        // Exact 2.8.8: summon SuperTNT (giant_tnt, 8s fuse) + actionbar! (-18 durability)
                        if (!checkAndStartCooldown(player, 'tnt_sword', 10))
                            return;
                        dim.spawnEntity('minecraft:tnt', player.location, { spawnEvent: 'giant_tnt' });
                        for (const p of dim.getPlayers({ location: player.location, maxDistance: 18 })) {
                            p.onScreenDisplay.setActionBar('§fSuper§4TNT §f§lhas been activated.');
                        }
                        dim.playSound('random.fuse', player.location, { volume: 1.2, pitch: 1.0 });
                        consumeMainhandDurability(player, 18);
                        break;
                    }
                    case 'effect:shulker_sword': {
                        // Exact 2.8.8: levitate entities within radius 6 (amplifier 18, 1s) + cauldron_explosion_emitter! (-8 durability)
                        if (!checkAndStartCooldown(player, 'shulker_sword', 8))
                            return;
                        const ringPts = [
                            [3, 0],
                            [0, 3],
                            [-3, 0],
                            [0, -3],
                            [-2.5, 2.5],
                            [2.5, -2.5],
                            [2.5, 2.5],
                            [-2.5, -2.5],
                        ];
                        for (const [ox, oz] of ringPts) {
                            dim.spawnParticle('minecraft:cauldron_explosion_emitter', {
                                x: player.location.x + ox,
                                y: player.location.y,
                                z: player.location.z + oz,
                            });
                        }
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 6.0 })) {
                            if (!isProtectedEntity(e, player)) {
                                // 2.8.8: `effect @e[r=6] levitation 1 18 false` — exactly 1 second.
                                e.addEffect('levitation', 20, { amplifier: 18, showParticles: false });
                            }
                        }
                        // 2.8.8 `shulker_sword` `on_use` is only the eight cauldron
                        // particles and the `levitation 1 18` cast — it plays no sound of
                        // its own, so the remake must not add one either.
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:ghost_sword': {
                        // Exact 2.8.8 `ghost_sword` `on_use`: it is a `shoot`, not a
                        // teleport — `entity:ghost_projectile` at power 2.5, gravity 0,
                        // damage -1, for 6 durability and a 2 second cooldown. The earlier
                        // "phase through walls" behaviour was invented by the remake and
                        // does not exist anywhere in the original item.
                        if (!checkAndStartCooldown(player, 'ghost_sword', 2))
                            return;
                        shootCustomProjectile(player, 'entity:ghost_projectile', 2.5);
                        consumeMainhandDurability(player, 6);
                        break;
                    }
                    case 'effect:creeper_sword': {
                        // Exact 2.8.8: player inflates like a Creeper (animation.player.explode) for 1.5s, then explodes and dies! (-1 durability)
                        if (!checkAndStartCooldown(player, 'creeper_sword', 3))
                            return;
                        consumeMainhandDurability(player, 1);
                        try {
                            player.playAnimation('animation.player.explode');
                        }
                        catch { }
                        // 2.8.8 does NOT give slowness here: `start_player_explode_event` pins
                        // the player with `minecraft:movement: 0` for the 1.5 s fuse. Slowness 10
                        // was an invented stand-in and also blocked camera movement.
                        dim.playSound('random.fuse', player.location, { volume: 1.2, pitch: 1.0 });
                        // 2.8.8 `start_player_explode_event` holds the player still with
                        // `minecraft:movement: 0` and a 1.5 s (30 tick) timer, then summons
                        // `entity:instant_creeper_explode` at the player's feet+1 and kills.
                        system.runTimeout(() => {
                            if (!player.isValid)
                                return;
                            try {
                                player.dimension.spawnEntity('entity:instant_creeper_explode', {
                                    x: player.location.x,
                                    y: player.location.y + 1,
                                    z: player.location.z,
                                });
                                if (player.getGameMode() !== GameMode.Creative) {
                                    player.kill();
                                }
                            }
                            catch { }
                        }, 30);
                        break;
                    }
                    case 'effect:fire_sword': {
                        // Exact 2.8.8: "Rain of Fire" — shower of fireballs/living flames from above + actionbar! (-20 durability)
                        if (!checkAndStartCooldown(player, 'fire_sword', 25))
                            return;
                        const loc = player.location;
                        dim.spawnEntity('entity:living_flame', { x: loc.x, y: loc.y + 14, z: loc.z }, { spawnEvent: 'minecraft:target' });
                        const offsets = [
                            [0, 0],
                            [3, 0],
                            [0, 3],
                            [-3, 0],
                            [0, -3],
                        ];
                        for (const [ox, oz] of offsets) {
                            dim.spawnEntity('entity:living_flame', { x: loc.x + ox, y: loc.y + 4, z: loc.z + oz }, { spawnEvent: 'fire_sword_skill' });
                        }
                        dim.spawnParticle('minecraft:example_linearcurve', { x: loc.x, y: loc.y + 0.2, z: loc.z });
                        player.onScreenDisplay.setActionBar('§l§6Fire rain');
                        // 2.8.8 `fire_sword` `on_use` summons the flames and the particle
                        // and shows the actionbar — the remake had added a blaze sound the
                        // original never plays here.
                        consumeMainhandDurability(player, 20);
                        break;
                    }
                    case 'effect:spectral_sword': {
                        // Exact 2.8.8: fire explosive ender_crystal_projectile + shrink overhead crystal for recharge! (-15 durability)
                        if (!checkAndStartCooldown(player, 'spectral_sword', 18))
                            return;
                        shootCustomProjectile(player, 'entity:ender_crystal_projectile', 1.45);
                        // `on_use` runs `event entity @e[type=ender_crystal,family=!ender_crystal_default,
                        // family=!ender_crystal_scale,c=1,r=4] minecraft:ender_crystal_scale`: the
                        // full-size crystal shrinks for 18 s and then pops back with the
                        // portal.travel + example_flipbook flourish.
                        findOverheadCrystal(player)?.triggerEvent('effect:ender_crystal_scale');
                        dim.playSound('portal.travel', player.location, { volume: 1.0, pitch: 5.0 });
                        consumeMainhandDurability(player, 15);
                        break;
                    }
                    case 'effect:ender_sword': {
                        // Exact 2.8.8: randomly teleport in a radius of between 16 to 32 blocks! (-5 durability)
                        if (!checkAndStartCooldown(player, 'ender_sword', 2))
                            return;
                        safeRandomTeleport(player, 16, 32);
                        consumeMainhandDurability(player, 5);
                        break;
                    }
                    case 'effect:lightning_sword': {
                        // Exact 2.8.8: 41 rays fall around you at exact 5-ring coordinates! (-9 durability)
                        if (!checkAndStartCooldown(player, 'lightning_sword', 12))
                            return;
                        const origin = { ...player.location };
                        LIGHTNING_RING_OFFSETS.forEach(([ox, oy, oz], idx) => {
                            system.runTimeout(() => {
                                try {
                                    spawnSwordLightning(dim, {
                                        x: origin.x + ox,
                                        y: origin.y + oy,
                                        z: origin.z + oz,
                                    });
                                }
                                catch { }
                            }, Math.floor(idx / 8));
                        });
                        consumeMainhandDurability(player, 9);
                        break;
                    }
                    case 'effect:wither_sword': {
                        // Exact 2.8.8: launch a dangerous blue wither skull! (-3 durability)
                        if (!checkAndStartCooldown(player, 'wither_sword', 3))
                            return;
                        shootCustomProjectile(player, 'minecraft:wither_skull_dangerous', 1.5, 'effect:player_shot', 1.8, 0);
                        dim.playSound('mob.wither.shoot', player.location, { volume: 1.0, pitch: 0.7 });
                        consumeMainhandDurability(player, 3);
                        break;
                    }
                    case 'effect:ultra_instinct_sword': {
                        // Exact 2.8.8: `on_use` shoots `entity:ultra_instinct_projectile` with
                        // `launch_power: 1` (cooldown 61 s, durability -48). The remake launched
                        // it at 1.9, so the drill arrived almost twice as fast.
                        if (!checkAndStartCooldown(player, 'ultra_instinct_sword', 61))
                            return;
                        shootCustomProjectile(player, 'entity:ultra_instinct_projectile', 1.0, undefined, 2.0, 0);
                        dim.playSound('mob.wither.ambient', player.location, { volume: 2.0, pitch: 0.6 });
                        consumeMainhandDurability(player, 48);
                        break;
                    }
                }
            }
            catch { }
        },
    });
}
const lastAirSwingTick = new Map();
// Exact 2.8.8 `on_not_hurt_entity` parity: swinging ranged swords into the air fires their projectiles at distant targets!
export function registerAirSwingEvents() {
    world.afterEvents.playerLeave.subscribe((ev) => {
        spongeWaterTicks.delete(ev.playerId);
        lastDirectActionTick.delete(ev.playerId);
        lastAirSwingTick.delete(ev.playerId);
    });
    world.afterEvents.playerSwingStart.subscribe((event) => {
        if (event.swingSource !== EntitySwingSource.Attack)
            return;
        const player = event.player;
        const swingTick = system.currentTick;
        if (swingTick - (lastAirSwingTick.get(player.id) ?? -99) < 5)
            return;
        const itemId = event.heldItemStack?.typeId;
        if (!itemId || !itemId.startsWith('effect:'))
            return;
        system.runTimeout(() => {
            if (!player.isValid)
                return;
            // Skip if this swing hit an entity in melee, mined a block, or triggered right-click use!
            if ((lastDirectActionTick.get(player.id) ?? -99) >= swingTick - 1)
                return;
            if (getMainhandItem(player)?.typeId !== itemId)
                return;
            const dim = player.dimension;
            let fired = false;
            try {
                switch (itemId) {
                    case 'effect:bee_sword': {
                        fired = true;
                        if (Math.random() < 0.3) {
                            shootCustomProjectile(player, 'entity:bee_sword', 1.0);
                        }
                        break;
                    }
                    case 'effect:blaze_sword': {
                        fired = true;
                        const r = Math.random() * 100;
                        if (r < 14) {
                            player.addEffect('fire_resistance', 30, { amplifier: 0, showParticles: false });
                            shootCustomProjectile(player, 'minecraft:small_fireball', 1.35);
                        }
                        else if (r < 15) {
                            player.addEffect('fire_resistance', 30, { amplifier: 0, showParticles: false });
                            shootCustomProjectile(player, 'minecraft:fireball', 1.35, 'effect:player_shot');
                        }
                        break;
                    }
                    case 'effect:bone_sword': {
                        fired = true;
                        if (Math.random() < 0.2) {
                            shootCustomProjectile(player, 'minecraft:arrow', 1.6);
                            dim.playSound('random.bow', player.location, { volume: 0.9, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:creeper_sword': {
                        fired = true;
                        if (Math.random() < 0.2) {
                            shootCustomProjectile(player, 'entity:minicreeper', 1.0, 'effect:minicreeper_projectile');
                        }
                        break;
                    }
                    case 'effect:fire_sword': {
                        fired = true;
                        if (Math.random() < 0.15) {
                            const lf = shootCustomProjectile(player, 'entity:living_flame', 1.0, 'hostile_entity');
                            lf?.addTag('player_summoned');
                        }
                        else {
                            shootCustomProjectile(player, 'entity:fire', 1.3);
                        }
                        break;
                    }
                    case 'effect:lightning_sword': {
                        fired = true;
                        if (Math.random() < 0.85) {
                            shootCustomProjectile(player, 'entity:lightning_projectile', 1.8);
                            // 2.8.8 keeps an `electric_spark_particle` environment_sensor on the
                            // projectile, but its `queue_command` runs at the world origin, so the
                            // trail never appeared there either. Draw it from script instead.
                            const sparkAt = player.getHeadLocation();
                            const sparkDir = player.getViewDirection();
                            for (let i = 1; i <= 3; i++) {
                                dim.spawnParticle('minecraft:electric_spark_particle', {
                                    x: sparkAt.x + sparkDir.x * i * 0.5,
                                    y: sparkAt.y + sparkDir.y * i * 0.5,
                                    z: sparkAt.z + sparkDir.z * i * 0.5,
                                });
                            }
                        }
                        break;
                    }
                    case 'effect:nether_star_sword': {
                        fired = true;
                        shootCustomProjectile(player, 'entity:nether_star_projectile', 2.2, 'effect:nether_star_tracer');
                        const dir = player.getViewDirection();
                        const count = Math.random() < 0.2 ? 2 : 1;
                        const skyY = Math.min(dim.heightRange.max - 2, player.location.y + 18);
                        for (let i = 0; i < count; i++) {
                            dim.spawnEntity('entity:nether_star', {
                                x: player.location.x + dir.x * 6 + (Math.random() - 0.5) * 1.5,
                                y: skyY + i * 2,
                                z: player.location.z + dir.z * 6 + (Math.random() - 0.5) * 1.5,
                            });
                        }
                        if (Math.random() < 0.0001) {
                            dim.spawnEntity('entity:ultra_instinct_explode', player.location);
                        }
                        break;
                    }
                    case 'effect:cursed_pumpkin_sword': {
                        fired = true;
                        if (Math.random() < 0.8) {
                            shootCustomProjectile(player, 'entity:pumpkin_projectile', 0.95);
                        }
                        break;
                    }
                    case 'effect:shulker_sword': {
                        fired = true;
                        if (Math.random() < 0.1) {
                            shootCustomProjectile(player, 'minecraft:shulker_bullet', 1.1, 'effect:shulker_sword');
                            dim.playSound('random.bow', player.location, { volume: 1.0, pitch: 0.4 });
                        }
                        break;
                    }
                    case 'effect:spider_sword': {
                        fired = true;
                        if (Math.random() < 0.05) {
                            shootCustomProjectile(player, 'entity:web', 1.25);
                        }
                        break;
                    }
                    case 'effect:tnt_sword': {
                        fired = true;
                        if (Math.random() < 0.9) {
                            shootCustomProjectile(player, 'entity:tnt', 1.2);
                        }
                        break;
                    }
                    case 'effect:wither_sword': {
                        fired = true;
                        if (Math.random() < 0.1) {
                            shootCustomProjectile(player, 'minecraft:wither_skull', 1.4, 'effect:player_shot');
                            dim.playSound('mob.wither.shoot', player.location, { volume: 1.0, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:ice_sword': {
                        fired = true;
                        if (Math.random() < 0.3) {
                            shootCustomProjectile(player, 'minecraft:snowball', 1.4, 'effect:ice_sword_snowball');
                            dim.playSound('random.bow', player.location, { volume: 1, pitch: 0.4 });
                        }
                        break;
                    }
                    case 'effect:glass_sword': {
                        lastAirSwingTick.set(player.id, swingTick);
                        dim.playSound('random.glass', player.location, { volume: 1.2, pitch: 0.9 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:quartz_sword': {
                        // Exact 2.8.8 `weapon` step 2: `effect @a[r=1] instant_damage 1 99 true`
                        // plus the roar particle, after the 10-point durability cost. It hits
                        // everything within ONE block — the holder included — for instant
                        // damage at amplifier 99, i.e. a 600-heart hit that no armour survives.
                        // The remake only killed the swinging player and spawned the particle.
                        lastAirSwingTick.set(player.id, swingTick);
                        dim.spawnParticle('minecraft:knockback_roar_particle', {
                            x: player.location.x,
                            y: player.location.y + 1,
                            z: player.location.z,
                        });
                        if (player.getGameMode() !== GameMode.Creative) {
                            consumeMainhandDurability(player, 10);
                        }
                        for (const victim of dim.getEntities({ location: player.location, maxDistance: 1.0 })) {
                            try {
                                victim.addEffect('instant_damage', 20, { amplifier: 99, showParticles: false });
                            }
                            catch { }
                        }
                        break;
                    }
                    case 'effect:spectral_sword': {
                        lastAirSwingTick.set(player.id, swingTick);
                        if (Math.random() < 0.01) {
                            explodeSpectralCrystal(player);
                        }
                        else {
                            consumeMainhandDurability(player, 1);
                        }
                        break;
                    }
                    case 'effect:time_sword': {
                        lastAirSwingTick.set(player.id, swingTick);
                        const r = Math.random() * 100;
                        consumeMainhandDurability(player, r < 90 ? 1 : r < 96 ? 16 : r < 99 ? 32 : 64);
                        break;
                    }
                    case 'effect:clock_sword':
                    case 'effect:emerald_sword':
                    case 'effect:ghost_sword': {
                        fired = true;
                        break;
                    }
                    case 'effect:quartz_diamond_stick': {
                        fired = true;
                        if (player.getGameMode() !== GameMode.Creative) {
                            const r = Math.random() * 100;
                            const dmg = r < 10 ? 1 : r < 95 ? 3 : 6;
                            player.applyDamage(dmg, { cause: EntityDamageCause.magic });
                        }
                        break;
                    }
                }
                if (fired) {
                    lastAirSwingTick.set(player.id, swingTick);
                    consumeMainhandDurability(player, 1);
                }
            }
            catch { }
        }, 1);
    });
}
