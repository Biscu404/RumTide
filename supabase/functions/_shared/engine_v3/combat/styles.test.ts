// Fighting Styles piece 1 (P3.B2, docs/specs/fighting-styles.md): the six distances in battle, Spotters, the Mortar and
// Zeroing In, the Gunline's Braced, Steady Deck and Long Nines, the Skirmisher's Kite, the Rammer's Dash, Ram and spoiled
// rake, the Smuggler's Slippery, the style carried into the record, and fleet mates using their own traits.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { newShip, powerRating } from "../ship.ts";
import { season, ship } from "../testing.ts";
import type { Rng } from "../rng.ts";
import type { FightingStyle } from "../types.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, Chooser, RoundView } from "./battle.ts";
import { doctrineChooser, templateDoctrine } from "./doctrine.ts";
import { battleShipOf, combatEncounter } from "./encounter.ts";
import { mateHelm } from "./fleet.ts";
import { fireGuns, staleNow } from "./guns.ts";
import { battleRng, resolveHelm } from "./helm.ts";
import type { HelmInput } from "./helm.ts";
import { playableOrder, ramHull, zeroingFactor } from "./styles.ts";
import { ScriptedRng, always, battleOf, fleetShip, scripted, styleShip, surrendersAt, testShip } from "./testing.ts";
import type { BattleRecord, BattleShip, BattleSide, HelmMove, Range } from "./types.ts";
import { world } from "../testing.ts";

const C = B.combat;
const S = B.styles;
const SEED = 1234;
const FLAGS: [string, string] = ["ship_hunter", "ship_target"];
const idle = always("hold", "holdFire");
const plain = (side: BattleSide, over: Partial<BattleShip> = {}) => testShip(side, "sloop", over);
/** A target that a fire cannot sink in five rounds: a Mortar now sets ships alight (piece 2), and these tests are about something else. */
const sturdy = () => plain("target", { hullPoints: 900, maxHullPoints: 900 });
const styled = (side: BattleSide, style: FightingStyle, over: Partial<BattleShip> = {}) => styleShip(side, style, "sloop", over);

