// Plays whole seasons with scripted captains on the real engine (section 15.6): every Tide the bots
// visit port and set orders, resolveTide runs, and the state is checked for impossible values.
// No network and no database, so a 14 Tide season takes a few milliseconds.

import { B, SEASON_PRESETS, holdUnits, maxHullPoints } from "@engine/balance.ts";
import type { GameMap } from "@engine/map.ts";
import type { PortContext } from "@engine/port.ts";
import { resolveTide } from "@engine/resolve.ts";
import { createRng } from "@engine/rng.ts";
import { startSeason, type TideSnapshot } from "@engine/season.ts";
import { shipPowerRating } from "@engine/state.ts";
import type { Battle, Orders } from "@engine/types.ts";
import { CAREFUL } from "../sim/economy.ts";
import { brine, totalLevels } from "../sim/trader.ts";
import { hunterBot, traderBot, type Bot } from "./captains.ts";

const botRng = (seed: number) => (name: string) =>
  createRng(seed * 7919 + [...name].reduce((t, ch) => t * 31 + ch.charCodeAt(0), 7));

/** The six captains of Season 0: two solo traders, a raider, a reaver and a fleet of two traders. */
export function sixCaptains(seed: number): Bot[] {
  const rng = botRng(seed);
  return [
    traderBot("ann", CAREFUL, rng("ann")),
    traderBot("bob", CAREFUL, rng("bob"), null, [5, 6, 7]),   // away for a week, like the doc's solo trader
    hunterBot("cat", "raider", CAREFUL, rng("cat")),
    hunterBot("dan", "reaver", CAREFUL, rng("dan")),
    traderBot("eve", CAREFUL, rng("eve"), "f1"),
    traderBot("fay", CAREFUL, rng("fay"), "f1"),
  ];
}

/** Everyone hunts everyone outside their own fleet: two fleets of three. Stresses fleet battles, shields and bounties. */
export function brawl(seed: number): Bot[] {
  const rng = botRng(seed);
  return ["ann", "bob", "cat", "dan", "eve", "fay"].map((id, i) =>
    hunterBot(id, "raider", CAREFUL, rng(id), i < 3 ? "f1" : "f2"));
}

export interface TideSummary {
  tide: number;
  battles: number;
  merchantsTaken: number;
  /** Fights with the Treasure Galleon, and whether it went down. */
  galleonFights: number;
  galleonSunk: boolean;
  tributes: number;
  escapes: number;
  towed: number;
}

export interface CaptainSummary {
  id: string;
  role: string;
  legend: number;
  chestGold: number;
  hull: string;
  levels: number;
  pr: number;
  battles: number;
  wins: number;
  struck: number;
  merchants: number;
  shoreLeave: number;
  status: string;
}

export interface SeasonReport {
  seed: number;
  final: TideSnapshot;
  tides: TideSummary[];
  captains: CaptainSummary[];
  battles: Battle[];
  gazettes: string[][];
  /** Everything that went wrong. Empty means the season is sane. */
  problems: string[];
}

/**
 * Impossible values in a season state. Cheap enough to run after every Tide. `atRest` is false
 * between port visits, when a trader that has loaded cargo is still on its port's node undocked.
 */
export function checkState(map: GameMap, snap: TideSnapshot, when: string, atRest = true): string[] {
  const problems: string[] = [];
  const bad = (what: string) => problems.push(`${when}: ${what}`);
  const finite = (x: number) => Number.isFinite(x);
  const chests = new Map(snap.captains.map((c) => [c.id, c]));

  for (const ship of snap.ships) {
    const id = ship.captainId, c = chests.get(id);
    if (!c) { bad(`${id} has a ship but no captain`); continue; }
    if (!map.has(ship.nodeId)) bad(`${id} is on unknown node ${ship.nodeId}`);
    const port = map.has(ship.nodeId) && map.node(ship.nodeId).type === "port";
    if (atRest && ship.docked !== port) bad(`${id} docked=${ship.docked} but is at ${ship.nodeId}`);
    if (atRest && port && ship.plunderGold !== 0) bad(`${id} is in port with ${ship.plunderGold} plunder`);
    const max = maxHullPoints(ship.hull, ship.levels.hull);
    if (!finite(ship.hullPoints) || ship.hullPoints <= 0 || ship.hullPoints > max + 1e-6) bad(`${id} hull ${ship.hullPoints} of ${max}`);
    if (!finite(ship.plunderGold) || ship.plunderGold < 0) bad(`${id} plunder ${ship.plunderGold}`);
    if (!finite(c.chestGold) || c.chestGold < 0) bad(`${id} Chest ${c.chestGold}`);
    if (!finite(c.legend) || c.legend < 0) bad(`${id} Legend ${c.legend}`);
    if (!finite(c.bounty) || c.bounty < 0) bad(`${id} bounty ${c.bounty}`);
    if (!snap.settings.hullsEnabled.includes(ship.hull)) bad(`${id} has a ${ship.hull} this season does not allow`);
    for (const [stat, level] of Object.entries(ship.levels)) {
      if (!Number.isInteger(level) || level < 0 || level > B.upgrade.maxLevel) bad(`${id} ${stat} level ${level}`);
    }
    let units = 0;
    for (const [good, n] of Object.entries(ship.cargo)) {
      if (!Number.isInteger(n) || n < 0) bad(`${id} ${good} cargo ${n}`);
      units += n;
    }
    if (units > holdUnits(ship.hull, ship.levels.hold)) bad(`${id} carries ${units} units in a Hold of ${holdUnits(ship.hull, ship.levels.hold)}`);
    for (const [good, basis] of Object.entries(ship.cargoCostBasis)) {
      if (!finite(basis) || basis < -1e-6) bad(`${id} ${good} cost basis ${basis}`);
    }
  }
  for (const row of snap.market) {
    if (!finite(row.drift) || row.drift <= 0 || row.drift > 1 + 1e-9) bad(`market ${row.portId} ${row.good} drift ${row.drift}`);
  }
  for (const npc of snap.npcs) {
    if (!map.has(npc.nodeId) || map.node(npc.nodeId).type === "port") bad(`NPC ${npc.id} is at ${npc.nodeId}`);
    if (npc.spawnedTide !== snap.tide) bad(`NPC ${npc.id} was spawned for Tide ${npc.spawnedTide} but it is Tide ${snap.tide}`);
  }
  return problems;
}

