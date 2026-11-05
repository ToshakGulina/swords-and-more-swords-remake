const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
const cmd=(v)=>{const out=[];const walk=(o)=>{if(!o||typeof o!=='object')return;if(typeof o.command==='string')out.push(o.command);if(Array.isArray(o.command))out.push(...o.command);if(o.add&&o.add.component_groups)out.push('+grp:'+o.add.component_groups.join('/'));if(o.remove&&o.remove.component_groups)out.push('-grp:'+o.remove.component_groups.join('/'));if(o.randomize)out.push('randomize*'+o.randomize.length);if(o.damage)out.push('durability:'+o.damage.amount);for(const k of Object.keys(o))walk(o[k]);};walk(v);return [...new Set(out)];};
for(const f of ['cactus_sword','coal_sword','ender_sword','glowstone_sword','grass_sword','jungle_sword','lapis_sword','magma_sword','obsidian_sword','sea_sword','silver_sword','slime_sword','sponge_sword','ultra_instinct_sword','wet_sponge_sword','wither_skeleton_sword','wolf_sword','bedrock_sword','bedrock_stick'].map(x=>x+'.json')){
  const d=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  console.log('\n### '+f);
  console.log('  '+cmd(d.events||{}).join('\n  '));
}