/** The first Tide seed from 1 up for which a battle satisfies `wanted`. The engine is pure, so this is a fixed answer. */
function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean): number {
  for (let seed = 1; seed < 600; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

const fight = (hunter: BattleShip, target: BattleShip, h: Chooser, t: Chooser, over: Partial<BattleInput> = {}) =>
  runBattle(battleOf(hunter, target, { hunter: h, target: t }, over));

const helm = (moves: Record<BattleSide, HelmMove>, range: Range, hunter: BattleShip, target: BattleShip, rng: Rng = new ScriptedRng(0)) => {
  const input: HelmInput = { range, terrain: "open", hunter, target, moves, gauge: null };
  return resolveHelm(input, rng);
};

const strip = (r: BattleRecord) => JSON.parse(JSON.stringify(r, (k, v) => (k === "style" ? undefined : v)));

// ---------- The style on the ship and in the record ----------

describe("a Fighting Style on the ship (P3.B2)", () => {
  it("is carried from the Ship into the battle and into the record, so a replay can show the badge", () => {
    const s = season([{ id: "h", name: "H", shipName: "Hunter", style: "rammer" }, { id: "t", name: "T", shipName: "Target" }]);
    expect(ship(s, "h").style).toBe("rammer");
    expect(ship(s, "t")).not.toHaveProperty("style");
    const flags = { charted: false, withCurrent: false, lurker: false };
    const h = battleShipOf(ship(s, "h"), s.captains.h!, "hunter", flags);
    const t = battleShipOf(ship(s, "t"), s.captains.t!, "target", flags);
    expect(h.style).toBe("rammer");
    expect(t).not.toHaveProperty("style");
    const r = fight(h, t, idle, idle);
    expect(r.ships.map((x) => x.style)).toEqual(["rammer", undefined]);
    expect(r.final.map((x) => x.style)).toEqual(["rammer", undefined]);
  });

  it("gives a captain who picks a style its template doctrine, and the Bombardier its small crew", () => {
    const s = season([{ id: "b", name: "B", shipName: "Bomb", style: "bombardier" }, { id: "g", name: "G", shipName: "Line", style: "gunline" }]);
    expect(s.captains.b!.doctrines.map((d) => d.name)).toEqual(["Bombardier"]);
    expect(s.captains.b!.defaultDoctrine).toBe("Bombardier");
    expect(s.captains.g!.defaultDoctrine).toBe("Gunline");
    expect(ship(s, "b").hands).toBe(18);
    const flags = { charted: false, withCurrent: false, lurker: false };
    expect(battleShipOf(ship(s, "b"), s.captains.b!, "hunter", flags)).toMatchObject({ maxHands: 18, hands: 18 });
    expect(powerRating(ship(s, "b"))).toBe(10);
  });

  it("pays a trait only in a round its own move or order is played: a battle where none fires is the same battle", () => {
    // A Gunline that never Holds, a Skirmisher that never Opens Range: nothing of either style counts.
    const charge = always("closeIn", "roundShot");
    const withStyles = fight(styled("hunter", "gunline"), styled("target", "skirmisher"), charge, charge);
    const without = fight(plain("hunter"), plain("target"), charge, charge);
    expect(strip(withStyles)).toEqual(strip(without));
  });
});

// ---------- Spotters and the six distances ----------

describe("Spotters and the starting range (spec section 1)", () => {
  it("starts a battle with a Bombardier flagship at Far, on either side", () => {
    expect(fight(styled("hunter", "bombardier"), plain("target"), idle, idle).startRange).toBe("far");
    expect(fight(plain("hunter"), styled("target", "bombardier"), idle, idle).startRange).toBe("far");
    expect(fight(plain("hunter"), plain("target"), idle, idle).startRange).toBe("long");
  });

  it("keeps the Fog start at Medium, Kelp at Medium, and a Lurker's ambush at Medium", () => {
    const bomb = styled("hunter", "bombardier");
    expect(fight(bomb, plain("target"), idle, idle, { terrain: "fog" }).startRange).toBe("medium");
    expect(fight(bomb, plain("target"), idle, idle, { terrain: "kelp" }).startRange).toBe("medium");
    expect(fight(bomb, plain("target"), idle, idle, { ambush: "medium" }).startRange).toBe("medium");
    expect(fight(bomb, plain("target"), idle, idle, { ambush: "long" }).startRange).toBe("far");
  });

  it("counts only the flagships: a Bombardier fleet mate does not move the start", () => {
    const r = runBattle(battleOf(fleetShip("a", "hunter"), fleetShip("c", "target"), { hunter: idle, target: idle }, {
      mates: { hunter: [{ ship: fleetShip("b", "hunter", "sloop", { style: "bombardier" }), doctrine: "x", chooser: idle }], target: [] },
    }));
    expect(r.startRange).toBe("long");
  });

  it("lets a ship escape by going past Far, so from Far one turn away is enough", () => {
    const r = fight(styled("hunter", "bombardier"), plain("target"), idle, always("openRange", "roundShot"));
    expect(r.outcome).toMatchObject({ kind: "escaped", round: 1 });
    expect(r.rounds[0]!.rangeAfter).toBe("far");
  });

  it("finds Spotters for a Bombardier captain in an encounter too", () => {
    const s = season([{ id: "h", name: "H", shipName: "Hunter", water: "gh_lee", style: "bombardier" }, { id: "t", name: "T", shipName: "Target", water: "gh_lee" }]);
    const side = (id: string) => ({
      ship: ship(s, id), captain: s.captains[id]!, stance: "trade" as const, doctrine: undefined, lurking: false, ambushRange: undefined,
      charted: true, withCurrent: false,
    });
    const out = combatEncounter({
      world, state: s, tide: s.tide, seed: SEED, t: 3, at: "gh_lee", onLane: false, archipelago: "cradle", terrain: "open",
      wind: { kind: "breeze", from: 270 }, hunter: { ...side("h"), filter: { kind: "anyone" } }, target: side("t"), mutual: true,
      rng: new ScriptedRng(0.99),
    });
    const battle = out.events?.find((e) => e.kind === "battle");
    expect(battle?.kind === "battle" && battle.record.startRange).toBe("far");
    expect(battle?.kind === "battle" && battle.record.doctrines.hunter).toBe("Bombardier");
  });
});

// ---------- The Bombardier ----------

describe("the Mortar (spec section 3, D137)", () => {
  const bomb = () => styled("hunter", "bombardier");
  const shell = always("hold", "mortar");

  it("hits Hull by the Mortar row of the table, and does nothing at Short or Close", () => {
    const rng = new ScriptedRng(0); // a roll of 0 hits
    const at = (range: Range) => fireGuns(bomb(), plain("target"), range, "mortar", rng, { terrain: "open", helmMod: 1 });
    expect(at("far")).toMatchObject({ track: "hull", factors: { range: 1.1 } });
    expect(at("long").factors?.range).toBe(1.1);
    expect(at("medium").factors?.range).toBe(0.85);
    expect(at("short").damage).toBe(0);
    expect(at("close").damage).toBe(0);
    expect(at("grappled").damage).toBe(0);
  });

  it("rolls each shell's hit from its own stream, 80% of the time, and a miss does no harm but burns its Powder", () => {
    const play = (seed: number) => fight(bomb(), plain("target"), shell, idle, { seed });
    const hitSeed = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === true);
    const missSeed = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === false);
    for (const seed of [hitSeed, missSeed]) {
      const first = play(seed).rounds[0]!.ships[0]!;
      const roll = battleRng(seed, ...FLAGS, 1).stream("mortar", "ship_hunter").next();
      expect(first.mortar).toMatchObject({ roll, hit: roll < S.bombardier.mortarHit });
      expect(first.guns).toBe("mortar");
      expect(first.shot.powderUsed).toBe(1);
    }
    expect(play(missSeed).rounds[0]!.ships[0]!.shot.damage).toBe(0);
    expect(play(hitSeed).rounds[0]!.ships[0]!.shot.damage).toBeGreaterThan(0);
    // Over many shells about four in five land.
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (fireGuns(bomb(), plain("target"), "far", "mortar", battleRng(i, ...FLAGS, 1)).shell?.hit) hits++;
    expect(hits / 2000).toBeGreaterThan(0.77);
    expect(hits / 2000).toBeLessThan(0.83);
  });

  it("does what the formula says on a hit, at Far, with Zeroing In", () => {
    const play = (seed: number) => fight(bomb(), plain("target"), shell, idle, { seed });
    const seed = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === true);
    const expected = fireGuns(bomb(), plain("target"), "far", "mortar", battleRng(seed, ...FLAGS, 1), { terrain: "open", helmMod: 1, zeroing: 1.1 });
    expect(play(seed).rounds[0]!.ships[0]!.shot.damage).toBe(expected.damage);
  });

  it("never goes stale", () => {
    const memory = { order: "mortar" as const, repeats: 4, charged: false };
    expect(staleNow(memory, "mortar")).toBe(false);
    const ship = bomb();
    const r = fireGuns({ ...ship, guns: memory }, plain("target"), "far", "mortar", new ScriptedRng(0), { terrain: "open", helmMod: 1 });
    expect(r.factors?.stale).toBe(1);
    expect(staleNow({ order: "roundShot", repeats: 4, charged: false }, "roundShot")).toBe(true);
  });

  it("takes the rake, flank and weakened factors of the Helm step", () => {
    const rng = () => new ScriptedRng(0);
    const plainShot = fireGuns(bomb(), plain("target"), "far", "mortar", rng(), { terrain: "open", helmMod: 1 });
    const raked = fireGuns(bomb(), plain("target"), "far", "mortar", rng(), { terrain: "open", helmMod: C.rake });
    expect(raked.raw / plainShot.raw).toBeCloseTo(C.rake);
    // In a battle: the Bombardier crosses the bow of a ship that holds at Far, and the shell lands as a rake.
    const play = (seed: number) => fight(bomb(), plain("target"), always("crossTheirBow", "mortar"), idle, { seed });
    const seed = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === true);
    const expected = fireGuns(bomb(), plain("target"), "far", "mortar", battleRng(seed, ...FLAGS, 1), { terrain: "open", helmMod: C.rake, zeroing: 1.1 });
    expect(play(seed).rounds[0]!.row).toBe("crossHold");
    expect(play(seed).rounds[0]!.ships[0]!.shot.damage).toBe(expected.damage);
  });

  it("is weaker in Fog and in Rocky water at Far, as at Long", () => {
    const at = (terrain: "fog" | "rocky" | "open", range: Range) =>
      fireGuns(bomb(), plain("target"), range, "mortar", new ScriptedRng(0), { terrain, helmMod: 1 }).factors?.terrain;
    expect(at("fog", "far")).toBe(C.terrainGuns.fogLong);
    expect(at("rocky", "far")).toBe(C.terrainGuns.rockyLong);
    expect(at("fog", "long")).toBe(C.terrainGuns.fogLong);
    expect(at("open", "far")).toBe(1);
    expect(fireGuns(plain("hunter"), plain("target"), "far", "roundShot", new ScriptedRng(0), { terrain: "fog", helmMod: 1 }).factors?.terrain).toBe(C.terrainGuns.fogLong);
  });

  it("can be named by any doctrine, but a ship that is not a Bombardier fires Round shot, and the record says so", () => {
    expect(playableOrder(plain("hunter"), "mortar")).toBe("roundShot");
    expect(playableOrder(bomb(), "mortar")).toBe("mortar");
    expect(playableOrder(plain("hunter"), "chainShot")).toBe("chainShot");
    const seen: RoundView[] = [];
    const spy: Chooser = (view) => { seen.push(view); return { kind: "fight", rule: 0, abilities: [], helm: "hold", guns: "holdFire" }; };
    const copied = fight(plain("hunter"), plain("target"), shell, spy);
    const round = fight(plain("hunter"), plain("target"), always("hold", "roundShot"), idle);
    expect(copied.rounds[0]!.ships[0]).toMatchObject({ guns: "roundShot", asked: "mortar" });
    expect(copied.rounds[0]!.ships[0]!.mortar).toBeUndefined();
    // Seeded the same way as Round shot: everything else in the record is the battle a Round shot doctrine plays.
    const noAsked = JSON.parse(JSON.stringify(copied, (k, v) => (k === "asked" ? undefined : v)));
    expect(noAsked.rounds).toEqual(JSON.parse(JSON.stringify(round.rounds)));
    expect(seen[1]!.last.hunter).toEqual({ helm: "hold", guns: "roundShot" }); // the other ship sees what was fired
    expect(copied.final[0]!.guns.order).toBe("roundShot");
  });

  it("records no asked order in a round the colours come down, where every ship is written down as holding fire", () => {
    const r = fight(plain("hunter"), plain("target"), shell, surrendersAt(1, idle));
    expect(r.rounds[0]!.struck).toEqual(["target"]);
    expect(r.rounds[0]!.ships[0]).toMatchObject({ helm: "hold", guns: "holdFire" });
    expect(r.rounds[0]!.ships[0]).not.toHaveProperty("asked");
  });

  it("does not move the other ship's rolls: its guns hit the same whether the Bombardier shells or shoots", () => {
    const target = always("hold", "roundShot");
    const shelling = fight(bomb(), sturdy(), shell, target);
    const shooting = fight(bomb(), sturdy(), always("hold", "roundShot"), target);
    expect(shelling.rounds.map((r) => r.ships[1]!.shot.damage)).toEqual(shooting.rounds.map((r) => r.ships[1]!.shot.damage));
  });
});

