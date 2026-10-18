import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { canonicalJson } from "../replay.ts";
import { emptyKnowledge } from "../knowledge.ts";
import { maxHands, maxHullPoints, maxRiggingPoints } from "../ship.ts";
import { loadMap } from "../map.ts";
import { resolveTide } from "../tide.ts";
import type { EncounterContext, EncounterResolver, EncounterSide } from "../tide.ts";
import { rawCradle, season, ship, world } from "../testing.ts";
import type { Orders, ReplayEvent, SeasonState, Ship, Terrain, WindKind } from "../types.ts";
import { runBattle } from "./battle.ts";
import {
  applyBattle, battleShipOf, combatEncounter, enemyTypeOf, escapeChance, parleyResult, towShip,
} from "./encounter.ts";
import type { ApplyBattleInput } from "./encounter.ts";
import { findDoctrine, pickDoctrine, templateDoctrine, templateDoctrines } from "./doctrine.ts";
import type { BattleRecord, BattleSide, OutcomeKind } from "./types.ts";
import { ScriptedRng, always, battleOf, testShip } from "./testing.ts";
import type { Rng } from "../rng.ts";

const WEST_BREEZE = { cradle: { kind: "breeze" as const, from: 270 } };

// ---------- Fixtures ----------

const captains2 = (water = "gh_lee") => [
  { id: "h", name: "Hester", shipName: "Hunter", water },
  { id: "t", name: "Tobias", shipName: "Target", water },
];

/** All the upgrade levels set to `level`, and the ship repaired to its new maximum. */
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
  state?: SeasonState;
  hunter?: Partial<EncounterSide>;
  target?: Partial<EncounterSide>;
  mutual?: boolean;
  terrain?: Terrain | null;
  wind?: WindKind;
  rng?: Rng;
  tide?: number;
  seed?: number;
}

/** An encounter between Hunter (h) and Target (t) in an open water of the Cradle, with a scripted escape roll. */
function ctxOf(o: CtxOptions = {}): EncounterContext {
  const state = o.state ?? season(captains2(), o.tide ?? 6);
  return {
    world, state, tide: state.tide, seed: o.seed ?? 1234, t: 3, at: "gh_lee", onLane: false, archipelago: "cradle",
    terrain: o.terrain === undefined ? "open" : o.terrain,
    wind: { kind: o.wind ?? "breeze", from: o.wind === "calm" ? 0 : 270 },
    hunter: { ...side(state, "h", o.hunter), filter: { kind: "anyone" } },
    target: side(state, "t", o.target),
    mutual: o.mutual ?? false,
    rng: o.rng ?? new ScriptedRng(0.99),
  };
}

const battleOfCtx = (events: ReplayEvent[] | undefined) =>
  (events ?? []).find((e): e is Extract<ReplayEvent, { kind: "battle" }> => e.kind === "battle");

const eventsOf = <K extends ReplayEvent["kind"]>(events: ReplayEvent[] | undefined, kind: K) =>
  (events ?? []).filter((e): e is Extract<ReplayEvent, { kind: K }> => e.kind === kind);

// ---------- The escape roll ----------

describe("escape chance (v0.2 4.4 rule 5, P2.4)", () => {
  it("is the target's share of the Sails of both ships", () => {
    expect(escapeChance(10, 10, false, false)).toBeCloseTo(0.5, 10);
    expect(escapeChance(10, 30, false, false)).toBeCloseTo(0.25, 10);
    expect(escapeChance(30, 10, false, false)).toBe(B.escape.max); // 0.75 before the clamp is not above it
  });

  it("is 1.3 times higher for a Quiet stance and 0.2 higher in Fog", () => {
    expect(escapeChance(10, 20, true, false)).toBeCloseTo((10 / 30) * 1.3, 10);
    expect(escapeChance(10, 20, false, true)).toBeCloseTo(10 / 30 + 0.2, 10);
    expect(escapeChance(10, 20, true, true)).toBeCloseTo((10 / 30) * 1.3 + 0.2, 10);
  });

  it("stays between 0.05 and 0.75", () => {
    expect(escapeChance(1, 100, false, false)).toBe(B.escape.min);
    expect(escapeChance(100, 1, true, true)).toBe(B.escape.max);
  });
});

// ---------- Parley ----------

