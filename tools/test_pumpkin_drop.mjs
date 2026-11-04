import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/worldEvents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const callbacks={};const signals=new Proxy({}, {get:(_o,k)=>({subscribe(fn){callbacks[k]=fn;}})});const drops=[];
class ItemStack {constructor(typeId){this.typeId=typeId;}}
const math=Object.create(Math);math.random=()=>0;
const ctx=vm.createContext({Math:math,ItemStack,WeatherType:{Clear:'clear'},handleOreBreak(){},registerAirSwingEvents(){},
 world:{afterEvents:signals,getDynamicProperty(){return false;}},system:{afterEvents:signals,runInterval(){}}});
vm.runInContext(`${code}\nthis.start=registerWorldEvents`,ctx);ctx.start();
const player={tags:new Set(),hasTag(t){return this.tags.has(t);},addTag(t){this.tags.add(t);}};
const ev={player,brokenBlockPermutation:{type:{id:'minecraft:pumpkin'}},block:{location:{x:0,y:0,z:0}},
 dimension:{spawnItem(x){drops.push(x.typeId);},playSound(){}}};
callbacks.playerBreakBlock(ev);callbacks.playerBreakBlock(ev);
assert.deepEqual(drops,['effect:cursed_pumpkin_sword']);
const other={...player,tags:new Set()};callbacks.playerBreakBlock({...ev,player:other});assert.equal(drops.length,2);
console.log('Pumpkin reward: once per player, separate for different players');
