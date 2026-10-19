// The Tide resolver (GAMEPLAY 3.7). Pure and deterministic: the same state, orders and seed always
// produce the same new state and the same replay, byte for byte.
//
// Time inside a Tide is measured in ticks of one Watch, from 0 to the Watches cap. Every ship's
// position is known at every tick. Each tick runs four phases in this order:
//   1. lane crossings that happened since the last tick (ships passing on a lane)
//   2. actions that finish on this tick (arrivals, surveys, landings, docking, repairs)
//   3. actions that start on this tick (the next step of each plan)
//   4. meetings in waters at this tick
// Ships are always processed in ship id order, waters in water id order.

import { B, SEASON_PRESETS } from "./balance.ts";
import { LEVEL } from "./types.ts";
import type {
  ArchipelagoId, Captain, CaptainId, Condition, EncounterRecord, HuntFilter, Knowledge, LaneId, MapLane, MapWater,
  Orders, ReplayEvent, SeasonState, Ship, ShipId, SkipReason, Stance, Step, Terrain, WaterId, Wind,
} from "./types.ts";
import type { AmbushRange } from "./combat/types.ts";
import { combatEncounter, towShip } from "./combat/encounter.ts";
import { hasBeaten, upkeepBosses } from "./combat/shellback.ts";
import { otherEnd, type World } from "./map.ts";
import { rngFor, type Rng } from "./rng.ts";
import { islandFullyCharted, laneVisible, levelOf, onArrive, onLand, onSurvey } from "./knowledge.ts";
import { carriesCargo, maxHullPoints, maxRiggingPoints, watchesFor } from "./ship.ts";
import { chartedAt, hopCost, windsFor } from "./wcs.ts";
import { findRoute, pinnedRoute, type Route } from "./route.ts";
import { choosePlan, type PlanSource } from "./plan.ts";

// ---------- Encounters ----------

export interface EncounterSide {
  ship: Ship;
  captain: Captain;
  stance: Stance;
  doctrine: string | undefined; // the doctrine this ship asked for, its step's else its plan's; undefined means the captain's default (8.8)
  lurking: boolean; // lies in wait (8.1)
  ambushRange: AmbushRange | undefined; // the starting range a lurk step chose; undefined means the default
  charted: boolean; // the place was Charted for this captain when the Tide began (D12)
  withCurrent: boolean; // on a lane, moving the way a Strong Current flows (D79)
}

export interface EncounterContext {
  world: World;
  state: SeasonState; // the Tide's working copy of the state; the ships and captains below are inside it
  tide: number;
  seed: number; // the Tide seed; a battle draws from rngFor(seed, "battle", hunterId, targetId, round)
  t: number;
  at: string; // a water id, or a lane id when onLane
  onLane: boolean;
  archipelago: ArchipelagoId; // where it happens; a lane belongs to the archipelago of its first end
  terrain: Terrain | null; // the water's terrain; null on a lane
  wind: Wind; // the wind over that archipelago
  hunter: EncounterSide & { filter: HuntFilter };
  target: EncounterSide;
  mutual: boolean; // both were hunting each other
  joined?: { hunter: EncounterSide[]; target: EncounterSide[] }; // fleet mates of each lead who join its side if a battle is fought, in ship id order (v0.2 7.5). Absent means a one ship a side encounter
  rng: Rng;
}

export interface EncounterOutcome {
  result: string; // shown in the replay, e.g. "battlePending", "escaped", "tribute", "sunk"
  freeze: ShipId[]; // ships that stop moving for the rest of the Tide
  events?: ReplayEvent[];
  tow?: ShipId[]; // ships towed to a Harbour at the end of the Tide (8.7)
  bounties?: { captain: CaptainId; amount: number }[]; // bounties added; they start the next Tide at full size (v0.2 9 rule 2)
}

export type EncounterResolver = (ctx: EncounterContext) => EncounterOutcome;

/** The Phase 1 stand in: every encounter freezes both ships. Kept for tests that only care about movement; combatEncounter is the default. */
export const stubEncounter: EncounterResolver = (ctx) => ({
  result: "battlePending",
  freeze: [ctx.hunter.ship.id, ctx.target.ship.id],
});

// ---------- Input and output ----------

