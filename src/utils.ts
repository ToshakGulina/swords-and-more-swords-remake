import {
  Dimension,
  Entity,
  EntityComponentTypes,
  EntityEquippableComponent,
  EntityInventoryComponent,
  EntityProjectileComponent,
  EquipmentSlot,
  GameMode,
  ItemComponentTypes,
  ItemDurabilityComponent,
  ItemEnchantableComponent,
  ItemStack,
  MoonPhase,
  Player,
  Vector3,
  world,
} from '@minecraft/server';

export function getMainhandItem(player: Player): ItemStack | undefined {
  try {
    const eq = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined;
    return eq?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

export function getOffhandItem(player: Player): ItemStack | undefined {
  try {
    const eq = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined;
    return eq?.getEquipment(EquipmentSlot.Offhand);
  } catch {
    return undefined;
  }
}

export function consumeMainhandDurability(player: Player, amount: number): boolean {
  if (amount <= 0) return true;
  try {
    if (player.getGameMode() === GameMode.Creative) return true;
    const eq = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent | undefined;
    const item = eq?.getEquipment(EquipmentSlot.Mainhand);
    if (!item) return false;
    const dur = item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent | undefined;
    if (!dur) return true;

    let actualLoss = 0;
    const ench = item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent | undefined;
    const unbreakingLevel = ench?.getEnchantment('unbreaking')?.level ?? 0;
    for (let i = 0; i < amount; i++) {
      if (unbreakingLevel > 0) {
        // Vanilla weapon Unbreaking formula: chance to take durability damage = 1 / (level + 1)
        if (Math.random() * (unbreakingLevel + 1) >= 1) continue;
      }
      actualLoss++;
    }
    if (actualLoss <= 0) return true;

    if (dur.damage + actualLoss >= dur.maxDurability) {
      eq?.setEquipment(EquipmentSlot.Mainhand, undefined);
      player.dimension.playSound('random.break', player.location, { volume: 1.0, pitch: 0.9 + Math.random() * 0.2 });
      return false;
    } else {
      dur.damage += actualLoss;
      eq?.setEquipment(EquipmentSlot.Mainhand, item);
      return true;
    }
  } catch {
    return false;
  }
}

export function giveOrDropItem(player: Player, itemStack: ItemStack): void {
  try {
    const inv = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent | undefined;
    const leftover = inv?.container?.addItem(itemStack);
    if (leftover) {
      player.dimension.spawnItem(leftover, player.location);
    }
  } catch {
    try {
      player.dimension.spawnItem(itemStack, player.location);
    } catch {}
  }
}

export function isProtectedEntity(entity: Entity, owner?: Entity): boolean {
  if (!entity.isValid) return true;
  if (owner && entity.id === owner.id) return true;
  const typeId = entity.typeId;
  if (
    typeId === 'minecraft:item' ||
    typeId === 'minecraft:xp_orb' ||
    typeId === 'minecraft:npc' ||
    typeId === 'minecraft:armor_stand' ||
    typeId.startsWith('effect:')
  ) {
    return true;
  }
  try {
    // Protect tamed pets (wolves, cats, parrots, horses, etc.)
    if (entity.getComponent('minecraft:is_tamed')) return true;
    if (entity.matches({ families: ['effect99_entities'] })) return true;
  } catch {}
  return false;
}

export function shootCustomProjectile(
  player: Player,
  entityId: string,
  speed: number,
  spawnEvent?: string,
  forwardOffset = 1.6,
  inaccuracy = 0
): Entity | undefined {
  try {
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    const spawnPos: Vector3 = {
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

    const projComp = proj.getComponent(EntityComponentTypes.Projectile) as EntityProjectileComponent | undefined;
    if (projComp) {
      projComp.owner = player;
      projComp.shoot({ x: vx * speed, y: vy * speed, z: vz * speed });
    } else {
      proj.applyImpulse({ x: vx * speed, y: vy * speed, z: vz * speed });
    }
    return proj;
  } catch {
    return undefined;
  }
}

export function safeRandomTeleport(entity: Entity, minRadius: number, maxRadius: number): boolean {
  try {
    const dim = entity.dimension;
    const origin = entity.location;
    const heightRange = dim.heightRange;

    for (let attempt = 0; attempt < 24; attempt++) {
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
        if (!below || !foot || !head) continue;
        if (
          !below.isAir &&
          !below.isLiquid &&
          below.typeId !== 'minecraft:magma' &&
          below.typeId !== 'minecraft:cactus' &&
          (foot.isAir || foot.typeId === 'minecraft:short_grass' || foot.typeId === 'minecraft:snow_layer') &&
          head.isAir
        ) {
          dim.spawnParticle('minecraft:portal_directional', entity.location);
          dim.playSound('mob.endermen.portal', entity.location, { volume: 1.0, pitch: 1.0 });
          entity.teleport({ x: tx + 0.5, y, z: tz + 0.5 });
          dim.spawnParticle('minecraft:portal_directional', { x: tx + 0.5, y: y + 1.0, z: tz + 0.5 });
          dim.playSound('mob.endermen.portal', { x: tx + 0.5, y, z: tz + 0.5 }, { volume: 1.0, pitch: 1.1 });
          return true;
        }
      }
    }
  } catch {}
  return false;
}

export function isFullMoonNight(): boolean {
  const time = world.getTimeOfDay();
  // Nighttime in Minecraft is roughly 13000..23000, Full Moon is MoonPhase.FullMoon (0)
  return time >= 13000 && time <= 23000 && world.getMoonPhase() === MoonPhase.FullMoon;
}

export function isDesertWellWater(dim: Dimension, loc: Vector3): boolean {
  try {
    const center = dim.getBlock(loc);
    if (!center || (center.typeId !== 'minecraft:water' && center.typeId !== 'minecraft:flowing_water')) {
      return false;
    }
    // Vanilla Desert Well water basin is surrounded by sandstone / cut_sandstone / sandstone_slab / chiseled_sandstone
    let sandstoneCount = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 2; dy++) {
        for (let dz = -2; dz <= 2; dz++) {
          const b = dim.getBlock({ x: Math.floor(loc.x) + dx, y: Math.floor(loc.y) + dy, z: Math.floor(loc.z) + dz });
          if (b && b.typeId.includes('sandstone')) {
            sandstoneCount++;
            if (sandstoneCount >= 10) return true;
          }
        }
      }
    }
  } catch {}
  return false;
}

export function growInstantJungleTree(dim: Dimension, baseLoc: Vector3): void {
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

    // Add hanging vines around the outer canopy
    for (let dx = -4; dx <= 5; dx++) {
      for (let dz = -4; dz <= 5; dz++) {
        const dist = Math.hypot(dx - 0.5, dz - 0.5);
        if (dist >= 3.2 && dist <= 4.3 && Math.random() < 0.45) {
          const vineLen = 2 + Math.floor(Math.random() * 4);
          for (let vy = 0; vy < vineLen; vy++) {
            const vb = dim.getBlock({ x: bx + dx, y: by + height - 3 - vy, z: bz + dz });
            if (vb && vb.isAir) {
              vb.setType('minecraft:vine');
            } else {
              break;
            }
          }
        }
      }
    }

    dim.playSound('block.chorusflower.grow', { x: bx + 0.5, y: by + 2, z: bz + 0.5 }, { volume: 1.0, pitch: 0.9 });
    dim.spawnParticle('minecraft:villager_happy', { x: bx + 0.5, y: by + 1.5, z: bz + 0.5 });
  } catch {}
}
