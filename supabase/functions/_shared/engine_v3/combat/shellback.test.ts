import { describe, expect, it } from "vitest";
import { B, SEASON_PRESETS } from "../balance.ts";
import { choosePlan, validatePlan } from "../plan.ts";
import { canonicalJson, formatReplay } from "../replay.ts";
import { rngFor } from "../rng.ts";
import { newBoss, newSeason } from "../season.ts";
import { cannonsOf, maxHands, maxHullPoints, maxRiggingPoints, powerRating, sailsOf } from "../ship.ts";
import { resolveTide } from "../tide.ts";
import type { EncounterResolver, TideResult } from "../tide.ts";
import { season, world } from "../testing.ts";
import type { Orders, ReplayEvent, SeasonState } from "../types.ts";
import { runBattle } from "./battle.ts";
import { battleShipOf, combatEncounter } from "./encounter.ts";
import { doctrineChooser, evaluateDoctrine, templateDoctrine, validateDoctrine } from "./doctrine.ts";
import { fireLoss } from "./fire.ts";
import { fireGuns } from "./guns.ts";
import { helmScore } from "./helm.ts";
import {
  SHELLBACK_DOCTRINE, SHELLBACK_ID, bossAtStrait, bossPlan, hasBeaten, isBoss, isShellback, mayCross, moodOf, rearUpRoundFor, recordBossWin,
  retreats, shellArmour, shellbackDoctrine, shellbackStatline, shellFactor, snatches, upkeepBosses,
} from "./shellback.ts";
import { describeBattle, lineVariants } from "./describe.ts";
import { LINES } from "./lines.ts";
import { ramHull } from "./styles.ts";
import { ScriptedRng, always, battleOf, fleetShip, scripted, styleShip, testShip } from "./testing.ts";
import type { BattleInput, Chooser, RoundView } from "./battle.ts";
import type { BattleAftermath, BattleRecord, BattleShip, BattleSide, Doctrine, GunsOrder, HelmMove, Mood } from "./types.ts";

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

/** Holds still and sweeps his claws with Grapeshot every round: the plan the search of check 5 finds for most styles, and one a plain sloop can use. */
const CLAWS: Doctrine = { name: "Claws", rules: [{ if: [], then: { kind: "fight", helm: "hold", guns: "grapeshot" } }] };

/** A Tide in which a fresh sloop with the Claws doctrine beats him: the first of the seeds from 1000 that does it. The engine is pure, so it is a fixed answer. */
function beatHim(): { state: SeasonState; result: TideResult } {
  for (let i = 0; i < 80; i++) {
    const state = crabSeason();
    state.captains.p!.doctrines = [CLAWS];
    state.captains.p!.defaultDoctrine = "Claws";
    const result = resolve(state, { p: challenge(6) }, 1000 + i * 37);
    if (playerWon(result)) return { state: result.state, result };
  }
  throw new Error("the Claws doctrine never beat him");
}

/** Old Shellback's ship in the season, and as a BattleShip on `side` (whole, unless `over` says otherwise). */
const crabShip = () => newBoss(world, "season0", world.map.bosses[0]!)!.ship;
const asBattleShip = (side: BattleSide = "target", over: Partial<BattleShip> = {}): BattleShip => ({
  ...battleShipOf(crabShip(), { id: SHELLBACK_ID }, side, { charted: true, withCurrent: false, lurker: side === "hunter" }), ...over,
});
const crabChooser = (): Chooser => doctrineChooser(shellbackDoctrine(), { enemyType: "player" });
/** A fight against him in the Narrows' Shallows: the hunter's Chooser against his habits. `over` and `seed` change the battle input. */
const crabFight = (hunter: BattleShip, chooser: Chooser, over: Partial<BattleInput> = {}, crab: BattleShip = asBattleShip(), seed?: number): BattleRecord =>
  runBattle(battleOf(hunter, crab, { hunter: chooser, target: crabChooser() }, { terrain: "shallows", ...over, ...(seed !== undefined ? { seed } : {}) }));
/** A hunter that survives five rounds of his guns and has the crew for a long deck fight, so a fight against him runs its course. */
const sturdy = (side: BattleSide = "hunter"): BattleShip => testShip(side, "sloop", { maxHullPoints: 400, hullPoints: 400, maxHands: 60, hands: 60 });
/** His ship record in every round of a battle. */
const crabRecord = (record: BattleRecord) => record.rounds.map((r) => r.ships.find((s) => s.ship === SHIP)!);
/** The round he reared up in, or undefined when the fight ended before he could. */
const rearUpOf = (record: BattleRecord): number | undefined => {
  const at = crabRecord(record).findIndex((s) => s.mood === "rearing");
  return at < 0 ? undefined : at + 1;
};

/** A RoundView for a captain facing Old Shellback, for reading his doctrine round by round. `mood` is what the battle tells him. */
function viewOf(round: number, range: RoundView["range"] = "medium", mood?: Mood): RoundView {
  const me = testShip("hunter"), crab = asBattleShip();
  return {
    round, side: "target", range, terrain: "shallows", wind: "breeze", gauge: null,
    ships: { hunter: me, target: crab }, last: { hunter: null, target: null }, jettisoned: { hunter: false, target: false },
    ...(mood ? { mood } : {}),
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

  it("is the only ship with a shell: his captain's id says so", () => {
    expect(isShellback(asBattleShip())).toBe(true);
    expect(isShellback(testShip("hunter"))).toBe(false);
    expect(isShellback(styleShip("hunter", "rammer"))).toBe(false);
  });

  it("is at home in the Narrows: the water is Charted for him, so he has Local Knowledge there (D79)", () => {
    const state = crabSeason();
    expect(state.captains[SHELLBACK_ID]!.knowledge.levels[NARROWS]).toBe(3);
    expect(state.captains.p!.knowledge.levels[NARROWS] ?? 0).toBeLessThan(3);
  });
});

