// Fire (P3.B2 piece 2, docs/specs/fighting-styles.md section 3 and edge cases, boarding spec section 2): how a fire starts, how long
// it burns, what it takes, and which fire wins. Fire Pots, Hot Shot, the Mortar, embers and the Fireship.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, Chooser } from "./battle.ts";
import { blazeRounds, fireLoss, flashLoss, ignite } from "./fire.ts";
import type { Blazes } from "./fire.ts";
import { battleRng } from "./helm.ts";
import { always, battleOf, scripted, styleShip, testShip } from "./testing.ts";
import type { FightingStyle } from "../types.ts";
import type { BattleRecord, BattleShip, BattleSide } from "./types.ts";

const C = B.combat;
const S = B.styles;
const SEED = 1234;
const FLAGS: [string, string] = ["ship_hunter", "ship_target"];
const NEAR: Partial<BattleInput> = { ambush: "medium" };
const sturdy = { hullPoints: 900, maxHullPoints: 900 }; // a ship that no fire sinks in a battle
const big = { hands: 60, maxHands: 60 };
const styled = (side: BattleSide, style: FightingStyle, over: Partial<BattleShip> = {}) => styleShip(side, style, "sloop", over);
const plain = (side: BattleSide, over: Partial<BattleShip> = {}) => testShip(side, "sloop", over);

const fight = (hunter: BattleShip, target: BattleShip, h: Chooser, t: Chooser, input: Partial<BattleInput> = {}): BattleRecord =>
  runBattle(battleOf(hunter, target, { hunter: h, target: t }, { ...NEAR, ...input }));

