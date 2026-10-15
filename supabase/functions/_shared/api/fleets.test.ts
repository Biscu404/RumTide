import { describe, expect, it } from "vitest";
import { fleetCap } from "../engine/balance.ts";
import { fleetAction, portAction, resolveDueTide, submitOrders } from "./handlers.ts";
import { ApiError } from "./store.ts";
import { brineMap, seasonWorld, type TestWorld } from "./testing.ts";

const brineMapSea = () => brineMap.nodeIds.find((id) => brineMap.node(id).type === "sea")!;
const SIX = ["ann", "bob", "cat", "dan", "eve", "fay"];
const PLAN = ["broadside", "outmaneuver", "board"] as const;
const AT_21 = new Date("2026-10-14T18:00:00Z");

const orders = (tide: number, extra: Record<string, unknown> = {}) => ({
  tide, course: [], intent: "trade", plan: PLAN, parley: "off", noQuarter: false, ready: false, ...extra,
});

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (error) { return error as ApiError; }
  throw new Error("Expected the call to fail");
}

const act = (w: TestWorld, who: string, body: unknown) => fleetAction(w.deps, w.user(who), body);
const found = (w: TestWorld, who: string, name = "Red Tide", flag = "skull") => act(w, who, { action: "create", name, flag });
const fleetsOf = async (w: TestWorld) => (await w.store.loadFleets("s0")).book;
const fleetIdOf = (w: TestWorld, captainId: string) => w.store.snapshot().captains.find((c) => c.id === captainId)!.fleetId;

/** ann founds the Red Tide and bob joins it. */
async function pair(): Promise<Awaited<ReturnType<typeof seasonWorld>>> {
  const w = await seasonWorld(SIX);
  await found(w, "ann");
  await act(w, "ann", { action: "invite", captainId: "bob" });
  await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
  return w;
}

describe("fleet_action: founding and joining", () => {
  it("founds a fleet, invites a captain, and puts both in the fleet when the invitation is accepted", async () => {
    const w = await seasonWorld(SIX);
    expect((await found(w, "ann", "  Red   Tide ", "anchor")).message).toBe("You founded the Red Tide.");
    expect(fleetIdOf(w, "ann")).toBe("fleet-1");
    expect(fleetIdOf(w, "bob")).toBeNull();

    expect((await act(w, "ann", { action: "invite", captainId: "bob" })).message).toBe("You invited bob.");
    expect((await fleetsOf(w)).invites).toEqual([{ fleetId: "fleet-1", captainId: "bob", invitedBy: "ann", tide: 1 }]);
    expect(fleetIdOf(w, "bob")).toBeNull();                       // an invitation is not a membership

    expect((await act(w, "bob", { action: "accept", fleetId: "fleet-1" })).message).toBe("You joined the Red Tide.");
    expect(fleetIdOf(w, "bob")).toBe("fleet-1");
    const book = await fleetsOf(w);
    expect(book.invites).toEqual([]);
    expect(book.fleets).toMatchObject([{ id: "fleet-1", name: "Red Tide", flag: "anchor" }]);
    expect(book.members.map((m) => m.captainId)).toEqual(["ann", "bob"]);
  });

  it("lets a captain decline", async () => {
    const w = await seasonWorld(SIX);
    await found(w, "ann");
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "bob", { action: "decline", fleetId: "fleet-1" });
    expect((await fleetsOf(w)).invites).toEqual([]);
    expect((await failure(act(w, "bob", { action: "accept", fleetId: "fleet-1" }))).status).toBe(400);
  });

  it("explains a rule break and changes nothing", async () => {
    const w = await seasonWorld(SIX);
    expect((await failure(act(w, "ann", { action: "invite", captainId: "bob" }))).message).toMatch(/Found a fleet/);
    await found(w, "ann");
    const before = await fleetsOf(w);
    expect((await failure(found(w, "ann", "Second"))).message).toMatch(/already in a fleet/);
    expect((await failure(found(w, "bob", "red tide"))).message).toMatch(/already has that name/);
    expect((await failure(act(w, "ann", { action: "invite", captainId: "ghost" }))).message).toMatch(/no such captain/);
    expect((await failure(act(w, "ann", { action: "invite", captainId: "ann" }))).message).toMatch(/your own fleet/);
    expect(await fleetsOf(w)).toEqual(before);
  });

  it("holds a fleet to the cap for the number of captains", async () => {
    const w = await pair();
    await act(w, "ann", { action: "invite", captainId: "cat" });
    await act(w, "cat", { action: "accept", fleetId: "fleet-1" });
    expect((await fleetsOf(w)).members).toHaveLength(fleetCap(SIX.length));
    expect((await failure(act(w, "ann", { action: "invite", captainId: "dan" }))).message).toMatch(/at most 3/);
  });

  it("gives the place to the first of two captains who accept", async () => {
    const w = await pair();
    await act(w, "ann", { action: "invite", captainId: "cat" });
    await act(w, "bob", { action: "invite", captainId: "dan" });
    await act(w, "cat", { action: "accept", fleetId: "fleet-1" });
    expect((await failure(act(w, "dan", { action: "accept", fleetId: "fleet-1" }))).message).toMatch(/full/);
    expect(fleetIdOf(w, "dan")).toBeNull();
  });

  it("rejects payloads that are the wrong shape, with a 400", async () => {
    const w = await seasonWorld(SIX);
    for (const bad of [
      null, {}, { action: "disband" }, { action: "create", name: "X", flag: "jolly" }, { action: "create", name: "Fine" },
      { action: "create", name: "Fine", flag: "skull", colour: "#fff" }, { action: "invite" }, { action: "accept", fleetId: 4 },
      { action: "leave", now: true },
    ]) {
      expect((await failure(act(w, "ann", bad))).status).toBe(400);
    }
    expect((await fleetsOf(w)).fleets).toEqual([]);
  });

  it("is for captains of the running season, while the Tide is open", async () => {
    const w = await seasonWorld(SIX);
    expect((await failure(fleetAction(w.deps, "user-nobody", { action: "leave" }))).status).toBe(404);
    w.setNow(AT_21);
    expect((await failure(found(w, "ann"))).status).toBe(409);
    expect((await fleetsOf(w)).fleets).toEqual([]);
  });
});

