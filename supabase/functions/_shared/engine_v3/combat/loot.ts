// Loot (GAMEPLAY 8.7, GAME_DESIGN 9): what a battle pays, the fairness factor, the per battle cap, Cradle halving,
// Wrecks and Flotsam. Pure: no network, no clock, no Math.random, and it never changes what it is given.
//
// Only carried value is at risk (9 rule 6): plunder (doubloons) and cargo goods. Never upgrades, hulls or the Chest.
// Everything is whole units, rounded down, so nothing is created and the winner never gets more than the table says.
// Taking the loot off the loser and giving it to the winner is applying results to the world, which is P2.4.

import { B } from "../balance.ts";
import { CARGO_GOODS } from "../types.ts";
import type { Good, Ship, ShipId, WaterId } from "../types.ts";
import { apportion } from "./fleet.ts";
import type { OutcomeKind } from "./types.ts";

const L = B.loot;
const F = B.fairness;
const NEUTRAL = 1; // a factor that changes nothing

// ---------- What a ship carries ----------

/** Cargo goods by name; absent means none. Only CARGO_GOODS ever appear (Provisions and Powder are not loot). */
export type Goods = Partial<Record<Good, number>>;

export interface Carried {
  plunder: number; // doubloons
  goods: Goods;
}

/** Prices in doubloons per unit, for the cap. Missing goods cost B.economy.basePrice until P5 brings markets (D58). */
export type Prices = Partial<Record<Good, number>>;

/** What a Ship has at risk: its plunder and its cargo goods. */
export const carriedBy = (ship: Pick<Ship, "hold" | "plunder">): Carried => ({
  plunder: ship.plunder,
  goods: cleanGoods(ship.hold),
});

function cleanGoods(goods: Goods): Goods {
  const out: Goods = {};
  for (const good of CARGO_GOODS) {
    const units = Math.floor(goods[good] ?? 0);
    if (units > 0) out[good] = units;
  }
  return out;
}

const cleanCarried = (c: Carried): Carried => ({ plunder: Math.max(0, Math.floor(c.plunder)), goods: cleanGoods(c.goods) });

/** Plunder plus the value of the cargo, which is what the per battle cap measures. */
export function cargoValue(c: Carried, prices: Prices = {}): number {
  return CARGO_GOODS.reduce((sum, good) => sum + (c.goods[good] ?? 0) * (prices[good] ?? B.economy.basePrice), c.plunder);
}

/** A fraction of everything carried, each item rounded down. Parley tribute uses it too (P2.4). */
export function scale(c: Carried, fraction: number): Carried {
  const goods: Goods = {};
  for (const good of CARGO_GOODS) {
    const units = Math.floor((c.goods[good] ?? 0) * fraction);
    if (units > 0) goods[good] = units;
  }
  return { plunder: Math.floor(c.plunder * fraction), goods };
}

/** `a` minus `b`, item by item; `b` is never more than `a` in the way it is used here. */
function minus(a: Carried, b: Carried): Carried {
  const goods: Goods = {};
  for (const good of CARGO_GOODS) {
    const units = (a.goods[good] ?? 0) - (b.goods[good] ?? 0);
    if (units > 0) goods[good] = units;
  }
  return { plunder: Math.max(0, a.plunder - b.plunder), goods };
}

/** The larger of each item. */
function atLeast(a: Carried, b: Carried): Carried {
  const goods: Goods = {};
  for (const good of CARGO_GOODS) {
    const units = Math.max(a.goods[good] ?? 0, b.goods[good] ?? 0);
    if (units > 0) goods[good] = units;
  }
  return { plunder: Math.max(a.plunder, b.plunder), goods };
}

/** Everything several ships carry, added up item by item. */
export function sumCarried(list: readonly Carried[]): Carried {
  const goods: Goods = {};
  let plunder = 0;
  for (const c of list) {
    plunder += c.plunder;
    for (const good of CARGO_GOODS) goods[good] = (goods[good] ?? 0) + (c.goods[good] ?? 0);
  }
  return cleanCarried({ plunder, goods });
}

