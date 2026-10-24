import { describe, expect, it } from "vitest";
import { B, SEASON_PRESETS } from "../balance.ts";
import { choosePlan, validatePlan } from "../plan.ts";
import { canonicalJson, formatReplay } from "../replay.ts";
import { newBoss, newSeason } from "../season.ts";
import { cannonsOf, maxHands, maxHullPoints, maxRiggingPoints, powerRating, sailsOf } from "../ship.ts";
import { resolveTide } from "../tide.ts";
import type { EncounterResolver, TideResult } from "../tide.ts";
import { season, world } from "../testing.ts";
import type { Orders, ReplayEvent, SeasonState } from "../types.ts";
import { runBattle } from "./battle.ts";
import { battleShipOf, combatEncounter } from "./encounter.ts";
import { doctrineChooser, evaluateDoctrine, templateDoctrine, validateDoctrine } from "./doctrine.ts";
import { ammoFactor, fireGuns } from "./guns.ts";
import { helmScore } from "./helm.ts";
import {
  SHELLBACK_DOCTRINE, SHELLBACK_ID, bossAtStrait, bossPlan, hasBeaten, isBoss, mayCross, recordBossWin, shellbackDoctrine,
  shellbackStatline, upkeepBosses,
} from "./shellback.ts";
import { ScriptedRng, always, battleOf, scripted, testShip } from "./testing.ts";
import type { Doctrine, GunsOrder, HelmMove } from "./types.ts";
import type { RoundView } from "./battle.ts";

const S = B.shellback;
const NARROWS = "the_narrows";
const BREEZE = { cradle: { kind: "breeze" as const, from: 270 } };
const DECAY_FROM = SEASON_PRESETS.season0.shellbackDecayFromTide;

// ---------- Fixtures ----------

interface Player {
  id: string;
  shipName?: string;
  water?: string;
  npc?: boolean; // a merchant, not a player
}

/** A season with Old Shellback in the Narrows and the given players, in the Narrows too unless they say otherwise. */
function crabSeason(players: Player[] = [{ id: "p" }], tide = 6): SeasonState {
  const state = newSeason({
    seasonId: "crab", preset: "season0", seed: 5, world, bosses: true,
    captains: players.map((p) => ({ id: p.id, name: p.id.toUpperCase(), shipName: p.shipName ?? `The ${p.id}`, water: p.water ?? NARROWS, docked: false,
      ...(p.npc ? { kind: "npc" as const, npcRole: "merchant" as const } : {}),
    })),
  });
  state.tide = tide;
  return state;
}

/** Lies in wait for any NPC: Old Shellback is the only one in the Narrows, so this is a challenge. Both hunt, so nobody rolls to escape. */
const challenge = (tide: number): Orders => ({ tide, planA: { steps: [{ kind: "lurk", filter: { kind: "npcs" } }] } });
/** A captain who minds their own business: one Survey, not hunting anyone. */
const idle = (tide: number): Orders => ({ tide, planA: { steps: [{ kind: "survey" }] } });

const resolve = (state: SeasonState, orders: Record<string, Orders>, seed = 1000): TideResult =>
  resolveTide({ state, world, orders, seed, windOverride: BREEZE });

const battles = (r: TideResult) => r.replay.flatMap((e) => (e.kind === "battle" ? [e] : []));
const only = <K extends ReplayEvent["kind"]>(r: TideResult, kind: K) =>
  r.replay.filter((e): e is Extract<ReplayEvent, { kind: K }> => e.kind === kind);
const SHIP = `ship_${SHELLBACK_ID}`;
/** Did the player ship `ship_p` win the first battle of the Tide? */
const playerWon = (r: TideResult): boolean => {
  const { record } = battles(r)[0]!;
  return record.outcome.winner !== null && record.outcome.winner === (record.hunter === "ship_p" ? "hunter" : "target");
};

/** Close In, a Round shot when he rears up, Grapeshot once the claws are on, else Cross Their Bow for the rake. */
const CRABBER: Doctrine = {
  name: "Crabber",
  rules: [
    { if: [{ kind: "round", op: "is", n: S.rearUpRound }], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: { kind: "fight", helm: "closeIn", guns: "grapeshot" } },
    { if: [], then: { kind: "fight", helm: "crossTheirBow", guns: "roundShot" } },
  ],
};

