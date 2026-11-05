const j=require('./node_modules/jsonc-parser');const fs=require('fs');const path=require('path');
const base='/tmp/mcaddons/2.8.8/Swords_B/entities/';
const skip=new Set(['player.json']);
for(const f of fs.readdirSync(base)){
  if(!f.endsWith('.json')||skip.has(f)) continue;
  const rp='packs/Swords_B/entities/'+f;
  if(!fs.existsSync(rp)){ console.log('MISSING in remake:',f); continue; }
  let A,B;
  try{ A=j.parse(fs.readFileSync(base+f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity']; }catch(e){ console.log('parse fail',f,e.message); continue; }
  try{ B=j.parse(fs.readFileSync(rp,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:entity']; }catch(e){ console.log('parse fail remake',f,e.message); continue; }
  const ka=Object.keys(A.components||{}), kb=Object.keys(B.components||{});
  const onlyA=ka.filter(k=>!kb.includes(k)), onlyB=kb.filter(k=>!ka.includes(k));
  const diffs=[];
  for(const k of ka.filter(k=>kb.includes(k))){
    const a=JSON.stringify(A.components[k]), b=JSON.stringify(B.components[k]);
    if(a!==b) diffs.push(k);
  }
  if(onlyA.length||onlyB.length||diffs.length){
    console.log('### '+f);
    if(onlyA.length) console.log('  2.8.8-only:',onlyA.join(', '));
    if(onlyB.length) console.log('  remake-only:',onlyB.join(', '));
    if(diffs.length) console.log('  changed:',diffs.join(', '));
  }
}
