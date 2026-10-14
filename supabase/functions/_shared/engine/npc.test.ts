import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, boom, coopShare, npcPR } from "./balance.ts";
import { resolveBattle, type Combatant } from "./combat.ts";
import { hopsFrom, loadMap } from "./map.ts";
import { npcCombatant, npcPlan, settleGalleonBattle, settleMerchantBattle, spawnNpcs, type SpawnInput } from "./npc.ts";
import { createRng } from "./rng.ts";
import type { Maneuver, Npc } from "./types.ts";

const map = loadMap(brineJson);
const ports = map.nodeIds.filter((id) => map.node(id).type === "port");

const input = (over: Partial<SpawnInput> = {}): SpawnInput => ({
  seasonId: "s1", tide: 3, players: 6, medianPR: 12, galleonTides: [7, 14], ...over,
});

describe("spawnNpcs", () => {
  it("makes 4 or 5 merchants for six players, 4.5 on average", () => {
    const counts = Array.from({ length: 2000 }, (_, i) =>
      spawnNpcs(map, input(), createRng(i)).filter((n) => n.kind !== "galleon").length);
    expect(Math.min(...counts)).toBe(4);
    expect(Math.max(...counts)).toBe(5);
    expect(counts.reduce((a, b) => a + b, 0) / counts.length).toBeCloseTo(B.npc.merchantsPerPlayer * 6, 1);
  });

  it("scales with the player count", () => {
    expect(spawnNpcs(map, input({ players: 4 }), createRng(1))).toHaveLength(3);   // 0.75 * 4 is exactly 3
    expect(spawnNpcs(map, input({ players: 0 }), createRng(1))).toHaveLength(0);
  });

  it("is the same for the same seed and different for another", () => {
    const a = spawnNpcs(map, input(), createRng(42));
    expect(spawnNpcs(map, input(), createRng(42))).toEqual(a);
    expect(spawnNpcs(map, input(), createRng(43))).not.toEqual(a);
  });

  it("returns NPCs in id order with unique ids", () => {
    const npcs = spawnNpcs(map, input({ tide: 7, players: 12 }), createRng(5));
    const ids = npcs.map((n) => n.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts merchants on a shortest lane between two ports, never in a port", () => {
    const dist = new Map(ports.map((p) => [p, hopsFrom(map, p)]));
    for (let seed = 0; seed < 300; seed++) {
      for (const npc of spawnNpcs(map, input({ players: 8 }), createRng(seed))) {
        expect(map.node(npc.nodeId).type).not.toBe("port");
        const onLane = ports.some((a) => ports.some((b) => a !== b
          && dist.get(a)!.get(npc.nodeId)! + dist.get(b)!.get(npc.nodeId)! === dist.get(a)!.get(b)!));
        expect(onLane, npc.nodeId).toBe(true);
      }
    }
  });

  it("makes about one merchant in three a Fat Merchant", () => {
    const kinds = Array.from({ length: 1500 }, (_, i) => spawnNpcs(map, input(), createRng(i))).flat();
    const fat = kinds.filter((n) => n.kind === "fatMerchant").length / kinds.length;
    expect(fat).toBeGreaterThan(B.npc.fatMerchantShare - 0.04);
    expect(fat).toBeLessThan(B.npc.fatMerchantShare + 0.04);
  });

  it("gives merchants their cargo, their PR and an active status", () => {
    const npcs = spawnNpcs(map, input({ medianPR: 15 }), createRng(9));
    for (const n of npcs) {
      expect(n.status).toBe("active");
      expect(n.spawnedTide).toBe(3);
      expect(n.seasonId).toBe("s1");
      if (n.kind === "smallTrader") { expect(n.cargoUnits).toBe(10); expect(n.pr).toBeCloseTo(12); }
      if (n.kind === "fatMerchant") { expect(n.cargoUnits).toBe(30); expect(n.pr).toBeCloseTo(19.5); }
    }
  });

  it("brings the Treasure Galleon on the season's galleon Tides only", () => {
    for (let tide = 1; tide <= 14; tide++) {
      const galleons = spawnNpcs(map, input({ tide }), createRng(tide)).filter((n) => n.kind === "galleon");
      expect(galleons.length, `tide ${tide}`).toBe(tide === 7 || tide === 14 ? 1 : 0);
    }
    expect(spawnNpcs(map, input({ tide: 21 }), createRng(1)).some((n) => n.kind === "galleon")).toBe(false);
    expect(spawnNpcs(map, input({ tide: 21, galleonTides: [7, 14, 21] }), createRng(1)).some((n) => n.kind === "galleon")).toBe(true);
  });

  it("puts the galleon in Free Waters on open sea, an island or a wreck, at 2.8 times the median PR", () => {
    for (let seed = 0; seed < 100; seed++) {
      const g = spawnNpcs(map, input({ tide: 7 }), createRng(seed)).find((n) => n.kind === "galleon")!;
      const node = map.node(g.nodeId);
      expect(node.zone).toBe("free");
      expect(["sea", "island", "wreck"]).toContain(node.type);
      expect(g.pr).toBeCloseTo(2.8 * 12);
      expect(g.habit).toEqual(["broadside", "board", "broadside"]);
    }
  });
});

const npcOf = (kind: Npc["kind"], habit: Maneuver[], over: Partial<Npc> = {}): Npc => ({
  id: "n1", seasonId: "s1", kind, nodeId: "sea01", pr: 12, habit, cargoUnits: 10, spawnedTide: 3, status: "active", ...over,
});

describe("NPC plans", () => {
  it("has the Small Trader outmaneuver 60% of the time and split the rest", () => {
    const rng = createRng(1);
    const small = npcOf("smallTrader", ["outmaneuver"]);
    const counts: Record<Maneuver, number> = { broadside: 0, outmaneuver: 0, board: 0 };
    const n = 6000;
    for (let i = 0; i < n; i++) for (const m of npcPlan(small, rng)) counts[m]++;
    expect(counts.outmaneuver / (3 * n)).toBeCloseTo(0.6, 1);
    expect(counts.broadside / (3 * n)).toBeCloseTo(0.2, 1);
    expect(counts.board / (3 * n)).toBeCloseTo(0.2, 1);
  });

  it("has the Fat Merchant outmaneuver, then board", () => {
    const plan = npcPlan(npcOf("fatMerchant", [...B.npc.fatMerchant.plan]), createRng(1));
    expect(plan[0]).toBe("outmaneuver");
    expect(plan.slice(1)).toEqual(["board", "board"]);
  });

  it("has the galleon broadside, board, broadside every time", () => {
    for (let seed = 0; seed < 5; seed++) {
      expect(npcPlan(npcOf("galleon", [...B.npc.galleon.plan]), createRng(seed))).toEqual(["broadside", "board", "broadside"]);
    }
  });
});

describe("npcCombatant", () => {
  it("makes every stat equal to the PR and the hull 10 times the PR (section 14)", () => {
    const c = npcCombatant(npcOf("fatMerchant", [...B.npc.fatMerchant.plan], { pr: 15.6 }), createRng(1));
    expect(c).toMatchObject({ id: "n1", kind: "npc", pr: 15.6, cannons: 15.6, sails: 15.6, crew: 15.6 });
    expect(c.hullPoints).toBeCloseTo(156);
    expect(c.maxHull).toBeCloseTo(156);
    expect(npcPR("fatMerchant", 12)).toBeCloseTo(15.6);
  });
});

describe("merchant prizes (section 4.6)", () => {
  const winner = (id: string, damageDealt = 100, holdCap?: number) => ({ id, damageDealt, ...(holdCap === undefined ? {} : { holdCap }) });

  it("pays a Decisive win the whole cargo at prize value and the Boom", () => {
    const r = settleMerchantBattle({ kind: "smallTrader", cargoUnits: 10 }, "decisive", [winner("a")], 5);
    expect(r.total).toBe(Math.round(10 * 19 * boom(5)));
    expect(r.shares.a).toEqual({ gold: r.total, legend: B.legend.npcWin });
    expect(r.taken).toBe(r.total);
  });

  it("pays a Victory half", () => {
    const full = settleMerchantBattle({ kind: "fatMerchant", cargoUnits: 30 }, "decisive", [winner("a")], 5).total;
    const half = settleMerchantBattle({ kind: "fatMerchant", cargoUnits: 30 }, "victory", [winner("a")], 5).total;
    expect(half).toBe(Math.round(full / 2));
  });

  it("shares in proportion to damage dealt, with every doubloon accounted for", () => {
    const r = settleMerchantBattle({ kind: "fatMerchant", cargoUnits: 30 }, "decisive", [winner("a", 75), winner("b", 25)], 1);
    expect(r.shares.a!.gold + r.shares.b!.gold).toBe(r.total);
    expect(r.shares.a!.gold / r.total).toBeCloseTo(0.75, 2);
    expect(r.shares.a!.legend).toBe(B.legend.npcWin);
    expect(r.shares.b!.legend).toBe(B.legend.npcWin);
  });

  it("does not let a winner carry off more than the Hold takes", () => {
    const r = settleMerchantBattle({ kind: "fatMerchant", cargoUnits: 30 }, "decisive", [winner("a", 100, 200)], 0);
    expect(r.total).toBe(570);
    expect(r.shares.a!.gold).toBe(200);
    expect(r.taken).toBe(200);
  });

  it("passes what one winner cannot hold to the other", () => {
    const r = settleMerchantBattle({ kind: "fatMerchant", cargoUnits: 30 }, "decisive", [winner("a", 50, 100), winner("b", 50)], 0);
    expect(r.shares.a!.gold).toBe(100);
    expect(r.shares.b!.gold).toBe(470);
  });

  it("sends the galleon to its own settlement", () => {
    expect(() => settleMerchantBattle({ kind: "galleon", cargoUnits: 0 }, "decisive", [winner("a")], 1)).toThrow(/galleon/);
  });
});

describe("the Treasure Galleon prize (section 8.2)", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

  it("pays one captain base * boom", () => {
    const r = settleGalleonBattle("decisive", ids(1), 7);
    expect(r.total).toBe(Math.round(250 * boom(7)));
    expect(r.shares.c1!.gold).toBe(r.total);
  });

  it("pays each of N captains N ** 0.5 times the lone share (1.00, 1.41, 1.73)", () => {
    const solo = coopShare(250, 7, 1);
    expect(coopShare(250, 7, 2) / solo).toBeCloseTo(1.41, 2);
    expect(coopShare(250, 7, 3) / solo).toBeCloseTo(1.73, 2);
    for (const n of [2, 3]) {
      const r = settleGalleonBattle("decisive", ids(n), 7);
      expect(Object.keys(r.shares)).toHaveLength(n);
      for (const id of ids(n)) expect(r.shares[id]!.gold / solo).toBeCloseTo(Math.sqrt(n), 1);
      expect(Object.values(r.shares).reduce((t, s) => t + s.gold, 0)).toBe(r.total);
    }
  });

  it("splits a total that does not divide evenly without losing a doubloon", () => {
    for (let tide = 1; tide <= 14; tide++) {
      for (const n of [2, 3]) {
        const r = settleGalleonBattle("decisive", ids(n), tide);
        const gold = Object.values(r.shares).map((s) => s.gold);
        expect(gold.reduce((a, b) => a + b, 0)).toBe(r.total);
        expect(Math.max(...gold) - Math.min(...gold)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("pays a Victory half and gives every captain the co op Legend", () => {
    const full = settleGalleonBattle("decisive", ids(3), 14);
    const half = settleGalleonBattle("victory", ids(3), 14);
    expect(half.total).toBe(Math.round(full.total * B.npc.galleon.victoryPays));
    for (const id of ids(3)) expect(half.shares[id]!.legend).toBe(B.legend.coopPrize);
  });

  it("needs winners", () => {
    expect(() => settleGalleonBattle("decisive", [], 7)).toThrow();
  });
});

describe("fighting the galleon (sections 4.6 and 8.2)", () => {
  const sloop = (id: string, plan: Maneuver[]): Combatant => ({
    id, kind: "player", pr: 10, cannons: 10, sails: 10, crew: 10, hullPoints: 100, maxHull: 100, plan,
  });
  const galleon = (rng: ReturnType<typeof createRng>) =>
    npcCombatant(npcOf("galleon", [...B.npc.galleon.plan], { id: "npc-galleon", pr: npcPR("galleon", 10) }), rng);
  const randomPlan = (rng: ReturnType<typeof createRng>) =>
    Array.from({ length: 3 }, () => rng.pick(["broadside", "outmaneuver", "board"] as Maneuver[]));
  // The counter to broadside, board, broadside is outmaneuver, broadside, outmaneuver.
  const counter: Maneuver[] = ["outmaneuver", "broadside", "outmaneuver"];

  const winRate = (ships: number, plan: (rng: ReturnType<typeof createRng>) => Maneuver[], battles = 600) => {
    const rng = createRng(2024 + ships);
    let wins = 0;
    for (let i = 0; i < battles; i++) {
      const side = Array.from({ length: ships }, (_, k) => sloop(`c${k}`, plan(rng)));
      if (resolveBattle([side, [galleon(rng)]], rng).winner === 0) wins++;
    }
    return wins / battles;
  };

  it("never lets a lone sloop win, even with the perfect counter", () => {
    expect(winRate(1, randomPlan)).toBe(0);
    expect(winRate(1, () => counter)).toBe(0);
  });

  it("is a fleet sized target: three sloops that read its habit beat it far more than careless ones", () => {
    const smart = winRate(3, () => counter);
    const careless = winRate(3, randomPlan);
    expect(smart).toBeGreaterThan(careless);
    expect(smart).toBeGreaterThan(0.5);
  });
});
