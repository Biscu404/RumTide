import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import type { Terrain } from "../types.ts";
import { ammoFactor, applyDamage, fireGuns, gunnery, gunsTrack, nextGunsMemory, recordFiring, staleNow } from "./guns.ts";
import { battleRng } from "./helm.ts";
import { deepFreeze, ScriptedRng, testShip } from "./testing.ts";
import { GUNS_ORDERS, RANGES } from "./types.ts";
import type { BattleShip, DamageTrack, GunsOrder, Range } from "./types.ts";

const C = B.combat;
const NO_LUCK = 0.5; // a roll of 0.5 makes luck 1.0
const rng = () => new ScriptedRng(NO_LUCK);
const hunter = (over: Partial<BattleShip> = {}) => testShip("hunter", "sloop", over);
const target = (over: Partial<BattleShip> = {}) => testShip("target", "sloop", over);

/** The damage a fresh sloop's shot should do before rounding: 22 at Cannons 10, times the table value. */
const base = (factor: number) => C.k * factor;

const SHOTS = [
  { order: "roundShot", key: "round", track: "hull" },
  { order: "chainShot", key: "chain", track: "rigging" },
  { order: "grapeshot", key: "grape", track: "hands" },
] as const;

describe("the ammo by range table (P2.1, GAMEPLAY 8.5)", () => {
  it("hits Hull with Round shot, Rigging with Chain shot and Hands with Grapeshot", () => {
    expect(gunsTrack("roundShot")).toBe("hull");
    expect(gunsTrack("chainShot")).toBe("rigging");
    expect(gunsTrack("grapeshot")).toBe("hands");
    for (const o of ["holdFire", "board", "repel"] as const) expect(gunsTrack(o)).toBeNull();
  });

  for (const { order, key, track } of SHOTS) {
    for (const range of RANGES) {
      it(`${order} at ${range} takes ${track} by the table's factor`, () => {
        const factor = C.range[key][range];
        expect(ammoFactor(order, range)).toBe(factor);
        const r = fireGuns(hunter(), target(), range, order, rng());
        expect(r.track).toBe(track);
        const raw = base(factor);
        expect(r.raw).toBeCloseTo(raw, 6);
        expect(r.damage).toBe(Math.round(track === "hands" ? raw / C.grapeDamagePerHand : raw));
      });

      it(`${order} at ${range} touches only the ${track} track`, () => {
        const before = target();
        const shot = fireGuns(hunter(), before, range, order, rng());
        const after = applyDamage(before, shot);
        const fields = { hull: "hullPoints", rigging: "riggingPoints", hands: "hands" } as const;
        for (const t of ["hull", "rigging", "hands"] as DamageTrack[]) {
          expect(after[fields[t]]).toBe(t === track ? before[fields[t]] - shot.damage : before[fields[t]]);
        }
      });
    }
  }

  it("matches the shape of GAMEPLAY 8.5: Chain is best far, Grape is best near, Round is steady", () => {
    expect(ammoFactor("chainShot", "long")).toBeGreaterThan(ammoFactor("roundShot", "long"));
    expect(ammoFactor("grapeshot", "close")).toBeGreaterThan(ammoFactor("roundShot", "close"));
    expect(ammoFactor("grapeshot", "long")).toBe(0);
    expect(ammoFactor("chainShot", "grappled")).toBe(0);
  });

  it("fires nothing for Hold Fire, Board and Repel", () => {
    for (const order of ["holdFire", "board", "repel"] as const) {
      for (const range of RANGES) {
        const r = fireGuns(hunter(), target(), range, order, rng());
        expect(r).toMatchObject({ track: null, damage: 0, raw: 0, powderUsed: 0 });
        expect(ammoFactor(order, range)).toBe(0);
      }
    }
  });

  it("knows every order", () => {
    for (const order of GUNS_ORDERS) expect(() => fireGuns(hunter(), target(), "medium", order, rng())).not.toThrow();
  });
});