describe("his statline (spec section 7, D140)", () => {
  it("has the numbers of the Fighting Styles spec", () => {
    expect(S).toEqual({
      hull: 300, clawHands: 52, decayPerTide: 0.08, cannons: 22, sails: 10, helm: 10,
      armour: 0.8, mortarFactor: 3, rearUpRounds: [2, 3, 4], snatch: true, retreatHull: 0.35, retreatClaws: 0.25, pointsBeatHim: false,
    });
  });

  it("has Hull 300, no Rigging, claws that fight as 52 Hands, Cannons 22 and a Helm score of 10", () => {
    const ship = crabSeason().ships[SHIP]!;
    expect(maxHullPoints(ship)).toBe(300);
    expect(ship.hullPoints).toBe(300);
    expect(maxRiggingPoints(ship)).toBe(0);
    expect(ship.riggingPoints).toBe(0);
    expect(maxHands(ship)).toBe(52);
    expect(ship.hands).toBe(52);
    expect([cannonsOf(ship), sailsOf(ship)]).toEqual([22, S.sails]);
    expect(ship.statline?.helm).toBe(10);
    const sum = (300 / B.power.hullPer + 22 + S.sails + 52 / B.power.handsPer) / B.power.divisor;
    expect(powerRating(ship)).toBeCloseTo(10 * (sum / 10) ** B.power.exponent); // D136
  });

  it("is Hull 300 until Tide 8, then 8% less every Tide from Tide 9, compounding (D106)", () => {
    for (let tide = 1; tide < DECAY_FROM; tide++) expect(shellbackStatline(tide, DECAY_FROM).maxHull).toBe(300);
    expect(DECAY_FROM).toBe(9);
    expect(shellbackStatline(9, DECAY_FROM).maxHull).toBe(276); // 300 x 0.92
    expect(shellbackStatline(10, DECAY_FROM).maxHull).toBe(254); // 253.92
    expect(shellbackStatline(12, DECAY_FROM).maxHull).toBe(215); // the slowest captain is through by Tide 12
    expect(shellbackStatline(28, DECAY_FROM).maxHull).toBe(57);
  });

  it("never reaches 0, and keeps the rest of the statline", () => {
    expect(shellbackStatline(500, DECAY_FROM).maxHull).toBe(1);
    expect(shellbackStatline(20, DECAY_FROM)).toMatchObject({ maxRigging: 0, maxHands: 52, cannons: 22, sails: S.sails, helm: 10 });
  });

  it("makes him whole at the start of a Tide, and says so only when something changed", () => {
    const state = crabSeason([{ id: "p", water: "gh_harbour" }]);
    expect(upkeepBosses(state, 1)).toEqual([]); // fresh and whole
    const ship = state.ships[SHIP]!;
    ship.hullPoints = 12;
    ship.hands = 3;
    const events = upkeepBosses(state, 6);
    expect(events).toEqual([{ t: 0, kind: "bossRecovers", ship: SHIP, hullPoints: 300, maxHullPoints: 300 }]);
    expect(ship).toMatchObject({ hullPoints: 300, hands: 52, riggingPoints: 0 });
    expect(state.ships.ship_p!.hullPoints).toBe(100); // nobody else is touched
  });

  it("puts his habits back every Tide, so a rework reaches a season already running (D106, D203)", () => {
    const state = crabSeason([{ id: "p", water: "gh_harbour" }]);
    const captain = state.captains[SHELLBACK_ID]!;
    captain.doctrines = [{ name: SHELLBACK_DOCTRINE, rules: [{ if: [], then: { kind: "fight", helm: "hold", guns: "holdFire" } }] }];
    captain.defaultDoctrine = "Something else";
    upkeepBosses(state, 6);
    expect(captain.doctrines).toEqual([shellbackDoctrine()]);
    expect(captain.defaultDoctrine).toBe(SHELLBACK_DOCTRINE);
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

  it("builds a BattleShip from the statline, with a fixed Helm score", () => {
    expect(asBattleShip()).toMatchObject({
      hull: "sloop", cannons: 22, sails: S.sails, maxHullPoints: 300, maxRiggingPoints: 0, maxHands: 52, hullPoints: 300,
      riggingPoints: 0, hands: 52, fixedHelm: 10, captainId: SHELLBACK_ID,
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

  it("takes nothing from Chain shot, and Grapeshot kills his claws", () => {
    const rng = () => new ScriptedRng(0.5);
    const chain = fireGuns(testShip("hunter"), asBattleShip(), "close", "chainShot", rng());
    expect(chain).toMatchObject({ track: "rigging", damage: 0 });
    const grape = fireGuns(testShip("hunter"), asBattleShip(), "close", "grapeshot", rng());
    expect(grape).toMatchObject({ track: "hands" });
    expect(grape.damage).toBeGreaterThan(0);
  });
});

// ---------- His habits ----------

describe("his habits (2.5, spec section 7)", () => {
  const play = (mood: Mood | undefined, range: RoundView["range"] = "medium") => {
    const c = evaluateDoctrine(shellbackDoctrine(), viewOf(1, range, mood), { enemyType: "player" });
    if (c.kind !== "fight") throw new Error("he never surrenders");
    return c;
  };

  it("closes in with Round shot before he rears up", () => {
    expect(play("closing")).toMatchObject({ rule: 3, helm: "closeIn", guns: "roundShot" });
  });

  it("rears up: he holds still and holds fire", () => {
    expect(play("rearing")).toMatchObject({ rule: 2, helm: "hold", guns: "holdFire" });
  });

  it("grapples after it: Close In and Board", () => {
    expect(play("grappling", "close")).toMatchObject({ rule: 1, helm: "closeIn", guns: "board" });
  });

  it("charges with his claws once he holds a ship, whatever his mood: the great guns are quiet while Grappled (D175, boarding spec section 5)", () => {
    for (const mood of [undefined, "closing", "rearing", "grappling"] as const) {
      expect(play(mood, "grappled")).toMatchObject({ rule: 0, helm: "closeIn", guns: "charge" });
    }
    // He has no Powder to spend on muskets, so no rule of his Volleys, and he never Opens Range to cut free.
    expect(shellbackDoctrine().rules.map((r) => r.then.kind === "fight" ? r.then.guns : null)).not.toContain("volley");
    expect(shellbackDoctrine().rules.map((r) => r.then.kind === "fight" ? r.then.helm : null)).not.toContain("openRange");
  });

  it("names no round: a doctrine cannot, so the battle tells him his mood (D203)", () => {
    const conditions = shellbackDoctrine().rules.flatMap((r) => r.if.map((c) => c.kind));
    expect(conditions).not.toContain("round");
    expect(new Set(conditions)).toEqual(new Set(["range", "mood"]));
    // Without a mood in his view the mood rules do not fire, so he closes in with Round shot.
    expect(play(undefined)).toMatchObject({ rule: 3, helm: "closeIn", guns: "roundShot" });
  });

  it("never strikes his colours, and a captain's saved doctrine may not test a mood", () => {
    expect(shellbackDoctrine().rules.some((r) => r.then.kind === "surrender")).toBe(false);
    const rears: Doctrine = { name: "Cheat", rules: [{ if: [{ kind: "mood", mood: "rearing" }], then: { kind: "fight", helm: "hold", guns: "roundShot" } }, { if: [], then: { kind: "fight", helm: "hold", guns: "roundShot" } }] };
    expect(validateDoctrine(rears, { slots: 3 })).toEqual(["rule 1: only a monster has moods, a captain's doctrine may not test one"]);
    expect(validateDoctrine(templateDoctrine("Boarder"), { slots: 3 })).toEqual([]);
  });

  it("is played out in a battle: the rule, the move and the mood of every round", () => {
    const record = crabFight(sturdy(), always("hold", "holdFire"));
    const rear = rearUpOf(record)!;
    expect(S.rearUpRounds).toContain(rear);
    const seen = new Set<string>();
    crabRecord(record).forEach((r, i) => {
      const round = i + 1;
      const kind = record.rounds[i]!.rangeBefore === "grappled" ? "held" : round < rear ? "closing" : round === rear ? "rearing" : "grappling";
      seen.add(kind);
      // closing in before the rear up, rearing up in that round, grappling after it; once he holds the ship his claws Charge and he has no mood
      const expected = {
        closing: [3, "closing", "closeIn", "roundShot"], rearing: [2, "rearing", "hold", "holdFire"],
        grappling: [1, "grappling", "closeIn", "board"], held: [0, undefined, "closeIn", "charge"],
      }[kind];
      expect([r.rule, r.mood, r.helm, r.guns]).toEqual(expected);
      expect(r.helmScore).toBe(S.helm); // fixed, with or without a gauge
    });
    expect([...seen].sort()).toEqual(["closing", "grappling", "held", "rearing"]); // round 1 is always before the rear up
  });

  it("is the boarder when he Boards: First over the rail in the round he grapples, and Lashed fast after (boarding spec section 5)", () => {
    const record = crabFight(sturdy(), always("hold", "holdFire"));
    const at = record.rounds.findIndex((r) => r.grapples.length > 0);
    const [grapple, after] = [record.rounds[at]!, record.rounds[at + 1]!];
    expect(grapple.grapples).toEqual([{ side: "target", ok: true, why: "theyHold" }]);
    expect(grapple.edge).toBe("target");
    expect(grapple.melee!.firstOver).toBe("target");
    expect(grapple.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]); // the other crew chose its order before the grapple
    expect(after.edge).toBe("target"); // and he holds it for as long as the grapple lasts
    expect(after.melee!.firstOver).toBeUndefined(); // First over the rail is for the round he grapples
    expect(after.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]); // a Hold Fire is Fists on deck; his claws Charge
  });
});

// ---------- His moods ----------

describe("his moods (spec section 7, D202)", () => {
  /** A fight where the hunter holds still and says nothing, so nothing grapples him before he rears up. */
  const quiet = (seed: number) => crabFight(sturdy(), always("hold", "holdFire"), {}, asBattleShip(), seed);

  it("maps the roll of the battle onto rearUpRounds: 2, 3 or 4", () => {
    expect([0, 0.2, 0.3333].map(rearUpRoundFor)).toEqual([2, 2, 2]);
    expect([0.34, 0.5, 0.6666].map(rearUpRoundFor)).toEqual([3, 3, 3]);
    expect([0.67, 0.9, 0.999999].map(rearUpRoundFor)).toEqual([4, 4, 4]);
    expect(moodOf(1, 3)).toBe("closing");
    expect(moodOf(3, 3)).toBe("rearing");
    expect(moodOf(4, 3)).toBe("grappling");
    expect(moodOf(7, 3)).toBe("grappling");
  });

  it("rears up in exactly one round of every fight, always one of 2, 3 and 4", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const record = quiet(seed);
      const rears = crabRecord(record).filter((r) => r.mood === "rearing");
      expect(rears).toHaveLength(1);
      expect(S.rearUpRounds).toContain(rearUpOf(record));
    }
  });

  it("uses all three rounds, about a third of the fights each", () => {
    // The roll alone, over many seeds.
    const rolled: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    for (let seed = 1; seed <= 3000; seed++) rolled[rearUpRoundFor(rngFor(seed, "battle", "ship_hunter", SHIP, "rearUp").next())]!++;
    for (const round of [2, 3, 4]) expect(Math.abs(rolled[round]! / 3000 - 1 / 3)).toBeLessThan(0.03);
    // And in the fights themselves.
    const count: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    for (let seed = 1; seed <= 150; seed++) count[rearUpOf(quiet(seed))!]!++;
    for (const round of [2, 3, 4]) expect(count[round]).toBeGreaterThan(150 * 0.2);
  });

  it("is the same round for the same seed, and not the same for every seed", () => {
    expect(rearUpOf(quiet(77))).toBe(rearUpOf(quiet(77)));
    expect(canonicalJson(quiet(77))).toBe(canonicalJson(quiet(77)));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => rearUpOf(quiet(seed)))).size).toBeGreaterThan(1);
  });

  it("draws the round from the stream rngFor(seed, 'battle', hunter, target, 'rearUp') and from nothing else", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const roll = rngFor(seed, "battle", "ship_hunter", SHIP, "rearUp").next();
      expect(rearUpOf(quiet(seed))).toBe(rearUpRoundFor(roll));
    }
  });

  it("is the same wherever he stands: as the hunter or as the target", () => {
    const asHunter = (seed: number) =>
      runBattle(battleOf(asBattleShip("hunter"), sturdy("target"), { hunter: crabChooser(), target: always("hold", "holdFire") }, { terrain: "shallows", seed }));
    const mood = (record: BattleRecord) => record.rounds.map((r) => r.ships.find((s) => s.ship === SHIP)!.mood);
    for (const seed of [1, 2, 3]) {
      const record = asHunter(seed);
      const rear = mood(record).indexOf("rearing") + 1;
      expect(S.rearUpRounds).toContain(rear);
      expect(mood(record).slice(0, rear + 1)).toEqual([...Array(rear - 1).fill("closing"), "rearing", "grappling"]);
    }
  });

  it("shows the tell in the round before he rears up, and only in that round (D204)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const record = quiet(seed);
      const rear = rearUpOf(record)!;
      const tells = crabRecord(record).map((r) => r.tell === true);
      expect(tells.map((t, i) => (t ? i + 1 : 0)).filter(Boolean)).toEqual([rear - 1]);
      expect(record.rounds.flatMap((r) => r.ships.filter((s) => s.ship !== SHIP).map((s) => s.tell))).toEqual(Array(record.rounds.length).fill(undefined));
    }
  });

  it("shows no tell, and never rears up, when the ships grapple before the rear up", () => {
    // The hunter crosses his bow in round 1 at Medium, so the claws catch it and the rear up never comes.
    const record = crabFight(sturdy(), always("crossTheirBow", "roundShot"), { ambush: "medium" });
    expect(record.rounds[0]!.grapples).toEqual([{ side: "target", ok: true, why: "snatch" }]);
    expect(record.rounds.length).toBeGreaterThan(1);
    for (const r of crabRecord(record)) {
      expect(r.tell).toBeUndefined();
      expect(r.mood).not.toBe("rearing");
    }
    expect(crabRecord(record).slice(1).every((r) => r.mood === undefined && r.guns === "charge")).toBe(true); // Grappled: no mood, claws Charge
  });

  it("gives no mood to any other ship, and nobody's Chooser sees one but his", () => {
    const seen: (string | undefined)[] = [];
    const spy: Chooser = (view) => {
      seen.push(view.mood);
      return { kind: "fight", rule: 0, abilities: [], helm: "hold", guns: "holdFire" };
    };
    const record = crabFight(testShip("hunter"), spy);
    expect(seen).toEqual(Array(record.rounds.length).fill(undefined));
    const plain = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: spy, target: spy }));
    expect(plain.rounds.flatMap((r) => r.ships.map((s) => s.mood))).toEqual(Array(plain.rounds.length * 2).fill(undefined));
  });
});