/** A Tide in which a fresh sloop with the Crabber beats him: the first of the seeds from 1000 that does it. The engine is pure, so it is a fixed answer. */
function beatHim(): { state: SeasonState; result: TideResult } {
  for (let i = 0; i < 80; i++) {
    const state = crabSeason();
    state.captains.p!.doctrines = [CRABBER];
    state.captains.p!.defaultDoctrine = "Crabber";
    const result = resolve(state, { p: challenge(6) }, 1000 + i * 37);
    if (playerWon(result)) return { state: result.state, result };
  }
  throw new Error("the Crabber never beat him");
}

/** A RoundView for a captain facing Old Shellback, for reading his doctrine round by round. */
function viewOf(round: number, range: RoundView["range"] = "medium"): RoundView {
  const me = testShip("hunter"), crab = battleShipOf(newBoss(world, "season0", world.map.bosses[0]!)!.ship, { id: SHELLBACK_ID }, "target", {
    charted: true, withCurrent: false, lurker: true,
  });
  return {
    round, side: "target", range, terrain: "shallows", wind: "breeze", gauge: null,
    ships: { hunter: me, target: crab }, last: { hunter: null, target: null }, jettisoned: { hunter: false, target: false },
  };
}

// ---------- Who he is ----------

describe("Old Shellback in the season (2.5)", () => {
  it("lies in the Narrows as an NPC boss with his own ship, and the map names him", () => {
    const state = crabSeason([{ id: "p", water: "gh_harbour" }]);
    const captain = state.captains[SHELLBACK_ID]!;
    const ship = state.ships[SHIP]!;
    expect(world.map.bosses[0]!.id).toBe(SHELLBACK_ID);
    expect(captain).toMatchObject({ kind: "npc", npcRole: "boss", shipId: SHIP, chest: 0, bossesBeaten: [], defaultDoctrine: SHELLBACK_DOCTRINE });
    expect(isBoss(captain)).toBe(true);
    expect(ship).toMatchObject({ waterId: NARROWS, docked: false, plunder: 0 });
    expect(captain.doctrines.map((d) => d.name)).toEqual([SHELLBACK_DOCTRINE]);
    expect(Object.keys(state.ships).sort()).toEqual([SHIP, "ship_p"]);
  });

  it("is left out of a season that asks for no bosses, and by a boss the engine has no statline for", () => {
    const lone = newSeason({ seasonId: "s", preset: "season0", seed: 1, world, bosses: false, captains: [{ id: "a", name: "A", shipName: "A" }] });
    expect(Object.keys(lone.ships)).toEqual(["ship_a"]);
    expect(Object.keys(season([{ id: "a", name: "A", shipName: "A" }]).ships)).toEqual(["ship_a"]);
    expect(newBoss(world, "season0", { id: "kraken", water: NARROWS, gates: [] })).toBeNull();
    // Left to its default a season has him.
    expect(Object.keys(newSeason({ seasonId: "s", preset: "season0", seed: 1, world, captains: [] }).ships)).toEqual([SHIP]);
  });

  it("has Hull 300, no Rigging and claws that fight as 40 Hands", () => {
    const ship = crabSeason().ships[SHIP]!;
    expect(maxHullPoints(ship)).toBe(300);
    expect(ship.hullPoints).toBe(300);
    expect(maxRiggingPoints(ship)).toBe(0);
    expect(ship.riggingPoints).toBe(0);
    expect(maxHands(ship)).toBe(40);
    expect(ship.hands).toBe(40);
    expect([cannonsOf(ship), sailsOf(ship)]).toEqual([S.cannons, S.sails]);
    const sum = (300 / B.power.hullPer + S.cannons + S.sails + 40 / B.power.handsPer) / B.power.divisor;
    expect(powerRating(ship)).toBeCloseTo(10 * (sum / 10) ** B.power.exponent); // D136
  });

  it("is at home in the Narrows: the water is Charted for him, so he has Local Knowledge there (D79)", () => {
    const state = crabSeason();
    expect(state.captains[SHELLBACK_ID]!.knowledge.levels[NARROWS]).toBe(3);
    expect(state.captains.p!.knowledge.levels[NARROWS] ?? 0).toBeLessThan(3);
  });
});