describe("parley (v0.2 7.6, P2.4)", () => {
  const caps = (parley: "off" | 1.25 | 1.5, noQuarter = false) => ({ target: { parley }, hunter: { noQuarter } });

  it("needs a threshold and a hunter at least that many times as strong", () => {
    expect(parleyResult(caps("off").target, caps("off").hunter, 10, 100).kind).toBe("none");
    expect(parleyResult(caps(1.25).target, caps(1.25).hunter, 10, 12.4).kind).toBe("none");
    expect(parleyResult(caps(1.25).target, caps(1.25).hunter, 10, 12.5).kind).toBe("tribute"); // exactly at the threshold counts
    expect(parleyResult(caps(1.5).target, caps(1.5).hunter, 10, 14.9).kind).toBe("none");
    expect(parleyResult(caps(1.5).target, caps(1.5).hunter, 10, 15).kind).toBe("tribute");
  });

  it("asks for a tenth, or is refused by a hunter who flies No Quarter", () => {
    expect(parleyResult(caps(1.25).target, caps(1.25).hunter, 10, 20)).toEqual({ kind: "tribute", threshold: 1.25, fraction: B.parley.tribute });
    expect(parleyResult(caps(1.25).target, caps(1.25, true).hunter, 10, 20)).toEqual({ kind: "refused", threshold: 1.25 });
  });

  it("ignores a threshold that is not one of the two", () => {
    expect(parleyResult({ parley: 0.5 as never }, { noQuarter: false }, 10, 100).kind).toBe("none");
  });

  it("lets the target pay a tenth of its plunder and cargo and sail on, with no escape roll and no battle", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5);
    state.captains.t!.parley = 1.25;
    ship(state, "t").plunder = 100;
    ship(state, "t").hold.rum = 10;
    ship(state, "t").hold.provisions = 4;
    const out = combatEncounter(ctxOf({ state }));
    expect(out.result).toBe("tribute");
    expect(out.freeze).toEqual([]);
    expect(eventsOf(out.events, "parley")).toMatchObject([{ accepted: true, threshold: 1.25, paid: { plunder: 10, goods: { rum: 1 } } }]);
    expect(eventsOf(out.events, "escape")).toEqual([]);
    expect(battleOfCtx(out.events)).toBeUndefined();
    expect(ship(state, "t")).toMatchObject({ plunder: 90, hold: { rum: 9, provisions: 4 } });
    expect(ship(state, "h")).toMatchObject({ plunder: 10, hold: { rum: 1 } });
  });

  it("is refused by No Quarter, and the fight goes on", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5);
    state.captains.t!.parley = 1.25;
    state.captains.h!.noQuarter = true;
    ship(state, "t").plunder = 100;
    const out = combatEncounter(ctxOf({ state }));
    expect(eventsOf(out.events, "parley")).toMatchObject([{ accepted: false, paid: { plunder: 0, goods: {} } }]);
    expect(eventsOf(out.events, "escape")).toHaveLength(1); // the target still tries to slip away
    expect(battleOfCtx(out.events)).toBeDefined();
    expect(out.freeze.sort()).toEqual(["ship_h", "ship_t"]);
  });

  it("puts a bounty on a No Quarter hunter who beats the player who offered it (v0.2 9 rule 2)", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5);
    state.captains.t!.parley = 1.25;
    state.captains.h!.noQuarter = true;
    ship(state, "t").plunder = 400;
    ship(state, "t").hullPoints = 6; // one broadside sinks it
    const out = combatEncounter(ctxOf({ state }));
    const battle = battleOfCtx(out.events)!;
    expect(battle.record.outcome).toMatchObject({ kind: "sunk", winner: "hunter" });
    expect(battle.aftermath.bounty.added).toBeGreaterThan(0);
    expect(state.captains.h!.bounty).toBe(battle.aftermath.bounty.added);
    expect(out.bounties).toEqual([{ captain: "h", amount: battle.aftermath.bounty.added }]);
  });

  it("does not happen in a mutual encounter, where both ships chose the fight", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5);
    state.captains.t!.parley = 1.25;
    const out = combatEncounter(ctxOf({ state, mutual: true }));
    expect(eventsOf(out.events, "parley")).toEqual([]);
    expect(eventsOf(out.events, "escape")).toEqual([]);
    expect(battleOfCtx(out.events)).toBeDefined();
  });
});

// ---------- The escape roll in an encounter ----------

describe("the escape roll in an encounter (P2.4)", () => {
  it("lets the target slip away and freezes only the hunter", () => {
    const state = season(captains2(), 6);
    const out = combatEncounter(ctxOf({ state, rng: new ScriptedRng(0.0) }));
    expect(out.result).toBe("escaped");
    expect(out.freeze).toEqual(["ship_h"]);
    expect(eventsOf(out.events, "escape")).toMatchObject([{ chance: 0.5, roll: 0, escaped: true }]);
    expect(battleOfCtx(out.events)).toBeUndefined();
    expect(ship(state, "t").hullPoints).toBe(100);
  });

  it("fights when the roll fails", () => {
    const out = combatEncounter(ctxOf({ rng: new ScriptedRng(0.99) }));
    expect(eventsOf(out.events, "escape")).toMatchObject([{ escaped: false }]);
    expect(battleOfCtx(out.events)).toBeDefined();
    expect(out.freeze.sort()).toEqual(["ship_h", "ship_t"]);
  });

  it("has no roll when both ships were hunting each other", () => {
    const out = combatEncounter(ctxOf({ mutual: true, rng: new ScriptedRng(0.0) }));
    expect(eventsOf(out.events, "escape")).toEqual([]);
    expect(battleOfCtx(out.events)).toBeDefined();
  });

  it("helps a Quiet target and a target in Fog", () => {
    const quiet = combatEncounter(ctxOf({ target: { stance: "quiet" }, rng: new ScriptedRng(0.99) }));
    expect(eventsOf(quiet.events, "escape")[0]!.chance).toBeCloseTo(0.65, 10);
    const fog = combatEncounter(ctxOf({ terrain: "fog", rng: new ScriptedRng(0.99) }));
    expect(eventsOf(fog.events, "escape")[0]!.chance).toBeCloseTo(0.7, 10);
  });

  it("draws the roll from its own stream, so a different hunter Sails changes only the chance", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5); // Sails 16 against 10
    const out = combatEncounter(ctxOf({ state, rng: new ScriptedRng(0.99) }));
    expect(eventsOf(out.events, "escape")[0]!.chance).toBeCloseTo(10 / 26, 10);
  });
});

// ---------- Starting range and the wind gauge ----------