/** The first Tide seed from 1 up for which a battle satisfies `wanted`. The engine is pure, so this is a fixed answer. */
function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean): number {
  for (let seed = 1; seed < 1500; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

const roll = (seed: number, round: number, source: string, ship: string): number => battleRng(seed, ...FLAGS, round).stream("fire", source, ship).next();

describe("how long a fire burns and what it takes (fighting styles spec section 3)", () => {
  it("burns 12 Hull for 2 rounds, 3 when a Firebrand started it with Hot Shot or Fire Pots (D138)", () => {
    expect([C.fire.hull, C.fire.rounds, S.firebrand.extraFireRounds]).toEqual([12, 2, 1]);
    const firebrand = styled("hunter", "firebrand");
    const gunline = styled("hunter", "gunline");
    expect(blazeRounds("hotShot", firebrand)).toBe(3);
    expect(blazeRounds("firePots", firebrand)).toBe(3);
    expect(blazeRounds("hotShot", gunline)).toBe(2); // not that anyone but a Firebrand fires Hot Shot
    expect(blazeRounds("embers", firebrand)).toBe(C.fire.rounds); // the Fireship's embers are a plain fire
  });

  it("has the Mortar's fire burn mortarFireRounds, and the blaze of a ship that Rams a Firebrand ramBlazeRounds", () => {
    expect(blazeRounds("mortar", styled("hunter", "bombardier"))).toBe(S.bombardier.mortarFireRounds);
    expect(blazeRounds("ram", styled("hunter", "firebrand"))).toBe(S.firebrand.ramBlazeRounds);
    expect([S.bombardier.mortarFireRounds, S.firebrand.ramBlazeRounds]).toEqual([2, 2]);
  });

  it("keeps whichever fire burns longer, the one already there on a tie", () => {
    const none: Blazes = {};
    const three = ignite(none, "ship_t", "ship_f", 3);
    expect(three).toEqual({ ship_t: { rounds: 3, by: "ship_f" } });
    expect(ignite(three, "ship_t", "ship_g", 2)).toBe(three); // a shorter fire changes nothing
    expect(ignite(three, "ship_t", "ship_g", 3)).toBe(three); // and a tie keeps the one that was lit first
    expect(ignite(three, "ship_t", "ship_g", 4)).toEqual({ ship_t: { rounds: 4, by: "ship_g" } });
    expect(ignite({ ship_t: { rounds: 1, by: "ship_f" } }, "ship_t", "ship_g", 2)).toEqual({ ship_t: { rounds: 2, by: "ship_g" } });
    expect(three).toEqual({ ship_t: { rounds: 3, by: "ship_f" } }); // nothing was changed
  });

  it("takes 12 Hull a round, 60% of that from a Gunline (fire drill) and twice that from a Firebrand (the pitch in its hold)", () => {
    expect(fireLoss(plain("target"))).toBe(12);
    expect(fireLoss(styled("target", "gunline"))).toBe(Math.round(12 * S.gunline.fireDrill)); // 7
    expect(fireLoss(styled("target", "firebrand"))).toBe(12 * S.firebrand.ownFire); // 24
    for (const style of ["bombardier", "skirmisher", "rammer", "boarder", "smuggler"] as const) expect(fireLoss(styled("target", style))).toBe(12);
  });

  it("costs a Fire Pot's flash fireHull, never so much that the ship is left below 1 Hull", () => {
    expect(C.deck.fireHull).toBe(8);
    expect(flashLoss(100)).toBe(8);
    expect(flashLoss(9)).toBe(8);
    expect(flashLoss(8)).toBe(7);
    expect(flashLoss(5)).toBe(4);
    expect(flashLoss(1)).toBe(0);
    expect(flashLoss(0)).toBe(0);
  });
});

describe("Hot Shot starts fires (fighting styles spec section 3)", () => {
  // The Firebrand closes to Short in round 1 and Holds with Hot Shot from round 2, against a target that holds fire.
  const play = (seed: number, target: BattleShip = plain("target", sturdy)) =>
    fight(styled("hunter", "firebrand", big), target, scripted({ 1: ["closeIn", "roundShot"] }, ["hold", "hotShot"]), always("hold", "holdFire"), { seed });

  it("starts a fire in a hit's wake from its own stream, 30% of the time, burning the enemy flagship for 3 rounds", () => {
    const lit = findSeed(play, (r) => roll(r.seed, 2, "hotShot", FLAGS[0]) < S.firebrand.hotShotFire);
    const r = play(lit);
    expect(r.rounds[1]!.ships[0]!.guns).toBe("hotShot");
    expect(r.rounds[1]!.ships[0]!.shot.damage).toBeGreaterThan(0);
    expect(r.rounds[1]!.fires).toEqual([{ source: "hotShot", ship: FLAGS[1], by: FLAGS[0], rounds: 3 }]);
    const out = findSeed(play, (x) => roll(x.seed, 2, "hotShot", FLAGS[0]) >= S.firebrand.hotShotFire);
    expect(play(out).rounds[1]!.fires).toBeUndefined();
    expect(play(out).rounds.every((x) => x.ships[1]!.fire === undefined)).toBe(true);
  });

  it("takes the fire's Hull at the end of each round it burns, the round it was lit included, then stops", () => {
    const seed = findSeed(play, (r) => roll(r.seed, 2, "hotShot", FLAGS[0]) < S.firebrand.hotShotFire && r.rounds.slice(2).every((x) => x.fires === undefined));
    const r = play(seed);
    const burns = r.rounds.map((x) => x.ships[1]!.fire);
    expect(burns.slice(0, 1)).toEqual([undefined]);
    expect(burns.slice(1, 4)).toEqual([{ hull: 12, left: 2 }, { hull: 12, left: 1 }, { hull: 12, left: 0 }]);
    expect(burns[4]).toBeUndefined();
    // The Hull of round 3 is round 2's minus the round's Hot Shot and the fire.
    const shot3 = r.rounds[2]!.ships[0]!.shot.damage;
    expect(r.rounds[2]!.ships[1]!.hullPoints).toBe(r.rounds[1]!.ships[1]!.hullPoints - shot3 - 12);
  });

  it("lights about 3 hits in 10", () => {
    let hits = 0, fires = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const r = play(seed);
      if (r.rounds[1]!.ships[0]!.shot.damage > 0) { hits++; if (r.rounds[1]!.fires) fires++; }
    }
    expect(fires / hits).toBeGreaterThan(0.25);
    expect(fires / hits).toBeLessThan(0.35);
  });

  it("lets a new fire on a burning ship keep whichever burns longer: two Hot Shot fires in a row burn through round 5", () => {
    const lights = (seed: number, round: number) => roll(seed, round, "hotShot", FLAGS[0]) < S.firebrand.hotShotFire;
    const seed = findSeed(play, (r) => lights(r.seed, 2) && lights(r.seed, 3) && !lights(r.seed, 4) && !lights(r.seed, 5));
    const r = play(seed);
    expect(r.rounds.map((x) => x.ships[1]!.fire?.left)).toEqual([undefined, 2, 2, 1, 0]); // the round 3 fire (3) beats what was left (1)
    expect(r.rounds.map((x) => x.fires?.length)).toEqual([undefined, 1, 1, undefined, undefined]);
    expect(r.rounds.map((x) => x.ships[1]!.fire?.hull)).toEqual([undefined, 12, 12, 12, 12]); // one fire, not two: 12 a round, not 24
  });

  it("burns a Gunline for 60% of the fire, and a Firebrand for twice", () => {
    const lit = (seed: number, target: BattleShip) => play(seed, target);
    const seedG = findSeed((s) => lit(s, styled("target", "gunline", sturdy)), (r) => r.rounds[1]!.fires !== undefined);
    expect(lit(seedG, styled("target", "gunline", sturdy)).rounds[1]!.ships[1]!.fire).toEqual({ hull: 7, left: 2 });
    // A Firebrand set alight by a Bombardier's Mortar loses twice as much.
    const mortar = (seed: number) => fight(styled("hunter", "bombardier"), styled("target", "firebrand", sturdy), always("hold", "mortar"), always("hold", "holdFire"), { seed });
    const seedF = findSeed(mortar, (r) => r.rounds[0]!.fires !== undefined);
    expect(mortar(seedF).rounds[0]!.ships[1]!.fire).toEqual({ hull: 24, left: 1 });
  });

  it("does not start a fire for a ship that is not a Firebrand: Hot Shot is replaced by Round shot, which sets nothing alight", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = fight(plain("hunter", big), plain("target", sturdy), always("hold", "hotShot"), always("hold", "holdFire"), { seed });
      expect(r.rounds[0]!.ships[0]).toMatchObject({ guns: "roundShot", asked: "hotShot" });
      expect(r.rounds.every((x) => x.fires === undefined)).toBe(true);
    }
  });
});

