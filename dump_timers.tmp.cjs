const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const A=j.parse(fs.readFileSync('/tmp/mcaddons/2.8.8/Swords_B/entities/player.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const cmd=(v)=>{
  const out=[];
  const walk=(o)=>{
    if(!o||typeof o!=='object')return;
    if(typeof o.command==='string')out.push(o.command);
    if(Array.isArray(o.command))out.push(...o.command);
    for(const k of Object.keys(o)) walk(o[k]);
  };
  walk(v); return out;
};
for(const [g,c] of Object.entries(A.component_groups)){
  const t=c['minecraft:timer'];
  if(!t||!t.time_down_event) continue;
  const ev=t.time_down_event.event;
  console.log(`\n### ${g}  timer[${t.time.join(',')}] -> ${ev}`);
  const e=A.events[ev];
  const cs=cmd(e);
  console.log('   ' + (cs.join('\n   ')||JSON.stringify(e).slice(0,300)));
}
