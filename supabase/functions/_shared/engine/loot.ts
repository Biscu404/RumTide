// Section 7.2 (loot), section 9 rules 1, 2, 3, 7 and 10: what a PvP win pays, who gets it,
// the fairness factor, bounties and shields. NPC prizes arrive with the economy on day 4.
//
// Pure arithmetic on numbers handed in. The caller works out each captain's carried value
// (plunder plus cargo at its value) and applies the settlement to the ships and captains.

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
  /** Share of each loser's plunder AND cargo that is gone. Day 4 applies it to the cargo. */
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
  const totalGold = Math.round(lootTaken(sum(losers, (p) => p.carriedValue), input.outcome, fairness, zoneMult, input.tide));
  const pays = apportion(totalGold, carried);
  const gains = apportion(totalGold, winners.map((p) => p.damageDealt));

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
