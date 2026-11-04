// Compare all generated item identities and key properties to the unpacked original.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const {parse} = createRequire(import.meta.url)('jsonc-parser');
const original = path.join(process.env.SAMS_ORIGINAL ?? '/tmp/mcaddons/2.8.8', 'Swords_B/items');
const generated = 'packs/Swords_B/items';
const files = fs.readdirSync(original).filter(x => x.endsWith('.json')).sort();
assert.equal(files.length,42);
assert.deepEqual(fs.readdirSync(generated).filter(x => x.endsWith('.json')).sort(), files);
for (const f of files) {
  const old = parse(fs.readFileSync(path.join(original,f),'utf8'))['minecraft:item'];
  const cur = JSON.parse(fs.readFileSync(path.join(generated,f),'utf8'))['minecraft:item'];
  assert.equal(cur.description.identifier,old.description.identifier,f);
  const a=old.components,b=cur.components;
  for (const [key, field] of [['minecraft:durability','max_durability'],['minecraft:cooldown','duration'],['minecraft:cooldown','category']]) {
    if (a[key]) assert.equal(b[key]?.[field],a[key][field],`${f}: ${key}.${field}`);
  }
  if (typeof a['minecraft:damage']==='number' && a['minecraft:damage']>=1)
    assert.equal(b['minecraft:damage']?.value,Math.floor(a['minecraft:damage']),`${f}: base damage`);
  if (a['minecraft:max_stack_size']!==undefined)
    assert.equal(b['minecraft:max_stack_size'],a['minecraft:max_stack_size'],`${f}: stack size`);
}
console.log('Original item identity, damage, durability, cooldown and stack size: 42/42 OK');