describe("his statline across the season (2.5, D106)", () => {
  it("is Hull 300 until Tide 8, then 8% less every Tide from Tide 9, compounding", () => {
    for (let tide = 1; tide < DECAY_FROM; tide++) expect(shellbackStatline(tide, DECAY_FROM).maxHull).toBe(300);
    expect(DECAY_FROM).toBe(9);
    expect(shellbackStatline(9, DECAY_FROM).maxHull).toBe(276); // 300 x 0.92
    expect(shellbackStatline(10, DECAY_FROM).maxHull).toBe(254); // 253.92
    expect(shellbackStatline(12, DECAY_FROM).maxHull).toBe(215); // the slowest captain is through by Tide 12
    expect(shellbackStatline(28, DECAY_FROM).maxHull).toBe(57);
  });

  it("never reaches 0, and keeps the rest of the statline", () => {
    expect(shellbackStatline(500, DECAY_FROM).maxHull).toBe(1);
    expect(shellbackStatline(20, DECAY_FROM)).toMatchObject({ maxRigging: 0, maxHands: 40, cannons: S.cannons, sails: S.sails, helm: S.helm });
  });

  it("makes him whole at the start of a Tide, and says so only when something changed", () => {
    const state = crabSeason([{ id: "p", water: "gh_harbour" }]);
    expect(upkeepBosses(state, 1)).toEqual([]); // fresh and whole
    const ship = state.ships[SHIP]!;
    ship.hullPoints = 12;
    ship.hands = 3;
    const events = upkeepBosses(state, 6);
    expect(events).toEqual([{ t: 0, kind: "bossRecovers", ship: SHIP, hullPoints: 300, maxHullPoints: 300 }]);
    expect(ship).toMatchObject({ hullPoints: 300, hands: 40, riggingPoints: 0 });
    expect(state.ships.ship_p!.hullPoints).toBe(100); // nobody else is touched
  });

  it("returns at full Hull next Tide, and from Tide 9 a little more tired", () => {
    const state = crabSeason([{ id: "p", water: "gh_harbour" }], 8);
    state.ships[SHIP]!.hullPoints = 40;
    const t8 = resolve(state, {});
    expect(only(t8, "bossRecovers")).toMatchObject([{ ship: SHIP, hullPoints: 300, maxHullPoints: 300 }]);
    expect(t8.replay[1]!.kind).toBe("bossRecovers"); // right after the Tide begins, before anyone sails
    const t9 = resolve(t8.state, {});
    expect(only(t9, "bossRecovers")).toMatchObject([{ ship: SHIP, hullPoints: 276, maxHullPoints: 276 }]);
    expect(t9.state.ships[SHIP]).toMatchObject({ hullPoints: 276, statline: { maxHull: 276 } });
    expect(only(resolve(t9.state, {}), "bossRecovers")).toMatchObject([{ hullPoints: 254, maxHullPoints: 254 }]);
  });

  it("lives off the sea: no Provisions eaten and no short rations", () => {
    const r = resolve(crabSeason([{ id: "p", water: "gh_harbour" }]), {});
    expect(only(r, "supplies").filter((e) => e.ship === SHIP)).toEqual([]);
    expect(r.state.ships[SHIP]).toMatchObject({ shortRations: false });
    expect(r.state.ships[SHIP]!.hold.provisions).toBe(B.start.provisions);
  });
});

// ---------- His habits ----------

