import { describe, expect, it } from "vitest";
import { B } from "../engine/balance.ts";
import { portAction, resolveDueTide, startNewSeason, submitOrders } from "./handlers.ts";
import { ApiError } from "./store.ts";
import { brineMap, seasonWorld, testWorld } from "./testing.ts";

const PLAN = ["broadside", "outmaneuver", "board"] as const;
const orders = (tide: number, extra: Record<string, unknown> = {}) => ({
  tide, course: [], intent: "trade", plan: PLAN, parley: "off", noQuarter: false, ready: false, ...extra,
});

/** Run a call that should fail and hand back the error. */
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (error) { return error as ApiError; }
  throw new Error("Expected the call to fail");
}

const AT_21 = new Date("2026-10-14T18:00:00Z");

describe("submit_orders", () => {
  it("saves a valid order for the open Tide", async () => {
    const w = await seasonWorld();
    const ship = w.store.snapshot().ships.find((s) => s.captainId === "ann")!;
    const step = brineMap.neighbours(ship.nodeId)[0]!;
    const { orders: saved } = await submitOrders(w.deps, w.user("ann"), orders(1, { course: [step], intent: "quiet", ready: true }));
    expect(saved).toMatchObject({ captainId: "ann", tide: 1, course: [step], ready: true });
    expect((await w.store.loadTideState("s0")).orders).toHaveLength(1);
  });

  it("replaces the earlier orders of the same captain", async () => {
    const w = await seasonWorld();
    await submitOrders(w.deps, w.user("ann"), orders(1, { ready: true }));
    await submitOrders(w.deps, w.user("ann"), orders(1, { ready: false, parley: 1.5 }));
    const saved = (await w.store.loadTideState("s0")).orders;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ ready: false, parley: 1.5 });
  });

  it("rejects payloads that are the wrong shape, with a 400", async () => {
    const w = await seasonWorld();
    for (const bad of [
      null, {}, orders(1, { plan: ["broadside", "board"] }), orders(1, { parley: 2 }), orders(1, { intent: "plunder" }),
      orders(1, { gold: 9999 }), orders(0), orders(1, { course: "port_regal" }),
    ]) {
      expect((await failure(submitOrders(w.deps, w.user("ann"), bad))).status).toBe(400);
    }
  });

  it("rejects a course that is not connected or is too long", async () => {
    const w = await seasonWorld();
    const far = brineMap.nodeIds.find((id) => !brineMap.adjacent(w.store.snapshot().ships[0]!.nodeId, id))!;
    expect((await failure(submitOrders(w.deps, w.user("ann"), orders(1, { course: [far] })))).status).toBe(400);
    const walk = [...brineMap.nodeIds].slice(0, 6);
    expect((await failure(submitOrders(w.deps, w.user("ann"), orders(1, { course: walk })))).status).toBe(400);
  });

  it("rejects orders for the wrong Tide, from a stranger, and after the Tide is due", async () => {
    const w = await seasonWorld();
    expect((await failure(submitOrders(w.deps, w.user("ann"), orders(2)))).status).toBe(409);
    expect((await failure(submitOrders(w.deps, "user-nobody", orders(1)))).status).toBe(404);
    w.setNow(AT_21);
    expect((await failure(submitOrders(w.deps, w.user("ann"), orders(1)))).status).toBe(409);
  });

  it("drops a hunt filter that does not go with the intent", async () => {
    const w = await seasonWorld();
    const { orders: saved } = await submitOrders(w.deps, w.user("ann"), orders(1, { intent: "trade", huntFilter: "players" }));
    expect(saved.huntFilter).toBeUndefined();
  });

  it("checks hunt and escort targets", async () => {
    const w = await seasonWorld([
      { id: "ann", userId: "user-ann", fleetId: "f1" }, { id: "bob", userId: "user-bob", fleetId: "f1" },
      { id: "cat", userId: "user-cat" },
    ]);
    const ann = w.user("ann");
    expect((await failure(submitOrders(w.deps, ann, orders(1, { intent: "hunt", huntFilter: { captainId: "ghost" } })))).status).toBe(400);
    expect((await failure(submitOrders(w.deps, ann, orders(1, { intent: "hunt", huntFilter: { captainId: "ann" } })))).status).toBe(400);
    await submitOrders(w.deps, ann, orders(1, { intent: "hunt", huntFilter: { captainId: "cat" } }));
    await submitOrders(w.deps, ann, orders(1, { intent: "escort", escortCaptainId: "bob" }));
    expect((await failure(submitOrders(w.deps, ann, orders(1, { intent: "escort", escortCaptainId: "cat" })))).status).toBe(400);
    expect((await failure(submitOrders(w.deps, ann, orders(1, { intent: "escort" })))).status).toBe(400);
  });
});