describe("fleet_action: what a fleet changes", () => {
  it("lets fleet mates escort each other, and no one else", async () => {
    const w = await pair();
    await submitOrders(w.deps, w.user("bob"), orders(1, { intent: "escort", escortCaptainId: "ann" }));
    expect((await failure(submitOrders(w.deps, w.user("bob"), orders(1, { intent: "escort", escortCaptainId: "cat" })))).status).toBe(400);
  });

  it("does not let a port action worked out before a change put the old fleet back", async () => {
    const w = await seasonWorld(SIX);
    await found(w, "ann");
    await act(w, "ann", { action: "invite", captainId: "bob" });
    const stale = (await w.store.captainView(w.user("bob")))!;       // what a port action started now would see

    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    const err = await failure(w.store.applyPortChange({
      seasonId: "s0", tide: 1, captain: stale.captain, ship: stale.ship, expectedVersion: stale.version, market: null,
      transaction: { captainId: "bob", tide: 1, kind: "repair", amount: 0, balanceAfter: stale.captain.chestGold, data: {} },
    }));
    expect(err.status).toBe(409);
    expect(fleetIdOf(w, "bob")).toBe("fleet-1");

    // A fresh port action sees the fleet and keeps it.
    await portAction(w.deps, w.user("bob"), { action: "upgrade", stat: "hold" });
    expect(fleetIdOf(w, "bob")).toBe("fleet-1");
  });

  it("refuses a change worked out from an old reading of the fleets", async () => {
    const w = await seasonWorld(SIX);
    const old = await w.store.loadFleets("s0");
    await found(w, "ann");
    const err = await failure(w.store.applyFleetChange({ seasonId: "s0", tide: 1, expectedRev: old.rev, book: old.book }));
    expect(err.status).toBe(409);
    expect(fleetIdOf(w, "ann")).toBe("fleet-1");
  });

  it("lets only one of two simultaneous changes through", async () => {
    const w = await seasonWorld(SIX);
    const results = await Promise.allSettled([found(w, "ann", "Red Tide"), found(w, "bob", "Blue Tide")]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as ApiError).status).toBe(409);
    expect((await fleetsOf(w)).fleets).toHaveLength(1);
  });
});

