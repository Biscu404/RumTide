import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { canonicalJson } from "../replay.ts";
import { Rng } from "../rng.ts";
import { runBattle } from "./battle.ts";
import type { BattleInput, BattleMate, Chooser, RoundView } from "./battle.ts";
import {
  apportion, desperateDefence, fleetBonus, fleetGrapples, fleetMelee, mateCutFree, mateHelm, pickFlagship, shareDamage, shareOut,
  sideBonus, strikeTotals, withLosses,
} from "./fleet.ts";
import { fireGuns } from "./guns.ts";
import { battleRng } from "./helm.ts";
import type { BattleRecord, BattleShip, BattleSide, GunsOrder, HelmMove, Range } from "./types.ts";
import { always, battleOf, deepFreeze, fleetShip, scripted, surrendersAt } from "./testing.ts";

const F = B.fleet;

// ---------- The two bonuses (GAME_DESIGN 7.5) ----------

describe("the fleet bonus and Desperate Defence (7.5)", () => {
  it("gives +10% damage for each ship beyond the first, up to +30%", () => {
    expect(fleetBonus(0)).toBe(1);
    expect(fleetBonus(1)).toBeCloseTo(1.1, 10);
    expect(fleetBonus(2)).toBeCloseTo(1.2, 10);
    expect(fleetBonus(3)).toBeCloseTo(1.3, 10);
    expect(fleetBonus(4)).toBeCloseTo(1.3, 10); // the cap
    expect(fleetBonus(-1)).toBe(1);
  });

  it("gives +25% damage for each enemy ship beyond your own number, up to +75%", () => {
    expect(desperateDefence(0)).toBe(1);
    expect(desperateDefence(1)).toBeCloseTo(1.25, 10);
    expect(desperateDefence(2)).toBeCloseTo(1.5, 10);
    expect(desperateDefence(3)).toBeCloseTo(1.75, 10);
    expect(desperateDefence(9)).toBeCloseTo(1.75, 10); // the cap
  });

  it("takes both numbers from B.fleet", () => {
    expect(F.battleBonusPerExtraShip).toBe(0.1);
    expect(F.battleBonusCap).toBe(0.3);
    expect(F.desperatePerExtraEnemy).toBe(0.25);
    expect(F.desperateCap).toBe(0.75);
  });

  it("is plain 1 for a lone ship against a lone ship", () => {
    expect(sideBonus(1, 1, true)).toEqual({ ships: 1, fleet: 1, desperate: 1, total: 1 });
  });

  it("gives two against one the fleet bonus to the pair and Desperate Defence to the lone ship", () => {
    const pair = sideBonus(2, 1, true);
    const lone = sideBonus(1, 2, true);
    expect(pair).toMatchObject({ ships: 2, desperate: 1 });
    expect(pair.fleet).toBeCloseTo(1.1, 10);
    expect(lone).toMatchObject({ ships: 1, fleet: 1 });
    expect(lone.desperate).toBeCloseTo(1.25, 10);
    expect(lone.total).toBeCloseTo(1.25, 10);
  });

  it("gives Desperate Defence only to a side of player ships, and only when it is outnumbered", () => {
    expect(sideBonus(1, 2, false).desperate).toBe(1); // an NPC side, such as the galleon, never gets it
    expect(sideBonus(2, 2, true).desperate).toBe(1); // equal numbers
    expect(sideBonus(3, 2, true).desperate).toBe(1); // the bigger side
  });

  it("multiplies the two together", () => {
    // A pair outnumbered by three: the fleet bonus for two ships and Desperate Defence for one extra enemy.
    const b = sideBonus(2, 3, true);
    expect(b.total).toBeCloseTo(1.1 * 1.25, 10);
  });
});

// ---------- The flagship (7.5) ----------

describe("the flagship (7.5)", () => {
  const ship = (id: string, power: number, lead = false) => ({ id, power, lead });

  it("is the ship with the highest Power Rating", () => {
    expect(pickFlagship([ship("a", 10, true), ship("b", 14), ship("c", 12)])).toBe("b");
  });

  it("goes to the lead, who started the hunt, on a tie", () => {
    expect(pickFlagship([ship("a", 10), ship("b", 10, true), ship("c", 10)])).toBe("b");
  });

  it("goes to the lower ship id when nobody led", () => {
    expect(pickFlagship([ship("c", 10), ship("a", 10), ship("b", 10)])).toBe("a");
  });

  it("needs a ship", () => {
    expect(() => pickFlagship([])).toThrow();
  });
});

// ---------- Whole numbers, shared out ----------

