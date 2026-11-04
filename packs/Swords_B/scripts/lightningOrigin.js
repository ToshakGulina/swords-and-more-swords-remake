import { system } from '@minecraft/server';
// Register before spawning because the entitySpawn callback may run before
// spawnEntity returns. Mark individual bolts rather than suppressing natural
// lightning merely because somebody nearby happens to hold the sword.
const pending = [];
export function spawnSwordLightning(dimension, location) {
    const marker = { dimension: dimension.id, location: { ...location }, tick: system.currentTick };
    pending.push(marker);
    try {
        dimension.spawnEntity('minecraft:lightning_bolt', location);
    }
    catch (error) {
        const index = pending.indexOf(marker);
        if (index >= 0)
            pending.splice(index, 1);
        throw error;
    }
    system.runTimeout(() => {
        const index = pending.indexOf(marker);
        if (index >= 0)
            pending.splice(index, 1);
    }, 5);
}
export function consumeSwordLightning(dimension, location) {
    const index = pending.findIndex(p => p.dimension === dimension.id &&
        Math.abs(p.location.x - location.x) < 0.1 && Math.abs(p.location.y - location.y) < 0.1 &&
        Math.abs(p.location.z - location.z) < 0.1 && system.currentTick - p.tick <= 5);
    if (index < 0)
        return false;
    pending.splice(index, 1);
    return true;
}