describe("Zeroing In (spec section 3)", () => {
  const bomb = () => styled("hunter", "bombardier");
  const zeroings = (r: BattleRecord) => r.rounds.map((x) => x.ships[0]!.mortar?.zeroing ?? null);

  it("adds 10% for each round in a row the range has not changed, up to 50%", () => {
    const r = fight(bomb(), sturdy(), always("hold", "mortar"), idle);
    const z = zeroings(r);
    expect(z.length).toBe(5);
    [1.1, 1.2, 1.3, 1.4, 1.5].forEach((want, i) => expect(z[i]).toBeCloseTo(want));
    expect(zeroingFactor(9)).toBe(S.bombardier.zeroMax);
    expect(zeroingFactor(0)).toBe(1);
  });

  it("starts again whenever the range changes", () => {
    const target = scripted({ 3: ["closeIn", "holdFire"] }, ["hold", "holdFire"]);
    const r = fight(bomb(), sturdy(), always("hold", "mortar"), target);
    expect(r.rounds.map((x) => x.rangeAfter)).toEqual(["far", "far", "long", "long", "long"]);
    const z = zeroings(r);
    [1.1, 1.2, 1, 1.1, 1.2].forEach((want, i) => expect(z[i]).toBeCloseTo(want));
  });

  it("counts only rounds the Mortar fires", () => {
    const r = fight(bomb(), sturdy(), scripted({ 3: ["hold", "roundShot"] }, ["hold", "mortar"]), idle);
    const z = zeroings(r);
    expect(z[2]).toBeNull();
    [1.1, 1.2, null, 1.1, 1.2].forEach((want, i) => (want === null ? expect(z[i]).toBeNull() : expect(z[i]).toBeCloseTo(want)));
  });
});

