// Exercise ore drops using the tool snapshot from before the break.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/blockComponents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const drops=[],particles=[],xp=[];class ItemStack{constructor(typeId,amount){this.typeId=typeId;this.amount=amount;}}
const ctx=vm.createContext({ItemStack,GameMode:{Creative:'creative'}, ItemComponentTypes:{Enchantable:'ench'},EntityDamageCause:{magic:'magic'}});
vm.runInContext(`${code}\nthis.handle=handleOreBreak`,ctx);
const dim={spawnItem(item){drops.push(item);},spawnEntity(id){xp.push(id);},spawnParticle(){particles.push(1);},playSound(){}};
const player={location:{x:0,y:64,z:0},mode:'survival',damage:0,getGameMode(){return this.mode;},applyDamage(v){this.damage+=v;}};
const make=(id,tool)=>({block:{location:{x:0,y:64,z:0}},dimension:dim,player,itemStackBeforeBreak:tool,brokenBlockPermutation:{type:{id}}});
const iron={typeId:'minecraft:iron_pickaxe',getComponent(){return undefined;}};
ctx.handle(make('effect99:silver_ore',iron));assert.equal(drops[0].typeId,'effect99:silver_ore');
ctx.handle(make('effect99:silver_ore',undefined));assert.equal(drops.length,1);
const silk={typeId:'minecraft:diamond_pickaxe',getComponent(){return {getEnchantment(n){return n==='silk_touch'?{level:1}:undefined;}}}};
ctx.handle(make('effect99:quartz_diamond_ore',silk));assert.equal(drops[1].typeId,'effect99:quartz_diamond_ore');assert.equal(xp.length,0);
ctx.handle(make('effect99:quartz_diamond_ore',iron));assert.equal(drops[2].typeId,'effect:quartz_diamond');assert.equal(xp.length,6);
dim.spawnParticle=()=>{throw Error('particle unavailable');};
const previousDamage=player.damage;ctx.handle(make('effect99:quartz_diamond_block',iron));assert.equal(player.damage,previousDamage+6);
player.mode='creative';ctx.handle(make('effect99:quartz_diamond_ore',iron));assert.equal(drops.length,4);
console.log('Ore drops: last-use tool snapshot, Silk Touch, survival and creative OK');
