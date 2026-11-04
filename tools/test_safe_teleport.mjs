import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/utils.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const math=Object.create(Math);math.random=()=>0;
const ctx=vm.createContext({Math:math});vm.runInContext(code+'\nthis.teleport=safeRandomTeleport',ctx);
let calls=0;const air={isAir:true,isLiquid:false,typeId:'minecraft:air'},stone={isAir:false,isLiquid:false,typeId:'minecraft:stone'};
const dim={heightRange:{min:-64,max:320},getBlock(pos){if(calls++===0)throw Error('unloaded chunk');return pos.y===64?stone:air;},spawnParticle(){throw Error('missing particle');},playSound(){throw Error('missing sound');}};
let target;const entity={dimension:dim,location:{x:0,y:65,z:0},teleport(p){target=p;}};
assert.equal(ctx.teleport(entity,2,4),true);assert.equal(target.y,65);assert.ok(calls>1);
console.log('Safe teleport: retries unloaded candidates and ignores cosmetic failures');
