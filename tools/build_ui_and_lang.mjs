import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jsonc = require('/tmp/refs/node_modules/jsonc-parser');

const ROOT = '/home/user/swords-and-more-swords-remake';
const RP = path.join(ROOT, 'packs/Swords_R');
const SRC_288_RP = '/tmp/mcaddons/2.8.8/Swords_R';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// 1. Update `how_to_play_screen.json` AND generate `encyclopedia_screen.json` (for 1.20.50-1.26.60 Inventory [?] button!)
const htp = jsonc.parse(fs.readFileSync(path.join(SRC_288_RP, 'ui/how_to_play_screen.json'), 'utf8'));
htp.selector_stack_panel.controls[0].how_to_play_selector_pane.controls.push({
  'cursed_pumpkin_sword_button@how_to_play.cursed_pumpkin_sword_button': {
    $toggle_group_forced_index: 40,
  },
});
htp.section_content_panels.controls[0].general_tips_sections.controls.push({
  'cursed_pumpkin_sword_section@how_to_play.cursed_pumpkin_sword_section': {},
});
htp['cursed_pumpkin_sword_button@how_to_play_common.section_toggle_button'] = {
  $section_topic: 'cursed_pumpkin_sword',
};
htp['cursed_pumpkin_sword_section@how_to_play_common.main_sections'] = {
  bindings: [
    {
      binding_type: 'view',
      source_control_name: 'cursed_pumpkin_sword_button_toggle',
      source_property_name: '#toggle_state',
      target_property_name: '#visible',
    },
  ],
  controls: [
    { 'header_0@how_to_play_common.header': { $text: 'cursed_pumpkin_sword.header.title' } },
    { 'padding_0@how_to_play_common.padding': {} },
    { 'image_sword@how_to_play_common.image': { texture: 'textures/items/cursed_pumpkin_sword' } },
    { 'paragraph_0@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.0' } },
    { 'paragraph_1@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.1' } },
    { 'paragraph_2@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.2' } },
    { 'paragraph_3@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.3' } },
    { 'paragraph_4@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.4' } },
    { 'paragraph_5@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.5' } },
    { 'paragraph_6@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.6' } },
    { 'paragraph_7@how_to_play_common.paragraph': { $text: 'effect.cursed_pumpkin_sword.text.7' } },
    { 'padding_1@how_to_play_common.padding': {} },
  ],
};
const selectorPane = htp.selector_stack_panel;
const contentPanels = htp.section_content_panels;
delete htp.selector_stack_panel;
delete htp.section_content_panels;
delete htp.namespace;
delete htp['how_to_play_screen@how_to_play_common.screen_base'];

const finalHtp = {
  namespace: 'how_to_play',
  'how_to_play_screen@how_to_play_common.screen_base': {
    $selector_stack_panel: 'how_to_play.swords_selector_stack_panel',
    $section_content_panels: 'how_to_play.swords_section_content_panels',
    $header_safezone_control: 'common_store.store_top_bar_filler',
    $header_bar_control: 'common_store.store_top_bar',
    $is_full_screen_layout: true,
    $fill_alpha: 0.5,
  },
  swords_selector_stack_panel: selectorPane,
  swords_section_content_panels: contentPanels,
  ...htp,
};
writeJson(path.join(RP, 'ui/how_to_play_screen.json'), finalHtp);

const encStr = JSON.stringify(finalHtp, null, 2)
  .replace('"namespace": "how_to_play"', '"namespace": "encyclopedia"')
  .replace('"how_to_play_screen@how_to_play_common.screen_base"', '"encyclopedia_screen@how_to_play_common.screen_base"')
  .replaceAll('"how_to_play.swords_', '"encyclopedia.swords_')
  .replaceAll('@how_to_play.', '@encyclopedia.');
fs.writeFileSync(path.join(RP, 'ui/encyclopedia_screen.json'), encStr + '\n', 'utf8');

// 2. `languages.json`
writeJson(path.join(RP, 'texts/languages.json'), ['en_US', 'ru_RU']);

// 3. Build `en_US.lang` (preserving all 2.8.8 entries + updating 1.26 info + adding `.name` aliases + `cursed_pumpkin_sword`)
const srcLangRaw = fs.readFileSync(path.join(SRC_288_RP, 'texts/en_US.lang'), 'utf8').replace(/\r\n/g, '\n');
const enMap = new Map();
for (const line of srcLangRaw.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1);
    enMap.set(k, v);
  }
}