describe("starting range and wind gauge (8.1, P2.4)", () => {
  const record = (o: CtxOptions) => battleOfCtx(combatEncounter(ctxOf({ mutual: true, ...o })).events)!.record;

  it("starts at Long, Medium in Fog", () => {
    expect(record({}).startRange).toBe("long");
    expect(record({ terrain: "fog" }).startRange).toBe("medium");
  });

  it("lets a Lurker who springs an ambush start at Medium unless it chose Long", () => {
    expect(record({ hunter: { lurking: true } }).startRange).toBe("medium");
    expect(record({ hunter: { lurking: true, ambushRange: "long" } }).startRange).toBe("long");
    expect(record({ hunter: { lurking: true, ambushRange: "medium" } }).startRange).toBe("medium");
    expect(record({ hunter: { lurking: true, ambushRange: "long" }, terrain: "fog" }).startRange).toBe("long");
  });

  it("gives the gauge to the higher Helm score, and a Lurker gets 20% on the check", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "t"), 2); // Sails 12.4 against 10
    expect(record({ state }).gauge).toBe("target");
    const lurk = record({ state, hunter: { lurking: true } }); // 10 x 1.2 = 12 against 12.4: still the target
    expect(lurk.gauge).toBe("target");
    const state2 = season(captains2(), 6);
    boost(ship(state2, "t"), 1); // 11.2 against 10 x 1.2
    expect(record({ state: state2 }).gauge).toBe("target");
    expect(record({ state: state2, hunter: { lurking: true } }).gauge).toBe("hunter");
  });

  it("gives nobody the gauge in a Calm, or on equal ships", () => {
    expect(record({ wind: "calm" }).gauge).toBeNull();
    expect(record({}).gauge).toBeNull();
  });

  it("passes the water's terrain and wind to the battle", () => {
    const r = record({ terrain: "kelp", wind: "gale" });
    expect(r).toMatchObject({ terrain: "kelp", wind: "gale", at: "gh_lee", tide: 6, seed: 1234 });
  });

  it("fights on open water when the encounter is on a lane", () => {
    expect(record({ terrain: null }).terrain).toBe("open");
  });
});

// ---------- Which doctrine ----------

describe("doctrine pick (8.8, D72)", () => {
  const withAll = (): SeasonState => {
    const state = season(captains2(), 6);
    for (const c of Object.values(state.captains)) {
      c.doctrines = templateDoctrines();
      c.defaultDoctrine = "Coward";
    }
    return state;
  };

  it("finds a saved doctrine by name and ignores case and padding", () => {
    const state = withAll();
    expect(findDoctrine(state.captains.h!, " runner ")?.name).toBe("Runner");
    expect(findDoctrine(state.captains.h!, "Nope")).toBeUndefined();
    expect(findDoctrine(state.captains.h!, undefined)).toBeUndefined();
  });

  it("uses the one asked for, else the default, else the first saved, else a fresh Brawler", () => {
    const c = withAll().captains.h!;
    expect(pickDoctrine(c, "Skirmisher").name).toBe("Skirmisher");
    expect(pickDoctrine(c, undefined).name).toBe("Coward");
    expect(pickDoctrine(c, "Deleted").name).toBe("Coward");
    c.defaultDoctrine = "Gone";
    expect(pickDoctrine(c, undefined).name).toBe("Brawler"); // the first saved
    c.doctrines = [];
    expect(pickDoctrine(c, undefined)).toEqual(templateDoctrine("Brawler"));
  });

  it("fights with the doctrine the side asked for", () => {
    const state = withAll();
    const out = combatEncounter(ctxOf({ state, hunter: { doctrine: "Skirmisher" }, target: { doctrine: undefined } }));
    expect(battleOfCtx(out.events)!.record.doctrines).toEqual({ hunter: "Skirmisher", target: "Coward" });
  });

  it("maps a captain to the enemy type its opponent's doctrine sees", () => {
    expect(enemyTypeOf({ kind: "player" })).toBe("player");
    expect(enemyTypeOf({ kind: "npc", npcRole: "merchant" })).toBe("merchant");
    expect(enemyTypeOf({ kind: "npc", npcRole: "local" })).toBe("merchant");
    expect(enemyTypeOf({ kind: "npc", npcRole: "navy" })).toBe("navy");
    expect(enemyTypeOf({ kind: "npc", npcRole: "pirate" })).toBe("brethren");
    expect(enemyTypeOf({ kind: "npc", npcRole: "boss" })).toBe("monster");
    expect(enemyTypeOf({ kind: "npc", npcRole: "rookie" })).toBe("player");
    expect(enemyTypeOf({ kind: "npc" })).toBe("merchant");
  });

  it("reads the enemy type from the captain on the other side", () => {
    const state = season([{ id: "h", name: "H", shipName: "Hunter", water: "gh_lee" }, { id: "t", name: "T", shipName: "Target", water: "gh_lee", kind: "npc", npcRole: "navy" }], 6);
    state.captains.h!.doctrines = [{
      name: "Navy hater",
      rules: [
        { if: [{ kind: "enemyType", type: "navy" }], then: { kind: "fight", helm: "hold", guns: "chainShot" } },
        { if: [], then: { kind: "fight", helm: "hold", guns: "roundShot" } },
      ],
    }];
    state.captains.h!.defaultDoctrine = "Navy hater";
    const out = combatEncounter(ctxOf({ state }));
    expect(battleOfCtx(out.events)!.record.rounds[0]!.ships[0]).toMatchObject({ rule: 0, guns: "chainShot" });
  });
});

// ---------- A battle built from a Ship ----------

describe("battleShipOf (D49)", () => {
  it("copies a fresh sloop and takes the flags", () => {
    const state = season(captains2(), 6);
    const b = battleShipOf(ship(state, "h"), state.captains.h!, "hunter", { charted: true, withCurrent: true, lurker: true });
    expect(b).toMatchObject({
      shipId: "ship_h", captainId: "h", side: "hunter", hull: "sloop", cannons: 10, sails: 10, maxHullPoints: 100,
      maxRiggingPoints: 100, maxHands: 30, hullPoints: 100, riggingPoints: 100, hands: 30, powder: B.start.powder,
      charted: true, withCurrent: true, lurker: true, helmBonus: 0, boardingBonus: 0, abilities: [],
      guns: { order: null, repeats: 0, charged: false },
    });
  });

  it("reflects upgrades and damage", () => {
    const state = season(captains2(), 6);
    boost(ship(state, "h"), 5);
    ship(state, "h").hullPoints = 40;
    ship(state, "h").hands = 12;
    const b = battleShipOf(ship(state, "h"), state.captains.h!, "target", { charted: false, withCurrent: false, lurker: false });
    expect(b).toMatchObject({ cannons: 16, sails: 16, maxHullPoints: 160, hullPoints: 40, maxHands: 48, hands: 12, side: "target" });
  });
});

