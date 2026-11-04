import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const signal={subscribe(){}};const bolts=[];const dim={id:'minecraft:overworld',heightRange:{min:-64,max:320},getEntities(){return [];},getBlock(){},playSound(){},spawnEntity(type,loc){bolts.push({type,loc});}};
const player={id:'p',isValid:true,dimension:dim,location:{x:3,y:70,z:4},item:'effect:lightning_sword',triggerEvent(){},getGameMode(){return 'survival';},getComponent(){}};
let tick;const ctx=vm.createContext({world:{afterEvents:{playerLeave:signal,playerSpawn:signal,playerDimensionChange:signal},getAllPlayers:()=>[player],getTimeOfDay:()=>6000,getMoonPhase:()=>0,getDimension:()=>dim},
 system:{runInterval(cb){tick=cb;}},recoverRandomTickSpeed(){},setTimeSwordActive(){},isFullMoonNight:()=>false,getMainhandItem:()=>({typeId:player.item}),getOffhandItem(){},
 BRIGHT_LIGHT_SWORDS:new Set(),LIGHT_EMITTING_SWORDS:new Set(),GameMode:{Creative:'creative'},MoonPhase:{FullMoon:0},
 });
vm.runInContext(code+'\nthis.start=startPassiveEngine',ctx);ctx.start();tick();tick();
// Exact 2.8.8: equipping summons exactly one `lightning_bolt` at y=255.
assert.equal(bolts.length,1);
assert.equal(bolts[0].type,'minecraft:lightning_bolt');
assert.equal(bolts[0].loc.y,255);
console.log('Lightning equip: one y=255 bolt on equip, like 2.8.8');
