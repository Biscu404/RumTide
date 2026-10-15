import { describe, expect, it } from "vitest";
import { fleetAction, submitOrders } from "../../../supabase/functions/_shared/api/handlers.ts";
import { brineMap, seasonWorld, type TestWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import type { Me } from "../net/captain.ts";
import type { FleetsState } from "../net/fleets.ts";
import type { ShipMarker } from "../scenes/layout.ts";
import { FLAG_CHOICES, fleetScreen, withFleetColours } from "./fleetModel.ts";

// These run the Fleet screen's model against the real handlers on the in memory store: what the
// screen offers must be accepted by the server, and what it hides must be what the server refuses.

const SIX = ["ann", "bob", "cat", "dan", "eve", "fay"];
const PLAN = ["board", "board", "outmaneuver"] as const;

async function meOf(world: TestWorld, captainId: string): Promise<Me> {
  const view = (await world.store.captainView(world.user(captainId)))!;
  const { tide } = view.active;
  const saved = (await world.store.loadTideState("s0")).orders.find((o) => o.captainId === captainId) ?? null;
  return {
    captain: view.captain, ship: view.ship,
    tide: { number: tide.number, status: tide.status, dueAt: tide.dueAt, boomPortId: view.boomPortId },
    settings: view.active.season.settings, orders: saved, market: view.market,
    others: view.roster.filter((r) => r.id !== captainId).map((r) => ({ id: r.id, shipName: r.shipName, fleetId: r.fleetId })),
  };
}

/** What a captain's client reads: what row level security lets them see of the fleets and orders. */
async function stateOf(world: TestWorld, captainId: string): Promise<FleetsState> {
  const { book } = await world.store.loadFleets("s0");
  const mine = book.members.find((m) => m.captainId === captainId)?.fleetId ?? null;
  const mates = new Set(book.members.filter((m) => m.fleetId === mine && mine !== null).map((m) => m.captainId));
  const orders = (await world.store.loadTideState("s0")).orders;
  return {
    fleets: book.fleets, members: book.members,
    invites: book.invites.filter((i) => i.captainId === captainId || mates.has(i.invitedBy)),
    mateOrders: orders.filter((o) => mates.has(o.captainId) && o.captainId !== captainId),
  };
}

const screenOf = async (world: TestWorld, captainId: string) => {
  const ships: ShipMarker[] = world.store.snapshot().ships.map((s) => ({
    captainId: s.captainId, shipName: s.captainId, nodeId: s.nodeId, docked: s.docked, hull: s.hull, hullPoints: s.hullPoints, isMine: s.captainId === captainId,
  }));
  return fleetScreen(brineMap, await meOf(world, captainId), await stateOf(world, captainId), ships);
};

const act = (w: TestWorld, who: string, body: unknown) => fleetAction(w.deps, w.user(who), body);

describe("Fleet screen model", () => {
  it("offers a captain with no fleet the chance to found one, with flags the server accepts", async () => {
    const w = await seasonWorld(SIX);
    const screen = await screenOf(w, "ann");
    expect(screen).toMatchObject({ canFound: true, mine: null, invitations: [], others: [], invitable: [], cap: 3 });
    for (const [i, flag] of FLAG_CHOICES.entries()) {
      // One captain founds a fleet with each flag in turn, then leaves again (alone, so at once).
      await act(w, "ann", { action: "create", name: `Fleet ${i}`, flag: flag.id });
      await act(w, "ann", { action: "leave" });
    }
    expect((await w.store.loadFleets("s0")).book.fleets).toEqual([]);
  });

  it("lists as invitable exactly the captains the server lets the fleet ask, until it is full", async () => {
    const w = await seasonWorld(SIX);
    await act(w, "ann", { action: "create", name: "Red Tide", flag: "skull" });

    let screen = await screenOf(w, "ann");
    expect(screen.canFound).toBe(false);
    expect(screen.mine).toMatchObject({ canInvite: true, full: false, iAmLeaving: false, cap: 3 });
    expect(screen.invitable.map((c) => c.id)).toEqual(["bob", "cat", "dan", "eve", "fay"]);

    // Every one of them is accepted by the server.
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "ann", { action: "invite", captainId: "cat" });
    screen = await screenOf(w, "ann");
    expect(screen.invitable.map((c) => c.id)).toEqual(["dan", "eve", "fay"]);
    expect(screen.mine!.waitingOn.map((c) => c.shipName)).toEqual(["bob", "cat"]);

    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    await act(w, "cat", { action: "accept", fleetId: "fleet-1" });
    screen = await screenOf(w, "ann");
    expect(screen.mine).toMatchObject({ full: true, canInvite: false });
    expect(screen.invitable).toEqual([]);
    await expect(act(w, "ann", { action: "invite", captainId: "dan" })).rejects.toThrow(/at most 3/);
  });

  it("shows an invitation to the captain it is for, and the Join button agrees with the server", async () => {
    const w = await seasonWorld(SIX);
    await act(w, "ann", { action: "create", name: "Red Tide", flag: "anchor" });
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "ann", { action: "invite", captainId: "cat" });
    await act(w, "ann", { action: "invite", captainId: "dan" });
    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    await act(w, "cat", { action: "accept", fleetId: "fleet-1" });

    const dan = await screenOf(w, "dan");
    expect(dan.mine).toBeNull();
    expect(dan.invitations).toHaveLength(1);
    expect(dan.invitations[0]).toMatchObject({ from: "ann", full: true, members: ["ann", "bob", "cat"] });
    expect(dan.invitations[0]!.fleet.name).toBe("Red Tide");
    await expect(act(w, "dan", { action: "accept", fleetId: dan.invitations[0]!.fleet.id })).rejects.toThrow(/full/);

    // eve was never asked, and sees the fleet only in the list of other fleets.
    const eve = await screenOf(w, "eve");
    expect(eve.invitations).toEqual([]);
    expect(eve.others.map((o) => o.fleet.name)).toEqual(["Red Tide"]);
    expect(eve.others[0]).toMatchObject({ full: true });
  });

  it("shows fleet mates' orders and whether they are Ready, and nobody else's", async () => {
    const w = await seasonWorld(SIX);
    await act(w, "ann", { action: "create", name: "Red Tide", flag: "skull" });
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    const base = { tide: 1, intent: "hunt", huntFilter: "players", plan: PLAN, parley: 1.25, noQuarter: false };
    await submitOrders(w.deps, w.user("bob"), { ...base, course: [], ready: true });
    await submitOrders(w.deps, w.user("cat"), { ...base, course: [], ready: true });

    const ann = await screenOf(w, "ann");
    const bob = ann.mine!.members.find((m) => m.captainId === "bob")!;
    expect(bob.orders).toMatch(/^Stay in .+, Hunt players, fight with Board, Board, Outmaneuver, parley if they are 25% stronger\.$/);
    expect(bob.ready).toBe(true);
    const self = ann.mine!.members.find((m) => m.isMe)!;
    expect(self).toMatchObject({ orders: null, ready: null });
    expect(JSON.stringify(ann)).not.toContain("cat's orders");

    // A mate with nothing saved yet says so.
    await act(w, "ann", { action: "invite", captainId: "dan" });
    await act(w, "dan", { action: "accept", fleetId: "fleet-1" });
    const dan = (await screenOf(w, "ann")).mine!.members.find((m) => m.captainId === "dan")!;
    expect(dan.orders).toMatch(/No orders yet/);
    expect(dan.ready).toBe(false);

    // Someone in no fleet reads nobody's orders.
    const eve = await screenOf(w, "eve");
    expect(eve.mine).toBeNull();
  });

  it("marks a member who has given notice, for everyone to see", async () => {
    const w = await seasonWorld(SIX);
    await act(w, "ann", { action: "create", name: "Red Tide", flag: "skull" });
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    await act(w, "bob", { action: "leave" });

    const bob = await screenOf(w, "bob");
    expect(bob.mine).toMatchObject({ iAmLeaving: true, canInvite: false });
    expect(bob.mine!.members.find((m) => m.isMe)!.leavingAtTide).toBe(2);

    const eve = await screenOf(w, "eve");
    expect(eve.others[0]!.members).toEqual([
      { shipName: "ann", leavingAtTide: null }, { shipName: "bob", leavingAtTide: 2 },
    ]);
  });
});

describe("withFleetColours", () => {
  it("gives every ship of a fleet the fleet's sail colour and leaves the others alone", () => {
    const ship = (captainId: string, fleetId: string | null): ShipMarker => ({
      captainId, shipName: captainId, nodeId: "n", docked: true, hull: "sloop", hullPoints: 1, isMine: false, fleetId,
    });
    const fleet = { id: "f1", seasonId: "s0", name: "Red Tide", flag: "skull", colour: "#e43b44", createdTide: 1 };
    const out = withFleetColours([ship("a", "f1"), ship("b", "f1"), ship("c", null), ship("d", "gone")], [fleet]);
    expect(out.map((s) => s.fleetColour)).toEqual(["#e43b44", "#e43b44", undefined, undefined]);
  });
});