// ---------- Applying a battle to the world ----------

describe("applying a battle (8.7, v0.2 9, P2.4)", () => {
  /** A finished battle between Hunter and Target on Tide 5 with its outcome set by hand. */
  function finished(kind: OutcomeKind, winner: BattleSide | null, over: Partial<BattleRecord> = {}): BattleRecord {
    const base = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("hold", "holdFire"), target: always("hold", "holdFire") }, { at: "gh_lee" }));
    const loser = winner === null ? null : winner === "hunter" ? "target" : "hunter";
    return { ...base, outcome: { kind, winner, loser, round: 3 }, ...over };
  }

  interface Setup {
    state: SeasonState;
    input: (record: BattleRecord, over?: Partial<ApplyBattleInput>) => ApplyBattleInput;
  }

  function setup(opts: { hunterPR?: number; targetPR?: number; npc?: "hunter" | "target" } = {}): Setup {
    const state = season([
      { id: "h", name: "Hester", shipName: "Hunter", water: "gh_lee", ...(opts.npc === "hunter" ? { kind: "npc" as const, npcRole: "navy" as const } : {}) },
      { id: "t", name: "Tobias", shipName: "Target", water: "gh_lee", ...(opts.npc === "target" ? { kind: "npc" as const, npcRole: "merchant" as const } : {}) },
    ], 5);
    ship(state, "t").plunder = 200;
    ship(state, "t").hold.rum = 10;
    ship(state, "t").hold.provisions = 4;
    ship(state, "h").plunder = 50;
    return {
      state,
      input: (record, over = {}) => ({
        state, record,
        ships: { hunter: ship(state, "h"), target: ship(state, "t") },
        captains: { hunter: state.captains.h!, target: state.captains.t! },
        powerRatings: { hunter: opts.hunterPR ?? 10, target: opts.targetPR ?? 10 },
        mutual: false, inCradle: false, refusedParley: false, ...over,
      }),
    };
  }

  it("copies the damage the battle did onto the ships", () => {
    const { state, input } = setup();
    const record = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("hold", "roundShot"), target: always("hold", "grapeshot") }));
    applyBattle(input(record));
    const [h, t] = record.final;
    expect(ship(state, "h")).toMatchObject({ hullPoints: h!.hullPoints, riggingPoints: h!.riggingPoints, hands: h!.hands });
    expect(ship(state, "t")).toMatchObject({ hullPoints: t!.hullPoints, riggingPoints: t!.riggingPoints, hands: t!.hands });
    expect(ship(state, "h").hold.powder).toBe(h!.powder);
    expect(h!.powder).toBeLessThan(B.start.powder); // and the Powder is spent
  });

  it("pays nothing for a Draw or an Escape, and shields nobody", () => {
    for (const kind of ["draw", "escaped"] as const) {
      const { state, input } = setup();
      const applied = applyBattle(input(finished(kind, null)));
      expect(applied.aftermath).toMatchObject({ loot: null, winner: null, loser: null, shieldUntil: null, towed: false });
      expect(applied.tow).toEqual([]);
      expect(ship(state, "t").plunder).toBe(200);
      expect(state.captains.t!.shieldUntilTide).toBe(0);
      expect(state.wrecks).toEqual({});
    }
  });

  it("pays the table by outcome: 25% Sunk, 40% Captured, 15% Struck Colours, 20% Victory", () => {
    const share = (kind: OutcomeKind) => {
      const { state, input } = setup();
      applyBattle(input(finished(kind, "hunter")));
      return ship(state, "h").plunder - 50;
    };
    expect(share("sunk")).toBe(50);
    expect(share("captured")).toBe(80);
    expect(share("struckColours")).toBe(30);
    expect(share("victory")).toBe(40);
  });

  it("takes cargo as well as doubloons, in whole units, and never Provisions or Powder", () => {
    const { state, input } = setup();
    const applied = applyBattle(input(finished("captured", "hunter")));
    expect(applied.aftermath.loot!.taken).toEqual({ plunder: 80, goods: { rum: 4 } });
    expect(ship(state, "t")).toMatchObject({ plunder: 120, hold: { rum: 6, provisions: 4 } });
    expect(ship(state, "h")).toMatchObject({ plunder: 130, hold: { rum: 4 } });
  });

  it("leaves what a Sunk ship gives up and the winner does not grab as a Wreck for 4 Tides", () => {
    const { state, input } = setup();
    const applied = applyBattle(input(finished("sunk", "hunter")));
    expect(applied.aftermath.loot!.taken).toEqual({ plunder: 50, goods: { rum: 2 } });
    const wreck = applied.aftermath.wreck!;
    expect(wreck).toEqual({ id: "wreck_t5_ship_t", water: "gh_lee", goods: { rum: 8 }, plunder: 150, untilTide: 9 });
    expect(state.wrecks).toEqual({ [wreck.id]: wreck });
    expect(ship(state, "t")).toMatchObject({ plunder: 0, hold: { rum: 0 } });
    expect(ship(state, "h").plunder).toBe(100);
  });

  it("scales PvP loot by the fairness factor: small for a bully, up to 1.5 times for an underdog", () => {
    const bully = setup({ hunterPR: 20, targetPR: 10 });
    const b = applyBattle(bully.input(finished("captured", "hunter")));
    expect(b.aftermath.loot!.fairness).toBe(0.25); // (10 / 20) squared
    expect(ship(bully.state, "h").plunder).toBe(50 + 20);
    const underdog = setup({ hunterPR: 10, targetPR: 20 });
    const u = applyBattle(underdog.input(finished("captured", "hunter")));
    expect(u.aftermath.loot!.fairness).toBe(1.5);
    expect(ship(underdog.state, "h").plunder).toBe(50 + 120);
  });

  it("halves PvP loot in the Cradle", () => {
    const { state, input } = setup();
    const applied = applyBattle(input(finished("captured", "hunter"), { inCradle: true }));
    expect(applied.aftermath.loot).toMatchObject({ cradle: 0.5, fairness: 1 });
    expect(ship(state, "h").plunder).toBe(50 + 40);
  });

  it("caps what one battle can pay", () => {
    const { state, input } = setup();
    ship(state, "t").plunder = 5000;
    const applied = applyBattle(input(finished("captured", "hunter")));
    expect(applied.aftermath.loot!.capped).toBe(true);
    expect(ship(state, "h").plunder - 50).toBeLessThanOrEqual(B.loot.capPerBattle);
  });

  it("applies no fairness, Cradle halving, bounty or shield against an NPC", () => {
    const { state, input } = setup({ hunterPR: 20, targetPR: 10, npc: "target" });
    const applied = applyBattle(input(finished("captured", "hunter"), { inCradle: true }));
    expect(applied.aftermath).toMatchObject({ pvp: false, shieldUntil: null, bounty: { added: 0, collected: 0 } });
    expect(applied.aftermath.loot).toMatchObject({ fairness: 1, cradle: 1 });
    expect(ship(state, "h").plunder).toBe(50 + 80);
    expect(state.captains.t!.shieldUntilTide).toBe(0);
    expect(applied.bounties).toEqual([]);
  });

  it("shields the loser of a PvP battle for 4 Tides, but not a Draw's players", () => {
    const { state, input } = setup();
    const applied = applyBattle(input(finished("victory", "hunter")));
    expect(applied.aftermath.shieldUntil).toBe(5 + B.shieldTidesAfterPvpLoss);
    expect(state.captains.t!.shieldUntilTide).toBe(9);
    expect(state.captains.h!.shieldUntilTide).toBe(0);
  });

  it("tows a Sunk or Captured loser, and nobody else", () => {
    for (const [kind, towed] of [["sunk", true], ["captured", true], ["struckColours", false], ["victory", false]] as const) {
      const { input } = setup();
      const applied = applyBattle(input(finished(kind, "target")));
      expect(applied.tow).toEqual(towed ? ["ship_h"] : []);
      expect(applied.aftermath.towed).toBe(towed);
    }
  });

  it("makes Flotsam of cargo thrown overboard, so the winner finds nothing to take", () => {
    const { state, input } = setup();
    const applied = applyBattle(input(finished("captured", "hunter", { jettisoned: ["target"] })));
    const flotsam = applied.aftermath.flotsam[0]!;
    expect(flotsam).toEqual({ id: "flotsam_t5_ship_t", water: "gh_lee", goods: { rum: 10 }, plunder: 0, untilTide: 7 });
    expect(state.flotsam).toEqual({ [flotsam.id]: flotsam });
    expect(ship(state, "t")).toMatchObject({ hold: { rum: 0, provisions: 4 }, plunder: 120 }); // the doubloons stay aboard (D60)
    expect(applied.aftermath.loot!.taken).toEqual({ plunder: 80, goods: {} });
  });

  describe("bounties (v0.2 9 rule 2)", () => {
    it("puts a bounty equal to the loot on a winner who hunted a ship under two thirds of its strength", () => {
      const { state, input } = setup({ hunterPR: 20, targetPR: 10 });
      const applied = applyBattle(input(finished("captured", "hunter")));
      // 40% x fairness 0.25 = 10% of the loser's 200 doubloons and 10 rum, the rum at the base price of 20
      expect(applied.aftermath.bounty).toEqual({ added: 40, collected: 0 });
      expect(state.captains.h!.bounty).toBe(40);
      expect(applied.bounties).toEqual([{ captain: "h", amount: 40 }]);
    });

    it("does not for a fair fight, a ship above two thirds, or a hunter who lost", () => {
      const fair = setup();
      expect(applyBattle(fair.input(finished("captured", "hunter"))).aftermath.bounty.added).toBe(0);
      const close = setup({ hunterPR: 15, targetPR: 10 }); // exactly two thirds is not below it
      expect(applyBattle(close.input(finished("captured", "hunter"))).aftermath.bounty.added).toBe(0);
      const lost = setup({ hunterPR: 20, targetPR: 10 });
      expect(applyBattle(lost.input(finished("captured", "target"))).aftermath.bounty.added).toBe(0);
    });

    it("counts both ships as hunters in a mutual encounter", () => {
      const { input } = setup({ hunterPR: 10, targetPR: 20 });
      const applied = applyBattle(input(finished("captured", "target"), { mutual: true }));
      expect(applied.aftermath.bounty.added).toBe(5); // 10% of the 50 doubloons the weaker hunter carried (40% x fairness 0.25)
      const single = setup({ hunterPR: 10, targetPR: 20 });
      expect(applyBattle(single.input(finished("captured", "target"))).aftermath.bounty.added).toBe(0);
    });

    it("puts a bounty on a hunter who turned a parley down and won", () => {
      const { state, input } = setup();
      const applied = applyBattle(input(finished("captured", "hunter"), { refusedParley: true }));
      expect(applied.aftermath.bounty.added).toBe(80 + 4 * B.economy.basePrice); // 40% of 200 doubloons and of 10 rum
      expect(state.captains.h!.bounty).toBe(160);
    });

    it("lets whoever beats a captain with a bounty collect it", () => {
      const { state, input } = setup();
      state.captains.t!.bounty = 70;
      const applied = applyBattle(input(finished("victory", "hunter")));
      expect(applied.aftermath.bounty.collected).toBe(70);
      expect(state.captains.t!.bounty).toBe(0);
      expect(ship(state, "h").plunder).toBe(50 + 40 + 70);
    });

    it("keeps the bounty when the captain wins or draws", () => {
      const { state, input } = setup();
      state.captains.t!.bounty = 70;
      applyBattle(input(finished("draw", null)));
      applyBattle(input(finished("victory", "target")));
      expect(state.captains.t!.bounty).toBe(70);
    });
  });
});

