const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const A=j.parse(fs.readFileSync('/tmp/mcaddons/2.8.8/Swords_B/entities/player.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const B=j.parse(fs.readFileSync('packs/Swords_B/entities/player.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const map={
 'minecraft:bee_sword':'effect:bee_sword',
};
// pair by sword name: remake 'effect:X' <-> 2.8.8 'minecraft:X'
const pairs=[];
for(const g of Object.keys(B.component_groups)){
  const m=g.match(/^effect:(.+)$/);
  if(!m) continue;
  const a='minecraft:'+m[1];
  if(A.component_groups[a]) pairs.push([a,g]);
}
const strip=(c)=>{
  const o={};
  for(const [k,v] of Object.entries(c||{})) {
    if(k==='minecraft:damage_sensor'||k==='minecraft:environment_sensor'||k==='minecraft:timer') continue;
    o[k.replace('minecraft:','')]=v;
  }
  return o;
};
for(const [a,b] of pairs){
  const ca=strip(A.component_groups[a]), cb=strip(B.component_groups[b]);
  const keysA=Object.keys(ca).sort(), keysB=Object.keys(cb).sort();
  const onlyA=keysA.filter(k=>!keysB.includes(k));
  const onlyB=keysB.filter(k=>!keysA.includes(k));
  const diffs=[];
  for(const k of keysA.filter(k=>keysB.includes(k))){
    const sa=JSON.stringify(ca[k]), sb=JSON.stringify(cb[k]);
    if(sa!==sb) diffs.push(`${k}: 2.8.8=${sa} remake=${sb}`);
  }
  if(onlyA.length||onlyB.length||diffs.length){
    console.log('###',a,'->',b);
    if(onlyA.length) console.log('  только в 2.8.8:',onlyA.join(', '));
    if(onlyB.length) console.log('  только в ремейке:',onlyB.join(', '));
    for(const d of diffs) console.log('  diff',d);
  }
}
