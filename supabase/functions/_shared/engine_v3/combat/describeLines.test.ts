// The replay in words for the Fighting Styles, the deck fight and fire (P3.B2 piece 3, docs/text/replay-lines.md): every kind of line is
// told from a real battle record of the engine. A line has up to three variants and the telling picks one by a stable hash, so a test
// asks whether the text holds ONE OF the line's variants, filled in with the record's own numbers.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, Chooser } from "./battle.ts";
import { describeBattle, fillLine, lineVariants } from "./describe.ts";
import type { Vars } from "./describe.ts";
import { LINES } from "./lines.ts";
import type { LineKey } from "./lines.ts";
import { always, battleOf, fleetShip, scripted, styleShip, testShip } from "./testing.ts";
import type { BattleAftermath, BattleRecord, BattleShip, GunsOrder, HelmMove } from "./types.ts";
import type { FightingStyle } from "../types.ts";

const words = { place: (id: string) => `<${id}>` };
const none: BattleAftermath = {
  pvp: true, winner: null, loser: null, loot: null, wreck: null, flotsam: [], bounty: { added: 0, collected: 0 }, shieldUntil: null, towed: false,
};
const NEAR: Partial<BattleInput> = { ambush: "medium" };
const big = { hands: 60, maxHands: 60 };
const H = "The hunter";
const T = "The target";

const styled = (side: "hunter" | "target", style: FightingStyle, over: Partial<BattleShip> = {}) => styleShip(side, style, "sloop", over);
const plain = (side: "hunter" | "target", over: Partial<BattleShip> = {}) => testShip(side, "sloop", over);
const fight = (hunter: BattleShip, target: BattleShip, h: Chooser, t: Chooser, input: Partial<BattleInput> = {}): BattleRecord =>
  runBattle(battleOf(hunter, target, { hunter: h, target: t }, input));

/** The story of a battle as trimmed lines. */
const told = (record: BattleRecord, aftermath: BattleAftermath = none): string[] => describeBattle(record, aftermath, words).map((l) => l.trim());
const used = new Set<LineKey>(); // the keys a test has seen in a story
/** Does the story hold a line that is one of the key's variants, filled in with `vars`? */
const has = (lines: string[], key: LineKey, vars: Vars): boolean => {
  const found = lineVariants(key, vars).some((v) => lines.includes(v));
  if (found) used.add(key);
  return found;
};
/** The same, as a message that says what was missing. */
const need = (lines: string[], key: LineKey, vars: Vars): void => {
  if (!has(lines, key, vars)) throw new Error(`No variant of ${key} in the story. Wanted one of:\n${lineVariants(key, vars).join("\n")}\nThe story:\n${lines.join("\n")}`);
};

/** The first Tide seed from 1 up for which a battle satisfies `wanted`. The engine is pure, so this is a fixed answer. */
function findSeed(play: (seed: number) => BattleRecord, wanted: (r: BattleRecord) => boolean, upTo = 1500): number {
  for (let seed = 1; seed < upTo; seed++) if (wanted(play(seed))) return seed;
  throw new Error("no seed found");
}

/** The hunter closes in and Boards in rounds 1 and 2 against a target that Holds, so it grapples in round 2 with the edge. */
const boardsInRound2 = (after: [HelmMove, GunsOrder]) => scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, after);

describe("the words: lines.ts is the narrative writer's file", () => {
  it("has up to three variants for every key and every variable in braces is one the telling fills", () => {
    const known = new Set(["ship", "enemy", "by", "boss", "captains", "winner", "loser", "hull", "self", "round", "range", "from", "to", "style", "rounds", "bonus", "factor", "lead", "stage"]);
    for (const [key, variants] of Object.entries(LINES)) {
      expect(variants.length, key).toBeGreaterThanOrEqual(1);
      expect(variants.length, key).toBeLessThanOrEqual(3);
      for (const text of variants) {
        for (const [, name] of text.matchAll(/\{(\w+)\}/g)) expect(known.has(name!), `${key}: {${name}}`).toBe(true);
        expect(text, key).not.toMatch(/[–—]/); // no dashes
        expect(text, key).not.toMatch(/ - /);
        expect(text.length, key).toBeLessThanOrEqual(120);
      }
    }
  });

  it("fills a variable in and leaves an unknown one visible", () => {
    expect(fillLine("{ship} rams {enemy} for {hull}.", { ship: "A", enemy: "B", hull: 30 })).toBe("A rams B for 30.");
    expect(fillLine("{ship} and {nobody}", { ship: "A" })).toBe("A and {nobody}");
  });
});