describe("port_action", () => {
  const buy = (good: string, units: number) => ({ action: "buy", good, units });

  it("buys and sells, moving the Chest, the Hold, the market and the audit trail", async () => {
    const w = await seasonWorld();
    const ann = w.user("ann");
    const start = B.startGold;
    const bought = await portAction(w.deps, ann, buy("rum", 4));
    expect(bought.ship.cargo.rum).toBe(4);
    expect(bought.chestGold).toBeLessThan(start);

    const sold = await portAction(w.deps, ann, { action: "sell", good: "rum", units: 4 });
    expect(sold.ship.cargo.rum).toBe(0);
    const row = w.store.snapshot().market.find((m) => m.portId === sold.ship.nodeId && m.good === "rum")!;
    expect(row.drift).toBeLessThan(1);
    expect(row.soldThisTide).toBe(4);

    expect(w.store.transactions.map((t) => t.kind)).toEqual(["buy", "sell"]);
    const [b, s] = w.store.transactions;
    expect(b!.amount).toBe(bought.chestGold - start);
    expect(s!.balanceAfter).toBe(sold.chestGold);
  });

  it("explains a rule break in words the player can read, and changes nothing", async () => {
    const w = await seasonWorld();
    const before = w.store.snapshot();
    const err = await failure(portAction(w.deps, w.user("ann"), buy("rum", 900)));
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/Hold has room/);
    expect(w.store.snapshot()).toEqual(before);
    expect(w.store.transactions).toHaveLength(0);
  });

  it("buys upgrades, repairs and feeds the Shipwright", async () => {
    const w = await seasonWorld();
    const ann = w.user("ann");
    const up = await portAction(w.deps, ann, { action: "upgrade", stat: "hold" });
    expect(up.ship.levels.hold).toBe(1);
    expect((await portAction(w.deps, ann, { action: "repair" })).message).toBe("Nothing to repair.");
    const wright = await portAction(w.deps, ann, { action: "shipwright", amount: 10 });
    expect(wright.ship.shipwrightProgress).toBe(10);
    expect(w.store.transactions.map((t) => t.kind)).toEqual(["upgrade", "repair", "shipwright"]);
  });

  it("refuses an unknown action or stat, and anyone who is not docked", async () => {
    const w = await seasonWorld();
    expect((await failure(portAction(w.deps, w.user("ann"), { action: "steal" }))).status).toBe(400);
    expect((await failure(portAction(w.deps, w.user("ann"), { action: "upgrade", stat: "luck" }))).status).toBe(400);
    // Put ann at sea: not docked, so no port action.
    const sea = brineMap.nodeIds.find((id) => brineMap.node(id).type === "sea")!;
    w.store.edit("s0", (snap) => {
      snap.ships = snap.ships.map((s) => (s.captainId === "ann" ? { ...s, nodeId: sea, docked: false } : s));
    });
    expect((await failure(portAction(w.deps, w.user("ann"), buy("rum", 1)))).message).toMatch(/not docked/);
  });

  it("lets only one of two simultaneous actions through", async () => {
    const w = await seasonWorld();
    const results = await Promise.allSettled([
      portAction(w.deps, w.user("ann"), buy("rum", 2)),
      portAction(w.deps, w.user("ann"), buy("rum", 2)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((lost.reason as ApiError).status).toBe(409);
    expect(w.store.snapshot().ships.find((s) => s.captainId === "ann")!.cargo.rum).toBe(2);
  });

  it("is closed while the Tide is resolving and once it is due", async () => {
    const w = await seasonWorld();
    w.setNow(AT_21);
    expect((await failure(portAction(w.deps, w.user("ann"), buy("rum", 1)))).status).toBe(409);
  });
});

describe("resolve_tide", () => {
  it("waits until the Tide is due", async () => {
    const w = await seasonWorld();
    expect(await resolveDueTide(w.deps)).toEqual({ status: "waiting", dueAt: AT_21.toISOString() });
    expect(w.posts).toHaveLength(0);
  });

  it("resolves a due Tide, opens the next one for tomorrow at 21:00 and posts the Gazette", async () => {
    const w = await seasonWorld();
    w.setNow(new Date("2026-10-14T18:03:00Z"));
    const out = await resolveDueTide(w.deps);
    expect(out).toMatchObject({ status: "resolved", tide: 1, reason: "scheduled", seasonEnded: false });
    expect(w.store.tideInfo("s0")).toMatchObject({ number: 2, status: "open", dueAt: "2026-10-15T18:00:00.000Z" });
    expect(w.store.snapshot().tide).toBe(2);
    expect(w.posts).toHaveLength(1);
    expect(w.posts[0]).toContain("Tide 1");
    expect(w.posts[0]).toContain(w.store.gazettes.get(1)!.headlines[0]!);
  });

  it("uses the same seed on a retry: the result depends only on the snapshot, orders and the stored seed", async () => {
    const a = await seasonWorld();
    const b = await seasonWorld();
    for (const w of [a, b]) {
      await submitOrders(w.deps, w.user("ann"), orders(1, { intent: "quiet" }));
      w.setNow(AT_21);
      await resolveDueTide(w.deps);
    }
    expect(a.store.snapshot()).toEqual(b.store.snapshot());
  });

  it("turns early when every active captain is Ready, once a day", async () => {
    const w = await seasonWorld();
    await submitOrders(w.deps, w.user("ann"), orders(1, { ready: true }));
    await submitOrders(w.deps, w.user("bob"), orders(1, { ready: true }));
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "waiting" });
    await submitOrders(w.deps, w.user("cat"), orders(1, { ready: true }));

    const out = await resolveDueTide(w.deps);
    expect(out).toMatchObject({ status: "resolved", tide: 1, reason: "early" });
    // The early Tide used up the day: Tide 2 is due tomorrow at 21:00, not tonight.
    expect(w.store.tideInfo("s0").dueAt).toBe("2026-10-15T18:00:00.000Z");

    for (const c of ["ann", "bob", "cat"]) await submitOrders(w.deps, w.user(c), orders(2, { ready: true }));
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "waiting" });
    // Midnight is a new day: everyone is Ready, so Tide 2 may turn.
    w.setNow(new Date("2026-10-14T21:30:00Z"));
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "resolved", tide: 2, reason: "early" });
  });

  it("does not count Ashore captains as not Ready", async () => {
    const w = await seasonWorld();
    w.store.edit("s0", (snap) => {
      snap.captains = snap.captains.map((c) => (c.id === "cat" ? { ...c, status: "ashore" as const } : c));
    });
    await submitOrders(w.deps, w.user("ann"), orders(1, { ready: true }));
    await submitOrders(w.deps, w.user("bob"), orders(1, { ready: true }));
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "resolved", reason: "early" });
  });

  it("resolves a Tide only once when two callers race", async () => {
    const w = await seasonWorld();
    w.setNow(AT_21);
    const outcomes = await Promise.all([resolveDueTide(w.deps), resolveDueTide(w.deps), resolveDueTide(w.deps)]);
    expect(outcomes.map((o) => o.status).sort()).toEqual(["busy", "busy", "resolved"]);
    expect(w.store.snapshot().tide).toBe(2);
    expect(w.posts).toHaveLength(1);
  });

  it("can be forced before it is due", async () => {
    const w = await seasonWorld();
    expect(await resolveDueTide(w.deps, { force: true })).toMatchObject({ status: "resolved", reason: "forced" });
  });

  it("marks the Tide failed and says so in Discord when the engine throws, leaving the state alone", async () => {
    const w = await seasonWorld();
    w.setNow(AT_21);
    // A captain without a ship makes resolveTide throw.
    w.store.edit("s0", (snap) => { snap.ships = snap.ships.filter((s) => s.captainId !== "cat"); });
    const broken = w.store.snapshot();

    const out = await resolveDueTide(w.deps);
    expect(out).toMatchObject({ status: "failed", tide: 1 });
    expect(w.store.tideInfo("s0").status).toBe("failed");
    expect(w.store.snapshot()).toEqual(broken);
    expect(w.posts[0]).toMatch(/could not be resolved/);
    // A failed Tide is not resolved again until the admin retries it.
    expect(await resolveDueTide(w.deps)).toEqual({ status: "busy" });
  });

  it("still resolves the Tide when Discord is down", async () => {
    const w = await seasonWorld(["ann", "bob"], { notifyFails: true });
    w.setNow(AT_21);
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "resolved" });
    expect(w.store.snapshot().tide).toBe(2);
  });

  it("ends the season after the last Tide", async () => {
    const w = await seasonWorld(["ann", "bob"]);
    let last;
    for (let tide = 1; tide <= 14; tide++) {
      w.setNow(new Date(w.store.tideInfo("s0").dueAt));
      last = await resolveDueTide(w.deps);
      expect(last.status).toBe("resolved");
    }
    expect(last).toMatchObject({ tide: 14, seasonEnded: true });
    expect(w.store.seasonInfo("s0").status).toBe("ended");
    expect(await w.store.activeSeason()).toBeNull();
    expect(await resolveDueTide(w.deps)).toEqual({ status: "idle" });
    expect(w.store.snapshot().tide).toBe(15);
  });

  it("is idle with no season", async () => {
    expect(await resolveDueTide(testWorld().deps)).toEqual({ status: "idle" });
  });
});

describe("start season", () => {
  it("opens Tide 1 due at the next 21:00, with a ship docked in port for each captain", async () => {
    const w = await seasonWorld(["ann", "bob"]);
    expect(w.store.tideInfo("s0")).toMatchObject({ number: 1, status: "open", dueAt: AT_21.toISOString() });
    const snap = w.store.snapshot();
    expect(snap.captains.map((c) => c.userId)).toEqual(["user-ann", "user-bob"]);
    expect(snap.ships.every((s) => s.docked && brineMap.node(s.nodeId).type === "port")).toBe(true);
  });

  it("refuses a season id that exists", async () => {
    const w = await seasonWorld(["ann"]);
    await expect(startNewSeason(w.deps, {
      seasonId: "s0", name: "Again", mapId: brineMap.id, preset: "season0", timezone: "Europe/Bucharest",
      tideTimeLocal: "21:00", captains: [{ id: "ann", userId: "user-ann" }],
    })).rejects.toThrow(/already exists/);
  });
});
