import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, boom } from "./balance.ts";
import { EXPLORE_EVENTS } from "./explore.ts";
import { loadMap } from "./map.ts";
import { resolveTide, type TideResult } from "./resolve.ts";
import { startSeason, type TideSnapshot } from "./season.ts";
import type { Captain, Maneuver, Orders, Ship } from "./types.ts";

// Exploration events and their Omens inside a whole Tide (section 4.4 rule 7, section 10.1).
// The events themselves are tested in explore.test.ts.

const map = loadMap(brineJson);
const PLAN: [Maneuver, Maneuver, Maneuver] = ["broadside", "outmaneuver", "board"];
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

function world(ids: string[]): TideSnapshot {
  const snap = startSeason(map, "s1", "season0", ids.map((id) => ({ id, fleetId: null })), 1);
  return { ...snap, npcs: [] };
}
const at = (snap: TideSnapshot, id: string, nodeId: string, patch: Partial<Ship> = {}): TideSnapshot => ({
  ...snap,
  ships: snap.ships.map((s) => (s.captainId === id ? { ...s, nodeId, docked: map.node(nodeId).type === "port", ...patch } : s)),
});
const captainOf = (snap: TideSnapshot, id: string, patch: Partial<Captain>): TideSnapshot => ({
  ...snap, captains: snap.captains.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});
const order = (id: string, o: Partial<Orders> = {}): Orders => ({
  tide: 1, captainId: id, course: [], intent: "trade", plan: PLAN, parley: "off", noQuarter: false, ready: true, ...o,
});
const find = (snap: TideSnapshot, id: string) => snap.ships.find((s) => s.captainId === id)!;
const who = (snap: TideSnapshot, id: string) => snap.captains.find((c) => c.id === id)!;

const start = () => at(world(["ann"]), "ann", "sea06");
const explore = (to: string, over: Partial<Orders> = {}) => order("ann", { intent: "explore", course: [to], ...over });
const lines = (r: TideResult, visibility: "public" | "private") =>
  r.log.filter((e) => e.kind === "explore" && e.captainId === "ann" && e.visibility === visibility);
const eventOf = (r: TideResult) => (lines(r, "public")[0]?.data as { event: string } | undefined)?.event;
const seedFor = (snap: TideSnapshot, orders: Orders[], event: string) =>
  SEEDS.find((seed) => eventOf(resolveTide(map, snap, orders, seed)) === event)!;

