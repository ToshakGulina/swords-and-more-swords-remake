// Execute the compiled passive tick loop with a deterministic world and player.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/passiveEngine.js','utf8')
 .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const signal = {subscribe() {}};
const dim = {id:'minecraft:overworld', getEntities(){return [];}, playSound(){}, getBlock(){return undefined;}};
const p = {id:'player', isValid:true, dimension:dim, location:{x:0,y:64,z:0}, item:'effect:lapis_sword', xp:0,
 addExperience(n){this.xp+=n;}, triggerEvent(){}, getGameMode(){return 'survival';}, getComponent(){return undefined;} };
let tick;
const world = {afterEvents:{playerLeave:signal,playerSpawn:signal,playerDimensionChange:signal}, getAllPlayers:()=>[p],
 getTimeOfDay:()=>6000, getMoonPhase:()=>0, getDimension:()=>dim};
const math = Object.create(Math); math.random = () => 0;
const ctx = vm.createContext({Math:math, world, system:{runInterval(cb){tick=cb;}},
 recoverRandomTickSpeed(){}, setTimeSwordActive(){}, isFullMoonNight:()=>false,
 getMainhandItem: player => player.item ? {typeId: player.item} : undefined,
 getOffhandItem:()=>undefined, LIGHT_EMITTING_SWORDS:new Set(), BRIGHT_LIGHT_SWORDS:new Set(),
 EntityComponentTypes:{Riding:'riding'}, GameMode:{Creative:'creative'}, MoonPhase:{FullMoon:0}});
vm.runInContext(`${code}\nthis.start = startPassiveEngine`,ctx); ctx.start();
for(let i=0;i<50;i++) tick(); assert.equal(p.xp,0);
tick(); assert.equal(p.xp,5);
for(let i=0;i<50;i++) tick(); assert.equal(p.xp,10);
p.item = ''; tick(); p.item = 'effect:lapis_sword'; tick();
for(let i=0;i<49;i++) tick(); assert.equal(p.xp,10);
tick(); assert.equal(p.xp,15);
console.log('Lapis passive: initial delay, repeated XP and re-equipping OK');
