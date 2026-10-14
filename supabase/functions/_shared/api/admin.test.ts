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
});
