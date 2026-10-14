// Section 7.2 (loot), section 5.1 (the Hold caps what a winner can carry off), section 9 rules 1, 2,
// 3, 7 and 10: what a PvP win pays, who gets it, the fairness factor, bounties and shields.
// NPC prizes are in npc.ts.
//
// Pure arithmetic on numbers handed in. The caller works out each captain's carried value and
// hold cap (port.ts has carriedValue and holdLootCap) and applies the settlement to the ships
// and captains (port.ts has applyLoss).

import { B, fairnessFactor, lootTaken } from "./balance.ts";
import { shieldUntilAfterLoss } from "./encounter.ts";
import type { Zone } from "./map.ts";
import type { BountyReason, BountyRecord, LootRecord } from "./types.ts";

export interface LootParty {
  id: string;
  pr: number;
  /** Plunder gold plus the value of the cargo, in doubloons. Only this is ever at risk. */
  carriedValue: number;
  /** Damage dealt in the battle (BattleResult.damageDealt). Winners split by this. */
  damageDealt: number;
  /** Most gold this captain can carry off if they win, from holdLootCap. No cap if left out. */
  holdCap?: number;
  /** The bounty on this captain before the battle. */
  bounty: number;
  /** Is this captain the Legend leader? Beating them pays more Legend (section 9 rule 7). */
  mostWanted?: boolean;
}

export interface SettleInput {
  outcome: "decisive" | "victory";
  winners: readonly LootParty[];
  losers: readonly LootParty[];
  /** Did the winning side start the hunt? Bounties only land on hunters. */
  winnersHunted: boolean;
  /** Was a parley offer refused (the hunter set No Quarter) in this encounter? */
  refusedParley: boolean;
  zone: Zone;
  mawOpens: boolean;
  tide: number;
}

