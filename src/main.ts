import { system } from '@minecraft/server';
import { registerBlockComponents } from './blockComponents.js';
import { startPassiveEngine } from './passiveEngine.js';
import { registerItemComponents } from './swordSkills.js';
import { registerWorldEvents } from './worldEvents.js';

// Register all V2 Custom Item & Block Components during world startup (no experimental toggles needed!)
system.beforeEvents.startup.subscribe((initEvent) => {
  registerBlockComponents(initEvent.blockComponentRegistry);
  registerItemComponents(initEvent.itemComponentRegistry);
});

// Start world event listeners and passive sword aura/mount engine once world ticks begin
system.run(() => {
  registerWorldEvents();
  startPassiveEngine();
});
