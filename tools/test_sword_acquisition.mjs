// Sword acquisition routes that 2.8.8 proves, but which are easy to silently lose:
//  * the Slime King's orphaned loot table (shipped but unreferenced in 2.8.8) is wired up;
//  * the Weaponsmith Emerald Sword trade keeps the 2.8.8 tier and its exact numbers;
//  * the Emerald Sword itself stays reachable through the chest tables.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// --- Slime King -----------------------------------------------------------------
const king = read('packs/Swords_B/entities/slime_king.json')['minecraft:entity'];
assert.equal(king.components['minecraft:loot'].table, 'loot_tables/entities/slime_king.json',
  'the Slime King must reference its own loot table');

const kingTable = read('packs/Swords_B/loot_tables/entities/slime_king.json');
const swordPool = kingTable.pools.find((p) =>
  p.entries.some((e) => e.name === 'effect:slime_sword'));
assert.ok(swordPool, 'the Slime King table must carry the Slime Sword');
assert.deepEqual(swordPool.conditions.map((c) => c.condition),
  ['killed_by_player', 'random_chance_with_looting']);
assert.equal(swordPool.conditions[1].chance, 0.04, '4 % base drop chance');
assert.equal(swordPool.conditions[1].looting_multiplier, 0.02, '2 % per Looting level');

// The vanilla slime drop stays, so the King still behaves like a slime.
assert.ok(kingTable.pools.some((p) => p.entries.some((e) => e.name === 'minecraft:slime_ball')),
  'the King must still drop slime balls');

// --- Weaponsmith trade ----------------------------------------------------------
const smith = read('packs/Swords_B/trading/economy_trades/weapon_smith_trades.json');
const swordTier = smith.tiers.find((t) =>
  t.groups.some((g) => g.trades.some((tr) => tr.gives.some((i) => i.item === 'effect:emerald_sword'))));
assert.ok(swordTier, 'the Emerald Sword trade must exist');
// A villager has five trade levels. A sixth tier is never reached, which made the
// sword unbuyable until the trade was moved into the last real tier.
assert.equal(smith.tiers.length, 5, 'the table must not have more than five tiers');
assert.equal(smith.tiers[smith.tiers.length - 1], swordTier,
  'the sword trade sits in the fifth and final tier');
assert.equal(swordTier.total_exp_required, 250,
  'the trade uses the vanilla fifth-tier exp gate, which a villager can actually reach');

const swordTrade = swordTier.groups
  .flatMap((g) => g.trades)
  .find((tr) => tr.gives.some((i) => i.item === 'effect:emerald_sword'));
assert.deepEqual(swordTrade.wants, [{ item: 'minecraft:emerald_block', quantity: 32, price_multiplier: 0 }],
  '32 emerald blocks, no price multiplier');
assert.equal(swordTrade.trader_exp, 0, '2.8.8 awards no trader exp for the sword trade');
assert.equal(swordTrade.max_uses, 2, '2.8.8 allows two uses');
assert.deepEqual(swordTrade.gives[0].functions,
  [{ function: 'enchant_with_levels', treasure: false, levels: { min: 5, max: 60 } }],
  'enchant levels 5-60, non-treasure');

// --- Chest route ----------------------------------------------------------------
const chestTables = fs.readdirSync('packs/Swords_B/loot_tables/chests')
  .filter((f) => f.endsWith('.json'))
  .filter((f) => fs.readFileSync(`packs/Swords_B/loot_tables/chests/${f}`, 'utf8').includes('effect:emerald_sword'));
assert.deepEqual(chestTables.sort(),
  ['pillager_outpost.json', 'stronghold_corridor.json', 'woodland_mansion.json'],
  'the Emerald Sword chest routes must match 2.8.8');

console.log('Sword acquisition: Slime King table wired, fifth-tier trade reachable, chest routes intact');
