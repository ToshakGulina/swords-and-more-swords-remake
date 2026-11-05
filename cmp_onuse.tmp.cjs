const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
const cmd=(v)=>{const out=[];const walk=(o)=>{if(!o||typeof o!=='object')return;if(typeof o.command==='string')out.push(o.command);if(Array.isArray(o.command))out.push(...o.command);if(o.damage)out.push('dur'+o.damage.amount);for(const k of Object.keys(o))walk(o[k]);};walk(v);return [...new Set(out)];};
for(const f of fs.readdirSync(base).sort()){
  if(!f.endsWith('.json'))continue;
  const d=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  const u=d.events&&d.events.on_use;
  if(!u)continue;
  console.log('###',d.description.identifier);
  console.log('   '+cmd(u).join('\n   ').slice(0,900));
}
