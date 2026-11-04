import { GameMode, ItemStack, Player, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { EXTRA_SECTIONS, SWORD_ENTRIES, SwordEntry } from './swordData.js';
import { giveOrDropItem } from './utils.js';

function getPlayerLang(player: Player): 'ru' | 'en' {
  try {
    const saved = player.getDynamicProperty('effect:lang');
    if (saved === 'en') return 'en';
  } catch {}
  return 'ru';
}

function setPlayerLang(player: Player, lang: 'ru' | 'en'): void {
  try {
    player.setDynamicProperty('effect:lang', lang);
  } catch {}
}

export function openSwordsGuide(player: Player): void {
  // Run on next tick to ensure we are out of any restricted before-event or busy UI context
  system.run(() => {
    void showMainGuide(player);
  });
}

async function showMainGuide(player: Player): Promise<void> {
  const lang = getPlayerLang(player);
  const isRu = lang === 'ru';

  const form = new ActionFormData()
    .title(isRu ? '§6Энциклопедия Swords & More Swords' : '§6Swords & More Swords Guide')
    .body(
      isRu
        ? 'Добро пожаловать в полное руководство по всем §e38 уникальным мечам§r, рудам, боссам и секретам мода!\nВыберите раздел или интересующий меч:'
        : 'Welcome to the complete encyclopedia of all §e38 unique swords§r, ores, bosses, and secrets!\nSelect a section or sword below:'
    );

  // Button 0: Switch Language
  form.button(isRu ? '§bЯзык / Language: Русский' : '§bLanguage / Язык: English', 'textures/items/swords_guide');

  // Buttons 1..2: Extra sections (Ores/Fountain & Bosses)
  for (const sec of EXTRA_SECTIONS) {
    form.button(`§e${isRu ? sec.titleRu : sec.titleEn}`, sec.icon);
  }

  // Creative-only Give All button? Keep clean: each sword detail page has Give Sword in Creative, plus Give All here in Creative!
  const isCreative = player.getGameMode() === GameMode.Creative;
  if (isCreative) {
    form.button(
      isRu ? '§a[Творческий] Выдать набор материалов и руд' : '§a[Creative] Give Ores & Sticks Kit',
      'textures/items/bedrock_stick'
    );
  }

  // All 38 sword entries with icons!
  for (const sword of SWORD_ENTRIES) {
    const label = isRu ? `${sword.nameRu}\n§8${sword.statsRu}` : `${sword.nameEn}\n§8${sword.statsEn}`;
    form.button(label, sword.icon);
  }

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;

  let idx = res.selection;
  if (idx === 0) {
    setPlayerLang(player, isRu ? 'en' : 'ru');
    await showMainGuide(player);
    return;
  }
  idx -= 1;

  if (idx < EXTRA_SECTIONS.length) {
    await showExtraSection(player, idx);
    return;
  }
  idx -= EXTRA_SECTIONS.length;

  if (isCreative) {
    if (idx === 0) {
      giveOrDropItem(player, new ItemStack('effect:silver_ingot', 16));
      giveOrDropItem(player, new ItemStack('effect:quartz_diamond', 16));
      giveOrDropItem(player, new ItemStack('effect:quartz_diamond_stick', 1));
      giveOrDropItem(player, new ItemStack('effect:bedrock_stick', 4));
      giveOrDropItem(player, new ItemStack('effect99:silver_ore', 16));
      giveOrDropItem(player, new ItemStack('effect99:quartz_diamond_ore', 16));
      giveOrDropItem(player, new ItemStack('effect99:quartz_diamond_block', 16));
      player.playSound('random.levelup', { volume: 0.8, pitch: 1.2 });
      await showMainGuide(player);
      return;
    }
    idx -= 1;
  }

  const entry = SWORD_ENTRIES[idx];
  if (entry) {
    await showSwordDetail(player, entry);
  }
}

async function showExtraSection(player: Player, index: number): Promise<void> {
  const isRu = getPlayerLang(player) === 'ru';
  const sec = EXTRA_SECTIONS[index];
  const form = new ActionFormData()
    .title(isRu ? `§6${sec.titleRu}` : `§6${sec.titleEn}`)
    .body(isRu ? sec.bodyRu : sec.bodyEn)
    .button(isRu ? '§e« Назад к списку' : '§e« Back to Encyclopedia');

  const res = await form.show(player);
  if (!res.canceled && res.selection === 0) {
    await showMainGuide(player);
  }
}

async function showSwordDetail(player: Player, sword: SwordEntry): Promise<void> {
  const isRu = getPlayerLang(player) === 'ru';
  const isCreative = player.getGameMode() === GameMode.Creative;

  const body = isRu
    ? `§6Характеристики:§r ${sword.statsRu}\n\n` +
      `§aКак получить:§r\n${sword.obtainRu}\n\n` +
      `§bСпособности и особенности:§r\n${sword.abilityRu}`
    : `§6Stats:§r ${sword.statsEn}\n\n` +
      `§aHow to Obtain:§r\n${sword.obtainEn}\n\n` +
      `§bAbilities & Mechanics:§r\n${sword.abilityEn}`;

  const form = new ActionFormData()
    .title(`§e${isRu ? sword.nameRu : sword.nameEn}`)
    .body(body);

  if (isCreative) {
    form.button(isRu ? '§aПолучить этот меч (Творческий)' : '§aGive this Sword (Creative)', sword.icon);
  }
  form.button(isRu ? '§e« Назад к списку' : '§e« Back to Encyclopedia');

  const res = await form.show(player);
  if (res.canceled || res.selection === undefined) return;

  if (isCreative && res.selection === 0) {
    giveOrDropItem(player, new ItemStack(sword.id, 1));
    if (sword.id === 'effect:sponge_sword') {
      giveOrDropItem(player, new ItemStack('effect:wet_sponge_sword', 1));
    }
    player.playSound('random.pop', { volume: 1.0, pitch: 1.1 });
    await showSwordDetail(player, sword);
  } else {
    await showMainGuide(player);
  }
}
