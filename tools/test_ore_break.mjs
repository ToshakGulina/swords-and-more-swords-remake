// Exercise ore drops using the tool snapshot from before the break.
//
// 2.8.8 drops ore through its own loot tables, with no Silk Touch and no Fortune
// branch:
//   silver_ore          -> 1x effect99:silver_ore
//   quartz_diamond_ore  -> weight 89 -> 1, weight 10 -> 1-2, weight 1 -> 2-4 gems
// and 2.8.8's `effect @p[r=6] instant_damage 1 0 true` is ONE heart, not six.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/blockComponents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const drops=[],particles=[],xp=[];class ItemStack{constructor(typeId,amount){this.typeId=typeId;this.amount=amount;}}
const ctx=vm.createContext({ItemStack,GameMode:{Creative:'creative'},EntityDamageCause:{magic:'magic'}});
vm.runInContext(`${code}\nthis.handle=handleOreBreak`,ctx);
const dim={spawnItem(item){drops.push(item);},spawnEntity(id){xp.push(id);},spawnParticle(){particles.push(1);},playSound(){}};
const player={location:{x:0,y:64,z:0},mode:'survival',damage:0,getGameMode(){return this.mode;},applyDamage(v){this.damage+=v;}};
const make=(id,tool)=>({block:{location:{x:0,y:64,z:0}},dimension:dim,player,itemStackBeforeBreak:tool,brokenBlockPermutation:{type:{id}}});
const iron={typeId:'minecraft:iron_pickaxe',getComponent(){return undefined;}};

ctx.handle(make('effect99:silver_ore',iron));
assert.equal(drops[0].typeId,'effect99:silver_ore');
ctx.handle(make('effect99:silver_ore',undefined));
assert.equal(drops.length,1,'only a real pickaxe or the Bedrock Sword may mine the ore');

// `effect99:quartz_diamond_block` always drops itself; the ore always drops gems,
// whatever enchantment the pickaxe carries (2.8.8 has no Silk Touch there).
const silk={typeId:'minecraft:diamond_pickaxe',getComponent(){return {getEnchantment(n){return n==='silk_touch'?{level:1}:undefined;}}}};
ctx.handle(make('effect99:quartz_diamond_ore',silk));
assert.equal(drops[1].typeId,'effect:quartz_diamond','the ore never drops itself, even with Silk Touch');
assert.ok(drops[1].amount>=1&&drops[1].amount<=4,'1-4 gems, like the weighted 2.8.8 table');
assert.equal(xp.length,6,'six XP orbs per mined ore');
ctx.handle(make('effect99:quartz_diamond_block',iron));
assert.equal(drops.at(-1).typeId,'effect99:quartz_diamond_block');

// `instant_damage 1` is two points of damage = one heart.
const previousDamage=player.damage;
dim.spawnParticle=()=>{throw Error('particle unavailable');};
ctx.handle(make('effect99:quartz_diamond_block',iron));
assert.equal(player.damage,previousDamage+2,'2.8.8 `instant_damage 1` costs one heart');

player.mode='creative';
const before=drops.length;
ctx.handle(make('effect99:quartz_diamond_ore',iron));
assert.equal(drops.length,before,'creative mining drops nothing');
console.log('Ore drops: tool snapshot, 2.8.8 weighted gems, no Silk Touch, one heart backlash');
