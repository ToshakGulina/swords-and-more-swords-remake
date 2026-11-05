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
// The Blaze Sword is rolled by the restored loot table
// (loot_tables/entities/blaze.json: killed_by_entity snow_golem + 2.5 %), never by
// the script. 2.8.8's own `blaze_sword` entity event has no trigger at all, so a
// second roll here dropped the sword twice from a single kill.
const table = JSON.parse(fs.readFileSync('packs/Swords_B/loot_tables/entities/blaze.json', 'utf8'));
const swordPool = table.pools.find((p) => p.entries.some((e) => e.name === 'effect:blaze_sword'));
assert.ok(swordPool, 'the loot table must carry the blaze sword');
assert.deepEqual(swordPool.conditions[0], {condition: 'killed_by_entity', entity_type: 'minecraft:snow_golem'});
assert.equal(swordPool.conditions[1].chance, 0.025);
die(undefined,{typeId:'minecraft:snowball'});die({typeId:'minecraft:player'},{typeId:'minecraft:snowball'});
math.roll=0.024;die({typeId:'minecraft:snow_golem'},{typeId:'minecraft:snowball'});
math.roll=0.025;die({typeId:'minecraft:snow_golem'});
assert.equal(drops.length,0,'the script must not roll the blaze sword a second time');
console.log('Blaze sword: loot table carries the 2.5% snow golem roll, script stays out OK');
