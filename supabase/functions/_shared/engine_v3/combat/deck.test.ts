// The deck fight (P3.B2 piece 2, docs/specs/boarding.md sections 2 and 3): the Deck orders and the cycle, the fallbacks to Fists, the
// melee formula, Drill and Second Wave in the strike, and how fleets judge each crew.

import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import { Rng } from "../rng.ts";
import { crewOrder, deckKill, drillLuck, hasSecondWave, pairFactor, pairing } from "./deck.ts";
import { boardingStrength } from "./boarding.ts";
import { fleetMelee, sideBonus } from "./fleet.ts";
import { styleShip, testShip } from "./testing.ts";
import { DECK_ORDERS, GUNS_ORDERS } from "./types.ts";
import type { BattleShip, DeckOrder, GunsOrder } from "./types.ts";

const C = B.combat;
const D = C.deck;

const deckOrders = DECK_ORDERS;

describe("the cycle (boarding spec section 2)", () => {
  it("has Charge beat Volley, Volley beat Repel and Repel beat Charge", () => {
    expect(pairing("charge", "volley")).toBe("won");
    expect(pairing("volley", "repel")).toBe("won");
    expect(pairing("repel", "charge")).toBe("won");
    expect(pairing("volley", "charge")).toBe("lost");
    expect(pairing("repel", "volley")).toBe("lost");
    expect(pairing("charge", "repel")).toBe("lost");
  });

  it("leaves Fire Pots and Fists outside the cycle, and an order against itself even", () => {
    for (const outside of ["firePots", "fists"] as const) {
      for (const o of deckOrders) {
        expect(pairing(outside, o), `${outside} v ${o}`).toBe("even");
        expect(pairing(o, outside), `${o} v ${outside}`).toBe("even");
      }
    }
    for (const o of ["charge", "volley", "repel"] as const) expect(pairing(o, o)).toBe("even");
  });

  it("is a cycle: every order of the three beats exactly one and loses to exactly one", () => {
    for (const o of ["charge", "volley", "repel"] as const) {
      const results = (["charge", "volley", "repel"] as const).map((t) => pairing(o, t)).sort();
      expect(results).toEqual(["even", "lost", "won"]);
    }
  });

  it("makes the winner hit 1.8 times as hard and the loser 0.75 times", () => {
    expect([D.pairWin, D.pairLose]).toEqual([1.8, 0.75]);
    expect(pairFactor("won")).toBe(D.pairWin);
    expect(pairFactor("lost")).toBe(D.pairLose);
    expect(pairFactor("even")).toBe(1);
  });
});

describe("the hit and guard of each order (boarding spec section 2)", () => {
  it("has the starting values: Fists is today's melee and Fire Pots hit 1.4", () => {
    expect(D.hit).toEqual({ charge: 1.5, volley: 1.1, repel: 0.6, firePots: 1.4, fists: 1 });
    expect(D.guard).toEqual({ charge: 1.25, volley: 1, repel: 0.6, firePots: 1, fists: 1 });
  });

  it("takes kill share x strength x hit x pairing x the guard of the other order", () => {
    // 30 strength, 20% kill share: 6 before the order.
    expect(deckKill(30, "fists", "fists", false)).toBeCloseTo(6);
    expect(deckKill(30, "charge", "fists", false)).toBeCloseTo(6 * 1.5);
    expect(deckKill(30, "charge", "charge", false)).toBeCloseTo(6 * 1.5 * 1.25); // even: no pairing, the other's guard
    expect(deckKill(30, "charge", "volley", false)).toBeCloseTo(6 * 1.5 * D.pairWin * 1.0); // won
    expect(deckKill(30, "volley", "charge", false)).toBeCloseTo(6 * 1.1 * D.pairLose * 1.25); // lost
    expect(deckKill(30, "repel", "charge", false)).toBeCloseTo(6 * 0.6 * D.pairWin * 1.25);
    expect(deckKill(30, "volley", "repel", false)).toBeCloseTo(6 * 1.1 * D.pairWin * 0.6);
  });

  it("makes Repel take the fewest and hit little, and Charge hit hardest and take the most", () => {
    const hits = deckOrders.map((o) => D.hit[o]);
    expect(D.hit.charge).toBe(Math.max(...hits.filter((h) => h !== D.hit.firePots))); // Fire Pots aside
    expect(D.hit.repel).toBe(Math.min(...hits));
    expect(D.guard.repel).toBe(Math.min(...deckOrders.map((o) => D.guard[o])));
    expect(D.guard.charge).toBe(Math.max(...deckOrders.map((o) => D.guard[o])));
  });

  it("lets Fire Pots ignore the guard of Repel, and only Fire Pots", () => {
    expect(deckKill(30, "firePots", "repel", false)).toBeCloseTo(6 * 1.4);
    expect(deckKill(30, "firePots", "charge", false)).toBeCloseTo(6 * 1.4 * 1.25);
    expect(deckKill(30, "fists", "repel", false)).toBeCloseTo(6 * 0.6);
  });

  it("adds Second Wave as a further share of the whole strike", () => {
    expect(B.drill.secondWaveShare).toBe(0.25);
    expect(deckKill(30, "charge", "volley", true)).toBeCloseTo(deckKill(30, "charge", "volley", false) * 1.25);
    expect(hasSecondWave({ drill: 15 })).toBe(true);
    expect(hasSecondWave({ drill: 14 })).toBe(false);
    expect(hasSecondWave({})).toBe(false);
  });
});