// ---------- His shell ----------

describe("his shell (spec section 7, D201)", () => {
  const crab = asBattleShip();

  it("lets a fifth of every hit by, except in the round he rears up", () => {
    for (const order of ["roundShot", "chainShot", "grapeshot", "hotShot"] as const) {
      expect(shellFactor(crab, order, false)).toBe(S.armour);
      expect(shellFactor(crab, order, true)).toBe(1);
    }
    expect(S.armour).toBe(0.8);
  });

  it("lets a Mortar shell do three times its damage and ignore the shell, in any round", () => {
    expect(shellFactor(crab, "mortar", false)).toBe(S.mortarFactor);
    expect(shellFactor(crab, "mortar", true)).toBe(S.mortarFactor);
    expect(S.mortarFactor).toBe(3);
  });

  it("is his alone: any other ship takes the whole blow", () => {
    for (const ship of [testShip("target"), styleShip("target", "gunline"), styleShip("target", "bombardier")]) {
      for (const order of ["roundShot", "mortar", "grapeshot"] as const) expect(shellFactor(ship, order, false)).toBe(1);
      expect(shellArmour(ship, false)).toBe(1);
    }
    expect(shellArmour(crab, false)).toBe(S.armour);
    expect(shellArmour(crab, true)).toBe(1);
  });

  it("is a factor of the damage formula: Round shot, Chain shot and Grapeshot do 80%, a Mortar shell 300%", () => {
    const rng = () => new ScriptedRng(0.5);
    const raw = (order: GunsOrder, armour?: number, ship = testShip("hunter")) =>
      fireGuns(ship, crab, "medium", order, rng(), { terrain: "shallows", helmMod: 1, ...(armour !== undefined ? { armour } : {}) });
    for (const order of ["roundShot", "chainShot", "grapeshot"] as const) {
      expect(raw(order, S.armour).raw).toBeCloseTo(0.8 * raw(order).raw, 10);
      expect(raw(order, S.armour).factors?.armour).toBe(S.armour);
      expect(raw(order).factors?.armour).toBe(1);
    }
    const bomb = styleShip("hunter", "bombardier");
    expect(raw("mortar", S.mortarFactor, bomb).raw).toBeCloseTo(3 * raw("mortar", undefined, bomb).raw, 10);
  });

  /** The hunter's shot damage each round, against him and against an identical ship that has no shell, with both standing still. */
  function twins(hunter: BattleShip, order: GunsOrder, seed = 5) {
    const still = always("hold", "holdFire");
    const fire = always("hold", order);
    const input = (target: BattleShip) => battleOf(hunter, target, { hunter: fire, target: still }, { terrain: "shallows", ambush: "medium", seed });
    const shelled = runBattle(input(asBattleShip()));
    const bare = runBattle(input(asBattleShip("target", { captainId: "someone_else" })));
    const dealt = (r: BattleRecord) => r.rounds.map((x) => x.ships[0]!.shot.damage);
    return { shelled, bare, mine: dealt(shelled), theirs: dealt(bare) };
  }

  it("turns a fifth of a Round shot aside in every round but the one he rears up", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { shelled, mine, theirs } = twins(testShip("hunter"), "roundShot", seed);
      const rear = rearUpOf(shelled)!;
      expect(mine).toHaveLength(5);
      mine.forEach((damage, i) => {
        if (i + 1 === rear) expect(damage).toBe(theirs[i]);
        else expect(Math.abs(damage - 0.8 * theirs[i]!)).toBeLessThanOrEqual(1);
      });
      // the record says what the shell did
      shelled.rounds.forEach((r, i) => expect(r.ships[0]!.shell).toBe(i + 1 === rear ? undefined : S.armour));
    }
  });

  it("turns a fifth of a Grapeshot aside too, and of every shot in a fleet battle", () => {
    const { shelled, mine, theirs } = twins(testShip("hunter"), "grapeshot");
    const rear = rearUpOf(shelled)!;
    mine.forEach((damage, i) => {
      if (i + 1 === rear) expect(damage).toBe(theirs[i]);
      else expect(Math.abs(damage - 0.8 * theirs[i]!)).toBeLessThanOrEqual(1);
    });
  });

  it("lets a Mortar shell do three times its damage and ignore the shell, rear up or not", () => {
    let hits = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { shelled, bare } = twins(styleShip("hunter", "bombardier"), "mortar", seed);
      shelled.rounds.forEach((r, i) => {
        const [a, b] = [r.ships[0]!, bare.rounds[i]!.ships[0]!];
        expect(a.mortar?.hit).toBe(b.mortar?.hit); // the same shell, the same roll
        if (!a.mortar?.hit) return;
        hits++;
        expect(a.shell).toBe(S.mortarFactor);
        expect(Math.abs(a.shot.damage - 3 * b.shot.damage)).toBeLessThanOrEqual(2);
      });
    }
    expect(hits).toBeGreaterThan(10);
  });

  it("does not shell a hit on anyone else: no ship record in a battle without him has a shell", () => {
    const r = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("hold", "roundShot"), target: always("hold", "roundShot") }));
    expect(r.rounds.flatMap((x) => x.ships.map((s) => s.shell))).toEqual(Array(10).fill(undefined));
  });

  it("adds nothing to a battle without him: no mood, tell, shell, snatch or driven off in any record", () => {
    // The streams are checked in shellbackRng.test.ts; a scratch comparison of 3038 such battles with the engine before this piece
    // found them byte for byte the same (D207). The golden Tide is the standing guard.
    const styles = [undefined, "bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"] as const;
    const orders: GunsOrder[] = ["roundShot", "grapeshot", "mortar", "hotShot", "board", "charge", "firePots"];
    const moves: HelmMove[] = ["closeIn", "hold", "openRange", "crossTheirBow"];
    let n = 0;
    for (const a of styles) for (const b of styles) {
      const seed = ++n;
      const at = <T,>(xs: readonly T[], k: number): T => xs[(seed * 5 + k * 3) % xs.length]!;
      const ship = (side: BattleSide, style?: (typeof styles)[number]) => (style ? styleShip(side, style, "sloop", { ...{ hands: 60, maxHands: 60 }, firePots: 2 }) : testShip(side, "sloop", { hands: 60, maxHands: 60 }));
      const record = runBattle(battleOf(ship("hunter", a), ship("target", b), {
        hunter: scripted({ 1: [at(moves, 1), at(orders, 2)] }, [at(moves, 3), at(orders, 4)]), target: scripted({ 2: [at(moves, 5), at(orders, 6)] }, [at(moves, 7), at(orders, 8)]),
      }, { seed, ...(seed % 2 === 0 ? { ambush: "medium" as const } : {}) }));
      const json = canonicalJson(record);
      expect(json, `battle ${seed}`).not.toMatch(/"(mood|tell|shell|drivenOff)":/);
      expect(json, `battle ${seed}`).not.toContain('"snatch"');
    }
  });

  it("turns a Ram aside, except in the round he rears up", () => {
    const seen = { shelled: 0, bare: 0 };
    for (let seed = 1; seed <= 80; seed++) {
      const record = runBattle(battleOf(
        styleShip("hunter", "rammer"), asBattleShip(), { hunter: always("closeIn", "roundShot"), target: crabChooser() }, { terrain: "shallows", ambush: "medium", seed },
      ));
      record.rounds.forEach((round, i) => {
        for (const ram of round.rams ?? []) {
          if (!ram.hit) continue;
          const rearing = crabRecord(record)[i]!.mood === "rearing";
          expect(ram.hull).toBe(rearing ? B.styles.rammer.ramHull : Math.round(B.styles.rammer.ramHull * S.armour));
          seen[rearing ? "bare" : "shelled"]++;
        }
      });
    }
    expect(seen.shelled).toBeGreaterThan(0);
    expect(seen.bare).toBeGreaterThan(0);
    expect(ramHull(crab, "hold", undefined, S.armour)).toBe(24);
    expect(ramHull(crab, "hold")).toBe(30);
  });

  it("turns a fire aside, except in the round he rears up", () => {
    expect(fireLoss(crab, S.armour)).toBe(10); // 12 x 0.8
    expect(fireLoss(crab)).toBe(12);
    const seen = { shelled: 0, bare: 0 };
    for (let seed = 1; seed <= 150; seed++) {
      const record = runBattle(battleOf(
        styleShip("hunter", "firebrand"), asBattleShip(), { hunter: doctrineChooser(templateDoctrine("Firebrand"), { enemyType: "monster" }), target: crabChooser() },
        { terrain: "shallows", ambush: "medium", seed },
      ));
      for (const r of crabRecord(record)) {
        if (!r.fire) continue;
        const rearing = r.mood === "rearing";
        expect(r.fire.hull).toBe(rearing ? B.combat.fire.hull : 10);
        seen[rearing ? "bare" : "shelled"]++;
      }
    }
    expect(seen.shelled).toBeGreaterThan(0);
    expect(seen.bare).toBeGreaterThan(0);
  });
});

