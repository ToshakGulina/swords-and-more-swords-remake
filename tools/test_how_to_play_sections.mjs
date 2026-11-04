// 2.8.8 ships 40 documented How to Play sections. The remake adds exactly one
// more — `effect:cursed_pumpkin_sword` — because 2.8.8 ships that sword as a
// hidden 0.5 % pumpkin drop and never documents it anywhere. The extra page is
// intentional and must stay: it is the only place a player can learn the sword
// exists. Guard both facts: 41 sections, and the secret one is last and hidden
// in voice.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const htp = read('packs/Swords_R/ui/how_to_play_screen.json');

const sections = Object.keys(htp).filter((k) => k.endsWith('main_sections')).sort();

assert.equal(sections.length, 41, '40 documented sections plus the secret pumpkin page');

// The rebuilt panel names are the only intentional renames (`swords_` prefix).
const normalised = sections.map((s) => s.replace(/^swords_/, ''));
assert.ok(normalised.includes('cursed_pumpkin_sword_section@how_to_play_common.main_sections'),
  'the undocumented 2.8.8 sword needs a page, otherwise it is unfindable');

// Every section must be reachable from the selector pane.
const buttons = Object.keys(htp)
  .filter((k) => k.endsWith('section_toggle_button'))
  .map((k) => k.replace(/^swords_/, '').replace(/_button@.*/, ''));
assert.equal(buttons.length, 41, 'one toggle button per section');

// The secret page must be the LAST entry, so it reads as an easter egg rather
// than another item in the official sword list.
const pane = htp.swords_selector_stack_panel.controls[0].how_to_play_selector_pane.controls;
assert.ok(Object.keys(pane[pane.length - 1])[0].startsWith('cursed_pumpkin_sword_button'),
  'the secret page belongs at the end of the selector');
const sectionsPane = htp.swords_section_content_panels.controls[0].general_tips_sections.controls;
assert.ok(Object.keys(sectionsPane[sectionsPane.length - 1])[0].startsWith('cursed_pumpkin_sword_section'),
  'the secret section belongs at the end of the content panels');
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
assert.ok(langKeys.has('cursed_pumpkin_sword.header.title'),
  'the secret page needs a header key');
assert.ok(en.includes('effect.cursed_pumpkin_sword.text.7') && ru.includes('effect.cursed_pumpkin_sword.text.7'),
  'both languages carry the full secret page');

console.log('How to Play: 40 documented sections + 1 secret pumpkin page, en/ru in sync');
