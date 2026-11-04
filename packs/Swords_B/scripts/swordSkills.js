import { EntityComponentTypes, EntityDamageCause, GameMode, ItemStack, Player, system, } from '@minecraft/server';
import { openSwordsGuide } from './guideMenu.js';
import { consumeMainhandDurability, getMainhandItem, growInstantJungleTree, isFullMoonNight, isProtectedEntity, shootCustomProjectile, } from './utils.js';
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
                    if (b && (b.typeId === 'minecraft:water' || b.typeId === 'minecraft:flowing_water')) {
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
export function tryConvertSpongeSword(player) {
    const removed = absorbSpongeWater(player);
    if (removed <= 0)
        return false;
    try {
        const eq = player.getComponent(EntityComponentTypes.Equippable);
        const current = getMainhandItem(player);
        if (eq && current && current.typeId === 'effect:sponge_sword') {
            const wet = new ItemStack('effect:wet_sponge_sword', 1);
            const oldDur = current.getComponent('minecraft:durability');
            const newDur = wet.getComponent('minecraft:durability');
            if (oldDur && newDur) {
                newDur.damage = Math.min(newDur.maxDurability - 1, oldDur.damage);
            }
            eq.setEquipment('Mainhand', wet);
            player.dimension.playSound('random.splash', player.location, { volume: 0.9, pitch: 1.2 });
            return true;
        }
    }
    catch { }
    return false;
}
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
                event.durabilityDamage = 1 + Math.floor(Math.random() * 3);
            }
            else if (itemId === 'effect:time_sword') {
                event.durabilityDamage = 1 + Math.floor(Math.random() * 4);
            }
        },
        onMineBlock(event) {
            const { itemStack, source } = event;
            if (!itemStack || !(source instanceof Player))
                return;
            if (itemStack.typeId === 'effect:bedrock_sword' || itemStack.typeId === 'effect:bedrock_stick') {
                // Ensure zero durability loss when mining with Bedrock tools
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
                    case 'effect:coal_sword':
                        hitEntity.addEffect('blindness', 100, { amplifier: 0, showParticles: true });
                        dim.spawnParticle('minecraft:basic_smoke_particle', hitEntity.location);
                        break;
                    case 'effect:silver_sword':
                        if (hitEntity.typeId === 'entity:alpha_wolf') {
                            hitEntity.triggerEvent('clear_effects');
                            hitEntity.addTag('hit_by_silver');
                            hitEntity.applyDamage(8, { cause: EntityDamageCause.magic, damagingEntity: attackingEntity });
                            dim.playSound('random.anvil_land', hitEntity.location, { volume: 0.8, pitch: 1.5 });
                            dim.spawnParticle('minecraft:crit_emitter', hitEntity.location);
                        }
                        break;
                    case 'effect:glowstone_sword':
                        hitEntity.addEffect('blindness', 60, { amplifier: 0, showParticles: true });
                        dim.spawnParticle('minecraft:endrod', {
                            x: hitEntity.location.x,
                            y: hitEntity.location.y + 1,
                            z: hitEntity.location.z,
                        });
                        break;
                    case 'effect:glass_sword':
                        dim.playSound('random.glass', hitEntity.location, { volume: 1.2, pitch: 0.9 });
                        break;
                    case 'effect:jungle_sword':
                        hitEntity.addEffect('poison', 80, { amplifier: 0, showParticles: true });
                        break;
                    case 'effect:cactus_sword':
                        dim.spawnParticle('minecraft:crit_emitter', hitEntity.location);
                        break;
                    case 'effect:cursed_pumpkin_sword':
                        if (Math.random() < 0.15) {
                            hitEntity.addEffect('blindness', 120, { amplifier: 0, showParticles: true });
                            hitEntity.addEffect('nausea', 120, { amplifier: 0, showParticles: true });
                            dim.playSound('mob.witch.celebrate', hitEntity.location, { volume: 1.0, pitch: 0.8 });
                            const eq = hitEntity.getComponent(EntityComponentTypes.Equippable);
                            if (eq && !eq.getEquipment('Head')) {
                                eq.setEquipment('Head', new ItemStack('minecraft:carved_pumpkin', 1));
                            }
                        }
                        break;
                    case 'effect:bone_sword':
                        dim.playSound('mob.skeleton.hurt', hitEntity.location, { volume: 0.8, pitch: 1.1 });
                        break;
                    case 'effect:wither_skeleton_sword':
                        hitEntity.addEffect('wither', 120, { amplifier: 1, showParticles: true });
                        break;
                    case 'effect:slime_sword': {
                        const dx = hitEntity.location.x - attackingEntity.location.x;
                        const dz = hitEntity.location.z - attackingEntity.location.z;
                        const len = Math.hypot(dx, dz) || 1;
                        hitEntity.applyKnockback({ x: (dx / len) * 1.4, z: (dz / len) * 1.4 }, 0.55);
                        dim.playSound('mob.slime.big', hitEntity.location, { volume: 1.0, pitch: 1.0 });
                        break;
                    }
                    case 'effect:magma_sword':
                        hitEntity.setOnFire(5, true);
                        dim.spawnParticle('minecraft:lava_particle', hitEntity.location);
                        break;
                    case 'effect:clock_sword':
                        hitEntity.addEffect('slowness', 80, { amplifier: 2, showParticles: true });
                        break;
                    case 'effect:sea_sword':
                        hitEntity.addEffect('slowness', 80, { amplifier: 1, showParticles: true });
                        dim.spawnParticle('minecraft:water_splash_particle', hitEntity.location);
                        break;
                    case 'effect:blaze_sword':
                        hitEntity.setOnFire(8, true);
                        dim.playSound('mob.blaze.hit', hitEntity.location, { volume: 0.9, pitch: 1.0 });
                        break;
                    case 'effect:nether_star_sword':
                        hitEntity.addEffect('wither', 100, { amplifier: 1, showParticles: true });
                        if (hitEntity.typeId === 'minecraft:wither') {
                            hitEntity.addTag('slain_by_nether_star_sword');
                        }
                        break;
                    case 'effect:ice_sword':
                        // Preserve exact 8.5 damage (8 base + 0.5 frost bonus) + 30% snow freeze
                        hitEntity.applyDamage(0.5, { cause: EntityDamageCause.freezing, damagingEntity: attackingEntity });
                        hitEntity.addEffect('slowness', 80, { amplifier: 1, showParticles: true });
                        if (Math.random() < 0.3) {
                            const foot = dim.getBlock(hitEntity.location);
                            if (foot && foot.isAir) {
                                foot.setType('minecraft:snow_layer');
                            }
                            dim.playSound('random.glass', hitEntity.location, { volume: 0.8, pitch: 1.3 });
                        }
                        break;
                    case 'effect:quartz_sword':
                        // 600 lethal damage to target + instant sacrifice of wielder
                        hitEntity.applyDamage(600, { cause: EntityDamageCause.magic, damagingEntity: attackingEntity });
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
                    case 'effect:quartz_diamond_stick':
                        if (attackingEntity instanceof Player && attackingEntity.getGameMode() !== GameMode.Creative) {
                            const recoils = [2, 6, 12];
                            const dmg = recoils[Math.floor(Math.random() * recoils.length)];
                            attackingEntity.applyDamage(dmg, { cause: EntityDamageCause.magic });
                        }
                        break;
                    case 'effect:spider_sword':
                        hitEntity.addEffect('poison', 100, { amplifier: 1, showParticles: true });
                        if (Math.random() < 0.05) {
                            const foot = dim.getBlock(hitEntity.location);
                            if (foot && foot.isAir) {
                                foot.setType('minecraft:web');
                            }
                        }
                        break;
                    case 'effect:tnt_sword':
                        if (Math.random() < 0.9) {
                            dim.createExplosion(hitEntity.location, 2.2, {
                                breaksBlocks: false,
                                causesFire: false,
                                source: attackingEntity,
                            });
                        }
                        break;
                    case 'effect:wolf_sword':
                        if (isFullMoonNight()) {
                            hitEntity.applyDamage(15, { cause: EntityDamageCause.entityAttack, damagingEntity: attackingEntity });
                            attackingEntity.addEffect('regeneration', 60, { amplifier: 1, showParticles: false });
                            dim.playSound('mob.wolf.growl', hitEntity.location, { volume: 1.0, pitch: 0.85 });
                        }
                        break;
                    case 'effect:shulker_sword':
                        hitEntity.addEffect('levitation', 40, { amplifier: 1, showParticles: true });
                        if (Math.random() < 0.1 && attackingEntity instanceof Player) {
                            shootCustomProjectile(attackingEntity, 'minecraft:shulker_bullet', 1.1, 'effect:shulker_sword');
                        }
                        break;
                    case 'effect:bee_sword':
                        hitEntity.addEffect('poison', 100, { amplifier: 1, showParticles: true });
                        dim.playSound('mob.bee.sting', hitEntity.location, { volume: 0.9, pitch: 1.1 });
                        break;
                    case 'effect:creeper_sword':
                        dim.createExplosion(hitEntity.location, 2.0, {
                            breaksBlocks: false,
                            causesFire: false,
                            source: attackingEntity,
                        });
                        break;
                    case 'effect:fire_sword':
                        hitEntity.setOnFire(12, true);
                        dim.spawnParticle('minecraft:mobflame_single', hitEntity.location);
                        break;
                    case 'effect:spectral_sword':
                        hitEntity.addEffect('levitation', 25, { amplifier: 1, showParticles: true });
                        hitEntity.addEffect('weakness', 80, { amplifier: 0, showParticles: true });
                        break;
                    case 'effect:ender_sword':
                        if (Math.random() < 0.25) {
                            dim.spawnParticle('minecraft:portal_directional', hitEntity.location);
                            dim.playSound('mob.endermen.portal', hitEntity.location, { volume: 0.8, pitch: 1.2 });
                            hitEntity.applyKnockback({ x: 0, z: 0 }, 0.65);
                        }
                        break;
                    case 'effect:lightning_sword':
                        if (Math.random() < 0.85) {
                            dim.spawnEntity('minecraft:lightning_bolt', hitEntity.location);
                        }
                        break;
                    case 'effect:wither_sword':
                        hitEntity.addEffect('wither', 160, { amplifier: 2, showParticles: true });
                        break;
                    case 'effect:time_sword':
                        hitEntity.addEffect('slowness', 100, { amplifier: 5, showParticles: true });
                        hitEntity.addEffect('mining_fatigue', 100, { amplifier: 3, showParticles: false });
                        hitEntity.addEffect('weakness', 100, { amplifier: 1, showParticles: false });
                        dim.playSound('random.orb', hitEntity.location, { volume: 0.8, pitch: 0.5 });
                        break;
                    case 'effect:ultra_instinct_sword': {
                        const dx = hitEntity.location.x - attackingEntity.location.x;
                        const dz = hitEntity.location.z - attackingEntity.location.z;
                        const len = Math.hypot(dx, dz) || 1;
                        hitEntity.applyKnockback({ x: (dx / len) * 2.2, z: (dz / len) * 2.2 }, 0.7);
                        dim.playSound('random.explode', hitEntity.location, { volume: 0.8, pitch: 1.4 });
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
                            consumeMainhandDurability(source, 15);
                        }
                    }
                }
                else if (itemStack.typeId === 'effect:grass_sword') {
                    if (block.typeId === 'minecraft:dirt') {
                        block.setType('minecraft:grass_block');
                        dim.spawnParticle('minecraft:villager_happy', {
                            x: block.location.x + 0.5,
                            y: block.location.y + 1.1,
                            z: block.location.z + 0.5,
                        });
                        consumeMainhandDurability(source, 1);
                    }
                    else if (block.typeId === 'minecraft:grass_block' && blockFace === 'Up') {
                        const above = dim.getBlock({ x: block.location.x, y: block.location.y + 1, z: block.location.z });
                        if (above && above.isAir) {
                            const flora = ['minecraft:short_grass', 'minecraft:dandelion', 'minecraft:poppy', 'minecraft:azure_bluet'];
                            above.setType(flora[Math.floor(Math.random() * flora.length)]);
                            dim.spawnParticle('minecraft:villager_happy', {
                                x: above.location.x + 0.5,
                                y: above.location.y + 0.5,
                                z: above.location.z + 0.5,
                            });
                            consumeMainhandDurability(source, 1);
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
                    case 'effect:emerald_sword': {
                        if (!checkAndStartCooldown(player, 'emerald_sword', 10))
                            return;
                        player.addEffect('village_hero', 1200, { amplifier: 0, showParticles: true });
                        const villagers = dim.getEntities({
                            location: player.location,
                            maxDistance: 12,
                            type: 'minecraft:villager_v2',
                        });
                        for (const v of villagers) {
                            v.addEffect('regeneration', 200, { amplifier: 1, showParticles: true });
                            dim.spawnParticle('minecraft:villager_happy', { x: v.location.x, y: v.location.y + 1.5, z: v.location.z });
                        }
                        dim.playSound('random.levelup', player.location, { volume: 0.9, pitch: 1.2 });
                        consumeMainhandDurability(player, 5);
                        break;
                    }
                    case 'effect:slime_sword': {
                        if (!checkAndStartCooldown(player, 'slime_sword', 4))
                            return;
                        const slime = dim.spawnEntity('entity:mountable_slime', player.location);
                        const rideable = slime.getComponent(EntityComponentTypes.Rideable);
                        rideable?.addRider(player);
                        dim.playSound('mob.slime.big', player.location, { volume: 1.0, pitch: 1.0 });
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:clock_sword': {
                        if (!checkAndStartCooldown(player, 'clock_sword', 30))
                            return;
                        player.addEffect('speed', 140, { amplifier: 1, showParticles: true });
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 8 })) {
                            if (!isProtectedEntity(e, player)) {
                                e.addEffect('slowness', 140, { amplifier: 3, showParticles: true });
                            }
                        }
                        dim.playSound('random.orb', player.location, { volume: 1.0, pitch: 0.6 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:sea_sword': {
                        if (!player.isInWater)
                            return;
                        if (!checkAndStartCooldown(player, 'sea_sword', 5))
                            return;
                        const dir = player.getViewDirection();
                        player.applyKnockback({ x: dir.x * 2.4, z: dir.z * 2.4 }, Math.max(0.2, dir.y * 1.4));
                        dim.playSound('item.trident.riptide_3', player.location, { volume: 1.0, pitch: 1.0 });
                        consumeMainhandDurability(player, 4);
                        break;
                    }
                    case 'effect:blaze_sword': {
                        if (!checkAndStartCooldown(player, 'blaze_sword', 20))
                            return;
                        for (let shot = 0; shot < 3; shot++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                shootCustomProjectile(player, 'minecraft:fireball', 1.45, 'effect:player_shot', 1.8, 0.04);
                                player.dimension.playSound('mob.blaze.shoot', player.location, { volume: 1.0, pitch: 1.0 });
                            }, shot * 6);
                        }
                        consumeMainhandDurability(player, 12);
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
                                const ty = Math.min(dim.heightRange.max - 2, origin.y + 13);
                                try {
                                    const star = dim.spawnEntity('entity:nether_star_projectile', { x: tx, y: ty, z: tz });
                                    star.applyImpulse({ x: 0, y: -1.6, z: 0 });
                                }
                                catch { }
                            }, i * 3);
                        }
                        // Faithful 0.01% unstable overload Easter egg from original 2.8.8
                        if (Math.random() < 0.0001) {
                            dim.spawnEntity('entity:ultra_instinct_explode', player.location);
                        }
                        consumeMainhandDurability(player, 15);
                        break;
                    }
                    case 'effect:ice_sword': {
                        if (!checkAndStartCooldown(player, 'ice_sword', 5))
                            return;
                        const targets = dim
                            .getEntities({ location: player.location, maxDistance: 7.5 })
                            .filter((e) => !isProtectedEntity(e, player));
                        const buildIceCage = (cx, cy, cz) => {
                            const bx = Math.floor(cx);
                            const by = Math.floor(cy);
                            const bz = Math.floor(cz);
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = 0; dy <= 3; dy++) {
                                    for (let dz = -1; dz <= 1; dz++) {
                                        const isShell = Math.abs(dx) === 1 || Math.abs(dz) === 1 || dy === 0 || dy === 3;
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
                        if (targets.length > 0) {
                            for (const t of targets.slice(0, 5)) {
                                t.addEffect('slowness', 100, { amplifier: 3, showParticles: true });
                                buildIceCage(t.location.x, t.location.y, t.location.z);
                            }
                        }
                        else {
                            const dir = player.getViewDirection();
                            buildIceCage(player.location.x + dir.x * 4, player.location.y + dir.y * 2, player.location.z + dir.z * 4);
                        }
                        dim.playSound('random.glass', player.location, { volume: 1.0, pitch: 0.8 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:spider_sword': {
                        if (!checkAndStartCooldown(player, 'spider_sword', 28))
                            return;
                        for (let i = 0; i < 12; i++) {
                            system.runTimeout(() => {
                                if (!player.isValid)
                                    return;
                                shootCustomProjectile(player, 'entity:web', 1.35, undefined, 1.5, 0.08);
                                player.dimension.playSound('mob.spider.step', player.location, { volume: 0.8, pitch: 1.4 });
                            }, i * 5);
                        }
                        consumeMainhandDurability(player, 14);
                        break;
                    }
                    case 'effect:tnt_sword': {
                        if (!checkAndStartCooldown(player, 'tnt_sword', 10))
                            return;
                        const head = player.getHeadLocation();
                        const dir = player.getViewDirection();
                        const spawnPos = {
                            x: head.x + dir.x * 1.8,
                            y: head.y + dir.y * 1.8,
                            z: head.z + dir.z * 1.8,
                        };
                        const giantTnt = dim.spawnEntity('minecraft:tnt', spawnPos, { spawnEvent: 'giant_tnt' });
                        giantTnt.applyImpulse({ x: dir.x * 1.35, y: dir.y * 1.1 + 0.25, z: dir.z * 1.35 });
                        dim.playSound('game.tnt.primed', player.location, { volume: 1.2, pitch: 0.8 });
                        consumeMainhandDurability(player, 20);
                        break;
                    }
                    case 'effect:wolf_sword': {
                        if (!checkAndStartCooldown(player, 'wolf_sword', 10))
                            return;
                        player.addEffect('strength', 160, { amplifier: 1, showParticles: true });
                        player.addEffect('speed', 160, { amplifier: 1, showParticles: true });
                        dim.playSound('mob.wolf.howl', player.location, { volume: 1.2, pitch: 0.95 });
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:shulker_sword': {
                        if (!checkAndStartCooldown(player, 'shulker_sword', 8))
                            return;
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 6.5 })) {
                            if (!isProtectedEntity(e, player)) {
                                e.addEffect('levitation', 100, { amplifier: 4, showParticles: true });
                                dim.spawnParticle('minecraft:endrod', e.location);
                            }
                        }
                        dim.playSound('mob.shulker.shoot', player.location, { volume: 1.1, pitch: 0.9 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:bee_sword': {
                        if (!checkAndStartCooldown(player, 'bee_sword', 10))
                            return;
                        for (let i = 0; i < 3; i++) {
                            const angle = (Math.PI * 2 * i) / 3;
                            const bx = player.location.x + Math.cos(angle) * 1.5;
                            const bz = player.location.z + Math.sin(angle) * 1.5;
                            dim.spawnEntity('entity:bee_sword', { x: bx, y: player.location.y + 1.2, z: bz });
                        }
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 7 })) {
                            if (!isProtectedEntity(e, player)) {
                                e.addEffect('poison', 140, { amplifier: 1, showParticles: true });
                                e.applyDamage(5, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
                            }
                        }
                        dim.playSound('mob.bee.aggressive', player.location, { volume: 1.0, pitch: 1.0 });
                        consumeMainhandDurability(player, 10);
                        break;
                    }
                    case 'effect:ghost_sword': {
                        if (!checkAndStartCooldown(player, 'ghost_sword', 2))
                            return;
                        shootCustomProjectile(player, 'entity:ghost_projectile', 1.4);
                        dim.playSound('mob.vex.charge', player.location, { volume: 0.8, pitch: 0.7 });
                        consumeMainhandDurability(player, 2);
                        break;
                    }
                    case 'effect:creeper_sword': {
                        if (!checkAndStartCooldown(player, 'creeper_sword', 3))
                            return;
                        shootCustomProjectile(player, 'entity:minicreeper', 1.35);
                        dim.playSound('random.fuse', player.location, { volume: 1.0, pitch: 1.2 });
                        consumeMainhandDurability(player, 6);
                        break;
                    }
                    case 'effect:fire_sword': {
                        if (!checkAndStartCooldown(player, 'fire_sword', 25))
                            return;
                        dim.playSound('mob.blaze.breathe', player.location, { volume: 1.2, pitch: 0.8 });
                        for (let i = 0; i < 12; i++) {
                            const angle = (Math.PI * 2 * i) / 12;
                            const fx = player.location.x + Math.cos(angle) * 3.0;
                            const fz = player.location.z + Math.sin(angle) * 3.0;
                            try {
                                dim.spawnEntity('entity:fire', { x: fx, y: player.location.y + 0.5, z: fz });
                            }
                            catch { }
                        }
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 7 })) {
                            if (!isProtectedEntity(e, player)) {
                                e.setOnFire(12, true);
                                e.applyDamage(12, { cause: EntityDamageCause.fireTick, damagingEntity: player });
                                const dx = e.location.x - player.location.x;
                                const dz = e.location.z - player.location.z;
                                const len = Math.hypot(dx, dz) || 1;
                                e.applyKnockback({ x: (dx / len) * 1.6, z: (dz / len) * 1.6 }, 0.5);
                            }
                        }
                        consumeMainhandDurability(player, 18);
                        break;
                    }
                    case 'effect:spectral_sword': {
                        if (!checkAndStartCooldown(player, 'spectral_sword', 18))
                            return;
                        shootCustomProjectile(player, 'entity:ender_crystal_projectile', 1.45);
                        dim.playSound('mob.endermen.portal', player.location, { volume: 1.0, pitch: 1.4 });
                        consumeMainhandDurability(player, 16);
                        break;
                    }
                    case 'effect:ender_sword': {
                        if (!checkAndStartCooldown(player, 'ender_sword', 2))
                            return;
                        const head = player.getHeadLocation();
                        const dir = player.getViewDirection();
                        let targetPos = { x: player.location.x, y: player.location.y, z: player.location.z };
                        for (let dist = 1; dist <= 22; dist++) {
                            const cx = head.x + dir.x * dist;
                            const cy = head.y + dir.y * dist;
                            const cz = head.z + dir.z * dist;
                            const b = dim.getBlock({ x: Math.floor(cx), y: Math.floor(cy), z: Math.floor(cz) });
                            if (!b || (!b.isAir && !b.isLiquid)) {
                                break;
                            }
                            targetPos = { x: cx, y: cy, z: cz };
                        }
                        dim.spawnParticle('minecraft:portal_directional', player.location);
                        dim.playSound('mob.endermen.portal', player.location, { volume: 1.0, pitch: 1.0 });
                        player.teleport(targetPos);
                        player.addEffect('slow_falling', 30, { amplifier: 0, showParticles: false });
                        dim.spawnParticle('minecraft:portal_directional', targetPos);
                        dim.playSound('mob.endermen.portal', targetPos, { volume: 1.0, pitch: 1.1 });
                        consumeMainhandDurability(player, 4);
                        break;
                    }
                    case 'effect:lightning_sword': {
                        if (!checkAndStartCooldown(player, 'lightning_sword', 12))
                            return;
                        const origin = { ...player.location };
                        // 41-bolt concentric storm ring around wielder (faithful to 2.8.8!)
                        const innerCount = 17;
                        const outerCount = 24;
                        for (let i = 0; i < innerCount; i++) {
                            const angle = (Math.PI * 2 * i) / innerCount;
                            system.runTimeout(() => {
                                try {
                                    dim.spawnEntity('minecraft:lightning_bolt', {
                                        x: origin.x + Math.cos(angle) * 5.5,
                                        y: origin.y,
                                        z: origin.z + Math.sin(angle) * 5.5,
                                    });
                                }
                                catch { }
                            }, Math.floor(i / 4));
                        }
                        for (let i = 0; i < outerCount; i++) {
                            const angle = (Math.PI * 2 * i) / outerCount;
                            system.runTimeout(() => {
                                try {
                                    dim.spawnEntity('minecraft:lightning_bolt', {
                                        x: origin.x + Math.cos(angle) * 9.0,
                                        y: origin.y,
                                        z: origin.z + Math.sin(angle) * 9.0,
                                    });
                                }
                                catch { }
                            }, 3 + Math.floor(i / 4));
                        }
                        consumeMainhandDurability(player, 22);
                        break;
                    }
                    case 'effect:wither_sword': {
                        if (!checkAndStartCooldown(player, 'wither_sword', 3))
                            return;
                        shootCustomProjectile(player, 'minecraft:wither_skull_dangerous', 1.5, 'effect:player_shot', 1.8, 0);
                        shootCustomProjectile(player, 'minecraft:wither_skull', 1.4, 'effect:player_shot', 1.8, 0.14);
                        shootCustomProjectile(player, 'minecraft:wither_skull', 1.4, 'effect:player_shot', 1.8, 0.14);
                        dim.playSound('mob.wither.shoot', player.location, { volume: 1.0, pitch: 1.0 });
                        consumeMainhandDurability(player, 8);
                        break;
                    }
                    case 'effect:time_sword': {
                        if (!checkAndStartCooldown(player, 'time_sword', 12))
                            return;
                        for (const e of dim.getEntities({ location: player.location, maxDistance: 10 })) {
                            if (!isProtectedEntity(e, player)) {
                                e.addEffect('slowness', 120, { amplifier: 6, showParticles: true });
                                e.addEffect('weakness', 120, { amplifier: 2, showParticles: false });
                            }
                        }
                        dim.playSound('block.bell.hit', player.location, { volume: 1.2, pitch: 1.5 });
                        consumeMainhandDurability(player, 12);
                        break;
                    }
                    case 'effect:ultra_instinct_sword': {
                        if (!checkAndStartCooldown(player, 'ultra_instinct_sword', 61))
                            return;
                        shootCustomProjectile(player, 'entity:ultra_instinct_projectile', 1.9, undefined, 2.0, 0);
                        dim.playSound('mob.warden.sonic_boom', player.location, { volume: 1.2, pitch: 1.3 });
                        consumeMainhandDurability(player, 35);
                        break;
                    }
                }
            }
            catch { }
        },
    });
}