describe("sharing whole numbers out", () => {
  it("apportions by weight, with the units left over going to the biggest remainders and then the lower index", () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(7, [3, 1])).toEqual([5, 2]);
    expect(apportion(100, [135, 100])).toEqual([57, 43]);
  });

  it("always adds up to the total", () => {
    const rng = new Rng("apportion");
    for (let i = 0; i < 300; i++) {
      const weights = Array.from({ length: rng.int(1, 6) }, () => rng.int(0, 200));
      const total = rng.int(0, 500);
      expect(apportion(total, weights).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("splits equally when every weight is 0, and hands the whole to a lone part", () => {
    expect(apportion(5, [0, 0])).toEqual([3, 2]);
    expect(apportion(7, [4])).toEqual([7]);
    expect(apportion(0, [1, 2])).toEqual([0, 0]);
    expect(apportion(5, [])).toEqual([]);
  });

  it("shares out up to each part's cap and gives what a full part cannot take to the others", () => {
    expect(shareOut(10, [1, 1], [100, 100])).toEqual([5, 5]);
    expect(shareOut(10, [1, 1], [3, 100])).toEqual([3, 7]);
    expect(shareOut(10, [1, 1, 1], [1, 1, 100])).toEqual([1, 1, 8]);
  });

  it("leaves out what nobody has room for", () => {
    expect(shareOut(10, [1, 1], [2, 3])).toEqual([2, 3]);
    expect(shareOut(10, [1], [4])).toEqual([4]);
    expect(shareOut(10, [1], [40])).toEqual([10]);
    expect(shareOut(0, [1, 1], [5, 5])).toEqual([0, 0]);
  });
});

// ---------- Damage to a side ----------

describe("damage to a side (7.5)", () => {
  it("is shared out in proportion to max Hull, not to the Hull left", () => {
    const sloop = fleetShip("a", "target", "sloop", { hullPoints: 20 });
    const brig = fleetShip("b", "target", "brigantine");
    expect(sloop.maxHullPoints).toBe(100);
    expect(brig.maxHullPoints).toBe(135);
    expect(shareDamage([sloop, brig], "hull", 47)).toEqual(apportion(47, [100, 135]));
  });

  it("never takes more than a ship has left on that track, and moves the rest to the others", () => {
    const hurt = fleetShip("a", "target", "sloop", { hullPoints: 3 });
    const fine = fleetShip("b", "target", "sloop");
    expect(shareDamage([hurt, fine], "hull", 20)).toEqual([3, 17]);
    expect(shareDamage([hurt, fine], "hull", 2)).toEqual([1, 1]);
  });

  it("adds the shots up per track, multiplies once, and rounds once", () => {
    const shots = [
      { ship: "a", track: "hull" as const, points: 10.4 },
      { ship: "b", track: "hull" as const, points: 10.4 },
      { ship: "c", track: "rigging" as const, points: 6 },
      { ship: "d", track: null, points: 0 },
    ];
    // 20.8 x 1.1 = 22.88, which rounds to 23. Rounding each shot first would give 22.
    expect(strikeTotals(shots, 1.1)).toEqual({ hull: 23, rigging: 7, hands: 0 });
    expect(strikeTotals(shots, 1)).toEqual({ hull: 21, rigging: 6, hands: 0 });
  });

  it("takes points off a ship without going below zero or touching the original", () => {
    const ship = fleetShip("a", "hunter");
    const after = withLosses(ship, { hull: 30, rigging: 500, hands: 5 });
    expect(after).toMatchObject({ hullPoints: 70, riggingPoints: 0, hands: 25 });
    expect(ship.hullPoints).toBe(100);
  });
});

// ---------- A fleet mate at the Helm (8.4, 7.5) ----------

describe("a fleet mate at the Helm (7.5)", () => {
  const mate = fleetShip("b", "hunter");
  const foe = (move: HelmMove, score = 10) => ({ move, score });
  const rng = () => new Rng("mate");

  it("is judged against the enemy flagship's move: the pair table gives its guns modifier", () => {
    expect(mateHelm(mate, "crossTheirBow", 10, foe("hold"), "long", "open", rng()).gunsMod).toBe(B.combat.rake);
    expect(mateHelm(mate, "hold", 10, foe("crossTheirBow"), "long", "open", rng()).gunsMod).toBe(B.combat.weakened);
    expect(mateHelm(mate, "hold", 10, foe("hold"), "long", "open", rng()).gunsMod).toBe(1);
  });

  it("rolls its own chase contest, named after the ship, when it Closes In on a flagship that Opens Range", () => {
    const m = mateHelm(mate, "closeIn", 10, foe("openRange"), "long", "open", rng());
    expect(m.contest).toMatchObject({ kind: "chase", side: "hunter", ship: "ship_b" });
    expect(mateHelm(mate, "hold", 10, foe("openRange"), "long", "open", rng()).contest).toBeNull();
  });

  it("takes a Reef scrape of its own, unless the water is Charted for its captain", () => {
    expect(mateHelm(mate, "closeIn", 10, foe("hold"), "long", "reef", rng()).scrape).toBe(B.combat.reefScrape);
    expect(mateHelm(fleetShip("b", "hunter", "sloop", { charted: true }), "closeIn", 10, foe("hold"), "long", "reef", rng()).scrape).toBe(0);
    expect(mateHelm(mate, "hold", 10, foe("hold"), "long", "reef", rng()).scrape).toBe(0);
  });

  it("is not judged against a flagship while Grappled, and a Crippled mate cannot Open Range", () => {
    const grappled = mateHelm(mate, "crossTheirBow", 10, foe("hold"), "grappled", "reef", rng());
    expect(grappled).toMatchObject({ gunsMod: 1, scrape: 0, contest: null });
    const crippled = fleetShip("b", "hunter", "sloop", { riggingPoints: 0 });
    expect(mateHelm(crippled, "openRange", 10, foe("hold"), "long", "open", rng()).move).toBe("hold");
  });

  it("tries to cut free of the flagship only by playing Open Range", () => {
    expect(mateCutFree(mate, "openRange", 10, 10, rng())).toMatchObject({ kind: "cutFree", side: "hunter", ship: "ship_b" });
    expect(mateCutFree(mate, "closeIn", 10, 10, rng())).toBeNull();
  });
});

// ---------- Boarding for a fleet (8.6) ----------

describe("boarding for a fleet (8.6)", () => {
  const ids = { hunter: ["ship_a", "ship_b"], target: ["ship_c"] };
  const flagships = { hunter: "ship_a", target: "ship_c" };
  const base = {
    ids, flagships,
    orders: { ship_a: "roundShot", ship_b: "board", ship_c: "roundShot" } as Record<string, GunsOrder>,
    moves: { ship_a: "hold", ship_b: "closeIn", ship_c: "hold" } as Record<string, HelmMove>,
    scores: { ship_a: 10, ship_b: 10, ship_c: 10 },
  };

  it("tries a mate's Board order at Close against the enemy flagship, and names the mate", () => {
    expect(fleetGrapples({ ...base, range: "close" })).toEqual([{ side: "hunter", ship: "ship_b", ok: true, why: "helm" }]);
  });

  it("names nobody for a flagship, as in a one ship battle", () => {
    const orders = { ...base.orders, ship_a: "board" as GunsOrder };
    expect(fleetGrapples({ ...base, orders, range: "close" })).toEqual([
      { side: "hunter", ok: true, why: "helm" },
      { side: "hunter", ship: "ship_b", ok: true, why: "helm" },
    ]);
  });

  it("fails against a faster flagship that neither Boards nor Holds, and does nothing away from Close", () => {
    const scores = { ...base.scores, ship_b: 5 };
    const moves = { ...base.moves, ship_c: "closeIn" as HelmMove };
    expect(fleetGrapples({ ...base, scores, moves, range: "close" })).toEqual([{ side: "hunter", ship: "ship_b", ok: false, why: "failed" }]);
    expect(fleetGrapples({ ...base, range: "medium" })).toEqual([]);
  });

  it("adds the crews' boarding strength up, side against side, and applies the side bonus to the Hands killed", () => {
    const a = fleetShip("a", "hunter"), b = fleetShip("b", "hunter"), c = fleetShip("c", "target");
    const ships = { ship_a: a, ship_b: b, ship_c: c };
    const orders = { ship_a: "roundShot", ship_b: "roundShot", ship_c: "roundShot" } as Record<string, GunsOrder>;
    const melee = fleetMelee(ids, ships, orders, "open", { hunter: sideBonus(2, 1, true), target: sideBonus(1, 2, true) });
    expect(melee.record.strength).toEqual({ hunter: 60, target: 30 });
    expect(melee.record.lost).toEqual({ hunter: 8, target: 13 }); // 20% of 30 x 1.25, and 20% of 60 x 1.1
    expect(melee.record.hands).toEqual({ hunter: 52, target: 17 });
    expect(melee.lost.ship_a! + melee.lost.ship_b!).toBe(8);
    expect(melee.lost.ship_c).toBe(13);
    expect(melee.credit.ship_a! + melee.credit.ship_b!).toBeCloseTo(1, 10);
  });

  it("takes Hands only from ships that have them, and never more than a side has", () => {
    const a = fleetShip("a", "hunter", "sloop", { hands: 2 });
    const c = fleetShip("c", "target", "sloop", { hands: 4 });
    const orders = { ship_a: "repel", ship_c: "roundShot" } as Record<string, GunsOrder>;
    const melee = fleetMelee({ hunter: ["ship_a"], target: ["ship_c"] }, { ship_a: a, ship_c: c }, orders, "open", {
      hunter: sideBonus(1, 1, true), target: sideBonus(1, 1, true),
    });
    expect(melee.record.lost.hunter).toBeLessThanOrEqual(2);
    expect(melee.record.hands.hunter).toBeGreaterThanOrEqual(0);
  });
});

// ---------- A fleet battle ----------

const hold = always("hold", "roundShot");

const mateOf = (id: string, side: BattleSide, chooser: Chooser = hold, over: Partial<BattleShip> = {}, hull: "sloop" | "brigantine" = "sloop"): BattleMate => ({
  ship: fleetShip(id, side, hull, over), doctrine: `Scripted ${id}`, chooser,
});

interface Side {
  flag: BattleShip;
  chooser?: Chooser;
  mates?: BattleMate[];
}

/** A battle of hunter ships against target ships. Open water and a Breeze unless `over` says otherwise. */
function fleetFight(h: Side, t: Side, over: Partial<BattleInput> = {}): BattleRecord {
  return runBattle(battleOf(h.flag, t.flag, { hunter: h.chooser ?? hold, target: t.chooser ?? hold }, {
    mates: { hunter: h.mates ?? [], target: t.mates ?? [] },
    playerSide: { hunter: true, target: true },
    ...over,
  }));
}

const SEED = 1234;

/** What one ship's guns do in round 1 of the battle above, before any bonus: the raw damage. */
const raw = (from: BattleShip, to: BattleShip, order: GunsOrder, range: Range, flags: [string, string], helmMod = 1) =>
  fireGuns(from, to, range, order, battleRng(SEED, flags[0], flags[1], 1), { terrain: "open", helmMod }).raw;

describe("two against one with the fleet bonus and Desperate Defence (7.5)", () => {
  const a = fleetShip("a", "hunter"), b = fleetShip("b", "hunter"), c = fleetShip("c", "target");
  const flags: [string, string] = ["ship_a", "ship_c"];

  it("adds the pair's guns up, times 1.1, and gives the lone ship +25% on its own", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c });
    const round1 = r.rounds[0]!.fleet!;
    expect(r.fleet!.bonus.hunter.total).toBeCloseTo(1.1, 10);
    expect(r.fleet!.bonus.target.total).toBeCloseTo(1.25, 10);
    // Both flagships Hold, so nobody has a rake or a flank shot; every shot is plain Round shot at Long range.
    expect(round1.damage.hunter.hull).toBe(Math.round((raw(a, c, "roundShot", "long", flags) + raw(b, c, "roundShot", "long", flags)) * 1.1));
    expect(round1.damage.target.hull).toBe(Math.round(raw(c, a, "roundShot", "long", flags) * 1.25));
  });

  it("shows what Desperate Defence is worth: the same battle without it hits 25% softer", () => {
    const withDefence = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c });
    const without = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c }, { playerSide: { hunter: true, target: false } });
    const damage = (r: BattleRecord) => r.rounds[0]!.fleet!.damage.target.hull;
    expect(without.fleet!.bonus.target.desperate).toBe(1);
    expect(damage(without)).toBe(Math.round(raw(c, a, "roundShot", "long", flags)));
    expect(damage(withDefence)).toBeGreaterThan(damage(without));
    expect(damage(withDefence)).toBe(Math.round(raw(c, a, "roundShot", "long", flags) * 1.25));
  });

  it("gives the pair no Desperate Defence, and the lone ship no fleet bonus", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c });
    expect(r.fleet!.bonus.hunter).toMatchObject({ ships: 2, desperate: 1 });
    expect(r.fleet!.bonus.target).toMatchObject({ ships: 1, fleet: 1 });
  });

  it("gives nobody Desperate Defence when the sides are the same size, and the fleet bonus to both", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c, mates: [mateOf("d", "target")] });
    expect(r.fleet!.bonus.hunter.total).toBeCloseTo(1.1, 10);
    expect(r.fleet!.bonus.target.total).toBeCloseTo(1.1, 10);
    expect(r.fleet!.bonus.hunter.desperate).toBe(1);
    expect(r.fleet!.bonus.target.desperate).toBe(1);
  });

  it("caps the fleet bonus at +30% and Desperate Defence at +75%", () => {
    const five = fleetFight(
      { flag: a, mates: ["b", "d", "e", "f"].map((id) => mateOf(id, "hunter")) },
      { flag: c },
    );
    expect(five.fleet!.bonus.hunter.fleet).toBeCloseTo(1.3, 10);
    expect(five.fleet!.bonus.target.desperate).toBeCloseTo(1.75, 10);
    const three = fleetFight({ flag: a, mates: [mateOf("b", "hunter"), mateOf("d", "hunter")] }, { flag: c });
    expect(three.fleet!.bonus.hunter.fleet).toBeCloseTo(1.2, 10);
    expect(three.fleet!.bonus.target.desperate).toBeCloseTo(1.5, 10);
  });

  it("gives an NPC side no Desperate Defence even when it is outnumbered", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c }, { playerSide: { hunter: true, target: false } });
    expect(r.fleet!.bonus.target.desperate).toBe(1);
    expect(r.fleet!.bonus.target.total).toBe(1);
  });

  it("shares the lone ship's damage out between the pair in proportion to max Hull", () => {
    const brig = mateOf("b", "hunter", hold, {}, "brigantine");
    const r = fleetFight({ flag: a, mates: [brig] }, { flag: c });
    const round1 = r.rounds[0]!.fleet!;
    const total = round1.damage.target.hull;
    expect(total).toBeGreaterThan(0);
    expect([round1.taken.ship_a!.hull, round1.taken.ship_b!.hull]).toEqual(apportion(total, [100, 135]));
    // The pair's own damage all lands on the one ship.
    expect(round1.taken.ship_c!.hull).toBe(round1.damage.hunter.hull);
  });

  it("moves a ship's share to its mate when the ship has no Hull left to take it, and then sinks the side", () => {
    const weak = mateOf("b", "hunter", hold, { hullPoints: 3 });
    const r = fleetFight({ flag: a, mates: [weak] }, { flag: c });
    const round1 = r.rounds[0]!.fleet!;
    expect(round1.taken.ship_b!.hull).toBe(3);
    expect(round1.taken.ship_a!.hull).toBe(round1.damage.target.hull - 3);
    // One ship at 0 Hull ends the battle: the whole side is Sunk (v0.2 7.2).
    expect(r.outcome).toMatchObject({ kind: "sunk", winner: "target", loser: "hunter", round: 1 });
    expect(r.final.find((s) => s.shipId === "ship_b")!.hullPoints).toBe(0);
    expect(r.final.find((s) => s.shipId === "ship_a")!.hullPoints).toBeGreaterThan(0);
  });

  it("wins the battle for the pair, as three equal ships beat one (9 rule 4)", () => {
    const wins = Array.from({ length: 30 }, (_, i) => {
      const r = fleetFight({ flag: a, chooser: always("hold", "roundShot"), mates: [mateOf("b", "hunter"), mateOf("d", "hunter")] }, { flag: c }, { seed: 100 + i });
      return r.dealt.hunter > r.dealt.target;
    });
    expect(wins.filter(Boolean).length).toBeGreaterThanOrEqual(27);
  });

  it("splits the credit for the damage dealt between the ships that dealt it", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c });
    const by = r.fleet!.dealtBy;
    expect(by.ship_a! + by.ship_b!).toBeCloseTo(r.dealt.hunter, 10);
    expect(by.ship_c!).toBeCloseTo(r.dealt.target, 10);
  });
});

