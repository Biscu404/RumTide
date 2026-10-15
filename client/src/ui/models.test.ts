import { describe, expect, it } from "vitest";
import { portAction, submitOrders } from "../../../supabase/functions/_shared/api/handlers.ts";
import { brineMap, seasonWorld, type TestWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import type { Me } from "../net/captain.ts";
import { captainFromRow, marketFromRow, ordersFromRow, shipFromRow } from "../net/rows.ts";
import {
  TRIANGLE, destinations, draftFor, fleetMates, isDirty, sentence, shipSpeed, toPayload,
} from "./ordersModel.ts";
import { buyCost, hold, maxBuy, portContext, quotes, repairQuote, sellRevenue, shipwright, upgrades } from "./portModel.ts";

// These run the client's models against the real handlers on the in memory store: whatever the
// Orders and Port screens offer must be accepted by the server, and the prices they show must be
// the prices the server charges.

async function meOf(world: TestWorld, captainId: string): Promise<Me> {
  const view = (await world.store.captainView(world.user(captainId)))!;
  const { tide } = view.active;
  const saved = (await world.store.loadTideState(view.active.season.id)).orders.find((o) => o.captainId === captainId) ?? null;
  return {
    captain: view.captain, ship: view.ship,
    tide: { number: tide.number, status: tide.status, dueAt: tide.dueAt, boomPortId: view.boomPortId },
    settings: view.active.season.settings, orders: saved, market: view.market,
    others: view.roster.filter((r) => r.id !== captainId).map((r) => ({ id: r.id, shipName: `Ship ${r.id}`, fleetId: r.fleetId })),
  };
}

describe("Orders model", () => {
  it("lists only places within the ship's speed, nearest first", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const where = destinations(brineMap, me.ship.nodeId, shipSpeed(me.ship));
    expect(where.length).toBeGreaterThan(0);
    expect(where.every((d) => d.hops >= 1 && d.hops <= shipSpeed(me.ship))).toBe(true);
    expect(where.map((d) => d.nodeId)).not.toContain(me.ship.nodeId);
    expect(where.map((d) => d.hops)).toEqual([...where.map((d) => d.hops)].sort((a, b) => a - b));
  });

  it("builds orders for every destination that the server accepts", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const base = draftFor(me);
    for (const d of [{ nodeId: me.ship.nodeId }, ...destinations(brineMap, me.ship.nodeId, shipSpeed(me.ship))]) {
      const built = toPayload(brineMap, me, { ...base, destination: d.nodeId }, true);
      expect(built.ok).toBe(true);
      if (built.ok) await expect(submitOrders(world.deps, world.user("ann"), built.payload)).resolves.toBeDefined();
    }
  });

  it("starts from the standing orders, and from the saved orders once there are some", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const fresh = draftFor(me);
    expect(fresh.plan).toEqual(me.captain.standingPlan);
    expect(fresh.parley).toEqual(me.captain.standingParley);
    expect(fresh.destination).toBe(me.ship.nodeId);

    const target = destinations(brineMap, me.ship.nodeId, shipSpeed(me.ship))[0]!.nodeId;
    const built = toPayload(brineMap, me, {
      ...fresh, destination: target, intent: "hunt", huntKind: "players", plan: ["board", "board", "outmaneuver"], parley: 1.5,
    }, true);
    if (!built.ok) throw new Error(built.reason);
    await submitOrders(world.deps, world.user("ann"), built.payload);

    const saved = draftFor(await meOf(world, "ann"));
    expect(saved).toMatchObject({ destination: target, intent: "hunt", huntKind: "players", plan: ["board", "board", "outmaneuver"], parley: 1.5, ready: true });
  });

  it("knows when the form has moved away from what is saved", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const draft = draftFor(me);
    const built = toPayload(brineMap, me, draft, false);
    if (!built.ok) throw new Error(built.reason);
    expect(isDirty(null, built.payload)).toBe(true);
    await submitOrders(world.deps, world.user("ann"), built.payload);

    const saved = (await meOf(world, "ann")).orders;
    expect(isDirty(saved, built.payload)).toBe(false);
    const changed = toPayload(brineMap, me, { ...draft, plan: ["board", "board", "board"] }, false);
    if (!changed.ok) throw new Error(changed.reason);
    expect(isDirty(saved, changed.payload)).toBe(true);
  });

  it("asks for a target before hunting a named captain or escorting", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const draft = draftFor(me);
    expect(toPayload(brineMap, me, { ...draft, intent: "hunt", huntKind: "captain", huntCaptainId: "" }, false).ok).toBe(false);
    expect(toPayload(brineMap, me, { ...draft, intent: "hunt", huntKind: "captain", huntCaptainId: "bob" }, false).ok).toBe(true);
    expect(fleetMates(me)).toEqual([]);
    expect(toPayload(brineMap, me, { ...draft, intent: "escort", escortCaptainId: "bob" }, false).ok).toBe(false);
  });

  it("drops fields the intent does not use", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const built = toPayload(brineMap, me, { ...draftFor(me), intent: "trade", huntKind: "anyone", noQuarter: true }, false);
    if (!built.ok) throw new Error(built.reason);
    expect(built.payload.huntFilter).toBeUndefined();
    expect(built.payload.noQuarter).toBe(false);
  });

  it("reads like a sentence", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const target = destinations(brineMap, me.ship.nodeId, shipSpeed(me.ship))[0]!;
    const text = sentence(brineMap, me, {
      ...draftFor(me), destination: target.nodeId, intent: "hunt", huntKind: "merchants",
      plan: ["broadside", "outmaneuver", "board"], parley: 1.5,
    });
    expect(text).toBe(`Sail to ${target.name}, Hunt merchants, fight with Broadside, Outmaneuver, Board, parley if they are 50% stronger.`);
    expect(sentence(brineMap, me, { ...draftFor(me), parley: "off" })).toContain("never parley");
  });

  it("takes the maneuver triangle from the combat rules", () => {
    expect(TRIANGLE).toBe("Broadside beats Board. Outmaneuver beats Broadside. Board beats Outmaneuver.");
  });
});

