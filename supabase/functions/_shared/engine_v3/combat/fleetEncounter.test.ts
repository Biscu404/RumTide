import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { maxHands, maxHullPoints, maxRiggingPoints } from "../ship.ts";
import { resolveTide } from "../tide.ts";
import type { EncounterContext, EncounterResolver, EncounterSide } from "../tide.ts";
import { ScriptedRng } from "./testing.ts";
import { season, ship, world } from "../testing.ts";
import type { Orders, ReplayEvent, SeasonState, Ship } from "../types.ts";
import { applyBattle, battleShipOf, combatEncounter } from "./encounter.ts";
import { runBattle } from "./battle.ts";
import { describeBattle } from "./describe.ts";
import { doctrineChooser, templateDoctrine } from "./doctrine.ts";
import type { BattleAftermath, BattleRecord, BattleSide, OutcomeKind } from "./types.ts";
import type { Rng } from "../rng.ts";

const WEST_BREEZE = { cradle: { kind: "breeze" as const, from: 270 } };

// ---------- Fixtures ----------

/** Four captains in the same open water: h and m sail together in fleet f1, t and u in fleet f2. */
const captains4 = (water = "gh_lee") => [
  { id: "h", name: "Hester", shipName: "Hunter", water },
  { id: "m", name: "Mira", shipName: "Mate", water },
  { id: "t", name: "Tobias", shipName: "Target", water },
  { id: "u", name: "Ulla", shipName: "Under", water },
];

/** Puts h and m in fleet f1 and t and u in fleet f2, for whichever of them the state has. */
function fleets(state: SeasonState): SeasonState {
  for (const [id, fleet] of [["h", "f1"], ["m", "f1"], ["t", "f2"], ["u", "f2"]] as const) {
    if (state.captains[id]) state.captains[id].fleetId = fleet;
  }
  return state;
}

function boost(s: Ship, level: number): void {
  s.levels = { hull: level, cannons: level, sails: level, berths: level, hold: s.levels.hold };
  s.hullPoints = maxHullPoints(s);
  s.riggingPoints = maxRiggingPoints(s);
  s.hands = maxHands(s);
}

const side = (state: SeasonState, id: string, over: Partial<EncounterSide> = {}): EncounterSide => ({
  ship: ship(state, id), captain: state.captains[id]!, stance: "trade", doctrine: undefined, lurking: false,
  ambushRange: undefined, charted: true, withCurrent: false, ...over,
});

interface CtxOptions {
  hunterMates?: string[];
  targetMates?: string[];
  mutual?: boolean;
  rng?: Rng;
  seed?: number;
}

/** An encounter between Hunter (h) and Target (t), with the named fleet mates joined to each side. */
function ctxOf(state: SeasonState, o: CtxOptions = {}): EncounterContext {
  const joined = { hunter: (o.hunterMates ?? []).map((id) => side(state, id)), target: (o.targetMates ?? []).map((id) => side(state, id)) };
  return {
    world, state, tide: state.tide, seed: o.seed ?? 1234, t: 3, at: "gh_lee", onLane: false, archipelago: "cradle", terrain: "open",
    wind: { kind: "breeze", from: 270 },
    hunter: { ...side(state, "h"), filter: { kind: "anyone" } },
    target: side(state, "t"),
    mutual: o.mutual ?? false,
    ...(joined.hunter.length + joined.target.length > 0 ? { joined } : {}),
    rng: o.rng ?? new ScriptedRng(0.99),
  };
}

const battleIn = (events: ReplayEvent[] | undefined) =>
  (events ?? []).find((e): e is Extract<ReplayEvent, { kind: "battle" }> => e.kind === "battle");

const eventsOf = <K extends ReplayEvent["kind"]>(events: ReplayEvent[] | undefined, kind: K) =>
  (events ?? []).filter((e): e is Extract<ReplayEvent, { kind: K }> => e.kind === kind);

// ---------- The encounter ----------