/**
 * Splits what was taken between the winners of a fleet battle, item by item, in whole units (GAME_DESIGN 9 rule 4).
 * `weights` has one number per winner; the winners' parts always add up to `c`.
 */
export function splitCarried(c: Carried, weights: readonly number[]): Carried[] {
  const plunder = apportion(c.plunder, weights);
  const goods = Object.fromEntries(CARGO_GOODS.map((good) => [good, apportion(c.goods[good] ?? 0, weights)])) as Record<Good, number[]>;
  return weights.map((_, i) => cleanCarried({ plunder: plunder[i] as number, goods: Object.fromEntries(CARGO_GOODS.map((good) => [good, goods[good][i]])) }));
}

/**
 * Splits what a fleet gives up between its ships, item by item: each ship pays in proportion to how much of that item it
 * carries, so no ship ever pays more than it has and the fleet pays the same share of every item.
 */
export function splitByHolding(c: Carried, holdings: readonly Carried[]): Carried[] {
  const plunder = apportion(c.plunder, holdings.map((h) => h.plunder));
  const goods = Object.fromEntries(
    CARGO_GOODS.map((good) => [good, apportion(c.goods[good] ?? 0, holdings.map((h) => h.goods[good] ?? 0))]),
  ) as Record<Good, number[]>;
  return holdings.map((h, i) => cleanCarried({
    plunder: Math.min(plunder[i] as number, h.plunder),
    goods: Object.fromEntries(CARGO_GOODS.map((good) => [good, Math.min(goods[good][i] as number, h.goods[good] ?? 0)])),
  }));
}

const isEmpty = (c: Carried): boolean => c.plunder <= 0 && Object.keys(c.goods).length === 0;

// ---------- Wrecks and Flotsam (8.7) ----------

/** What a Wreck or a pile of Flotsam holds. Salvaging it is P5 and later; P2 only makes them. */
export interface SalvagePile {
  id: string;
  water: WaterId;
  goods: Goods;
  plunder: number;
  untilTide: number; // the last Tide it can be salvaged
}

function pile(kind: "wreck" | "flotsam", ship: ShipId, water: WaterId, tide: number, c: Carried, tides: number): SalvagePile | null {
  if (isEmpty(c)) return null;
  return { id: `${kind}_t${tide}_${ship}`, water, goods: { ...c.goods }, plunder: c.plunder, untilTide: tide + tides };
}

export interface JettisonResult {
  kept: Carried; // what is still aboard: the plunder, and no cargo
  flotsam: SalvagePile | null; // null when there was no cargo to throw
}

/**
 * Cargo thrown overboard, by the Jettison ability or a doctrine rule, becomes Flotsam in that water for 2 Tides (8.7).
 * Every cargo good goes; plunder stays aboard (D60). Run it before settleLoot, so the winner finds nothing to take.
 */
export function jettison(carried: Carried, ship: ShipId, water: WaterId, tide: number): JettisonResult {
  const c = cleanCarried(carried);
  const thrown: Carried = { plunder: 0, goods: c.goods };
  return { kept: { plunder: c.plunder, goods: {} }, flotsam: pile("flotsam", ship, water, tide, thrown, L.flotsamTides) };
}

// ---------- The fairness factor (GAME_DESIGN 9 rule 1) ----------

/**
 * Loot from a PvP win is multiplied by (loser PR / winner side PR) squared, floored at 0.25, when the winner side is
 * stronger. When the winner side is weaker the factor is loser PR / winner PR, capped at 1.5 (David's Due).
 */
export function fairnessFactor(loserPR: number, winnerSidePR: number): number {
  if (winnerSidePR <= 0) return loserPR > 0 ? F.underdogCap : NEUTRAL;
  const ratio = loserPR / winnerSidePR;
  return ratio < 1 ? Math.max(F.floor, ratio ** 2) : Math.min(F.underdogCap, ratio);
}

export interface Multiplier {
  fairness: number;
  cradle: number;
  total: number;
}