// ---------- The claw snatch ----------

describe("the claw snatch (spec section 7, D206)", () => {
  /** A fight where the hunter plays `helm` with Round shot, starting at `ambush`, against his habits. */
  const cross = (helm: HelmMove, ambush: "long" | "medium" = "medium", seed = 1234) =>
    crabFight(sturdy(), always(helm, "roundShot"), { ambush, seed });

  it("catches a ship that crosses his bow at Short or Close while he Closes In: the ships are Grappled and he has the edge", () => {
    const r = cross("crossTheirBow");
    const first = r.rounds[0]!;
    expect(first.rangeBefore).toBe("medium");
    expect(first.row).toBe("crossClose");
    expect(first.rangeAfter).toBe("grappled");
    expect(first.grapples).toEqual([{ side: "target", ok: true, why: "snatch" }]);
    expect(first.edge).toBe("target");
    expect(first.melee!.firstOver).toBe("target"); // First over the rail
    expect(first.ships.map((s) => s.deck!.order)).toEqual(["fists", "charge"]); // he charges, the other crew had chosen already
    expect(r.rounds[1]!.edge).toBe("target"); // Lashed fast: he keeps the edge while the grapple lasts
    expect(r.rounds[1]!.rangeBefore).toBe("grappled");
  });

  it("snatches at Close as well as at Short", () => {
    // Start at Medium and Close In once to reach Close, then cross his bow from there.
    const r = runBattle(battleOf(sturdy(), asBattleShip(), {
      hunter: scripted({ 1: ["closeIn", "roundShot"] }, ["crossTheirBow", "roundShot"]), target: crabChooser(),
    }, { terrain: "shallows", ambush: "medium", seed: 9 }));
    expect(r.rounds[0]!.rangeAfter).toBe("close");
    expect(r.rounds[1]!.rangeBefore).toBe("close");
    expect(r.rounds[1]!.grapples).toEqual([{ side: "target", ok: true, why: "snatch" }]);
  });

  it("does not catch a ship at Long: he only closes one band, to Medium", () => {
    const r = cross("crossTheirBow", "long");
    expect(r.rounds[0]!.rangeAfter).toBe("medium");
    expect(r.rounds[0]!.grapples).toEqual([]);
  });

  it("does not catch a ship that does anything but cross his bow", () => {
    for (const helm of ["hold", "openRange"] as const) {
      const r = cross(helm);
      expect(r.rounds[0]!.grapples).toEqual([]);
    }
  });

  it("does not catch a ship in the round he rears up: he Holds, so he is not closing in, and the rake works", () => {
    let seen = 0;
    for (let seed = 1; seed <= 40 && seen < 3; seed++) {
      const r = crabFight(sturdy(), always("crossTheirBow", "roundShot"), { ambush: "long", seed });
      // Crossing his bow from Long never reaches Short in round 1, so he rears up in round 2, 3 or 4 before anything is snatched.
      const round = r.rounds.find((x, i) => crabRecord(r)[i]!.mood === "rearing");
      if (!round) continue;
      seen++;
      expect(round.row).toBe("crossHold");
      expect(round.grapples).toEqual([]);
      expect(round.ships[0]!.helm).toBe("crossTheirBow");
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("is his alone: Cross Their Bow still rakes any other ship that closes in, with no grapple", () => {
    const r = runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: always("crossTheirBow", "roundShot"), target: always("closeIn", "roundShot") }, { ambush: "medium" }));
    expect(r.rounds[0]!.row).toBe("crossClose");
    expect(r.rounds[0]!.rangeAfter).toBe("short");
    expect(r.rounds[0]!.grapples).toEqual([]);
  });

  it("works from either seat: he can be the hunter", () => {
    const r = runBattle(battleOf(asBattleShip("hunter"), testShip("target"), { hunter: crabChooser(), target: always("crossTheirBow", "roundShot") }, { terrain: "shallows", ambush: "medium" }));
    expect(r.rounds[0]!.grapples).toEqual([{ side: "hunter", ok: true, why: "snatch" }]);
    expect(r.rounds[0]!.edge).toBe("hunter");
  });

  it("is a switch of balance.ts, and only the flagships' moves count in a fleet (D91)", () => {
    const fleet = (mateMove: HelmMove, flagMove: HelmMove) =>
      runBattle(battleOf(testShip("hunter"), asBattleShip(), { hunter: always(flagMove, "holdFire"), target: crabChooser() }, {
        terrain: "shallows", ambush: "medium",
        mates: { hunter: [{ ship: fleetShip("mate", "hunter"), doctrine: "Mate", chooser: always(mateMove, "roundShot") }], target: [] },
      }));
    expect(fleet("closeIn", "crossTheirBow").rounds[0]!.grapples).toEqual([{ side: "target", ok: true, why: "snatch" }]);
    expect(fleet("crossTheirBow", "hold").rounds[0]!.grapples).toEqual([]); // a mate that crosses his bow is not caught
    const flag = B.shellback as { snatch: boolean };
    flag.snatch = false;
    try {
      expect(snatches("closeIn", "crossTheirBow", "short")).toBe(false);
      expect(cross("crossTheirBow").rounds[0]!.grapples).toEqual([]);
    } finally {
      flag.snatch = true;
    }
    expect(snatches("closeIn", "crossTheirBow", "short")).toBe(true);
  });

  it("needs him to Close In and the range after the Helm step to be Short or Close", () => {
    expect(snatches("closeIn", "crossTheirBow", "short")).toBe(true);
    expect(snatches("closeIn", "crossTheirBow", "close")).toBe(true);
    expect(snatches("closeIn", "crossTheirBow", "medium")).toBe(false);
    expect(snatches("closeIn", "crossTheirBow", "long")).toBe(false);
    expect(snatches("hold", "crossTheirBow", "close")).toBe(false);
    expect(snatches("closeIn", "closeIn", "close")).toBe(false);
    expect(snatches("closeIn", "hold", "close")).toBe(false);
  });
});

