import { describe, expect, it } from "vitest";
import { adminRequest, resolveDueTide, type AdminResult } from "./handlers.ts";
import { ApiError } from "./store.ts";
import { seasonWorld, testWorld, type TestWorld } from "./testing.ts";

const AT_21 = new Date("2026-10-14T18:00:00Z");

/** Run a call that should fail and hand back the error. */
async function failure(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (error) { return error as ApiError; }
  throw new Error("Expected the call to fail");
}

/** The admin page's read, typed so the tests can look inside it. */
async function page(w: TestWorld, who: string) {
  return (await adminRequest(w.deps, w.user(who), { action: "status" })) as Extract<AdminResult, { log: unknown }>;
}

describe("admin page", () => {
  it("refuses everyone who is not in admins, for both actions", async () => {
    const w = await seasonWorld();
    expect((await failure(adminRequest(w.deps, w.user("ann"), { action: "status" }))).status).toBe(403);
    expect((await failure(adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 1 }))).status).toBe(403);
    expect(w.store.tideInfo("s0").status).toBe("open");
  });

  it("shows the running season, its Tide and an empty log to the admin", async () => {
    const w = await seasonWorld();
    w.store.admins.add(w.user("ann"));
    const reply = await page(w, "ann");
    expect(reply).toMatchObject({ season: { name: "Season 0" }, tide: { number: 1, status: "open" }, log: [] });
  });

  it("says so when no season is running", async () => {
    const w = testWorld();
    w.store.admins.add(w.user("ann"));
    expect(await adminRequest(w.deps, w.user("ann"), { action: "status" })).toEqual({ season: null, tides: [], log: [] });
  });

  it("resolves the open Tide now and writes it to the admin log", async () => {
    const w = await seasonWorld();
    w.store.admins.add(w.user("ann"));
    const reply = await adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 1 });
    expect(reply).toMatchObject({ outcome: { status: "resolved", tide: 1, reason: "forced" } });
    expect((await page(w, "ann")).log).toEqual([
      expect.objectContaining({ action: "resolve", tide: 1, outcome: "resolved", adminId: w.user("ann") }),
    ]);
  });

  it("refuses to resolve a Tide other than the one the page shows", async () => {
    const w = await seasonWorld();
    w.store.admins.add(w.user("ann"));
    expect((await failure(adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 2 }))).status).toBe(409);
    expect(w.store.tideInfo("s0").status).toBe("open");
    expect((await page(w, "ann")).log).toEqual([]);
  });

  it("shows a failed Tide with its error, and retries it from the same seed when asked", async () => {
    const w = await seasonWorld();
    w.store.admins.add(w.user("ann"));
    w.setNow(AT_21);
    const cat = w.store.snapshot().ships.find((s) => s.captainId === "cat")!;
    w.store.edit("s0", (snap) => { snap.ships = snap.ships.filter((s) => s.captainId !== "cat"); });

    expect(await resolveDueTide(w.deps)).toMatchObject({ status: "failed", tide: 1 });
    expect(await resolveDueTide(w.deps)).toEqual({ status: "busy" });
    expect((await page(w, "ann")).tides[0]).toMatchObject({ number: 1, status: "failed" });
    expect((await page(w, "ann")).tides[0]!.error).toBeTruthy();

    // The admin fixes the cause and retries. The retry is logged as a retry, not a resolve.
    w.store.edit("s0", (snap) => { snap.ships.push(cat); });
    const reply = await adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 1 });
    expect(reply).toMatchObject({ outcome: { status: "resolved", tide: 1 } });
    expect((await page(w, "ann")).log[0]).toMatchObject({ action: "retry", tide: 1, outcome: "resolved" });
    expect(w.store.tideInfo("s0").number).toBe(2);
  });

  describe("ending a season early", () => {
    const end = (w: TestWorld, who: string, tide = 1) => adminRequest(w.deps, w.user(who), { action: "end", tide });

    it("refuses everyone who is not in admins", async () => {
      const w = await seasonWorld();
      expect((await failure(end(w, "ann"))).status).toBe(403);
      expect(await w.store.activeSeason()).not.toBeNull();
    });

    it("ends the running season, logs it, and leaves nothing for the cron to resolve", async () => {
      const w = await seasonWorld();
      w.store.admins.add(w.user("ann"));
      const reply = await end(w, "ann");
      expect(reply).toMatchObject({ ended: { seasonId: "s0", name: "Season 0", tide: 1 } });
      expect(w.store.seasonInfo("s0").status).toBe("ended");
      expect(await w.store.activeSeason()).toBeNull();

      w.setNow(AT_21);
      expect(await resolveDueTide(w.deps)).toEqual({ status: "idle" });
      expect(await adminRequest(w.deps, w.user("ann"), { action: "status" })).toEqual({ season: null, tides: [], log: [] });
      expect(w.store.adminEntries).toEqual([
        expect.objectContaining({ seasonId: "s0", action: "end", tide: 1, outcome: "ended", adminId: w.user("ann") }),
      ]);
    });

    it("ends a season that has already turned some Tides", async () => {
      const w = await seasonWorld();
      w.store.admins.add(w.user("ann"));
      await adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 1 });
      await adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 2 });
      const reply = await end(w, "ann", 3);
      expect(reply).toMatchObject({ ended: { tide: 3 } });
      expect(w.store.adminEntries.at(-1)).toMatchObject({ action: "end", detail: "Season 0 ended early at Tide 3 of 14" });
    });

    it("refuses a Tide other than the one the page shows, and a Tide being resolved", async () => {
      const w = await seasonWorld();
      w.store.admins.add(w.user("ann"));
      expect((await failure(end(w, "ann", 2))).status).toBe(409);
      expect(await w.store.claimTide("s0", 1)).toBe(true);
      expect((await failure(end(w, "ann"))).status).toBe(409);
      expect(await w.store.activeSeason()).not.toBeNull();
      expect(w.store.adminEntries).toEqual([]);
    });

    it("ends a failed Tide's season too, and says so when nothing is running", async () => {
      const w = await seasonWorld();
      w.store.admins.add(w.user("ann"));
      w.setNow(AT_21);
      w.store.edit("s0", (snap) => { snap.ships = snap.ships.filter((s) => s.captainId !== "cat"); });
      expect(await resolveDueTide(w.deps)).toMatchObject({ status: "failed" });
      await end(w, "ann");
      expect(await w.store.activeSeason()).toBeNull();
      expect((await failure(end(w, "ann"))).status).toBe(404);
    });

    it("makes room for a new season, which is the point of it", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"), w.user("bob"));
      w.store.admins.add(w.user("ann"));
      const start = (name: string) => adminRequest(w.deps, w.user("ann"), { action: "start", name, preset: "season0", who: "all" });
      await start("Playtest");
      expect((await failure(start("Season 0"))).status).toBe(409);
      await end(w, "ann");
      await start("Season 0");
      expect((await w.store.activeSeason())!.season.name).toBe("Season 0");
      expect((await w.store.captainView(w.user("bob")))!.active.season.name).toBe("Season 0");
    });
  });

  describe("starting a season", () => {
    const start = (w: TestWorld, who: string, extra: object = {}) =>
      adminRequest(w.deps, w.user(who), { action: "start", name: "Test Season", preset: "season0", who: "all", ...extra });

    it("refuses everyone who is not in admins", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"));
      expect((await failure(start(w, "ann"))).status).toBe(403);
      expect(await w.store.activeSeason()).toBeNull();
    });

    it("starts a season with every account, each with a ship in a port, and logs it", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"), w.user("bob"), w.user("cat"));
      w.store.admins.add(w.user("ann"));
      const reply = await start(w, "ann") as { started: { seasonId: string; captains: number } };
      expect(reply.started.captains).toBe(3);

      const active = (await w.store.activeSeason())!;
      expect(active.season).toMatchObject({ id: reply.started.seasonId, name: "Test Season", lengthTides: 14, tideTimeLocal: "21:00" });
      expect(active.tide).toMatchObject({ number: 1, status: "open" });
      const view = (await w.store.captainView(w.user("bob")))!;
      expect(view.ship.docked).toBe(true);
      expect(view.captain.shipName).not.toContain("user-");

      const log = (await page(w, "ann")).log;
      expect(log[0]).toMatchObject({ action: "start", tide: 1, outcome: "started", adminId: w.user("ann") });
    });

    it("can start with only the game master aboard, and with another Tide time", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"), w.user("bob"));
      w.store.admins.add(w.user("ann"));
      const reply = await start(w, "ann", { who: "me", preset: "full", tideTimeLocal: "09:30" }) as { started: { captains: number } };
      expect(reply.started.captains).toBe(1);
      expect((await w.store.activeSeason())!.season).toMatchObject({ lengthTides: 28, tideTimeLocal: "09:30" });
      expect(await w.store.captainView(w.user("bob"))).toBeNull();
    });

    it("plays: the new season's first Tide can be resolved by the same page", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"));
      w.store.admins.add(w.user("ann"));
      await start(w, "ann", { who: "me" });
      const reply = await adminRequest(w.deps, w.user("ann"), { action: "resolve", tide: 1 });
      expect(reply).toMatchObject({ outcome: { status: "resolved", tide: 1 } });
    });

    it("refuses while a season is running, and when nobody has signed up", async () => {
      const running = await seasonWorld();
      running.store.admins.add(running.user("ann"));
      expect((await failure(start(running, "ann"))).status).toBe(409);

      const empty = testWorld();
      empty.store.admins.add(empty.user("ann"));
      expect((await failure(start(empty, "ann"))).status).toBe(409);
    });

    it("refuses a bad name, preset or Tide time", async () => {
      const w = testWorld();
      w.store.users.push(w.user("ann"));
      w.store.admins.add(w.user("ann"));
      for (const bad of [{ name: "  " }, { preset: "forever" }, { tideTimeLocal: "25:00" }, { who: "nobody" }]) {
        expect((await failure(start(w, "ann", bad))).status).toBe(400);
      }
      expect(await w.store.activeSeason()).toBeNull();
    });
  });
});
