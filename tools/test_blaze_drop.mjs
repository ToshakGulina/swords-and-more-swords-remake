import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/worldEvents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const callbacks={}, signals=new Proxy({}, {get:(_o,k)=>({subscribe(fn){callbacks[k]=fn;}})});
const math=Object.create(Math);math.roll=0;math.random=()=>math.roll;
class Player{};class ItemStack{constructor(typeId){this.typeId=typeId;}}
const context=vm.createContext({Math:math,Player,ItemStack,WeatherType:{Clear:'clear'},registerAirSwingEvents(){},
  world:{afterEvents:signals,getDynamicProperty(){return false;}},system:{afterEvents:signals,runInterval(){}}});
vm.runInContext(code+'\nthis.start=registerWorldEvents',context);context.start();
const drops=[],dimension={spawnItem(item){drops.push(item.typeId);}};
const deadEntity={typeId:'minecraft:blaze',dimension,location:{x:0,y:0,z:0}};
const die=(killer,projectile)=>callbacks.entityDie({deadEntity,damageSource:{damagingEntity:killer,damagingProjectile:projectile}});
die(undefined,{typeId:'minecraft:snowball'});die({typeId:'minecraft:player'},{typeId:'minecraft:snowball'});assert.equal(drops.length,0);
math.roll=0.024;die({typeId:'minecraft:snow_golem'},{typeId:'minecraft:snowball'});assert.deepEqual(drops,['effect:blaze_sword']);
math.roll=0.025;die({typeId:'minecraft:snow_golem'});assert.equal(drops.length,1);
console.log('Blaze sword: original 2.5% and snow golem killer conditions OK');
