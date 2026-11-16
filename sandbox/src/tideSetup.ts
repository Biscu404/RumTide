// The sandbox Tide (docs/briefs/sandbox.md, stage 2): one Tide in the Cradle on the real engine_v3, with you and four bot captains.
// Nothing here has a rule of its own. It builds a season with newSeason, picks each bot's orders from a short list, runs
// resolveTide, and reads the replay back. The planner's Watch counts are the captain's own estimates (findRoute, estimateHop).

import cradleRaw from "../../supabase/functions/_shared/maps/cradle.json";
import {
  B, LEVEL, estimateHop, findRoute, hash32, levelOf, loadMap, maxHullPoints, newSeason, resolveTide, rngFor, stepSlots, validatePlan,
  watchesFor, windsFor,
} from "../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  Captain, FightingStyle, MapWater, NewCaptainSpec, Orders, ReplayEvent, SeasonState, Ship, ShipId, SkipReason, Step, TideResult,
  VoyagePlan, WaterId, Wind,
} from "../../supabase/functions/_shared/engine_v3/index.ts";

export const world = loadMap(cradleRaw);

/** The Tide the sandbox plays. The Cradle Truce is over (it ends at Tide 5), so captains may hunt each other. */
export const TIDE = 6;
export const YOU = "cap_you";
export const YOUR_SHIP = `ship_${YOU}`;
export const YOUR_SHIP_NAME = "Your Sloop";
export const LAST_WATCH = B.watches.cap;

// ---------- The other captains ----------

export interface Bot {
  spec: NewCaptainSpec;
  about: string; // what the planner tells you about this captain, never the plan itself
  plunder?: number;
  cargo?: Partial<Record<"rum" | "sugar" | "timber" | "spice", number>>;
  plans: VoyagePlan[]; // the seed picks one
}

