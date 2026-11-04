import { EntityComponentTypes, EntityDamageCause, GameMode, ItemStack, Player, system, world, } from '@minecraft/server';
import { openSwordsGuide } from './guideMenu.js';
import { consumeMainhandDurability, getMainhandItem, growInstantJungleTree, isFullMoonNight, isProtectedEntity, safeRandomTeleport, shootCustomProjectile, } from './utils.js';
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
function absorbSpongeWater(player) {
    const dim = player.dimension;
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    let removed = 0;
    try {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const b = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                    if (b &&
                        (b.typeId === 'minecraft:water' ||
                            b.typeId === 'minecraft:flowing_water' ||
                            b.typeId === 'minecraft:seagrass')) {
                        b.setType('minecraft:air');
                        removed++;
                    }
                }
            }
        }
    }
    catch { }
    return removed;
}
const spongeWaterTicks = new Map();
export function tryConvertSpongeSword(player) {
    const removed = absorbSpongeWater(player);
    if (removed <= 0)
        return false;
    const prev = (spongeWaterTicks.get(player.id) ?? 0) + 1;
    spongeWaterTicks.set(player.id, prev);
    try {
        player.dimension.playSound('random.fizz', player.location, { volume: 0.5, pitch: 1.1 });
    }
    catch { }
    // Original description: "after several seconds absorbing water the sword will transform into a wet sponge sword"
    if (prev < 4)
        return false;
    spongeWaterTicks.delete(player.id);
    try {
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        const current = getMainhandItem(player);
        if (eq && current && current.typeId === 'effect:sponge_sword') {
            const wet = new ItemStack('effect:wet_sponge_sword', 1);
            eq.setEquipment('Mainhand', wet);
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
export function registerItemComponents(registry) {
    // Interactive Encyclopedia Book
    registry.registerCustomComponent('effect:guide', {
        onUse(event) {
            openSwordsGuide(event.source);
        },
    });
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
            if (itemStack.typeId === 'effect:bedrock_sword' || itemStack.typeId === 'effect:bedrock_stick') {
                return;
            }
            if (source.getGameMode() !== GameMode.Creative) {
                consumeMainhandDurability(source, 1);
            }
        },
        onHitEntity(event) {
            const { attackingEntity, hitEntity, itemStack } = event;
            if (!itemStack || !hitEntity.isValid)
                return;
            const dim = hitEntity.dimension;
            const id = itemStack.typeId;
            try {
                switch (id) {
                    case 'effect:bee_sword': {
                        // Exact 2.8.8: 30% chance to release aggressive defending bee (entity:bee_sword)
                        if (Math.random() < 0.3 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:bee_sword', 1.0);
                        }
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
                        break;
                    }
                    case 'effect:bone_sword': {
                        // Exact 2.8.8: 20% chance to shoot an arrow when attacking!
                        if (Math.random() < 0.2 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:arrow', 1.6);
                            dim.playSound('random.bow', attackingEntity.location, { volume: 0.9, pitch: 1.0 });
                        }
                        break;
                    }
                    case 'effect:silver_sword': {
                        // Extra damage & strips regen/resistance from Alpha Wolf!
                        if (hitEntity.typeId === 'entity:alpha_wolf') {
                            hitEntity.triggerEvent('clear_effects');
                            hitEntity.addTag('hit_by_silver');
                            hitEntity.applyDamage(12, { cause: EntityDamageCause.magic, damagingEntity: attackingEntity });
                            dim.playSound('random.anvil_land', hitEntity.location, { volume: 0.8, pitch: 1.5 });
                            dim.spawnParticle('minecraft:crit_emitter', hitEntity.location);
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
                        if (Math.random() < 0.15) {
                            const eq = hitEntity.getComponent(EntityComponentTypes.Equippable);
                            if (eq && !eq.getEquipment('Head')) {
                                eq.setEquipment('Head', new ItemStack('minecraft:carved_pumpkin', 1));
                            }
                        }
                        break;
                    }
                    case 'effect:wither_skeleton_sword': {
                        hitEntity.addEffect('wither', 120, { amplifier: 1, showParticles: true });
                        if (attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:wither_effect', 1.1);
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
                        if (hitEntity.typeId === 'minecraft:wither') {
                            hitEntity.addTag('slain_by_nether_star_sword');
                        }
                        // Exact 2.8.8: shoot nether_star_projectile + summon 1 (80%) or 2 (20%) falling nether_star from sky (6 dmg each)
                        if (attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:nether_star_projectile', 1.3);
                        }
                        const count = Math.random() < 0.2 ? 2 : 1;
                        for (let i = 0; i < count; i++) {
                            const skyY = Math.min(dim.heightRange.max - 2, hitEntity.location.y + 18 + i * 2);
                            const star = dim.spawnEntity('entity:nether_star', {
                                x: hitEntity.location.x + (Math.random() - 0.5) * 1.5,
                                y: skyY,
                                z: hitEntity.location.z + (Math.random() - 0.5) * 1.5,
                            });
                            star.applyImpulse({ x: 0, y: -1.4, z: 0 });
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
                        break;
                    }
                    case 'effect:quartz_sword': {
                        // 600 lethal damage + instant sacrifice of wielder
                        hitEntity.applyDamage(600, { cause: EntityDamageCause.magic, damagingEntity: attackingEntity });
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
                        break;
                    }
                    case 'effect:tnt_sword': {
                        // Exact 2.8.8: 90% chance to shoot entity:tnt small explosion on hit
                        if (Math.random() < 0.9 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:tnt', 1.2);
                        }
                        break;
                    }
                    case 'effect:wolf_sword': {
                        // Exact 2.8.8: 20 total melee damage during Full Moon night!
                        if (isFullMoonNight()) {
                            hitEntity.applyDamage(20, { cause: EntityDamageCause.entityAttack, damagingEntity: attackingEntity });
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
                        break;
                    }
                    case 'effect:creeper_sword': {
                        // Exact 2.8.8: 20% chance to launch small creeper on hit!
                        if (Math.random() < 0.2 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'entity:minicreeper', 1.15);
                            dim.playSound('random.fuse', attackingEntity.location, { volume: 0.9, pitch: 1.4 });
                        }
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
                        // Exact 2.8.8: 1% unstable explosion chance when attacking entities!
                        if (Math.random() < 0.01) {
                            dim.createExplosion(hitEntity.location, 3.0, {
                                breaksBlocks: false,
                                causesFire: false,
                                source: attackingEntity,
                            });
                        }
                        break;
                    }
                    case 'effect:lightning_sword': {
                        // Exact 2.8.8: 85% chance to shoot lightning_projectile / thunder on attack!
                        if (Math.random() < 0.85) {
                            if (attackingEntity instanceof Player) {
                                shootCustomProjectile(attackingEntity, 'entity:lightning_projectile', 1.5);
                            }
                            dim.spawnEntity('minecraft:lightning_bolt', hitEntity.location);
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
            const dim = player.dimension;
            const id = itemStack.typeId;
            try {
                switch (id) {
                    case 'effect:sponge_sword': {
                        tryConvertSpongeSword(player);
                        break;
                    }
                    case 'effect:slime_sword': {
                        // Re-mount existing nearby mountable_slime or spawn one if missing
                        const existing = dim.getEntities({
                            location: player.location,
                            maxDistance: 16,
                            type: 'entity:mountable_slime',
                        });
                        const slime = existing[0] ?? dim.spawnEntity('entity:mountable_slime', player.location);
                        slime.triggerEvent('minecraft:entity_spawned');
                        const rideable = slime.getComponent(EntityComponentTypes.Rideable);
                        rideable?.addRider(player);
                        dim.playSound('mob.slime.big', player.location, { volume: 1.0, pitch: 1.0 });
                        break;
                    }
                    case 'effect:clock_sword': {
                        // Exact 2.8.8: advance 1 hour (1000 ticks) & speed up world 10x for 5 seconds! (-10 durability)
                        if (!checkAndStartCooldown(player, 'clock_sword', 30))
                            return;
                        world.setTimeOfDay((world.getTimeOfDay() + 1000) % 24000);
                        player.addEffect('speed', 100, { amplifier: 3, showParticles: false });
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 24 })) {
                            if (e.typeId !== 'minecraft:item' && e.typeId !== 'minecraft:xp_orb') {
                                try {
                                    e.addEffect('speed', 100, { amplifier: 2, showParticles: false });
                                }
                                catch { }
                            }
                        }
                        try {
                            dim.runCommand('gamerule randomtickspeed 30');
                            system.runTimeout(() => {
                                try {
                                    world.getDimension('overworld').runCommand('gamerule randomtickspeed 1');
                                }
                                catch { }
                            }, 100);
                        }
                        catch { }
                        dim.playSound('random.orb', player.location, { volume: 1.0, pitch: 0.6 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:blaze_sword': {
                        // Exact 2.8.8: levitate for 7s + slow_falling 10s, then launch volley of small fireballs! (-10 durability)
                        if (!checkAndStartCooldown(player, 'blaze_sword', 20))
                            return;
                        player.addEffect('levitation', 140, { amplifier: 0, showParticles: false });
                        player.addEffect('slow_falling', 200, { amplifier: 3, showParticles: false });
                        dim.playSound('mob.blaze.breathe', player.location, { volume: 1.0, pitch: 1.0 });
                        for (let shot = 0; shot < 8; shot++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                shootCustomProjectile(player, 'minecraft:small_fireball', 1.5, undefined, 1.7, 0.06);
                                player.dimension.playSound('mob.blaze.shoot', player.location, { volume: 1.0, pitch: 1.0 });
                            }, 30 + shot * 8);
                        }
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:nether_star_sword': {
                        if (!checkAndStartCooldown(player, 'nether_star_sword', 8))
                            return;
                        const dir = player.getViewDirection();
                        const origin = player.location;
                        dim.playSound('mob.wither.shoot', origin, { volume: 1.0, pitch: 1.2 });
                        for (let i = 1; i <= 6; i++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                const tx = origin.x + dir.x * (i * 2.8) + (Math.random() - 0.5) * 2.0;
                                const tz = origin.z + dir.z * (i * 2.8) + (Math.random() - 0.5) * 2.0;
                                const ty = Math.min(dim.heightRange.max - 2, origin.y + 15);
                                try {
                                    const star = dim.spawnEntity('entity:nether_star', { x: tx, y: ty, z: tz });
                                    star.applyImpulse({ x: 0, y: -1.4, z: 0 });
                                }
                                catch { }
                            }, i * 3);
                        }
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:ice_sword': {
                        // Exact 2.8.8: encase entities within radius 8-12 in size-adapted Fake Ice cages! (-6 durability)
                        if (!checkAndStartCooldown(player, 'ice_sword', 5))
                            return;
                        const targets = dim
                            .getEntities({ location: player.location, maxDistance: 10 })
                            .filter((e) => !isProtectedEntity(e, player));
                        const buildIceCage = (cx, cy, cz, rx = 1, hy = 2) => {
                            const bx = Math.floor(cx);
                            const by = Math.floor(cy);
                            const bz = Math.floor(cz);
                            for (let dx = -rx; dx <= rx; dx++) {
                                for (let dy = -1; dy <= hy; dy++) {
                                    for (let dz = -rx; dz <= rx; dz++) {
                                        const isShell = Math.abs(dx) === rx || Math.abs(dz) === rx || dy === -1 || dy === hy;
                                        if (!isShell)
                                            continue;
                                        const b = dim.getBlock({ x: bx + dx, y: by + dy, z: bz + dz });
                                        if (b && (b.isAir || b.typeId === 'minecraft:snow_layer' || b.typeId === 'minecraft:short_grass')) {
                                            b.setType('effect99:fake_ice');
                                        }
                                    }
                                }
                            }
                        };
                        for (const t of targets.slice(0, 8)) {
                            const isTall = t.typeId === 'minecraft:enderman';
                            const isHuge = t.typeId === 'minecraft:ghast' || t.typeId === 'entity:slime_king';
                            buildIceCage(t.location.x, t.location.y, t.location.z, isHuge ? 3 : 1, isHuge ? 4 : isTall ? 3 : 2);
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
                        // Exact 2.8.8: fire cobweb projectiles continuously for 2-3 seconds! (-8 durability)
                        if (!checkAndStartCooldown(player, 'spider_sword', 28))
                            return;
                        for (let i = 0; i < 12; i++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                shootCustomProjectile(player, 'entity:web', 1.35, undefined, 1.5, 0.08);
                                player.dimension.playSound('mob.spider.step', player.location, { volume: 0.8, pitch: 1.4 });
                            }, i * 4);
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
                                e.addEffect('levitation', 25, { amplifier: 18, showParticles: false });
                            }
                        }
                        dim.playSound('mob.shulker.shoot', player.location, { volume: 1.1, pitch: 0.9 });
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:bee_sword': {
                        if (!checkAndStartCooldown(player, 'bee_sword', 8))
                            return;
                        for (let i = 0; i < 3; i++) {
                            shootCustomProjectile(player, 'entity:bee_sword', 1.1, undefined, 1.5, 0.2);
                        }
                        dim.playSound('mob.bee.aggressive', player.location, { volume: 1.0, pitch: 1.0 });
                        consumeMainhandDurability(player, 4);
                        break;
                    }
                    case 'effect:ghost_sword': {
                        // Exact 2.8.8: teleport in any direction the player is looking via ghost_projectile / raycast! (-6 durability)
                        if (!checkAndStartCooldown(player, 'ghost_sword', 2))
                            return;
                        shootCustomProjectile(player, 'entity:ghost_projectile', 2.2);
                        const head = player.getHeadLocation();
                        const dir = player.getViewDirection();
                        let dest = { x: player.location.x, y: player.location.y, z: player.location.z };
                        for (let d = 1; d <= 20; d++) {
                            const cx = head.x + dir.x * d;
                            const cy = head.y + dir.y * d;
                            const cz = head.z + dir.z * d;
                            const b = dim.getBlock({ x: Math.floor(cx), y: Math.floor(cy), z: Math.floor(cz) });
                            if (b && b.isAir) {
                                dest = { x: cx, y: cy, z: cz };
                            }
                        }
                        player.teleport(dest);
                        dim.playSound('mob.endermen.portal', dest, { volume: 0.8, pitch: 1.4 });
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
                        player.addEffect('slowness', 32, { amplifier: 10, showParticles: false });
                        dim.playSound('random.fuse', player.location, { volume: 1.2, pitch: 1.0 });
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
                        dim.playSound('mob.blaze.breathe', loc, { volume: 1.2, pitch: 0.8 });
                        consumeMainhandDurability(player, 20);
                        break;
                    }
                    case 'effect:spectral_sword': {
                        // Exact 2.8.8: fire explosive ender_crystal_projectile! (-15 durability)
                        if (!checkAndStartCooldown(player, 'spectral_sword', 18))
                            return;
                        shootCustomProjectile(player, 'entity:ender_crystal_projectile', 1.45);
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
                                    dim.spawnEntity('minecraft:lightning_bolt', {
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
                        // Exact 2.8.8: fire ultra_instinct_projectile (cooldown 61s, durability -48)
                        if (!checkAndStartCooldown(player, 'ultra_instinct_sword', 61))
                            return;
                        shootCustomProjectile(player, 'entity:ultra_instinct_projectile', 1.9, undefined, 2.0, 0);
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
