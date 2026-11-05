const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/blocks/';
const rbase='packs/Swords_B/blocks/';
const ids={};
for(const f of fs.readdirSync(rbase)){ if(!f.endsWith('.json'))continue;
  try{const d=j.parse(fs.readFileSync(rbase+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:block'];
  if(d&&d.description&&d.description.identifier)ids[d.description.identifier]=f;}catch{}}
for(const f of fs.readdirSync(base).sort()){
  if(!f.endsWith('.json'))continue;
  const A=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:block'];
  const id=A.description.identifier;
  const rf=ids[id];
  if(!rf){console.log('MISSING block',id);continue;}
  const B=j.parse(fs.readFileSync(rbase+rf,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:block'];
  const ca=A.components||{}, cb=B.components||{};
  const onlyA=Object.keys(ca).filter(k=>!(k in cb)), onlyB=Object.keys(cb).filter(k=>!(k in ca));
  const diffs=[];
  for(const k of Object.keys(ca)) if(k in cb && JSON.stringify(ca[k])!==JSON.stringify(cb[k])) diffs.push([k,JSON.stringify(ca[k]),JSON.stringify(cb[k])]);
  if(onlyA.length||onlyB.length||diffs.length){
    console.log('###',id);
    if(onlyA.length)console.log('  2.8.8-only:',onlyA.join(', '));
    if(onlyB.length)console.log('  remake-only:',onlyB.join(', '));
    for(const [k,a,b] of diffs)console.log('  diff',k,'| 2.8.8:',a.slice(0,110),'| remake:',b.slice(0,110));
  }
}