describe("the style badge and the first lines of a battle", () => {
  it("shows each ship's style at the head of the replay, and nothing for a ship with none", () => {
    const r = fight(styled("hunter", "rammer"), styled("target", "gunline"), always("hold", "holdFire"), always("hold", "holdFire"));
    const lines = told(r);
    need(lines, "badge.head", { ship: H, style: "Rammer" });
    need(lines, "badge.head", { ship: T, style: "Gunline" });
    expect(lines.indexOf(lineVariants("badge.head", { ship: H, style: "Rammer" }).find((v) => lines.includes(v))!)).toBe(1); // right after the header
    const bare = told(fight(plain("hunter"), plain("target"), always("hold", "holdFire"), always("hold", "holdFire")));
    expect(bare.filter((l) => l.includes("sails as a"))).toEqual([]);
  });

  it("names every style with its own word, the Smuggler and the Firebrand too", () => {
    for (const style of ["bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"] as const) {
      const lines = told(fight(styled("hunter", style), plain("target"), always("hold", "holdFire"), always("hold", "holdFire")));
      need(lines, "badge.head", { ship: H, style: style[0]!.toUpperCase() + style.slice(1) });
    }
  });

  it("says why a battle starts at Far when a Bombardier's spotters see first", () => {
    const r = fight(styled("hunter", "bombardier"), plain("target"), always("hold", "holdFire"), always("hold", "holdFire"));
    expect(r.startRange).toBe("far");
    need(told(r), "start.far", { ship: H, enemy: T });
    const other = told(fight(plain("hunter"), plain("target"), always("hold", "holdFire"), always("hold", "holdFire")));
    expect(other.some((l) => lineVariants("start.far", { ship: H, enemy: T }).includes(l))).toBe(false);
  });

  it("is the same story for the same record, and picks other variants for other seeds", () => {
    const play = (seed: number) => fight(plain("hunter"), plain("target"), always("closeIn", "roundShot"), always("hold", "roundShot"), { seed });
    expect(told(play(7))).toEqual(told(play(7)));
    const variantsSeen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) variantsSeen.add(told(play(seed)).find((l) => l.startsWith("The ships close") || l.startsWith("The range drops") || l.startsWith("They draw nearer"))!);
    expect(variantsSeen.size).toBeGreaterThan(1);
  });
});

describe("the range in words (distances)", () => {
  it("tells a range that closes, opens or stays, by how many bands", () => {
    const closes = told(fight(plain("hunter"), plain("target"), always("closeIn", "holdFire"), always("hold", "holdFire"))); // Long to Medium
    need(closes, "range.closes", { from: "Long", to: "Medium", range: "Medium" });
    const closes2 = told(fight(plain("hunter"), plain("target"), always("closeIn", "holdFire"), always("closeIn", "holdFire"))); // Long to Short
    need(closes2, "range.closes2", { from: "Long", to: "Short", range: "Short" });
    const stays = told(fight(plain("hunter"), plain("target"), always("hold", "holdFire"), always("hold", "holdFire")));
    need(stays, "range.stays", { from: "Long", to: "Long", range: "Long" });
    // Open Range against a Hold: one band back, from Medium to Long, and two against Open Range.
    const opens = told(fight(plain("hunter"), plain("target"), always("openRange", "holdFire"), always("hold", "holdFire"), NEAR));
    need(opens, "range.opens", { from: "Medium", to: "Long", range: "Long" });
    const opens2 = told(fight(plain("hunter"), plain("target"), scripted({ 1: ["closeIn", "holdFire"], 2: ["closeIn", "holdFire"] }, ["openRange", "holdFire"]), scripted({ 1: ["closeIn", "holdFire"], 2: ["closeIn", "holdFire"] }, ["openRange", "holdFire"]), NEAR));
    need(opens2, "range.opens2", { from: "Close", to: "Medium", range: "Medium" });
  });

  it("does not say 'two bands' for a range that moves three", () => {
    // A Rammer dashes while both ships Close In: the table gives two bands and the Dash a third.
    const r = fight(styled("hunter", "rammer"), plain("target"), always("closeIn", "holdFire"), always("closeIn", "holdFire"));
    expect(r.rounds[0]!.rangeBefore).toBe("long");
    expect(r.rounds[0]!.rangeAfter).toBe("close");
    const lines = told(r);
    expect(lines.filter((l) => /two bands/i.test(l))).toEqual([]);
    expect(lines).toContain(fillLine(LINES["range.closes2"][2], { from: "Long", to: "Close", range: "Close" })); // the wording that names no number
    expect(lines).toContain(fillLine(LINES["ram.dash"][2], { ship: H, from: "Long", to: "Close" }));
  });
});

