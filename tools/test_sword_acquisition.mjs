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
// The engine reads `tiers` as an object keyed 0..4; 2.8.8 wrote it as an array.
const tiers = Object.values(smith.tiers);
const swordTier = tiers.find((t) =>
  t.groups.some((g) => g.trades.some((tr) => tr.gives.some((i) => i.item === 'effect:emerald_sword'))));
assert.ok(swordTier, 'the Emerald Sword trade must exist');
// A villager has five trade levels. A sixth tier is never reached, which made the
// sword unbuyable until the trade was moved into the last real tier.
assert.equal(tiers.length, 5, 'the table must not have more than five tiers');
assert.equal(tiers[tiers.length - 1], swordTier,
  'the sword trade sits in the fifth and final tier');
assert.equal(swordTier.total_exp_required, 310,
  '2.8.8 fifth tier opens at 310 exp');

// The rest of the weaponsmith table is 2.8.8's own copy of the v1.13 trades, not
// today's vanilla one: cheaper prices and much lower `max_uses`. Sending the player
// to the modern table made the swordsmith quietly richer than the original.
const summary = (tier) => tier.groups.map((g) => g.trades.map((tr) =>
  `${tr.wants.map((w) => `${w.item}x${w.quantity}`).join('+')}->${tr.gives.map((i) => `${i.item}x${i.quantity}`).join('+')}@${tr.max_uses}`));
assert.deepEqual(summary(tiers[0]), [
  ['minecraft:coal:0x15->minecraft:emeraldx1@6'],
  ['minecraft:emeraldx3->minecraft:iron_axex1@3'],
], '2.8.8 first tier prices and uses');
assert.deepEqual(summary(tiers[1]), [
  ['minecraft:iron_ingotx4->minecraft:emeraldx1@5'],
  ['minecraft:emeraldx2->minecraft:iron_swordx2@2'],
], '2.8.8 second tier');
assert.deepEqual(summary(tiers[2]), [
  ['minecraft:flintx24->minecraft:emeraldx1@5'],
  ['minecraft:emeraldx36->minecraft:bellx1@2'],
], '2.8.8 third tier');
assert.deepEqual(summary(tiers[3]), [
  ['minecraft:diamondx1->minecraft:emeraldx1@5'],
  ['minecraft:emeraldx8->minecraft:diamond_swordx1@2'],
], '2.8.8 fourth tier');
assert.deepEqual(summary(tiers[4]), [
  ['minecraft:emeraldx12->minecraft:diamond_axex1@2'],
  ['minecraft:emerald_blockx32->effect:emerald_swordx1@2'],
], '2.8.8 fifth tier');

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
