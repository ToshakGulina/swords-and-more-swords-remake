import { system, world } from '@minecraft/server';
// Both swords temporarily affect the same world-wide gamerule. Keep the previous
// value and the last value we wrote so we do not overwrite an administrator's
// later change on release or on world reload.
const BASE_KEY = 'effect:random_tick_original';
const APPLIED_KEY = 'effect:random_tick_applied';
let base;
let applied;
let timeActive = false;
let clockUntil = 0;
export function recoverRandomTickSpeed() {
    try {
        const savedBase = world.getDynamicProperty(BASE_KEY);
        const savedApplied = world.getDynamicProperty(APPLIED_KEY);
        if (typeof savedBase === 'number' && typeof savedApplied === 'number' &&
            world.gameRules.randomTickSpeed === savedApplied) {
            world.gameRules.randomTickSpeed = savedBase;
        }
        world.setDynamicProperty(BASE_KEY, undefined);
        world.setDynamicProperty(APPLIED_KEY, undefined);
        // Earlier versions did not save the original value. Do not guess it.
        world.setDynamicProperty('effect:random_tick_boosted', undefined);
    }
    catch { }
}
function reconcile() {
    try {
        const current = world.gameRules.randomTickSpeed;
        // Clock Sword runs `gamerule randomtickspeed 100`, Time Sword `300`; the remake
        // used 30 for the clock, i.e. a third of the original tick boost.
        const target = timeActive ? 300 : clockUntil > system.currentTick ? 100 : undefined;
        if (base !== undefined && applied !== undefined && current !== applied) {
            // Another command/add-on changed the rule while our effect was active.
            base = current;
        }
        if (target === undefined) {
            if (base !== undefined && applied !== undefined && current === applied) {
                world.gameRules.randomTickSpeed = base;
            }
            base = undefined;
            applied = undefined;
            world.setDynamicProperty(BASE_KEY, undefined);
            world.setDynamicProperty(APPLIED_KEY, undefined);
            return;
        }
        if (base === undefined)
            base = current;
        // Persist before changing the rule, so interrupted sessions can recover.
        world.setDynamicProperty(BASE_KEY, base);
        world.setDynamicProperty(APPLIED_KEY, target);
        world.gameRules.randomTickSpeed = target;
        applied = target;
    }
    catch { }
}
export function setTimeSwordActive(active) {
    if (timeActive === active)
        return;
    timeActive = active;
    reconcile();
}
export function boostClockSword() {
    clockUntil = Math.max(clockUntil, system.currentTick + 100);
    reconcile();
    system.runTimeout(() => {
        // Multiple users may have extended the effect since this callback was scheduled.
        if (system.currentTick >= clockUntil)
            reconcile();
    }, 100);
}