describe("a fleet in an encounter (P2.5, v0.2 7.5)", () => {
  it("fights one battle with the mates on their sides, and freezes every ship in it", () => {
    const state = fleets(season(captains4(), 6));
    const out = combatEncounter(ctxOf(state, { hunterMates: ["m"], targetMates: ["u"], mutual: true }));
    const battle = battleIn(out.events)!;
    expect(battle.record.ships.map((s) => [s.shipId, s.side])).toEqual([
      ["ship_h", "hunter"], ["ship_m", "hunter"], ["ship_t", "target"], ["ship_u", "target"],
    ]);
    expect(battle.record.fleet!.sides).toEqual({ hunter: ["ship_h", "ship_m"], target: ["ship_t", "ship_u"] });
    expect([...out.freeze].sort()).toEqual(["ship_h", "ship_m", "ship_t", "ship_u"]);
  });

  it("is a one ship battle, with no fleet fields, when nobody joins", () => {
    const state = fleets(season(captains4(), 6));
    const battle = battleIn(combatEncounter(ctxOf(state, { mutual: true })).events)!;
    expect(battle.record.fleet).toBeUndefined();
    expect(battle.aftermath.fleet).toBeUndefined();
  });

  it("makes the highest rated ship the flagship, and the lead ship on a tie", () => {
    const tie = fleets(season(captains4(), 6));
    expect(battleIn(combatEncounter(ctxOf(tie, { hunterMates: ["m"], targetMates: ["u"], mutual: true })).events)!.record).toMatchObject({
      hunter: "ship_h", target: "ship_t",
    });
    const stronger = fleets(season(captains4(), 6));
    boost(ship(stronger, "m"), 4);
    boost(ship(stronger, "u"), 4);
    expect(battleIn(combatEncounter(ctxOf(stronger, { hunterMates: ["m"], targetMates: ["u"], mutual: true })).events)!.record).toMatchObject({
      hunter: "ship_m", target: "ship_u",
    });
  });

  it("gives every ship its own captain's doctrine", () => {
    const state = fleets(season(captains4(), 6));
    state.captains.m!.doctrines = [templateDoctrine("Runner")];
    state.captains.m!.defaultDoctrine = "Runner";
    state.captains.u!.doctrines = [templateDoctrine("Coward")];
    state.captains.u!.defaultDoctrine = "Coward";
    const battle = battleIn(combatEncounter(ctxOf(state, { hunterMates: ["m"], targetMates: ["u"], mutual: true })).events)!;
    expect(battle.record.fleet!.doctrines).toEqual({ ship_h: "Brawler", ship_m: "Runner", ship_t: "Brawler", ship_u: "Coward" });
  });

  it("lets a mate follow its own step or plan doctrine", () => {
    const state = fleets(season(captains4(), 6));
    state.captains.m!.doctrines = [templateDoctrine("Brawler"), templateDoctrine("Skirmisher")];
    const ctx = ctxOf(state, { hunterMates: ["m"], mutual: true });
    ctx.joined!.hunter[0]!.doctrine = "Skirmisher";
    const battle = battleIn(combatEncounter(ctx).events)!;
    expect(battle.record.fleet!.doctrines.ship_m).toBe("Skirmisher");
  });

  it("counts the whole side's strength in a parley offer", () => {
    const strongest = (mates: string[]) => {
      const state = fleets(season(captains4(), 6));
      state.captains.t!.parley = 1.25;
      ship(state, "t").plunder = 100;
      return combatEncounter(ctxOf(state, { hunterMates: mates }));
    };
    expect(eventsOf(strongest([]).events, "parley")).toEqual([]); // one sloop is not 25% stronger than one sloop
    const out = strongest(["m"]); // two sloops are twice as strong
    expect(out.result).toBe("tribute");
    expect(eventsOf(out.events, "parley")).toMatchObject([{ accepted: true, paid: { plunder: 10 } }]);
    expect(out.freeze).toEqual([]);
  });

  it("leaves the mates out of an escape, which is between the two leads", () => {
    const state = fleets(season(captains4(), 6));
    const out = combatEncounter(ctxOf(state, { hunterMates: ["m"], targetMates: ["u"], rng: new ScriptedRng(0.0) }));
    expect(out.result).toBe("escaped");
    expect(out.freeze).toEqual(["ship_h"]);
    expect(battleIn(out.events)).toBeUndefined();
  });

  it("ends the shield of a mate that joins a fight against a player", () => {
    const state = fleets(season(captains4(), 6));
    state.captains.m!.shieldUntilTide = 8;
    state.captains.u!.shieldUntilTide = 8;
    state.captains.t!.shieldUntilTide = 8;
    combatEncounter(ctxOf(state, { hunterMates: ["m"], targetMates: ["u"], mutual: false }));
    expect(state.captains.m!.shieldUntilTide).toBe(5);
    expect(state.captains.u!.shieldUntilTide).toBe(5);
    expect(state.captains.t!.shieldUntilTide).toBe(8); // the ship that was caught keeps its own shield
  });

  it("gives the lone ship of a two against one Desperate Defence and fights as players", () => {
    const state = fleets(season(captains4(), 6));
    const battle = battleIn(combatEncounter(ctxOf(state, { hunterMates: ["m"], mutual: true })).events)!;
    expect(battle.record.fleet!.bonus.target.desperate).toBeCloseTo(1.25, 10);
    expect(battle.record.fleet!.bonus.hunter.fleet).toBeCloseTo(1.1, 10);
  });

  it("gives an NPC lone ship no Desperate Defence", () => {
    const state = fleets(season([
      { id: "h", name: "Hester", shipName: "Hunter", water: "gh_lee" },
      { id: "m", name: "Mira", shipName: "Mate", water: "gh_lee" },
      { id: "t", name: "Tobias", shipName: "Target", water: "gh_lee", kind: "npc", npcRole: "merchant" },
    ], 6));
    const battle = battleIn(combatEncounter(ctxOf(state, { hunterMates: ["m"], mutual: true })).events)!;
    expect(battle.record.fleet!.bonus.target.desperate).toBe(1);
  });
});

