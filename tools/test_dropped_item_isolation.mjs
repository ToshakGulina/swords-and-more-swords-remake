// Execute the real dropped-item interval with a broken item preceding a valid one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync('packs/Swords_B/scripts/worldEvents.js','utf8')
  .replace(/^import .*?;\s*/gm, '').replace(/\bexport /g, '');
const signal={subscribe(){}};
const events=new Proxy({}, {get:()=>signal});
let loop; const drops=[];
const bad={isValid:true, hasTag(){throw Error('stale entity');}};
const good={id:'good',isValid:true,location:{x:0,y:64,z:0}, hasTag(){return false;},getComponent(){return {itemStack:{typeId:'effect:fire_sword'}}},remove(){this.isValid=false;}};
const water={typeId:'minecraft:water'};
const dim={id:'minecraft:overworld',getEntities(q){return q.type==='minecraft:item'?[bad,good]:[];},getBlock(){return water;},spawnItem(item){drops.push(item.typeId);},playSound(){},spawnParticle(){}};
const empty={id:'minecraft:nether',getEntities(){return [];}};
class ItemStack{constructor(typeId){this.typeId=typeId;}}
const ctx=vm.createContext({ ItemStack, EntityComponentTypes:{Item:'item'}, WeatherType:{Clear:'clear'},
 world:{afterEvents:events,getDynamicProperty(){return false;},getDimension(name){return name==='overworld'?dim:empty;}},
 system:{afterEvents:events,runInterval(cb){loop=cb;}},registerAirSwingEvents(){}});
vm.runInContext(`${code}\nthis.start=registerWorldEvents`,ctx); ctx.start(); loop();
assert.deepEqual(drops,['effect:glass_sword']);
assert.equal(good.isValid,false);
console.log('Dropped items: an invalid entity does not block later elemental reactions');