/** The fairness factor and Cradle halving, both for PvP only. Fights against NPCs pay the table as it stands (D57). */
export function lootMultiplier(i: { pvp: boolean; inCradle: boolean; loserPR: number; winnerPR: number }): Multiplier {
  const fairness = i.pvp ? fairnessFactor(i.loserPR, i.winnerPR) : NEUTRAL;
  const cradle = i.pvp && i.inCradle ? L.cradlePvp : NEUTRAL;
  return { fairness, cradle, total: fairness * cradle };
}

// ---------- The table (8.7) ----------

/** The winner's share of the loser's plunder and cargo, by how the battle ended. Escaped, Draw and Crippled pay nothing. */
export function lootShare(kind: OutcomeKind): number {
  switch (kind) {
    case "sunk": return L.sunkGrab;
    case "captured": return L.captured;
    case "struckColours": return L.struck;
    case "victory": return L.victory;
    default: return 0;
  }
}

/** What the winner picks on a Capture besides the share (8.7). Until intel (P7) and crew (P8) exist the pick is gold, and gold adds nothing (D59). */
export type CapturePick = { kind: "gold" };

export const capturePick = (): CapturePick => ({ kind: "gold" });

// ---------- Settling a battle ----------

export interface LootInput {
  outcome: OutcomeKind;
  loser: ShipId;
  carried: Carried; // what the loser carries when the battle ends, after any Jettison
  at: WaterId;
  tide: number;
  pvp: boolean; // both captains are players
  inCradle: boolean;
  loserPR: number; // the Power Rating of the losing side (D26)
  winnerPR: number; // the Power Rating of the winning side
  boom?: number; // the economy's Boom; 1 until P5
  prices?: Prices;
}

export interface LootResult {
  outcome: OutcomeKind;
  share: number; // the table's share for this outcome
  fairness: number;
  cradle: number;
  fraction: number; // the share of what the loser carried that the winner took, after fairness, the Cradle and the cap
  capped: boolean; // the per battle cap cut the take
  taken: Carried; // what the winner takes
  lost: Carried; // everything the loser gives up: `taken`, and for a Sunk ship also what goes into the Wreck
  wreck: SalvagePile | null; // Sunk only: what the loser gives up and the winner does not take, left in that water for 4 Tides
  pick: CapturePick | null; // Captured only
}

/**
 * Loot by outcome from the 8.7 table, times the fairness factor, times 0.5 in the Cradle, capped at capPerBattle x Boom.
 * A ship Sunk gives up min(1, fairness x Cradle) of what it carries (D57): the winner grabs its share of that, and the rest
 * becomes a Wreck. Any other paying outcome takes exactly what the winner gets, so nothing is created or destroyed.
 */
export function settleLoot(input: LootInput): LootResult {
  const { outcome } = input;
  const share = lootShare(outcome);
  const multiplier = lootMultiplier(input);
  const carried = cleanCarried(input.carried);
  const base = {
    outcome, share, fairness: multiplier.fairness, cradle: multiplier.cradle,
    fraction: 0, capped: false, taken: { plunder: 0, goods: {} }, lost: { plunder: 0, goods: {} }, wreck: null, pick: null,
  } satisfies LootResult;
  if (share === 0) return base;

  const total = cargoValue(carried, input.prices);
  const cap = L.capPerBattle * (input.boom ?? NEUTRAL);
  let fraction = share * multiplier.total;
  let capped = false;
  if (total > 0 && fraction * total > cap) {
    fraction = cap / total;
    capped = true;
  }
  const taken = scale(carried, fraction);

  let lost = taken;
  let wreck: SalvagePile | null = null;
  if (outcome === "sunk") {
    lost = atLeast(taken, scale(carried, Math.min(NEUTRAL, multiplier.total)));
    wreck = pile("wreck", input.loser, input.at, input.tide, minus(lost, taken), L.wreckTides);
  }
  return { ...base, fraction, capped, taken, lost, wreck, pick: outcome === "captured" ? capturePick() : null };
}