describe("the Ram and the Dash in words (spec section 3)", () => {
  const rams = (target: BattleShip, t: Chooser, seed = 1234) => fight(styled("hunter", "rammer", big), target, always("closeIn", "roundShot"), t, { ...NEAR, seed });

  it("tells a Dash that closes two bands, and the range it left", () => {
    // A Rammer Closes In against a ship that Holds: the table gives one band and the Dash another.
    const r = fight(styled("hunter", "rammer"), plain("target"), always("closeIn", "holdFire"), always("hold", "holdFire"));
    expect(r.rounds[0]!.rangeAfter).toBe("short");
    const lines = told(r);
    need(lines, "ram.dash", { ship: H, from: "Long", to: "Short" });
    need(lines, "range.closes2", { from: "Long", to: "Short", range: "Short" });
    // A plain ship does not dash.
    const plainLines = told(fight(plain("hunter"), plain("target"), always("closeIn", "holdFire"), always("hold", "holdFire")));
    expect(plainLines.some((l) => lineVariants("ram.dash", { ship: H, from: "Long", to: "Medium" }).includes(l))).toBe(false);
  });

  it("tells a Ram that lands: the Hull the struck ship lost and the Hull the Rammer paid", () => {
    const seed = findSeed((s) => rams(plain("target", big), always("hold", "holdFire"), s), (r) => r.rounds[1]?.rams?.[0]?.hit === true);
    const r = rams(plain("target", big), always("hold", "holdFire"), seed);
    const ram = r.rounds[1]!.rams![0]!;
    need(told(r), "ram.hit", { ship: H, enemy: T, hull: ram.hull, self: ram.self });
  });

  it("tells a Ram that misses, and why: crossed, outrun or the contest", () => {
    const crossed = rams(plain("target", big), scripted({ 1: ["hold", "holdFire"] }, ["crossTheirBow", "holdFire"]));
    expect(crossed.rounds[1]!.rams![0]).toMatchObject({ hit: false, why: "crossed" });
    need(told(crossed), "ram.miss.crossed", { ship: H, enemy: T, hull: 0, self: 0 });
    const outrun = findSeed((s) => rams(plain("target", { ...big, sails: 40 }), scripted({ 1: ["hold", "holdFire"] }, ["openRange", "holdFire"]), s), (r) => r.rounds[1]?.rams?.[0]?.why === "outrun");
    need(told(rams(plain("target", { ...big, sails: 40 }), scripted({ 1: ["hold", "holdFire"] }, ["openRange", "holdFire"]), outrun)), "ram.miss.outrun", { ship: H, enemy: T, hull: 0, self: 0 });
    const missed = findSeed((s) => rams(plain("target", { ...big, sails: 40 }), always("hold", "holdFire"), s), (r) => r.rounds[1]?.rams?.[0]?.why === "contest" && !r.rounds[1]!.rams![0]!.hit);
    need(told(rams(plain("target", { ...big, sails: 40 }), always("hold", "holdFire"), missed)), "ram.miss.contest", { ship: H, enemy: T, hull: 0, self: 0 });
  });

  it("tells a Ram on a Gunline that holds, and on a Boarder whose grapnels catch the prow", () => {
    const braced = findSeed((s) => rams(styled("target", "gunline", big), always("hold", "holdFire"), s), (r) => r.rounds[1]?.rams?.[0]?.hit === true);
    const b = rams(styled("target", "gunline", big), always("hold", "holdFire"), braced);
    need(told(b), "ram.braced", { ship: H, enemy: T, hull: b.rounds[1]!.rams![0]!.hull, self: b.rounds[1]!.rams![0]!.self });
    // The Boarder Holds in round 1 while the Rammer comes to Close, and Boards in round 2 while the Rammer Rams.
    const sturdy = { hullPoints: 900, maxHullPoints: 900 };
    const boarding = (s: number) => rams(styled("target", "boarder", { ...big, ...sturdy }), scripted({ 1: ["hold", "holdFire"] }, ["hold", "board"]), s);
    const caught = findSeed(boarding, (r) => r.rounds[1]?.rams?.[0]?.hit === true);
    const c = boarding(caught);
    need(told(c), "ram.grapnels", { ship: H, enemy: T, hull: c.rounds[1]!.rams![0]!.hull, self: c.rounds[1]!.rams![0]!.self });
  });

  it("tells the dash spoiling a rake, and failing to", () => {
    const play = (seed: number) => fight(styled("hunter", "rammer"), plain("target"), always("closeIn", "roundShot"), always("crossTheirBow", "roundShot"), { ...NEAR, seed });
    const spoiled = findSeed(play, (r) => r.rounds[0]!.contests.some((c) => c.kind === "dash" && c.winner === "hunter"));
    need(told(play(spoiled)), "ram.dash.spoils", { ship: H, enemy: T });
    const failed = findSeed(play, (r) => r.rounds[0]!.contests.some((c) => c.kind === "dash" && c.winner === "target"));
    need(told(play(failed)), "ram.dash.fails", { ship: H, enemy: T });
  });
});

