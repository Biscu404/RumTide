import { describe, expect, it } from "vitest";
import { B } from "@engine/balance.ts";
import { portAction } from "../../../supabase/functions/_shared/api/handlers.ts";
import { brineMap, seasonWorld, type TestWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import type { Me } from "../net/captain.ts";
import { estimateSale, fairWindsLine, incomeView } from "./incomeModel.ts";
import { quotes } from "./portModel.ts";

// These run the income display against the real handler on the in memory store: the bonus the Port
// screen promises for a sale must be the bonus the server pays.

async function meOf(world: TestWorld, captainId: string): Promise<Me> {
  const view = (await world.store.captainView(world.user(captainId)))!;
  const { tide } = view.active;
  return {
    captain: view.captain, ship: view.ship,
    tide: { number: tide.number, status: tide.status, dueAt: tide.dueAt, boomPortId: view.boomPortId },
    settings: view.active.season.settings, orders: null, market: view.market,
    others: view.roster.filter((r) => r.id !== captainId).map((r) => ({ id: r.id, shipName: r.id, fleetId: r.fleetId })),
  };
}

const markers = (w: TestWorld) => w.store.snapshot().captains.map((c) => ({
  captainId: c.id, nodeId: w.store.snapshot().ships.find((s) => s.captainId === c.id)!.nodeId, fleetId: c.fleetId,
}));

/** Ann docked at Saint Brine, which wants Sugar, holding 10 units that cost 50 in all. */
async function withSugar(captains: Parameters<typeof seasonWorld>[0] = ["ann", "bob", "cat"], basis = 50) {
  const w = await seasonWorld(captains);
  w.store.edit("s0", (snap) => {
    snap.ships = snap.ships.map((s) => (s.captainId === "ann"
      ? { ...s, nodeId: "saint_brine", docked: true, cargo: { rum: 0, sugar: 10, spice: 0 }, cargoCostBasis: { rum: 0, sugar: basis, spice: 0 } }
      : s));
  });
  return w;
}
const patchCaptain = (w: TestWorld, id: string, patch: Record<string, unknown>) =>
  w.store.edit("s0", (snap) => { snap.captains = snap.captains.map((c) => (c.id === id ? { ...c, ...patch } : c)); });

describe("Income display", () => {
  it("says nothing to a captain with no bonus", async () => {
    const w = await seasonWorld();
    const view = incomeView(brineMap, await meOf(w, "ann"), markers(w));
    expect(view).toMatchObject({ rate: 0, shoreLeave: false, fairWinds: false, convoyMates: 0, lines: [] });
  });

  it("names each bonus that is paying out, with its size from balance.ts", async () => {
    const w = await seasonWorld([
      { id: "ann", userId: "user-ann", fleetId: "f1" }, { id: "bob", userId: "user-bob", fleetId: "f1" }, { id: "cat", userId: "user-cat" },
    ]);
    w.store.edit("s0", (snap) => {
      const annsNode = snap.ships.find((x) => x.captainId === "ann")!.nodeId;
      snap.ships = snap.ships.map((s) => (s.captainId === "bob" ? { ...s, nodeId: annsNode } : s));
    });
    patchCaptain(w, "ann", { shoreLeaveTides: 2, fairWinds: true });
    const view = incomeView(brineMap, await meOf(w, "ann"), markers(w));
    expect(view).toMatchObject({ shoreLeave: true, fairWinds: true, convoyMates: 1, stored: 2 });
    expect(view.rate).toBeCloseTo(B.catchUp.shoreLeaveBonus + B.catchUp.fairWindsBonus + B.fleet.convoyPerMate);
    expect(view.lines).toHaveLength(3);
    expect(view.lines[0]).toContain("Shore Leave: 2 stored");
    expect(view.lines[1]).toBe(fairWindsLine());
    expect(view.lines[2]).toContain("1 fleet mate is close by");
  });

  it("says Shore Leave is paying out once a stored Tide is spent in this Tide", async () => {
    const w = await withSugar();
    patchCaptain(w, "ann", { shoreLeaveTides: 1 });
    await portAction(w.deps, w.user("ann"), { action: "sell", good: "sugar", units: 4 });
    const view = incomeView(brineMap, await meOf(w, "ann"), markers(w));
    expect(view.shoreLeave).toBe(true);
    expect(view.lines[0]).toContain("Shore Leave is paying out this Tide");
  });

  it("counts a fleet mate on the next node but not one further away", async () => {
    const fleet = [
      { id: "ann", userId: "user-ann", fleetId: "f1" }, { id: "bob", userId: "user-bob", fleetId: "f1" }, { id: "cat", userId: "user-cat" },
    ];
    for (const [where, expected] of [[brineMap.neighbours("saint_brine")[0]!, 1], [brineMap.nodeIds.find((id) => id !== "saint_brine" && !brineMap.adjacent("saint_brine", id))!, 0]] as const) {
      const w = await withSugar(fleet);
      w.store.edit("s0", (snap) => { snap.ships = snap.ships.map((s) => (s.captainId === "bob" ? { ...s, nodeId: where } : s)); });
      expect(incomeView(brineMap, await meOf(w, "ann"), markers(w)).convoyMates).toBe(expected);
    }
  });

  it("trusts the captain's own ship over a ship list that is a moment behind", async () => {
    const w = await withSugar([{ id: "ann", userId: "user-ann", fleetId: "f1" }, { id: "bob", userId: "user-bob", fleetId: "f1" }, { id: "cat", userId: "user-cat" }]);
    w.store.edit("s0", (snap) => { snap.ships = snap.ships.map((s) => (s.captainId === "bob" ? { ...s, nodeId: "saint_brine" } : s)); });
    const stale = markers(w).map((m) => (m.captainId === "ann" ? { ...m, nodeId: "somewhere_else" } : m));
    expect(incomeView(brineMap, await meOf(w, "ann"), stale).convoyMates).toBe(1);
  });

  describe("the promised sale", () => {
    const sellAll = { action: "sell", good: "sugar", units: 10 };

    it("is what the server pays, for every mix of bonuses", async () => {
      for (const patch of [{}, { shoreLeaveTides: 1 }, { fairWinds: true }, { shoreLeaveTides: 3, fairWinds: true }]) {
        const w = await withSugar();
        patchCaptain(w, "ann", patch);
        const me = await meOf(w, "ann");
        const view = incomeView(brineMap, me, markers(w));
        const quote = quotes(brineMap, me).find((q) => q.good === "sugar")!;
        const promised = estimateSale(quote, 10, me.ship, view.rate);
        const paid = await portAction(w.deps, w.user("ann"), sellAll);
        expect(paid.chestGold - me.captain.chestGold, JSON.stringify(patch)).toBe(promised.revenue + promised.bonus);
        expect(promised.bonus > 0).toBe(Object.keys(patch).length > 0);
      }
    });

    it("promises no bonus on a sale at a loss, and the server pays none", async () => {
      const w = await withSugar(["ann", "bob", "cat"], 10_000);
      patchCaptain(w, "ann", { shoreLeaveTides: 1, fairWinds: true });
      const me = await meOf(w, "ann");
      const view = incomeView(brineMap, me, markers(w));
      const promised = estimateSale(quotes(brineMap, me).find((q) => q.good === "sugar")!, 10, me.ship, view.rate);
      expect(promised.profit).toBeLessThan(0);
      expect(promised.bonus).toBe(0);
      const paid = await portAction(w.deps, w.user("ann"), sellAll);
      expect(paid.chestGold - me.captain.chestGold).toBe(promised.revenue);
    });

    it("is a part sale's share of the cost, as the server works it out", async () => {
      const w = await withSugar();
      patchCaptain(w, "ann", { fairWinds: true });
      const me = await meOf(w, "ann");
      const view = incomeView(brineMap, me, markers(w));
      const promised = estimateSale(quotes(brineMap, me).find((q) => q.good === "sugar")!, 4, me.ship, view.rate);
      const paid = await portAction(w.deps, w.user("ann"), { action: "sell", good: "sugar", units: 4 });
      expect(paid.chestGold - me.captain.chestGold).toBe(promised.revenue + promised.bonus);
    });

    it("is nothing for a good the Hold does not have", async () => {
      const w = await withSugar();
      const me = await meOf(w, "ann");
      expect(estimateSale(quotes(brineMap, me).find((q) => q.good === "rum")!, 0, me.ship, 0.7)).toEqual({ revenue: 0, profit: 0, bonus: 0 });
    });
  });
});