// Update obsolete 1.20 / Holiday Creator Features notice in en_US
enMap.set('updates_changelog.header.title', '§l§6Changelog §r§fV3.0.0 (1.26.60+ Remake)');
enMap.set('effect.updates_changelog.text_0', '• Full remake for Minecraft Bedrock 1.26.60+ (Android & Windows)');
enMap.set('effect.updates_changelog.text_1', '• Works WITHOUT Holiday Creator Features or any experimental toggles!');
enMap.set('effect.updates_changelog.text_2', '• Restored all 38 swords, bosses, custom ores (including Deepslate & End), Desert Well wishes, 3D animations & Inventory [?] Encyclopedia button');
enMap.set('effect.updates_changelog.text_3', '• Fixed Clock Sword crafting recipe, Bedrock Sword mining tags, and Spectral Sword Deepslate restoration');
enMap.set('effect.basic_information.text_0', '§a• No experimental world toggles are needed! Works natively on Minecraft Bedrock 1.26.60+ (Android & Windows).');
enMap.set('effect.basic_information.text_1', '§e• Press the yellow Sword [?] button at the top of the Inventory tab (or in the Pause menu) to view all swords, recipes, and bosses.');
enMap.set('effect.basic_information.text_3', '§6• Complete collection of 38+ legendary swords with unique abilities, bosses, and transformations.');

// Add `minicreeper` and `cursed_pumpkin_sword` encyclopedia entry
enMap.set('entity.entity:minicreeper.name', '§aMini Creeper');
enMap.set('tile.effect99:spectral_block.name', 'Spectral Block');
enMap.set('howtoplay.cursed_pumpkin_sword.title', '§lSwords');
enMap.set('howtoplay.cursed_pumpkin_sword', '§lCursed Pumpkin Sword');
enMap.set('cursed_pumpkin_sword.header.title', '§l§6Cursed Pumpkin Sword');
enMap.set('effect.cursed_pumpkin_sword.text.0', '-Durability: 606');
enMap.set('effect.cursed_pumpkin_sword.text.1', '-Damage: 5');
enMap.set('effect.cursed_pumpkin_sword.text.2', '-Enchantable: true');
enMap.set('effect.cursed_pumpkin_sword.text.3', '-Repairable: true (With pumpkins, carved pumpkins, honeycomb, or the same sword.)');
enMap.set('effect.cursed_pumpkin_sword.text.4', '-Special skills:');
enMap.set('effect.cursed_pumpkin_sword.text.5', '  When attacking, launches glowing cursed pumpkin projectiles with an 80% chance.');
enMap.set('effect.cursed_pumpkin_sword.text.6', '-How to create or get it:');
enMap.set('effect.cursed_pumpkin_sword.text.7', '  Break pumpkin blocks in the world (0.5% chance per broken pumpkin).');

// Ensure every `item.effect:*` also has `.name` alias for 100% compatibility
for (const [k, v] of [...enMap.entries()]) {
  if (k.startsWith('item.effect:') && !k.endsWith('.name')) {
    enMap.set(`${k}.name`, v);
  }
}

const enLines = [...enMap.entries()].map(([k, v]) => `${k}=${v}`);
fs.writeFileSync(path.join(RP, 'texts/en_US.lang'), enLines.join('\n') + '\n', 'utf8');

// 4. Build Complete Russian Localization (`ru_RU.lang`)
const ruMap = new Map(enMap); // start from enMap so zero keys can ever be missing, then translate all keys!