describe("the damage formula (P2.1, GAMEPLAY 8.5)", () => {
  const fire = (a: BattleShip, over: { range?: Range; order?: GunsOrder; terrain?: Terrain; helmMod?: number } = {}) =>
    fireGuns(a, target(), over.range ?? "medium", over.order ?? "roundShot", rng(), { terrain: over.terrain ?? "open", helmMod: over.helmMod ?? 1 });

  it("is 22 at Cannons 10, Round shot at Medium", () => {
    expect(fire(hunter()).raw).toBeCloseTo(C.k);
    expect(fire(hunter()).damage).toBe(Math.round(C.k));
  });

  it("grows with Cannons to the power 0.6", () => {
    expect(fire(hunter({ cannons: 20 })).raw).toBeCloseTo(C.k * 2 ** C.exponent);
    expect(fire(hunter({ cannons: 5 })).raw).toBeCloseTo(C.k * 0.5 ** C.exponent);
  });

  it("is scaled by gunnery: full at 60% of max Hands, then in proportion", () => {
    const full = C.gunneryFullShare * 30;
    expect(gunnery(hunter({ hands: 30 }))).toBe(1);
    expect(gunnery(hunter({ hands: full }))).toBe(1);
    expect(gunnery(hunter({ hands: full / 2 }))).toBeCloseTo(0.5);
    expect(gunnery(hunter({ hands: 0 }))).toBe(0);
    expect(fire(hunter({ hands: full / 2 })).raw).toBeCloseTo(C.k * 0.5);
    expect(fire(hunter({ hands: 0 })).damage).toBe(0);
  });

  it("is scaled by the Helm modifier: rake, flank and weakened", () => {
    expect(fire(hunter(), { helmMod: C.rake }).raw).toBeCloseTo(C.k * C.rake);
    expect(fire(hunter(), { helmMod: C.flank }).raw).toBeCloseTo(C.k * C.flank);
    expect(fire(hunter(), { helmMod: C.weakened }).raw).toBeCloseTo(C.k * C.weakened);
  });

  it("is weaker at Long range in Rocky water and in Fog, and only at Long range", () => {
    expect(fire(hunter(), { range: "long", terrain: "rocky" }).raw).toBeCloseTo(base(C.range.round.long) * C.terrainGuns.rockyLong);
    expect(fire(hunter(), { range: "long", terrain: "fog" }).raw).toBeCloseTo(base(C.range.round.long) * C.terrainGuns.fogLong);
    expect(fire(hunter(), { range: "long", terrain: "open" }).raw).toBeCloseTo(base(C.range.round.long));
    expect(fire(hunter(), { range: "medium", terrain: "rocky" }).raw).toBeCloseTo(C.k);
    expect(fire(hunter(), { range: "close", terrain: "fog" }).raw).toBeCloseTo(C.k);
    expect(fire(hunter(), { range: "long", order: "chainShot", terrain: "fog" }).raw).toBeCloseTo(base(C.range.chain.long) * C.terrainGuns.fogLong);
  });

  it("multiplies the factors together", () => {
    const a = hunter({ cannons: 15, hands: 9, guns: { order: "holdFire", repeats: 1, charged: true } });
    const r = fire(a, { range: "close", order: "grapeshot", helmMod: C.rake, terrain: "open" });
    const expected = C.k * 1.5 ** C.exponent * C.range.grape.close * (9 / (C.gunneryFullShare * 30)) * C.rake * C.holdFireNext;
    expect(r.raw).toBeCloseTo(expected);
  });

  it("defaults to open water and no Helm modifier", () => {
    expect(fireGuns(hunter(), target(), "medium", "roundShot", rng()).raw).toBeCloseTo(C.k);
  });

  it("rounds to whole points, and turns Grapeshot damage into Hands at 3 to 1", () => {
    const g = fireGuns(hunter(), target(), "close", "grapeshot", rng());
    expect(g.raw).toBeCloseTo(C.k * C.range.grape.close);
    expect(g.damage).toBe(Math.round((C.k * C.range.grape.close) / C.grapeDamagePerHand));
    expect(Number.isInteger(fireGuns(hunter({ cannons: 13.5 }), target(), "long", "roundShot", rng()).damage)).toBe(true);
  });

  it("reports the factors it used", () => {
    const r = fireGuns(hunter({ powder: 0 }), target(), "close", "roundShot", rng(), { terrain: "open", helmMod: C.rake });
    expect(r.factors).toMatchObject({ range: C.range.round.close, helm: C.rake, powder: C.outOfPowder, charged: 1, stale: 1 });
    expect(r.factors?.luck).toBeCloseTo(1);
  });
});