export interface LootSettlement {
  fairness: number;
  zoneMult: number;
  /** Gold taken in total, whole doubloons. */
  totalGold: number;
  /** Who paid whom. Sums to totalGold. */
  loot: LootRecord[];
  /** Share of each loser's plunder AND cargo that is gone. port.ts applyLoss applies it. */
  lossFraction: Record<string, number>;
  /** Gold each winner gained from loot. */
  gained: Record<string, number>;
  /** New bounties on winners, equal to the loot they took. */
  bountiesAdded: BountyRecord[];
  /** Bounties collected from the Admiralty (new money), per winner. */
  bountiesPaid: Record<string, number>;
  /** Losers whose bounty is gone because they were beaten. */
  bountiesCleared: string[];
  legend: Record<string, number>;
  /** Last Tide of each loser's shield. */
  shieldUntilTide: Record<string, number>;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Loot multiplier for where the battle happened. Crown Waters halve it, the Maw (once open) raises it,
 * and Calm Seas week halves PvP loot. The Maw is Free while it is closed (section 4.3).
 */
export function zoneLootMult(zone: Zone, mawOpens: boolean, tide: number, pvp: boolean): number {
  let mult = 1;
  if (zone === "crown") mult *= B.loot.crownWaters;
  if (zone === "maw" && mawOpens) mult *= B.loot.maw;
  if (pvp && tide <= B.loot.calmSeasLastTide) mult *= B.loot.calmSeasWeek;
  return mult;
}

/** Bounties shrink 10% each Tide and disappear when they reach nothing. */
export const shrinkBounty = (amount: number) => Math.floor(amount * B.fairness.bountyKeepPerTide);

/**
 * Split a whole number across weights, as evenly as the weights allow, with the largest remainder
 * method so the parts add up exactly. Ties go to the earlier entry. Zero weights split evenly.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (sum > 0 ? (total * w) / sum : total / weights.length));
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => ({ i, rem: x - Math.floor(x) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    parts[i]! += 1;
    left -= 1;
  }
  return parts;
}

/**
 * Split a whole number by weight like apportion, but no part may pass its cap. What a capped part
 * cannot take goes to the others, and anything nobody has room for is left out, so the parts can
 * add up to less than the total.
 */
export function apportionCapped(total: number, weights: readonly number[], caps: readonly number[]): number[] {
  const parts = weights.map(() => 0);
  const full = new Set<number>();
  const room = (i: number) => Math.max(0, Math.floor(caps[i]!)) - parts[i]!;
  weights.forEach((_, i) => { if (room(i) <= 0) full.add(i); });
  for (let pass = 0; pass <= weights.length; pass++) {
    const left = total - parts.reduce((a, b) => a + b, 0);
    const open = weights.map((_, i) => i).filter((i) => !full.has(i));
    if (left <= 0 || open.length === 0) break;
    const shares = apportion(left, open.map((i) => weights[i]!));
    open.forEach((i, k) => {
      const give = Math.min(shares[k]!, room(i));
      parts[i]! += give;
      if (room(i) <= 0) full.add(i);
    });
  }
  return parts;
}

/** Match what losers pay to what winners gain, in id order, so every doubloon has one source and one sink. */
function payments(losers: { id: string; pays: number }[], winners: { id: string; gains: number }[]): LootRecord[] {
  const records: LootRecord[] = [];
  const gains = winners.map((w) => w.gains);
  let w = 0;
  for (const loser of losers) {
    let owed = loser.pays;
    while (owed > 0 && w < winners.length) {
      const take = Math.min(owed, gains[w]!);
      if (take > 0) records.push({ fromId: loser.id, toId: winners[w]!.id, gold: take });
      owed -= take;
      gains[w]! -= take;
      if (gains[w]! === 0) w++;
    }
  }
  return records;
}

export function settlePvpBattle(input: SettleInput): LootSettlement {
  const winners = [...input.winners].sort((a, b) => compareIds(a.id, b.id));
  const losers = [...input.losers].sort((a, b) => compareIds(a.id, b.id));
  if (winners.length === 0 || losers.length === 0) throw new Error("A settlement needs winners and losers");

  const sum = (parties: readonly LootParty[], pick: (p: LootParty) => number) =>
    parties.reduce((t, p) => t + pick(p), 0);
  const winnerPR = sum(winners, (p) => p.pr), loserPR = sum(losers, (p) => p.pr);

  // Fairness compares whole sides, so three equal ships ganging one are judged as 3 to 1 and a
  // fair fleet against fleet fight is judged as 1 to 1.
  const fairness = fairnessFactor(loserPR, winnerPR);
  const zoneMult = zoneLootMult(input.zone, input.mawOpens, input.tide, true);

  const carried = losers.map((p) => p.carriedValue);
  const wanted = Math.round(lootTaken(sum(losers, (p) => p.carriedValue), input.outcome, fairness, zoneMult, input.tide));
  // Winners split the loot by damage, but nobody carries off more than their Hold takes (section 5.1).
  // What does not fit stays with the losers, so the loot actually taken can be less than `wanted`.
  const gains = apportionCapped(wanted, winners.map((p) => p.damageDealt), winners.map((p) => p.holdCap ?? Infinity));
  const totalGold = gains.reduce((a, b) => a + b, 0);
  const pays = apportion(totalGold, carried);

  const lossFraction: Record<string, number> = {};
  losers.forEach((p, i) => { lossFraction[p.id] = p.carriedValue > 0 ? pays[i]! / p.carriedValue : 0; });
  const gained: Record<string, number> = {};
  winners.forEach((p, i) => { gained[p.id] = gains[i]!; });

  const reasons: BountyReason[] = [];
  if (input.winnersHunted) {
    if (loserPR < B.fairness.bountyBelowRatio * winnerPR) reasons.push("huntedWeaker");
    if (input.refusedParley) reasons.push("refusedParley");
    if (input.zone === "crown") reasons.push("crownWaters");
  }
  const bountiesAdded: BountyRecord[] = reasons.length === 0 ? [] : winners
    .filter((p) => gained[p.id]! > 0)
    .map((p) => ({ captainId: p.id, amount: gained[p.id]!, reasons: [...reasons] }));

  // Whoever beats a captain with a bounty collects it, split like the loot.
  const owed = sum(losers, (p) => p.bounty);
  const paid = apportion(owed, winners.map((p) => p.damageDealt));
  const bountiesPaid: Record<string, number> = {};
  winners.forEach((p, i) => { bountiesPaid[p.id] = paid[i]!; });

  const legendEach = Math.round(B.legend.pvpWin * fairness
    * (losers.some((p) => p.mostWanted) ? B.legend.mostWantedMult : 1));
  const legend: Record<string, number> = {};
  for (const p of winners) legend[p.id] = legendEach;

  const shieldUntilTide: Record<string, number> = {};
  for (const p of losers) shieldUntilTide[p.id] = shieldUntilAfterLoss(input.tide);

  return {
    fairness, zoneMult, totalGold,
    loot: payments(losers.map((p, i) => ({ id: p.id, pays: pays[i]! })), winners.map((p, i) => ({ id: p.id, gains: gains[i]! }))),
    lossFraction, gained, bountiesAdded, bountiesPaid,
    bountiesCleared: losers.filter((p) => p.bounty > 0).map((p) => p.id),
    legend, shieldUntilTide,
  };
}