// ---------- What a fleet battle does to the world ----------

describe("applying a fleet battle (P2.5, GAME_DESIGN 9 rule 4)", () => {
  /** A finished battle with its outcome and each ship's share of the damage set by hand. */
  function finished(
    state: SeasonState, hunters: string[], targets: string[], kind: OutcomeKind, winner: BattleSide | null,
    over: Partial<BattleRecord> = {}, dealtBy: Record<string, number> = {},
  ): BattleRecord {
    const mk = (ids: string[], role: BattleSide) => ids.map((id) => battleShipOf(ship(state, id), state.captains[id]!, role, { charted: true, withCurrent: false, lurker: false }));
    const [h, ...hm] = mk(hunters, "hunter");
    const [t, ...tm] = mk(targets, "target");
    const choose = doctrineChooser(templateDoctrine("Coward"), { enemyType: "player" });
    const base = runBattle({
      tide: state.tide, seed: 5, at: "gh_lee", terrain: "open", wind: "breeze", hunter: h!, target: t!,
      doctrines: { hunter: "x", target: "y" }, choosers: { hunter: choose, target: choose },
      mates: { hunter: hm.map((s) => ({ ship: s, doctrine: "x", chooser: choose })), target: tm.map((s) => ({ ship: s, doctrine: "y", chooser: choose })) },
      playerSide: { hunter: true, target: true },
    });
    const loser = winner === null ? null : winner === "hunter" ? "target" : "hunter";
    const equal = Object.fromEntries([...hunters, ...targets].map((id) => [`ship_${id}`, dealtBy[id] ?? 1]));
    return { ...base, outcome: { kind, winner, loser, round: 3 }, fleet: { ...base.fleet!, dealtBy: equal }, ...over };
  }

  const apply = (state: SeasonState, record: BattleRecord, hunters: string[], targets: string[], pr: [number, number], extra: object = {}) => {
    const pair = (ids: string[]) => ({ ship: ship(state, ids[0]!), captain: state.captains[ids[0]!]! });
    const mates = (ids: string[]) => ids.slice(1).map((id) => ({ ship: ship(state, id), captain: state.captains[id]! }));
    return applyBattle({
      state, record,
      ships: { hunter: pair(hunters).ship, target: pair(targets).ship },
      captains: { hunter: pair(hunters).captain, target: pair(targets).captain },
      mates: { hunter: mates(hunters), target: mates(targets) },
      powerRatings: { hunter: pr[0], target: pr[1] },
      mutual: false, inCradle: false, refusedParley: false, ...extra,
    });
  };

  const six = () => fleets(season([...captains4(), { id: "n", name: "Nora", shipName: "Nine", water: "gh_lee" }], 5));

  it("cuts a gang's loot by the fairness factor of the whole sides, splits it three ways and pays all three a bounty (9 rule 4)", () => {
    const state = six();
    for (const id of ["h", "m", "n"]) state.captains[id]!.fleetId = "f1";
    ship(state, "t").plunder = 400;
    const applied = apply(state, finished(state, ["h", "m", "n"], ["t"], "captured", "hunter"), ["h", "m", "n"], ["t"], [30, 10]);
    // (10 / 30) squared is under the floor of 0.25, so the 40% of a fair Capture becomes 10%: 40 doubloons.
    expect(applied.aftermath.loot).toMatchObject({ share: 0.4, fairness: 0.25 });
    expect(applied.aftermath.loot!.taken.plunder).toBe(40);
    const took = ["h", "m", "n"].map((id) => ship(state, id).plunder);
    expect(took.reduce((a, b) => a + b, 0)).toBe(40);
    for (const t of took) expect(t / 400).toBeGreaterThan(0.03); // "about 3%" each, instead of 40%
    for (const t of took) expect(t / 400).toBeLessThan(0.04);
    expect(ship(state, "t").plunder).toBe(360);
    // All three collect a bounty equal to what they took, for hunting a ship under two thirds of their strength.
    expect(applied.bounties.map((b) => b.captain)).toEqual(["h", "m", "n"]);
    expect(applied.bounties.map((b) => b.amount)).toEqual(took);
    expect(["h", "m", "n"].map((id) => state.captains[id]!.bounty)).toEqual(took);
    expect(applied.aftermath.bounty.added).toBe(40);
  });

  it("splits the loot by the damage each winner dealt", () => {
    const state = six();
    ship(state, "t").plunder = 400;
    const record = finished(state, ["h", "m"], ["t"], "captured", "hunter", {}, { h: 3, m: 1 });
    apply(state, record, ["h", "m"], ["t"], [20, 10]);
    // fairness (10/20)^2 = 0.25: the take is 40, three parts to one.
    expect(ship(state, "h").plunder).toBe(30);
    expect(ship(state, "m").plunder).toBe(10);
  });

  it("makes the losing ships pay together, each in proportion to what it carries", () => {
    const state = fleets(season(captains4(), 5));
    ship(state, "t").plunder = 300;
    ship(state, "u").plunder = 100;
    ship(state, "t").hold.rum = 6;
    const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], "captured", "hunter"), ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.aftermath.loot).toMatchObject({ fairness: 1 });
    expect(applied.aftermath.loot!.taken).toEqual({ plunder: 160, goods: { rum: 2 } }); // 40% of 400 doubloons and of 6 rum
    expect(ship(state, "t")).toMatchObject({ plunder: 180, hold: { rum: 4 } }); // gave up 40%: 120 and 2 rum
    expect(ship(state, "u").plunder).toBe(60); // gave up 40 of its 100
    expect(ship(state, "h").plunder + ship(state, "m").plunder).toBe(160);
    expect(applied.aftermath.fleet!.lost.ship_t).toEqual({ plunder: 120, goods: { rum: 2 } });
    expect(applied.aftermath.fleet!.lost.ship_u).toEqual({ plunder: 40, goods: {} });
  });

  it("tows every ship of a side that is Sunk or Captured, and none after a win on points", () => {
    for (const kind of ["sunk", "captured"] as const) {
      const state = fleets(season(captains4(), 5));
      const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], kind, "hunter"), ["h", "m"], ["t", "u"], [20, 20]);
      expect(applied.tow).toEqual(["ship_t", "ship_u"]);
      expect(applied.aftermath).toMatchObject({ towed: true, fleet: { towed: ["ship_t", "ship_u"] } });
    }
    const state = fleets(season(captains4(), 5));
    const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], "victory", "hunter"), ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.tow).toEqual([]);
  });

  it("shields every losing captain from players, and none of the winners", () => {
    const state = fleets(season(captains4(), 5));
    const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], "victory", "hunter"), ["h", "m"], ["t", "u"], [20, 20]);
    expect(state.captains.t!.shieldUntilTide).toBe(5 + B.shieldTidesAfterPvpLoss);
    expect(state.captains.u!.shieldUntilTide).toBe(5 + B.shieldTidesAfterPvpLoss);
    expect(state.captains.h!.shieldUntilTide).toBe(0);
    expect(applied.aftermath.shieldUntil).toBe(5 + B.shieldTidesAfterPvpLoss);
  });

  it("collects the bounties on the losing captains, split between the winners like the loot", () => {
    const state = fleets(season(captains4(), 5));
    state.captains.t!.bounty = 50;
    state.captains.u!.bounty = 30;
    const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], "victory", "hunter", {}, { h: 3, m: 1 }), ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.aftermath.bounty.collected).toBe(80);
    expect(ship(state, "h").plunder).toBe(60);
    expect(ship(state, "m").plunder).toBe(20);
    expect(state.captains.t!.bounty).toBe(0);
    expect(state.captains.u!.bounty).toBe(0);
  });

  it("puts a bounty only on the winners who took something, for hunting a weaker side or refusing parley", () => {
    const state = fleets(season(captains4(), 5));
    ship(state, "t").plunder = 100;
    const fair = apply(state, finished(state, ["h", "m"], ["t", "u"], "captured", "hunter"), ["h", "m"], ["t", "u"], [20, 20]);
    expect(fair.bounties).toEqual([]);
    const refused = fleets(season(captains4(), 5));
    ship(refused, "t").plunder = 100;
    const out = apply(refused, finished(refused, ["h", "m"], ["t", "u"], "captured", "hunter"), ["h", "m"], ["t", "u"], [20, 20], { refusedParley: true });
    expect(out.bounties.map((b) => b.captain)).toEqual(["h", "m"]);
    const defended = fleets(season(captains4(), 5));
    ship(defended, "t").plunder = 100;
    expect(apply(defended, finished(defended, ["h", "m"], ["t", "u"], "captured", "target"), ["h", "m"], ["t", "u"], [20, 40]).bounties).toEqual([]); // the hunters lost
  });

  it("leaves the rest of a Sunk fleet's cargo in one Wreck, named after the ship that went down", () => {
    const state = fleets(season(captains4(), 5));
    ship(state, "t").plunder = 200;
    ship(state, "u").plunder = 200;
    const record = finished(state, ["h", "m"], ["t", "u"], "sunk", "hunter");
    const sunk = record.final.find((s) => s.shipId === "ship_u")!;
    sunk.hullPoints = 0;
    const applied = apply(state, record, ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.aftermath.loot!.taken.plunder).toBe(100); // the winners grab 25% of 400
    expect(applied.aftermath.wreck).toMatchObject({ id: "wreck_t5_ship_u", plunder: 300, untilTide: 9 });
    expect(state.wrecks["wreck_t5_ship_u"]).toBeDefined();
    expect(ship(state, "t").plunder + ship(state, "u").plunder).toBe(0); // all of it left the losing ships
  });

  it("turns the cargo a ship threw overboard into Flotsam, ship by ship, before the winners can take it", () => {
    const state = fleets(season(captains4(), 5));
    ship(state, "u").hold.rum = 6;
    ship(state, "t").plunder = 100;
    const record = finished(state, ["h", "m"], ["t", "u"], "captured", "hunter");
    record.fleet!.jettisoned = ["ship_u"];
    const applied = apply(state, record, ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.aftermath.flotsam).toMatchObject([{ id: "flotsam_t5_ship_u", goods: { rum: 6 } }]);
    expect(ship(state, "u").hold.rum).toBe(0);
    expect(applied.aftermath.loot!.taken.goods).toEqual({}); // there was nothing left to take but doubloons
    expect(applied.aftermath.loot!.taken.plunder).toBe(40);
  });

  it("pays nothing and shields nobody for a Draw", () => {
    const state = fleets(season(captains4(), 5));
    ship(state, "t").plunder = 100;
    const applied = apply(state, finished(state, ["h", "m"], ["t", "u"], "draw", null), ["h", "m"], ["t", "u"], [20, 20]);
    expect(applied.aftermath).toMatchObject({ loot: null, winner: null, shieldUntil: null, towed: false });
    expect(applied.aftermath.fleet).toBeUndefined();
    expect(ship(state, "t").plunder).toBe(100);
  });

  it("copies the damage each ship took onto that ship", () => {
    const state = fleets(season(captains4(), 5));
    const record = finished(state, ["h", "m"], ["t", "u"], "draw", null);
    for (const s of record.final) s.hullPoints = s.shipId === "ship_m" ? 41 : 77;
    apply(state, record, ["h", "m"], ["t", "u"], [20, 20]);
    expect(ship(state, "m").hullPoints).toBe(41);
    expect(ship(state, "h").hullPoints).toBe(77);
    expect(ship(state, "u").hullPoints).toBe(77);
  });
});