describe("the Mortar starts fires (fighting styles spec section 3)", () => {
  const play = (seed: number, target: BattleShip = plain("target", sturdy)) =>
    fight(styled("hunter", "bombardier"), target, always("hold", "mortar"), always("hold", "holdFire"), { seed });

  it("lights a fire in a hit's wake from its own stream, 40% of the time, that burns 2 rounds", () => {
    const lit = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === true && roll(r.seed, 1, "mortar", FLAGS[0]) < S.bombardier.mortarFire);
    const r = play(lit);
    expect(r.rounds[0]!.fires).toEqual([{ source: "mortar", ship: FLAGS[1], by: FLAGS[0], rounds: 2 }]);
    expect(r.rounds[0]!.ships[1]!.fire).toEqual({ hull: 12, left: 1 });
  });

  it("burns for 2 rounds and then goes out", () => {
    const seed = findSeed(play, (r) => r.rounds[0]!.fires !== undefined && r.rounds.slice(1).every((x) => x.fires === undefined));
    expect(play(seed).rounds.map((x) => x.ships[1]!.fire?.left)).toEqual([1, 0, undefined, undefined, undefined]);
  });

  it("takes its Hull from the damage share of the ship that fired the shell", () => {
    const seed = findSeed(play, (r) => r.rounds[0]!.fires !== undefined);
    const r = play(seed);
    const points = r.rounds.reduce((n, x) => n + x.ships[0]!.shot.damage + (x.ships[1]!.fire?.hull ?? 0), 0);
    // Hull is one of the target's three tracks (Hull, Rigging, Hands) and its max Hull is 900.
    expect(r.dealt.hunter).toBeCloseTo(points / 900 / 3, 10);
  });

  it("starts nothing when the shell misses", () => {
    const miss = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === false);
    expect(play(miss).rounds[0]!.fires).toBeUndefined();
    expect(play(miss).rounds[0]!.ships[1]!.fire).toBeUndefined();
  });

  it("lights about 4 hits in 10", () => {
    let hits = 0, fires = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const r = play(seed);
      if (r.rounds[0]!.ships[0]!.shot.damage > 0) { hits++; if (r.rounds[0]!.fires) fires++; }
    }
    expect(fires / hits).toBeGreaterThan(0.34);
    expect(fires / hits).toBeLessThan(0.46);
  });
});