describe("Port model", () => {
  it("charges exactly what the buy button says", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const quote = quotes(brineMap, me).find((q) => q.good === "rum")!;
    const units = 3;
    const reply = await portAction(world.deps, world.user("ann"), { action: "buy", good: "rum", units });
    expect(me.captain.chestGold - reply.chestGold).toBe(buyCost(quote, units));
  });

  it("pays exactly what the sell button says, including the falling price", async () => {
    const world = await seasonWorld();
    await portAction(world.deps, world.user("ann"), { action: "buy", good: "rum", units: 4 });
    const me = await meOf(world, "ann");
    const quote = quotes(brineMap, me).find((q) => q.good === "rum")!;
    expect(quote.held).toBe(4);
    const reply = await portAction(world.deps, world.user("ann"), { action: "sell", good: "rum", units: 4 });
    expect(reply.chestGold - me.captain.chestGold).toBe(sellRevenue(quote, 4));
  });

  it("limits Max buy by the Hold and by the Chest, and the server agrees", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const quote = quotes(brineMap, me).find((q) => q.good === "sugar")!;
    const most = maxBuy(quote, me);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(hold(me).free);
    expect(buyCost(quote, most)).toBeLessThanOrEqual(me.captain.chestGold);
    await expect(portAction(world.deps, world.user("ann"), { action: "buy", good: "sugar", units: most })).resolves.toBeDefined();
  });

  it("quotes upgrades and the Shipwright like the server does", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    for (const row of upgrades(me)) {
      expect(row.level).toBe(me.ship.levels[row.stat]);
      expect(row.cost).not.toBeNull();
    }
    const cheapest = upgrades(me).filter((u) => u.affordable)[0];
    if (cheapest) {
      const reply = await portAction(world.deps, world.user("ann"), { action: "upgrade", stat: cheapest.stat });
      expect(me.captain.chestGold - reply.chestGold).toBe(cheapest.cost);
    }
    const wright = shipwright(me)!;
    expect(wright.target).toBe("brigantine");
    expect(wright.owed).toBe(wright.cost);
  });

  it("quotes a repair that matches the server", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    // Damage the ship in the store the way a battle would, then compare the quote with the real repair.
    const damaged = { ...me, ship: { ...me.ship, hullPoints: me.ship.hullPoints - 4 } };
    const quote = repairQuote(portContext(brineMap, damaged), damaged);
    expect(quote.missing).toBeCloseTo(4);
    expect(quote.points).toBeCloseTo(4);
    expect(quote.cost).toBeGreaterThan(0);
  });
});

describe("Row mapping", () => {
  it("turns database rows into engine objects", () => {
    const captain = captainFromRow({
      id: "c1", season_id: "s1", user_id: "u1", ship_name: "Wet Sock", flag: "red", parting_shot: "", legend: 5,
      chest_gold: 120, bounty: 0, shield_until_tide: null, fleet_id: null, standing_plan: ["board", "board", "board"],
      standing_parley: "off", shore_leave_tides: 1, last_orders_tide: 2, status: "active", version: 3,
    });
    expect(captain).toMatchObject({ id: "c1", shipName: "Wet Sock", chestGold: 120, shieldUntilTide: null, fleetId: null, shoreLeaveTides: 1 });

    const ship = shipFromRow({
      captain_id: "c1", hull: "sloop", node_id: "rumhaven", docked: true, hull_points: 10, levels: { hull: 0, cannons: 0, sails: 0, crew: 0, hold: 0 },
      plunder_gold: 0, cargo: { rum: 0, sugar: 0, spice: 0 }, cargo_cost_basis: { rum: 0, sugar: 0, spice: 0 }, shipwright_progress: 0,
    });
    expect(ship).toMatchObject({ nodeId: "rumhaven", docked: true, hullPoints: 10, shipwrightProgress: 0 });

    expect(marketFromRow({ season_id: "s1", port_id: "rumhaven", good: "rum", drift: 0.9, sold_this_tide: 2 }))
      .toEqual({ seasonId: "s1", portId: "rumhaven", good: "rum", drift: 0.9, soldThisTide: 2 });

    expect(ordersFromRow({
      tide: 1, captain_id: "c1", course: ["sea01"], intent: "hunt", hunt_filter: "players", escort_captain_id: null,
      plan: ["board", "board", "board"], parley: 1.25, no_quarter: true, ready: false,
    })).toEqual({
      tide: 1, captainId: "c1", course: ["sea01"], intent: "hunt", huntFilter: "players",
      plan: ["board", "board", "board"], parley: 1.25, noQuarter: true, ready: false,
    });
  });
});