const ruOverrides = {
  // Blocks
  'tile.effect99:sapling3.name': 'Саженец джунглей',
  'tile.effect99:silver_ore.name': 'Серебряная руда',
  'tile.effect99:quartz_diamond_ore.name': 'Кварцево-алмазная руда',
  'tile.effect99:quartz_diamond_block.name': 'Кварцево-алмазный блок',
  'tile.effect99:fake_ice.name': 'Хрупкий лёд',
  'tile.effect99:spectral_block.name': 'Призрачный блок',

  // Swords & Items
  'item.effect:blaze_sword': '§l§6Меч Ифрита',
  'item.effect:coal_sword': '§l§8Угольный меч',
  'item.effect:shulker_sword': '§l§5Меч Шалкера',
  'item.effect:spider_sword': '§l§cПаучий меч',
  'item.effect:jungle_sword': '§l§2Меч Джунглей',
  'item.effect:cactus_sword': '§l§2Кактусовый меч',
  'item.effect:slime_sword': '§l§aСлизневый меч',
  'item.effect:emerald_sword': '§l§aИзумрудный меч',
  'item.effect:spectral_sword': '§l§fСпектральный меч',
  'item.effect:lapis_sword': '§l§9Лазуритовый меч',
  'item.effect:sea_sword': '§l§bМорской меч',
  'item.effect:grass_sword': '§l§2Травяной меч',
  'item.effect:ice_sword': '§l§bЛедяной меч',
  'item.effect:obsidian_sword': '§l§8Обсидиановый меч',
  'item.effect:glowstone_sword': '§l§gСветокаменный меч',
  'item.effect:time_sword': '§l§eМеч Времени',
  'item.effect:creeper_sword': '§l§aМеч Крипера',
  'item.effect:fire_sword': '§l§6Огненный меч',
  'item.effect:magma_sword': '§l§6Магмовый меч',
  'item.effect:wither_sword': '§l§7Меч Иссушителя',
  'item.effect:tnt_sword': '§l§4ТНТ§f-меч',
  'item.effect:lightning_sword': '§l§gМеч Молнии',
  'item.effect:ender_sword': '§l§5Меч Эндера',
  'item.effect:sponge_sword': '§l§eГубчатый меч',
  'item.effect:wet_sponge_sword': '§l§gМокрый губчатый меч',
  'item.effect:bone_sword': '§l§fКостяной меч скелета',
  'item.effect:quartz_sword': '§l§bКварцево-алмазный меч',
  'item.effect:glass_sword': '§l§bСтеклянный меч',
  'item.effect:wither_skeleton_sword': '§l§7Меч визер-скелета',
  'item.effect:ultra_instinct_sword': '§l§bМеч Ультра Инстинкта',
  'item.effect:wolf_sword': '§l§7Волчий меч',
  'item.effect:silver_sword': '§l§7Серебряный меч',
  'item.effect:nether_star_sword': '§l§fМеч Звезды Незера',
  'item.effect:bedrock_sword': '§l§8Бедроковый меч',
  'item.effect:ghost_sword': '§l§fПризрачный меч',
  'item.effect:clock_sword': '§l§gЧасовой меч',
  'item.effect:bee_sword': '§l§gПчелиное жало',
  'item.effect:cursed_pumpkin_sword': '§l§6Проклятый тыквенный меч',
  'item.effect:bedrock_stick': '§7Бедроковая палка',
  'item.effect:silver_ingot': 'Серебряный слиток',
  'item.effect:quartz_diamond': 'Кварцевый алмаз',
  'item.effect:quartz_diamond_stick': 'Кварцево-алмазная палка',

  // Entities & Spawn Eggs & Mount Hints
  'entity.entity:slime_king.name': '§l§aКороль Слизней',
  'entity.entity:alpha_wolf.name': '§l§7Альфа-волк',
  'entity.entity:ghost.name': '§l§fПризрак',
  'entity.entity:mountable_slime.name': '§l§aРучной слизень',
  'entity.entity:shulker_shield.name': '§l§5Панцирь шалкера',
  'entity.entity:ultra_instinct_explode.name': '§lСнаряд Ультра Инстинкта',
  'entity.entity:pumpkin_projectile.name': '§l§6Тыквенный снаряд',
  'entity.entity:nether_star_projectile.name': 'Звезда Незера',
  'entity.entity:minicreeper.name': '§aМини-крипер',
  'entity.entity:centella.name': '§eШаровая молния (Сентелла)',
  'entity.entity:living_flame.name': '§6Живое пламя',
  'item.spawn_egg.entity.entity:slime_king.name': 'Призвать: §a§lКороль Слизней',
  'item.spawn_egg.entity.entity:alpha_wolf.name': 'Призвать: §7Альфа-волк',
  'item.spawn_egg.entity.entity:ghost.name': 'Призвать: §lПризрак',
  'action.hint.exit.entity:mountable_slime': 'Нажмите красться, чтобы слезть со слизня',
  'action.hint.exit.entity:shulker_shield': 'Перестаньте красться, чтобы убрать панцирь шалкера',
  'action.hint.exit.spider': 'Нажмите красться, чтобы слезть с паука',

  // How-To-Play Headers & Categories
  'updates_changelog.header.title': '§l§6Список изменений §r§fV3.0.0 (1.26.60+)',
  'basic_information.header.title': '§l§6О моде Swords and More Swords',
  'howtoplay.updates_changelog.title': '§lИнформация',
  'howtoplay.basic_information.title': '§lИнформация',
  'howtoplay.basic_information': '§lО моде',
  'howtoplay.updates_changelog': '§lОбновления',
  'howtoplay.category.basic_information': '§lИнформация',
  'howtoplay.category.swords': '§lМечи и способности',
  'howtoplay.category.blocks_and_items': '§lБлоки, предметы и мобы',
  'howtoplay.blocks_and_items': '§lБлоки и предметы',
  'howtoplay.sword_mobs': '§lНовые мобы и боссы',
  'howtoplay.blocks_and_items.title': '§lБлоки, предметы и мобы',
  'blocks_and_items.header.title': '§l§6Блоки, руды и материалы',
  'howtoplay.sword_mobs.title': '§lБлоки, предметы и мобы',
  'sword_mobs.header.title': '§l§6Мобы и боссы мода',

  'effect.updates_changelog.text_0': '• Полный ремейк для актуального Minecraft Bedrock 1.26.60+ (Android и Windows)',
  'effect.updates_changelog.text_1': '• Работает БЕЗ «Возможностей создателя праздника» (Holiday Creator Features) и без экспериментальных настроек!',
  'effect.updates_changelog.text_2': '• Восстановлены все 38 мечей, боссы, руды (включая глубинный сланец и Энд), колодец желаний, 3D-анимации и Энциклопедия Мечей',
  'effect.updates_changelog.text_3': '• Исправлен крафт Часового меча, копание Бедроковым мечом и восстановление сланца Спектральным мечом',

  'effect.basic_information.text_0': '§a• Никакие экспериментальные переключатели больше не требуются! Просто активируйте наборы в мире.',
  'effect.basic_information.text_1': '§e• Скрафтите «Энциклопедию Мечей» (Книга + Палка) или нажмите на жёлтую кнопку с мечом в инвентаре для просмотра рецептов и способностей.',
  'effect.basic_information.text_3': '§6• Полный набор из 38+ уникальных мечей со способностями, боссами и превращениями.',
  'effect.basic_information.text_4': '• Команда «/function give» выдаёт все мечи и материалы мода.',
  'effect.basic_information.text_5': '• Все мечи доступны во вкладке «Мечи» творческого инвентаря.',
  'effect.basic_information.text_7': '§7Оригинальный автор идеи и текстур: §bEffect99',
  'effect.basic_information.text_8': '§7Адаптация под Minecraft Bedrock 1.26.60+ (Android & Windows): Remake v3.0.0',
  'basic_information.header.title_1': '  §lСоздатель оригинала: Effect99',

  // Blocks & Items Guide
  'blocks_and_items.header.title_1': '§lКварцево-алмазная руда',
  'effect.blocks_and_items.text_0': 'Редко генерируется ниже высоты Y=16 (в камне и глубинном сланце до -63), а также в нижних слоях Энда. Ранит магией, если ломать её вплотную!',
  'blocks_and_items.header.title_2': '§lКварцевый алмаз',
  'blocks_and_items.header.title_3': '§lКварцево-алмазная палка',
  'blocks_and_items.header.title_7': '§lКварцево-алмазный блок',
  'effect.blocks_and_items.text_1': 'Прочность: 20, Урон: 24. Наносит обратный магический урон владельцу при ударе. Крафтится как обычная палка из 2 кварцевых алмазов.',
  'blocks_and_items.header.title_4': '§lСеребряная руда',
  'effect.blocks_and_items.text_2': 'Часто встречается под землёй ниже высоты Y=35. Переплавьте в печи, чтобы получить серебряный слиток.',
  'blocks_and_items.header.title_5': '§lСеребряный слиток',
  'blocks_and_items.header.title_6': '§lБедроковая палка',
  'effect.blocks_and_items.text_3': 'Прочность: Неразрушимая, Урон: 6. Крафтится из 2 блоков бедрока.',

  // Mobs Guide
  'sword_mobs.header.title.1': '§lПризрак (Ghost)',
  'effect.sword_mobs.text_0': 'Появляется ночью и в тёмных пещерах. Не атакует игрока и неуязвим, но при касании/ударе с шансом 0.3% роняет Призрачный меч и с шансом 1% телепортируется. Исчезает на ярком свету.',
  'sword_mobs.header.title.2': '§lТравяная ведьма (Grass Witch)',
  'effect.sword_mobs.text_1': 'Особый вид ведьмы (20% шанс вместо обычной). Атакует травяными корнями, утягивающими под землю. При смерти с шансом 20% роняет Травяной меч. Здоровье: 32.',
  'sword_mobs.header.title.3': '§lАльфа-волк (Alpha Wolf)',
  'effect.sword_mobs.text_2': 'Босс тайги (появляется ночью, особенно в полнолуние — вы услышите далёкий вой). Обладает мощной регенерацией, которую пробивает только Серебряный меч! При убийстве Серебряным мечом с шансом 10% роняет Волчий меч. Урон: 8, Здоровье: 480.',
  'sword_mobs.header.title.4': '§lКрасноглазый Эндермен',
  'effect.sword_mobs.text_3': 'Крупный агрессивный Эндермен с красными глазами в Верхнем мире. При убийстве с шансом 2.5% роняет Меч Эндера. Урон: 12, Здоровье: 120.',
  'sword_mobs.header.title.5': '§lКороль Слизней (Slime King)',
  'effect.sword_mobs.text_4': 'Гигантский босс болот (появляется ночью в болотах и манграх). Быстрый и сокрушительный в прыжке. Роняет Слизневый меч с шансом 4%. Здоровье: 300.',
  'sword_mobs.header.title.6': '§lШаровая молния (Centella)',
  'effect.sword_mobs.text_5': 'Загадочная сфера энергии, появляющаяся с шансом 20% на месте удара молнии в грозу. Живёт от 10 до 60 секунд, бьёт током вблизи и имеет 200 ОЗ. Если успеть убить — с шансом 2% выпадет Меч Молнии.',
  'sword_mobs.header.title.7': '§lРучной крылатый слизень',
  'effect.sword_mobs.text_6': 'Призывается, когда вы держите Слизневый меч. На нём можно ездить и высоко прыгать, раздавливая врагов при приземлении! Если спешиться, слизень переходит в режим охраны и атакует монстров.',

  // Swords Sidebar Titles & Sections
  'howtoplay.coal_sword': '§lУгольный меч',
  'coal_sword.header.title': '§lУгольный меч',
  'effect.coal_sword.text.0': '-Прочность: 121',
  'effect.coal_sword.text.1': '-Урон: 4',
  'effect.coal_sword.text.2': '-Зачаровывается: да',
  'effect.coal_sword.text.3': '-Починка: углём, палками или таким же мечом',
  'effect.coal_sword.text.4': '-Способности: Можно использовать как мощное топливо в печи (360 сек).',
  'effect.coal_sword.text.5': '-Как получить:',
  'effect.coal_sword.text.6': '  Крафт из 2 угольных блоков и палки (или в бонусном сундуке).',

  'howtoplay.silver_sword': '§lСеребряный меч',
  'silver_sword.header.title': '§lСеребряный меч',
  'effect.silver_sword.text.0': '-Прочность: 1800',
  'effect.silver_sword.text.1': '-Урон: 6 (повышенный урон по Альфа-волкам)',
  'effect.silver_sword.text.2': '-Зачаровывается: да',
  'effect.silver_sword.text.3': '-Починка: серебряным слитком или таким же мечом',
  'effect.silver_sword.text.4': '-Способности:',
  'effect.silver_sword.text.5': '  Снимает неуязвимость/регенерацию Альфа-волка и наносит ему повышенный урон.',
  'effect.silver_sword.text.6': '-Как получить:',
  'effect.silver_sword.text.7': '  Переплавьте серебряную руду в слитки и скрафтите меч на верстаке.',

  'howtoplay.lapis_sword': '§lЛазуритовый меч',
  'lapis_sword.header.title': '§lЛазуритовый меч',
  'effect.lapis_sword.text.0': '-Прочность: 528',
  'effect.lapis_sword.text.1': '-Урон: 5',
  'effect.lapis_sword.text.2': '-Зачаровывается: да',
  'effect.lapis_sword.text.3': '-Починка: лазуритом или таким же мечом',
  'effect.lapis_sword.text.4': '-Способности:',
  'effect.lapis_sword.text.5': '  Пока меч в руке, даёт +5 очков опыта каждые 2.5–6 секунд.',
  'effect.lapis_sword.text.6': '-Как получить:',
  'effect.lapis_sword.text.7': '  В сундуках Крепости (Stronghold) и Аванпоста разбойников.',

  'howtoplay.glowstone_sword': '§lСветокаменный меч',
  'glowstone_sword.header.title': '§lСветокаменный меч',
  'effect.glowstone_sword.text.0': '-Прочность: 128',
  'effect.glowstone_sword.text.1': '-Урон: 4',
  'effect.glowstone_sword.text.2': '-Зачаровывается: да',
  'effect.glowstone_sword.text.3': '-Починка: светокамнем, светокаменной пылью или таким же мечом',
  'effect.glowstone_sword.text.4': '-Способности:',
  'effect.glowstone_sword.text.5': '  Ярко освещает пространство вокруг и может браться во вторую (левую) руку!',
  'effect.glowstone_sword.text.6': '-Как получить:',
  'effect.glowstone_sword.text.7': '  Крафт из 2 блоков светокамня и огненного стержня.',

  'howtoplay.glass_sword': '§lСтеклянный меч',
  'glass_sword.header.title': '§lСтеклянный меч',
  'effect.glass_sword.text.0': '-Прочность: 1',
  'effect.glass_sword.text.1': '-Урон: 33',
  'effect.glass_sword.text.2': '-Зачаровывается: да',
  'effect.glass_sword.text.3': '-Починка: стеклом или таким же мечом',
  'effect.glass_sword.text.4': '-Способности: Огромный разовый урон, но разбивается после одного удара.',
  'effect.glass_sword.text.5': '-Как получить:',
  'effect.glass_sword.text.6': '  Бросьте Огненный меч в воду.',

  'howtoplay.jungle_sword': '§lМеч Джунглей',
  'jungle_sword.header.title': '§lМеч Джунглей',
  'effect.jungle_sword.text.0': '-Прочность: 128',
  'effect.jungle_sword.text.1': '-Урон: 4',
  'effect.jungle_sword.text.2': '-Зачаровывается: да',
  'effect.jungle_sword.text.3': '-Починка: таким же мечом',
  'effect.jungle_sword.text.4': '-Способности:',
  'effect.jungle_sword.text.5': '  Макс. здоровье снижается до 4 сердец, но даётся эффект Поглощения.',
  'effect.jungle_sword.text.6': '  Покрывает соседние блоки лианами, привлекает попугаев, а нажатие по земле мгновенно выращивает огромное тропическое дерево!',
  'effect.jungle_sword.text.7': '-Как получить:',
  'effect.jungle_sword.text.8': '  В сундуках Храма в джунглях или при рыбалке (редкое сокровище).',

  'howtoplay.cactus_sword': '§lКактусовый меч',
  'cactus_sword.header.title': '§lКактусовый меч',
  'effect.cactus_sword.text.0': '-Прочность: 125',
  'effect.cactus_sword.text.1': '-Урон: 6',
  'effect.cactus_sword.text.2': '-Зачаровывается: да',
  'effect.cactus_sword.text.3': '-Починка: таким же мечом',
  'effect.cactus_sword.text.4': '-Способности:',
  'effect.cactus_sword.text.5': '  Шипастая аура: все существа вплотную к вам получают урон от колючек.',
  'effect.cactus_sword.text.6': '-Как получить:',
  'effect.cactus_sword.text.7': '  Крафт из 2 кактусов и палки.',

  'howtoplay.sponge_sword': '§lГубчатый меч',
  'sponge_sword.header.title': '§lГубчатый меч',
  'effect.sponge_sword.text.4': '-Способности:',
  'effect.sponge_sword.text.5': '  Впитывает воду в радиусе 2 блоков; после насыщения водой превращается в Мокрый губчатый меч.',
  'effect.sponge_sword.text.6': '-Как получить:',
  'effect.sponge_sword.text.7': '  Убить Древнего стража (шанс 6.5%) или высушить Мокрый губчатый меч в печи.',

  'howtoplay.emerald_sword': '§lИзумрудный меч',
  'emerald_sword.header.title': '§lИзумрудный меч',
  'effect.emerald_sword.text.4': '-Способности:',
  'effect.emerald_sword.text.5': '  Даёт эффект «Герой деревни» в деревнях и накладывает Сопротивление на жителей в радиусе 64 блоков.',
  'effect.emerald_sword.text.6': '-Как получить:',
  'effect.emerald_sword.text.7': '  Купить у мастера-оружейника или найти в Крепости, Лесном особняке и Аванпосте.',

  'howtoplay.bone_sword': '§lКостяной меч скелета',
  'bone_sword.header.title': '§lКостяной меч скелета',
  'effect.bone_sword.text.4': '-Способности:',
  'effect.bone_sword.text.5': '  20% шанс выпустить стрелу при ударе; ускоряет рост посевов рядом; замедляет вражеские стрелы в радиусе 8 блоков.',
  'effect.bone_sword.text.8': '-Как получить:',
  'effect.bone_sword.text.9': '  Убивать скелетов ночью в пустыне (шанс 0.7%).',

  'howtoplay.wither_skeleton_sword': '§lМеч визер-скелета',
  'wither_skeleton_sword.header.title': '§lМеч визер-скелета',
  'effect.wither_skeleton_sword.text.5': '  Накладывает иссушение на атакуемых врагов.',
  'effect.wither_skeleton_sword.text.7': '  Выпадает из визер-скелетов с шансом 2.5%.',

  'howtoplay.slime_sword': '§lСлизневый меч',
  'slime_sword.header.title': '§lСлизневый меч',
  'effect.slime_sword.text.5': '  Призывает ручного крылатого слизня для верховой езды и высоких прыжков.',
  'effect.slime_sword.text.6': '  Если спешиться, бессмертный слизень защищает вас от монстров.',
  'effect.slime_sword.text.9': '  Убить Короля Слизней ночью на болоте (шанс 4%).',

  'howtoplay.obsidian_sword': '§lОбсидиановый меч',
  'obsidian_sword.header.title': '§lОбсидиановый меч',
  'effect.obsidian_sword.text.6': '  Полный иммунитет к взрывам и сопротивление отбрасыванию.',
  'effect.obsidian_sword.text.10': '  Бросьте Огненный меч под дождь и подождите несколько секунд.',

  'howtoplay.magma_sword': '§lМагмовый меч',
  'magma_sword.header.title': '§lМагмовый меч',
  'effect.magma_sword.text.5': '  Блоки магмы не наносят вам урона; лава под ногами превращается в магму.',
  'effect.magma_sword.text.9': '  В сундуках больших подводных руин.',

  'howtoplay.clock_sword': '§lЧасовой меч',
  'clock_sword.header.title': '§lЧасовой меч',
  'effect.clock_sword.text.5': '  При активации ускоряет ход времени и рост растений в 10 раз на 5 секунд (+1 игровой час).',
  'effect.clock_sword.text.6': '-Как получить: Крафт из золотых блоков, часов, золотого меча и золотых слитков.',

  'howtoplay.grass_sword': '§lТравяной меч',
  'grass_sword.header.title': '§lТравяной меч',
  'effect.grass_sword.text.5': '  Призывает травяные корни, которые опутывают и утягивают врагов в радиусе 8 блоков под землю. Превращает землю в дёрн.',
  'effect.grass_sword.text.8': '  Выпадает из Травяной ведьмы с шансом 20%.',

  'howtoplay.sea_sword': '§lМорской меч',
  'sea_sword.header.title': '§lМорской меч',
  'effect.sea_sword.text.5': '  Превращает вас в русалку: огромная скорость плавания и дыхание под водой, но на суше вы задыхаетесь и подпрыгиваете как рыба!',
  'effect.sea_sword.text.11': '  В зарытых сундуках с сокровищами.',

  'howtoplay.blaze_sword': '§lМеч Ифрита',
  'blaze_sword.header.title': '§lМеч Ифрита',
  'effect.blaze_sword.text.5': '  Активация (ПКМ / удержание экрана): поднимает вас в воздух и выпускает очередь огненных шаров по направлению взгляда! Даёт иммунитет к огню и останавливает малые фаерболы в радиусе 7 блоков.',
  'effect.blaze_sword.text.13': '  Снежный голем должен убить Ифрита (шанс выпадения 2.5%).',

  'howtoplay.nether_star_sword': '§lМеч Звезды Незера',
  'nether_star_sword.header.title': '§lМеч Звезды Незера',
  'effect.nether_star_sword.text.6': '  При ударе по врагу с неба обрушивается звездопад Звёзд Незера (по 6 ед. урона каждая). Если бросить меч в огонь — мощнейший взрыв расколет даже бедрок!',
  'effect.nether_star_sword.text.12': '  Крафт из алмазного меча и Звезды Незера.',

  'howtoplay.ice_sword': '§lЛедяной меч',
  'ice_sword.header.title': '§lЛедяной меч',
  'effect.ice_sword.text.5': '  Замораживает воду под ногами; кидает снежки при атаке; активация заковывает всех существ в радиусе 12 блоков в ледяные клетки! Тает в лаве.',
  'effect.ice_sword.text.13': '  В сундуках иглу и снежных деревень.',

  'howtoplay.quartz_sword': '§lКварцево-алмазный меч',
  'quartz_sword.header.title': '§lКварцево-алмазный меч',
  'effect.quartz_sword.text.6': '  Урон 600 ед., прочность 1! Взятие и убирание меча ранит владельца на 7 сердец, а удар уничтожает как врага, так и самого владельца (у всего есть цена).',
  'effect.quartz_sword.text.9': '  Крафт из 2 кварцево-алмазных блоков и кварцево-алмазной палки.',

  'howtoplay.spider_sword': '§lПаучий меч',
  'spider_sword.header.title': '§lПаучий меч',
  'effect.spider_sword.text.5': '  Призывает ездового паука, умеющего лазать по стенам! Активация выпускает очередь паутины.',
  'effect.spider_sword.text.10': '  В сундуках заброшенных шахт.',

  'howtoplay.tnt_sword': '§lТНТ-меч',
  'tnt_sword.header.title': '§lТНТ-меч',
  'effect.tnt_sword.text.5': '  Взрывает врагов при ударе, а активация призывает Гигантский ТНТ (взрыв через 8 сек).',
  'effect.tnt_sword.text.10': '  В сундуках храма в пустыне.',

  'howtoplay.wolf_sword': '§lВолчий меч',
  'wolf_sword.header.title': '§lВолчий меч',
  'effect.wolf_sword.text.5': '  В ночь полнолуния превращает вас в оборотня: урон 20 ед., высокая скорость, красное зрение, монстры принимают вас за своего!',
  'effect.wolf_sword.text.14': '  Убить Альфа-волка Серебряным мечом (шанс 10%).',

  'howtoplay.shulker_sword': '§lМеч Шалкера',
  'shulker_sword.header.title': '§lМеч Шалкера',
  'effect.shulker_sword.text.5': '  Активация поднимает врагов в воздух левитацией. Приседание прячет вас в защитный панцирь шалкера!',
  'effect.shulker_sword.text.10': '  Выпадает из шалкеров с шансом 4.5%.',

  'howtoplay.bee_sword': '§lПчелиное жало',
  'bee_sword.header.title': '§lПчелиное жало',
  'effect.bee_sword.text.5': '  При ударе призывает боевых пчёл-защитников, а на траве вокруг вас распускаются цветы.',
  'effect.bee_sword.text.9': '  Когда пчела жалит вас, с шансом 2% выпадает её жало.',

  'howtoplay.ghost_sword': '§lПризрачный меч',
  'ghost_sword.header.title': '§lПризрачный меч',
  'effect.ghost_sword.text.7': '  Превращает вас в бессмертного призрака! Полёт при приседании, телепортация по взгляду (ПКМ / нажатие), монстры не трогают, но и вы не можете наносить урон.',
  'effect.ghost_sword.text.18': '  Прикоснитесь/ударьте Призрака ночью или в пещере (шанс 0.3%).',

  'howtoplay.creeper_sword': '§lМеч Крипера',
  'creeper_sword.header.title': '§lМеч Крипера',
  'effect.creeper_sword.text.6': '  20% шанс выпустить мини-крипера при атаке. Активация раздувает игрока как Крипера и устраивает мощный самоподрыв!',
  'effect.creeper_sword.text.9': '  Подожгите заряженного крипера зажигалкой (шанс 5%).',

  'howtoplay.fire_sword': '§lОгненный меч',
  'fire_sword.header.title': '§lОгненный меч',
  'effect.fire_sword.text.5': '  Иммунитет к огню, плавит лёд и снег, запускает Живое пламя при ударе, а активация вызывает «Огненный дождь»! В воде превращается в Стеклянный меч, под дождём — в Обсидиановый.',
  'effect.fire_sword.text.16': '  Убивайте Живое пламя в Незере.',

  'howtoplay.spectral_sword': '§lСпектральный меч',
  'spectral_sword.header.title': '§lСпектральный меч',
  'effect.spectral_sword.text.7': '  Делает камень/сланец, незерак или эндерняк вокруг вас прозрачным (рентген пещер и руд!), над головой парит кристалл Эндера, а активация стреляет взрывным кристаллом.',
  'effect.spectral_sword.text.14': '  Взорвите кристалл Эндера в Незере (2%) или убейте Гаста его же отражённым шаром (6%).',

  'howtoplay.bedrock_sword': '§lБедроковый меч',
  'bedrock_sword.header.title': '§lБедроковый меч',
  'effect.bedrock_sword.text.0': '-Прочность: Бесконечная (неразрушимый)',
  'effect.bedrock_sword.text.1': '-Урон: 18',
  'effect.bedrock_sword.text.6': '-Описание: Также работает как сверхскоростная мульти-кирка!',
  'effect.bedrock_sword.text.8': '  Крафт из 2 блоков бедрока и бедроковой палки (бедрок добывается снарядом Меча Ультра Инстинкта или броском Меча Звезды Незера в огонь!).',

  'howtoplay.ender_sword': '§lМеч Эндера',
  'ender_sword.header.title': '§lМеч Эндера',
  'effect.ender_sword.text.5': '  Автоматически уклоняется от любых снарядов телепортацией, 50% уклонение в ближнем бою, телепорт на 16–32 блока по нажатию! Боится воды.',
  'effect.ender_sword.text.11': '  Выпадает из Красноглазого Эндермена (2.5%).',

  'howtoplay.lightning_sword': '§lМеч Молнии',
  'lightning_sword.header.title': '§lМеч Молнии',
  'effect.lightning_sword.text.5': '  Бьёт молниями при атаке, иммунитет к молниям, а активация обрушивает кольцо из 41 молнии вокруг вас!',
  'effect.lightning_sword.text.11': '  Убить Шаровую молнию (Сентеллу) во время грозы (шанс 2%).',

  'howtoplay.wither_sword': '§lМеч Иссушителя',
  'wither_sword.header.title': '§lМеч Иссушителя',
  'effect.wither_sword.text.7': '  Иммунитет к иссушению, превращает цветы вокруг в розы визера, стреляет черепами Иссушителя (ПКМ — синий разрушительный череп)!',
  'effect.wither_sword.text.16': '  Победить босса Иссушителя (повышенный шанс при добивании Мечом Звезды Незера).',

  'howtoplay.time_sword': '§lМеч Времени',
  'time_sword.header.title': '§lМеч Времени',
  'effect.time_sword.text.5': '  Ускоряет время мира, скорость всех существ и рост растений вокруг вас!',
  'effect.time_sword.text.10': '  Бросьте Часовой меч в воду пустынного колодца желаний (шанс 2.5%).',

  'howtoplay.ultra_instinct_sword': '§lМеч Ультра Инстинкта',
  'ultra_instinct_sword.header.title': '§lМеч Ультра Инстинкта',
  'effect.ultra_instinct_sword.text.7': '  Автоматическое уклонение от ударов и снарядов, иммунитет к огню и взрывам, парящая аура!',
  'effect.ultra_instinct_sword.text.8': '  Активация выпускает разрушительный энергетический снаряд, пробивающий даже бедрок (перезарядка 61 сек, -48 прочности)!',
  'effect.ultra_instinct_sword.text.10': '  Бросайте кварцевые алмазы (0.8%) или кварцево-алмазные блоки (2.5%) в пустынный колодец желаний.',

  'howtoplay.cursed_pumpkin_sword.title': '§lМечи',
  'howtoplay.cursed_pumpkin_sword': '§lПроклятый тыквенный меч',
  'cursed_pumpkin_sword.header.title': '§l§6Проклятый тыквенный меч',
  'effect.cursed_pumpkin_sword.text.0': '-Прочность: 606',
  'effect.cursed_pumpkin_sword.text.1': '-Урон: 5',
  'effect.cursed_pumpkin_sword.text.2': '-Зачаровывается: да',
  'effect.cursed_pumpkin_sword.text.3': '-Починка: тыквами, сотами или таким же мечом',
  'effect.cursed_pumpkin_sword.text.4': '-Способности:',
  'effect.cursed_pumpkin_sword.text.5': '  При ударе с шансом 80% выпускает светящиеся проклятые тыквенные снаряды.',
  'effect.cursed_pumpkin_sword.text.6': '-Как получить:',
  'effect.cursed_pumpkin_sword.text.7': '  Ломайте тыквы в мире (шанс 0.5% с каждой сломанной тыквы).',
};

for (const [k, v] of Object.entries(ruOverrides)) {
  ruMap.set(k, v);
}
for (const [k, v] of [...ruMap.entries()]) {
  if (k.startsWith('item.effect:') && !k.endsWith('.name')) {
    ruMap.set(`${k}.name`, v);
  }
}

const ruLines = [...ruMap.entries()].map(([k, v]) => `${k}=${v}`);
fs.writeFileSync(path.join(RP, 'texts/ru_RU.lang'), ruLines.join('\n') + '\n', 'utf8');

console.log(`Step 3 UI & Localization complete! en_US: ${enLines.length} lines, ru_RU: ${ruLines.length} lines.`);