describe("Fire Pots (boarding spec section 2, fighting styles spec section 3)", () => {
  // The hunter grapples the target in round 2 with a Board; from round 3 the target throws pots and the hunter charges.
  const pots = (seed: number, h: BattleShip, t: BattleShip, thrower: BattleSide = "target") => fight(
    h, t,
    scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, thrower === "hunter" ? ["hold", "firePots"] : ["hold", "charge"]),
    scripted({}, thrower === "target" ? ["hold", "firePots"] : ["hold", "charge"]),
    { seed },
  );

  it("sets the enemy flagship alight for 3 rounds when a Firebrand's pot catches, and the Firebrand does not burn", () => {
    const play = (seed: number) => pots(seed, plain("hunter", { ...big, ...sturdy }), styled("target", "firebrand", big));
    const seed = findSeed(play, (r) => r.rounds[2]!.ships[1]!.deck?.thrown?.fire === true);
    const r = play(seed);
    const thrown = r.rounds[2]!.ships[1]!.deck!.thrown!;
    expect(thrown.roll).toBe(roll(seed, 3, "pots", FLAGS[1]));
    expect(thrown.roll).toBeLessThan(C.deck.fireChance);
    expect(r.rounds[2]!.fires).toContainEqual({ source: "firePots", ship: FLAGS[0], by: FLAGS[1], rounds: 3 });
    expect(r.rounds[2]!.ships[0]!.fire).toEqual({ hull: 12, left: 2 });
    expect(r.rounds[2]!.ships[1]!.fire).toBeUndefined();
  });

  it("costs nothing when the pitch does not catch, and the pot is spent all the same", () => {
    const play = (seed: number) => pots(seed, plain("hunter", { ...big, ...sturdy }), styled("target", "firebrand", big));
    const seed = findSeed(play, (r) => r.rounds[2]!.ships[1]!.deck?.thrown?.fire === false);
    const r = play(seed);
    expect(r.rounds[2]!.ships[1]!.firePots).toBe(S.firebrand.startPots - 1);
    expect((r.rounds[2]!.fires ?? []).filter((f) => f.source === "firePots")).toEqual([]);
  });

  it("catches about 3 pots in 10", () => {
    let thrown = 0, caught = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const r = pots(seed, plain("hunter", { ...big, ...sturdy }), styled("target", "firebrand", big));
      const t = r.rounds[2]!.ships[1]!.deck!.thrown!;
      thrown++;
      if (t.fire) caught++;
    }
    expect(caught / thrown).toBeGreaterThan(0.25);
    expect(caught / thrown).toBeLessThan(0.35);
  });

  it("makes the fire of any other style a flash that costs the throwing ship and the enemy flagship Hull at once, and sets nothing burning", () => {
    const play = (seed: number) => pots(seed, plain("hunter", { ...big, drill: 5, firePots: 2 }), plain("target", { ...big, hullPoints: 100 }), "hunter");
    const seed = findSeed(play, (r) => r.rounds[2]!.ships[0]!.deck?.thrown?.fire === true);
    const r = play(seed);
    const flash = r.rounds[2]!.fires!;
    expect(flash).toEqual([
      { source: "firePots", ship: FLAGS[1], by: FLAGS[0], rounds: 0, hull: C.deck.fireHull },
      { source: "firePots", ship: FLAGS[0], by: FLAGS[1], rounds: 0, hull: C.deck.fireHull },
    ]);
    // The great guns are quiet in a deck round, so the flash is the only Hull either ship lost.
    expect(r.rounds[2]!.ships[1]!.hullPoints).toBe(r.rounds[1]!.ships[1]!.hullPoints - C.deck.fireHull);
    expect(r.rounds[2]!.ships[0]!.hullPoints).toBe(r.rounds[1]!.ships[0]!.hullPoints - C.deck.fireHull);
    expect(r.rounds.every((x) => x.ships.every((s) => s.fire === undefined))).toBe(true); // and it does not burn on
  });

  it("never takes a ship below 1 Hull, whatever the flash", () => {
    const play = (seed: number) => pots(seed, plain("hunter", { ...big, drill: 5, firePots: 2, hullPoints: 5 }), plain("target", { ...big, hullPoints: 5 }), "hunter");
    const seed = findSeed(play, (r) => r.rounds[2]?.ships[0]?.deck?.thrown?.fire === true && r.rounds[2]!.fires !== undefined);
    const r = play(seed);
    expect(r.rounds[2]!.fires!.map((f) => f.hull)).toEqual([4, 4]);
    expect(r.rounds[2]!.ships.map((s) => s.hullPoints)).toEqual([1, 1]);
    for (let s = 1; s <= 200; s++) for (const round of play(s).rounds) for (const ship of round.ships) expect(ship.hullPoints).toBeGreaterThanOrEqual(1);
  });

  it("lets a Firebrand's fire sink a ship", () => {
    const play = (seed: number) => pots(seed, plain("hunter", { ...big, hullPoints: 20 }), styled("target", "firebrand", big));
    const seed = findSeed(play, (r) => r.outcome.kind === "sunk" && r.outcome.round > 2 && r.rounds.some((x) => x.ships[0]!.fire !== undefined));
    const r = play(seed);
    expect(r.outcome).toMatchObject({ kind: "sunk", winner: "target", loser: "hunter" });
    expect(r.final[0]!.hullPoints).toBe(0);
  });
});