describe("his habits (2.5)", () => {
  const play = (round: number, range: RoundView["range"] = "medium") => {
    const c = evaluateDoctrine(shellbackDoctrine(), viewOf(round, range), { enemyType: "player" });
    if (c.kind !== "fight") throw new Error("he never surrenders");
    return c;
  };

  it("closes in with Round shot in rounds 1 and 2", () => {
    for (const round of [1, 2]) expect(play(round)).toMatchObject({ rule: 3, helm: "closeIn", guns: "roundShot" });
    expect(play(1).exposed).toBeUndefined();
  });

  it("rears up in round 3: he holds, holds fire, and Round shot does double damage to him", () => {
    expect(play(3)).toMatchObject({ rule: 2, helm: "hold", guns: "holdFire", exposed: S.rearUpRoundShot });
    expect(S.rearUpRoundShot).toBe(2);
  });

  it("grapples in rounds 4 and 5: Close In and Board", () => {
    for (const round of [4, 5]) expect(play(round, "close")).toMatchObject({ rule: 1, helm: "closeIn", guns: "board" });
    expect(play(4, "close").exposed).toBeUndefined();
  });

  it("charges with his claws once he holds a ship, in any round: the great guns are quiet while Grappled (boarding spec section 5)", () => {
    for (const round of [1, 2, 3, 4, 5]) {
      expect(play(round, "grappled")).toMatchObject({ rule: 0, helm: "closeIn", guns: "charge" });
      expect(play(round, "grappled").exposed).toBeUndefined(); // he does not rear up with his claws on a ship
    }
    // He has no Powder to spend on muskets, so no rule of his Volleys, and he never Opens Range to cut free.
    expect(shellbackDoctrine().rules.map((r) => r.then.kind === "fight" ? r.then.guns : null)).not.toContain("volley");
    expect(shellbackDoctrine().rules.map((r) => r.then.kind === "fight" ? r.then.helm : null)).not.toContain("openRange");
  });

  it("never strikes his colours, and a captain's saved doctrine may not rear up", () => {
    expect(shellbackDoctrine().rules.some((r) => r.then.kind === "surrender")).toBe(false);
    const rears: Doctrine = { name: "Cheat", rules: [{ if: [], then: { kind: "fight", helm: "hold", guns: "holdFire", exposed: 2 } }] };
    expect(validateDoctrine(rears, { slots: 3 })).toEqual(["Otherwise: only a monster rears up, a captain's doctrine may not"]);
    expect(validateDoctrine(templateDoctrine("Boarder"), { slots: 3 })).toEqual([]);
  });

  it("is played out in a battle: the rule, the move, and the rear up recorded on round 3 only", () => {
    const crab = battleShipOf(newBoss(world, "season0", world.map.bosses[0]!)!.ship, { id: SHELLBACK_ID }, "target", { charted: true, withCurrent: false, lurker: true });
    const record = runBattle(battleOf(testShip("hunter"), crab, {
      hunter: always("hold", "holdFire"), target: doctrineChooser(shellbackDoctrine(), { enemyType: "player" }),
    }, { terrain: "shallows" }));
    const mine = record.rounds.map((r) => r.ships.find((s) => s.ship === SHIP)!);
    expect(mine.map((s) => s.rule)).toEqual([3, 3, 2, 1, 0]);
    expect(mine.map((s) => [s.helm, s.guns])).toEqual([
      ["closeIn", "roundShot"], ["closeIn", "roundShot"], ["hold", "holdFire"], ["closeIn", "board"], ["closeIn", "charge"],
    ]);
    expect(mine.map((s) => s.exposed)).toEqual([undefined, undefined, 2, undefined, undefined]);
    expect(mine.map((s) => s.helmScore)).toEqual([S.helm, S.helm, S.helm, S.helm, S.helm]); // fixed, with or without a gauge
  });

  it("is the boarder when he Boards: First over the rail in the round he grapples, and Lashed fast after (boarding spec section 5)", () => {
    const crab = battleShipOf(newBoss(world, "season0", world.map.bosses[0]!)!.ship, { id: SHELLBACK_ID }, "target", { charted: true, withCurrent: false, lurker: true });
    const record = runBattle(battleOf(testShip("hunter"), crab, {
      hunter: always("hold", "holdFire"), target: doctrineChooser(shellbackDoctrine(), { enemyType: "player" }),
    }, { terrain: "shallows" }));
    const [r4, r5] = [record.rounds[3]!, record.rounds[4]!];
    expect(r4.grapples).toEqual([{ side: "target", ok: true, why: "theyHold" }]);
    expect(r4.edge).toBe("target");
    expect(r4.melee!.firstOver).toBe("target");
    expect(r4.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]); // the other crew chose its order before the grapple
    expect(r5.edge).toBe("target"); // and he holds it for as long as the grapple lasts
    expect(r5.melee!.firstOver).toBeUndefined(); // First over the rail is for the round he grapples
    expect(r5.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]); // a Hold Fire is Fists on deck; his claws Charge
  });
});