// ---------- Towing ----------

describe("towing (8.7, P2.4)", () => {
  const sunk = (hull = 0) => {
    const state = season([{ id: "t", name: "Tobias", shipName: "Target", water: "gh_reefside" }], 6);
    ship(state, "t").hullPoints = hull;
    ship(state, "t").docked = false;
    return state;
  };

  it("takes the ship to the nearest known Harbour, docked, with at least half its Hull", () => {
    const state = sunk();
    const result = towShip(world, state, ship(state, "t"), state.captains.t!, WEST_BREEZE);
    expect(result).toEqual({ from: "gh_reefside", to: "gh_harbour", banked: 0 });
    expect(ship(state, "t")).toMatchObject({ waterId: "gh_harbour", docked: true, hullPoints: 50 });
  });

  it("keeps a Hull that is already above half", () => {
    const state = sunk(80);
    towShip(world, state, ship(state, "t"), state.captains.t!, WEST_BREEZE);
    expect(ship(state, "t").hullPoints).toBe(80);
  });

  it("rounds half of an upgraded Hull up", () => {
    const state = sunk();
    ship(state, "t").levels.hull = 1; // max Hull 112
    towShip(world, state, ship(state, "t"), state.captains.t!, WEST_BREEZE);
    expect(ship(state, "t").hullPoints).toBe(56);
  });

  it("banks the plunder the ship still carries, since docking does", () => {
    const state = sunk();
    ship(state, "t").plunder = 35;
    const chest = state.captains.t!.chest;
    expect(towShip(world, state, ship(state, "t"), state.captains.t!, WEST_BREEZE).banked).toBe(35);
    expect(state.captains.t!.chest).toBe(chest + 35);
    expect(ship(state, "t").plunder).toBe(0);
  });

  it("falls back to the start water when the captain knows no Harbour", () => {
    const state = sunk();
    state.captains.t!.knowledge = emptyKnowledge();
    towShip(world, state, ship(state, "t"), state.captains.t!, WEST_BREEZE);
    expect(ship(state, "t")).toMatchObject({ waterId: "gh_harbour", docked: true });
  });
});