describe("the Fireship (fighting styles spec section 3)", () => {
  it("sets a ship that Rams a Firebrand alight for 2 rounds, and the Firebrand not at all", () => {
    const play = (seed: number) => fight(
      styled("hunter", "rammer", sturdy), styled("target", "firebrand", sturdy),
      scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "roundShot"]), always("hold", "holdFire"), { seed },
    );
    const seed = findSeed(play, (r) => r.rounds[1]?.rams?.[0]?.hit === true);
    const r = play(seed);
    expect(r.rounds[1]!.fires).toEqual([{ source: "ram", ship: FLAGS[0], by: FLAGS[1], rounds: S.firebrand.ramBlazeRounds }]);
    expect(r.rounds[1]!.ships[0]!.fire).toEqual({ hull: 12, left: 1 });
    expect(r.rounds[1]!.ships[1]!.fire).toBeUndefined();
    // A Ram that misses sets nothing alight, and neither does a Ram against a ship that is not a Firebrand.
    const missed = findSeed(play, (x) => x.rounds[1]?.rams?.[0]?.hit === false);
    expect(play(missed).rounds[1]!.fires).toBeUndefined();
    const gun = fight(styled("hunter", "rammer", sturdy), styled("target", "gunline", sturdy), scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "roundShot"]), always("hold", "holdFire"), { seed });
    expect(gun.rounds.every((x) => x.fires === undefined)).toBe(true);
  });

  it("lets the embers of a Firebrand catch on the deck it is lashed to, 40% of the time each round, for 2 rounds", () => {
    // Close In meets Close In at Close: they grapple in round 2, Fists on both decks, and no guns to sink anybody.
    const play = (seed: number) => fight(
      styled("hunter", "firebrand", big), plain("target", { ...big, ...sturdy }), always("closeIn", "holdFire"), always("closeIn", "holdFire"), { seed },
    );
    const seed = findSeed(play, (r) => r.rounds[1]?.fires?.[0]?.source === "embers");
    const r = play(seed);
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(r.rounds[1]!.fires).toEqual([{ source: "embers", ship: FLAGS[1], by: FLAGS[0], rounds: C.fire.rounds }]);
    expect(roll(seed, 2, "embers", FLAGS[0])).toBeLessThan(S.firebrand.emberChance);
    // A burning ship that is Grappled still takes its fire, after the deck fight.
    expect(r.rounds[1]!.melee).not.toBeNull();
    expect(r.rounds[1]!.ships[1]!.fire).toEqual({ hull: 12, left: 1 });
    expect(r.rounds[2]!.ships[1]!.fire?.hull).toBe(12);
  });

  it("rolls embers every round of the deck fight, even for a Firebrand with no pots left", () => {
    let rounds = 0, lit = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = fight(styled("hunter", "firebrand", { ...big, firePots: 0 }), plain("target", { ...big, ...sturdy }), always("closeIn", "holdFire"), always("closeIn", "holdFire"), { seed });
      for (const round of r.rounds) {
        if (round.rangeAfter !== "grappled") continue;
        rounds++;
        if (round.fires?.some((f) => f.source === "embers")) lit++;
      }
    }
    expect(lit / rounds).toBeGreaterThan(0.33);
    expect(lit / rounds).toBeLessThan(0.47);
  });

  it("burns no deck when the Firebrand is not the one lashed to it: a Boarder's embers are none", () => {
    const r = fight(styled("hunter", "boarder", big), plain("target", { ...big, ...sturdy }), always("closeIn", "holdFire"), always("closeIn", "holdFire"), { seed: SEED });
    expect(r.rounds.every((x) => x.fires === undefined)).toBe(true);
  });
});