// ---------- The seams in the combat code ----------

describe("the statline in a battle (2.5)", () => {
  const crabShip = () => newBoss(world, "season0", world.map.bosses[0]!)!.ship;
  const asBattleShip = () => battleShipOf(crabShip(), { id: SHELLBACK_ID }, "target", { charted: true, withCurrent: false, lurker: false });

  it("builds a BattleShip from the statline, with a fixed Helm score", () => {
    expect(asBattleShip()).toMatchObject({
      hull: "sloop", cannons: S.cannons, sails: S.sails, maxHullPoints: 300, maxRiggingPoints: 0, maxHands: 40, hullPoints: 300,
      riggingPoints: 0, hands: 40, fixedHelm: S.helm,
    });
    expect(testShip("hunter").fixedHelm).toBeUndefined(); // no player ship has one
  });

  it("has a Helm score that nothing changes: no gauge, terrain, current or Local Knowledge", () => {
    const crab = asBattleShip();
    const sloop = testShip("hunter");
    for (const terrain of ["open", "shallows", "kelp"] as const) {
      for (const gauge of [false, true]) expect(helmScore(crab, sloop, terrain, gauge)).toBe(S.helm);
    }
    expect(helmScore({ ...crab, withCurrent: true, charted: true, helmBonus: 0.5 }, sloop, "shallows", true)).toBe(S.helm);
    expect(helmScore({ ...crab, fixedHelm: undefined }, sloop, "open", false)).toBe(0); // without one a ship with no Rigging scores 0 (D45)
  });

  it("takes nothing from Chain shot, and Grapeshot kills his Hands", () => {
    const rng = () => new ScriptedRng(0.5);
    const chain = fireGuns(testShip("hunter"), asBattleShip(), "close", "chainShot", rng());
    expect(chain).toMatchObject({ track: "rigging", damage: 0 });
    const grape = fireGuns(testShip("hunter"), asBattleShip(), "close", "grapeshot", rng());
    expect(grape).toMatchObject({ track: "hands" });
    expect(grape.damage).toBeGreaterThan(0);
  });

  it("takes double damage from Round shot, and only from Round shot, when he rears up", () => {
    const rng = () => new ScriptedRng(0.5);
    const args = (order: GunsOrder, exposed?: number) =>
      fireGuns(testShip("hunter"), asBattleShip(), "close", order, rng(), { terrain: "shallows", helmMod: 1, ...(exposed ? { exposed } : {}) });
    expect(args("roundShot", 2).raw).toBeCloseTo(2 * args("roundShot").raw, 10);
    expect(args("roundShot", 2).factors?.exposed).toBe(2);
    expect(args("roundShot").factors?.exposed).toBe(1);
    expect(args("grapeshot", 2).raw).toBe(args("grapeshot").raw);
    expect(args("chainShot", 2).raw).toBe(args("chainShot").raw);
  });

  it("is hit about twice as hard by a Round shot in round 3 as in round 1, from the same range", () => {
    const record = runBattle(battleOf(
      testShip("hunter"), asBattleShip(),
      {
        hunter: scripted({ 1: ["hold", "roundShot"], 2: ["hold", "chainShot"], 3: ["hold", "roundShot"] }, ["hold", "holdFire"]),
        target: doctrineChooser(shellbackDoctrine(), { enemyType: "player" }),
      },
      { terrain: "shallows", ambush: "medium" },
    ));
    const shotOf = (round: number) => record.rounds[round - 1]!.ships.find((s) => s.ship === "ship_hunter")!;
    const [r1, r3] = [shotOf(1), shotOf(3)];
    expect(r1.shot.track).toBe("hull");
    expect(r3.shot.track).toBe("hull");
    // Short in round 1 and Close in round 3: Round shot does the same at both (spec section 1).
    expect(ammoFactor("roundShot", record.rounds[0]!.rangeAfter)).toBe(ammoFactor("roundShot", record.rounds[2]!.rangeAfter));
    expect(r3.shot.damage / r1.shot.damage).toBeGreaterThan(1.6);
    expect(r3.shot.damage / r1.shot.damage).toBeLessThan(2.5);
  });
});