describe("luck (P2.1, GAMEPLAY 19.1)", () => {
  it("runs from 0.9 to 1.1 of the damage, drawn from the round's stream", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let seed = 0; seed < 400; seed++) {
      const r = fireGuns(hunter(), target(), "medium", "roundShot", battleRng(seed, "ship_hunter", "ship_target", 1));
      const luck = r.factors?.luck ?? 0;
      min = Math.min(min, luck);
      max = Math.max(max, luck);
    }
    expect(min).toBeGreaterThanOrEqual(C.luckMin);
    expect(max).toBeLessThan(C.luckMax);
    expect(min).toBeLessThan(C.luckMin + 0.02);
    expect(max).toBeGreaterThan(C.luckMax - 0.02);
  });

  it("is drawn once per shooter, from the shooter's own stream", () => {
    const round = () => battleRng(5, "ship_hunter", "ship_target", 2);
    const alone = fireGuns(hunter(), target(), "medium", "roundShot", round());
    const r = round();
    fireGuns(target(), hunter(), "medium", "roundShot", r); // the other ship fires first
    const after = fireGuns(hunter(), target(), "medium", "roundShot", r);
    expect(after).toEqual(alone);
    const other = fireGuns(target(), hunter(), "medium", "roundShot", round());
    expect(other.factors?.luck).not.toBe(alone.factors?.luck);
  });

  it("rolls nothing for an order that fires nothing", () => {
    const r = fireGuns(hunter(), target(), "medium", "holdFire", battleRng(1, "a", "b", 1));
    expect(r.factors).toBeNull();
  });
});

describe("Hold Fire (P2.1, GAMEPLAY 8.5)", () => {
  it("fires nothing, burns no Powder, and charges the next round's guns", () => {
    const a = hunter();
    const held = fireGuns(a, target(), "medium", "holdFire", rng());
    expect(held).toMatchObject({ track: null, damage: 0, powderUsed: 0 });
    const next = recordFiring(a, "holdFire", held);
    expect(next.powder).toBe(a.powder);
    expect(next.guns.charged).toBe(true);
    const bonus = fireGuns(next, target(), "medium", "roundShot", rng());
    expect(bonus.raw).toBeCloseTo(C.k * C.holdFireNext);
    expect(bonus.damage).toBe(Math.round(C.k * C.holdFireNext));
    expect(bonus.factors?.charged).toBe(C.holdFireNext);
  });

  it("lasts one round", () => {
    let a = hunter();
    a = recordFiring(a, "holdFire", fireGuns(a, target(), "medium", "holdFire", rng()));
    a = recordFiring(a, "roundShot", fireGuns(a, target(), "medium", "roundShot", rng()));
    expect(a.guns.charged).toBe(false);
    expect(fireGuns(a, target(), "medium", "chainShot", rng()).factors?.charged).toBe(1);
  });

  it("does not stack when played twice in a row", () => {
    let a = hunter();
    for (let i = 0; i < 2; i++) a = recordFiring(a, "holdFire", fireGuns(a, target(), "medium", "holdFire", rng()));
    expect(fireGuns(a, target(), "medium", "roundShot", rng()).raw).toBeCloseTo(C.k * C.holdFireNext);
  });

  it("is lost if the next round fires nothing", () => {
    let a = hunter();
    a = recordFiring(a, "holdFire", fireGuns(a, target(), "close", "holdFire", rng()));
    a = recordFiring(a, "board", fireGuns(a, target(), "close", "board", rng()));
    expect(fireGuns(a, target(), "close", "roundShot", rng()).raw).toBeCloseTo(C.k);
  });

  it("stacks with a rake, as every other factor does", () => {
    const a = hunter({ guns: { order: "holdFire", repeats: 1, charged: true } });
    expect(fireGuns(a, target(), "medium", "roundShot", rng(), { terrain: "open", helmMod: C.rake }).raw).toBeCloseTo(C.k * C.rake * C.holdFireNext);
  });
});

