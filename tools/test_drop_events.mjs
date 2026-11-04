// Exercise delayed creeper/crystal drops and the reflected-fireball condition.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/worldEvents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const callbacks={}; const signals=new Proxy({}, {get:(_t,k)=>({subscribe(fn){callbacks[k]=fn;}})});
const scheduled=[]; const drops=[]; const dim={id:'minecraft:nether',spawnItem(item,pos){drops.push([item.typeId,pos]);}};
class ItemStack{constructor(typeId){this.typeId=typeId;}} class Player{}
const math=Object.create(Math);math.random=()=>0;
const ctx=vm.createContext({Math:math,ItemStack,Player,world:{afterEvents:signals,getDynamicProperty(){return false;}},
 system:{afterEvents:signals,runTimeout(cb,ticks){scheduled.push({cb,ticks});},runInterval(){}},
 registerAirSwingEvents(){},WeatherType:{Clear:'clear'}});
vm.runInContext(`${code}\nthis.start=registerWorldEvents`,ctx);ctx.start();
const entity={dimension:dim,location:{x:2,y:3,z:4}};
callbacks.scriptEventReceive({id:'effect:creeper_sword_drop',sourceEntity:entity});
callbacks.scriptEventReceive({id:'effect:ender_crystal_exploded',sourceEntity:entity});
assert.equal(scheduled.length,2);assert.ok(scheduled.every(s=>s.ticks===6));assert.equal(drops.length,0);
for(const s of scheduled.splice(0))s.cb();assert.deepEqual(drops.map(x=>x[0]),['effect:creeper_sword','effect:spectral_sword']);
entity.dimension={...dim,id:'minecraft:overworld'};
callbacks.scriptEventReceive({id:'effect:ender_crystal_exploded',sourceEntity:entity});assert.equal(scheduled.length,0);
const dead={typeId:'minecraft:ghast',dimension:dim,location:{x:0,y:0,z:0}};
callbacks.entityDie({deadEntity:dead,damageSource:{damagingProjectile:{typeId:'minecraft:arrow'},cause:'projectile'}});
assert.equal(drops.length,2,'arrow must not award spectral sword');
callbacks.entityDie({deadEntity:dead,damageSource:{damagingProjectile:{typeId:'minecraft:fireball'},cause:'projectile'}});
assert.equal(drops[2][0],'effect:spectral_sword');
console.log('Blast-delayed drops: timing, dimension and fireball versus arrow OK');
