const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
const swords=['bee_sword','blaze_sword','bone_sword','creeper_sword','fire_sword','ice_sword','lightning_sword','nether_star_sword','obsidian_sword','pumpkin_sword','spectral_sword','spider_sword','shulker_sword','tnt_sword','wither_sword','wither_skeleton_sword','time_sword'];
for(const s of swords){
  const d=j.parse(fs.readFileSync(base+s+'.json','utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  console.log('\n##### '+s);
  console.log(JSON.stringify(d.events.weapon));
}
