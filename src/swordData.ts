export interface SwordEntry {
  id: string;
  icon: string;
  nameRu: string;
  nameEn: string;
  statsRu: string;
  statsEn: string;
  obtainRu: string;
  obtainEn: string;
  abilityRu: string;
  abilityEn: string;
}

export const SWORD_ENTRIES: SwordEntry[] = [
  {
    id: 'effect:coal_sword',
    icon: 'textures/items/coal_sword',
    nameRu: 'Угольный меч',
    nameEn: 'Coal Sword',
    statsRu: 'Урон: 4 | Прочность: 150',
    statsEn: 'Damage: 4 | Durability: 150',
    obtainRu: 'Крафт на верстаке (2 угля + 1 палка) или сундуки деревень и шахт.',
    obtainEn: 'Crafted (2 Coal + 1 Stick) or found in village/mineshaft chests.',
    abilityRu: 'Накладывает Слепоту (5 сек.) при ударе и может служить топливом в печи.',
    abilityEn: 'Inflicts Blindness (5s) on hit and can be used as furnace fuel.',
  },
  {
    id: 'effect:silver_sword',
    icon: 'textures/items/silver_sword',
    nameRu: 'Серебряный меч',
    nameEn: 'Silver Sword',
    statsRu: 'Урон: 6 | Прочность: 215',
    statsEn: 'Damage: 6 | Durability: 215',
    obtainRu: 'Крафт (2 серебряных слитка + 1 палка) из переплавленной серебряной руды.',
    obtainEn: 'Crafted (2 Silver Ingots + 1 Stick) from smelted Silver Ore.',
    abilityRu: 'Единственное оружие, снимающее неуязвимую регенерацию и защиту Альфа-Волка и дающее шанс выбить Волчий меч!',
    abilityEn: 'Strips the Alpha Wolf boss of its regeneration & resistance and unlocks the 10% Wolf Sword drop!',
  },
  {
    id: 'effect:lapis_sword',
    icon: 'textures/items/lapis_sword',
    nameRu: 'Лазуритовый меч',
    nameEn: 'Lapis Sword',
    statsRu: 'Урон: 5 | Прочность: 220',
    statsEn: 'Damage: 5 | Durability: 220',
    obtainRu: 'Крафт (2 лазуритовых блока + 1 палка) или сундуки данжей.',
    obtainEn: 'Crafted (2 Lapis Blocks + 1 Stick) or found in dungeon chests.',
    abilityRu: 'Каждые несколько секунд дарует владельцу сферы опыта (+5 XP), расходуя 1 ед. прочности.',
    abilityEn: 'Periodically grants +5 XP to its wielder at the cost of 1 durability.',
  },
  {
    id: 'effect:glowstone_sword',
    icon: 'textures/items/glowstone_sword',
    nameRu: 'Светокаменный меч',
    nameEn: 'Glowstone Sword',
    statsRu: 'Урон: 5 | Прочность: 145',
    statsEn: 'Damage: 5 | Durability: 145',
    obtainRu: 'Крафт (2 светокамня + 1 палка) или сундуки адских крепостей и бастионов.',
    obtainEn: 'Crafted (2 Glowstone + 1 Stick) or Nether Fortress/Bastion chests.',
    abilityRu: 'Динамически освещает пространство вокруг игрока в главной или левой руке! При ударе даёт врагу Свечение и Слепоту.',
    abilityEn: 'Emits dynamic light when held in mainhand or offhand! Blinds targets on hit.',
  },
  {
    id: 'effect:glass_sword',
    icon: 'textures/items/glass_sword',
    nameRu: 'Стеклянный меч',
    nameEn: 'Glass Sword',
    statsRu: 'Урон: 40 | Прочность: 1 удар',
    statsEn: 'Damage: 40 | Durability: 1 hit',
    obtainRu: 'Крафт (2 стекла + 1 палка) или бросок Огненного меча в воду.',
    obtainEn: 'Crafted (2 Glass + 1 Stick) or throw a Fire Sword into water.',
    abilityRu: 'Колоссальный разовый урон (40 ед.), но клинок мгновенно разбивается вдребезги при первом же ударе.',
    abilityEn: 'Deals massive 40 burst damage, shattering after a single strike.',
  },
  {
    id: 'effect:jungle_sword',
    icon: 'textures/items/jungle_sword',
    nameRu: 'Меч джунглей',
    nameEn: 'Jungle Sword',
    statsRu: 'Урон: 5 | Прочность: 185',
    statsEn: 'Damage: 5 | Durability: 185',
    obtainRu: 'Сундуки храма в джунглях.',
    obtainEn: 'Found in Jungle Temple chests.',
    abilityRu: 'Снижает базовое здоровье до 4 сердец, но дарует Золотые сердца поглощения, выращивает лианы на стенах, приманивает попугаев и при нажатии по земле мгновенно выращивает гигантское дерево джунглей!',
    abilityEn: 'Sets base max health to 4 hearts with Absorption shield, grows vines, tempts parrots, and grows instant giant jungle trees when used on dirt/grass!',
  },
  {
    id: 'effect:cactus_sword',
    icon: 'textures/items/cactus_sword',
    nameRu: 'Кактусовый меч',
    nameEn: 'Cactus Sword',
    statsRu: 'Урон: 5 | Прочность: 115',
    statsEn: 'Damage: 5 | Durability: 115',
    obtainRu: 'Крафт (2 кактуса + 1 палка) или пустынные деревни и храмы.',
    obtainEn: 'Crafted (2 Cactus + 1 Stick) or Desert Village/Temple chests.',
    abilityRu: 'Дарует естественные Шипы: враги, атакующие владельца в ближнем бою, получают ответный урон шипами.',
    abilityEn: 'Grants natural Thorns: enemies striking the wielder take prickly recoil damage.',
  },
  {
    id: 'effect:sponge_sword',
    icon: 'textures/items/sponge_sword',
    nameRu: 'Губчатый меч (и Мокрый)',
    nameEn: 'Sponge Sword (& Wet)',
    statsRu: 'Урон: 2 (мокрый: 4) | Прочность: 1900',
    statsEn: 'Damage: 2 (Wet: 4) | Durability: 1900',
    obtainRu: 'Крафт (2 губки + 1 палка) или трофей с Древнего стража (6.5%).',
    obtainEn: 'Crafted (2 Sponges + 1 Stick) or dropped by Elder Guardians (6.5%).',
    abilityRu: 'Автоматически осушает воду вокруг игрока (5×5×5), превращаясь в Мокрый губчатый меч. Высушите мокрый меч в печи!',
    abilityEn: 'Absorbs nearby water in a 5x5x5 area and turns into a Wet Sponge Sword. Smelt in a furnace to dry!',
  },
  {
    id: 'effect:emerald_sword',
    icon: 'textures/items/emerald_sword',
    nameRu: 'Изумрудный меч',
    nameEn: 'Emerald Sword',
    statsRu: 'Урон: 7 | Прочность: 785',
    statsEn: 'Damage: 7 | Durability: 785',
    obtainRu: 'Торговля с Мастером-оружейником (5-й уровень) или сундуки особняка и аванпоста.',
    obtainEn: 'Master-level Weaponsmith Villager trade or Mansion/Outpost chests.',
    abilityRu: 'Даёт Героя деревни / расположение жителей и исцеляет деревенских жителей поблизости.',
    abilityEn: 'Grants Hero of the Village aura and regenerates nearby villagers.',
  },
  {
    id: 'effect:cursed_pumpkin_sword',
    icon: 'textures/items/cursed_pumpkin_sword',
    nameRu: 'Проклятый тыквенный меч',
    nameEn: 'Cursed Pumpkin Sword',
    statsRu: 'Урон: 6 | Прочность: 315',
    statsEn: 'Damage: 6 | Durability: 315',
    obtainRu: 'Редкое выпадение при разрушении обычной тыквы (0.5%).',
    obtainEn: 'Rare 0.5% drop when breaking a regular Pumpkin block.',
    abilityRu: 'С шансом 15% при ударе надевает на голову жертвы вырезанную тыкву и пугает её ведьмовским смехом!',
    abilityEn: '15% chance on hit to curse the target by forcing a Carved Pumpkin onto its head!',
  },
  {
    id: 'effect:bone_sword',
    icon: 'textures/items/bone_sword',
    nameRu: 'Костяной меч',
    nameEn: 'Bone Sword',
    statsRu: 'Урон: 5 | Прочность: 200',
    statsEn: 'Damage: 5 | Durability: 200',
    obtainRu: 'Выпадает со скелетов ночью в пустыне (0.7%) или в сундуках пустынного храма.',
    obtainEn: '0.7% drop from Skeletons at night in Desert biomes or Desert Temple chests.',
    abilityRu: 'Останавливает летящие в владельца стрелы на лету и приманивает диких волков.',
    abilityEn: 'Halts incoming arrows mid-air around the wielder and attracts wolves.',
  },
  {
    id: 'effect:wither_skeleton_sword',
    icon: 'textures/items/wither_skeleton_sword',
    nameRu: 'Меч визер-скелета',
    nameEn: 'Wither Skeleton Sword',
    statsRu: 'Урон: 6 | Прочность: 260',
    statsEn: 'Damage: 6 | Durability: 260',
    obtainRu: 'Выпадает с визер-скелетов (2.5%) или в сундуках адской крепости.',
    obtainEn: '2.5% drop from Wither Skeletons or Nether Fortress chests.',
    abilityRu: 'Поражает врагов эффектом Иссушения II на 6 секунд при каждом ударе.',
    abilityEn: 'Inflicts Wither II (6s) on every melee strike.',
  },
  {
    id: 'effect:slime_sword',
    icon: 'textures/items/slime_sword',
    nameRu: 'Слизневый меч',
    nameEn: 'Slime Sword',
    statsRu: 'Урон: 6 | Прочность: 620',
    statsEn: 'Damage: 6 | Durability: 620',
    obtainRu: 'Выпадает с босса Короля Слизней ночью на болотах (4%).',
    obtainEn: '4% drop from the Slime King boss in Swamp biomes at night.',
    abilityRu: 'Приседание: создаёт защитную слизевую оболочку (Сопротивление III). Способность (ПКМ / зажатие): седлает крылатого прыгучего слизня, топчущего врагов при приземлении!',
    abilityEn: 'Sneak: Slime armor shield. Use skill: Mounts a winged bouncing Slime that stomps nearby foes!',
  },
  {
    id: 'effect:obsidian_sword',
    icon: 'textures/items/obsidian_sword',
    nameRu: 'Обсидиановый меч',
    nameEn: 'Obsidian Sword',
    statsRu: 'Урон: 8 | Прочность: 3800',
    statsEn: 'Damage: 8 | Durability: 3800',
    obtainRu: 'Крафт (2 плачущих обсидиана + 1 палка) или охлаждение Огненного меча под дождём.',
    obtainEn: 'Crafted (2 Crying Obsidian + 1 Stick) or leave a Fire Sword in rain.',
    abilityRu: 'Огромный запас прочности, полный иммунитет к отбрасыванию и защита от взрывов (за счёт повышенного веса).',
    abilityEn: 'Immense durability, total knockback immunity, and blast resistance with heavy movement.',
  },
  {
    id: 'effect:magma_sword',
    icon: 'textures/items/magma_sword',
    nameRu: 'Магмовый меч',
    nameEn: 'Magma Sword',
    statsRu: 'Урон: 6 | Прочность: 500',
    statsEn: 'Damage: 6 | Durability: 500',
    obtainRu: 'Крафт (2 блока магмы + 1 палка) или сундуки развалин порталов и бастионов.',
    obtainEn: 'Crafted (2 Magma Blocks + 1 Stick) or Ruined Portal/Bastion chests.',
    abilityRu: 'Превращает лаву под ногами в блоки магмы, защищает от урона горячего пола и поджигает врагов на 5 сек.',
    abilityEn: 'Turns lava underfoot into Magma blocks, grants hot-floor immunity, and ignites targets (5s).',
  },
  {
    id: 'effect:clock_sword',
    icon: 'textures/items/clock_sword',
    nameRu: 'Часовой меч',
    nameEn: 'Clock Sword',
    statsRu: 'Урон: 6 | Прочность: 390',
    statsEn: 'Damage: 6 | Durability: 390',
    obtainRu: 'Крафт (2 часов + 1 палка) или сундуки кораблекрушений.',
    obtainEn: 'Crafted (2 Clocks + 1 Stick) or Shipwreck chests.',
    abilityRu: 'Накладывает Замедление III при ударе. Бросьте в пустынный колодец, чтобы испытать шанс (2.5%) пробудить легендарный Меч Времени!',
    abilityEn: 'Inflicts Slowness III on hit. Toss into a Desert Well for a 2.5% chance to awaken the Time Sword!',
  },
  {
    id: 'effect:grass_sword',
    icon: 'textures/items/grass_sword',
    nameRu: 'Травяной меч',
    nameEn: 'Grass Sword',
    statsRu: 'Урон: 9 | Прочность: 780',
    statsEn: 'Damage: 9 | Durability: 780',
    obtainRu: 'Выпадает с Травяной Ведьмы (зелёный вариант ведьмы, шанс трофея 20%).',
    obtainEn: '20% drop from the rare Grass Witch variant.',
    abilityRu: 'Дарует Скорость и Прыгучесть, озеленяет землю под ногами цветами и мгновенно скашивает листву и траву.',
    abilityEn: 'Grants Speed & Jump Boost, blooms grass/flowers underfoot, and slices foliage rapidly.',
  },
  {
    id: 'effect:sea_sword',
    icon: 'textures/items/sea_sword',
    nameRu: 'Морской меч',
    nameEn: 'Sea Sword',
    statsRu: 'Урон: 7 | Прочность: 880',
    statsEn: 'Damage: 7 | Durability: 880',
    obtainRu: 'Крафт (2 сердца моря + 1 палка) или зарытые клады.',
    obtainEn: 'Crafted (2 Hearts of the Sea + 1 Stick) or Buried Treasure chests.',
    abilityRu: 'Превращает ноги владельца в 3D-хвост русалки! В воде даёт бесконечное дыхание, грацию дельфина и ночное зрение, но на суше русалка задыхается и подпрыгивает как рыба!',
    abilityEn: 'Transforms legs into a 3D Mermaid Tail! Grants underwater breathing & speed, but causes flopping and suffocation on dry land!',
  },
  {
    id: 'effect:blaze_sword',
    icon: 'textures/items/blaze_sword',
    nameRu: 'Меч ифрита',
    nameEn: 'Blaze Sword',
    statsRu: 'Урон: 7 | Прочность: 720',
    statsEn: 'Damage: 7 | Durability: 720',
    obtainRu: 'Убейте ифрита снежками Снежного голема (2.5% шанс).',
    obtainEn: '2.5% drop when a Blaze is killed by a Snow Golem.',
    abilityRu: 'Огнестойкость, поджог при ударе (8 сек.), остановка малых огненных шаров в воздухе и залп огненными шарами (ПКМ / зажатие).',
    abilityEn: 'Grants Fire Resistance, ignites foes (8s), halts small fireballs, and shoots fireballs on Use.',
  },
  {
    id: 'effect:nether_star_sword',
    icon: 'textures/items/nether_star_sword',
    nameRu: 'Меч звезды Незера',
    nameEn: 'Nether Star Sword',
    statsRu: 'Урон: 10 | Прочность: 775',
    statsEn: 'Damage: 10 | Durability: 775',
    obtainRu: 'Крафт (2 звезды Незера + 1 палка).',
    obtainEn: 'Crafted (2 Nether Stars + 1 Stick).',
    abilityRu: 'Способность (ПКМ / зажатие): обрушивает с неба звездопад по линии взгляда! Повышает шанс выбить Меч Иссушителя. Внимание: при броске в огонь взрывается так мощно, что пробивает бедрок!',
    abilityEn: 'Skill: Calls down an overhead Starfall barrage! Warning: Throwing this sword into fire triggers a bedrock-shattering explosion!',
  },
  {
    id: 'effect:ice_sword',
    icon: 'textures/items/ice_sword',
    nameRu: 'Ледяной меч',
    nameEn: 'Ice Sword',
    statsRu: 'Урон: 9 | Прочность: 850',
    statsEn: 'Damage: 9 | Durability: 850',
    obtainRu: 'Крафт (2 синих льда + 1 палка) или сундуки иглу и снежных деревень.',
    obtainEn: 'Crafted (2 Blue Ice + 1 Stick) or Igloo/Snowy Village chests.',
    abilityRu: 'Ледоход по воде, снежная корка и заморозка при ударе (30%). Способность (ПКМ, перезарядка 5 сек.): заковывает всех врагов вокруг в настоящие клетки из трескающегося льда! Тает в лаве.',
    abilityEn: 'Frost Walker on water, 30% snow-freeze on hit, and Use skill (5s CD) encases nearby enemies in cracking Fake Ice cages!',
  },
  {
    id: 'effect:quartz_sword',
    icon: 'textures/items/quartz_sword',
    nameRu: 'Кварцево-алмазный меч',
    nameEn: 'Quartz-Diamond Sword',
    statsRu: 'Урон: 600 | Прочность: 1 удар',
    statsEn: 'Damage: 600 | Durability: 1 hit',
    obtainRu: 'Крафт (2 кварцево-алмазных блока + 1 кварцево-алмазная палка).',
    obtainEn: 'Crafted (2 Quartz-Diamond Blocks + 1 Quartz-Diamond Stick).',
    abilityRu: 'Абсолютный клинок обоюдной гибели: ранит владельца на 14 ед. магии при взятии/убирании из руки, а удар наносит 600 урона жертве (мгновенно убивая даже боссов), но забирает жизнь самого мечника!',
    abilityEn: 'Blade of mutual destruction: deals 14 magic damage on equip/unequip, and delivers 600 lethal damage on hit while sacrificing the wielder!',
  },
  {
    id: 'effect:spider_sword',
    icon: 'textures/items/spider_sword',
    nameRu: 'Паучий меч',
    nameEn: 'Spider Sword',
    statsRu: 'Урон: 7 | Прочность: 995',
    statsEn: 'Damage: 7 | Durability: 995',
    obtainRu: 'Заброшенные шахты (сундуки вагонеток).',
    obtainEn: 'Found in Abandoned Mineshaft chests.',
    abilityRu: 'Отравление и 5% шанс опутать паутиной при ударе. Приседание: призывает ездового паука-скалолаза, лазающего по стенам! Способность (ПКМ): очередь ловчих комков паутины!',
    abilityEn: 'Poisons & 5% webs on hit. Sneak: Ride a wall-climbing Spider mount! Skill: Fires a rapid web-projectile barrage!',
  },
  {
    id: 'effect:tnt_sword',
    icon: 'textures/items/tnt_sword',
    nameRu: 'ТНТ-меч',
    nameEn: 'TNT Sword',
    statsRu: 'Урон: 6 | Прочность: 810',
    statsEn: 'Damage: 6 | Durability: 810',
    obtainRu: 'Крафт (2 ТНТ + 1 палка) или сундуки пустынного храма.',
    obtainEn: 'Crafted (2 TNT + 1 Stick) or Desert Temple chests.',
    abilityRu: 'Даёт защиту от взрывов! 90% шанс взрыва при каждом ударе + Способность (ПКМ): запускает Гигантский динамит сокрушительной мощности!',
    abilityEn: 'Grants blast immunity! 90% explosive melee strikes + Use skill launches a massive Giant TNT!',
  },
  {
    id: 'effect:wolf_sword',
    icon: 'textures/items/wolf_sword',
    nameRu: 'Волчий меч (Оборотень)',
    nameEn: 'Wolf Sword (Werewolf)',
    statsRu: 'Урон: 8 (в полнолуние: +15!) | Прочность: 1400',
    statsEn: 'Damage: 8 (Full Moon: +15!) | Durability: 1400',
    obtainRu: 'Выпадает с босса Альфа-Волка (10%), если добить его Серебряным мечом.',
    obtainEn: '10% drop from the Alpha Wolf boss when slain with a Silver Sword.',
    abilityRu: 'Ночью в полнолуние превращает игрока в 3D-Оборотня со сверхскоростью, прыжками, регенерацией и свирепым уроном! Если снять меч посреди полнолуния — проклятие оборотня терзает игрока до рассвета.',
    abilityEn: 'During a Full Moon night, transforms the wielder into a 3D Werewolf with +15 claw damage, speed, leap, and regeneration!',
  },
  {
    id: 'effect:shulker_sword',
    icon: 'textures/items/shulker_sword',
    nameRu: 'Шалкеровый меч',
    nameEn: 'Shulker Sword',
    statsRu: 'Урон: 7 | Прочность: 1200',
    statsEn: 'Damage: 7 | Durability: 1200',
    obtainRu: 'Выпадает с шалкеров (4.5%) или в сундуках Городов Энда.',
    obtainEn: '4.5% drop from Shulkers or End City treasure chests.',
    abilityRu: 'Иммунитет к падению, 10% выстрел пулей шалкера при ударе. Приседание: панцирь шалкера с огромной защитой! Способность (ПКМ): подбрасывает всех врагов вокруг в левитацию!',
    abilityEn: 'Fall immunity, 10% shulker bullet on hit, Sneak: Armored Shulker Shell, Skill: Levitates all nearby enemies!',
  },
  {
    id: 'effect:bee_sword',
    icon: 'textures/items/bee_sword',
    nameRu: 'Пчелиный меч',
    nameEn: 'Bee Sword',
    statsRu: 'Урон: 7 | Прочность: 880',
    statsEn: 'Damage: 7 | Durability: 880',
    obtainRu: 'Редкий шанс (2%), когда пчела жалит игрока.',
    obtainEn: '2% chance to drop when stung by an angry Bee.',
    abilityRu: 'Отравляет врагов при ударе, приманивает мирных пчёл и призывает боевой пчелиный рой (ПКМ), жалящий противников вокруг!',
    abilityEn: 'Poisons targets on hit, attracts friendly bees, and summons a stinging Bee Swarm on Use!',
  },
  {
    id: 'effect:ghost_sword',
    icon: 'textures/items/ghost_sword',
    nameRu: 'Призрачный меч',
    nameEn: 'Ghost Sword',
    statsRu: 'Урон: 0 (Бесплотность) | Прочность: 666',
    statsEn: 'Damage: 0 (Ethereal) | Durability: 666',
    obtainRu: 'Крайне редкий шанс (0.3%) при столкновении с Призраком в полной темноте.',
    obtainEn: 'Rare 0.3% drop on contact with a Ghost in pitch darkness.',
    abilityRu: 'Делает владельца невидимым и бессмертным духом (монстры принимают за своего!), но отнимает физический урон. Приседание позволяет взмывать в воздух и парить!',
    abilityEn: 'Turns the wielder invisible, immortal, and ignored by monsters (at 0 physical damage). Sneak to levitate and glide like a phantom!',
  },
  {
    id: 'effect:creeper_sword',
    icon: 'textures/items/creeper_sword',
    nameRu: 'Меч крипера',
    nameEn: 'Creeper Sword',
    statsRu: 'Урон: 8 | Прочность: 1120',
    statsEn: 'Damage: 8 | Durability: 1120',
    obtainRu: 'Подорвите заряженного крипера зажигалкой (5% шанс).',
    obtainEn: '5% drop when igniting a Charged Creeper with Flint and Steel.',
    abilityRu: 'Создаёт направленный взрыв при ударе (без урона владельцу) и позволяет метать взрывных мини-криперов (ПКМ)!',
    abilityEn: 'Triggers blasts on melee strikes and launches explosive Mini-Creepers on Use!',
  },
  {
    id: 'effect:fire_sword',
    icon: 'textures/items/fire_sword',
    nameRu: 'Огненный меч',
    nameEn: 'Fire Sword',
    statsRu: 'Урон: 10 | Прочность: 1450',
    statsEn: 'Damage: 10 | Durability: 1450',
    obtainRu: 'Выпадает с Живого Пламени в Незере.',
    obtainEn: 'Dropped by Living Flame elementals in the Nether.',
    abilityRu: 'Яркое освещение, полный иммунитет к огню и лаве, мощный поджог врагов и огненная волна вокруг (ПКМ). В воде остывает в Стеклянный меч, под дождём — в Обсидиановый, а в огне порождает 5 Живых Огней!',
    abilityEn: 'Dynamic light, total fire/lava immunity, searing melee & flame nova skill! Turns to Glass Sword in water, Obsidian Sword in rain, or 5 Living Flames in fire!',
  },
  {
    id: 'effect:spectral_sword',
    icon: 'textures/items/spectral_sword',
    nameRu: 'Спектральный меч',
    nameEn: 'Spectral Sword',
    statsRu: 'Урон: 11 | Прочность: 1550',
    statsEn: 'Damage: 11 | Durability: 1550',
    obtainRu: 'Убийство гаста отражённым фаерболом (6%) или разрушение кристалла Энда в Незере (2%).',
    obtainEn: '6% from killing a Ghast with a reflected fireball, or 2% from breaking an End Crystal in the Nether.',
    abilityRu: 'Парящий над головой кристалл Энда делает обычную породу вокруг полупрозрачной (рентген руд и пещер в Обычном мире, Незере и Энде!) и стреляет взрывным лучом кристалла (ПКМ)!',
    abilityEn: 'Overhead End Crystal turns nearby stone/deepslate/netherrack/end_stone translucent (ore X-ray!) and fires explosive Spectral Crystals on Use!',
  },
  {
    id: 'effect:bedrock_sword',
    icon: 'textures/items/bedrock_sword',
    nameRu: 'Меч из бедрока',
    nameEn: 'Bedrock Sword',
    statsRu: 'Урон: 18 | Прочность: Неразрушимый ∞',
    statsEn: 'Damage: 18 | Durability: Unbreakable ∞',
    obtainRu: 'Крафт (2 блока бедрока + 1 палка из бедрока). Бедрок добывается взрывом Ультра Инстинкта или Меча звезды Незера в огне!',
    obtainEn: 'Crafted (2 Bedrock + 1 Bedrock Stick). Obtain Bedrock via Ultra Instinct projectile or Nether Star Sword fire blast!',
    abilityRu: 'Абсолютно неразрушимый мульти-инструмент (скорость копания 999 для камня, руд, дерева и земли!), иммунный к огню и лаве.',
    abilityEn: 'Completely unbreakable 18-damage blade & 999-speed universal mining multi-tool, immune to lava and fire!',
  },
  {
    id: 'effect:ender_sword',
    icon: 'textures/items/ender_sword',
    nameRu: 'Эндер-меч',
    nameEn: 'Ender Sword',
    statsRu: 'Урон: 13 | Прочность: 1850',
    statsEn: 'Damage: 13 | Durability: 1850',
    obtainRu: 'Выпадает с редкого Красного Эндермена (2.5%) или в сокровищницах Городов Энда.',
    obtainEn: '2.5% drop from rare Red Endermen or End City treasure chests.',
    abilityRu: 'Автоматически уклоняется от 100% стрел, снарядов, зелий и контакта с водой (и с шансом 50% от ближних атак!) мгновенной телепортацией, а способность (ПКМ) телепортирует по взгляду!',
    abilityEn: 'Auto-dodges 100% of projectiles/potions/water (and 50% of melee hits!) via instant blink, plus look-teleport skill on Use!',
  },
  {
    id: 'effect:lightning_sword',
    icon: 'textures/items/lightning_sword',
    nameRu: 'Меч молний',
    nameEn: 'Lightning Sword',
    statsRu: 'Урон: 14 | Прочность: 1700',
    statsEn: 'Damage: 14 | Durability: 1700',
    obtainRu: 'Выпадает с Шаровой Молнии (Centella, 2%), появляющейся при естественном ударе молнии.',
    obtainEn: '2% drop from Centella (Ball Lightning), which spawns (20%) at natural lightning strikes.',
    abilityRu: 'Полный иммунитет к молниям и огню, 85% шанс удара молнии в цель при атаке и сокрушительное кольцо из 41 молнии вокруг владельца (ПКМ)!',
    abilityEn: 'Lightning & fire immunity, 85% lightning strike on hit, and unleashes a devastating 41-bolt Lightning Ring on Use!',
  },
  {
    id: 'effect:wither_sword',
    icon: 'textures/items/wither_sword',
    nameRu: 'Меч Иссушителя',
    nameEn: 'Wither Sword',
    statsRu: 'Урон: 16 | Прочность: 2100',
    statsEn: 'Damage: 16 | Durability: 2100',
    obtainRu: 'Трофей за победу над боссом Иссушителем (13%, либо 20% при добивании Мечом звезды Незера).',
    obtainEn: '13% drop from the Wither Boss (20% if slain with a Nether Star Sword).',
    abilityRu: 'Затемняет небо боссбаром Иссушителя, иссушает цветы вокруг в розы визера, дарует иммунитет к иссушению и запускает пробивающие синие черепа Иссушителя (ПКМ)!',
    abilityEn: 'Darkens the sky, turns flowers into Wither Roses, grants Wither immunity, and fires blue Wither Skulls on Use!',
  },
  {
    id: 'effect:time_sword',
    icon: 'textures/items/time_sword',
    nameRu: 'Меч Времени',
    nameEn: 'Time Sword',
    statsRu: 'Урон: 15 | Прочность: 2400',
    statsEn: 'Damage: 15 | Durability: 2400',
    obtainRu: 'Бросьте Часовой меч в пустынный колодец (Фонтан желаний, шанс 2.5%).',
    obtainEn: 'Throw a Clock Sword into a Desert Well (2.5% wish chance).',
    abilityRu: 'Пока меч в руке, ускоряет бег солнца и луны (+30 тиков/такт) и разгоняет рост посевов и деревьев в мире (randomTickSpeed = 300)! При ударе замораживает врагов во времени.',
    abilityEn: 'Rapidly accelerates day/night cycles and world crop/tree growth while held, and freezes enemies in time on hit!',
  },
  {
    id: 'effect:ultra_instinct_sword',
    icon: 'textures/items/ultra_instinct_sword',
    nameRu: 'Меч Ультра Инстинкта',
    nameEn: 'Ultra Instinct Sword',
    statsRu: 'Урон: 28 | Прочность: 4500',
    statsEn: 'Damage: 28 | Durability: 4500',
    obtainRu: 'Бросьте Кварцевый алмаз (0.8%) или Кварцево-алмазный блок (2.5%) в пустынный колодец.',
    obtainEn: 'Throw a Quartz-Diamond (0.8%) or Quartz-Diamond Block (2.5%) into a Desert Well.',
    abilityRu: 'Вершина могущества мода: 3D-аура Ультра Инстинкта, автоматическое уклонение от любых атак с контрударом, сверхскорость и энергетический снаряд (ПКМ), способный разрушать и добывать сам Бедрок!',
    abilityEn: 'Ultimate sword: 3D Ultra Instinct aura, automatic dodge & counter-teleport against attacks, godspeed, and an energy blast skill that shatters and drops Bedrock!',
  },
];