// ---------- Beaten: Sunk, Captured or driven off ----------

describe("being beaten (spec section 7, D105, D205)", () => {
  it("retreats into his shell when his Hull falls below 35% or his claws below 25%", () => {
    const at = (hullPoints: number, hands: number) => retreats({ hullPoints, maxHullPoints: 300, hands, maxHands: 52 });
    expect(at(300, 52)).toBe(false);
    expect(at(105, 52)).toBe(false); // exactly 35% is not below it
    expect(at(104, 52)).toBe(true);
    expect(at(300, 13)).toBe(false); // exactly 25%
    expect(at(300, 12)).toBe(true);
    expect(at(1, 1)).toBe(true);
  });

  it("is driven off when his Hull is low: a Struck Colours the other side wins, at the end of the round", () => {
    const wounded = asBattleShip("target", { hullPoints: 100 });
    const r = crabFight(testShip("hunter"), always("hold", "holdFire"), {}, wounded);
    expect(r.outcome).toEqual({ kind: "struckColours", winner: "hunter", loser: "target", round: 1, drivenOff: "hull" });
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0]!.struck).toEqual([]); // the round was fought out, nobody struck
  });

  it("is driven off when his claws are low", () => {
    const r = crabFight(testShip("hunter"), always("hold", "holdFire"), {}, asBattleShip("target", { hands: 12 }));
    expect(r.outcome).toEqual({ kind: "struckColours", winner: "hunter", loser: "target", round: 1, drivenOff: "claws" });
  });

  it("is driven off from either seat, and the winner is the other side", () => {
    const r = runBattle(battleOf(asBattleShip("hunter", { hullPoints: 50 }), testShip("target"), { hunter: crabChooser(), target: always("hold", "holdFire") }, { terrain: "shallows" }));
    expect(r.outcome).toEqual({ kind: "struckColours", winner: "target", loser: "hunter", round: 1, drivenOff: "hull" });
  });

  it("is not driven off at exactly 35% of his Hull or 25% of his claws, and the fight goes on", () => {
    const r = crabFight(testShip("hunter"), always("hold", "holdFire"), {}, asBattleShip("target", { hullPoints: 105, hands: 13 }));
    expect(r.outcome.drivenOff).toBeUndefined();
    expect(r.rounds.length).toBeGreaterThan(1);
  });

  it("is driven off by the guns: Grapeshot into the claws until they fall low", () => {
    let driven = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = crabFight(styleShip("hunter", "gunline"), always("hold", "grapeshot"), { ambush: "medium", seed });
      if (r.outcome.drivenOff) {
        driven++;
        expect(r.outcome).toMatchObject({ kind: "struckColours", winner: "hunter", loser: "target", drivenOff: "claws" });
        const last = r.final.find((s) => s.shipId === SHIP)!;
        expect(last.hands).toBeLessThan(S.retreatClaws * last.maxHands);
      }
    }
    expect(driven).toBeGreaterThan(0);
  });

  it("is sunk when his Hull reaches 0 and captured when his claws are overwhelmed, before any retreat", () => {
    const sunk = crabFight(testShip("hunter"), always("hold", "roundShot"), {}, asBattleShip("target", { hullPoints: 3 }));
    expect(sunk.outcome).toMatchObject({ kind: "sunk", winner: "hunter", loser: "target" });
    expect(sunk.outcome.drivenOff).toBeUndefined();
    // His claws a few against a full crew, snatched: the melee captures him (8.6) in the round the ships grapple.
    const captured = crabFight(styleShip("hunter", "boarder"), always("crossTheirBow", "roundShot"), { ambush: "medium" }, asBattleShip("target", { hands: 14 }));
    expect(captured.outcome).toMatchObject({ kind: "captured", winner: "hunter", loser: "target" });
    expect(captured.outcome.drivenOff).toBeUndefined();
  });

  it("is never beaten on points: five rounds that end with a lead are a Draw, and his own lead is a Draw too", () => {
    const hold = always("hold", "holdFire");
    const lead = (hunter: Chooser, ship: BattleShip, crab: Chooser = hold) =>
      runBattle(battleOf(ship, asBattleShip(), { hunter, target: crab }, { terrain: "shallows", ambush: "medium" }));
    // The hunter shoots, he stands still: on any other ship this is a Victory on points.
    const shots = always("hold", "roundShot");
    const bare = runBattle(battleOf(testShip("hunter"), asBattleShip("target", { captainId: "someone_else" }), { hunter: shots, target: hold }, { terrain: "shallows", ambush: "medium" }));
    expect(bare.outcome).toMatchObject({ kind: "victory", winner: "hunter" });
    const crab = lead(shots, testShip("hunter"));
    expect(crab.outcome).toEqual({ kind: "draw", winner: null, loser: null, round: 5 });
    expect(crab.dealt.hunter - crab.dealt.target).toBeGreaterThan(B.combat.victoryMargin); // the lead was there
    // His lead: he shoots a big ship that stands still and cannot be sunk in five rounds.
    const big = runBattle(battleOf(testShip("hunter", "frigate"), asBattleShip(), { hunter: hold, target: always("hold", "roundShot") }, { terrain: "shallows", ambush: "medium" }));
    expect(big.dealt.target - big.dealt.hunter).toBeGreaterThan(B.combat.victoryMargin);
    expect(big.outcome).toMatchObject({ kind: "draw", winner: null });
  });

  it("lets a Victory on points beat him if pointsBeatHim says so", () => {
    const flag = B.shellback as { pointsBeatHim: boolean };
    flag.pointsBeatHim = true;
    try {
      const r = runBattle(battleOf(testShip("hunter"), asBattleShip(), { hunter: always("hold", "roundShot"), target: always("hold", "holdFire") }, { terrain: "shallows", ambush: "medium" }));
      expect(r.outcome).toMatchObject({ kind: "victory", winner: "hunter" });
    } finally {
      flag.pointsBeatHim = false;
    }
  });

  it("is beaten the same way in a fleet battle: the whole side wins when he is driven off", () => {
    const record = runBattle(battleOf(testShip("hunter"), asBattleShip("target", { hullPoints: 100 }), { hunter: always("hold", "holdFire"), target: crabChooser() }, {
      terrain: "shallows", mates: { hunter: [{ ship: fleetShip("mate", "hunter"), doctrine: "Mate", chooser: always("hold", "holdFire") }], target: [] },
    }));
    expect(record.fleet).toBeDefined();
    expect(record.outcome).toEqual({ kind: "struckColours", winner: "hunter", loser: "target", round: 1, drivenOff: "hull" });
  });

  it("applies the shell to the hits of every ship of a fleet", () => {
    const fleetRun = (target: BattleShip) =>
      runBattle(battleOf(testShip("hunter"), target, { hunter: always("hold", "roundShot"), target: always("hold", "holdFire") }, {
        terrain: "shallows", ambush: "medium", seed: 3,
        mates: { hunter: [{ ship: fleetShip("mate", "hunter"), doctrine: "Mate", chooser: always("hold", "roundShot") }], target: [] },
      }));
    const shelled = fleetRun(asBattleShip());
    const bare = fleetRun(asBattleShip("target", { captainId: "someone_else" }));
    const rear = rearUpOf(shelled)!;
    shelled.rounds.forEach((round, i) => {
      const lost = round.fleet!.damage.hunter.hull;
      const full = bare.rounds[i]!.fleet!.damage.hunter.hull;
      if (i + 1 === rear) expect(lost).toBe(full);
      else expect(Math.abs(lost - 0.8 * full)).toBeLessThanOrEqual(1.5);
      for (const ship of round.ships.filter((s) => s.ship !== SHIP)) expect(ship.shell).toBe(i + 1 === rear ? undefined : S.armour);
    });
  });
});

