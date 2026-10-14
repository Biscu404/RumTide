// Section 4.4 and section 15.5: resolve one Tide. Takes the season as it stands, every captain's
// orders and the Tide's seed, and returns the next season state, the battles, the log and the
// Gazette. Pure and deterministic: the same snapshot, orders and seed always give the same result,
// so a failed Tide can be retried and any Tide can be replayed (section 15.5 step 6).
//
// The order of events follows section 4.4: movement in up to 3 steps, meetings after each step,
// encounters in step order and then node order, then exploration and docking at the end.
// Exploration events (rule 7) and the Escort intent are not built yet (docs/DECISIONS.md), so
// Explore and Escort ships just sail their course. Escorts still join their fleet mates' fights.

import { B, cargoValue, maxHullPoints, speed, statValue } from "./balance.ts";
import { resolveBattle, type BattleResult, type Combatant } from "./combat.ts";
import {
  encounterBetween, pairKey, parleyResult, rollEscape, type Encounter, type EncounterShip,
} from "./encounter.ts";
import { settlePvpBattle, shrinkBounty, type LootParty } from "./loot.ts";
import { hopsFrom, shortestPath, type GameMap } from "./map.ts";
import { advanceMarket, boomPortForTide } from "./market.ts";
import { advanceStep, courseError, type Mover } from "./movement.ts";
import { npcCombatant, settleGalleonBattle, settleMerchantBattle, spawnNpcs } from "./npc.ts";
import {
  applyLoss, carriedValue, dock, holdLootCap, patchAfterStrike, patchAtSea,
} from "./port.ts";
import { createRng } from "./rng.ts";
import { median, type TideSnapshot } from "./season.ts";
import { shipPowerRating } from "./state.ts";
import type {
  Battle, Captain, Gazette, Intent, LogEvent, Maneuver, Npc, Orders, Ship,
} from "./types.ts";

