// Section 4.6 (NPC ships), section 8.2 (the galleon) and the NPC rows of sections 5.1 and 6.2:
// spawning merchants and the Treasure Galleon, how they fight, and what beating them pays.
//
// NPCs stay on their node for the one Tide they exist. They are created while the Tide before
// resolves, so captains see them on the map when they plan their orders ("one Tide ahead").
// Randomness comes only from the Rng passed in; collections are walked in sorted id order.

import { B, cargoValue, coopShare, npcPR } from "./balance.ts";
import type { Combatant } from "./combat.ts";
import { apportion, apportionCapped } from "./loot.ts";
import { hopsFrom, type GameMap } from "./map.ts";
import type { Rng } from "./rng.ts";
import type { Maneuver, Npc, NpcKind, SeasonSettings } from "./types.ts";

const MANEUVERS: readonly Maneuver[] = ["broadside", "outmaneuver", "board"];
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface SpawnInput {
  seasonId: string;
  /** The Tide the NPCs will be met on (they are created during the Tide before). */
  tide: number;
  /** Active captains, which sets how many merchants appear. */
  players: number;
  /** Median Power Rating of the active captains, which sets the NPCs' strength. */
  medianPR: number;
  galleonTides: SeasonSettings["galleonTides"];
}

/** A shortest path between two nodes, picking at random where several are equally short. */
function randomShortestPath(map: GameMap, from: string, to: string, rng: Rng): string[] {
  const dist = hopsFrom(map, from);
  const path = [to];
  while (path[0] !== from) {
    const here = path[0]!;
    const back = map.neighbours(here).filter((n) => dist.get(n) === dist.get(here)! - 1);
    path.unshift(rng.pick(back));
  }
  return path;
}

/** A node on a lane between two ports, where a merchant can be caught. Never a port: docked ships are safe. */
function laneNode(map: GameMap, rng: Rng): string {
  const ports = map.nodeIds.filter((id) => map.node(id).type === "port");
  for (;;) {
    const a = rng.pick(ports), b = rng.pick(ports);
    if (a === b) continue;
    const between = randomShortestPath(map, a, b, rng).slice(1, -1).filter((id) => map.node(id).type !== "port");
    if (between.length > 0) return rng.pick(between);
  }
}

/** A Free Waters node for the Treasure Galleon: open sea, an island or a wreck. */
function galleonNode(map: GameMap, rng: Rng): string {
  const spots = map.nodeIds.filter((id) => {
    const n = map.node(id);
    return n.zone === "free" && (n.type === "sea" || n.type === "island" || n.type === "wreck");
  });
  return rng.pick(spots);
}

/** Habit shown in the bestiary: the Small Trader's favourite maneuver, or the other NPCs' fixed plan. */
function habitOf(kind: NpcKind): Maneuver[] {
  if (kind === "smallTrader") return [B.npc.smallTrader.favourite];
  return [...B.npc[kind].plan];
}

/**
 * The merchants (and on a galleon Tide the Treasure Galleon) that appear on `tide`.
 * Merchant count is 0.75 per player, with the fraction decided by a roll, so 6 players give 4 or 5.
 */
export function spawnNpcs(map: GameMap, input: SpawnInput, rng: Rng): Npc[] {
  const expected = B.npc.merchantsPerPlayer * input.players;
  const count = Math.floor(expected) + (rng.next() < expected - Math.floor(expected) ? 1 : 0);
  const npcs: Npc[] = [];
  const make = (kind: NpcKind, id: string, nodeId: string): Npc => ({
    id, seasonId: input.seasonId, kind, nodeId, pr: npcPR(kind, input.medianPR),
    habit: habitOf(kind), cargoUnits: kind === "galleon" ? 0 : B.npc[kind].cargo,
    spawnedTide: input.tide, status: "active",
  });
  for (let i = 0; i < count; i++) {
    const kind: NpcKind = rng.next() < B.npc.fatMerchantShare ? "fatMerchant" : "smallTrader";
    npcs.push(make(kind, `npc-t${input.tide}-m${i + 1}`, laneNode(map, rng)));
  }
  if (input.galleonTides.includes(input.tide)) {
    npcs.push(make("galleon", `npc-t${input.tide}-galleon`, galleonNode(map, rng)));
  }
  return npcs.sort((a, b) => compareIds(a.id, b.id));
}

