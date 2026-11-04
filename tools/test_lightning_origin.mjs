import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const load=f=>fs.readFileSync(f,'utf8').replace(/^import .*?;\s*/gm,'').replace(/\bexport /g,'');
const callbacks={}, timers=[];const signals=new Proxy({}, {get:(_o,k)=>({subscribe(fn){callbacks[k]=fn;}})});
const math=Object.create(Math);math.random=()=>0;
class Player{};class ItemStack{};
const system={currentTick:100,afterEvents:signals,runTimeout(fn){timers.push(fn);},runInterval(){}};
const context=vm.createContext({Math:math,Player,ItemStack,system,WeatherType:{Clear:'clear'},
 world:{afterEvents:signals,getDynamicProperty(){return false;}},registerAirSwingEvents(){}});
vm.runInContext(load('packs/Swords_B/scripts/lightningOrigin.js')+'\n'+load('packs/Swords_B/scripts/worldEvents.js')+'\nthis.start=registerWorldEvents;this.spawn=spawnSwordLightning;',context);context.start();
const generated=[];const dim={id:'minecraft:overworld',spawnEntity(type,location){generated.push(type);if(type==='minecraft:lightning_bolt')callbacks.entitySpawn({entity:{typeId:type,dimension:this,location}});}};
context.spawn(dim,{x:1,y:2,z:3});assert.deepEqual(generated,['minecraft:lightning_bolt']);
callbacks.entitySpawn({entity:{typeId:'minecraft:lightning_bolt',dimension:dim,location:{x:5,y:2,z:3}}});assert.equal(generated.at(-1),'entity:centella');
// A Centella death in one dimension must not suppress a bolt in another.
callbacks.entityDie({deadEntity:{typeId:'entity:centella',dimension:dim,location:{x:20,y:70,z:20}},damageSource:{}});
const other={...dim,id:'minecraft:the_end'};
callbacks.entitySpawn({entity:{typeId:'minecraft:lightning_bolt',dimension:other,location:{x:20,y:70,z:20}}});
assert.equal(generated.at(-1),'entity:centella');
console.log('Lightning origin: scripted bolt suppressed, independent and cross-dimension bolts allowed');
