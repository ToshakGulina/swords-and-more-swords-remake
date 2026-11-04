// 2.8.8 ships exactly 40 How to Play sections (and 40 matching toggle buttons). The remake once added an
// `effect:cursed_pumpkin_sword` page that the original never had — the item
// exists, but it has no encyclopedia entry. Guard the section list so no page
// is invented (and none is silently dropped).
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const htp = read('packs/Swords_R/ui/how_to_play_screen.json');

const sections = Object.keys(htp).filter((k) => k.endsWith('main_sections')).sort();

assert.equal(sections.length, 40, '2.8.8 has 40 How to Play sections');

// The rebuilt panel names are the only intentional renames (`swords_` prefix).
const normalised = sections.map((s) => s.replace(/^swords_/, ''));
assert.ok(!normalised.includes('cursed_pumpkin_sword_section@how_to_play_common.main_sections'),
  'the Cursed Pumpkin Sword page is a remake invention — 2.8.8 has no such section');

// Every section must be reachable from the selector pane.
const buttons = Object.keys(htp)
  .filter((k) => k.endsWith('section_toggle_button'))
  .map((k) => k.replace(/^swords_/, '').replace(/_button@.*/, ''));
assert.equal(buttons.length, 40, 'one toggle button per section');
const sectionNames = normalised.map((s) => s.replace(/_section@.*/, ''));

for (const name of sectionNames) {
  assert.ok(buttons.includes(name), `section "${name}" has no selector button`);
}

// Every section's paragraphs must resolve to a lang key, never to raw English.
const en = fs.readFileSync('packs/Swords_R/texts/en_US.lang', 'utf8');
const ru = fs.readFileSync('packs/Swords_R/texts/ru_RU.lang', 'utf8');
const langKeys = new Set(en.split('\n').map((l) => l.split('=')[0]));
for (const key of [...en.matchAll(/^(effect\.[^=]+)=/gm)].map((m) => m[1])) {
  assert.ok(ru.includes(`${key}=`), `ru_RU is missing ${key}`);
}
assert.ok(!langKeys.has('cursed_pumpkin_sword.header.title'),
  'the invented page title must not linger in the lang files');
assert.ok(!en.includes('cursed_pumpkin_sword.text'),
  'the invented page paragraphs must not linger in the lang files');

console.log('How to Play: 40 sections like 2.8.8, no invented pages, en/ru in sync');