export interface TideResult {
  /** The Tide that was resolved. */
  tide: number;
  /** The season as the next Tide opens: tide + 1, prices drifted back, NPCs spawned for it. */
  next: TideSnapshot;
  /** This Tide's NPCs as they ended: "taken" if a captain beat them, otherwise "gone". */
  npcs: Npc[];
  battles: Battle[];
  log: LogEvent[];
  gazette: Gazette;
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const MANEUVERS: readonly Maneuver[] = ["broadside", "outmaneuver", "board"];
const INTENTS: readonly Intent[] = ["trade", "quiet", "hunt", "explore", "escort"];

/** What one ship does this Tide, from submitted orders or from standing orders. */
interface ShipPlan {
  course: string[];
  intent: Intent;
  huntFilter: Orders["huntFilter"];
  plan: [Maneuver, Maneuver, Maneuver];
  parley: Orders["parley"];
  noQuarter: boolean;
  submitted: boolean;
}

/** The port with the fewest hops from `from`, ties to the lowest id. */
export function nearestPort(map: GameMap, from: string): string {
  const dist = hopsFrom(map, from);
  const ports = map.nodeIds.filter((id) => map.node(id).type === "port");
  return ports.reduce((best, p) => (dist.get(p)! < dist.get(best)! ? p : best));
}

function isPlan(plan: unknown): plan is [Maneuver, Maneuver, Maneuver] {
  return Array.isArray(plan) && plan.length === B.combat.rounds && plan.every((m) => MANEUVERS.includes(m));
}

/** Section 12.4: stay docked in port, or at sea sail Quietly to the nearest port. The standing plan defends the ship. */
function standingOrders(map: GameMap, captain: Captain, ship: Ship): ShipPlan {
  const base = { huntFilter: undefined, plan: captain.standingPlan, parley: captain.standingParley, noQuarter: false, submitted: false };
  if (map.node(ship.nodeId).type === "port") return { ...base, course: [], intent: "trade" };
  const route = shortestPath(map, ship.nodeId, nearestPort(map, ship.nodeId));
  return { ...base, course: route.slice(0, speed(ship.hull, ship.levels.sails)), intent: "quiet" };
}

export function resolveTide(map: GameMap, snap: TideSnapshot, orders: readonly Orders[], seed: number): TideResult {
  const rng = createRng(seed);
  const tide = snap.tide;
  const { settings } = snap;

  // Working copies. The snapshot itself is never changed.
  const captains = new Map<string, Captain>(snap.captains.map((c) => [c.id, { ...c }]));
  const ships = new Map<string, Ship>(snap.ships.map((s) => [s.captainId, { ...s }]));
  const npcs = new Map<string, Npc>(snap.npcs.map((n) => [n.id, { ...n }]));
  const ids = [...captains.keys()].sort(compareIds);
  for (const id of ids) if (!ships.has(id)) throw new Error(`Captain ${id} has no ship`);
  if (ships.size !== captains.size) throw new Error("Every ship needs a captain");

  const log: LogEvent[] = [];
  const battles: Battle[] = [];
  const say = (kind: string, text: string, captainId: string | null = null, visibility: LogEvent["visibility"] = "public", data: unknown = null) =>
    log.push({ id: `evt-t${tide}-${log.length + 1}`, tide, captainId, visibility, kind, text, data });

  const captain = (id: string) => captains.get(id)!;
  const ship = (id: string) => ships.get(id)!;
  const place = (nodeId: string) => map.node(nodeId).name;
  const label = (id: string) => {
    const npc = npcs.get(id);
    if (!npc) return captain(id).shipName;
    return npc.kind === "galleon" ? "the Treasure Galleon" : npc.kind === "fatMerchant" ? "a Fat Merchant" : "a Small Trader";
  };
  const names = (list: readonly string[]) => {
    const all = list.map(label);
    return all.length <= 1 ? (all[0] ?? "") : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
  };

  // ---- Orders ----

  const submitted = new Map(orders.filter((o) => o.tide === tide).map((o) => [o.captainId, o]));
  const plans = new Map<string, ShipPlan>();
  for (const id of ids) {
    const c = captain(id), s = ship(id), o = submitted.get(id);
    if (o) {
      const problem = courseError(map, s.nodeId, o.course, speed(s.hull, s.levels.sails))
        ?? (isPlan(o.plan) ? null : "The battle plan needs three maneuvers")
        ?? (INTENTS.includes(o.intent) ? null : `Unknown intent ${String(o.intent)}`);
      if (problem === null) {
        plans.set(id, {
          course: [...o.course], intent: o.intent,
          huntFilter: o.intent === "hunt" ? (o.huntFilter ?? "merchants") : undefined,
          plan: [...o.plan], parley: o.parley, noQuarter: o.noQuarter, submitted: true,
        });
        continue;
      }
      say("orders", `Your orders could not be followed (${problem}), so your standing orders were used.`, id, "private");
    }
    plans.set(id, standingOrders(map, c, s));
  }

  // ---- State during the Tide ----

  const pos = new Map<string, string>();       // where every ship is right now
  for (const id of ids) pos.set(id, ship(id).nodeId);
  for (const n of snap.npcs) pos.set(n.id, n.nodeId);
  const engaged = new Set<string>();            // fought a battle this Tide: stopped, and out of any other fight
  const escaped = new Set<string>();            // pairs (pairKey) that slipped away from each other
  const struck = new Set<string>();             // hull at zero: towed to port when the Tide ends
  const battleNode = new Map<string, string>(); // where a struck ship was when it fought
  const bountyAdded = new Map<string, number>();

  // The Legend leader is the Most Wanted (section 9 rule 7).
  const mostWanted = ids.reduce<string | null>((best, id) =>
    captain(id).legend > 0 && (best === null || captain(id).legend > captain(best).legend) ? id : best, null);

  const encShip = (id: string): EncounterShip => {
    const npc = npcs.get(id);
    if (npc) {
      return { id, kind: "npc", fleetId: null, docked: false, shieldUntilTide: null, intent: "trade",
               sails: npc.pr, pr: npc.pr, parley: "off", noQuarter: false };
    }
    const c = captain(id), s = ship(id), p = plans.get(id)!;
    return {
      id, kind: "player", fleetId: c.fleetId,
      docked: map.node(pos.get(id)!).type === "port",   // no combat in a port, passing through counts
      shieldUntilTide: c.shieldUntilTide, intent: p.intent, huntFilter: p.huntFilter,
      sails: statValue(s.hull, s.levels.sails), pr: shipPowerRating(s), parley: p.parley, noQuarter: p.noQuarter,
    };
  };

  const combatant = (id: string, startedHunt: boolean): Combatant => {
    const npc = npcs.get(id);
    if (npc) return npcCombatant(npc, rng);
    const s = ship(id);
    return {
      id, kind: "player", pr: shipPowerRating(s),
      cannons: statValue(s.hull, s.levels.cannons), sails: statValue(s.hull, s.levels.sails), crew: statValue(s.hull, s.levels.crew),
      hullPoints: s.hullPoints, maxHull: maxHullPoints(s.hull, s.levels.hull),
      plan: plans.get(id)!.plan, startedHunt,
    };
  };

  /** Fleet mates at the fight who are Hunting or Escorting join their side (section 4.4 rule 6). */
  const joinsFleetMate = (of: EncounterShip, other: EncounterShip) =>
    other.kind === "player" && of.fleetId !== null && of.fleetId === other.fleetId
    && (other.intent === "hunt" || other.intent === "escort");

  // ---- Battles ----

  function fight(sideA: string[], sideB: string[], hunters: ReadonlySet<string>, nodeId: string, refusedParley: boolean) {
    sideA.sort(compareIds); sideB.sort(compareIds);
    const result: BattleResult = resolveBattle(
      [sideA.map((id) => combatant(id, hunters.has(id))), sideB.map((id) => combatant(id, hunters.has(id)))], rng,
    );
    const sides = [sideA, sideB];
    for (const id of [...sideA, ...sideB]) {
      engaged.add(id);
      if (npcs.has(id)) continue;
      ship(id).hullPoints = result.hullAfter[id]!;
      battleNode.set(id, nodeId);
      if (result.hullAfter[id]! <= 0) struck.add(id);
    }

    const battle: Battle = {
      id: `battle-t${tide}-${battles.length + 1}`, tide, nodeId,
      sides: result.sides, rounds: result.rounds, outcome: result.outcome, winner: result.winner, loot: [], bountiesAdded: [],
    };
    battles.push(battle);
    const where = place(nodeId);
    const npcId = [...sideA, ...sideB].find((id) => npcs.has(id));

    if (result.winner === null) {
      say("battle", `${names(sideA)} and ${names(sideB)} fought to a draw off ${where}.`, null, "public", { battleId: battle.id });
      return;
    }
    const winners = sides[result.winner]!, losers = sides[result.winner === 0 ? 1 : 0]!;
    const outcome = result.outcome as "decisive" | "victory";
    const verb = outcome === "decisive" ? "forced" : "bested";
    const struckText = outcome === "decisive" ? " to strike her colours" : "";

    if (npcId !== undefined) {
      if (!winners.includes(npcId)) {
        const npc = npcs.get(npcId)!;
        npc.status = "taken";
        const prize = npc.kind === "galleon"
          ? settleGalleonBattle(outcome, winners, tide)
          : settleMerchantBattle(npc, outcome, winners.map((id) => ({
              id, damageDealt: result.damageDealt[id]!, holdCap: holdLootCap(ship(id), tide) })), tide);
        for (const id of winners) {
          const share = prize.shares[id]!;
          ship(id).plunderGold += share.gold;
          captain(id).legend += share.legend;
        }
        const gold = prize.taken;
        say(npc.kind === "galleon" ? "galleon" : "prize",
          npc.kind === "galleon"
            ? `${names(winners)} ${outcome === "decisive" ? "sank" : "mauled"} the Treasure Galleon off ${where} and carried off ${gold} doubloons.`
            : `${names(winners)} took ${label(npcId)} off ${where} and carried off ${gold} doubloons.`,
          null, "public", { battleId: battle.id });
      } else {
        say("battle", `${label(npcId)} beat ${names(losers)} off ${where}.`, null, "public", { battleId: battle.id });
      }
      return;
    }

    // Captain against captain.
    const party = (id: string): LootParty => ({
      id, pr: combatant(id, false).pr, carriedValue: carriedValue(ship(id), tide),
      damageDealt: result.damageDealt[id]!, holdCap: holdLootCap(ship(id), tide),
      bounty: captain(id).bounty, mostWanted: id === mostWanted,
    });
    const settlement = settlePvpBattle({
      outcome, winners: winners.map(party), losers: losers.map(party),
      winnersHunted: winners.some((id) => hunters.has(id)), refusedParley,
      zone: map.node(nodeId).zone, mawOpens: settings.mawOpens, tide,
    });
    for (const id of losers) {
      ships.set(id, applyLoss(ship(id), settlement.lossFraction[id]!).ship);
      captain(id).shieldUntilTide = settlement.shieldUntilTide[id]!;
    }
    for (const id of winners) {
      ship(id).plunderGold += settlement.gained[id]! + settlement.bountiesPaid[id]!;
      captain(id).legend += settlement.legend[id]!;
    }
    for (const id of settlement.bountiesCleared) { captain(id).bounty = 0; bountyAdded.delete(id); }
    for (const b of settlement.bountiesAdded) {
      captain(b.captainId).bounty += b.amount;
      bountyAdded.set(b.captainId, (bountyAdded.get(b.captainId) ?? 0) + b.amount);
    }
    battle.loot = settlement.loot;
    battle.bountiesAdded = settlement.bountiesAdded;
    say("battle",
      `${names(winners)} ${verb} ${names(losers)}${struckText} off ${where} and took ${settlement.totalGold} doubloons.`,
      null, "public", { battleId: battle.id });
  }

  // ---- Encounters ----

  /** The first hunter in id order who has a target here, preferring players over merchants. */
  function findEncounter(here: readonly string[]): { a: string; b: string; enc: Encounter } | null {
    const players = here.filter((id) => !npcs.has(id)), mobs = here.filter((id) => npcs.has(id));
    for (const a of players) {
      for (const b of [...players, ...mobs]) {
        if (a === b || escaped.has(pairKey(a, b))) continue;
        const enc = encounterBetween(encShip(a), encShip(b), tide);
        if (enc) return { a, b, enc };
      }
    }
    return null;
  }

  function resolveGroup(group: readonly string[], nodeId: string) {
    for (;;) {
      const here = group.filter((id) => !engaged.has(id));
      const found = findEncounter(here);
      if (!found) return;
      const { enc } = found;
      const mutual = enc.hunted === null;
      const first = enc.hunters[0]!, second = mutual ? enc.hunters[1]! : enc.hunted!;

      // Sides: the two ships, their fleet mates, and (for a merchant) any other hunters going after it.
      const taken = new Set([first, second]);
      const sideA = [first], sideB = [second];
      const recruit = (side: string[], lead: string) => {
        for (const id of here) {
          if (taken.has(id) || npcs.has(id)) continue;
          if (joinsFleetMate(encShip(lead), encShip(id))) { side.push(id); taken.add(id); }
        }
      };
      recruit(sideA, first);
      recruit(sideB, second);
      if (npcs.has(second)) {
        for (const id of here) {
          if (taken.has(id) || npcs.has(id) || escaped.has(pairKey(id, second))) continue;
          if (encounterBetween(encShip(id), encShip(second), tide)?.hunters.includes(id)) { sideA.push(id); taken.add(id); }
        }
      }
      const markEscaped = () => { for (const x of sideA) for (const y of sideB) escaped.add(pairKey(x, y)); };

      let refused = false;
      if (!mutual && npcs.get(second)?.kind !== "galleon") {   // the galleon is a boss and never flees
        const hunter = encShip(first), hunted = encShip(second);
        if (rollEscape(hunted, hunter, rng)) {
          markEscaped();
          say("escape", `${label(second)} slipped away from ${label(first)} off ${place(nodeId)}.`);
          continue;
        }
        const parley = parleyResult(hunted, hunter);
        if (parley.kind === "tribute") {
          const paid = applyLoss(ship(second), parley.fraction);
          ships.set(second, paid.ship);
          const units = paid.cargoLost.rum + paid.cargoLost.spice + paid.cargoLost.sugar;
          const gold = paid.plunderLost + Math.round(cargoValue(units, tide));
          ship(first).plunderGold += gold;
          markEscaped();
          say("tribute", `${label(second)} paid ${gold} doubloons in tribute to ${label(first)} off ${place(nodeId)} and sailed on.`);
          continue;
        }
        refused = parley.kind === "refused";
      }
      fight(sideA, sideB, new Set(mutual ? [...sideA, ...sideB] : sideA), nodeId, refused);
    }
  }

  // ---- Movement ----

  let moving: Mover[] = [
    ...ids.map((id) => ({ id, nodeId: pos.get(id)!, course: plans.get(id)!.course })),
    ...snap.npcs.map((n) => ({ id: n.id, nodeId: n.nodeId, course: [] as string[] })),
  ];
  for (let step = 1; step <= B.movement.steps; step++) {
    // Step 1 always runs: ships that never move can still be found by a hunter lying in wait.
    if (step > 1 && moving.every((m) => m.course.length === 0 || engaged.has(m.id))) break;
    const result = advanceStep(map, moving, step, engaged);
    moving = result.ships;
    for (const m of moving) pos.set(m.id, m.nodeId);

    const done = new Set<string>();
    for (const meeting of result.meetings) {
      const key = meeting.kind === "same" ? `node:${meeting.nodeId}` : `lane:${meeting.ships.join("|")}`;
      if (done.has(key)) continue;
      done.add(key);
      const group = meeting.kind === "same"
        ? moving.filter((m) => m.nodeId === meeting.nodeId).map((m) => m.id)
        : [...meeting.ships];
      resolveGroup(group, meeting.nodeId);
    }
  }

  // ---- The end of the Tide: towing, docking, patching, bookkeeping ----

  for (const id of ids) {
    let s = ship(id), c = captain(id);
    if (struck.has(id)) {
      // Section 7.2: towed to the nearest port, hull half patched for free, back in port for the next Tide.
      const home = nearestPort(map, battleNode.get(id) ?? pos.get(id)!);
      const nodeId = home;
      pos.set(id, nodeId);
      s = patchAfterStrike({ ...s, nodeId });
      say("tow", `${c.shipName} was towed to ${place(home)}.`, null);
    } else {
      s = { ...s, nodeId: pos.get(id)! };
    }
    if (map.node(s.nodeId).type === "port") {
      const docked = dock(s, c);
      s = docked.ship; c = docked.captain;
    } else {
      s = patchAtSea({ ...s, docked: false });
    }
    ships.set(id, s); captains.set(id, c);

    const p = plans.get(id)!;
    if (p.submitted) {
      c.lastOrdersTide = tide;
      c.status = "active";
    } else {
      c.shoreLeaveTides = Math.min(B.catchUp.shoreLeaveCap, c.shoreLeaveTides + 1);
      if (tide - c.lastOrdersTide >= B.catchUp.ashoreAfterMissed) c.status = "ashore";
    }
    // Old bounties shrink. A bounty earned this Tide starts at full size.
    const fresh = bountyAdded.get(id) ?? 0;
    c.bounty = shrinkBounty(c.bounty - fresh) + fresh;
  }

  const resolvedNpcs = snap.npcs.map((n) => ({ ...npcs.get(n.id)!, status: npcs.get(n.id)!.status === "taken" ? "taken" as const : "gone" as const }));

  // ---- The next Tide ----

  const nextTide = tide + 1;
  const active = ids.filter((id) => captain(id).status === "active");
  const medianPR = median(active.map((id) => shipPowerRating(ship(id))));
  const boomPortId = boomPortForTide(map, nextTide, snap.boomPortId, rng);
  const nextNpcs = nextTide <= snap.lengthTides
    ? spawnNpcs(map, { seasonId: snap.seasonId, tide: nextTide, players: active.length, medianPR, galleonTides: settings.galleonTides }, rng)
    : [];

  const next: TideSnapshot = {
    seasonId: snap.seasonId, settings, lengthTides: snap.lengthTides, tide: nextTide,
    captains: ids.map(captain), ships: ids.map(ship), npcs: nextNpcs,
    market: advanceMarket(snap.market), boomPortId,
  };

  const headlines = log.filter((e) => e.visibility === "public").map((e) => e.text);
  if (headlines.length === 0) headlines.push(`A quiet Tide on ${map.name}. Nobody fired a shot.`);
  return { tide, next, npcs: resolvedNpcs, battles, log, gazette: { headlines } };
}
