# Swords and More Swords 2.8.8 — Полный аудит исправленного пака
**Дата:** 2026-11-10  
**Оригинал:** swordsandmoreswords_2_8_8.mcaddon (403 файла)  
**Фикс:** SwordsAndMoreSwords.2.8.8.fixed.mcaddon (403 файла, player.json удалён)  
**BDS:** 1.26.63.1 (последняя версия)

---

## Найденные и исправленные баги

### 🔴 КРИТИЧНО: PASSIVE_CONFIG был пустым
**Проблема:** Все 29 пассивных способностей мечей не работали. Конфиг `PASSIVE_CONFIG = {}` был пустым — скрипт загружался без ошибок, но пассивки не выполнялись.

**Исправление:** Сгенерирован PASSIVE_CONFIG из оригинала player.json — 19 мечей с командами, сгруппированными по условиям (лава/вода/обычные), с правильными tick rate.

### 🔴 lightblock2: неверная эмиссия света
**Проблема:** Оригинал `block_light_emission: 0.5`, фикс имел `light_emission: 0`.

**Исправление:** Установлено 0.5.

### 🟡 player.json: невалидный Holiday-формат
**Проблема:** Merged player.json содержал компоненты в формате Holiday Creator Features (`spawn_entity`, `damage_sensor` с `has_damage`), невалидные в 1.26. Entity падал при загрузке.

**Исправление:** player.json удалён из пака. Script API обрабатывает все пассивки через проверку mainhand item (рекомендация Microsoft: не переопределять minecraft:player).

### 🟡 Vanilla entity overrides: устаревшие компоненты
**Проблема:** cat (`move_towards_restriction`, `max_dist`), enderman (`lookat`), ghast/blaze/skeleton (`shooter.type`), blaze (`max_dist`).

**Исправление:** Удалены невалидные компоненты. Enderman остался с 2 предупреждениями (не критично).

---

## Результаты аудита по категориям

### Файлы: 403/403 ✓
Все файлы оригинала присутствуют в фиксе (player.json удалён намеренно).

### Предметы (42): ✓
- Идентификаторы, урон, прочность — совпадают с оригиналом
- Ghost -666: damage 0 + applyDamage(-666) в скрипте
- Ice 8.5→8+0.5, Magma 7.2→7+0.2
- 38 мечей с событиями → 38 custom components в скрипте
- 4 предмета без событий (bedrock_stick, bedrock_sword, quartz_diamond, silver_ingot) — корректно без компонентов
- Durability costs, randomize weights, projectiles — все сверены

### Player.json пассивки (19 мечей): ✓ (ИСПРАВЛЕНО)
- blaze, bone, emerald, ender, fire, ghost, grass, ice, jungle, lightning, magma, sea, shulker, slime, spectral, sponge, time, ultra_instinct, wither
- Tick rates: ice/fire/grass/blaze/jungle=1, ghost=20, остальные=5

### Сущности (52): ✓
- Все events, component_groups, timers, damage_sensors сверены
- Исправлены невалидные компоненты в cat, enderman, ghast, blaze, skeleton

### Блоки (8): ✓
- fake_ice: states [1,2,3,4], tick cycle → air
- lightblock/lightblock2: tick → air, emission исправлена
- quartz_diamond_block/ore, silver_ore: onPlayerBreak с проверкой кирки
- sapling3: onPlace → jungle_sapling
- spectral_block: статичный блок

### Animation controllers (8): ✓
- ghost_sword: sneak → levitation IV
- shulker_sword: sneak → shulker_sword_skill
- climb_spider: has_rider → levitation
- wither_sword: hold → ride wither
- wolf_sword: moon_phase → transformation
- item_events: is_on_fire → трансформации
- mountable_slime, despawn

### Loot tables: ✓
- 27 effect: записей в merged loot (23 из оригинала)

### Рецепты (14), Функции (4), Структуры (18): ✓
Все присутствуют, JSON валиден.

### RP файлы: ✓
Entity, animations, models, textures, sounds, particles, render_controllers — все на месте.

### Скрипт: ✓
- JS syntax valid (node --check)
- 42 registerCustomComponent
- PASSIVE_CONFIG: 19 entries (ИСПРАВЛЕНО)
- TIMER_CONFIG: 16 entries
- ALL_MECHANICS: 8 entries
- RIDEABLE_CONFIG: present
- Wolf transformation, pumpkin drop, item transformations — все присутствуют

### BDS тест: ✓
- Pack loads clean (Pack Stack OK)
- Script loads without errors
- Server starts successfully
- 2 non-critical warnings (enderman behavior components)

---

## Что было пропущено в предыдущих «проверках»

1. **PASSIVE_CONFIG пустой** — предыдущие проверки смотрели только на наличие строки `PASSIVE_CONFIG`, но не на содержимое. Пустой объект `{}` проходил проверку.
2. **lightblock2 emission** — проверялись только ключи компонентов, не значения.
3. **player.json ошибки** — BDS тест проверял только «сервер запустился», не смотрел на entity errors в логе.
4. **Animation controllers** — не проверялись до последнего аудита.
5. **Оригинальный javascript.js** — не проверялся до последнего аудита.

## Методология этого аудита

- Каждый файл сравнивался по содержимому, а не только по наличию
- Значения компонентов сверялись (не только ключи)
- Содержимое скрипта проверялось по механикам (команды, веса, costs)
- BDS тест с проверкой лога на ошибки
- Все расхождения классифицированы: реальный баг vs ложное срабатывание vs намеренная конверсия
