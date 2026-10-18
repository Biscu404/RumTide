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
}

export interface EncounterContext {
  world: World;
  tide: number;
  t: number;
  at: string; // a water id, or a lane id when onLane
  onLane: boolean;
  terrain: Terrain | null; // the water's terrain; null on a lane
  hunter: EncounterSide & { filter: HuntFilter };
  target: EncounterSide;
  mutual: boolean; // both were hunting each other
  rng: Rng;
}

export interface EncounterOutcome {
  result: string; // shown in the replay, e.g. "battlePending", "escaped", "parley", "sunk"
  freeze: ShipId[]; // ships that stop moving for the rest of the Tide
  events?: ReplayEvent[];
}

export type EncounterResolver = (ctx: EncounterContext) => EncounterOutcome;

/** Phase 1 stand in until combat exists (P2.4): every encounter freezes both ships. */
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
  | { kind: "lurk"; start: number; end: number; filter: HuntFilter };

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
  const resolver = input.resolveEncounter ?? stubEncounter;
  const winds = windsFor(world, state.seed, tide, input.windOverride);
  const replay: ReplayEvent[] = [];
  const encounters: EncounterRecord[] = [];
  const emit = (e: ReplayEvent) => replay.push(e);

  emit({ t: 0, kind: "tideStart", tide, winds });

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

  const tryEncounter = (x: Sim, y: Sim, place: string, onLane: boolean, t: number) => {
    if (x.frozen || y.frozen) return;
    const fx = huntingFilter(x, t), fy = huntingFilter(y, t);
    const xHunts = !!fx && matches(fx, y) && !isProtected(y, x, place, onLane);
    const yHunts = !!fy && matches(fy, x) && !isProtected(x, y, place, onLane);
    if (!xHunts && !yHunts) return;
    const mutual = xHunts && yHunts;
    const hunter = mutual ? (x.ship.id < y.ship.id ? x : y) : xHunts ? x : y;
    const target = hunter === x ? y : x;
    const filter = (hunter === x ? fx : fy) as HuntFilter;
    const terrain = onLane ? null : (world.water[place] as MapWater).terrain;
    const outcome = resolver({
      world, tide, t, at: place, onLane, terrain, mutual,
      hunter: { ship: hunter.ship, captain: hunter.captain, stance: hunter.action?.kind === "lurk" ? "hunt" : hunter.stance, filter },
      target: { ship: target.ship, captain: target.captain, stance: target.stance },
      rng: rngFor(input.seed, "encounter", hunter.ship.id, target.ship.id, t),
    });
    const rec: EncounterRecord = { t, at: place, onLane, hunter: hunter.ship.id, target: target.ship.id, result: outcome.result };
    encounters.push(rec);
    emit({ kind: "encounter", ...rec });
    for (const e of outcome.events ?? []) emit(e);
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
          s.action = { kind: "lurk", start: t, end: Number.POSITIVE_INFINITY, filter: step.filter };
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
          if (s.stance === "hunt") { s.huntTick = t; s.huntTickFilter = s.filter; }
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
  for (const s of sims) {
    const ship = s.ship;
    if (!ship.docked) {
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