// ---------- Who sees what ----------

describe("each ship's doctrine reads the enemy flagship (7.5)", () => {
  it("shows a mate itself and the enemy flagship, never the enemy's other ships", () => {
    const seen: RoundView[] = [];
    const spy: Chooser = (view) => {
      seen.push(view);
      return { kind: "fight", rule: 0, abilities: [], helm: "hold", guns: "roundShot" };
    };
    const a = fleetShip("a", "hunter"), c = fleetShip("c", "target", "sloop", { hullPoints: 40 });
    fleetFight(
      { flag: a, mates: [mateOf("b", "hunter", spy)] },
      { flag: c, chooser: scripted({ 1: ["hold", "chainShot"] }, ["hold", "roundShot"]), mates: [mateOf("d", "target", hold, { hullPoints: 99 })] },
    );
    const round2 = seen.find((v) => v.round === 2)!;
    expect(round2.side).toBe("hunter");
    expect(round2.ships.hunter.shipId).toBe("ship_b"); // itself
    expect(round2.ships.target.shipId).toBe("ship_c"); // the enemy flagship, not ship_d
    expect(round2.ships.target.hullPoints).toBeLessThan(100);
    expect(round2.last.target).toMatchObject({ helm: "hold", guns: "chainShot" }); // what the flagship played
  });

  it("shows a mate on the target side the hunter flagship", () => {
    const seen: RoundView[] = [];
    const spy: Chooser = (view) => {
      seen.push(view);
      return { kind: "fight", rule: 0, abilities: [], helm: "hold", guns: "roundShot" };
    };
    fleetFight({ flag: fleetShip("a", "hunter"), mates: [mateOf("b", "hunter")] }, { flag: fleetShip("c", "target"), mates: [mateOf("d", "target", spy)] });
    const v = seen[0]!;
    expect(v.side).toBe("target");
    expect(v.ships.target.shipId).toBe("ship_d");
    expect(v.ships.hunter.shipId).toBe("ship_a");
    expect(v.last.hunter).toBeNull(); // nothing played before round 1
  });

  it("lets a mate's own Jettison rule be spent on its own", () => {
    const seen: RoundView[] = [];
    const jettisoner: Chooser = (view) => {
      seen.push(view);
      return { kind: "fight", rule: 0, abilities: [], helm: "hold", guns: "holdFire", jettison: view.round === 1 };
    };
    const r = fleetFight({ flag: fleetShip("a", "hunter"), mates: [mateOf("b", "hunter", jettisoner)] }, { flag: fleetShip("c", "target") });
    expect(seen.find((v) => v.round === 1)!.jettisoned.hunter).toBe(false);
    expect(seen.find((v) => v.round === 2)!.jettisoned.hunter).toBe(true);
    expect(r.fleet!.jettisoned).toEqual(["ship_b"]);
    expect(r.jettisoned).toEqual(["hunter"]);
  });
});