// ---------- Inside a Tide ----------

const o = (tide: number, steps: Orders["planA"]["steps"], plan: Partial<Orders["planA"]> = {}): Orders => ({ tide, planA: { steps, ...plan } });

describe("combat inside a Tide (P2.4)", () => {
  /** Hunter Hester (gh_lee) hunts Target Tobias, who sails toward her along the Driftwood lane. */
  const headOn = (tweak: (s: SeasonState) => void = () => {}, hunterPlan: Partial<Orders["planA"]> = {}, hunterStep: Record<string, unknown> = {}) => {
    const state = season([
      { id: "h", name: "Hester", shipName: "Hunter", water: "gh_lee" },
      { id: "t", name: "Tobias", shipName: "Target", water: "dw_harbour" },
    ], 6);
    tweak(state);
    const orders = {
      h: o(6, [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" }, ...hunterStep }], hunterPlan),
      t: o(6, [{ kind: "sail", to: "gh_lee" }]),
    };
    return { state, orders };
  };

  const resolve = (state: SeasonState, orders: Record<string, Orders>, seed = 7, resolveEncounter?: EncounterResolver) =>
    resolveTide({ state, world, orders, seed, windOverride: WEST_BREEZE, ...(resolveEncounter ? { resolveEncounter } : {}) });

  /** The first seed from 1 on whose escape roll fails, so the encounter becomes a battle. The seeds are fixed, so this is not flaky. */
  const firstBattle = (state: SeasonState, orders: Record<string, Orders>) => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = resolve(state, orders, seed);
      const battle = eventsOf(r.replay, "battle")[0];
      if (battle) return { r, battle, seed };
    }
    throw new Error("no seed gave a battle");
  };

  it("fights real battles by default", () => {
    const { state, orders } = headOn();
    const r = resolve(state, orders);
    expect(r.encounters).toHaveLength(1);
    expect(eventsOf(r.replay, "battle")).toHaveLength(1);
    expect(["draw", "victory", "sunk", "captured", "struckColours", "disengaged", "escaped"]).toContain(r.encounters[0]!.result);
  });

  it("gives the same battle on the same seed, and does not touch the state it was given", () => {
    const { state, orders } = headOn();
    const before = canonicalJson(state);
    const { r: a, battle, seed } = firstBattle(state, orders);
    const b = resolve(state, orders, seed);
    expect(canonicalJson(state)).toBe(before);
    expect(canonicalJson(eventsOf(b.replay, "battle")[0]!.record)).toBe(canonicalJson(battle.record));
    expect(canonicalJson(a.replay)).toBe(canonicalJson(b.replay));
    expect(canonicalJson(a.state)).toBe(canonicalJson(b.state));
  });

  it("uses a different battle for a different seed", () => {
    const { state, orders } = headOn();
    const battles = Array.from({ length: 30 }, (_, i) => eventsOf(resolve(state, orders, i + 1).replay, "battle")[0]).filter((b) => b);
    expect(battles.length).toBeGreaterThan(1);
    expect(new Set(battles.map((b) => canonicalJson(b!.record.rounds))).size).toBeGreaterThan(1);
  });

  it("freezes both ships after a battle, where each one left from", () => {
    const { state, orders } = headOn();
    const { r } = firstBattle(state, orders);
    expect(r.state.ships.ship_h!.waterId).toBe("gh_lee"); // the hop was abandoned
    expect(r.state.ships.ship_t!.waterId).toBe("dw_harbour");
    expect(r.replay.filter((e) => e.kind === "hop")).toHaveLength(2); // and neither ship started another
  });

  it("lets a paid parley end with both ships sailing on", () => {
    const { state, orders } = headOn((s) => {
      boost(ship(s, "h"), 5);
      s.captains.t!.parley = 1.25;
      ship(s, "t").plunder = 100;
    });
    const r = resolve(state, orders);
    expect(r.encounters[0]!.result).toBe("tribute");
    expect(ship(r.state, "t")).toMatchObject({ waterId: "gh_lee", plunder: 90 }); // got where it was going
    expect(ship(r.state, "h")).toMatchObject({ waterId: "dw_harbour", plunder: 10 });
  });

  it("lets a target that slips away keep sailing while the hunter stops", () => {
    // Find a seed on which the escape roll succeeds. The seeds are fixed, so the test is not flaky.
    const { state, orders } = headOn();
    const r = Array.from({ length: 40 }, (_, i) => resolve(state, orders, i + 1)).find((x) => x.encounters[0]?.result === "escaped");
    expect(r).toBeDefined();
    expect(ship(r!.state, "t").waterId).toBe("gh_lee");
    expect(ship(r!.state, "h").waterId).toBe("gh_lee"); // frozen where it was after the hop was abandoned
    expect(eventsOf(r!.replay, "battle")).toEqual([]);
  });

  it("has a Lurker and a target that stays put meet only once, even after a paid parley", () => {
    const state = season([
      { id: "d", name: "Dragos", shipName: "Gannet", water: "gh_reefside" },
      { id: "e", name: "Elena", shipName: "Widow", water: "gh_harbour" },
    ], 6);
    boost(ship(state, "d"), 5);
    state.captains.e!.parley = 1.25;
    ship(state, "e").plunder = 100;
    const r = resolve(state, {
      d: o(6, [{ kind: "lurk", filter: { kind: "players" } }]),
      e: o(6, [{ kind: "sail", to: "gh_reefside" }]),
    });
    expect(r.encounters.map((e) => e.result)).toEqual(["tribute"]);
    expect(eventsOf(r.replay, "parley")).toHaveLength(1);
    expect(ship(r.state, "e").plunder).toBe(90);
  });

  it("tows the loser of a Sunk or Captured battle to a Harbour at the end of the Tide", () => {
    const { state, orders } = headOn((s) => {
      boost(ship(s, "h"), 8);
      ship(s, "t").plunder = 60;
    });
    const r = Array.from({ length: 40 }, (_, i) => resolve(state, orders, i + 1)).find((x) => ["sunk", "captured"].includes(x.encounters[0]?.result ?? ""));
    expect(r).toBeDefined();
    const towed = eventsOf(r!.replay, "towed");
    expect(towed).toHaveLength(1);
    expect(towed[0]!.t).toBe(B.watches.cap);
    const loser = r!.state.ships[towed[0]!.ship]!;
    expect(loser).toMatchObject({ waterId: towed[0]!.to, docked: true });
    expect(world.water[towed[0]!.to]!.terrain).toBe("harbour");
    expect(loser.hullPoints).toBeGreaterThanOrEqual(maxHullPoints(loser) / 2);
    expect(loser.shortRations).toBe(false); // a docked ship eats nothing
    // The loser sails freely next Tide.
    const next = resolve(r!.state, { h: o(7, []), t: o(7, []) }, 3);
    expect(next.replay.some((e) => e.kind === "stop")).toBe(false);
  });

  it("fights with the doctrine the step names, else the plan's, else the captain's default", () => {
    const set = (s: SeasonState) => {
      for (const c of Object.values(s.captains)) { c.doctrines = templateDoctrines(); c.defaultDoctrine = "Coward"; }
    };
    const named = (plan: Partial<Orders["planA"]>, step: Record<string, unknown>) => {
      const { state, orders } = headOn(set, plan, step);
      return firstBattle(state, orders).battle.record.doctrines;
    };
    expect(named({ doctrine: "Skirmisher" }, { doctrine: "Runner" })).toEqual({ hunter: "Runner", target: "Coward" });
    expect(named({ doctrine: "Skirmisher" }, {})).toEqual({ hunter: "Skirmisher", target: "Coward" });
    expect(named({}, {})).toEqual({ hunter: "Coward", target: "Coward" });
  });

  it("has the target use its own step's doctrine", () => {
    const { state, orders } = headOn((s) => { for (const c of Object.values(s.captains)) c.doctrines = templateDoctrines(); });
    orders.t = o(6, [{ kind: "sail", to: "gh_lee", doctrine: "Skirmisher" }]);
    expect(firstBattle(state, orders).battle.record.doctrines).toEqual({ hunter: "Brawler", target: "Skirmisher" });
  });

  it("falls back to the default when a step names a doctrine that is gone", () => {
    const { state, orders } = headOn(() => {}, {}, { doctrine: "Deleted" });
    expect(firstBattle(state, orders).battle.record.doctrines.hunter).toBe("Brawler");
  });

  it("tells the resolver what it needs to know about each side and the place", () => {
    const seen: EncounterContext[] = [];
    const spy: EncounterResolver = (ctx) => { seen.push(ctx); return { result: "spy", freeze: [ctx.hunter.ship.id, ctx.target.ship.id] }; };
    const { state, orders } = headOn((s) => { s.captains.t!.knowledge.levels["ln_dw_gh"] = 2; }, { doctrine: "Brawler" }, { stance: "hunt" });
    resolve(state, orders, 7, spy);
    const ctx = seen[0]!;
    expect(ctx).toMatchObject({
      tide: 6, seed: 7, at: "ln_dw_gh", onLane: true, archipelago: "cradle", terrain: null, mutual: false,
      wind: { kind: "breeze", from: 270 },
    });
    expect(ctx.hunter).toMatchObject({ doctrine: "Brawler", lurking: false, ambushRange: undefined, stance: "hunt", charted: true, withCurrent: false });
    expect(ctx.target).toMatchObject({ doctrine: undefined, lurking: false, charted: false });
    expect(ctx.state.ships.ship_h).toBe(ctx.hunter.ship);
  });

  it("tells the resolver about a Lurker's ambush range", () => {
    const seen: EncounterContext[] = [];
    const spy: EncounterResolver = (ctx) => { seen.push(ctx); return { result: "spy", freeze: [] }; };
    const state = season(captains2("gh_reefside"), 6);
    state.ships.ship_t!.waterId = "gh_harbour";
    resolve(state, {
      h: o(6, [{ kind: "lurk", filter: { kind: "anyone" }, ambushRange: "long", doctrine: "Brawler" }]),
      t: o(6, [{ kind: "sail", to: "gh_reefside" }]),
    }, 7, spy);
    expect(seen[0]!.hunter).toMatchObject({ lurking: true, ambushRange: "long", doctrine: "Brawler", stance: "hunt" });
  });

  it("marks a ship moving the way a Strong Current flows", () => {
    const raw = rawCradle();
    const lane = raw.lanes.find((l) => l.id === "ln_dw_gh")!;
    lane.current = { strength: "strong", flow: "ab" }; // Driftwood Harbour toward Gullhaven Lee
    const strong = loadMap(raw);
    const seen: EncounterContext[] = [];
    const spy: EncounterResolver = (ctx) => { seen.push(ctx); return { result: "spy", freeze: [] }; };
    const { state, orders } = headOn();
    resolveTide({ state, world: strong, orders, seed: 7, windOverride: WEST_BREEZE, resolveEncounter: spy });
    expect(seen[0]!.hunter.withCurrent).toBe(false); // Hester sails gh_lee to dw_harbour, against it
    expect(seen[0]!.target.withCurrent).toBe(true);
  });

  it("shrinks a bounty by a tenth each Tide, except one added this Tide", () => {
    const { state, orders } = headOn((s) => { s.captains.h!.bounty = 100; s.captains.t!.bounty = 50; });
    const adder: EncounterResolver = (ctx) => {
      ctx.hunter.captain.bounty += 60;
      return { result: "spy", freeze: [], bounties: [{ captain: ctx.hunter.captain.id, amount: 60 }] };
    };
    const r = resolve(state, orders, 7, adder);
    expect(r.state.captains.h!.bounty).toBe(90 + 60); // the old 100 shrinks, the new 60 does not
    expect(r.state.captains.t!.bounty).toBe(45);
    const next = resolve(r.state, { h: o(7, []), t: o(7, []) });
    expect(next.state.captains.h!.bounty).toBe(Math.floor(150 * 0.9));
  });

  it("ends a player's own shield when they hunt another player, and keeps the target's", () => {
    const { state, orders } = headOn((s) => { s.captains.h!.shieldUntilTide = 9; });
    const { r, battle } = firstBattle(state, orders);
    const lost = battle.aftermath.loser === "ship_h";
    expect(r.state.captains.h!.shieldUntilTide).toBe(lost ? 6 + B.shieldTidesAfterPvpLoss : 5);
  });

  it("does not end the shield of a player hunting an NPC", () => {
    const state = season([
      { id: "h", name: "Hester", shipName: "Hunter", water: "gh_lee" },
      { id: "m", name: "Old Biscuit", shipName: "Biscuit", water: "dw_harbour", kind: "npc", npcRole: "merchant" },
    ], 6);
    state.captains.h!.shieldUntilTide = 9;
    const r = resolve(state, {
      h: o(6, [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" } }]),
      m: o(6, [{ kind: "sail", to: "gh_lee" }]),
    });
    expect(r.encounters).toHaveLength(1);
    expect(r.state.captains.h!.shieldUntilTide).toBe(9);
  });

  it("creates and destroys no doubloons and no cargo, whatever the outcome", () => {
    const totals = (state: SeasonState) => {
      const piles = [...Object.values(state.wrecks), ...Object.values(state.flotsam)];
      const ships = Object.values(state.ships);
      const doubloons = ships.reduce((n, x) => n + x.plunder, 0) + Object.values(state.captains).reduce((n, c) => n + c.chest, 0) + piles.reduce((n, p) => n + p.plunder, 0);
      const rum = ships.reduce((n, x) => n + x.hold.rum, 0) + piles.reduce((n, p) => n + (p.goods.rum ?? 0), 0);
      return { doubloons, rum };
    };
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { state, orders } = headOn((s) => {
        boost(ship(s, "h"), 4);
        ship(s, "t").plunder = 90;
        ship(s, "t").hold.rum = 7;
        ship(s, "h").plunder = 25;
      });
      const r = resolve(state, orders, seed);
      expect(totals(r.state)).toEqual(totals(state));
      outcomes.add(r.encounters[0]?.result ?? "none");
    }
    expect(outcomes.has("escaped")).toBe(true); // the seeds cover a getaway and a battle that paid
    expect([...outcomes].some((r) => ["sunk", "captured", "victory", "struckColours"].includes(r))).toBe(true);
  });

  it("leaves Wrecks and Flotsam in the season state", () => {
    const { state, orders } = headOn((s) => {
      boost(ship(s, "h"), 8);
      ship(s, "t").plunder = 400;
      ship(s, "t").hold.rum = 6;
      s.captains.t!.doctrines = [{ name: "Heaver", rules: [{ if: [], then: { kind: "jettison" } }, { if: [], then: { kind: "fight", helm: "hold", guns: "roundShot" } }] }];
      s.captains.t!.defaultDoctrine = "Heaver";
    });
    // The Heaver's first rule has no conditions, so it is not a valid saved doctrine, but it still plays: evaluation never throws.
    const { r, battle } = firstBattle(state, orders);
    expect(battle.record.jettisoned).toEqual(["target"]);
    expect(Object.keys(r.state.flotsam)).toEqual(["flotsam_t6_ship_t"]);
    expect(r.state.flotsam.flotsam_t6_ship_t).toMatchObject({ goods: { rum: 6 }, untilTide: 8 });
  });
});