export const BOTS: readonly Bot[] = [
  {
    spec: { id: "cap_anna", name: "Anna", shipName: "Salty Gull", style: "rammer", water: "gh_lee" },
    about: "A hunter. She is out looking for a fight.",
    plans: [
      { steps: [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" } }] },
      { steps: [{ kind: "sail", to: "gh_reefside", stance: "hunt", filter: { kind: "carryingCargo" } }, { kind: "lurk", filter: { kind: "anyone" } }] },
      { steps: [{ kind: "sail", to: "tp_channel", stance: "hunt", filter: { kind: "players" } }] },
    ],
  },
  {
    spec: { id: "cap_bogdan", name: "Bogdan", shipName: "Wet Sock", style: "gunline", water: "dw_harbour" },
    about: "A trader with rum in the hold. He wants to reach a Harbour and sell.",
    cargo: { rum: 3 },
    plans: [
      { steps: [{ kind: "sail", to: "gh_harbour" }, { kind: "dock" }] },
      { steps: [{ kind: "sail", to: "tp_harbour", stance: "quiet" }, { kind: "dock" }] },
    ],
  },
  {
    spec: { id: "cap_dragos", name: "Dragos", shipName: "Black Gannet", style: "boarder", water: "gh_reefside" },
    about: "An ambusher with 100 doubloons aboard. He likes to lie in wait.",
    plunder: 100,
    cargo: { rum: 2 },
    plans: [
      { steps: [{ kind: "lurk", filter: { kind: "players" } }] },
      { steps: [{ kind: "sail", to: "gh_lee", stance: "quiet" }, { kind: "lurk", filter: { kind: "anyone" } }] },
      { steps: [{ kind: "sail", to: "tp_channel", stance: "quiet" }, { kind: "lurk", filter: { kind: "carryingCargo" } }] },
    ],
  },
  {
    spec: { id: "cap_biscuit", name: "Old Biscuit", shipName: "Old Biscuit", kind: "npc", npcRole: "merchant", water: "dw_shallows" },
    about: "A slow merchant, heavy with sugar and 30 doubloons. Not a fighter.",
    plunder: 30,
    cargo: { sugar: 4 },
    plans: [
      { steps: [{ kind: "sail", to: "gh_harbour" }, { kind: "dock" }] },
      { steps: [{ kind: "sail", to: "dw_harbour" }, { kind: "dock" }] },
    ],
  },
];

// ---------- Building the Tide ----------

export interface TideSetup {
  seed: number;
  style: FightingStyle;
  state: SeasonState; // the sea before the Tide; never changed
  winds: Record<string, Wind>;
  botOrders: Record<string, Orders>;
}

/** The sea before the Tide: you docked in Gullhaven Harbour and the four bots where they start. The same style and seed give the same sea. */
export function newTide(style: FightingStyle, seed: number): TideSetup {
  const clean = seed >>> 0;
  const state = newSeason({
    seasonId: "sandbox", preset: "season0", seed: clean, world, bosses: false,
    captains: [{ id: YOU, name: "You", shipName: YOUR_SHIP_NAME, style }, ...BOTS.map((b) => b.spec)],
  });
  state.tide = TIDE;
  const botOrders: Record<string, Orders> = {};
  for (const bot of BOTS) {
    const ship = state.ships[`ship_${bot.spec.id}`] as Ship;
    ship.plunder = bot.plunder ?? 0;
    for (const [good, units] of Object.entries(bot.cargo ?? {})) ship.hold[good as "rum"] = units;
    botOrders[bot.spec.id] = { tide: TIDE, planA: rngFor(clean, "sandbox", "botPlan", bot.spec.id).pick(bot.plans) };
  }
  return { seed: clean, style, state, winds: windsFor(world, clean, TIDE), botOrders };
}

export const you = (state: SeasonState): Captain => state.captains[YOU] as Captain;
export const yourShip = (state: SeasonState): Ship => state.ships[YOUR_SHIP] as Ship;

/** The seed of the Tide itself, apart from the season seed that makes the wind. */
export const tideSeed = (seed: number): number => hash32(`sandbox/${seed >>> 0}/tide/${TIDE}`);

/** What the engine would say is wrong with your plan. Empty means it is fine. */
export const planProblems = (setup: TideSetup, plan: VoyagePlan): string[] => validatePlan(world, you(setup.state), plan);

/** Runs the Tide: your plan and the bots' orders through resolveTide, battles and all. */
export function runTide(setup: TideSetup, plan: VoyagePlan): TideResult {
  const orders: Record<string, Orders> = { ...setup.botOrders, [YOU]: { tide: TIDE, planA: plan } };
  return resolveTide({ state: setup.state, world, orders, seed: tideSeed(setup.seed) });
}

// ---------- What the planner may offer ----------

export const stepsAllowed = (setup: TideSetup): number => stepSlots(you(setup.state));
export const watchesAllowed = (setup: TideSetup): number => watchesFor(yourShip(setup.state), you(setup.state)).total;

/** Waters on a captain's chart (at least Rumoured), in map order. */
export const knownWaters = (captain: Captain): MapWater[] =>
  world.map.waters.filter((w) => levelOf(captain.knowledge, w.id) >= LEVEL.rumoured);

/** Sites a captain knows well enough to land at (at least Sketched), in map order. */
export const knownSites = (captain: Captain) => world.map.sites.filter((s) => levelOf(captain.knowledge, s.id) >= LEVEL.sketched);

// ---------- The planner's estimate ----------

export type Problem = SkipReason | "outOfWatches" | "notReached";

export interface StepEstimate {
  watches: number; // Watches this step is expected to take
  guess: boolean; // part of the number is a guess, because the chart has a gap
  problem: Problem | null; // why the step will not happen as written
  path: WaterId[]; // for a Sail step, the waters it passes, from where it starts
  stopsAt: WaterId | null; // only when a voyage runs out of Watches part way
}

export interface PlanEstimate {
  steps: StepEstimate[];
  used: number;
  total: number;
  endsAt: WaterId;
}

/**
 * What your plan should cost, as your captain would work it out from the chart before the Tide: the same route and hop
 * estimates the engine plans with, and the engine's own action costs. The real Tide can differ where the chart has gaps.
 */
export function estimatePlan(setup: TideSetup, plan: VoyagePlan): PlanEstimate {
  const captain = you(setup.state);
  const ship = yourShip(setup.state);
  const total = watchesAllowed(setup);
  let at = ship.waterId, docked = ship.docked, used = 0, over = false;
  const steps = plan.steps.map((step: Step): StepEstimate => {
    const out: StepEstimate = { watches: 0, guess: false, problem: null, path: [], stopsAt: null };
    const fail = (problem: Problem): StepEstimate => ({ ...out, problem });
    const timed = (cost: number): StepEstimate => {
      if (used + cost > total) { over = true; return fail("outOfWatches"); }
      used += cost;
      return { ...out, watches: cost };
    };
    if (over) return fail("notReached");
    const water = world.water[at] as MapWater;
    switch (step.kind) {
      case "sail": {
        if (step.to === at) return fail("alreadyThere");
        const route = findRoute(world, captain.knowledge, at, step.to, ship.hull, setup.winds);
        if (!route) return fail("noKnownRoute");
        out.path = [at];
        for (let i = 0; i < route.lanes.length; i++) {
          const hop = estimateHop(world, captain.knowledge, route.lanes[i] as string, route.waters[i] as string, ship.hull, setup.winds);
          if (used + hop.total > total) { over = true; return { ...out, problem: "outOfWatches", stopsAt: at }; }
          used += hop.total;
          out.watches += hop.total;
          out.guess = out.guess || hop.estimated;
          at = route.waters[i + 1] as string;
          docked = false;
          out.path.push(at);
        }
        return out;
      }
      case "survey": return timed(B.actions.survey);
      case "land": {
        const site = world.site[step.site];
        if (!site) return fail("invalid");
        if (site.island !== water.island) return fail("siteNotHere");
        return timed(B.actions.land);
      }
      case "dock": {
        if (water.terrain !== "harbour") return fail("notAHarbour");
        if (docked) return fail("alreadyThere");
        const res = timed(B.actions.dock);
        if (!res.problem) docked = true;
        return res;
      }
      case "repair": {
        if (ship.hullPoints >= maxHullPoints(ship)) return fail("nothingToRepair");
        if (ship.hold.timber < B.repairAtSea.timber) return fail("noTimber");
        const res = timed(B.actions.repair);
        if (!res.problem) docked = false; // a repair at sea casts off
        return res;
      }
      case "lurk": {
        const left = total - used;
        over = true; // lying in wait takes every Watch that is left, so nothing after it happens
        if (left < B.actions.lurkMin) return fail("outOfWatches");
        used = total;
        return { ...out, watches: left };
      }
    }
  });
  return { steps, used, total, endsAt: at };
}

// ---------- Reading the replay ----------

/** The step of the clock an event belongs to: ships that pass on a lane between two Watches show with the later one. */
export const watchOf = (e: ReplayEvent): number => Math.ceil(e.t);

export interface Spot {
  x: number;
  y: number;
  water: WaterId | null; // null while the ship is between two waters
}

const spotOf = (water: WaterId): Spot => {
  const w = world.water[water] as MapWater;
  return { x: w.x, y: w.y, water };
};

/**
 * Where every ship is when `watch` Watches have passed, read from the replay. A ship part way along a lane sits part way
 * between its two waters. At the last Watch the answer is the sea after the Tide, towing included.
 */
export function spotsAt(before: SeasonState, result: TideResult, watch: number): Record<ShipId, Spot> {
  const out: Record<ShipId, Spot> = {};
  for (const id of Object.keys(before.ships).sort()) {
    if (watch >= LAST_WATCH) { out[id] = spotOf((result.state.ships[id] as Ship).waterId); continue; }
    let spot = spotOf((before.ships[id] as Ship).waterId);
    for (const e of result.replay) {
      if (e.kind !== "hop" || e.ship !== id || e.t > watch) continue;
      const arrived = result.replay.some((a) => a.kind === "arrive" && a.ship === id && a.t === e.ends && a.water === e.to);
      // A ship caught in a fight on the way gives the hop up and stays in the water it left (tide.ts, freeze).
      const caught = arrived ? undefined : result.replay.find((c) => c.kind === "encounter" && (c.hunter === id || c.target === id) && c.t >= e.t && c.t <= e.ends);
      if (arrived && watch >= e.ends) spot = spotOf(e.to);
      else if (caught && watch >= caught.t) spot = spotOf(e.from);
      else if (watch > e.t) {
        const a = spotOf(e.from), b = spotOf(e.to), share = (watch - e.t) / (e.ends - e.t);
        spot = { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share, water: null };
      } else spot = spotOf(e.from);
    }
    out[id] = spot;
  }
  return out;
}

/** True when the event is about this ship. Events about the whole Tide count for every ship. */
export function involves(e: ReplayEvent, ship: ShipId, captain: string): boolean {
  switch (e.kind) {
    case "tideStart": case "tideEnd": return true;
    case "meet": return e.a === ship || e.b === ship;
    case "encounter": case "parley": case "escape": return e.hunter === ship || e.target === ship;
    case "battle": return e.record.ships.some((s) => s.shipId === ship);
    case "islandCharted": return e.captain === captain;
    default: return e.ship === ship;
  }
}