// ---------- Old Shellback in words ----------

describe("Old Shellback in words (spec section 7, docs/text/replay-lines.md)", () => {
  const words = { place: (id: string) => `<${id}>` };
  const bare: BattleAftermath = {
    pvp: false, winner: null, loser: null, loot: null, wreck: null, flotsam: [], bounty: { added: 0, collected: 0 }, shieldUntil: null, towed: false,
  };
  const BOSS = "Old Shellback";
  const told = (record: BattleRecord, aftermath: BattleAftermath = bare): string[] => describeBattle(record, aftermath, words).map((l) => l.trim());
  const seen = new Set<string>(); // the keys a story has shown
  const has = (lines: string[], key: Parameters<typeof lineVariants>[0], vars: Record<string, string | number>): boolean => {
    const found = lineVariants(key, vars).some((v) => lines.includes(v));
    if (found) seen.add(key);
    return found;
  };
  /** The aftermath of a battle he lost to the hunter, as the Tide loop writes it. */
  const beaten = (record: BattleRecord): BattleAftermath => ({ ...bare, winner: record.hunter, loser: record.target, beaten: { boss: SHELLBACK_ID, by: ["cap_hunter"] } });
  const shoot = always("hold", "roundShot");

  it("tells the shell: once what it is, then each hit on his Hull that it took the sting out of", () => {
    const r = crabFight(sturdy(), shoot, { ambush: "medium" }, asBattleShip(), 4);
    const lines = told(r);
    const hits = r.rounds.map((round, i) => ({ shot: round.ships[0]!.shot, shell: round.ships[0]!.shell, rearing: crabRecord(r)[i]!.mood === "rearing" })).filter((h) => h.shot.damage > 0);
    expect(hits.some((h) => h.shell === S.armour)).toBe(true);
    expect(has(lines, "shellback.shell.intro", { boss: BOSS })).toBe(true);
    expect(lines.filter((l) => lineVariants("shellback.shell.intro", { boss: BOSS }).includes(l))).toHaveLength(1);
    for (const h of hits.filter((x) => x.shell !== undefined)) expect(has(lines, "shellback.shell", { ship: "The hunter", boss: BOSS, hull: h.shot.damage })).toBe(true);
    // In the round he rears up the hit is told plainly, with the whole of its damage.
    const rear = hits.find((h) => h.rearing);
    if (rear) expect(lines).toContain(`The hunter's Round shot takes ${rear.shot.damage} Hull off ${BOSS}.`);
  });

  it("tells a Grapeshot into his claws plainly, in Hands", () => {
    const r = crabFight(sturdy(), always("hold", "grapeshot"), { ambush: "medium" }, asBattleShip(), 4);
    const first = r.rounds[0]!.ships[0]!.shot;
    expect(first.track).toBe("hands");
    expect(told(r)).toContain(`The hunter's Grapeshot takes ${first.damage} Hands off ${BOSS}.`);
  });

  it("tells a Mortar shell falling on his shell from above, with the factor and the Hull", () => {
    const r = crabFight(styleShip("hunter", "bombardier", "sloop", { maxHullPoints: 400, hullPoints: 400 }), always("hold", "mortar"), {}, asBattleShip(), 1);
    const hit = r.rounds.map((x) => x.ships[0]!).find((s) => s.mortar?.hit && s.shot.damage > 0)!;
    expect(hit.shell).toBe(S.mortarFactor);
    expect(has(told(r), "shellback.mortar", { ship: "The hunter", boss: BOSS, hull: hit.shot.damage, factor: S.mortarFactor })).toBe(true);
  });

  it("tells the tell in the round before he rears up, the rear up itself, and no tell when the ships grapple first", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = crabFight(sturdy(), always("hold", "holdFire"), {}, asBattleShip(), seed);
      const lines = told(r);
      const rear = rearUpOf(r)!;
      const at = (n: number) => lines.findIndex((l) => l.startsWith(`Round ${n},`));
      const tell = lineVariants("shellback.tell", { boss: BOSS });
      const rears = lineVariants("shellback.rears", { boss: BOSS });
      expect(has(lines, "shellback.tell", { boss: BOSS }) && has(lines, "shellback.rears", { boss: BOSS })).toBe(true);
      expect(lines.filter((l) => tell.includes(l))).toHaveLength(1);
      expect(lines.slice(at(rear - 1), at(rear)).some((l) => tell.includes(l))).toBe(true); // in the round before
      expect(lines.slice(at(rear), at(rear + 1)).some((l) => rears.includes(l))).toBe(true);
    }
    const snatched = told(crabFight(sturdy(), always("crossTheirBow", "roundShot"), { ambush: "medium" }));
    expect(snatched.some((l) => lineVariants("shellback.tell", { boss: BOSS }).includes(l))).toBe(false);
    expect(snatched.some((l) => lineVariants("shellback.rears", { boss: BOSS }).includes(l))).toBe(false);
  });

  it("does not choose the wording of the tell by the round, so the wording does not give the round away", () => {
    const wordings = new Set<string>();
    const byRound: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (let seed = 1; seed <= 90; seed++) {
      const r = crabFight(sturdy(), always("hold", "holdFire"), {}, asBattleShip(), seed);
      const rear = rearUpOf(r)!;
      const line = told(r).find((l) => lineVariants("shellback.tell", { boss: BOSS }).includes(l))!;
      wordings.add(line);
      byRound[rear - 1]!.add(line);
    }
    expect(wordings.size).toBeGreaterThan(1); // more than one wording appears
    for (const round of [1, 2, 3]) expect(byRound[round]!.size, `tell before round ${round + 1}`).toBeGreaterThan(1); // and no round has a wording of its own
  });

  it("tells the snatch: who was caught and who holds the edge", () => {
    const r = crabFight(sturdy(), always("crossTheirBow", "roundShot"), { ambush: "medium" });
    const lines = told(r);
    expect(has(lines, "shellback.snatch", { ship: "The hunter", boss: BOSS })).toBe(true);
    // The snatch says the edge is his, so the telling does not say it twice.
    expect(lines.some((l) => lineVariants("edge.holds", { ship: BOSS, enemy: "The hunter" }).includes(l))).toBe(false);
    expect(lines.some((l) => lineVariants("edge.firstOver", { ship: BOSS, enemy: "The hunter" }).includes(l))).toBe(false);
    expect(has(lines, "deck.fists.surprise", { ship: "The hunter" })).toBe(true);
    expect(has(lines, "deck.charge", { ship: BOSS })).toBe(true);
  });

  it("tells being driven off for the Hull and for the claws, and that he is beaten and will be back", () => {
    const hull = crabFight(sturdy(), always("hold", "holdFire"), {}, asBattleShip("target", { hullPoints: 100 }));
    const hullLines = told(hull, beaten(hull));
    expect(has(hullLines, "shellback.driven.hull", { boss: BOSS })).toBe(true);
    expect(has(hullLines, "shellback.beaten.driven", { boss: BOSS, captains: "The hunter" })).toBe(true);
    expect(has(hullLines, "shellback.back", { boss: BOSS })).toBe(true);
    expect(hullLines.some((l) => l.includes("struck its colours"))).toBe(false);
    const claws = crabFight(sturdy(), always("hold", "holdFire"), {}, asBattleShip("target", { hands: 12 }));
    expect(has(told(claws, beaten(claws)), "shellback.driven.claws", { boss: BOSS })).toBe(true);
  });

  it("tells him beaten when he is sunk or captured, in the words of each", () => {
    const sunk = crabFight(testShip("hunter"), always("hold", "roundShot"), {}, asBattleShip("target", { hullPoints: 3 }));
    expect(sunk.outcome.kind).toBe("sunk");
    expect(has(told(sunk, beaten(sunk)), "shellback.beaten.sunk", { boss: BOSS, captains: "The hunter" })).toBe(true);
    const captured = crabFight(styleShip("hunter", "boarder"), always("crossTheirBow", "roundShot"), { ambush: "medium" }, asBattleShip("target", { hands: 14 }));
    expect(captured.outcome.kind).toBe("captured");
    expect(has(told(captured, beaten(captured)), "shellback.beaten.captured", { boss: BOSS, captains: "The hunter" })).toBe(true);
  });

  it("tells a lead on points that does not beat him: a Draw, and the gate stays shut", () => {
    const r = runBattle(battleOf(testShip("hunter"), asBattleShip(), { hunter: shoot, target: always("hold", "holdFire") }, { terrain: "shallows", ambush: "medium" }));
    expect(r.outcome.kind).toBe("draw");
    const lines = told(r);
    expect(has(lines, "shellback.points", { boss: BOSS, ship: "The hunter" })).toBe(true);
    expect(lines.some((l) => l.includes("wins on points"))).toBe(false);
  });

  it("shows every line of his the writer wrote but one: shellback.noRake says a rake is no use, and the rake still works on him when it snatches nothing", () => {
    const wanted = Object.keys(LINES).filter((k) => k.startsWith("shellback.") && k !== "shellback.noRake");
    expect(wanted.filter((k) => !seen.has(k))).toEqual([]);
  });

  it("says nothing of a shell, a mood or a tell in a battle that has no Old Shellback", () => {
    const text = told(runBattle(battleOf(testShip("hunter"), testShip("target"), { hunter: shoot, target: always("hold", "roundShot") }))).join("\n");
    expect(text).not.toMatch(/shell|galleon|rears up|claw/i);
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
    expect(validateDoctrine(CLAWS, { slots: 3 })).toEqual([]);
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const state = crabSeason();
      state.captains.p!.doctrines = [CLAWS];
      state.captains.p!.defaultDoctrine = "Claws";
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

  it("beats the starting Boarder at these untuned numbers: his claws win the deck fight (P3.2 tunes the gate)", () => {
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

  it("is beaten by a plain doctrine, and the battle tells the story", () => {
    const { state, result: r } = beatHim();
    const [battle] = battles(r);
    expect(battle!.aftermath).toMatchObject({ pvp: false, towed: false, beaten: { boss: SHELLBACK_ID, by: ["p"] } });
    expect(state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    const text = formatReplay(world, r.state, r.replay).join("\n");
    const how = battle!.record.outcome.drivenOff ? "shellback.beaten.driven" : battle!.record.outcome.kind === "sunk" ? "shellback.beaten.sunk" : "shellback.beaten.captured";
    const vars = { boss: "Old Shellback", captains: "The p" };
    expect(lineVariants(how, vars).some((v) => text.includes(v))).toBe(true);
    expect(lineVariants("shellback.back", vars).some((v) => text.includes(v))).toBe(true);
  });

  it("retreats into his shell where he lay: never towed, never sunk for good, whole again next Tide", () => {
    const first = beatHim().result;
    expect(first.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    expect(only(first, "towed")).toEqual([]); // the loser is the boss and is not towed
    const crab = first.state.ships[SHIP]!;
    expect(crab).toMatchObject({ waterId: NARROWS, docked: false });
    expect(crab.hullPoints < 300 || crab.hands < 52).toBe(true); // he was hurt, one way or the other

    const second = resolve(first.state, { p: idle(7) }, 2000);
    expect(only(second, "bossRecovers")).toMatchObject([{ ship: SHIP, hullPoints: 300, maxHullPoints: 300 }]);
    expect(second.encounters).toEqual([]); // and the captain who beat him is left alone
    expect(second.state.ships[SHIP]).toMatchObject({ hullPoints: 300, hands: 52, waterId: NARROWS });
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

  /** He starts the Tide whole, so wound him just before the fight. */
  const woundedBy = (hullPoints: number, hands?: number): EncounterResolver => (ctx) => {
    ctx.state.ships[SHIP]!.hullPoints = hullPoints;
    if (hands !== undefined) ctx.state.ships[SHIP]!.hands = hands;
    return combatEncounter(ctx);
  };

  it("is driven off when his Hull is low, and the Tide loop, the replay and bossesBeaten all agree (D105, D205)", () => {
    const r = resolveTide({ state: crabSeason(), world, orders: { p: challenge(6) }, seed: 1000, windOverride: BREEZE, resolveEncounter: woundedBy(100) });
    const [battle] = battles(r);
    expect(battle!.record.outcome).toMatchObject({ kind: "struckColours", drivenOff: "hull", round: 1 });
    expect(playerWon(r)).toBe(true);
    expect(r.encounters[0]!.result).toBe("drivenOff");
    expect(battle!.aftermath).toMatchObject({ winner: "ship_p", loser: SHIP, towed: false, beaten: { boss: SHELLBACK_ID, by: ["p"] } });
    expect(r.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    expect(only(r, "towed")).toEqual([]); // a boss is never towed
    expect(r.state.ships[SHIP]).toMatchObject({ waterId: NARROWS, docked: false });
    const text = formatReplay(world, r.state, r.replay).join("\n");
    expect(lineVariants("shellback.beaten.driven", { boss: "Old Shellback", captains: "The p" }).some((v) => text.includes(v))).toBe(true);
    expect(text).not.toContain("struck its colours"); // he was driven off, he did not strike
  });

  it("is driven off when his claws are low, and a captain he beat once passes him again for nothing new", () => {
    const state = crabSeason();
    const r = resolveTide({ state, world, orders: { p: challenge(6) }, seed: 1000, windOverride: BREEZE, resolveEncounter: woundedBy(300, 12) });
    expect(battles(r)[0]!.record.outcome).toMatchObject({ kind: "struckColours", drivenOff: "claws" });
    expect(r.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
    // Beating him a second time adds nothing and does not name the captain again.
    const again = resolveTide({ state: r.state, world, orders: { p: challenge(7) }, seed: 1001, windOverride: BREEZE, resolveEncounter: woundedBy(100) });
    expect(battles(again)[0]!.aftermath.beaten).toBeUndefined();
    expect(again.state.captains.p!.bossesBeaten).toEqual([SHELLBACK_ID]);
  });

  it("gets every player of a fleet through the gate when he is driven off, fleet mates included (D105)", () => {
    const state = crabSeason([{ id: "p1" }, { id: "p2" }]);
    state.captains.p1!.fleetId = "f1";
    state.captains.p2!.fleetId = "f1";
    const r = resolveTide({ state, world, orders: { p1: challenge(6), p2: challenge(6) }, seed: 500, windOverride: BREEZE, resolveEncounter: woundedBy(100) });
    const [battle] = battles(r);
    expect(battle!.record.fleet).toBeDefined();
    expect(battle!.record.outcome).toMatchObject({ kind: "struckColours", drivenOff: "hull" });
    expect(battle!.aftermath.beaten).toEqual({ boss: SHELLBACK_ID, by: ["p1", "p2"] });
    expect(r.state.captains.p1!.bossesBeaten).toEqual([SHELLBACK_ID]);
    expect(r.state.captains.p2!.bossesBeaten).toEqual([SHELLBACK_ID]);
  });

  it("gets every player in the same fleet through the gate when they win together (2.5)", () => {
    const wins: string[][] = [];
    for (let i = 0; i < 12; i++) {
      const state = crabSeason([{ id: "p1" }, { id: "p2" }]);
      for (const id of ["p1", "p2"]) {
        state.captains[id]!.fleetId = "f1";
        state.captains[id]!.doctrines = [CLAWS];
        state.captains[id]!.defaultDoctrine = "Claws";
      }
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