// ---------- The range, and the ships that cannot move it ----------

describe("the range in a fleet battle (7.5, 8.4)", () => {
  const a = fleetShip("a", "hunter"), c = fleetShip("c", "target");

  it("is moved by the flagships' Helm moves, not by a mate's", () => {
    const stay = fleetFight({ flag: a, mates: [mateOf("b", "hunter", always("closeIn", "roundShot"))] }, { flag: c });
    expect(stay.rounds[0]!.rangeAfter).toBe("long");
    const close = fleetFight({ flag: a, chooser: always("closeIn", "roundShot"), mates: [mateOf("b", "hunter")] }, { flag: c, chooser: always("closeIn", "roundShot") });
    expect(close.rounds[0]!.rangeAfter).toBe("short"); // two bands of the six
  });

  it("gives a mate a rake of its own, judged against the enemy flagship's move", () => {
    const flags: [string, string] = ["ship_a", "ship_c"];
    const b = fleetShip("b", "hunter");
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter", always("crossTheirBow", "roundShot"))] }, { flag: c });
    const expected = Math.round((raw(a, c, "roundShot", "long", flags) + raw(b, c, "roundShot", "long", flags, B.combat.rake)) * 1.1);
    expect(r.rounds[0]!.fleet!.damage.hunter.hull).toBe(expected);
  });

  it("rolls the mate's chase contest from its own stream and records it with the ship", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter", always("closeIn", "roundShot"))] }, { flag: c, chooser: always("openRange", "roundShot") });
    const chase = r.rounds[0]!.contests.filter((x) => x.kind === "chase");
    expect(chase.map((x) => x.ship)).toEqual(["ship_b"]); // the flagships play Hold against Open Range: no contest of theirs
  });

  it("scrapes the Hull of a mate that Closes In on a Reef without a chart, and spares one that has it", () => {
    const scrape = (charted: boolean) => {
      const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter", always("closeIn", "roundShot"), { charted })] }, { flag: c }, { terrain: "reef" });
      return r.rounds[0]!.ships.find((s) => s.ship === "ship_b")!.scrape;
    };
    expect(scrape(false)).toBe(B.combat.reefScrape);
    expect(scrape(true)).toBe(0);
  });
});

