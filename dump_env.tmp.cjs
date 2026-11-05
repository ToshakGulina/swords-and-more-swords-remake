const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const A=j.parse(fs.readFileSync('/tmp/mcaddons/2.8.8/Swords_B/entities/player.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const cmd=(v)=>{const out=[];const walk=(o)=>{if(!o||typeof o!=='object')return;if(typeof o.command==='string')out.push(o.command);if(Array.isArray(o.command))out.push(...o.command);for(const k of Object.keys(o))walk(o[k]);};walk(v);return out;};
const es=A.components['minecraft:environment_sensor'];
for(const t of es){
  const oe=t.on_environment||{};
  const cs=cmd(A.events[oe.event]);
  console.log(`\n### ${oe.event}\n   filter: ${JSON.stringify(oe.filters).slice(0,200)}\n   ${cs.join('\n   ').slice(0,600)}`);
}
