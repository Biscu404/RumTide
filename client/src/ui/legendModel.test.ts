import { describe, expect, it } from "vitest";
import { SEASON_PRESETS } from "@engine/balance.ts";
import { portAction, resolveDueTide, submitOrders } from "../../../supabase/functions/_shared/api/handlers.ts";
import { seasonWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import { isFogged, legendScreen, mostWantedId, type LegendInput, type LegendRow } from "./legendModel.ts";

const row = (id: string, legend: number, extra: Partial<LegendRow> = {}): LegendRow => ({
  id, shipName: `Ship ${id}`, legend, bounty: 0, fleetId: null, status: "active", ...extra,
});
const input = (captains: LegendRow[], extra: Partial<LegendInput> = {}): LegendInput => ({
  captains, fleets: [], myCaptainId: "bob", tide: 3, lengthTides: 14, fogOfLegendTides: 0, ...extra,
});

describe("Legend leaderboard model", () => {
  it("ranks the captain with the most Legend first and shows whole points", () => {
    const screen = legendScreen(input([row("ann", 20.4), row("bob", 87.6), row("cat", 5)]));
    expect(screen.entries.map((e) => [e.captainId, e.rank, e.legend])).toEqual([["bob", 1, 88], ["ann", 2, 20], ["cat", 3, 5]]);
    expect(screen.started).toBe(true);
    expect(screen.entries.find((e) => e.captainId === "bob")!.isMe).toBe(true);
  });

  it("gives equal scores the same rank and skips the ranks after them", () => {
    const screen = legendScreen(input([row("ann", 50), row("bob", 80), row("cat", 50), row("dan", 10)]));
    expect(screen.entries.map((e) => [e.captainId, e.rank])).toEqual([["bob", 1], ["ann", 2], ["cat", 2], ["dan", 4]]);
  });

  it("lists captains in a steady order and ranks nobody before anyone has earned Legend", () => {
    const screen = legendScreen(input([row("cat", 0), row("ann", 0), row("bob", 0)]));
    expect(screen.entries.map((e) => e.captainId)).toEqual(["ann", "bob", "cat"]);
    expect(screen.entries.every((e) => e.rank === null && !e.mostWanted)).toBe(true);
    expect(screen.started).toBe(false);
    expect(screen.note).toContain("Nobody has earned any Legend");
  });

  it("marks the Legend leader Most Wanted, by the rule the engine pays out on", () => {
    expect(mostWantedId([row("ann", 0), row("bob", 0)])).toBeNull();
    expect(mostWantedId([row("ann", 10), row("bob", 30), row("cat", 20)])).toBe("bob");
    expect(mostWantedId([row("cat", 30), row("bob", 30), row("ann", 5)])).toBe("bob");   // the lowest id among equals
    const screen = legendScreen(input([row("ann", 10), row("bob", 30)]));
    expect(screen.entries.filter((e) => e.mostWanted).map((e) => e.captainId)).toEqual(["bob"]);
  });

  it("names each captain's fleet and its colour, and marks a captain who is Ashore", () => {
    const fleets = [{ id: "f1", name: "Red Tide", colour: "#e43b44" }];
    const screen = legendScreen(input(
      [row("ann", 20, { fleetId: "f1" }), row("bob", 10, { status: "ashore", bounty: 12.4 }), row("cat", 5, { fleetId: "gone" })],
      { fleets },
    ));
    const by = (id: string) => screen.entries.find((e) => e.captainId === id)!;
    expect(by("ann")).toMatchObject({ fleetName: "Red Tide", fleetColour: "#e43b44" });
    expect(by("bob")).toMatchObject({ fleetName: null, ashore: true, bounty: 12 });
    expect(by("cat").fleetName).toBeNull();   // a fleet that is not in the list is simply not named
  });

  describe("Fog of Legend", () => {
    const captains = [row("ann", 120.4), row("bob", 80.2), row("cat", 30)];

    it("is off in Season 0, whatever the Tide", () => {
      const fog = SEASON_PRESETS.season0.fogOfLegendTides;
      expect(fog).toBe(0);
      for (const tide of [1, 7, 13, 14]) {
        expect(isFogged(tide, SEASON_PRESETS.season0.lengthTides, fog)).toBe(false);
        expect(legendScreen(input(captains, { tide, lengthTides: 14, fogOfLegendTides: fog })).entries.every((e) => e.legend !== null)).toBe(true);
      }
    });

    it("covers the last 3 Tides of a full season and no earlier Tide", () => {
      const { lengthTides, fogOfLegendTides } = SEASON_PRESETS.full;
      expect(lengthTides).toBe(28);
      expect([24, 25, 26, 27, 28].map((t) => isFogged(t, lengthTides, fogOfLegendTides))).toEqual([false, false, true, true, true]);
    });

    it("hides every score but my own, and keeps the ranks and the Most Wanted mark", () => {
      const screen = legendScreen(input(captains, { tide: 27, lengthTides: 28, fogOfLegendTides: 3 }));
      expect(screen.fogged).toBe(true);
      expect(screen.entries.map((e) => [e.captainId, e.rank, e.legend])).toEqual([["ann", 1, null], ["bob", 2, 80], ["cat", 3, null]]);
      expect(screen.entries[0]!.mostWanted).toBe(true);
      expect(screen.note).toContain("Fog of Legend");
    });

    it("tells players ahead of time when the fog will come down", () => {
      const screen = legendScreen(input(captains, { tide: 10, lengthTides: 28, fogOfLegendTides: 3 }));
      expect(screen.fogged).toBe(false);
      expect(screen.fogFromTide).toBe(26);
      expect(screen.note).toBe("From Tide 26 exact scores are hidden. Ranks stay visible.");
    });
  });

  it("agrees with a real season: Legend earned through the handlers puts the trader first", async () => {
    const w = await seasonWorld(["ann", "bob", "cat"]);
    // Ann takes a cargo that cost almost nothing to a port that wants it and sells it: all profit, so Legend.
    w.store.edit("s0", (snap) => {
      snap.ships = snap.ships.map((s) => (s.captainId === "ann"
        ? { ...s, nodeId: "saint_brine", docked: true, cargo: { rum: 0, sugar: 10, spice: 0 }, cargoCostBasis: { rum: 0, sugar: 10, spice: 0 } }
        : s));
    });
    await portAction(w.deps, w.user("ann"), { action: "sell", good: "sugar", units: 10 });
    for (const id of ["ann", "bob", "cat"]) {
      await submitOrders(w.deps, w.user(id), {
        tide: 1, course: [], intent: "trade", plan: ["board", "board", "board"], parley: "off", noQuarter: false, ready: true,
      });
    }
    w.setNow(new Date("2026-10-14T18:00:00Z"));
    await resolveDueTide(w.deps);

    const snap = w.store.snapshot();
    const captains = snap.captains.map((c) => row(c.id, c.legend, { shipName: c.shipName, status: c.status }));
    const screen = legendScreen(input(captains, {
      myCaptainId: "ann", tide: snap.tide, lengthTides: snap.lengthTides, fogOfLegendTides: snap.settings.fogOfLegendTides,
    }));
    expect(screen.entries[0]).toMatchObject({ captainId: "ann", rank: 1, isMe: true, mostWanted: true });
    expect(screen.entries[0]!.legend).toBeGreaterThan(0);
    expect(screen.fogged).toBe(false);
  });
});
