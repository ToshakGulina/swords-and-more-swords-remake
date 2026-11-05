const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
const cmd=(v)=>{const out=[];const walk=(o)=>{if(!o||typeof o!=='object')return;if(typeof o.command==='string')out.push(o.command);if(Array.isArray(o.command))out.push(...o.command);for(const k of Object.keys(o))walk(o[k]);};walk(v);return out;};
for(const f of fs.readdirSync(base).sort()){
  if(!f.endsWith('.json')) continue;
  const d=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  const ev=d.events||{};
  const names=Object.keys(ev);
  if(!names.length) continue;
  console.log('\n===== '+f+'  ['+names.join(', ')+']');
  for(const n of names){
    const cs=cmd(ev[n]);
    const extra=[];
    const walk=(o)=>{if(!o||typeof o!=='object')return;if(o.damage)extra.push('damage:'+JSON.stringify(o.damage));if(o.add&&o.add.component_groups)extra.push('add:'+o.add.component_groups.join('/'));if(o.remove&&o.remove.component_groups)extra.push('rm:'+o.remove.component_groups.join('/'));if(o.spawn_entities)extra.push('spawn:'+JSON.stringify(o.spawn_entities));if(o.randomize)extra.push('randomize*'+o.randomize.length);if(o.sequence)extra.push('sequence*'+o.sequence.length);if(o.decrement_stack)extra.push('decrement');for(const k of Object.keys(o))walk(o[k]);};
    walk(ev[n]);
    console.log('  ['+n+'] ' + [...new Set([...cs,...extra])].join(' | ').slice(0,700));
  }
}
