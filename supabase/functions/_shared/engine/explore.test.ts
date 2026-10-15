import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, boom, holdUnits, maxHullPoints } from "./balance.ts";
import {
  EXPLORE_EVENTS, applyEvent, bottleGalleonTide, courseLimit, drawEvent, drawOdds, explore, omenList, omenText,
  type ExploreEvent, type ExploreWorld,
} from "./explore.ts";
import { loadMap, type GameMap } from "./map.ts";
import { galleonNodeFor, spawnNpcs } from "./npc.ts";
import { holdFree } from "./port.ts";
import { createRng, hashSeed, type Rng } from "./rng.ts";
import { newCaptain, newShip } from "./state.ts";
import type { Ship } from "./types.ts";

const map = loadMap(brineJson);
const world = (over: Partial<ExploreWorld> = {}, mawOpens = false): ExploreWorld => ({
  map, seasonId: "s1", tide: 3, settings: { mawOpens, galleonTides: [7, 14] }, ...over,
});
const ship = (nodeId: string, patch: Partial<Ship> = {}): Ship => ({ ...newShip("ann", nodeId), docked: false, ...patch });
const captain = newCaptain("ann", "s1");
const ISLAND = "isle3", WRECK = "wreck1";

/** A "random" source that always gives the same number. */
const fixed = (x: number): Rng => ({
  next: () => x, int: (n) => Math.floor(x * n), range: (lo, hi) => lo + x * (hi - lo),
  pick: (items) => items[Math.floor(x * items.length)]!, shuffle: (items) => [...items],
});
const apply = (event: ExploreEvent, s: Ship, w = world(), rng: Rng = fixed(0.5)) => applyEvent(event, w, s, captain, rng);

describe("the deck", () => {
  it("has the twelve events of section 10.1, each with weights for an island and a wreck", () => {
    expect(EXPLORE_EVENTS).toHaveLength(12);
    expect(Object.keys(B.explore.weights).sort()).toEqual([...EXPLORE_EVENTS].sort());
  });

  it("leans on the kind of node: no Old Wreck on an island, no Hermit on a wreck", () => {
    const onIsland = drawOdds(world(), ship(ISLAND)).map((e) => e.event);
    const onWreck = drawOdds(world(), ship(WRECK)).map((e) => e.event);
    expect(onIsland).not.toContain("oldWreck");
    expect(onWreck).not.toContain("hermit");
    expect(onWreck).toContain("oldWreck");
    expect(onIsland).toContain("hermit");
  });

  it("cannot be drawn anywhere but an island or a wreck", () => {
    expect(() => drawOdds(world(), ship("sea06"))).toThrow("Nothing can be explored");
    expect(() => drawOdds(world(), ship("gullrock"))).toThrow("Nothing can be explored");
  });

  it("leaves out an event that could do nothing for this ship", () => {
    const events = (s: Ship, w = world()) => drawOdds(w, s).map((e) => e.event);
    const hurt = ship(ISLAND, { hullPoints: 50 });
    expect(events(ship(ISLAND))).not.toContain("turtleSoup");        // hull is full
    expect(events(hurt)).toContain("turtleSoup");
    const full = ship(ISLAND, { cargo: { rum: holdUnits("sloop", 0), sugar: 0, spice: 0 } });
    expect(holdFree(full)).toBe(0);
    expect(events(full)).not.toContain("rumCache");                  // no room in the Hold
    expect(events(ship(ISLAND))).toContain("rumCache");
    const fast = ship(ISLAND, { levels: { ...newShip("a", ISLAND).levels, sails: B.sailsSpeedBonusAtLevel } });
    expect(events(fast)).not.toContain("hermit");                    // already as many hops as a Tide has steps
    expect(events(ship(ISLAND))).toContain("hermit");
  });

  it("only offers a Message in a Bottle while a galleon is still two or more Tides away", () => {
    expect(bottleGalleonTide({ tide: 3, settings: { galleonTides: [7, 14] } })).toBe(7);
    expect(bottleGalleonTide({ tide: 5, settings: { galleonTides: [7, 14] } })).toBe(7);
    expect(bottleGalleonTide({ tide: 6, settings: { galleonTides: [7, 14] } })).toBe(14);   // 7 is on the map as Tide 7 opens
    expect(bottleGalleonTide({ tide: 13, settings: { galleonTides: [7, 14] } })).toBeNull();
    expect(bottleGalleonTide({ tide: 14, settings: { galleonTides: [7, 14] } })).toBeNull();
    const late = drawOdds(world({ tide: 13 }), ship(ISLAND)).map((e) => e.event);
    expect(late).not.toContain("messageInBottle");
    expect(drawOdds(world({ tide: 3 }), ship(ISLAND)).map((e) => e.event)).toContain("messageInBottle");
  });

  it("draws in proportion to the weights", () => {
    const counts = new Map<ExploreEvent, number>();
    const n = 30_000, rng = createRng(11);
    for (let i = 0; i < n; i++) {
      const e = drawEvent(world(), ship(WRECK, { hullPoints: 50 }), rng);
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const odds = drawOdds(world(), ship(WRECK, { hullPoints: 50 }));
    const total = odds.reduce((t, e) => t + e.weight, 0);
    for (const { event, weight } of odds) {
      expect((counts.get(event) ?? 0) / n, event).toBeCloseTo(weight / total, 1);
    }
    expect(counts.get("oldWreck")! / n).toBeGreaterThan(counts.get("buriedChest")! / n);
  });

  it("takes exactly one random number to draw, whatever comes up", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const a = createRng(seed), b = createRng(seed);
      drawEvent(world(), ship(ISLAND), a);
      b.next();
      expect(a.next()).toBe(b.next());
    }
  });

  it("is the same for the same seed", () => {
    const a = explore(world(), ship(ISLAND), captain, createRng(9));
    expect(explore(world(), ship(ISLAND), captain, createRng(9))).toEqual(a);
  });

  it("never names an amount in the Gazette line", () => {
    for (const event of EXPLORE_EVENTS) {
      expect(apply(event, ship(WRECK, { plunderGold: 100, hullPoints: 50 })).headline, event).not.toMatch(/\d/);
    }
  });
});