describe("the Mortar and Hot Shot in words (spec section 3)", () => {
  it("tells a Mortar shell that hits and one that misses", () => {
    const play = (seed: number) => fight(styled("hunter", "bombardier", big), plain("target", big), always("hold", "mortar"), always("hold", "holdFire"), { seed });
    const hit = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === true && r.rounds[0]!.ships[0]!.shot.damage > 0);
    const h = play(hit);
    need(told(h), "mortar.hit", { ship: H, enemy: T, hull: h.rounds[0]!.ships[0]!.shot.damage });
    const miss = findSeed(play, (r) => r.rounds[0]!.ships[0]!.mortar?.hit === false);
    need(told(play(miss)), "mortar.miss", { ship: H, enemy: T });
  });

  it("tells Zeroing In grow with the range unchanged, and start over when the range changes", () => {
    const play = () => fight(styled("hunter", "bombardier", big), plain("target", big), always("hold", "mortar"), scripted({ 3: ["closeIn", "holdFire"] }, ["hold", "holdFire"]));
    const r = play();
    const factor = r.rounds[1]!.ships[0]!.mortar!.zeroing;
    expect(factor).toBeGreaterThan(1);
    need(told(r), "mortar.zeroing", { ship: H, bonus: Math.round((factor - 1) * 100) });
    expect(r.rounds[2]!.rangeAfter).not.toBe(r.rounds[2]!.rangeBefore);
    expect(r.rounds[2]!.ships[0]!.mortar!.zeroing).toBe(1);
    need(told(r), "mortar.zeroing.reset", { ship: H });
  });

  it("says a ship has no Mortar when a doctrine asks a ship of another style for one", () => {
    const r = fight(styled("hunter", "gunline"), plain("target"), always("hold", "mortar"), always("hold", "holdFire"));
    expect(r.rounds[0]!.ships[0]).toMatchObject({ asked: "mortar", guns: "roundShot" });
    need(told(r), "mortar.refused", { ship: H });
    expect(told(r).some((l) => l.includes("plays Hold and Round shot"))).toBe(true); // what it really played
  });

  it("tells a Hot Shot, a Hot Shot that is too far, one that eats the last Powder, and a refusal", () => {
    const play = (hunter: BattleShip, h: Chooser, input: Partial<BattleInput> = NEAR) => fight(hunter, plain("target", big), h, always("hold", "holdFire"), input);
    const near = play(styled("hunter", "firebrand", big), always("closeIn", "hotShot"));
    const hit = near.rounds[0]!.ships[0]!;
    expect(hit.shot.damage).toBeGreaterThan(0);
    need(told(near), "hotshot.hit", { ship: H, enemy: T, hull: hit.shot.damage });
    const far = play(styled("hunter", "firebrand", big), always("hold", "hotShot")); // Medium: the Hot Shot is weak there
    need(told(far), "hotshot.toofar", { ship: H, range: "Medium" });
    const dry = play(styled("hunter", "firebrand", { ...big, powder: 1 }), always("hold", "hotShot"));
    expect(dry.rounds[0]!.ships[0]!.powder).toBe(0);
    need(told(dry), "hotshot.dry", { ship: H });
    const refused = play(styled("hunter", "gunline"), always("hold", "hotShot"));
    need(told(refused), "hotshot.refused", { ship: H });
  });

  it("says once that a ship out of Powder fires weakly", () => {
    const r = fight(plain("hunter", { powder: 0 }), plain("target"), always("hold", "roundShot"), always("hold", "holdFire"), NEAR);
    const lines = told(r);
    expect(has(lines, "mortar.dry", { ship: H })).toBe(true);
    expect(lines.filter((l) => lineVariants("mortar.dry", { ship: H }).includes(l))).toHaveLength(1);
  });
});

describe("fire in words (spec section 3)", () => {
  const sturdy = { hullPoints: 900, maxHullPoints: 900 };

  it("tells a fire lit by Hot Shot and one lit by a Mortar shell, with the rounds it burns", () => {
    const hot = (seed: number) => fight(styled("hunter", "firebrand", { ...big, ...sturdy }), plain("target", { ...big, ...sturdy }), always("closeIn", "hotShot"), always("hold", "holdFire"), { ...NEAR, seed });
    const seed = findSeed(hot, (r) => r.rounds.some((x) => x.fires?.some((f) => f.source === "hotShot")));
    const r = hot(seed);
    const fire = r.rounds.flatMap((x) => x.fires ?? []).find((f) => f.source === "hotShot")!;
    need(told(r), "fire.lit.hotShot", { ship: T, by: H, rounds: fire.rounds });
    const shell = (s: number) => fight(styled("hunter", "bombardier", { ...big, ...sturdy }), plain("target", { ...big, ...sturdy }), always("hold", "mortar"), always("hold", "holdFire"), { seed: s });
    const m = findSeed(shell, (x) => x.rounds.some((y) => y.fires?.some((f) => f.source === "mortar")));
    const mr = shell(m);
    need(told(mr), "fire.lit.mortar", { ship: T, by: H, rounds: B.styles.bombardier.mortarFireRounds });
  });

  it("tells the fire burning each round, burning out, and a ship that burns down", () => {
    const hot = (seed: number, target: BattleShip) => fight(styled("hunter", "firebrand", { ...big, ...sturdy }), target, always("closeIn", "hotShot"), always("hold", "holdFire"), { ...NEAR, seed });
    const seed = findSeed((s) => hot(s, plain("target", { ...big, ...sturdy })), (r) => r.rounds.some((x) => x.ships[1]!.fire?.left === 0));
    const r = hot(seed, plain("target", { ...big, ...sturdy }));
    const burn = r.rounds.map((x) => x.ships[1]!.fire).find((f) => f !== undefined && f.left > 0)!;
    need(told(r), "fire.burns", { ship: T, hull: burn.hull });
    need(told(r), "fire.out", { ship: T });
    // A fire that finishes a ship: its Hull is low enough that the fire takes the last of it.
    const low = (s: number) => hot(s, plain("target", { ...big, hullPoints: 30, maxHullPoints: 100 }));
    const sunk = findSeed(low, (x) => x.outcome.kind === "sunk" && x.rounds.some((y) => y.ships[1]!.fire && y.ships[1]!.hullPoints === 0));
    const s = low(sunk);
    need(told(s), "fire.sinks", { ship: T, round: s.outcome.round });
  });

  it("tells a Gunline's fire drill and a Firebrand's pitch", () => {
    const burn = (target: BattleShip, shooter: BattleShip, order: GunsOrder) => (seed: number) =>
      fight(shooter, target, always(order === "mortar" ? "hold" : "closeIn", order), always("hold", "holdFire"), { ...NEAR, seed });
    const gun = burn(styled("target", "gunline", { ...big, ...sturdy }), styled("hunter", "firebrand", { ...big, ...sturdy }), "hotShot");
    const g = gun(findSeed(gun, (r) => r.rounds.some((x) => x.ships[1]!.fire)));
    const gunBurn = g.rounds.map((x) => x.ships[1]!.fire).find((f) => f)!;
    need(told(g), "fire.drill", { ship: T, hull: gunBurn.hull });
    const pitch = burn(styled("target", "firebrand", { ...big, ...sturdy }), styled("hunter", "bombardier", { ...big, ...sturdy }), "mortar");
    const p = pitch(findSeed(pitch, (r) => r.rounds.some((x) => x.ships[1]!.fire)));
    const pitchBurn = p.rounds.map((x) => x.ships[1]!.fire).find((f) => f)!;
    need(told(p), "fire.pitch", { ship: T, hull: pitchBurn.hull });
  });

  it("tells a ship that rams a Firebrand catching fire, and the embers of a Fireship", () => {
    const ram = (seed: number) => fight(styled("hunter", "rammer", { ...big, ...sturdy }), styled("target", "firebrand", { ...big, ...sturdy }), always("closeIn", "roundShot"), always("hold", "holdFire"), { ...NEAR, seed });
    const r = ram(findSeed(ram, (x) => x.rounds.some((y) => y.fires?.some((f) => f.source === "ram"))));
    need(told(r), "fire.lit.ram", { ship: H, by: T, rounds: B.styles.firebrand.ramBlazeRounds });
    const embers = (seed: number) => fight(styled("hunter", "boarder", { ...big, ...sturdy }), styled("target", "firebrand", { ...big, ...sturdy }), boardsInRound2(["hold", "charge"]), always("hold", "holdFire"), { ...NEAR, seed });
    const e = embers(findSeed(embers, (x) => x.rounds.some((y) => y.fires?.some((f) => f.source === "embers"))));
    const lit = e.rounds.flatMap((x) => x.fires ?? []).find((f) => f.source === "embers")!;
    need(told(e), "fire.lit.embers", { ship: lit.ship === e.hunter ? H : T, by: lit.by === e.hunter ? H : T, rounds: lit.rounds });
  });
});