/** The three maneuvers an NPC plays this battle. The Small Trader leans on its favourite, the rest follow a script. */
export function npcPlan(npc: Pick<Npc, "kind" | "habit">, rng: Rng): [Maneuver, Maneuver, Maneuver] {
  if (npc.kind !== "smallTrader") return [...npc.habit] as [Maneuver, Maneuver, Maneuver];
  const favourite = npc.habit[0]!;
  const others = MANEUVERS.filter((m) => m !== favourite);
  const pick = () => (rng.next() < B.npc.smallTrader.favouriteShare ? favourite : rng.pick(others));
  return [pick(), pick(), pick()];
}

/** An NPC as a battle sees it: every stat equals its PR and its hull is B.hullPerPR times that (section 14). */
export function npcCombatant(npc: Npc, rng: Rng): Combatant {
  const hull = B.hullPerPR * npc.pr;
  return {
    id: npc.id, kind: "npc", pr: npc.pr, cannons: npc.pr, sails: npc.pr, crew: npc.pr,
    hullPoints: hull, maxHull: hull, plan: npcPlan(npc, rng),
  };
}

// ---- Prizes ----

export interface PrizeWinner {
  id: string;
  /** Damage dealt in the battle (BattleResult.damageDealt). Winners share by this. */
  damageDealt: number;
  /** Most gold this captain can carry off, from holdLootCap in port.ts. No cap if left out. */
  holdCap?: number;
}

export interface PrizeShare {
  /** Gold added to the captain's plunder (at risk until they dock). */
  gold: number;
  legend: number;
}

export interface PrizeSettlement {
  /** Value of the cargo before the Hold caps, 0 on a draw. */
  total: number;
  /** Gold actually carried off, which is less than `total` when Holds are too small. */
  taken: number;
  shares: Record<string, PrizeShare>;
}

/**
 * Beating a merchant (section 4.6): its cargo, valued at the prize value and the Boom, goes to the
 * winners in proportion to damage dealt. A Decisive win pays all of it and a Victory pays half.
 * Nobody carries off more than their Hold takes (section 5.1). Each winner earns the NPC Legend.
 */
export function settleMerchantBattle(
  npc: Pick<Npc, "kind" | "cargoUnits">, outcome: "decisive" | "victory", winners: readonly PrizeWinner[], tide: number,
): PrizeSettlement {
  if (npc.kind === "galleon") throw new Error("The galleon pays through settleGalleonBattle");
  const sorted = [...winners].sort((a, b) => compareIds(a.id, b.id));
  const total = Math.round(cargoValue(npc.cargoUnits, tide) * (outcome === "decisive" ? 1 : B.npc.merchantVictoryPays));
  const gold = apportionCapped(total, sorted.map((w) => w.damageDealt), sorted.map((w) => w.holdCap ?? Infinity));
  const shares: Record<string, PrizeShare> = {};
  sorted.forEach((w, i) => { shares[w.id] = { gold: gold[i]!, legend: B.legend.npcWin }; });
  return { total, taken: gold.reduce((a, b) => a + b, 0), shares };
}

/**
 * Beating the Treasure Galleon (section 8.2): `base * boom * N ** 1.5` in total for N captains, split
 * evenly, so each captain's share is `coopShare`. A Decisive sinking pays all of it and a Victory
 * pays half. Galleon loot is plunder with no Hold cap in Season 0 (the cap is a V2 rig, section 8.3).
 * Every captain who shared the win earns the co op Legend.
 */
export function settleGalleonBattle(
  outcome: "decisive" | "victory", captainIds: readonly string[], tide: number,
): PrizeSettlement {
  const ids = [...captainIds].sort(compareIds);
  if (ids.length === 0) throw new Error("A galleon prize needs winners");
  const pays = outcome === "decisive" ? 1 : B.npc.galleon.victoryPays;
  const total = Math.round(coopShare(B.npc.galleon.basePrize, tide, ids.length) * ids.length * pays);
  const gold = apportion(total, ids.map(() => 1));
  const shares: Record<string, PrizeShare> = {};
  ids.forEach((id, i) => { shares[id] = { gold: gold[i]!, legend: B.legend.coopPrize }; });
  return { total, taken: total, shares };
}