describe("what each event does", () => {
  const plunder = (r: { ship: Ship }) => r.ship.plunderGold;

  it("Buried Chest: 80 to 160 doubloons times the Boom, as plunder", () => {
    const low = apply("buriedChest", ship(ISLAND), world({ tide: 5 }), fixed(0));
    const high = apply("buriedChest", ship(ISLAND), world({ tide: 5 }), fixed(0.999999));
    expect(plunder(low)).toBe(Math.round(B.explore.buriedChest.min * boom(5)));
    expect(plunder(high)).toBe(Math.round(B.explore.buriedChest.max * boom(5)));
    expect(low.note).toContain(`${plunder(low)} doubloons`);
    expect(low.omen).toBeNull();
  });

  it("Castaway, Mermaid's Song and the Hermit Cartographer leave an Omen and change nothing else", () => {
    for (const [event, omen] of [["castaway", "castaway"], ["mermaid", "mermaid"], ["hermit", "cartographer"]] as const) {
      const r = apply(event, ship(ISLAND, { plunderGold: 30 }));
      expect(r.omen, event).toBe(omen);
      expect(r.ship, event).toEqual(ship(ISLAND, { plunderGold: 30 }));
      expect(r.note, event).toContain(omenText(omen));
    }
  });

  it("Monkey Thief: takes 10% of the plunder, rounded down, and has nothing to take from an empty hold", () => {
    expect(plunder(apply("monkeyThief", ship(ISLAND, { plunderGold: 99 })))).toBe(90);
    expect(plunder(apply("monkeyThief", ship(ISLAND, { plunderGold: 5 })))).toBe(5);
    const empty = apply("monkeyThief", ship(ISLAND));
    expect(plunder(empty)).toBe(0);
    expect(empty.note).toContain("nothing worth taking");
  });

  it("Turtle Soup: repairs 30% of the maximum hull and no more than that", () => {
    const max = maxHullPoints("sloop", 0);
    expect(apply("turtleSoup", ship(ISLAND, { hullPoints: 40 })).ship.hullPoints).toBeCloseTo(40 + 0.3 * max);
    expect(apply("turtleSoup", ship(ISLAND, { hullPoints: max - 5 })).ship.hullPoints).toBeCloseTo(max);
  });

  it("Rum Cache: 5 Rum for free, or as much as fits", () => {
    const r = apply("rumCache", ship(ISLAND, { cargoCostBasis: { rum: 7, sugar: 0, spice: 0 } }));
    expect(r.ship.cargo.rum).toBe(B.explore.rumCache.units);
    expect(r.ship.cargoCostBasis.rum).toBe(7);   // found rum cost nothing
    const nearlyFull = ship(ISLAND, { cargo: { rum: 0, sugar: holdUnits("sloop", 0) - 2, spice: 0 } });
    expect(apply("rumCache", nearlyFull).ship.cargo.rum).toBe(2);
  });

  it("Cursed Coin: 120 doubloons times the Boom and an Omen", () => {
    const r = apply("cursedCoin", ship(WRECK, { plunderGold: 10 }), world({ tide: 10 }));
    expect(plunder(r)).toBe(10 + Math.round(B.explore.cursedCoin.gold * boom(10)));
    expect(r.omen).toBe("cursedCoin");
  });

  it("Old Wreck: 60 doubloons times the Boom", () => {
    expect(plunder(apply("oldWreck", ship(WRECK), world({ tide: 4 })))).toBe(Math.round(B.explore.oldWreck.gold * boom(4)));
  });

  it("Reef Scrape: costs 15% of the maximum hull but can never sink a ship", () => {
    const max = maxHullPoints("sloop", 0);
    expect(apply("reefScrape", ship(WRECK)).ship.hullPoints).toBeCloseTo(max - 0.15 * max);
    expect(apply("reefScrape", ship(WRECK, { hullPoints: 10 })).ship.hullPoints).toBeCloseTo(1);
    expect(apply("reefScrape", ship(WRECK, { hullPoints: 1 })).ship.hullPoints).toBe(1);
  });

  it("Ghost Lantern: the crew talk about it, and that is all", () => {
    const start = ship(WRECK, { plunderGold: 40 });
    const r = apply("ghostLantern", start);
    expect(r.ship).toEqual(start);
    expect(r.omen).toBeNull();
    expect(r.note).toBeNull();
    expect(r.headline).toContain("ghost lantern");
  });

  it("Message in a Bottle: names the place and the Tide the next galleon will come, and the galleon comes there", () => {
    const r = apply("messageInBottle", ship(ISLAND), world({ tide: 2 }));
    const spot = galleonNodeFor(map, "s1", 7);
    expect(r.note).toBe(`The message says the Treasure Galleon will be off ${map.node(spot).name} on Tide 7.`);
    const npcs = spawnNpcs(map, { seasonId: "s1", tide: 7, players: 6, medianPR: 10, galleonTides: [7, 14] }, createRng(5));
    expect(npcs.find((n) => n.kind === "galleon")!.nodeId).toBe(spot);
  });

  it("the Maw multiplies gold and rum once it is open, and not before", () => {
    // The Brine map has no wreck in the Maw (the Maw opens in V2), so the events see a one node map.
    const mawMap = { node: () => ({ id: "maw1", name: "Maw Wreck", type: "wreck", zone: "maw" }) } as unknown as GameMap;
    const inMaw = (mawOpens: boolean): ExploreWorld => ({ ...world({}, mawOpens), map: mawMap });
    const there = ship("maw1");
    expect(plunder(applyEvent("oldWreck", inMaw(true), there, captain, fixed(0.5)))).toBe(Math.round(B.explore.oldWreck.gold * boom(3) * B.explore.mawRewardMult));
    expect(plunder(applyEvent("oldWreck", inMaw(false), there, captain, fixed(0.5)))).toBe(Math.round(B.explore.oldWreck.gold * boom(3)));
    expect(applyEvent("rumCache", inMaw(true), there, captain, fixed(0.5)).ship.cargo.rum).toBe(Math.round(B.explore.rumCache.units * B.explore.mawRewardMult));
  });
});