// ---------- The gate ----------

describe("the Narrows gate (2.4, 2.5)", () => {
  it("is guarded by Old Shellback, and passed once the boss is in a captain's bossesBeaten", () => {
    expect(bossAtStrait(world, "strait_narrows_rumhaven")?.id).toBe(SHELLBACK_ID);
    expect(bossAtStrait(world, "strait_narrows_saltteeth")?.id).toBe(SHELLBACK_ID);
    expect(bossAtStrait(world, "no_such_strait")).toBeUndefined();
    const fresh = { bossesBeaten: [] as string[] };
    const veteran = { bossesBeaten: [SHELLBACK_ID] };
    expect(mayCross(world, fresh, "strait_narrows_rumhaven")).toBe(false);
    expect(mayCross(world, veteran, "strait_narrows_saltteeth")).toBe(true);
    expect(mayCross(world, fresh, "no_such_strait")).toBe(true); // an open strait is open to everyone
    expect(hasBeaten(veteran, SHELLBACK_ID)).toBe(true);
  });

  it("adds the boss to every player on the winning side once, sorted, and names the newcomers", () => {
    const state = crabSeason([{ id: "a" }, { id: "b" }]);
    const [a, b, crab] = [state.captains.a!, state.captains.b!, state.captains[SHELLBACK_ID]!];
    a.bossesBeaten = ["zeta_lord"];
    expect(recordBossWin([a, b, crab], crab)).toEqual(["a", "b"]); // the boss itself is not a player
    expect(a.bossesBeaten).toEqual([SHELLBACK_ID, "zeta_lord"]);
    expect(recordBossWin([a, b], crab)).toEqual([]); // nothing new the second time
    expect(b.bossesBeaten).toEqual([SHELLBACK_ID]);
  });

  it("is a plan nobody writes: he lies in wait for players who have not beaten him, whatever his orders", () => {
    const state = crabSeason();
    const crab = state.captains[SHELLBACK_ID]!;
    const { plan, source } = choosePlan(world, crab, state.ships[SHIP]!, 6, undefined, BREEZE);
    expect(source).toBe("standing");
    expect(plan).toEqual(bossPlan(crab));
    expect(plan.steps).toEqual([{ kind: "lurk", filter: { kind: "notBeaten", boss: SHELLBACK_ID } }]);
    expect(plan.doctrine).toBe(SHELLBACK_DOCTRINE);
  });

  it("cannot be copied into a player's plan", () => {
    const state = crabSeason();
    const plan = { steps: [{ kind: "lurk" as const, filter: { kind: "notBeaten" as const, boss: SHELLBACK_ID } }] };
    expect(validatePlan(world, state.captains.p!, plan)).toEqual(["step 1: unknown filter notBeaten"]);
  });
});

// ---------- Fights at Tide level ----------

