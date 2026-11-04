import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync('packs/Swords_B/scripts/worldEvents.js','utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const cb={},signals=new Proxy({}, {get:(_o,k)=>({subscribe(fn){cb[k]=fn;}})});const math=Object.create(Math);math.random=()=>0;
class Player{};class ItemStack{constructor(typeId){this.typeId=typeId;}}
const ctx=vm.createContext({Math:math,ItemStack,Player,world:{afterEvents:signals,getDynamicProperty(){return false;}},system:{afterEvents:signals,runInterval(){}},registerAirSwingEvents(){},WeatherType:{Clear:'clear'}});
vm.runInContext(code+'\nthis.start=registerWorldEvents',ctx);ctx.start();const drops=[];
const dim={light:0,biome:'minecraft:desert',getBiome(){return {id:this.biome};},getLightLevel(){return this.light;},spawnItem(item){drops.push(item.typeId);}};
const deadEntity={typeId:'minecraft:skeleton',dimension:dim,location:{x:0,y:10,z:0}};
const die=killer=>cb.entityDie({deadEntity,damageSource:{damagingEntity:killer}});
die(undefined);assert.equal(drops.length,0);die(new Player());assert.equal(drops.length,1);
dim.light=8;die(new Player());assert.equal(drops.length,1);dim.light=0;dim.biome='minecraft:plains';die(new Player());assert.equal(drops.length,1);
console.log('Bone sword: player, desert and light level conditions OK');