// ---------- Boarding in a fleet battle ----------

describe("boarding in a fleet battle (8.6)", () => {
  const closeIn = always("closeIn", "roundShot");
  const a = fleetShip("a", "hunter"), c = fleetShip("c", "target");
  const NEAR = { ambush: "medium" } as const; // from Medium two ships that both Close In reach Close in one round

  it("grapples the whole battle when a mate's Board order succeeds at Close, and the melee runs that round", () => {
    // Round 1: the flagships Close In from Medium and reach Close. Round 2: the mate plays Board while its flagship only Closes In.
    const near = fleetFight(
      { flag: a, chooser: closeIn, mates: [mateOf("b", "hunter", scripted({ 1: ["closeIn", "roundShot"] }, ["closeIn", "board"]))] },
      { flag: c, chooser: scripted({ 1: ["closeIn", "roundShot"] }, ["hold", "roundShot"]) },
      NEAR,
    );
    expect(near.rounds[0]!.rangeAfter).toBe("close");
    expect(near.rounds[1]!.grapples).toMatchObject([{ side: "hunter", ship: "ship_b", ok: true }]);
    expect(near.rounds[1]!.rangeAfter).toBe("grappled");
    expect(near.rounds[1]!.melee).not.toBeNull();
  });

  it("lets a mate that Opens Range while Grappled try to cut free of the flagship, and records its contest", () => {
    const r = fleetFight(
      { flag: a, chooser: closeIn, mates: [mateOf("b", "hunter", always("hold", "roundShot"))] },
      { flag: c, chooser: closeIn, mates: [mateOf("d", "target", scripted({ 1: ["hold", "roundShot"], 2: ["hold", "roundShot"] }, ["openRange", "roundShot"]))] },
      NEAR,
    );
    // Round 2 both flagships Close In at Close: Grappled. Round 3 the target's mate plays Open Range.
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    const free = r.rounds[2]!.contests.filter((x) => x.kind === "cutFree");
    expect(free).toMatchObject([{ side: "target", ship: "ship_d" }]);
    expect(r.rounds[2]!.rangeAfter).toBe(free[0]!.winner === "target" ? "close" : "grappled");
  });

  it("adds the crews up, side against side, and records the whole side's numbers", () => {
    const r = fleetFight({ flag: a, chooser: closeIn, mates: [mateOf("b", "hunter", closeIn)] }, { flag: c, chooser: closeIn }, NEAR);
    const melee = r.rounds[1]!.melee!;
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(melee.strength).toEqual({ hunter: 60, target: 30 });
    expect(melee.lost).toEqual({ hunter: 8, target: 13 });
    const hands = (id: string) => r.rounds[1]!.ships.find((s) => s.ship === id)!.hands;
    expect(hands("ship_a") + hands("ship_b")).toBe(melee.hands.hunter);
    expect(hands("ship_c")).toBe(melee.hands.target);
  });

  it("captures a whole side whose crews together fall below the line", () => {
    const r = fleetFight({ flag: a, chooser: closeIn, mates: [mateOf("b", "hunter", closeIn)] }, { flag: fleetShip("c", "target", "sloop", { hands: 8 }), chooser: closeIn }, NEAR);
    expect(r.outcome).toMatchObject({ kind: "captured", winner: "hunter", loser: "target", round: 2 });
  });

  it("judges the capture on the Hands of the whole side, not of one ship", () => {
    // Ship b has 2 Hands, which is under 20% of its own max, but the side has 32 together: the melee of round 2 does not take it.
    const r = fleetFight({ flag: a, chooser: closeIn, mates: [mateOf("b", "hunter", closeIn, { hands: 2 })] }, { flag: c, chooser: closeIn }, NEAR);
    expect(r.rounds[1]!.melee!.hands.hunter).toBeGreaterThan(20);
    expect(r.rounds.length).toBeGreaterThan(2);
  });
});

