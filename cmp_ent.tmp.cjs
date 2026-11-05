const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const A=j.parse(fs.readFileSync('/tmp/mcaddons/2.8.8/Swords_B/entities/alpha_wolf.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const B=j.parse(fs.readFileSync('packs/Swords_B/entities/alpha_wolf.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const keys=new Set([...Object.keys(A.components),...Object.keys(B.components)]);
for(const k of [...keys].sort()){
  const a=JSON.stringify(A.components[k]), b=JSON.stringify(B.components[k]);
  if(a!==b) console.log('DIFF',k,'\n  2.8.8:',(a||'-').slice(0,220),'\n  remake:',(b||'-').slice(0,220));
}