describe("staleness (P2.1, GAMEPLAY 8.5)", () => {
  /** Fires the same order round after round and returns the stale factor of each round. */
  function streak(orders: GunsOrder[]) {
    let a = hunter();
    return orders.map((order) => {
      const r = fireGuns(a, target(), "medium", order, rng());
      a = recordFiring(a, order, r);
      return r.factors?.stale ?? 1;
    });
  }

  it("takes 20% off the same order played three rounds in a row, and every round after", () => {
    const orders = Array<GunsOrder>(5).fill("roundShot");
    const stale = streak(orders);
    const at = C.staleAfterRepeats - 1; // the round index where the streak reaches the limit
    expect(stale.slice(0, at)).toEqual(Array(at).fill(1));
    expect(stale.slice(at)).toEqual(Array(5 - at).fill(C.stale));
  });

  it("is not triggered by two in a row", () => {
    expect(streak(["roundShot", "roundShot"]).every((s) => s === 1)).toBe(true);
  });

  it("starts again when the order changes", () => {
    const stale = streak(["roundShot", "roundShot", "chainShot", "roundShot", "roundShot"]);
    expect(stale.every((s) => s === 1)).toBe(true);
    expect(streak(["chainShot", "chainShot", "chainShot", "roundShot"])[3]).toBe(1);
  });

  it("starts again after Hold Fire, which is a different order", () => {
    const stale = streak(["roundShot", "roundShot", "holdFire", "roundShot", "roundShot"]);
    expect(stale.every((s) => s === 1)).toBe(true);
  });

  it("does damage C.stale times as large", () => {
    const a = hunter({ guns: { order: "roundShot", repeats: C.staleAfterRepeats - 1, charged: false } });
    const r = fireGuns(a, target(), "medium", "roundShot", rng());
    expect(r.raw).toBeCloseTo(C.k * C.stale);
    expect(staleNow(a.guns, "roundShot")).toBe(true);
    expect(staleNow(a.guns, "chainShot")).toBe(false);
  });

  it("counts the streak in the ship's memory", () => {
    const m0 = hunter().guns;
    const m1 = nextGunsMemory(m0, "roundShot");
    const m2 = nextGunsMemory(m1, "roundShot");
    const m3 = nextGunsMemory(m2, "chainShot");
    expect([m1.repeats, m2.repeats, m3.repeats]).toEqual([1, 2, 1]);
    expect(m3.order).toBe("chainShot");
    expect(nextGunsMemory(m2, "holdFire")).toEqual({ order: "holdFire", repeats: 1, charged: true });
  });
});

describe("Powder (P2.1, GAMEPLAY 8.5)", () => {
  it("burns the hull's Powder per round when a ship fires", () => {
    for (const hull of ["sloop", "brigantine", "frigate"] as const) {
      const a = testShip("hunter", hull, { powder: 10 });
      const r = fireGuns(a, target(), "medium", "roundShot", rng());
      expect(r.powderUsed).toBe(B.hulls[hull].powderPerRound);
      expect(recordFiring(a, "roundShot", r).powder).toBe(10 - B.hulls[hull].powderPerRound);
    }
  });

  it("burns Powder for every kind of shot", () => {
    for (const order of ["roundShot", "chainShot", "grapeshot"] as const) {
      expect(fireGuns(hunter(), target(), "close", order, rng()).powderUsed).toBe(B.hulls.sloop.powderPerRound);
    }
  });

  it("burns what is left when there is less than a full round", () => {
    const a = testShip("hunter", "frigate", { powder: 1 });
    const r = fireGuns(a, target(), "medium", "roundShot", rng());
    expect(r.powderUsed).toBe(1);
    expect(r.factors?.powder).toBe(1);
    expect(recordFiring(a, "roundShot", r).powder).toBe(0);
  });

  it("halves the damage when out of Powder, and burns none", () => {
    const dry = hunter({ powder: 0 });
    const r = fireGuns(dry, target(), "medium", "roundShot", rng());
    expect(r.raw).toBeCloseTo(C.k * C.outOfPowder);
    expect(r.damage).toBe(Math.round(C.k * C.outOfPowder));
    expect(r.powderUsed).toBe(0);
    expect(r.damage).toBeGreaterThan(0);
    expect(recordFiring(dry, "roundShot", r).powder).toBe(0);
  });

  it("applies to Chain shot and Grapeshot too", () => {
    const dry = hunter({ powder: 0 });
    expect(fireGuns(dry, target(), "long", "chainShot", rng()).raw).toBeCloseTo(base(C.range.chain.long) * C.outOfPowder);
    expect(fireGuns(dry, target(), "close", "grapeshot", rng()).raw).toBeCloseTo(base(C.range.grape.close) * C.outOfPowder);
  });

  it("burns none and keeps nothing for orders that do not fire", () => {
    const a = hunter({ powder: 3 });
    for (const order of ["holdFire", "board", "repel"] as const) {
      expect(recordFiring(a, order, fireGuns(a, target(), "close", order, rng())).powder).toBe(3);
    }
  });
});