describe("what a crew fights with (boarding spec sections 1 and 2)", () => {
  const crew = (over: Partial<BattleShip> = {}, style?: "firebrand" | "boarder"): BattleShip =>
    style ? styleShip("hunter", style, "sloop", over) : testShip("hunter", "sloop", over);
  const fights = (played: GunsOrder, ship: BattleShip = crew(), ctx = { grappleRound: false, boarded: false }): DeckOrder => crewOrder(ship, played, ctx);

  it("fights a Charge and a Repel as given", () => {
    expect(fights("charge")).toBe("charge");
    expect(fights("repel")).toBe("repel");
  });

  it("fights Fists when the order is a Guns order, because the great guns are quiet while Grappled", () => {
    for (const order of ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "mortar", "hotShot"] as const) {
      expect(fights(order), order).toBe("fists");
    }
  });

  it("knows every order: each of the eleven gives a Deck order", () => {
    for (const order of GUNS_ORDERS) expect(DECK_ORDERS).toContain(fights(order));
  });

  it("falls back from a Volley to Fists with no Powder, and not at all with any", () => {
    expect(fights("volley", crew({ powder: 1 }))).toBe("volley");
    expect(fights("volley", crew({ powder: 0 }))).toBe("fists");
  });

  it("needs a pot and the right to throw it for Fire Pots: Drill 5 or a Firebrand's trait", () => {
    expect(fights("firePots", crew({ firePots: 2, drill: 5 }))).toBe("firePots");
    expect(fights("firePots", crew({ firePots: 2, drill: 10 }))).toBe("firePots");
    expect(fights("firePots", crew({ firePots: 2, drill: 4 }))).toBe("fists"); // a pot, but not the Drill
    expect(fights("firePots", crew({ firePots: 2 }))).toBe("fists");
    expect(fights("firePots", crew({ firePots: 0, drill: 5 }))).toBe("fists"); // the Drill, but no pot
    expect(fights("firePots", crew({ drill: 15 }))).toBe("fists"); // never carried any
    expect(fights("firePots", crew({ firePots: 1 }, "firebrand"))).toBe("firePots"); // from Drill 0
    expect(fights("firePots", crew({ firePots: 0 }, "firebrand"))).toBe("fists"); // a Firebrand out of pots fights with Fists
    expect(fights("firePots", crew({ firePots: 2 }, "boarder"))).toBe("fists"); // a Boarder has no such trait
  });

  it("makes every order but the boarder's Fists in the round the ships grapple: the crew chose before the grapple", () => {
    for (const order of GUNS_ORDERS) {
      expect(fights(order, crew({ firePots: 2, drill: 5 }), { grappleRound: true, boarded: false }), `${order} did not board`).toBe("fists");
    }
    expect(fights("repel", crew(), { grappleRound: true, boarded: false })).toBe("fists"); // the first round cannot be Repelled
    expect(fights("firePots", crew({ firePots: 2 }, "firebrand"), { grappleRound: true, boarded: false })).toBe("fists");
  });

  it("makes the Board that made the grapple fight as a Charge, whatever else is true of the crew", () => {
    expect(fights("board", crew(), { grappleRound: true, boarded: true })).toBe("charge");
    expect(fights("board", crew({ powder: 0 }), { grappleRound: true, boarded: true })).toBe("charge");
  });
});