// ---------- In a Tide ----------

describe("fleet mates in a Tide (P2.5, v0.2 7.5)", () => {
  const o = (steps: Orders["planA"]["steps"]): Orders => ({ tide: 6, planA: { steps } });
  const lurk = o([{ kind: "lurk", filter: { kind: "anyone" } }]);

  /** Resolves a Tide with a resolver that records what it was handed and freezes everyone it names. */
  function spy(state: SeasonState, orders: Record<string, Orders>) {
    const seen: EncounterContext[] = [];
    const resolver: EncounterResolver = (ctx) => {
      seen.push(ctx);
      return { result: "seen", freeze: [ctx.hunter.ship.id, ctx.target.ship.id, ...(ctx.joined?.hunter ?? []).map((s) => s.ship.id), ...(ctx.joined?.target ?? []).map((s) => s.ship.id)] };
    };
    const result = resolveTide({ state, world, orders, seed: 7, windOverride: WEST_BREEZE, resolveEncounter: resolver });
    return { seen, result };
  }

  it("joins a fleet mate in the same water who is hunting to its side, on both sides", () => {
    const { seen } = spy(fleets(season(captains4())), { h: lurk, m: lurk, t: lurk, u: lurk });
    expect(seen).toHaveLength(1);
    expect([seen[0]!.hunter.ship.id, seen[0]!.target.ship.id]).toEqual(["ship_h", "ship_t"]);
    expect(seen[0]!.joined!.hunter.map((s) => s.ship.id)).toEqual(["ship_m"]);
    expect(seen[0]!.joined!.target.map((s) => s.ship.id)).toEqual(["ship_u"]);
  });

  it("leaves a mate that is not hunting out, and a ship of another fleet, and a ship in another water", () => {
    const state = fleets(season(captains4()));
    state.captains.u!.fleetId = "f9";
    const resting = o([{ kind: "survey" }]);
    const { seen } = spy(state, { h: lurk, m: resting, t: lurk, u: lurk });
    expect(seen[0]!.joined).toBeUndefined();
    const apart = fleets(season([...captains4().slice(0, 1), { id: "m", name: "Mira", shipName: "Mate", water: "gh_reefside" }, ...captains4().slice(2, 3)]));
    expect(spy(apart, { h: lurk, m: lurk, t: lurk }).seen[0]!.joined).toBeUndefined();
  });

  it("never joins a captain without a fleet, or an NPC", () => {
    const state = season(captains4());
    const { seen } = spy(state, { h: lurk, m: lurk, t: lurk, u: lurk });
    expect(seen[0]!.joined).toBeUndefined();
  });

  it("has nobody join a meeting on a lane", () => {
    // Hunter and Target cross on the lane between Driftwood and Gullhaven Lee. Mate lurks in Driftwood, where Hunter set out.
    const state = fleets(season([
      { id: "h", name: "Hester", shipName: "Hunter", water: "dw_harbour" },
      { id: "m", name: "Mira", shipName: "Mate", water: "dw_harbour" },
      { id: "t", name: "Tobias", shipName: "Target", water: "gh_lee" },
    ]));
    state.captains.t!.fleetId = null;
    const hunt = (to: string) => o([{ kind: "sail", to, stance: "hunt", filter: { kind: "anyone" } }]);
    const { seen } = spy(state, { h: hunt("gh_lee"), m: lurk, t: hunt("dw_harbour") });
    const lane = seen.find((c) => c.onLane);
    expect(lane).toBeDefined();
    expect(lane!.joined).toBeUndefined();
  });

  it("settles the whole meeting when the leads part without a battle: the mates start no second one", () => {
    const state = fleets(season(captains4().slice(0, 3)));
    const calls: string[] = [];
    const parts: EncounterResolver = (ctx) => {
      calls.push(`${ctx.hunter.ship.id} catches ${ctx.target.ship.id}`);
      return { result: "escaped", freeze: [ctx.hunter.ship.id] }; // the target slips away; only the lead hunter stops
    };
    resolveTide({
      state, world, orders: { h: lurk, m: lurk, t: o([{ kind: "survey" }]) }, seed: 7, windOverride: WEST_BREEZE, resolveEncounter: parts,
    });
    expect(calls).toEqual(["ship_h catches ship_t"]); // ship_m hunts ship_t too, but the meeting is over
  });

  it("plays one battle for the four ships, freezes them all, and tows the beaten fleet", () => {
    const state = fleets(season(captains4()));
    for (const id of ["t", "u"]) ship(state, id).plunder = 80;
    const r = resolveTide({
      state, world, orders: { h: lurk, m: lurk, t: lurk, u: lurk }, seed: 7, windOverride: WEST_BREEZE, resolveEncounter: combatEncounter,
    });
    expect(r.encounters).toHaveLength(1);
    const battles = r.replay.filter((e): e is Extract<ReplayEvent, { kind: "battle" }> => e.kind === "battle");
    expect(battles).toHaveLength(1);
    expect(battles[0]!.record.ships).toHaveLength(4);
    const towed = r.replay.filter((e) => e.kind === "towed").map((e) => (e.kind === "towed" ? e.ship : ""));
    if (battles[0]!.aftermath.towed) {
      const losers = battles[0]!.aftermath.fleet!.losers;
      expect([...towed].sort()).toEqual([...losers].sort());
      for (const id of losers) expect(r.state.ships[id]!.docked).toBe(true);
    }
  });

  it("does not change the state it was given", () => {
    const state = fleets(season(captains4()));
    const before = JSON.stringify(state);
    resolveTide({ state, world, orders: { h: lurk, m: lurk, t: lurk, u: lurk }, seed: 7, windOverride: WEST_BREEZE });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("gives the same Tide twice for the same state and seed", () => {
    const run = () => resolveTide({ state: fleets(season(captains4())), world, orders: { h: lurk, m: lurk, t: lurk, u: lurk }, seed: 7, windOverride: WEST_BREEZE });
    expect(JSON.stringify(run().replay)).toBe(JSON.stringify(run().replay));
  });
});

// ---------- In words ----------

describe("a fleet battle in words (P2.5)", () => {
  const record = () => {
    const state = fleets(season(captains4(), 6));
    return combatEncounter(ctxOf(state, { hunterMates: ["m"], mutual: true }));
  };
  const words = { place: (id: string) => `<${id}>` };
  const none: BattleAftermath = {
    pvp: true, winner: null, loser: null, loot: null, wreck: null, flotsam: [], bounty: { added: 0, collected: 0 }, shieldUntil: null, towed: false,
  };

  it("names every ship with its doctrine, and says what the fleet bonus and Desperate Defence are worth", () => {
    const battle = battleIn(record().events)!;
    const lines = describeBattle(battle.record, none, words);
    expect(lines[0]).toContain("BATTLE at <gh_lee>: Hunter (Brawler) and Mate (Brawler) against Target (Brawler).");
    expect(lines).toContain("  The fleet of Hunter and Mate deals 10% more damage (fleet bonus 10%).");
    expect(lines).toContain("  Target deals 25% more damage (Desperate Defence 25%).");
  });

  it("tells every ship's play, and how the fire on a fleet was shared out", () => {
    const battle = battleIn(record().events)!;
    const text = describeBattle(battle.record, none, words).join("\n");
    expect(text).toMatch(/Round 1, at Long range\./);
    expect(text).toMatch(/ {4}Mate plays Close In and /);
    expect(text).toMatch(/The fire on the fleet of Hunter and Mate is shared out by max Hull: Hunter loses \d+ \w+; Mate loses \d+ \w+\./);
  });

  it("names the fleet that wins, and what each winner got", () => {
    const state = fleets(season(captains4(), 6));
    ship(state, "t").plunder = 200;
    const out = combatEncounter(ctxOf(state, { hunterMates: ["m"], targetMates: ["u"], mutual: true }));
    const battle = battleIn(out.events)!;
    const lines = describeBattle(battle.record, battle.aftermath, words);
    const text = lines.join("\n");
    if (battle.record.outcome.winner === "hunter") expect(text).toMatch(/the fleet of Hunter and Mate wins|the fleet of Hunter and Mate finds nothing|wins the boarding/);
    expect(text).toMatch(/Round \d/);
    if (battle.aftermath.loot && battle.aftermath.fleet) expect(text).toMatch(/The winning side takes/);
  });
});