// ---------- The Gunline ----------

describe("the Gunline (spec section 3)", () => {
  const line = (side: BattleSide = "hunter") => styled(side, "gunline");

  it("Braced: in a round it Holds a rake against it is x1.35, and it is not weakened by it", () => {
    const r = helm({ hunter: "hold", target: "crossTheirBow" }, "medium", line(), plain("target"));
    expect(r.row).toBe("crossHold");
    expect(r.gunsMod.target).toBe(S.gunline.bracedRake);
    expect(r.gunsMod.hunter).toBeCloseTo(S.gunline.steadyDeck); // not weakened, and Steady Deck on top
    const unbraced = helm({ hunter: "hold", target: "crossTheirBow" }, "medium", plain("hunter"), plain("target"));
    expect(unbraced.gunsMod).toEqual({ hunter: C.weakened, target: C.rake });
    // A Gunline that Closes In is raked as anyone is.
    expect(helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", line(), plain("target")).gunsMod).toEqual({ hunter: C.weakened, target: C.rake });
  });

  it("Steady Deck: in a round it Holds its guns do 40% more", () => {
    expect(helm({ hunter: "hold", target: "hold" }, "medium", line(), plain("target")).gunsMod.hunter).toBeCloseTo(1.4);
    expect(helm({ hunter: "hold", target: "openRange" }, "medium", line(), plain("target")).gunsMod).toEqual({ hunter: 1.4, target: C.weakened });
    expect(helm({ hunter: "closeIn", target: "hold" }, "medium", line(), plain("target")).gunsMod.hunter).toBe(1);
    expect(helm({ hunter: "hold", target: "hold" }, "medium", plain("hunter"), line("target")).gunsMod).toEqual({ hunter: 1, target: 1.4 });
  });

  it("Long Nines: in a round it Holds its Round shot at Long counts 0.8 instead of 0.6", () => {
    const rng = () => new ScriptedRng(0);
    const at = (range: Range, longNines: boolean, order: "roundShot" | "chainShot" = "roundShot") =>
      fireGuns(line(), plain("target"), range, order, rng(), { terrain: "open", helmMod: 1, ...(longNines ? { longNines: true } : {}) }).factors?.range;
    expect(at("long", true)).toBe(S.gunline.longNines);
    expect(at("long", false)).toBe(C.range.round.long);
    expect(at("far", true)).toBe(C.range.round.far);
    expect(at("medium", true)).toBe(C.range.round.medium);
    expect(at("long", true, "chainShot")).toBe(C.range.chain.long);
    // In a battle: only the Gunline that Holds fires Long Nines.
    const r = fight(line(), plain("target"), always("hold", "roundShot"), always("hold", "roundShot"));
    const hunterShot = fireGuns(line(), plain("target"), "long", "roundShot", battleRng(SEED, ...FLAGS, 1), { terrain: "open", helmMod: S.gunline.steadyDeck, longNines: true });
    const targetShot = fireGuns(plain("target"), line(), "long", "roundShot", battleRng(SEED, ...FLAGS, 1), { terrain: "open", helmMod: 1 });
    expect(r.rounds[0]!.ships.map((s) => s.shot.damage)).toEqual([hunterShot.damage, targetShot.damage]);
  });

  it("Braced: a Ram against a Gunline that Holds does 70%", () => {
    expect(ramHull(line(), "hold")).toBe(Math.round(S.rammer.ramHull * S.gunline.bracedRam));
    expect(ramHull(line(), "closeIn")).toBe(S.rammer.ramHull);
    expect(ramHull(plain("target"), "hold")).toBe(S.rammer.ramHull);
  });
});

// ---------- The Skirmisher and the Smuggler ----------

describe("the Skirmisher's Kite and the Smuggler's Slippery (spec section 3)", () => {
  it("Kite: Opening Range does not weaken a Skirmisher's guns", () => {
    expect(helm({ hunter: "hold", target: "openRange" }, "medium", plain("hunter"), styled("target", "skirmisher")).gunsMod).toEqual({ hunter: 1, target: 1 });
    expect(helm({ hunter: "hold", target: "openRange" }, "medium", plain("hunter"), plain("target")).gunsMod).toEqual({ hunter: 1, target: C.weakened });
    // A Skirmisher that Crosses and fails against Open Range is still weakened: Kite is for the ship that Opens.
    expect(helm({ hunter: "crossTheirBow", target: "openRange" }, "medium", styled("hunter", "skirmisher"), plain("target")).gunsMod.hunter).toBe(C.weakened);
  });

  it("Slippery: a Smuggler's Helm counts 25% more in a round it Opens Range, in every contest", () => {
    const smug = styled("target", "smuggler");
    const r = helm({ hunter: "closeIn", target: "openRange" }, "medium", plain("hunter"), smug);
    expect(r.scores.target).toBeCloseTo(10 * S.smuggler.slippery);
    expect(r.contests[0]!.chance).toBeCloseTo(10 / (10 + 10 * S.smuggler.slippery));
    expect(helm({ hunter: "closeIn", target: "hold" }, "medium", plain("hunter"), smug).scores.target).toBe(10);
    // Cutting free is an Open Range too.
    expect(helm({ hunter: "closeIn", target: "openRange" }, "grappled", plain("hunter"), smug).scores.target).toBeCloseTo(12.5);
  });
});

// ---------- The Rammer ----------

describe("the Rammer's Dash (spec section 3)", () => {
  const ram = (side: BattleSide = "hunter", over: Partial<BattleShip> = {}) => styled(side, "rammer", over);

  it("moves a Close In one band further, so it closes two bands a round against a ship that Holds", () => {
    const vsHold = (range: Range) => helm({ hunter: "closeIn", target: "hold" }, range, ram(), plain("target")).range;
    expect(vsHold("far")).toBe("medium");
    expect(vsHold("long")).toBe("short");
    expect(vsHold("medium")).toBe("close");
    expect(vsHold("short")).toBe("close"); // never past Close
    expect(vsHold("close")).toBe("close"); // and never into a grapple
    expect(helm({ hunter: "closeIn", target: "closeIn" }, "long", ram(), plain("target")).range).toBe("close");
    expect(helm({ hunter: "closeIn", target: "closeIn" }, "far", ram(), ram("target")).range).toBe("close"); // two Rammers dash at once
    expect(helm({ hunter: "closeIn", target: "hold" }, "long", plain("hunter"), plain("target")).range).toBe("medium");
  });

  it("dashes only when the ships come nearer: a lost chase is not a dash", () => {
    expect(helm({ hunter: "closeIn", target: "openRange" }, "long", ram(), plain("target"), new ScriptedRng(0)).range).toBe("short"); // won the chase
    expect(helm({ hunter: "closeIn", target: "openRange" }, "long", ram(), plain("target"), new ScriptedRng(0.99)).range).toBe("far"); // lost it
    expect(helm({ hunter: "hold", target: "openRange" }, "long", ram(), plain("target")).range).toBe("far");
  });

  it("still needs a big ship to win its Shallows contest to reach Close", () => {
    const brig = styleShip("hunter", "rammer", "brigantine");
    const input: HelmInput = { range: "medium", terrain: "shallows", hunter: brig, target: plain("target"), moves: { hunter: "closeIn", target: "hold" }, gauge: null };
    const lost = resolveHelm(input, new ScriptedRng(0.99));
    expect(lost.range).toBe("short");
    expect(lost.contests.map((c) => c.kind)).toEqual(["shallows"]);
  });

  it("can spoil the rake of a ship that crosses its bow: a Helm contest, and the rake is x1.75 and the Rammer not weakened", () => {
    const won = helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", ram(), plain("target"), new ScriptedRng(0));
    expect(won.contests).toMatchObject([{ kind: "dash", side: "hunter", winner: "hunter" }]);
    expect(won.gunsMod).toEqual({ hunter: 1, target: S.rammer.spoiledRake });
    const lost = helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", ram(), plain("target"), new ScriptedRng(0.99));
    expect(lost.contests).toMatchObject([{ kind: "dash", winner: "target" }]);
    expect(lost.gunsMod).toEqual({ hunter: C.weakened, target: C.rake });
    // Its own stream: "helm/dash/<side>".
    const rng = battleRng(SEED, ...FLAGS, 1);
    const real = helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", ram(), plain("target"), rng);
    expect(real.contests[0]!.roll).toBe(battleRng(SEED, ...FLAGS, 1).stream("helm", "dash", "hunter").next());
    // A ship that is not a Rammer has no dash to spoil anything with.
    expect(helm({ hunter: "closeIn", target: "crossTheirBow" }, "medium", plain("hunter"), plain("target")).contests).toEqual([]);
  });
});

describe("the Ram (spec section 3, D139)", () => {
  const rammer = (side: BattleSide = "hunter", over: Partial<BattleShip> = {}) => styled(side, "rammer", over);
  const NEAR = { ambush: "medium" } as const; // round 1: both Close In from Medium and reach Close; round 2 is at Close
  const charge = always("closeIn", "holdFire");
  const round2 = (move: HelmMove, guns: "holdFire" | "roundShot" | "board" = "holdFire") => scripted({ 1: ["closeIn", "holdFire"] }, [move, guns]);
  const play = (target: Chooser, opts: { seed?: number; hunter?: BattleShip; foe?: BattleShip; me?: Chooser } = {}) =>
    fight(opts.hunter ?? rammer(), opts.foe ?? plain("target"), opts.me ?? charge, target, { ...NEAR, seed: opts.seed ?? SEED });

  it("lands at Close on a Helm contest from its own stream: 30 Hull to them and 4 to the Rammer", () => {
    const seed = findSeed((s) => play(round2("hold"), { seed: s }), (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    const r = play(round2("hold"), { seed });
    expect(r.rounds[0]!.rangeAfter).toBe("close");
    expect(r.rounds[0]!.rams).toBeUndefined(); // no Ram from Medium
    expect(r.rounds[1]!.rams).toEqual([{ side: "hunter", hit: true, why: "contest", hull: S.rammer.ramHull, self: S.rammer.ramSelf }]);
    const contest = r.rounds[1]!.contests.find((c) => c.kind === "ram")!;
    expect(contest).toMatchObject({ side: "hunter", winner: "hunter", chance: 0.5 });
    expect(contest.roll).toBe(battleRng(seed, ...FLAGS, 2).stream("ram", "ship_hunter").next());
    expect(r.rounds[1]!.ships.map((s) => s.hullPoints)).toEqual([100 - S.rammer.ramSelf, 100 - S.rammer.ramHull]);
    // The struck Hull counts for the Rammer, and its own for the other side (D56), in every round it rams (nobody fires).
    const rams = r.rounds.flatMap((x) => x.rams ?? []);
    expect(rams.length).toBeGreaterThan(1);
    expect(r.dealt.hunter).toBeCloseTo(rams.reduce((n, x) => n + x.hull, 0) / 100 / 3);
    expect(r.dealt.target).toBeCloseTo(rams.reduce((n, x) => n + x.self, 0) / 100 / 3);
  });

  it("misses when the contest is lost, and nothing is taken", () => {
    const seed = findSeed((s) => play(round2("hold"), { seed: s }), (r) => r.rounds[1]!.rams?.[0]?.hit === false);
    const r = play(round2("hold"), { seed });
    expect(r.rounds[1]!.rams).toEqual([{ side: "hunter", hit: false, why: "contest", hull: 0, self: 0 }]);
    expect(r.rounds[1]!.ships.map((s) => s.hullPoints)).toEqual([100, 100]);
  });

  it("misses against Cross Their Bow, with no contest for the Ram", () => {
    const r = play(round2("crossTheirBow"));
    expect(r.rounds[1]!.rams).toEqual([{ side: "hunter", hit: false, why: "crossed", hull: 0, self: 0 }]);
    expect(r.rounds[1]!.contests.map((c) => c.kind)).toEqual(["dash"]); // only the dash spoiling the rake
  });

  it("misses when the other ship wins the chase", () => {
    const seed = findSeed((s) => play(round2("openRange"), { seed: s }), (r) => r.rounds[1]!.contests[0]?.winner === "target");
    const r = play(round2("openRange"), { seed });
    expect(r.rounds[1]!.rangeAfter).toBe("short");
    expect(r.rounds[1]!.rams).toEqual([{ side: "hunter", hit: false, why: "outrun", hull: 0, self: 0 }]);
    const caught = findSeed((s) => play(round2("openRange"), { seed: s }), (r) => r.rounds[1]!.contests[0]?.winner === "hunter");
    expect(play(round2("openRange"), { seed: caught }).rounds[1]!.rams?.[0]?.why).toBe("contest");
  });

  it("never grapples: a Ram that lands keeps a mutual Close In at Close from grappling, and one that misses does not", () => {
    const hit = findSeed((s) => play(charge, { seed: s }), (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    expect(play(charge, { seed: hit }).rounds[1]).toMatchObject({ rangeAfter: "close", melee: null });
    const miss = findSeed((s) => play(charge, { seed: s }), (r) => r.rounds[1]!.rams?.[0]?.hit === false);
    expect(play(charge, { seed: miss }).rounds[1]!.rangeAfter).toBe("grappled"); // a missed Ram is a plain Close In (D35)
  });

  it("lands first, and then a Board can still grapple", () => {
    const me = scripted({ 1: ["closeIn", "holdFire"] }, ["closeIn", "board"]);
    const seed = findSeed((s) => play(round2("hold"), { seed: s, me }), (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    const r = play(round2("hold"), { seed, me });
    expect(r.rounds[1]!.grapples).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(r.rounds[1]!.melee).not.toBeNull();
  });

  it("lets two Rammers both Ram in the same round, each from its own stream", () => {
    const both = (s: number) => play(charge, { seed: s, foe: rammer("target"), hunter: rammer() });
    const seed = findSeed(both, (r) => (r.rounds[1]!.rams ?? []).every((x) => x.hit) && (r.rounds[1]!.rams ?? []).length === 2);
    const r = both(seed);
    expect(r.rounds[1]!.rams!.map((x) => [x.side, x.hit])).toEqual([["hunter", true], ["target", true]]);
    expect(r.rounds[1]!.ships.map((s) => s.hullPoints)).toEqual([100 - 30 - 4, 100 - 30 - 4]);
    expect(r.rounds[1]!.contests.filter((c) => c.kind === "ram").map((c) => c.roll)).toEqual([
      battleRng(seed, ...FLAGS, 2).stream("ram", "ship_hunter").next(),
      battleRng(seed, ...FLAGS, 2).stream("ram", "ship_target").next(),
    ]);
    expect(r.rounds[1]!.rangeAfter).toBe("close");
  });

  it("can be tried by a Crippled Rammer, which can still Close In", () => {
    const r = play(round2("hold"), { hunter: rammer("hunter", { riggingPoints: 0 }) });
    expect(r.rounds[1]!.rams?.[0]?.why).toBe("contest");
    expect(r.rounds[1]!.contests.find((c) => c.kind === "ram")!.chance).toBe(0); // with no Rigging it scores 0
  });

  it("does 70% against a Gunline that Holds, and can sink a ship", () => {
    const braced = findSeed((s) => play(round2("hold"), { seed: s, foe: styled("target", "gunline") }), (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    expect(play(round2("hold"), { seed: braced, foe: styled("target", "gunline") }).rounds[1]!.rams![0]!.hull).toBe(21);
    const sink = findSeed((s) => play(round2("hold"), { seed: s, foe: plain("target", { hullPoints: 20 }) }), (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    const r = play(round2("hold"), { seed: sink, foe: plain("target", { hullPoints: 20 }) });
    expect(r.rounds[1]!.rams![0]!.hull).toBe(20); // never more than it has
    expect(r.outcome).toMatchObject({ kind: "sunk", winner: "hunter", round: 2 });
  });

  it("is only a Rammer's: another ship's Close In at Close is a plain Close In", () => {
    const r = play(round2("hold"), { hunter: plain("hunter") });
    expect(r.rounds[1]!.rams).toBeUndefined();
  });

  it("lets a fleet mate Ram the enemy flagship, judged against its move, and the Ram lands on the flagship alone", () => {
    const mate = fleetShip("b", "hunter", "sloop", { style: "rammer" });
    const fleetPlay = (seed: number) => runBattle(battleOf(fleetShip("a", "hunter"), fleetShip("c", "target"), {
      hunter: scripted({ 1: ["closeIn", "holdFire"] }, ["hold", "holdFire"]),
      target: scripted({ 1: ["closeIn", "holdFire"] }, ["hold", "holdFire"]),
    }, { seed, ...NEAR, mates: { hunter: [{ ship: mate, doctrine: "Rammer", chooser: charge }], target: [] }, playerSide: { hunter: true, target: true } }));
    const seed = findSeed(fleetPlay, (r) => r.rounds[1]!.rams?.[0]?.hit === true);
    const r = fleetPlay(seed);
    expect(r.rounds[1]!.rams).toEqual([{ side: "hunter", ship: "ship_b", hit: true, why: "contest", hull: 30, self: 4 }]);
    expect(r.rounds[1]!.contests.find((c) => c.kind === "ram")).toMatchObject({ ship: "ship_b", side: "hunter" });
    const hull = (id: string) => r.rounds[1]!.ships.find((s) => s.ship === id)!.hullPoints;
    expect([hull("ship_a"), hull("ship_b"), hull("ship_c")]).toEqual([100, 96, 70]);
    expect(r.rounds[1]!.rangeAfter).toBe("close"); // a mate's Close In never moves the range
    expect(r.fleet!.dealtBy.ship_b).toBeGreaterThan(0);
  });
});

// ---------- Fleet mates use their own traits ----------

describe("fleet mates and the styles (spec section 7)", () => {
  it("give a mate its own Kite, Steady Deck, Braced and Slippery, judged against the enemy flagship", () => {
    const rng = new ScriptedRng(0);
    const foe = (move: HelmMove, style?: FightingStyle) => ({ move, score: 10, ...(style ? { ship: { style } } : {}) });
    const mate = (style: FightingStyle) => fleetShip("b", "hunter", "sloop", { style });
    expect(mateHelm(mate("skirmisher"), "openRange", 10, foe("hold"), "medium", "open", rng).gunsMod).toBe(1);
    expect(mateHelm(fleetShip("b", "hunter"), "openRange", 10, foe("hold"), "medium", "open", rng).gunsMod).toBe(C.weakened);
    expect(mateHelm(mate("gunline"), "hold", 10, foe("crossTheirBow"), "medium", "open", rng).gunsMod).toBeCloseTo(S.gunline.steadyDeck);
    expect(mateHelm(fleetShip("b", "hunter"), "crossTheirBow", 10, foe("hold", "gunline"), "medium", "open", rng).gunsMod).toBe(S.gunline.bracedRake);
    expect(mateHelm(mate("smuggler"), "openRange", 10, foe("closeIn"), "medium", "open", rng).score).toBeCloseTo(12.5);
    expect(mateHelm(mate("smuggler"), "hold", 10, foe("closeIn"), "medium", "open", rng).score).toBe(10);
  });
});

// ---------- The style condition in a battle ----------

describe("their style is X in a battle (D128)", () => {
  it("lets a doctrine plan for the counter it fears, and never fires against a ship with no style", () => {
    const wary = doctrineChooser({
      name: "Wary",
      rules: [
        { if: [{ kind: "theirStyle", style: "rammer" }], then: { kind: "fight", helm: "openRange", guns: "chainShot" } },
        { if: [], then: { kind: "fight", helm: "hold", guns: "roundShot" } },
      ],
    }, { enemyType: "player" });
    const vsRammer = fight(styled("hunter", "rammer"), plain("target"), idle, wary);
    expect(vsRammer.rounds[0]!.ships[1]).toMatchObject({ rule: 0, helm: "openRange" });
    const vsNone = fight(plain("hunter"), plain("target"), idle, wary);
    expect(vsNone.rounds[0]!.ships[1]).toMatchObject({ rule: 1, helm: "hold" });
  });

  it("plays the templates with their traits: a Smuggler slips away from a Bombardier at Far in the first round", () => {
    const r = fight(styled("hunter", "bombardier"), styled("target", "smuggler"),
      doctrineChooser(templateDoctrine("Bombardier"), { enemyType: "player" }), doctrineChooser(templateDoctrine("Smuggler"), { enemyType: "player" }));
    expect(r.startRange).toBe("far");
    expect(r.rounds[0]!.ships.map((s) => [s.helm, s.guns])).toEqual([["hold", "mortar"], ["openRange", "chainShot"]]);
    expect(r.outcome).toMatchObject({ kind: "escaped", round: 1 });
  });
});

// ---------- Power Rating and the style ----------

describe("Power Rating and the styles (D136, spec section 7)", () => {
  it("is 10 for a fresh sloop of any style", () => {
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "smuggler"] as const) {
      expect(powerRating(newShip("s", "c", "S", "sloop", "gh_harbour", true, style)), style).toBe(10);
    }
  });
});