export function playSeason(seed: number, bots: Bot[] = sixCaptains(seed), map: GameMap = brine): SeasonReport {
  const preset = "season0";
  const sorted = [...bots].sort((a, b) => (a.id < b.id ? -1 : 1));
  let snap = startSeason(map, "bots", preset, sorted.map((b) => ({ id: b.id, fleetId: b.fleetId })), seed);

  // Fleet mates set out together from one port, as friends who planned it would.
  for (const fleet of new Set(sorted.map((b) => b.fleetId).filter((f): f is string => f !== null))) {
    const mates = sorted.filter((b) => b.fleetId === fleet).map((b) => b.id);
    const home = snap.ships.find((s) => s.captainId === mates[0])!.nodeId;
    snap = { ...snap, ships: snap.ships.map((s) => (mates.includes(s.captainId) ? { ...s, nodeId: home } : s)) };
  }

  const problems: string[] = checkState(map, snap, "start");
  const tides: TideSummary[] = [];
  const battles: Battle[] = [];
  const gazettes: string[][] = [];
  const stats = new Map(sorted.map((b) => [b.id, { battles: 0, wins: 0, struck: 0, merchants: 0 }]));

  for (let tide = 1; tide <= SEASON_PRESETS[preset].lengthTides; tide++) {
    const orders: Orders[] = [];
    for (const bot of sorted) {
      const view = {
        map, snap,
        ctx: { map, tide, settings: snap.settings, boomPortId: snap.boomPortId } satisfies PortContext,
        ship: snap.ships.find((s) => s.captainId === bot.id)!,
        captain: snap.captains.find((c) => c.id === bot.id)!,
      };
      const turn = bot.play(view);
      snap = {
        ...snap, market: turn.market,
        ships: snap.ships.map((s) => (s.captainId === bot.id ? turn.ship : s)),
        captains: snap.captains.map((c) => (c.id === bot.id ? turn.captain : c)),
      };
      if (turn.orders && !bot.absent.includes(tide)) orders.push(turn.orders);
    }
    problems.push(...checkState(map, snap, `Tide ${tide} after port visits`, false));

    let result;
    try {
      result = resolveTide(map, snap, orders, seed * 1000 + tide);
    } catch (error) {
      problems.push(`Tide ${tide} threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      break;
    }
    problems.push(...checkState(map, result.next, `Tide ${tide} resolved`));
    if (result.next.tide !== tide + 1) problems.push(`Tide ${tide} opened Tide ${result.next.tide}`);
    if (result.gazette.headlines.length === 0) problems.push(`Tide ${tide} has an empty Gazette`);

    const summary: TideSummary = {
      tide, battles: result.battles.length, merchantsTaken: 0, galleonFights: 0, galleonSunk: false,
      tributes: result.log.filter((e) => e.kind === "tribute").length,
      escapes: result.log.filter((e) => e.kind === "escape").length,
      towed: result.log.filter((e) => e.kind === "tow").length,
    };
    for (const battle of result.battles) {
      const npcId = battle.sides.flatMap((s) => s.npcIds)[0];
      const galleon = npcId !== undefined && result.npcs.find((n) => n.id === npcId)?.kind === "galleon";
      for (const [i, side] of battle.sides.entries()) {
        for (const id of side.captainIds) {
          const row = stats.get(id)!;
          row.battles++;
          if (battle.winner === i) {
            row.wins++;
            if (npcId !== undefined && !galleon) row.merchants++;
          }
        }
      }
      if (galleon) {
        summary.galleonFights++;
        if (battle.winner === 0) summary.galleonSunk = true;
      } else if (npcId !== undefined && battle.winner === 0) {
        summary.merchantsTaken++;
      }
      battles.push(battle);
    }
    for (const e of result.log) if (e.kind === "tow") {
      const id = sorted.find((b) => e.text.startsWith(`${b.id} `))?.id;
      if (id) stats.get(id)!.struck++;
    }
    tides.push(summary);
    gazettes.push(result.gazette.headlines);
    snap = result.next;
  }

  const captains = sorted.map((bot): CaptainSummary => {
    const c = snap.captains.find((x) => x.id === bot.id)!, s = snap.ships.find((x) => x.captainId === bot.id)!;
    return {
      id: bot.id, role: bot.role, legend: c.legend, chestGold: c.chestGold, hull: s.hull, levels: totalLevels(s),
      pr: shipPowerRating(s), ...stats.get(bot.id)!, shoreLeave: c.shoreLeaveTides, status: c.status,
    };
  });
  return { seed, final: snap, tides, captains, battles, gazettes, problems };
}