describe("the melee with Deck orders, Drill and the traits (boarding spec sections 2 to 4, fighting styles spec section 3)", () => {
  const melee = (h: BattleShip, t: BattleShip, decks: [DeckOrder, DeckOrder], extras: { firstOver?: boolean; terrain?: "open" | "kelp" } = {}) =>
    fleetMelee({
      ids: { hunter: [h.shipId], target: [t.shipId] }, flagships: { hunter: h.shipId, target: t.shipId },
      ships: { [h.shipId]: h, [t.shipId]: t }, decks: { [h.shipId]: decks[0], [t.shipId]: decks[1] }, terrain: extras.terrain ?? "open",
      bonus: { hunter: sideBonus(1, 1, false), target: sideBonus(1, 1, false) }, firstOver: extras.firstOver ? [h.shipId] : [],
    });
  const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
  const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);

  it("lets a Repel beat a Charge: the charge runs onto the pikes", () => {
    const m = melee(hunter(), target(), ["charge", "repel"]);
    // The hunter's Charge loses: 6 x 1.5 x 0.75 x 0.6 = 4.05. The target's Repel wins: 6 x 0.6 x 1.8 x 1.25 = 8.1.
    expect(m.record.lost).toEqual({ hunter: 8, target: 4 });
    expect(m.pairings).toEqual({ ship_hunter: "lost", ship_target: "won" });
  });

  it("lets a Charge beat a Volley, and a Volley beat a Repel", () => {
    const cv = melee(hunter(), target(), ["charge", "volley"]);
    expect(cv.record.lost.target).toBe(Math.round(6 * 1.5 * D.pairWin * D.guard.volley)); // 16
    expect(cv.record.lost.hunter).toBe(Math.round(6 * 1.1 * D.pairLose * D.guard.charge)); // 6
    const vr = melee(hunter(), target(), ["volley", "repel"]);
    expect(vr.record.lost.target).toBe(Math.round(6 * 1.1 * D.pairWin * D.guard.repel)); // 4
    expect(vr.record.lost.hunter).toBe(Math.round(6 * 0.6 * D.pairLose * D.guard.volley)); // 3
  });

  it("makes Fire Pots hit hard and ignore a Repel", () => {
    const m = melee(hunter(), target(), ["firePots", "repel"]);
    expect(m.record.lost.target).toBe(Math.round(6 * 1.4)); // 8, the guard of Repel (0.6) ignored
    expect(m.pairings.ship_hunter).toBe("even");
  });

  it("is Fists against Fists today's melee, whatever the strength", () => {
    for (const hands of [30, 17, 5]) {
      const m = melee(hunter({ hands }), target(), ["fists", "fists"]);
      expect(m.record.lost.target).toBe(Math.round(0.2 * hands));
    }
  });

  it("adds Drill to the strength: a level adds its stage's share, later stages more", () => {
    const strength = (drill: number) => boardingStrength(hunter({ drill }), "open");
    expect(strength(0)).toBe(30);
    expect(strength(1)).toBeCloseTo(30 * 1.04);
    expect(strength(5)).toBeCloseTo(30 * 1.2);
    expect(strength(6)).toBeCloseTo(30 * 1.26);
    expect(strength(10)).toBeCloseTo(30 * 1.5);
    expect(strength(11)).toBeCloseTo(30 * 1.58);
    expect(strength(15)).toBeCloseTo(30 * 1.9);
    // Later levels add more than earlier ones.
    expect(strength(11) - strength(10)).toBeGreaterThan(strength(6) - strength(5));
    expect(strength(6) - strength(5)).toBeGreaterThan(strength(1) - strength(0));
  });

  it("strikes once more at Drill 15: Second Wave", () => {
    const plain = melee(hunter({ drill: 14 }), target(), ["charge", "fists"]);
    const wave = melee(hunter({ drill: 15 }), target(), ["charge", "fists"]);
    const factor = (d: number) => 1 + (d >= 11 ? 0.2 + 0.3 + 0.08 * (d - 10) : d >= 6 ? 0.2 + 0.06 * (d - 5) : 0.04 * d);
    expect(plain.record.lost.target).toBe(Math.round(0.2 * 30 * factor(14) * 1.5));
    expect(wave.record.lost.target).toBe(Math.round(0.2 * 30 * factor(15) * 1.5 * 1.25));
    // Only the crew that has it strikes again.
    expect(wave.record.lost.hunter).toBe(plain.record.lost.hunter);
  });

  it("makes First over the rail 25% more strength, for the crew named only", () => {
    const edge = melee(hunter(), target(), ["charge", "fists"], { firstOver: true });
    const none = melee(hunter(), target(), ["charge", "fists"]);
    expect(edge.record.strength.hunter).toBeCloseTo(30 * C.edge.firstOverTheRail);
    expect(edge.record.strength.target).toBe(30);
    expect(none.record.strength.hunter).toBe(30);
    expect(edge.record.lost.target).toBe(Math.round(6 * 1.5 * C.edge.firstOverTheRail)); // 11
  });

  it("gives a Boarder's Fighters 20% more, and takes 20% off a crew fighting a Firebrand (Tinderbox), both ways", () => {
    const boarder = styleShip("hunter", "boarder");
    const firebrand = styleShip("target", "firebrand");
    const m = melee(boarder, firebrand, ["fists", "fists"]);
    expect(m.record.strength.hunter).toBeCloseTo(30 * 1.2 * 0.8); // Fighters, and Tinderbox against the Firebrand
    expect(m.record.strength.target).toBeCloseTo(30); // the Firebrand's own crew is not weakened by a Boarder
    // The Firebrand fights a Gunline at full strength: Tinderbox is for the crew that fights it.
    expect(melee(firebrand, styleShip("target", "gunline"), ["fists", "fists"]).record.strength.hunter).toBe(30);
  });

  it("is judged on the same strength in Kelp, 15% more for both", () => {
    const m = melee(hunter(), target(), ["charge", "charge"], { terrain: "kelp" });
    expect(m.record.strength).toEqual({ hunter: expect.closeTo(34.5), target: expect.closeTo(34.5) });
  });
});