describe("the deck fight in words (boarding spec)", () => {
  /** The hunter grapples in round 2 with the edge and fights from round 3 with `order`; the target plays `then`. */
  const deck = (order: GunsOrder, then: GunsOrder, hs: Partial<BattleShip> = {}, ts: Partial<BattleShip> = {}, seed = 1234, style?: [FightingStyle?, FightingStyle?]) =>
    fight(
      style?.[0] ? styled("hunter", style[0], { ...big, ...hs }) : plain("hunter", { ...big, ...hs }),
      style?.[1] ? styled("target", style[1], { ...big, ...ts }) : plain("target", { ...big, ...ts }),
      boardsInRound2(["hold", order]), always("hold", then), { ...NEAR, seed },
    );

  it("says the great guns are quiet in a round that began Grappled, and not in the round the ships grapple", () => {
    const r = deck("charge", "charge");
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    const lines = told(r);
    const at = (n: number) => lines.findIndex((l) => l.startsWith(`Round ${n},`));
    const quiet = lineVariants("deck.quiet", {});
    expect(lines.slice(at(2), at(3)).some((l) => quiet.includes(l))).toBe(false); // round 2: the guns fired at Close, then the grapple
    expect(has(lines.slice(at(3), at(4)), "deck.quiet", {})).toBe(true); // round 3 began Grappled
  });

  it("tells what each crew fights with: Charge, Volley, Repel", () => {
    const lines = told(deck("charge", "volley"));
    need(lines, "deck.charge", { ship: H });
    need(lines, "deck.volley", { ship: T });
    need(told(deck("repel", "repel")), "deck.repel", { ship: H });
  });

  it("tells who won the exchange: Charge beats Volley, Volley beats Repel, Repel beats Charge", () => {
    need(told(deck("charge", "volley")), "pair.chargeVolley", { winner: H, loser: T });
    need(told(deck("volley", "repel")), "pair.volleyRepel", { winner: H, loser: T });
    need(told(deck("charge", "repel")), "pair.repelCharge", { winner: T, loser: H });
    need(told(deck("charge", "charge")), "pair.even", {});
  });

  it("tells Fire Pots flying over a Repel", () => {
    const r = deck("firePots", "repel", { drill: 5, firePots: 3 });
    need(told(r), "pair.pots", { winner: H, loser: T });
    need(told(r), "deck.firePots", { ship: H });
  });

  it("tells why a crew fought with Fists: guns, no Powder, no Drill, no pots, caught unready, a collision", () => {
    need(told(deck("roundShot", "charge")), "deck.fists.guns", { ship: H });
    need(told(deck("volley", "charge", { powder: 0 })), "deck.fists.powder", { ship: H });
    need(told(deck("firePots", "charge", { firePots: 2, drill: 0 })), "deck.fists.drill", { ship: H });
    need(told(deck("firePots", "charge", { firePots: 0, drill: 5 })), "pots.none", { ship: H });
    // The boarded crew chose before the grapple, so it fights with Fists in the round the ships grapple.
    need(told(deck("charge", "charge")), "deck.fists.surprise", { ship: T });
    // Close In meets Close In: nobody boarded and both crews fight with Fists, said once.
    const collide = told(fight(plain("hunter", big), plain("target", big), always("closeIn", "roundShot"), always("closeIn", "roundShot"), NEAR));
    need(collide, "deck.fists.collide", {});
    expect(collide.filter((l) => lineVariants("deck.fists.collide", {}).includes(l))).toHaveLength(1);
  });

  it("tells First over the rail and who holds the edge, once", () => {
    const lines = told(deck("charge", "charge"));
    need(lines, "edge.firstOver", { ship: H, enemy: T });
    need(lines, "edge.holds", { ship: H, enemy: T });
    expect(lines.filter((l) => lineVariants("edge.holds", { ship: H, enemy: T }).includes(l))).toHaveLength(1);
  });

  it("tells two ships that both Board, with nobody first over the rail", () => {
    const r = fight(plain("hunter", big), plain("target", big), always("closeIn", "board"), always("closeIn", "board"), NEAR);
    expect(r.rounds[0]!.grapples.filter((g) => g.ok)).toHaveLength(2);
    const lines = told(r);
    need(lines, "edge.bothBoard", {});
    expect(lines.some((l) => lineVariants("edge.firstOver", { ship: H, enemy: T }).includes(l))).toBe(false);
  });

  it("tells grapnel lines from Short, a Board saved by the grapnels, and a Board that fails", () => {
    const short = fight(styled("hunter", "boarder", big), plain("target", big), always("closeIn", "board"), always("hold", "holdFire"), NEAR);
    expect(short.rounds[0]!.grapples[0]).toMatchObject({ ok: true, from: "short" });
    need(told(short), "board.short.ok", { ship: H, enemy: T });
    const play = (seed: number) => fight(styled("hunter", "boarder", big), plain("target", { ...big, sails: 30 }), always("closeIn", "board"), always("crossTheirBow", "holdFire"), { ...NEAR, seed });
    const saved = findSeed(play, (r) => r.rounds[0]!.grapples[0]?.why === "grapnels");
    need(told(play(saved)), "board.grapnels.win", { ship: H, enemy: T });
    const failed = findSeed(play, (r) => r.rounds[0]!.grapples[0]?.ok === false);
    need(told(play(failed)), "board.fail", { ship: H, enemy: T });
    // A plain ship that grapples from Close keeps the plain line.
    const close = told(fight(plain("hunter", big), plain("target", big), scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "board"]), always("hold", "holdFire"), NEAR));
    expect(close).toContain(`${H} grapples the enemy.`);
  });

  it("tells a Cut Free: Lashed fast, the lines cut or holding, and the guns quiet that round", () => {
    // The hunter grapples in round 2 with the edge; the target Opens Range to cut free from round 3.
    const play = (seed: number) => fight(plain("hunter", big), plain("target", big), boardsInRound2(["hold", "charge"]), scripted({}, ["openRange", "repel"]), { ...NEAR, seed });
    const freed = findSeed(play, (r) => r.rounds.some((x) => x.contests.some((c) => c.kind === "cutFree" && c.winner === "target")));
    const f = told(play(freed));
    need(f, "cutfree.hard", { ship: T, enemy: H });
    need(f, "cutfree.win", { ship: T, enemy: H });
    need(f, "cutfree.quiet", {});
    const held = findSeed(play, (r) => r.rounds.some((x) => x.contests.some((c) => c.kind === "cutFree" && c.winner === "hunter")));
    need(told(play(held)), "cutfree.fail", { ship: T, enemy: H });
    // With no edge nobody is lashed fast: two ships that both Board, and one cuts free.
    const bare = (seed: number) => fight(plain("hunter", big), plain("target", big), scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "charge"]), scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["openRange", "repel"]), { ...NEAR, seed });
    const r = bare(1);
    expect(r.rounds[1]!.edge).toBeUndefined();
    expect(has(told(r), "cutfree.hard", { ship: T, enemy: H })).toBe(false);
  });

  it("tells Fire Pots thrown: the pitch catching, a flash, a pot that fizzles and the last pot", () => {
    const pots = (seed: number, style: FightingStyle | undefined, over: Partial<BattleShip> = {}) =>
      fight(
        style ? styled("hunter", style, { ...big, drill: 5, ...over }) : plain("hunter", { ...big, drill: 5, firePots: 2, ...over }),
        plain("target", big), boardsInRound2(["hold", "firePots"]), always("hold", "charge"), { ...NEAR, seed },
      );
    const caught = findSeed((s) => pots(s, "firebrand"), (r) => r.rounds.some((x) => x.ships[0]!.deck?.thrown?.fire === true));
    need(told(pots(caught, "firebrand")), "pots.caught", { ship: H, enemy: T });
    const fizzled = findSeed((s) => pots(s, "firebrand"), (r) => r.rounds.some((x) => x.ships[0]!.deck?.thrown?.fire === false));
    need(told(pots(fizzled, "firebrand")), "pots.noFire", { ship: H, enemy: T });
    const flash = findSeed((s) => pots(s, undefined), (r) => r.rounds.some((x) => x.ships[0]!.deck?.thrown?.fire === true));
    const fr = pots(flash, undefined);
    const hull = fr.rounds.flatMap((x) => x.fires ?? []).find((f) => f.source === "firePots" && f.by === fr.hunter)!.hull!;
    need(told(fr), "pots.flash", { ship: H, enemy: T, hull });
    // The last pot: a ship with one pot throws it in round 3.
    const last = findSeed((s) => pots(s, undefined, { firePots: 1 }), () => true);
    need(told(pots(last, undefined, { firePots: 1 })), "pots.last", { ship: H, enemy: T });
  });

  it("tells the traits that count on deck once: Fighters, Tinderbox, Drill and Second Wave", () => {
    const r = fight(styled("hunter", "boarder", { ...big, drill: 15 }), styled("target", "firebrand", big), boardsInRound2(["hold", "charge"]), always("hold", "charge"), NEAR);
    const lines = told(r);
    need(lines, "fighters", { ship: H });
    need(lines, "tinderbox", { ship: H, enemy: T });
    need(lines, "drill.stage", { ship: H, stage: "Sea Wolves" });
    need(lines, "drill.secondWave", { ship: H });
    for (const key of ["fighters", "tinderbox", "drill.stage", "drill.secondWave"] as const) {
      expect(lines.filter((l) => lineVariants(key, { ship: H, enemy: T, stage: "Sea Wolves" }).includes(l)), key).toHaveLength(1);
    }
    for (const [drill, stage] of [[3, "Deckhands"], [5, "Deckhands"], [6, "Cutthroats"], [10, "Cutthroats"], [11, "Sea Wolves"]] as const) {
      const d = told(fight(plain("hunter", { ...big, drill }), plain("target", big), boardsInRound2(["hold", "charge"]), always("hold", "charge"), NEAR));
      need(d, "drill.stage", { ship: H, stage });
    }
  });
});

