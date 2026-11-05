const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
for(const f of fs.readdirSync(base).sort()){
  if(!f.endsWith('.json')) continue;
  const d=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  const w=d.components['minecraft:weapon'];
  const s=JSON.stringify(d.events||{});
  console.log(f.padEnd(26), 'on_hurt:'+(w?!!w.on_hurt_entity:'-'), 'on_not:'+(w?!!w.on_not_hurt_entity:'-'), 'on_block:'+(w?!!w.on_hit_block:'-'));
}