// ---------- Endings ----------

describe("how a fleet battle ends (7.5, 8.7)", () => {
  const a = fleetShip("a", "hunter"), c = fleetShip("c", "target");

  it("ends in Struck Colours when one ship's doctrine says Surrender, and takes its whole side out of the fight", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter", surrendersAt(2, hold))] }, { flag: c });
    expect(r.outcome).toMatchObject({ kind: "struckColours", winner: "target", loser: "hunter", round: 2 });
    expect(r.rounds[1]!.struck).toEqual(["hunter"]);
    expect(r.rounds[1]!.fleet!.struck).toEqual(["ship_b"]);
    expect(r.rounds).toHaveLength(2);
  });

  it("is a Draw if a ship on each side strikes in the same round", () => {
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter", surrendersAt(1, hold))] }, { flag: c, mates: [mateOf("d", "target", surrendersAt(1, hold))] });
    expect(r.outcome.kind).toBe("draw");
  });

  it("goes to the side that dealt more when a ship sinks on each side in the same round", () => {
    const r = fleetFight(
      { flag: a, mates: [mateOf("b", "hunter", hold, { hullPoints: 1 })] },
      { flag: c, mates: [mateOf("d", "target", hold, { hullPoints: 1 })] },
    );
    expect(r.outcome.kind).toBe("sunk");
    const winner = r.outcome.winner!;
    expect(r.dealt[winner]).toBeGreaterThan(r.dealt[winner === "hunter" ? "target" : "hunter"]);
  });

  it("runs five rounds when nothing ends it, and calls it a Draw if nobody dealt damage", () => {
    const quiet = always("hold", "holdFire");
    const r = fleetFight({ flag: a, chooser: quiet, mates: [mateOf("b", "hunter", quiet)] }, { flag: c, chooser: quiet });
    expect(r.rounds).toHaveLength(5);
    expect(r.outcome).toMatchObject({ kind: "draw", round: 5 });
  });

  it("gives Victory on points to the side that led by 10 points of damage share", () => {
    // The pair shoots away the lone ship's Rigging, which does not sink it; the lone ship holds its fire.
    const chain = always("hold", "chainShot");
    const r = fleetFight({ flag: a, chooser: chain, mates: [mateOf("b", "hunter", chain)] }, { flag: c, chooser: always("hold", "holdFire") });
    expect(r.outcome).toMatchObject({ kind: "victory", winner: "hunter", loser: "target", round: 5 });
    expect(r.dealt.hunter - r.dealt.target).toBeGreaterThanOrEqual(B.combat.victoryMargin);
  });

  it("measures a fleet's damage share against the whole fleet's health", () => {
    // 20 Hull off a pair of sloops is 10% of their 200 Hull, a third of which is a Hull share of 3.3 points.
    const r = fleetFight({ flag: a, mates: [mateOf("b", "hunter")] }, { flag: c });
    const hullShare = r.rounds[0]!.fleet!.damage.target.hull / 200 / 3;
    const rigShare = r.rounds[0]!.fleet!.damage.target.rigging / 200 / 3;
    expect(r.rounds[0]!.fleet!.damage.target.rigging).toBe(0);
    expect(r.dealt.target).toBeGreaterThanOrEqual(hullShare + rigShare);
  });
});