describe("Drill luck (P3.2, D198)", () => {
  const rng = () => new Rng("test/drill-luck");
  const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
  const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);

  it("is a draw from 1 minus luck to 1 plus luck, the same for the same ship and stream, and another for another ship", () => {
    for (const id of ["ship_a", "ship_b", "ship_c", "ship_d", "ship_e", "ship_f"]) {
      const x = drillLuck(rng(), id);
      expect(x).toBeGreaterThanOrEqual(1 - B.drill.luck);
      expect(x).toBeLessThanOrEqual(1 + B.drill.luck);
    }
    expect(drillLuck(rng(), "ship_a")).toBe(drillLuck(rng(), "ship_a"));
    expect(drillLuck(rng(), "ship_a")).not.toBe(drillLuck(rng(), "ship_b"));
  });

  it("can take a drilled crew below an undrilled one, and can double its bonus: it scales the Drill bonus and nothing else", () => {
    const drilled = hunter({ drill: 5 }); // +0.2 of its strength at the starting numbers
    const bonus = 30 * B.drill.perLevel[0] * 5;
    expect(boardingStrength(drilled, "open")).toBeCloseTo(30 + bonus);
    expect(boardingStrength(drilled, "open", { drillLuck: 1 })).toBeCloseTo(30 + bonus);
    expect(boardingStrength(drilled, "open", { drillLuck: 0 })).toBeCloseTo(30);
    expect(boardingStrength(drilled, "open", { drillLuck: 2 })).toBeCloseTo(30 + 2 * bonus);
    expect(boardingStrength(drilled, "open", { drillLuck: -1 })).toBeCloseTo(30 - bonus); // a bad day: worse than an untrained crew
    for (const luck of [-1, 0, 2, 4]) expect(boardingStrength(hunter(), "open", { drillLuck: luck })).toBe(30); // no Drill, nothing to vary
  });

  it("is in the melee only for a drilled crew, and a fight between crews with no Drill is as it was", () => {
    const strength = (luck: Record<string, number> | undefined) =>
      fleetMelee({
        ids: { hunter: ["ship_hunter"], target: ["ship_target"] }, flagships: { hunter: "ship_hunter", target: "ship_target" },
        ships: { ship_hunter: hunter({ drill: 5 }), ship_target: target() }, decks: { ship_hunter: "charge", ship_target: "charge" },
        terrain: "open", bonus: { hunter: sideBonus(1, 1, false), target: sideBonus(1, 1, false) },
        ...(luck ? { drillLuck: luck } : {}),
      }).record;
    const plain = strength(undefined);
    expect(strength({ ship_hunter: 1 })).toEqual(plain);
    expect(strength({ ship_hunter: 2 }).strength.hunter).toBeGreaterThan(plain.strength.hunter);
    expect(strength({ ship_hunter: -1 }).strength.hunter).toBeLessThan(plain.strength.target);
    expect(strength({ ship_target: 3 }).strength.target).toBe(plain.strength.target); // no Drill: the draw is not read
  });
});
