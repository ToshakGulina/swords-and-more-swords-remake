import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/utils.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const ctx=vm.createContext({EntityComponentTypes:{Inventory:'inventory'}});vm.runInContext(code+'\nthis.give=giveOrDropItem',ctx);
const drops=[];const player={location:{x:0,y:0,z:0},dimension:{spawnItem(x){drops.push(x);}},getComponent(){return undefined;}};
const item={typeId:'effect:thing'};ctx.give(player,item);assert.equal(drops[0],item);
player.getComponent=()=>({container:{addItem(){return undefined;}}});ctx.give(player,item);assert.equal(drops.length,1);
const leftover={typeId:'effect:leftover'};player.getComponent=()=>({container:{addItem(){return leftover;}}});ctx.give(player,item);assert.equal(drops[1],leftover);
console.log('Inventory reward: missing or full inventory drops item, success does not duplicate');