describe("exploration events", () => {
  it("draws one event for a ship that sails to an island or a wreck with the Explore intent", () => {
    for (const [to, kind] of [["isle4", "island"], ["wreck4", "wreck"]] as const) {
      expect(map.node(to).type).toBe(kind);
      const r = resolveTide(map, start(), [explore(to)], 5);
      expect(lines(r, "public"), to).toHaveLength(1);
      expect(EXPLORE_EVENTS).toContain(eventOf(r));
      expect(r.gazette.headlines).toContain(lines(r, "public")[0]!.text);
      expect(find(r.next, "ann").nodeId).toBe(to);
    }
  });

  it("draws nothing for any other intent, a place that is not an island or a wreck, or staying where it lies", () => {
    const none = (snap: TideSnapshot, o: Orders) => {
      const r = resolveTide(map, snap, [o], 5);
      expect(r.log.filter((e) => e.kind === "explore"), JSON.stringify(o)).toEqual([]);
    };
    for (const intent of ["trade", "quiet", "hunt"] as const) {
      none(start(), order("ann", { intent, course: ["isle4"], huntFilter: "merchants" }));
    }
    none(start(), explore("sea08"));                                                // open sea
    none(at(world(["ann"]), "ann", "sea08"), explore("gullrock"));                  // a port
    none(at(world(["ann"]), "ann", "isle4"), order("ann", { intent: "explore" }));  // already there, no course
  });

  it("draws for a ship that sails away and back, because it arrived", () => {
    const r = resolveTide(map, at(world(["ann"]), "ann", "isle4"), [order("ann", { intent: "explore", course: ["sea06", "isle4"] })], 5);
    expect(lines(r, "public")).toHaveLength(1);
  });

  it("draws nothing for a ship that fought on the way, and something for one that slipped away", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "isle4");
    const orders = [explore("isle4"), order("bob", { intent: "hunt", huntFilter: "players" })];
    let fought = 0, free = 0;
    for (const seed of SEEDS) {
      const r = resolveTide(map, base, orders, seed);
      const inBattle = r.battles.some((b) => b.sides.some((s) => s.captainIds.includes("ann")));
      expect(lines(r, "public"), `seed ${seed}`).toHaveLength(inBattle ? 0 : 1);
      if (inBattle) fought++; else free++;
    }
    expect(fought).toBeGreaterThan(20);
    expect(free).toBeGreaterThan(20);
  });

  it("is the same for the same seed and leaves the snapshot alone", () => {
    const snap = start(), before = JSON.stringify(snap);
    const first = resolveTide(map, snap, [explore("wreck4")], 12);
    expect(JSON.stringify(snap)).toBe(before);
    expect(JSON.stringify(resolveTide(map, snap, [explore("wreck4")], 12))).toBe(JSON.stringify(first));
  });

  it("lets every explorer draw, in captain order", () => {
    const snap = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea07");
    const r = resolveTide(map, snap, [explore("isle4"), order("bob", { intent: "explore", course: ["wreck4"] })], 3);
    const names = r.log.filter((e) => e.kind === "explore" && e.visibility === "public").map((e) => e.captainId);
    expect(names).toEqual(["ann", "bob"]);
  });

  it("puts the amounts in the captain's own line and none in the Gazette", () => {
    const orders = [explore("isle4")];
    const seed = seedFor(start(), orders, "buriedChest");
    expect(seed).toBeDefined();
    const r = resolveTide(map, start(), orders, seed);
    expect(lines(r, "public")[0]!.text).not.toMatch(/\d/);
    const gold = find(r.next, "ann").plunderGold;
    expect(gold).toBeGreaterThanOrEqual(Math.round(B.explore.buriedChest.min * boom(1)));
    expect(gold).toBeLessThanOrEqual(Math.round(B.explore.buriedChest.max * boom(1)));
    expect(lines(r, "private")[0]!.text).toContain(`${gold} doubloons`);
    expect(who(r.next, "ann").chestGold).toBe(B.startGold);   // still plunder: it is banked when the ship docks
  });

  it("leaves a ghost lantern with a Gazette line and nothing private", () => {
    const orders = [explore("wreck4")];
    const seed = seedFor(start(), orders, "ghostLantern");
    expect(seed).toBeDefined();
    const r = resolveTide(map, start(), orders, seed);
    expect(lines(r, "public")).toHaveLength(1);
    expect(lines(r, "private")).toHaveLength(0);
  });
});