describe("fleet_action: leaving", () => {
  it("gives notice, tells the group chat, and keeps the captain a fleet mate until the next Tide opens", async () => {
    const w = await pair();
    const out = await act(w, "bob", { action: "leave" });
    expect(out.message).toMatch(/when Tide 2 opens/);
    expect(w.posts).toEqual([expect.stringContaining("bob has given notice to leave the Red Tide")]);
    expect(w.posts[0]).toContain("until Tide 2 opens");

    expect(fleetIdOf(w, "bob")).toBe("fleet-1");
    expect((await fleetsOf(w)).members.find((m) => m.captainId === "bob")!.leavingAtTide).toBe(2);

    w.setNow(AT_21);
    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "resolved", tide: 1 });
    expect(fleetIdOf(w, "bob")).toBeNull();
    expect(fleetIdOf(w, "ann")).toBe("fleet-1");
    expect((await fleetsOf(w)).members.map((m) => m.captainId)).toEqual(["ann"]);
  });

  it("makes the leaver a free captain who can found a fleet again", async () => {
    const w = await pair();
    await act(w, "bob", { action: "leave" });
    expect((await failure(found(w, "bob", "Second Chance"))).message).toMatch(/already in a fleet/);
    w.setNow(AT_21);
    await resolveDueTide(w.deps);

    w.setNow(new Date("2026-10-15T09:00:00Z"));
    await found(w, "bob", "Second Chance");
    const book = await fleetsOf(w);
    expect(book.fleets.map((f) => f.name)).toEqual(["Red Tide", "Second Chance"]);
    expect(fleetIdOf(w, "bob")).toBe(book.fleets.find((f) => f.name === "Second Chance")!.id);
    expect(fleetIdOf(w, "ann")).toBe("fleet-1");
  });

  it("refuses a second notice and an invitation from someone who is leaving", async () => {
    const w = await pair();
    await act(w, "bob", { action: "leave" });
    expect((await failure(act(w, "bob", { action: "leave" }))).message).toMatch(/already given notice/);
    expect((await failure(act(w, "bob", { action: "invite", captainId: "cat" }))).message).toMatch(/leaving/);
    expect((await failure(act(w, "cat", { action: "leave" }))).message).toMatch(/not in a fleet/);
  });

  it("disbands a fleet at once when its only member leaves, with nothing to announce", async () => {
    const w = await seasonWorld(SIX);
    await found(w, "ann");
    await act(w, "ann", { action: "invite", captainId: "bob" });
    expect((await act(w, "ann", { action: "leave" })).message).toBe("The Red Tide is disbanded.");
    expect(await fleetsOf(w)).toEqual({ fleets: [], members: [], invites: [] });
    expect(fleetIdOf(w, "ann")).toBeNull();
    expect(w.posts).toEqual([]);
  });

  it("still leaves when Discord is down", async () => {
    const w = await seasonWorld(SIX, { notifyFails: true });
    await found(w, "ann");
    await act(w, "ann", { action: "invite", captainId: "bob" });
    await act(w, "bob", { action: "accept", fleetId: "fleet-1" });
    await act(w, "bob", { action: "leave" });
    expect((await fleetsOf(w)).members.find((m) => m.captainId === "bob")!.leavingAtTide).toBe(2);
  });

  it("drops a fleet from the Tide it empties, with its open invitations", async () => {
    const w = await pair();
    await act(w, "ann", { action: "invite", captainId: "cat" });
    await act(w, "ann", { action: "leave" });
    await act(w, "bob", { action: "leave" });
    w.setNow(AT_21);
    await resolveDueTide(w.deps);
    expect(await fleetsOf(w)).toEqual({ fleets: [], members: [], invites: [] });
    expect(fleetIdOf(w, "ann")).toBeNull();
  });

  it("treats a leaver as a fleet mate while the Tide he gave notice in resolves", async () => {
    // Two hunters on one sea node. Fleet mates cannot hunt each other, so with notice given there is no
    // encounter this Tide; the same two captains with no fleet do meet.
    const meet = async (w: Awaited<ReturnType<typeof seasonWorld>>) => {
      const sea = brineMapSea();
      w.store.edit("s0", (snap) => {
        snap.ships = snap.ships.map((s) => (s.captainId === "ann" || s.captainId === "bob" ? { ...s, nodeId: sea, docked: false } : s));
      });
      for (const who of ["ann", "bob"]) await submitOrders(w.deps, w.user(who), orders(1, { intent: "hunt", huntFilter: "players" }));
      w.setNow(AT_21);
      await resolveDueTide(w.deps);
      return w.store.results[0]!.log.filter((e) => ["battle", "escape", "tribute"].includes(e.kind)).length;
    };

    const mates = await pair();
    await act(mates, "bob", { action: "leave" });
    expect(await meet(mates)).toBe(0);
    expect(await meet(await seasonWorld(SIX))).toBeGreaterThan(0);
  });
});
