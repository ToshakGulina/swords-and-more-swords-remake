const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const A=j.parse(fs.readFileSync('/tmp/mcaddons/2.8.8/Swords_B/entities/mountable_slime.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const B=j.parse(fs.readFileSync('packs/Swords_B/entities/mountable_slime.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity'];
const ga=Object.keys(A.component_groups||{}), gb=Object.keys(B.component_groups||{});
console.log('2.8.8 groups:',ga.join(', '));
console.log('remake groups:',gb.join(', '));
for(const g of ga) if(gb.includes(g)){
  const a=JSON.stringify(A.component_groups[g]), b=JSON.stringify(B.component_groups[g]);
  if(a!==b) console.log('DIFF group',g,'\n  2.8.8:',a.slice(0,200),'\n  remake:',b.slice(0,200));
}