export interface TideInput {
  state: SeasonState;
  world: World;
  orders: Record<CaptainId, Orders | undefined>;
  seed: number; // this Tide's stored seed
  windOverride?: Record<ArchipelagoId, Wind>;
  resolveEncounter?: EncounterResolver;
}

export interface TideResult {
  state: SeasonState;
  replay: ReplayEvent[];
  encounters: EncounterRecord[];
}

// ---------- Simulation state ----------

type Action =
  | { kind: "hop"; start: number; end: number; from: WaterId; to: WaterId; lane: LaneId }
  | { kind: "survey" | "dock" | "repair"; start: number; end: number }
  | { kind: "land"; start: number; end: number; site: string }
  | { kind: "lurk"; start: number; end: number; filter: HuntFilter; doctrine: string | undefined; ambushRange: AmbushRange | undefined };

interface Sim {
  ship: Ship;
  captain: Captain;
  before: Knowledge; // the captain's knowledge when the Tide began
  steps: Step[];
  source: PlanSource;
  nextStep: number;
  stepIndex: number; // the step in progress, or -1
  watches: number;
  spent: number;
  action: Action | null;
  route: (Route & { at: number }) | null; // progress through the current Sail step
  stance: Stance; // stance of the current Sail step
  filter: HuntFilter | null; // hunt filter of the current Sail step
  huntTick: number | null; // a hunting Sail step still hunts on the tick it arrives
  huntTickFilter: HuntFilter | null;
  planDoctrine: string | undefined; // the plan's doctrine, for every step that names none
  stepDoctrine: string | undefined; // the doctrine named by the Sail or Lurk step in progress
  huntTickDoctrine: string | undefined;
  done: boolean;
  frozen: boolean;
  chartedIslands: Set<string>;
}