describe("the order of damage at the end of a round (fire, Hull 0 checks, outcome)", () => {
  it("lets a fire sink a ship in the round a Capture would have happened: Sunk is checked before Captured", () => {
    // The Firebrand boards a crew of six with 12 Hull. The melee would capture it; the embers set it alight and the fire sinks it.
    const play = (seed: number) => fight(
      styled("hunter", "firebrand", big), plain("target", { hands: 6, maxHands: 60, hullPoints: 12 }),
      scripted({}, ["closeIn", "board"]), always("hold", "holdFire"), { seed },
    );
    const seed = findSeed(play, (r) => r.rounds.some((x) => x.edge === "hunter" && x.fires?.some((f) => f.source === "embers")) && r.outcome.kind === "sunk");
    const r = play(seed);
    const round = r.rounds.at(-1)!;
    expect(round.melee!.hands.target).toBe(0); // the melee had already won the boarding
    expect(r.outcome).toMatchObject({ kind: "sunk", winner: "hunter", loser: "target", round: r.rounds.length });
    expect(r.final[1]!.hullPoints).toBe(0);
  });

  it("counts the Hull a fire takes as damage the side that did not burn dealt", () => {
    // A Bombardier shells a ship that cannot sink: its damage share is the shells' Hull and the fire's Hull, over the target's max Hull.
    const play = (seed: number) => fight(styled("hunter", "bombardier"), plain("target", sturdy), always("hold", "mortar"), always("hold", "holdFire"), { seed });
    const seed = findSeed(play, (r) => r.rounds.some((x) => x.ships[1]!.fire !== undefined));
    const r = play(seed);
    const fire = r.rounds.reduce((n, x) => n + (x.ships[1]!.fire?.hull ?? 0), 0);
    const guns = r.rounds.reduce((n, x) => n + x.ships[0]!.shot.damage, 0);
    expect(fire).toBeGreaterThan(0);
    expect(r.dealt.hunter).toBeCloseTo((guns + fire) / 900 / 3, 10);
    expect(r.dealt.target).toBe(0);
  });
});

describe("the streams of fire (D16)", () => {
  it("draws each fire from its own stream: hot shot, mortar, pots and embers never share one", () => {
    const labels = [["hotShot", "ship_hunter"], ["mortar", "ship_hunter"], ["pots", "ship_hunter"], ["embers", "ship_hunter"], ["embers", "ship_target"]] as const;
    const values = labels.map(([a, b]) => roll(SEED, 2, a, b));
    expect(new Set(values).size).toBe(values.length);
  });

  it("leaves the guns luck of a battle where fires burn to its own stream", () => {
    const play = (seed: number) => fight(
      styled("hunter", "firebrand", big), plain("target", { ...big, ...sturdy }), scripted({ 1: ["closeIn", "roundShot"] }, ["hold", "hotShot"]), always("hold", "roundShot"), { seed },
    );
    const seed = findSeed(play, (r) => r.rounds[1]!.fires !== undefined);
    const r = play(seed);
    // The target's Round shot of round 2 at Short: its luck is the one "guns/ship_target" gives for that round, fire or no fire.
    const luck = battleRng(seed, ...FLAGS, 2).stream("guns", "ship_target").range(C.luckMin, C.luckMax);
    expect(r.rounds[1]!.ships[1]!.shot.damage).toBe(Math.round(C.k * C.range.round.short * luck));
  });
});