describe("the Hermit's chart", () => {
  it("gives one more hop, but never more than a Tide has steps", () => {
    const slow = ship("gullrock");
    const fast = ship("gullrock", { levels: { ...slow.levels, sails: B.sailsSpeedBonusAtLevel } });
    expect(courseLimit(slow, { omens: [] })).toBe(2);
    expect(courseLimit(slow, { omens: ["cartographer"] })).toBe(3);
    expect(courseLimit(fast, { omens: [] })).toBe(3);
    expect(courseLimit(fast, { omens: ["cartographer"] })).toBe(3);
    expect(courseLimit(slow, { omens: ["castaway", "mermaid"] })).toBe(2);
  });
});

describe("Omens", () => {
  it("are kept sorted with no repeats", () => {
    expect(omenList(["mermaid", "castaway", "mermaid", "cartographer"])).toEqual(["cartographer", "castaway", "mermaid"]);
    expect(omenList([])).toEqual([]);
  });

  it("describe themselves from balance.ts", () => {
    expect(omenText("castaway")).toBe("+10% Crew in your next battle.");
    expect(omenText("mermaid")).toBe("+20% to your escape chance this Tide.");
    expect(omenText("cartographer")).toBe("Your course may be one hop longer this Tide.");
    expect(omenText("cursedCoin")).toBe("Your luck in your next battle runs from 0.8 to 1.0, not 0.9 to 1.1.");
  });
});

describe("the galleon's place", () => {
  it("comes from the season and the Tide alone, in Free Waters", () => {
    for (const tide of [7, 14, 21]) {
      const spot = galleonNodeFor(map, "season-a", tide);
      expect(galleonNodeFor(map, "season-a", tide)).toBe(spot);
      expect(map.node(spot).zone).toBe("free");
      expect(["sea", "island", "wreck"]).toContain(map.node(spot).type);
    }
    const spots = new Set(Array.from({ length: 40 }, (_, i) => galleonNodeFor(map, `season-${i}`, 7)));
    expect(spots.size).toBeGreaterThan(5);
  });

  it("hashSeed gives the same number for the same text and another for other text", () => {
    expect(hashSeed("a:galleon:7")).toBe(hashSeed("a:galleon:7"));
    expect(hashSeed("a:galleon:7")).not.toBe(hashSeed("a:galleon:14"));
    expect(Number.isInteger(hashSeed("anything"))).toBe(true);
  });
});
