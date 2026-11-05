const j=require('./node_modules/jsonc-parser');const fs=require('fs');
const base='/tmp/mcaddons/2.8.8/Swords_B/items/';
const swords=['bee_sword','blaze_sword','bone_sword','cactus_sword','clock_sword','coal_sword','creeper_sword','emerald_sword','ender_sword','fire_sword','ghost_sword','glass_sword','glowstone_sword','grass_sword','ice_sword','jungle_sword','lapis_sword','lightning_sword','magma_sword','nether_star_sword','obsidian_sword','pumpkin_sword','quartz_diamond_stick','quartz_sword','sea_sword','shulker_sword','silver_sword','slime_sword','spectral_sword','spider_sword','sponge_sword','time_sword','tnt_sword','ultra_instinct_sword','wolf_sword','wither_sword','wither_skeleton_sword','wet_sponge_sword'];
for(const s of swords){
  const f=base+s+'.json';
  if(!fs.existsSync(f)){ console.log('MISSING',f); continue; }
  const d=j.parse(fs.readFileSync(f,'utf8'),[],{allowTrailingComma:true,disallowComments:false})['minecraft:item'];
  const w=d.events&&d.events.weapon;
  if(!w){ console.log(s.padEnd(22),'NO weapon event'); continue; }
  const desc=[];
  const walk=(o)=>{if(!o||typeof o!=='object')return;
    if(Array.isArray(o.randomize)){o.randomize.forEach(r=>{
      const kind=r.shoot?('shoot:'+r.shoot.projectile):r.damage?('dur:'+r.damage.amount):r.run_command?'cmd':'other';
      desc.push('rand w'+r.weight+'='+kind);});return;}
    if(o.damage&&o.damage.type==='durability')desc.push('dur'+o.damage.amount);
    if(o.shoot)desc.push('shoot:'+o.shoot.projectile);
    if(o.run_command)desc.push('cmd:'+[].concat(o.run_command.command).length);
    if(o.add&&o.add.component_groups)desc.push('+grp');
    for(const k of Object.keys(o))walk(o[k]);};
  walk(w);
  console.log(s.padEnd(22), desc.join(' | '));
}