describe("overtime, outcomes and traits in words", () => {
  it("tells overtime: the round header, its start and its last round", () => {
    const r = fight(
      plain("hunter", { hands: 120, maxHands: 120 }), plain("target", { hands: 120, maxHands: 120 }),
      scripted({ 1: ["closeIn", "board"], 2: ["closeIn", "board"] }, ["hold", "repel"]), always("hold", "repel"), NEAR,
    );
    expect(r.rounds.map((x) => x.round)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const lines = told(r);
    need(lines, "round.header.overtime", { round: 6, range: "Grappled" });
    need(lines, "round.header.overtime", { round: 7, range: "Grappled" });
    need(lines, "overtime.start", { round: 6 });
    need(lines, "overtime.last", { round: 7 });
    expect(lines.filter((l) => l === "Round 5, at Grappled range.")).toHaveLength(1);
  });

  it("tells a Victory on points with the lead, a Draw, and a ship that slips away alone", () => {
    const victory = fight(plain("hunter"), plain("target"), always("hold", "roundShot"), always("hold", "holdFire"), NEAR);
    expect(victory.outcome.kind).toBe("victory");
    const lead = Math.round((victory.dealt.hunter - victory.dealt.target) * 100);
    need(told(victory), "outcome.victory", { winner: H, round: 5, lead });
    need(told(fight(plain("hunter"), plain("target"), always("hold", "holdFire"), always("hold", "holdFire"))), "outcome.draw", { round: 5 });
    // One ship opens range past Far and the other Holds: the round says who slipped away, and nobody is told twice.
    const alone = fight(plain("hunter"), plain("target"), scripted({ 1: ["closeIn", "holdFire"] }, ["openRange", "holdFire"]), scripted({}, ["openRange", "holdFire"]), { ambush: "long" });
    const both = told(alone);
    expect(alone.outcome.kind).toBe("escaped");
    expect(both.some((l) => l.includes("Escaped: the ships part in round"))).toBe(true);
    const away = fight(plain("hunter", { sails: 40 }), plain("target"), always("openRange", "holdFire"), always("hold", "holdFire"), { ambush: "long", wind: "breeze" });
    const gone = told(away);
    if (away.outcome.kind === "escaped") {
      need(gone, "outcome.escaped.one", { ship: H, enemy: T });
      expect(gone.some((l) => l.includes("Escaped: the ships part in round"))).toBe(false);
    }
    // Both ships open range: the old wording of the line plus the closing line.
    const bothAway = told(fight(plain("hunter"), plain("target"), always("openRange", "holdFire"), always("openRange", "holdFire")));
    need(bothAway, "outcome.escaped.both", {});
    expect(bothAway.some((l) => l.includes("Escaped: the ships part in round 1"))).toBe(true);
  });

  it("tells a trait once, in the round it pays: Braced, Steady Deck, Long Nines, Kite and Slippery", () => {
    const steady = told(fight(styled("hunter", "gunline"), plain("target"), always("hold", "roundShot"), always("hold", "holdFire"), NEAR));
    need(steady, "trait.steady", { ship: H });
    expect(steady.filter((l) => lineVariants("trait.steady", { ship: H }).includes(l))).toHaveLength(1);
    need(told(fight(styled("hunter", "gunline"), plain("target"), always("hold", "roundShot"), always("crossTheirBow", "holdFire"), NEAR)), "trait.braced", { ship: H });
    need(told(fight(styled("hunter", "gunline"), plain("target"), always("hold", "roundShot"), always("hold", "holdFire"))), "trait.longNines", { ship: H });
    need(told(fight(styled("hunter", "skirmisher"), plain("target"), always("openRange", "roundShot"), always("hold", "holdFire"), NEAR)), "trait.kite", { ship: H });
    need(told(fight(styled("hunter", "smuggler"), plain("target"), always("openRange", "chainShot"), always("hold", "holdFire"), NEAR)), "trait.slippery", { ship: H });
    // A ship that plays another style's rules gets nothing said: a trait pays only when its own move is played.
    const none2 = told(fight(plain("hunter"), plain("target"), always("hold", "roundShot"), always("hold", "holdFire")));
    expect(none2.some((l) => LINES["trait.steady"].some((t) => fillLine(t, { ship: H }) === l))).toBe(false);
  });
});

describe("a fleet battle in words", () => {
  it("tells the Ram of a fleet mate, the badge of every ship and the deck fight of a fleet", () => {
    const r = runBattle(battleOf(styled("hunter", "rammer", big), plain("target", big), {
      hunter: always("closeIn", "roundShot"), target: always("hold", "holdFire"),
    }, {
      ...NEAR,
      mates: { hunter: [{ ship: { ...fleetShip("m", "hunter"), style: "boarder", ...big }, doctrine: "Mate", chooser: always("closeIn", "board") }], target: [] },
    }));
    const lines = told(r);
    need(lines, "badge.head", { ship: H, style: "Rammer" });
    need(lines, "badge.head", { ship: "The m", style: "Boarder" });
    expect(lines.some((l) => l.includes("The m plays Close In and Board"))).toBe(true);
  });

  it("tells a crew of the boarding side that fights with Fists for no reason the record gives: the plain line", () => {
    // The flagship Boards and grapples with the edge; a fleet mate on its side played a Guns order, so its crew fights with Fists.
    const r = runBattle(battleOf(plain("hunter", big), plain("target", big), { hunter: boardsInRound2(["hold", "charge"]), target: always("hold", "holdFire") }, {
      ...NEAR,
      mates: { hunter: [{ ship: { ...fleetShip("m", "hunter"), ...big }, doctrine: "Mate", chooser: always("hold", "roundShot") }], target: [] },
    }));
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(r.rounds[1]!.ships.find((s) => s.ship === "ship_m")!.deck!.order).toBe("fists");
    need(told(r), "deck.fists", { ship: "The m" });
  });
});

describe("every line of every story is clean text", () => {
  it("leaves no variable, no undefined, no NaN and no dash in a hundred varied battles", () => {
    const styles: (FightingStyle | undefined)[] = [undefined, "bombardier", "gunline", "skirmisher", "rammer", "boarder", "firebrand", "smuggler"];
    const orders: GunsOrder[] = ["roundShot", "grapeshot", "chainShot", "mortar", "hotShot", "board", "charge", "volley", "repel", "firePots"];
    const moves: HelmMove[] = ["closeIn", "hold", "openRange", "crossTheirBow"];
    let n = 0;
    for (const a of styles) for (const b of styles) {
      const seed = ++n;
      const pick = <T,>(xs: readonly T[], k: number): T => xs[(seed * 7 + k * 3) % xs.length]!;
      const h = scripted({ 1: [pick(moves, 1), pick(orders, 2)] }, [pick(moves, 3), pick(orders, 4)]);
      const t = scripted({ 2: [pick(moves, 5), pick(orders, 6)] }, [pick(moves, 7), pick(orders, 8)]);
      const ship = (side: "hunter" | "target", style?: FightingStyle) => (style ? styled(side, style, { ...big, drill: seed % 16, firePots: 2 }) : plain(side, { ...big, drill: seed % 16, firePots: 2 }));
      const r = fight(ship("hunter", a), ship("target", b), h, t, { seed, ...(seed % 3 === 0 ? NEAR : {}) });
      for (const line of describeBattle(r, none, words)) {
        expect(line, `seed ${seed}`).not.toMatch(/\{\w+\}/);
        expect(line, `seed ${seed}`).not.toMatch(/undefined|NaN|null|Infinity/);
        expect(line, `seed ${seed}`).not.toMatch(/[–—]/);
      }
    }
  });
});

describe("every line the writer wrote is wired", () => {
  it("shows every key of lines.ts in some story, but the ones left out on purpose (the Old Shellback keys are in shellback.test.ts)", () => {
    // edge.none: the only grapples without an edge are a collision and two Boards, which have lines of their own.
    // fire.lit.firePots: a Firebrand's pot that catches is told by pots.caught, and the writer asks for one of the two.
    const leftOut = ["edge.none", "fire.lit.firePots"];
    const unseen = (Object.keys(LINES) as LineKey[]).filter((k) => !k.startsWith("shellback.") && !used.has(k));
    expect(unseen.sort()).toEqual(leftOut);
  });
});
