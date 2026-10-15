import { describe, expect, it } from "vitest";
import { submitOrders } from "../../../supabase/functions/_shared/api/handlers.ts";
import { brineMap, seasonWorld, type TestWorld } from "../../../supabase/functions/_shared/api/testing.ts";
import type { Omen } from "@engine/types.ts";
import type { Me } from "../net/captain.ts";
import { captainFromRow } from "../net/rows.ts";
import { exploreHint, maxHops, omenLines, omenNames } from "./exploreModel.ts";
import { INTENTS, destinations, draftFor, toPayload } from "./ordersModel.ts";

// The Orders screen with a Hermit's chart and the Explore intent, against the real handlers.

async function meOf(world: TestWorld, captainId: string): Promise<Me> {
  const view = (await world.store.captainView(world.user(captainId)))!;
  const { tide } = view.active;
  return {
    captain: view.captain, ship: view.ship,
    tide: { number: tide.number, status: tide.status, dueAt: tide.dueAt, boomPortId: view.boomPortId },
    settings: view.active.season.settings, orders: null, market: view.market,
    others: view.roster.filter((r) => r.id !== captainId).map((r) => ({ id: r.id, shipName: `Ship ${r.id}`, fleetId: r.fleetId })),
  };
}

const withOmens = (world: TestWorld, id: string, omens: Omen[]) =>
  world.store.edit("s0", (snap) => { snap.captains = snap.captains.map((c) => (c.id === id ? { ...c, omens } : c)); });

describe("how far a ship may sail", () => {
  it("is one hop more under a Hermit's chart, and every place within it is accepted by the server", async () => {
    const world = await seasonWorld();
    const plain = await meOf(world, "ann");
    expect(maxHops(plain)).toBe(2);

    withOmens(world, "ann", ["cartographer"]);
    const me = await meOf(world, "ann");
    expect(maxHops(me)).toBe(3);
    const where = destinations(brineMap, me.ship.nodeId, maxHops(me));
    expect(where.some((d) => d.hops === 3)).toBe(true);
    expect(where.length).toBeGreaterThan(destinations(brineMap, plain.ship.nodeId, maxHops(plain)).length);
    for (const d of where) {
      const built = toPayload(brineMap, me, { ...draftFor(me), destination: d.nodeId }, true);
      expect(built.ok, d.name).toBe(true);
      if (built.ok) await expect(submitOrders(world.deps, world.user("ann"), built.payload), d.name).resolves.toBeDefined();
    }
  });

  it("refuses a three hop course without the chart, in words", async () => {
    const world = await seasonWorld();
    const me = await meOf(world, "ann");
    const far = destinations(brineMap, me.ship.nodeId, 3).find((d) => d.hops === 3)!;
    const built = toPayload(brineMap, me, { ...draftFor(me), destination: far.nodeId }, true);
    expect(built).toMatchObject({ ok: false });
    if (!built.ok) expect(built.reason).toContain("speed is 2");
  });
});

describe("Omens on screen", () => {
  it("name each Omen and say what it does", () => {
    expect(omenLines([])).toEqual([]);
    expect(omenLines(["castaway", "mermaid"])).toEqual([
      "Castaway: +10% Crew in your next battle.",
      "Mermaid's Song: +20% to your escape chance this Tide.",
    ]);
    expect(omenNames(["cartographer", "cursedCoin"])).toBe("Hermit's chart, Cursed Coin");
    expect(omenNames([])).toBe("");
  });

  it("are read from the captain's row, and a row from before Omens has none", () => {
    const row = {
      id: "c", season_id: "s", user_id: "u", ship_name: "Ann", flag: "black", legend: 0, chest_gold: 1, bounty: 0,
      standing_plan: ["broadside", "board", "outmaneuver"], standing_parley: "off", shore_leave_tides: 0,
      last_orders_tide: 0, status: "active",
    };
    expect(captainFromRow(row).omens).toEqual([]);
    expect(captainFromRow({ ...row, omens: ["castaway", "mermaid"] }).omens).toEqual(["castaway", "mermaid"]);
  });
});

describe("the Explore hint", () => {
  const nodeOfType = (type: string) => brineMap.nodeIds.find((id) => brineMap.node(id).type === type)!;
  const draft = (intent: "explore" | "trade", destination: string) => ({ intent, destination });

  it("says nothing for any other intent", () => {
    expect(exploreHint(brineMap, { nodeId: "sea06" }, draft("trade", nodeOfType("island")))).toBeNull();
  });

  it("tells a ship that stays put that nothing will be drawn", () => {
    expect(exploreHint(brineMap, { nodeId: "isle4" }, draft("explore", "isle4"))).toContain("already here");
  });

  it("tells a ship bound for open sea or a port that there is nothing to explore", () => {
    expect(exploreHint(brineMap, { nodeId: "sea06" }, draft("explore", "sea08"))).toContain("Nothing to explore at");
    expect(exploreHint(brineMap, { nodeId: "sea08" }, draft("explore", "gullrock"))).toContain("Choose an island or a wreck");
  });

  it("promises an event at an island or a wreck, unless there is a fight", () => {
    for (const to of ["isle4", "wreck4"]) {
      expect(exploreHint(brineMap, { nodeId: "sea06" }, draft("explore", to))).toBe(`An event waits at ${brineMap.node(to).name}, unless you have to fight on the way.`);
    }
  });

  it("uses the same words in the intent list as the engine rule", () => {
    expect(INTENTS.find((i) => i.id === "explore")!.help).toContain("sail to an island or a wreck");
  });
});