// ---------- The shape of the record ----------

describe("the record of a fleet battle (P2.5)", () => {
  it("lists every ship, the hunter side first and each side in ship id order, whoever the flagship is", () => {
    const r = fleetFight({ flag: fleetShip("z", "hunter"), mates: [mateOf("b", "hunter")] }, { flag: fleetShip("m", "target"), mates: [mateOf("k", "target")] });
    expect(r.hunter).toBe("ship_z");
    expect(r.target).toBe("ship_m");
    expect(r.ships.map((s) => s.shipId)).toEqual(["ship_b", "ship_z", "ship_k", "ship_m"]);
    expect(r.final.map((s) => s.shipId)).toEqual(["ship_b", "ship_z", "ship_k", "ship_m"]);
    expect(r.rounds[0]!.ships.map((s) => s.ship)).toEqual(["ship_b", "ship_z", "ship_k", "ship_m"]);
    expect(r.fleet!.sides).toEqual({ hunter: ["ship_b", "ship_z"], target: ["ship_k", "ship_m"] });
    expect(r.ships.map((s) => s.side)).toEqual(["hunter", "hunter", "target", "target"]);
  });

  it("keeps the names of the doctrines the ships fought with", () => {
    const r = fleetFight({ flag: fleetShip("a", "hunter"), mates: [mateOf("b", "hunter")] }, { flag: fleetShip("c", "target") });
    expect(r.fleet!.doctrines).toMatchObject({ ship_a: "Scripted hunter", ship_b: "Scripted b", ship_c: "Scripted target" });
  });

  it("has no fleet fields at all when each side is one ship", () => {
    const solo = fleetFight({ flag: fleetShip("a", "hunter") }, { flag: fleetShip("c", "target") });
    expect(solo.fleet).toBeUndefined();
    expect(solo.rounds.every((round) => round.fleet === undefined)).toBe(true);
    expect(solo.rounds.flatMap((round) => [...round.contests, ...round.grapples]).every((x) => x.ship === undefined)).toBe(true);
  });

  it("is the same record with an empty list of mates as with none", () => {
    const a = fleetShip("a", "hunter"), c = fleetShip("c", "target");
    const plain = runBattle(battleOf(a, c, { hunter: hold, target: hold }));
    const empty = runBattle(battleOf(a, c, { hunter: hold, target: hold }, { mates: { hunter: [], target: [] } }));
    expect(canonicalJson(empty)).toBe(canonicalJson(plain));
  });

  it("is the same for the same battle and seed, survives a JSON round trip, and leaves its input alone", () => {
    const build = () => {
      const input = battleOf(fleetShip("a", "hunter"), fleetShip("c", "target"), { hunter: always("closeIn", "board"), target: always("closeIn", "grapeshot") }, {
        mates: { hunter: [mateOf("b", "hunter", always("crossTheirBow", "chainShot"))], target: [mateOf("d", "target", always("openRange", "roundShot"))] },
        playerSide: { hunter: true, target: true },
      });
      return input;
    };
    const first = runBattle(build());
    expect(canonicalJson(runBattle(build()))).toBe(canonicalJson(first));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    runBattle(deepFreeze(build()));
  });

  it("gives a different battle on a different seed", () => {
    const run = (seed: number) => fleetFight({ flag: fleetShip("a", "hunter"), mates: [mateOf("b", "hunter")] }, { flag: fleetShip("c", "target") }, { seed });
    expect(canonicalJson(run(1))).not.toBe(canonicalJson(run(2)));
  });

  it("does not let a ship fight twice", () => {
    expect(() => fleetFight({ flag: fleetShip("a", "hunter"), mates: [mateOf("a", "hunter")] }, { flag: fleetShip("c", "target") })).toThrow();
  });
});