describe("damage stays within the track (P2.1)", () => {
  it("never takes more than the target has", () => {
    const weak = target({ hullPoints: 5, riggingPoints: 3, hands: 2 });
    const r1 = fireGuns(hunter(), weak, "medium", "roundShot", rng());
    expect(r1.damage).toBe(5);
    expect(applyDamage(weak, r1).hullPoints).toBe(0);
    expect(fireGuns(hunter(), weak, "long", "chainShot", rng()).damage).toBe(3);
    expect(fireGuns(hunter(), weak, "close", "grapeshot", rng()).damage).toBe(2);
  });

  it("does nothing to a track that is already empty", () => {
    const wreck = target({ hullPoints: 0, riggingPoints: 0, hands: 0 });
    for (const { order } of SHOTS) {
      const r = fireGuns(hunter(), wreck, "close", order, rng());
      expect(r.damage).toBe(0);
      const after = applyDamage(wreck, r);
      expect([after.hullPoints, after.riggingPoints, after.hands]).toEqual([0, 0, 0]);
    }
  });

  it("does nothing with Chain shot to a monster with no Rigging", () => {
    const monster = target({ maxRiggingPoints: 0, riggingPoints: 0 });
    expect(fireGuns(hunter(), monster, "long", "chainShot", rng()).damage).toBe(0);
  });

  it("is never negative and never takes a track below zero, over every seed, order, range and health", () => {
    const healths = [0, 1, 2, 7, 40, 135];
    for (let seed = 0; seed < 60; seed++) {
      for (const order of GUNS_ORDERS) {
        for (const range of RANGES) {
          for (const h of healths) {
            const def = target({ hullPoints: h, riggingPoints: h, hands: h });
            const r = fireGuns(hunter({ powder: seed % 2 }), def, range, order, battleRng(seed, "ship_hunter", "ship_target", 1));
            expect(r.damage).toBeGreaterThanOrEqual(0);
            const after = applyDamage(def, r);
            expect(after.hullPoints).toBeGreaterThanOrEqual(0);
            expect(after.riggingPoints).toBeGreaterThanOrEqual(0);
            expect(after.hands).toBeGreaterThanOrEqual(0);
            expect(r.powderUsed).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe("fireGuns is pure and reproducible (P2.1)", () => {
  it("gives the same result for the same inputs and seed", () => {
    const run = (round: number) => fireGuns(hunter({ cannons: 13.5 }), target(), "medium", "grapeshot", battleRng(2026, "ship_hunter", "ship_target", round));
    expect(run(3)).toEqual(run(3));
    expect(JSON.stringify(run(3))).toBe(JSON.stringify(run(3)));
    expect(run(3).factors?.luck).not.toBe(run(4).factors?.luck);
  });

  it("does not change its inputs", () => {
    const a = deepFreeze(hunter({ guns: { order: "roundShot", repeats: 2, charged: true } }));
    const d = deepFreeze(target());
    const before = JSON.stringify([a, d]);
    fireGuns(a, d, "close", "roundShot", battleRng(1, "ship_hunter", "ship_target", 1));
    expect(JSON.stringify([a, d])).toBe(before);
  });

  it("applyDamage and recordFiring return new ships and leave the old ones alone", () => {
    const a = deepFreeze(hunter());
    const d = deepFreeze(target());
    const r = fireGuns(a, d, "medium", "roundShot", rng());
    const hit = applyDamage(d, r);
    const spent = recordFiring(a, "roundShot", r);
    expect(hit).not.toBe(d);
    expect(spent).not.toBe(a);
    expect(d.hullPoints).toBe(100);
    expect(a.powder).toBe(6);
    expect(hit.hullPoints).toBe(100 - r.damage);
    expect(spent.powder).toBe(6 - r.powderUsed);
    expect(spent.guns).toEqual({ order: "roundShot", repeats: 1, charged: false });
    expect(spent.guns).not.toBe(a.guns);
  });

  it("fires at the same time: neither ship's shot changes what the other fires with", () => {
    const h = hunter();
    const t = target();
    const hr = fireGuns(h, t, "close", "grapeshot", rng());
    const tr = fireGuns(t, h, "close", "grapeshot", rng());
    const afterH = applyDamage(h, tr);
    const afterT = applyDamage(t, hr);
    expect(afterH.hands).toBe(h.hands - tr.damage);
    expect(afterT.hands).toBe(t.hands - hr.damage);
    expect(hr.damage).toBe(tr.damage); // equal ships, equal shots
  });
});