interface Crossing {
  time: number;
  a: Sim;
  b: Sim;
  aAction: Action;
  bAction: Action;
  lane: LaneId;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function resolveTide(input: TideInput): TideResult {
  const world = input.world;
  const state: SeasonState = structuredClone(input.state);
  const preset = SEASON_PRESETS[state.preset];
  const tide = state.tide;
  const resolver = input.resolveEncounter ?? combatEncounter;
  const winds = windsFor(world, state.seed, tide, input.windOverride);
  const replay: ReplayEvent[] = [];
  const encounters: EncounterRecord[] = [];
  const emit = (e: ReplayEvent) => replay.push(e);

  emit({ t: 0, kind: "tideStart", tide, winds });
  // A boss beaten last Tide is whole again, and from Tide 9 a little more tired (2.5).
  for (const e of upkeepBosses(state, tide)) emit(e);

  // ---------- Set up every ship ----------
  const shipIds = Object.keys(state.ships).sort();
  const sims: Sim[] = [];
  for (const id of shipIds) {
    const ship = state.ships[id] as Ship;
    const captain = state.captains[ship.captainId] as Captain;
    const { plan, source } = choosePlan(world, captain, ship, tide, input.orders[captain.id], winds);
    const watches = watchesFor(ship, captain).total;
    const chartedIslands = new Set(world.islandIds.filter((i) => islandFullyCharted(world, captain.knowledge, i)));
    sims.push({
      ship, captain, before: structuredClone(captain.knowledge), steps: plan.steps ?? [], source,
      nextStep: 0, stepIndex: -1, watches, spent: 0, action: null, route: null,
      stance: "trade", filter: null, huntTick: null, huntTickFilter: null,
      planDoctrine: plan.doctrine, stepDoctrine: undefined, huntTickDoctrine: undefined,
      done: false, frozen: false, chartedIslands,
    });
    emit({ t: 0, kind: "plan", ship: ship.id, source, steps: (plan.steps ?? []).length, watches });
  }

  const crossings: Crossing[] = [];
  const met = new Set<string>();
  const left = (s: Sim) => s.watches - s.spent;

  // ---------- Helpers ----------

  const windAt = (water: WaterId): Wind => winds[world.archOf[water] as string] as Wind;

  const positionAt = (s: Sim, t: number): WaterId | null =>
    s.action && s.action.kind === "hop" && s.action.start < t ? null : s.ship.waterId;

  const checkIslands = (s: Sim, t: number) => {
    for (const island of world.islandIds) {
      if (s.chartedIslands.has(island)) continue;
      if (islandFullyCharted(world, s.captain.knowledge, island)) {
        s.chartedIslands.add(island);
        emit({ t, kind: "islandCharted", captain: s.captain.id, island });
      }
    }
  };

  const matches = (f: HuntFilter, target: Sim): boolean => {
    switch (f.kind) {
      case "anyone": return true;
      case "players": return target.captain.kind === "player";
      case "npcs": return target.captain.kind === "npc";
      case "merchants": return target.captain.npcRole === "merchant";
      case "carryingCargo": return carriesCargo(target.ship);
      case "captain": return target.captain.id === f.captainId;
      case "notBeaten": return target.captain.kind === "player" && !hasBeaten(target.captain, f.boss);
    }
  };

  const huntingFilter = (s: Sim, t: number): HuntFilter | null => {
    if (s.frozen) return null;
    if (s.action?.kind === "lurk") return s.action.filter;
    if (s.action?.kind === "hop" && s.stance === "hunt") return s.filter;
    if (s.huntTick === t) return s.huntTickFilter;
    return null;
  };

  const archAtPlace = (place: string, onLane: boolean): ArchipelagoId =>
    world.archOf[onLane ? (world.lane[place]?.a as string) : place] as ArchipelagoId;

  const isProtected = (target: Sim, hunter: Sim, place: string, onLane: boolean): boolean => {
    if (target.ship.docked) return true;
    if (target.captain.fleetId && target.captain.fleetId === hunter.captain.fleetId) return true;
    if (target.captain.kind === "player" && tide < preset.cradleTruceUntilTide && archAtPlace(place, onLane) === preset.startArchipelago) return true;
    if (hunter.captain.kind === "player" && target.captain.shieldUntilTide >= tide) return true;
    return false;
  };

  const freeze = (s: Sim) => {
    s.frozen = true;
    s.done = true;
    s.action = null; // a hop in progress is abandoned; the ship stays in the water it left
    s.route = null;
    s.spent = s.watches;
  };

  /** The doctrine a ship asked for at this tick: the step's, else the plan's, else undefined (the captain's default). Mirrors huntingFilter. */
  const doctrineOf = (s: Sim, t: number): string | undefined => {
    if (s.action?.kind === "lurk") return s.action.doctrine ?? s.planDoctrine;
    const hunting = s.action?.kind === "hop" && s.stance === "hunt";
    return (!hunting && s.huntTick === t ? s.huntTickDoctrine : s.stepDoctrine) ?? s.planDoctrine;
  };

  /** True when the ship is crossing a lane in the direction its Strong Current flows (2.2). Only lanes have a direction (D79). */
  const movesWithCurrent = (s: Sim, place: string, onLane: boolean): boolean => {
    const lane = onLane ? world.lane[place] : undefined;
    const act = s.action;
    if (!lane || lane.current.strength !== "strong" || act?.kind !== "hop" || act.lane !== place) return false;
    return act.from === (lane.current.flow === "ab" ? lane.a : lane.b);
  };

  /**
   * Fleet mates of `lead` in the same water at this tick who are hunting join its side (v0.2 7.5). Escorting joins as well
   * once the Escort step exists (GAMEPLAY 3.5, 14.2). A lane has only the two ships that crossed on it, and a Harbour never
   * has a fight, so nobody joins there.
   */
  const fleetMates = (lead: Sim, opponent: Sim, place: string, onLane: boolean, t: number): Sim[] => {
    const fleet = lead.captain.fleetId;
    if (!fleet || onLane) return [];
    return sims.filter((m) =>
      m !== lead && m !== opponent && !m.frozen && !m.ship.docked && m.captain.kind === "player" && m.captain.fleetId === fleet
      && positionAt(m, t) === place && huntingFilter(m, t) !== null);
  };

  const sideOf = (s: Sim, t: number, place: string, onLane: boolean): EncounterSide => ({
    ship: s.ship, captain: s.captain,
    stance: s.action?.kind === "lurk" ? "hunt" : s.stance,
    doctrine: doctrineOf(s, t),
    lurking: s.action?.kind === "lurk",
    ambushRange: s.action?.kind === "lurk" ? s.action.ambushRange : undefined,
    charted: chartedAt(s.before, place),
    withCurrent: movesWithCurrent(s, place, onLane),
  });

  const encountered = new Set<string>(); // pairs that already met in an encounter this Tide: a pair has at most one
  const toTow: ShipId[] = []; // ships towed to a Harbour when the Tide ends
  const freshBounties = new Map<CaptainId, number>(); // bounties added this Tide, which only start to shrink next Tide

  const pairKey = (x: Sim, y: Sim): string => (x.ship.id < y.ship.id ? `${x.ship.id}|${y.ship.id}` : `${y.ship.id}|${x.ship.id}`);

  const tryEncounter = (x: Sim, y: Sim, place: string, onLane: boolean, t: number) => {
    if (x.frozen || y.frozen) return;
    const pair = pairKey(x, y);
    if (encountered.has(pair)) return;
    const fx = huntingFilter(x, t), fy = huntingFilter(y, t);
    const xHunts = !!fx && matches(fx, y) && !isProtected(y, x, place, onLane);
    const yHunts = !!fy && matches(fy, x) && !isProtected(x, y, place, onLane);
    if (!xHunts && !yHunts) return;
    encountered.add(pair);
    const mutual = xHunts && yHunts;
    const hunter = mutual ? (x.ship.id < y.ship.id ? x : y) : xHunts ? x : y;
    const target = hunter === x ? y : x;
    const filter = (hunter === x ? fx : fy) as HuntFilter;
    const archipelago = archAtPlace(place, onLane);
    const terrain = onLane ? null : (world.water[place] as MapWater).terrain;
    const mates = { hunter: fleetMates(hunter, target, place, onLane, t), target: fleetMates(target, hunter, place, onLane, t) };
    const joined = {
      hunter: mates.hunter.map((m) => sideOf(m, t, place, onLane)),
      target: mates.target.map((m) => sideOf(m, t, place, onLane)),
    };
    // A meeting between two fleets is one meeting: a parley or an escape settles it, and the ships that would have joined
    // cannot start another with the other side this Tide.
    for (const a of [hunter, ...mates.hunter]) for (const b of [target, ...mates.target]) encountered.add(pairKey(a, b));
    const outcome = resolver({
      world, state, tide, seed: input.seed, t, at: place, onLane, archipelago, terrain, wind: winds[archipelago] as Wind, mutual,
      hunter: { ...sideOf(hunter, t, place, onLane), filter },
      target: sideOf(target, t, place, onLane),
      ...(joined.hunter.length + joined.target.length > 0 ? { joined } : {}),
      rng: rngFor(input.seed, "encounter", hunter.ship.id, target.ship.id, t),
    });
    const rec: EncounterRecord = { t, at: place, onLane, hunter: hunter.ship.id, target: target.ship.id, result: outcome.result };
    encounters.push(rec);
    emit({ kind: "encounter", ...rec });
    for (const e of outcome.events ?? []) emit(e);
    for (const id of outcome.tow ?? []) if (!toTow.includes(id)) toTow.push(id);
    for (const b of outcome.bounties ?? []) freshBounties.set(b.captain, (freshBounties.get(b.captain) ?? 0) + b.amount);
    for (const id of [...outcome.freeze].sort()) {
      const s = sims.find((q) => q.ship.id === id);
      if (s) freeze(s);
    }
  };

  const skip = (s: Sim, t: number, reason: SkipReason) => emit({ t, kind: "skip", ship: s.ship.id, step: s.stepIndex + 1, reason });

  const stop = (s: Sim, t: number, reason: "becalmedShort" | "outOfWatches", needed: number) => {
    emit({ t, kind: "stop", ship: s.ship.id, water: s.ship.waterId, reason, needed, left: left(s) });
    s.done = true;
    s.route = null;
  };

  const undock = (s: Sim, t: number) => {
    if (!s.ship.docked) return;
    s.ship.docked = false;
    emit({ t, kind: "undock", ship: s.ship.id, water: s.ship.waterId });
  };

  const sightOf = (s: Sim, t: number): Sim[] => {
    const here = positionAt(s, t);
    if (!here) return [];
    const range = s.captain.perks.includes("lookout") ? B.sight.lookoutRange : B.sight.baseRange;
    const visible = new Set<WaterId>([here]);
    if (range >= 1) {
      for (const laneId of world.lanesAt[here] ?? []) {
        if (!laneVisible(world, s.captain.knowledge, laneId)) continue;
        const far = otherEnd(world.lane[laneId] as MapLane, here);
        if ((world.water[far] as MapWater).terrain !== "fog") visible.add(far);
      }
    }
    return sims.filter((o) => o !== s && !o.frozen && visible.has(positionAt(o, t) ?? ""));
  };

  const conditionHolds = (s: Sim, c: Condition | undefined, t: number): boolean => {
    if (!c) return true;
    switch (c.kind) {
      case "shipInSight": return sightOf(s, t).some((o) => matches(c.filter, o));
      case "watchesAtLeast": return left(s) >= c.n;
      case "hullBelow": return s.ship.hullPoints < (c.pct / 100) * maxHullPoints(s.ship);
      case "windIs": return windAt(s.ship.waterId).kind === c.wind;
      case "captainHere": {
        const here = positionAt(s, t);
        return sims.some((o) => o !== s && o.captain.id === c.captainId && positionAt(o, t) === here);
      }
    }
  };

  const scheduleCrossings = (s: Sim, act: Extract<Action, { kind: "hop" }>) => {
    for (const o of sims) {
      if (o === s || o.frozen || !o.action || o.action.kind !== "hop") continue;
      const oa = o.action;
      if (oa.lane !== act.lane || oa.from !== act.to) continue; // opposite directions only
      const d1 = act.end - act.start, d2 = oa.end - oa.start;
      const tc = round3((d1 * d2 + act.start * d2 + oa.start * d1) / (d1 + d2));
      if (tc > Math.max(act.start, oa.start) && tc < Math.min(act.end, oa.end)) {
        const [a, b, aAction, bAction] = s.ship.id < o.ship.id ? [s, o, act, oa] : [o, s, oa, act];
        crossings.push({ time: tc, a, b, aAction, bAction, lane: act.lane });
      }
    }
  };

  const startHop = (s: Sim, t: number): boolean => {
    const r = s.route as Route & { at: number };
    const from = r.waters[r.at] as WaterId, to = r.waters[r.at + 1] as WaterId, lane = r.lanes[r.at] as LaneId;
    const cost = hopCost(world, lane, from, s.ship.hull, windAt(from), chartedAt(s.before, from)).total;
    if (s.spent + cost > s.watches) { stop(s, t, "becalmedShort", cost); return false; }
    undock(s, t);
    const act = { kind: "hop" as const, start: t, end: t + cost, from, to, lane };
    s.action = act;
    s.spent += cost;
    emit({ t, kind: "hop", ship: s.ship.id, from, to, lane, cost, ends: act.end });
    scheduleCrossings(s, act);
    return true;
  };

  const startTimed = (s: Sim, t: number, kind: "survey" | "dock" | "repair" | "land", cost: number, site?: string): boolean => {
    if (s.spent + cost > s.watches) { stop(s, t, "outOfWatches", cost); return false; }
    if (kind === "repair") undock(s, t); // surveying or landing from a Harbour keeps you docked
    s.action = kind === "land" ? { kind, start: t, end: t + cost, site: site as string } : { kind, start: t, end: t + cost };
    s.spent += cost;
    return true;
  };

  /** Starts the next action for an idle ship. Skipped steps take no time. */
  const startNext = (s: Sim, t: number) => {
    if (s.done || s.frozen || s.action) return;
    if (s.route) { startHop(s, t); return; }
    while (s.nextStep < s.steps.length) {
      const step = s.steps[s.nextStep] as Step;
      s.stepIndex = s.nextStep;
      s.nextStep += 1;
      s.stance = "trade";
      s.filter = null;
      s.stepDoctrine = undefined;
      if (!conditionHolds(s, step.if, t)) { skip(s, t, "conditionFalse"); continue; }
      const water = world.water[s.ship.waterId] as MapWater;
      switch (step.kind) {
        case "sail": {
          if (!world.water[step.to] || levelOf(s.captain.knowledge, step.to) < LEVEL.rumoured) { skip(s, t, "invalid"); continue; }
          if (step.to === s.ship.waterId) { skip(s, t, "alreadyThere"); continue; }
          const r = step.route
            ? pinnedRoute(world, s.captain.knowledge, s.ship.waterId, step.route, s.ship.hull, winds)
            : findRoute(world, s.captain.knowledge, s.ship.waterId, step.to, s.ship.hull, winds);
          if (!r || r.waters[r.waters.length - 1] !== step.to) { skip(s, t, "noKnownRoute"); continue; }
          s.route = { ...r, at: 0 };
          s.stance = step.stance ?? "trade";
          s.filter = s.stance === "hunt" ? step.filter ?? { kind: "anyone" } : null;
          s.stepDoctrine = step.doctrine;
          startHop(s, t);
          return;
        }
        case "survey":
          startTimed(s, t, "survey", B.actions.survey);
          return;
        case "land": {
          const site = world.site[step.site];
          if (!site) { skip(s, t, "invalid"); continue; }
          if (site.island !== water.island) { skip(s, t, "siteNotHere"); continue; }
          if (levelOf(s.captain.knowledge, step.site) < LEVEL.sketched) { skip(s, t, "siteUnknown"); continue; }
          startTimed(s, t, "land", B.actions.land, step.site);
          return;
        }
        case "dock":
          if (water.terrain !== "harbour") { skip(s, t, "notAHarbour"); continue; }
          if (s.ship.docked) { skip(s, t, "alreadyThere"); continue; }
          startTimed(s, t, "dock", B.actions.dock);
          return;
        case "repair": {
          if (s.ship.hullPoints >= maxHullPoints(s.ship)) { skip(s, t, "nothingToRepair"); continue; }
          const free = s.captain.perks.includes("background.shipwright");
          if (!free && s.ship.hold.timber < B.repairAtSea.timber) { skip(s, t, "noTimber"); continue; }
          startTimed(s, t, "repair", B.actions.repair);
          return;
        }
        case "lurk": {
          if (left(s) < B.actions.lurkMin) { stop(s, t, "outOfWatches", B.actions.lurkMin); return; }
          undock(s, t);
          s.stepDoctrine = step.doctrine;
          s.action = { kind: "lurk", start: t, end: Number.POSITIVE_INFINITY, filter: step.filter, doctrine: step.doctrine, ambushRange: step.ambushRange };
          s.spent = s.watches;
          emit({ t, kind: "lurk", ship: s.ship.id, water: s.ship.waterId });
          return;
        }
        default:
          skip(s, t, "invalid");
          continue;
      }
    }
    s.done = true;
  };

  /** Finishes the action of a ship whose action ends on this tick. */
  const complete = (s: Sim, t: number) => {
    const act = s.action;
    if (!act || act.end !== t) return;
    s.action = null;
    switch (act.kind) {
      case "hop": {
        s.ship.waterId = act.to;
        const charted = onArrive(world, s.captain, act.to, act.lane);
        emit({ t, kind: "arrive", ship: s.ship.id, water: act.to, charted });
        const wind = windAt(act.from);
        if (wind.kind === "gale") {
          s.ship.riggingPoints = Math.max(0, s.ship.riggingPoints - Math.round(B.wind.gale.riggingDamagePerHop * maxRiggingPoints(s.ship)));
          emit({ t, kind: "galeDamage", ship: s.ship.id, riggingPoints: s.ship.riggingPoints });
        }
        const r = s.route as Route & { at: number };
        r.at += 1;
        if (r.at >= r.lanes.length) {
          if (s.stance === "hunt") { s.huntTick = t; s.huntTickFilter = s.filter; s.huntTickDoctrine = s.stepDoctrine; }
          s.route = null;
        }
        break;
      }
      case "survey": {
        const res = onSurvey(world, s.captain, s.ship.waterId, rngFor(input.seed, "survey", s.ship.id, s.stepIndex));
        emit({ t, kind: "survey", ship: s.ship.id, water: s.ship.waterId, charted: res.charted, revealed: res.revealed });
        break;
      }
      case "land": {
        const res = onLand(world, s.captain, act.site);
        emit({ t, kind: "land", ship: s.ship.id, site: act.site, charted: res.charted, unlocked: res.unlocked });
        break;
      }
      case "dock": {
        s.ship.docked = true;
        const banked = s.ship.plunder;
        s.captain.chest += banked;
        s.ship.plunder = 0;
        emit({ t, kind: "dock", ship: s.ship.id, water: s.ship.waterId, banked });
        break;
      }
      case "repair": {
        const max = maxHullPoints(s.ship);
        s.ship.hullPoints = Math.min(max, s.ship.hullPoints + Math.round(B.repairAtSea.hullShare * max));
        if (!s.captain.perks.includes("background.shipwright")) s.ship.hold.timber -= B.repairAtSea.timber;
        emit({ t, kind: "repair", ship: s.ship.id, hullPoints: s.ship.hullPoints });
        break;
      }
      case "lurk":
        break;
    }
    checkIslands(s, t);
  };

  // ---------- The clock ----------
  const lastTick = B.watches.cap;
  for (let t = 0; t <= lastTick; t++) {
    // 1. Lane crossings since the previous tick.
    const due = crossings.filter((c) => c.time <= t).sort((p, q) =>
      p.time - q.time || (p.a.ship.id < q.a.ship.id ? -1 : p.a.ship.id > q.a.ship.id ? 1 : p.b.ship.id < q.b.ship.id ? -1 : 1));
    for (const c of due) crossings.splice(crossings.indexOf(c), 1);
    for (const c of due) {
      if (c.a.action !== c.aAction || c.b.action !== c.bAction) continue; // one of them was stopped first
      const key = `${c.a.ship.id}|${c.b.ship.id}|${c.lane}`;
      if (!met.has(key)) { met.add(key); emit({ t: c.time, kind: "meet", a: c.a.ship.id, b: c.b.ship.id, at: c.lane, onLane: true }); }
      tryEncounter(c.a, c.b, c.lane, true, c.time);
    }

    // 2. Actions finishing now.
    for (const s of sims) if (!s.frozen) complete(s, t);

    // 3. Actions starting now.
    for (const s of sims) startNext(s, t);

    // 4. Meetings in waters at this tick.
    const byWater = new Map<WaterId, Sim[]>();
    for (const s of sims) {
      if (s.frozen) continue;
      const w = positionAt(s, t);
      if (!w) continue;
      const list = byWater.get(w) ?? [];
      list.push(s);
      byWater.set(w, list);
    }
    for (const water of [...byWater.keys()].sort()) {
      const here = byWater.get(water) as Sim[];
      for (let i = 0; i < here.length; i++) {
        for (let j = i + 1; j < here.length; j++) {
          const x = here[i] as Sim, y = here[j] as Sim;
          const key = `${x.ship.id}|${y.ship.id}|${water}`;
          if (!met.has(key)) { met.add(key); emit({ t, kind: "meet", a: x.ship.id, b: y.ship.id, at: water, onLane: false }); }
          if ((world.water[water] as MapWater).terrain === "harbour") continue; // no combat in a Harbour, ever
          tryEncounter(x, y, water, false, t);
        }
      }
    }
  }

  // ---------- End of Tide ----------
  // Losers of a Sunk or Captured battle are towed to a Harbour and docked, before supplies are counted (8.7).
  for (const id of [...toTow].sort()) {
    const ship = state.ships[id] as Ship;
    const captain = state.captains[ship.captainId] as Captain;
    const { from, to, banked } = towShip(world, state, ship, captain, winds);
    emit({ t: lastTick, kind: "towed", ship: id, from, to, hullPoints: ship.hullPoints, banked });
  }
  // Bounties shrink by a tenth each Tide. One added this Tide starts at full size (v0.2 9 rule 2).
  for (const id of Object.keys(state.captains).sort()) {
    const captain = state.captains[id] as Captain;
    const fresh = Math.min(freshBounties.get(id) ?? 0, captain.bounty);
    captain.bounty = Math.floor((captain.bounty - fresh) * B.fairness.bountyKeepPerTide) + fresh;
  }
  for (const s of sims) {
    const ship = s.ship;
    if (!ship.docked && !ship.statline) { // a monster lives off the sea and eats no Provisions
      const need = B.hulls[ship.hull].provisionsPerTide;
      const used = Math.min(need, ship.hold.provisions);
      ship.hold.provisions -= used;
      ship.shortRations = used < need;
      emit({ t: lastTick, kind: "supplies", ship: ship.id, provisionsUsed: used, provisionsLeft: ship.hold.provisions, shortRations: ship.shortRations });
    } else {
      ship.shortRations = false;
    }
    const orders = input.orders[s.captain.id];
    s.captain.queuedPlan = s.source === "orders" && orders?.planB ? { tide: tide + 1, plan: orders.planB } : null;
  }
  emit({ t: lastTick, kind: "tideEnd", tide });
  state.tide = tide + 1;

  return { state, replay, encounters };
}