export interface ExtraInfoSection {
  titleRu: string;
  titleEn: string;
  icon: string;
  bodyRu: string;
  bodyEn: string;
}

export const EXTRA_SECTIONS: ExtraInfoSection[] = [
  {
    titleRu: 'Руды, палки и Колодец желаний',
    titleEn: 'Ores, Sticks & Desert Well',
    icon: 'textures/items/quartz_diamond',
    bodyRu:
      '§b1. Серебряная руда (effect99:silver_ore)§r\n' +
      '• Генерируется в Обычном мире на высотах Y от -64 до 38 (в камне и глубинном сланце).\n' +
      '• Переплавляется в Серебряный слиток для ковки Серебряного меча.\n\n' +
      '§d2. Кварцево-алмазная руда (effect99:quartz_diamond_ore)§r\n' +
      '• Редкая руда на глубине Y от -64 до 16, а также на нижней стороне островов Энда!\n' +
      '• Осторожно: при добыче вблизи руда бьёт магическим разрядом — копайте на максимальной дистанции кирки!\n\n' +
      '§e3. Кварцево-алмазная палка и Палка из бедрока§r\n' +
      '• Кварцево-алмазная палка (24 урона, отдача магией) создаётся из 2 кварцевых алмазов.\n' +
      '• Палка из бедрока (6 урона, неразрушимая) создаётся из 2 блоков бедрока.\n\n' +
      '§64. Пустынный колодец (Фонтан желаний)§r\n' +
      '• Найдите естественный песчаниковый колодец в пустыне и бросьте предметы прямо в его воду:\n' +
      '  — Часовой меч -> 2.5% Меч Времени\n' +
      '  — Кварцевый алмаз -> 0.8% Меч Ультра Инстинкта\n' +
      '  — Кварцево-алмазный блок -> 2.5% Меч Ультра Инстинкта',
    bodyEn:
      '§b1. Silver Ore (effect99:silver_ore)§r\n' +
      '• Spawns in the Overworld between Y -64 and 38. Smelts into Silver Ingots.\n\n' +
      '§d2. Quartz-Diamond Ore (effect99:quartz_diamond_ore)§r\n' +
      '• Rare ore at Y -64..16 and under End Islands! Stand back while mining — mining too close shocks you with magic damage!\n\n' +
      '§e3. Special Sticks§r\n' +
      '• Quartz-Diamond Stick (24 dmg, magic recoil) & Bedrock Stick (6 dmg, unbreakable).\n\n' +
      '§64. Desert Well (Fountain of Wishes)§r\n' +
      '• Throw items into the water inside a natural Desert Well:\n' +
      '  — Clock Sword -> 2.5% Time Sword\n' +
      '  — Quartz-Diamond -> 0.8% Ultra Instinct Sword\n' +
      '  — Quartz-Diamond Block -> 2.5% Ultra Instinct Sword',
  },
  {
    titleRu: 'Боссы и Особые Мобы мода',
    titleEn: 'Bosses & Sword Mobs',
    icon: 'textures/items/wolf_sword',
    bodyRu:
      '§c• Альфа-Волк (480 HP)§r — появляется ночью в тайге. Обладает мощной регенерацией и бронёй, пока вы не ударите его Серебряным мечом! Трофей: Волчий меч (10%).\n\n' +
      '§a• Король Слизней (300 HP)§r — гигантский босс ночных болот, призывающий свиту слизней. Трофей: Слизневый меч (4%).\n\n' +
      '§7• Призрак (Ghost)§r — бесплотный дух пещер и полной тьмы. При касании с шансом 0.3% оставляет Призрачный меч.\n\n' +
      '§6• Живое Пламя (Living Flame)§r — огненный элементаль Незера (и порождение Огненного меча в огне). Трофей: Огненный меч.\n\n' +
      '§e• Шаровая Молния (Centella)§r — появляется с шансом 20% в точке естественного удара молнии. Трофей: Меч молний (2%).\n\n' +
      '§4• Красный Эндермен (120 HP)§r — редкий яростный подвид эндермена. Трофей: Эндер-меч (2.5%).\n\n' +
      '§2• Травяная Ведьма (32 HP)§r — лесная ведьма в зелёном одеянии. Трофей: Травяной меч (20%).',
    bodyEn:
      '§c• Alpha Wolf (480 HP)§r — Spawns in Taiga biomes at night. Requires a Silver Sword to strip its regeneration and earn the Wolf Sword (10%).\n\n' +
      '§a• Slime King (300 HP)§r — Giant Swamp night boss. Drops Slime Sword (4%).\n\n' +
      '§7• Ghost§r — Appears in pitch darkness; 0.3% chance to drop Ghost Sword on touch.\n\n' +
      '§6• Living Flame§r — Nether elemental that drops the Fire Sword.\n\n' +
      '§e• Centella (Ball Lightning)§r — 20% spawn on natural lightning; drops Lightning Sword (2%).\n\n' +
      '§4• Red Enderman (120 HP)§r — Rare Enderman variant; drops Ender Sword (2.5%).\n\n' +
      '§2• Grass Witch (32 HP)§r — Rare green Witch variant; drops Grass Sword (20%).',
  },
];