describe("fighting Old Shellback in a Tide (2.5)", () => {
  it("catches a player who has not beaten him: he hunts, the player rolls to slip away, and a fight follows", () => {
    // A Tide-6 seed where the escape roll fails.
    const caught = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => resolve(crabSeason(), { p: idle(6) }, s * 101));
    for (const r of caught) {
      expect(r.encounters).toHaveLength(1);
      expect(r.encounters[0]).toMatchObject({ hunter: SHIP, target: "ship_p", at: NARROWS });
      expect(only(r, "escape")).toHaveLength(1); // the player, the target, is the one who rolls
      expect(only(r, "escape")[0]).toMatchObject({ hunter: SHIP, target: "ship_p" });
    }
    const fought = caught.filter((r) => battles(r).length === 1);
    const slipped = caught.filter((r) => r.encounters[0]!.result === "escaped");
    expect(fought.length).toBeGreaterThan(0);
    expect(slipped.length).toBeGreaterThan(0);
    expect(fought.length + slipped.length).toBe(caught.length);
    for (const r of fought) expect(battles(r)[0]!.record).toMatchObject({ hunter: SHIP, target: "ship_p", terrain: "shallows" });
  });

  it("does not engage a captain who has beaten him, however long they stay in the Narrows", () => {
    for (const seed of [1000, 2000, 3000]) {
      const state = crabSeason();
      state.captains.p!.bossesBeaten = [SHELLBACK_ID];
      const r = resolve(state, { p: idle(6) }, seed);
      expect(r.encounters).toEqual([]);
      expect(only(r, "escape")).toEqual([]);
      expect(battles(r)).toEqual([]);
      expect(r.state.ships.ship_p!.hullPoints).toBe(100);
    }
  });

  it("engages a captain who has beaten someone else, and only players: a merchant is left alone", () => {
    const state = crabSeason([{ id: "p" }]);
    state.captains.p!.bossesBeaten = ["somebody_else"];
    expect(resolve(state, { p: idle(6) }).encounters).toHaveLength(1);
    expect(resolve(crabSeason([{ id: "m", npc: true }]), {}).encounters).toEqual([]);
  });

  it("leaves a player alone in the Cradle before Tide 5, as the Truce says (D10)", () => {
    expect(SEASON_PRESETS.season0.cradleTruceUntilTide).toBe(5);
    expect(resolve(crabSeason([{ id: "p" }], 4), { p: idle(4) }).encounters).toEqual([]);
    expect(resolve(crabSeason([{ id: "p" }], 5), { p: idle(5) }).encounters).toHaveLength(1);
  });

  it("is beaten by a fresh sloop with a sensible doctrine, and the captain passes the gate (2.5, 8.9)", () => {
    const crabber = CRABBER;
    expect(validateDoctrine(crabber, { slots: 3 })).toEqual([]);
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const state = crabSeason();
      state.captains.p!.doctrines = [crabber];
      state.captains.p!.defaultDoctrine = "Crabber";
      const r = resolve(state, { p: challenge(6) }, 1000 + i * 37);
      if (playerWon(r)) {
        wins++;
        expect(r.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
      } else {
        expect(r.state.captains.p!.bossesBeaten).toEqual([]);
      }
    }
    expect(wins).toBeGreaterThan(0);
  });

  it("beats the starting Boarder at these untuned numbers: his 40 claws win the deck fight (piece 3 reworks him, P3.2 tunes the gate)", () => {
    const state = crabSeason();
    const r = resolve(state, { p: challenge(6) });
    const [battle] = battles(r);
    expect(battle!.record.outcome).toMatchObject({ kind: "captured" });
    expect(playerWon(r)).toBe(false);
    expect(battle!.aftermath.beaten).toBeUndefined();
    expect(r.state.captains.p!.bossesBeaten).toEqual([]);
    const text = formatReplay(world, r.state, r.replay).join("\n");
    expect(text).toContain("Old Shellback wins the boarding");
  });

  it("is beaten by the Crabber, and the battle tells the story", () => {
    const { state, result: r } = beatHim();
    const [battle] = battles(r);
    expect(battle!.aftermath).toMatchObject({ pvp: false, towed: false, beaten: { boss: SHELLBACK_ID, by: ["p"] } });
    expect(state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    const text = formatReplay(world, r.state, r.replay).join("\n");
    expect(text).toContain("The p has beaten Old Shellback, and may now pass the gate it guards. Old Shellback will be back next Tide.");
  });

  it("retreats into his shell where he lay: never towed, never sunk for good, whole again next Tide", () => {
    const first = beatHim().result;
    expect(first.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    expect(only(first, "towed")).toEqual([]); // the loser is the boss and is not towed
    const crab = first.state.ships[SHIP]!;
    expect(crab).toMatchObject({ waterId: NARROWS, docked: false });
    expect(crab.hullPoints).toBeLessThan(300);

    const second = resolve(first.state, { p: idle(7) }, 2000);
    expect(only(second, "bossRecovers")).toMatchObject([{ ship: SHIP, hullPoints: 300, maxHullPoints: 300 }]);
    expect(second.encounters).toEqual([]); // and the captain who beat him is left alone
    expect(second.state.ships[SHIP]).toMatchObject({ hullPoints: 300, hands: 40, waterId: NARROWS });
  });

  it("is never towed even when he is sunk, and the captain who sank him passes the gate", () => {
    // He starts the Tide whole, so wound him just before the fight: one Round shot from the bottom.
    const woundedFirst: EncounterResolver = (ctx) => {
      ctx.state.ships[SHIP]!.hullPoints = 3;
      return combatEncounter(ctx);
    };
    const r = resolveTide({ state: crabSeason(), world, orders: { p: challenge(6) }, seed: 1000, windOverride: BREEZE, resolveEncounter: woundedFirst });
    const [battle] = battles(r);
    expect(battle!.record.outcome).toMatchObject({ kind: "sunk" });
    expect(playerWon(r)).toBe(true);
    expect(battle!.record.final.find((s) => s.shipId === SHIP)!.hullPoints).toBe(0);
    expect(only(r, "towed")).toEqual([]);
    expect(battle!.aftermath).toMatchObject({ towed: false, beaten: { boss: SHELLBACK_ID, by: ["p"] } });
    expect(r.state.ships[SHIP]).toMatchObject({ waterId: NARROWS, docked: false });
    expect(r.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    // Sunk, he is whole again next Tide.
    expect(resolve(r.state, {}, 3).state.ships[SHIP]!.hullPoints).toBe(300);
  });

  it("gets every player in the same fleet through the gate when they win together (2.5)", () => {
    const wins: string[][] = [];
    for (let i = 0; i < 12; i++) {
      const state = crabSeason([{ id: "p1" }, { id: "p2" }]);
      state.captains.p1!.fleetId = "f1";
      state.captains.p2!.fleetId = "f1";
      const r = resolve(state, { p1: challenge(6), p2: challenge(6) }, 500 + i * 31);
      const battle = battles(r)[0];
      if (!battle?.aftermath.beaten) continue;
      wins.push(battle.aftermath.beaten.by);
      expect(r.state.captains.p1!.bossesBeaten).toEqual([SHELLBACK_ID]);
      expect(r.state.captains.p2!.bossesBeaten).toEqual([SHELLBACK_ID]);
      expect(battle.record.fleet?.sides.target.length === 2 || battle.record.fleet?.sides.hunter.length === 2).toBe(true);
    }
    expect(wins.length).toBeGreaterThan(0);
    for (const by of wins) expect(by).toEqual(["p1", "p2"]);
  });

  it("stands and fights when a captain who has beaten him hunts him: no parley, no escape roll", () => {
    const state = crabSeason();
    state.captains.p!.bossesBeaten = [SHELLBACK_ID];
    const r = resolve(state, { p: challenge(6) });
    expect(only(r, "escape")).toEqual([]);
    expect(only(r, "parley")).toEqual([]);
    expect(battles(r)).toHaveLength(1);
    expect(battles(r)[0]!.record.hunter).toBe("ship_p"); // the player hunts, he is the target
    expect(battles(r)[0]!.aftermath.beaten).toBeUndefined(); // nothing new to open
  });

  it("takes a failed challenger's plunder into his shell, and tows the challenger home (8.7)", () => {
    const state = crabSeason();
    const weak = state.ships.ship_p!;
    weak.hullPoints = 8;
    weak.hands = 3;
    weak.plunder = 100;
    const r = resolve(state, { p: challenge(6) });
    const [battle] = battles(r);
    expect(["sunk", "captured"]).toContain(battle!.record.outcome.kind);
    expect(battle!.record.outcome.loser).toBe(battle!.record.hunter === "ship_p" ? "hunter" : "target");
    expect(battle!.aftermath.beaten).toBeUndefined();
    expect(r.state.captains.p!.bossesBeaten).toEqual([]);
    expect(only(r, "towed").map((e) => e.ship)).toEqual(["ship_p"]); // soft fall for the captain, nothing for the boss
    expect(r.state.ships.ship_p).toMatchObject({ docked: true });
    expect(r.state.ships[SHIP]).toMatchObject({ waterId: NARROWS, docked: false });
    expect(r.state.ships[SHIP]!.plunder).toBeGreaterThan(0);
  });

  it("gives the same fight from the same seed, and a different one from another", () => {
    const run = (seed: number) => canonicalJson(resolve(crabSeason(), { p: challenge(6) }, seed).replay);
    expect(run(77)).toBe(run(77));
    expect(run(77)).not.toBe(run(78));
  });
});