describe("Omens in a Tide", () => {
  const duel = () => at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06");
  const brawl = [
    order("ann", { intent: "hunt", huntFilter: "players", plan: ["board", "broadside", "outmaneuver"] }),
    order("bob", { intent: "hunt", huntFilter: "players" }),
  ];
  const round = (r: TideResult, id: string, n = 0) => r.battles[0]!.rounds[n]!.ships.find((s) => s.shipId === id)!;

  it("come from a Hermit's chart: a three hop course for one Tide, then no more", () => {
    const base = at(world(["ann"]), "ann", "sea02");
    const orders = [explore("isle4")];
    const seed = seedFor(base, orders, "hermit");
    expect(seed).toBeDefined();
    const first = resolveTide(map, base, orders, seed);
    expect(who(first.next, "ann").omens).toEqual(["cartographer"]);

    const long = order("ann", { tide: 2, course: ["sea06", "sea08", "gullrock"] });   // three hops, a sloop has two
    const ok = resolveTide(map, first.next, [long], 1);
    expect(find(ok.next, "ann").nodeId).toBe("gullrock");
    expect(ok.log.some((e) => e.kind === "orders")).toBe(false);
    expect(who(ok.next, "ann").omens).toEqual([]);                                   // gone with the Tide

    const plain = { ...first.next, captains: first.next.captains.map((c) => ({ ...c, omens: [] })) };
    expect(resolveTide(map, plain, [long], 1).log.find((e) => e.kind === "orders")).toMatchObject({ visibility: "private", captainId: "ann" });
  });

  it("let a Castaway add its Crew to the next battle, once", () => {
    const a = resolveTide(map, captainOf(duel(), "ann", { omens: ["castaway"] }), brawl, 4);
    const b = resolveTide(map, duel(), brawl, 4);
    expect(round(a, "ann").maneuver).toBe("board");
    expect(round(a, "ann").damage / round(b, "ann").damage).toBeCloseTo((1 + B.explore.castaway.crewBonus) ** B.combat.exponent);
    expect(round(a, "ann").luck).toBe(round(b, "ann").luck);   // the same luck, so only the Crew changed
    expect(round(a, "bob")).toEqual(round(b, "bob"));
    expect(who(a.next, "ann").omens).toEqual([]);              // spent by the battle
  });

  it("let a Castaway wait through Tides without a battle", () => {
    let snap = captainOf(start(), "ann", { omens: ["castaway"] });
    for (let tide = 1; tide <= 3; tide++) snap = resolveTide(map, snap, [order("ann", { tide })], tide).next;
    expect(who(snap, "ann").omens).toEqual(["castaway"]);
  });

  it("narrow the luck of a Cursed Coin to 0.8 to 1.0 for the next battle only", () => {
    const cursed = captainOf(duel(), "ann", { omens: ["cursedCoin"] });
    let annMax = 0, bobMax = 0;
    for (const seed of SEEDS.slice(0, 80)) {
      const r = resolveTide(map, cursed, brawl, seed);
      for (const rd of r.battles[0]!.rounds) {
        for (const s of rd.ships) {
          if (s.shipId === "ann") {
            annMax = Math.max(annMax, s.luck);
            expect(s.luck).toBeGreaterThanOrEqual(B.explore.cursedCoin.luckMin);
          } else {
            bobMax = Math.max(bobMax, s.luck);
          }
        }
      }
      expect(who(r.next, "ann").omens).toEqual([]);
    }
    expect(annMax).toBeLessThan(B.explore.cursedCoin.luckMax);
    expect(bobMax).toBeGreaterThan(B.explore.cursedCoin.luckMax);   // an ordinary captain still rolls up to 1.1
  });

  it("let a Mermaid's Song make the escape easier, and fade with the Tide", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea08");
    const orders = [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob", { course: ["sea06"] })];
    const caught = (snap: TideSnapshot) => SEEDS.filter((seed) => resolveTide(map, snap, orders, seed).battles.length > 0).length;
    const sung = captainOf(base, "bob", { omens: ["mermaid"] });
    expect(caught(sung)).toBeLessThan(caught(base) - 15);   // a 50% chance to slip away becomes 60%
    expect(who(resolveTide(map, sung, orders, 1).next, "bob").omens).toEqual([]);
  });

  it("keep what is still owed and drop what has expired", () => {
    const snap = captainOf(start(), "ann", { omens: ["cartographer", "castaway", "mermaid"] });
    expect(who(resolveTide(map, snap, [order("ann")], 1).next, "ann").omens).toEqual(["castaway"]);
  });

  it("are earned for the Tide after the one that drew them", () => {
    const orders = [explore("isle4")];
    const seed = seedFor(start(), orders, "castaway");
    expect(seed).toBeDefined();
    expect(who(resolveTide(map, start(), orders, seed).next, "ann").omens).toEqual(["castaway"]);
  });
});
