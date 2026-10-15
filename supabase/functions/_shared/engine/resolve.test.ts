import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { B, maxHullPoints, npcPR } from "./balance.ts";
import { hopsFrom, loadMap, shortestPath } from "./map.ts";
import { nearestPort, resolveTide } from "./resolve.ts";
import { startSeason, type TideSnapshot } from "./season.ts";
import { settleGalleonBattle } from "./npc.ts";
import type { Captain, Maneuver, Npc, Orders, Ship } from "./types.ts";

const map = loadMap(brineJson);
const PLAN: [Maneuver, Maneuver, Maneuver] = ["broadside", "outmaneuver", "board"];
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

// ---- Scenario helpers ----

/** A season with these captains and no NPCs. Tests place ships and NPCs where they need them. */
function world(ids: string[], fleets: Record<string, string> = {}): TideSnapshot {
  const snap = startSeason(map, "s1", "season0", ids.map((id) => ({ id, fleetId: fleets[id] ?? null })), 1);
  return { ...snap, npcs: [] };
}
const at = (snap: TideSnapshot, id: string, nodeId: string, patch: Partial<Ship> = {}): TideSnapshot => ({
  ...snap,
  ships: snap.ships.map((s) => (s.captainId === id ? { ...s, nodeId, docked: map.node(nodeId).type === "port", ...patch } : s)),
});
const captainOf = (snap: TideSnapshot, id: string, patch: Partial<Captain>): TideSnapshot => ({
  ...snap, captains: snap.captains.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});
const withNpcs = (snap: TideSnapshot, ...npcs: Npc[]): TideSnapshot => ({ ...snap, npcs });
const order = (id: string, o: Partial<Orders> = {}): Orders => ({
  tide: 1, captainId: id, course: [], intent: "trade", plan: PLAN, parley: "off", noQuarter: false, ready: true, ...o,
});
const trader = (id: string, nodeId: string, kind: "smallTrader" | "fatMerchant" = "smallTrader"): Npc => ({
  id, seasonId: "s1", kind, nodeId, pr: npcPR(kind, 10),
  habit: kind === "smallTrader" ? [B.npc.smallTrader.favourite] : [...B.npc.fatMerchant.plan],
  cargoUnits: B.npc[kind].cargo, spawnedTide: 1, status: "active",
});
const galleon = (nodeId: string): Npc => ({
  id: "npc-t1-galleon", seasonId: "s1", kind: "galleon", nodeId, pr: npcPR("galleon", 10),
  habit: [...B.npc.galleon.plan], cargoUnits: 0, spawnedTide: 1, status: "active",
});
const maxed = { hull: 10, cannons: 10, sails: 10, crew: 10, hold: 10 };
const find = (snap: TideSnapshot, id: string) => snap.ships.find((s) => s.captainId === id)!;
const who = (snap: TideSnapshot, id: string) => snap.captains.find((c) => c.id === id)!;

describe("resolveTide basics", () => {
  it("never changes the snapshot it is given and repeats exactly from the same seed", () => {
    const snap = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06");
    const before = JSON.stringify(snap);
    const orders = [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob")];
    const first = resolveTide(map, snap, orders, 7);
    expect(JSON.stringify(snap)).toBe(before);
    expect(JSON.stringify(resolveTide(map, snap, orders, 7))).toBe(JSON.stringify(first));
    expect(first.tide).toBe(1);
    expect(first.next.tide).toBe(2);
  });

  it("moves a ship along its course and docks it, banking plunder into the Chest", () => {
    const snap = at(world(["ann"]), "ann", "sea08", { plunderGold: 100 });
    const { next } = resolveTide(map, snap, [order("ann", { course: ["gullrock"] })], 1);
    const ship = find(next, "ann");
    expect(ship.nodeId).toBe("gullrock");
    expect(ship.docked).toBe(true);
    expect(ship.plunderGold).toBe(0);
    expect(who(next, "ann").chestGold).toBe(B.startGold + 100);
  });

  it("leaves a ship that ends at sea undocked and patches 10% of its hull", () => {
    const snap = at(world(["ann"]), "ann", "sea06", { hullPoints: 50 });
    const { next } = resolveTide(map, snap, [order("ann", { course: ["sea08"] })], 1);
    expect(find(next, "ann").docked).toBe(false);
    expect(find(next, "ann").hullPoints).toBeCloseTo(50 + B.repair.crewPatchAtSea * 100);
  });

  it("falls back to standing orders when the course is not a real course", () => {
    const snap = at(world(["ann"]), "ann", "sea06");
    const result = resolveTide(map, snap, [order("ann", { course: ["gullrock"] })], 1);   // no lane from sea06
    expect(result.log.find((e) => e.kind === "orders")).toMatchObject({ captainId: "ann", visibility: "private" });
    expect(find(result.next, "ann").nodeId).not.toBe("gullrock");   // sailed Quietly towards the nearest port instead
  });

  it("ignores orders for another Tide", () => {
    const snap = at(world(["ann"]), "ann", "sea06");
    const { next } = resolveTide(map, snap, [order("ann", { tide: 5, course: ["sea08"] })], 1);
    expect(who(next, "ann").lastOrdersTide).toBe(0);
  });
});

describe("standing orders and the Caretaker", () => {
  it("keeps a docked captain in port and a captain at sea sailing Quietly to the nearest port", () => {
    const snap = at(at(world(["ann", "bob"]), "ann", "gullrock"), "bob", "sea06");
    const { next } = resolveTide(map, snap, [], 1);
    expect(find(next, "ann").nodeId).toBe("gullrock");
    const bob = find(next, "bob");
    const away = hopsFrom(map, nearestPort(map, "sea06"));
    expect(away.get(bob.nodeId)).toBeLessThan(away.get("sea06")!);   // two hops closer to home
    expect(who(next, "bob").shoreLeaveTides).toBe(1);
  });

  it("stores one Tide of Shore Leave for each missed Tide, up to the cap", () => {
    let snap = world(["ann"]);
    for (let tide = 1; tide <= 4; tide++) snap = resolveTide(map, snap, [], tide).next;
    expect(who(snap, "ann").shoreLeaveTides).toBe(B.catchUp.shoreLeaveCap);
    expect(who(snap, "ann").status).toBe("active");
  });

  it("marks a captain Ashore after five missed Tides, and a returning captain is active again", () => {
    let snap = world(["ann"]);
    for (let tide = 1; tide <= B.catchUp.ashoreAfterMissed; tide++) snap = resolveTide(map, snap, [], tide).next;
    expect(who(snap, "ann").status).toBe("ashore");
    expect(find(snap, "ann").docked).toBe(true);
    const back = resolveTide(map, snap, [order("ann", { tide: snap.tide })], 9).next;
    expect(who(back, "ann").status).toBe("active");
    expect(who(back, "ann").lastOrdersTide).toBe(snap.tide);
  });

  it("does not count Ashore captains when it sizes the merchants", () => {
    let snap = world(["ann", "bob", "cat", "dan"]);
    snap = captainOf(snap, "cat", { status: "ashore" });
    snap = captainOf(snap, "dan", { status: "ashore" });
    const counts = SEEDS.map((seed) => resolveTide(map, snap, [], seed).next.npcs.length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(2);   // 0.75 * 2 players is 1.5, so 1 or 2
  });
});

describe("meetings and encounters", () => {
  it("does not start a fight when nobody is hunting", () => {
    const snap = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06");
    const result = resolveTide(map, snap, [order("ann"), order("bob")], 3);
    expect(result.battles).toHaveLength(0);
  });

  it("lets a hunter lying in wait catch a ship that sails into its node", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea08");
    const fights = SEEDS.filter((seed) => resolveTide(map, base,
      [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob", { course: ["sea06"] })], seed).battles.length > 0);
    expect(fights.length).toBeGreaterThan(40);       // the escape roll saves the victim about half the time
    expect(fights.length).toBeLessThan(SEEDS.length);
  });

  it("never lets a hunter attack a docked ship", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea08"), "bob", "gullrock");
    for (const seed of SEEDS.slice(0, 40)) {
      const result = resolveTide(map, base,
        [order("ann", { intent: "hunt", huntFilter: "anyone", course: ["gullrock"] }), order("bob")], seed);
      expect(result.battles).toHaveLength(0);
    }
  });

  it("meets ships that swap places along a lane, at the lower node id", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea08");
    const hit = SEEDS.map((seed) => resolveTide(map, base, [
      order("ann", { intent: "hunt", huntFilter: "players", course: ["sea08"] }),
      order("bob", { course: ["sea06"] }),
    ], seed)).find((r) => r.battles.length > 0);
    expect(hit?.battles[0]?.nodeId).toBe("sea06");
  });

  it("saves each fighter's starting hull in the battle record, for the replay", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06", { hullPoints: 70 }), "bob", "sea06");
    const hit = SEEDS.map((seed) => resolveTide(map, base, [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob")], seed))
      .find((r) => r.battles.length > 0)!;
    expect(hit).toBeDefined();
    const { ships, rounds } = hit.battles[0]!;
    expect(ships).toEqual({
      ann: { hullBefore: 70, maxHull: maxHullPoints("sloop", 0) },
      bob: { hullBefore: maxHullPoints("sloop", 0), maxHull: maxHullPoints("sloop", 0) },
    });
    expect(rounds[0]!.hullAfter.ann).toBeLessThanOrEqual(70);
  });

  it("never fights when two ships hunt each other and neither can flee", () => {
    const base = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06");
    for (const seed of SEEDS.slice(0, 60)) {
      const result = resolveTide(map, base, [
        order("ann", { intent: "hunt", huntFilter: "players" }), order("bob", { intent: "hunt", huntFilter: "players" }),
      ], seed);
      expect(result.battles).toHaveLength(1);
      expect(result.log.some((e) => e.kind === "escape")).toBe(false);
    }
  });

  it("never lets a pair that slipped away meet again, even over three steps", () => {
    // Ann and Bob sit together. Cat keeps the Tide running for three steps by sailing away from them.
    const base = at(at(at(world(["ann", "bob", "cat"]), "ann", "sea06"), "bob", "sea06"), "cat", "sea08");
    for (const seed of SEEDS) {
      const result = resolveTide(map, base, [
        order("ann", { intent: "hunt", huntFilter: "players" }), order("bob"),
        order("cat", { course: ["sea09", "wreck3"] }),
      ], seed);
      const escapes = result.log.filter((e) => e.kind === "escape" && e.text.includes("bob") && e.text.includes("ann"));
      expect(escapes.length).toBeLessThanOrEqual(1);
    }
  });

  it("does not let a ship fight twice in one Tide", () => {
    const base = at(at(at(world(["ann", "bob", "cat"]), "ann", "sea06"), "bob", "sea06"), "cat", "sea06");
    for (const seed of SEEDS.slice(0, 80)) {
      const result = resolveTide(map, base, [
        order("ann", { intent: "hunt", huntFilter: "anyone" }), order("bob", { intent: "hunt", huntFilter: "anyone" }), order("cat"),
      ], seed);
      const seen = result.battles.flatMap((b) => b.sides.flatMap((s) => s.captainIds));
      expect(new Set(seen).size).toBe(seen.length);
    }
  });
});

describe("hunting merchants", () => {
  const base = () => withNpcs(at(world(["ann"]), "ann", "sea06"), trader("npc-t1-m1", "sea06"));
  const hunt = [order("ann", { intent: "hunt", huntFilter: "merchants" })];

  it("ends with the merchant either escaped, beaten and taken, or still afloat", () => {
    let taken = 0, escapes = 0, fights = 0;
    for (const seed of SEEDS) {
      const result = resolveTide(map, base(), hunt, seed);
      escapes += result.log.filter((e) => e.kind === "escape").length;
      if (result.battles.length > 0) {
        fights++;
        const npc = result.npcs[0]!;
        if (npc.status === "taken") {
          taken++;
          expect(find(result.next, "ann").plunderGold + who(result.next, "ann").chestGold).toBeGreaterThan(B.startGold - 1);
          expect(who(result.next, "ann").legend).toBeGreaterThanOrEqual(B.legend.npcWin);
        }
      } else {
        expect(result.npcs[0]!.status).toBe("gone");
      }
    }
    expect(escapes + fights).toBe(SEEDS.length);
    expect(escapes).toBeGreaterThan(30);
    expect(taken).toBeGreaterThan(10);
  });

  it("pays the Small Trader's cargo into plunder and the Legend of an NPC win", () => {
    const seed = SEEDS.find((s) => resolveTide(map, base(), hunt, s).npcs[0]!.status === "taken")!;
    const result = resolveTide(map, base(), hunt, seed);
    const ship = find(result.next, "ann");
    const expected = who(result.next, "ann").chestGold - B.startGold;   // sea06 is not a port, so nothing is banked
    expect(expected).toBe(0);
    expect(ship.plunderGold).toBeGreaterThan(0);
    expect(ship.plunderGold).toBeLessThanOrEqual(Math.ceil(B.npc.prizeUnitValue * B.npc.smallTrader.cargo * 1.04));
    expect(result.gazette.headlines.join(" ")).toContain("Small Trader");
  });

  it("keeps merchants out of a fight with a ship that is not hunting", () => {
    const snap = base();
    const result = resolveTide(map, snap, [order("ann")], 4);
    expect(result.battles).toHaveLength(0);
    expect(result.npcs[0]!.status).toBe("gone");
  });

  it("marks every NPC of the Tide as gone or taken, never active", () => {
    const result = resolveTide(map, withNpcs(base(), trader("npc-t1-m1", "sea06"), trader("npc-t1-m2", "sea08")), hunt, 5);
    expect(result.npcs.map((n) => n.status).every((s) => s === "gone" || s === "taken")).toBe(true);
  });
});

describe("captain against captain", () => {
  const duel = () => at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06", { plunderGold: 200 });
  // Ann's plan beats Bob's in every round, so the hunter wins unless the luck rolls are very unkind.
  const raid = [
    order("ann", { intent: "hunt", huntFilter: "players" }),
    order("bob", { plan: ["board", "broadside", "outmaneuver"] }),
  ];

  it("moves the loot from loser to winner and creates nothing", () => {
    let fought = 0;
    for (const seed of SEEDS) {
      const result = resolveTide(map, duel(), raid, seed);
      const battle = result.battles[0];
      if (!battle || battle.outcome === "draw") continue;
      fought++;
      // A struck ship is towed into port and banks what it still has, so count the Chests too.
      const worth = (id: string) => find(result.next, id).plunderGold + who(result.next, id).chestGold - B.startGold;
      expect(worth("ann") + worth("bob")).toBe(200);   // nobody had a bounty, so the Admiralty paid nothing
      expect(find(result.next, "ann").plunderGold).toBe(battle.loot.reduce((t, l) => t + l.gold, 0));
    }
    expect(fought).toBeGreaterThan(20);
  });

  it("shields the loser for two Tides and ends the shield for a hunter of players", () => {
    const r = SEEDS.map((s) => resolveTide(map, duel(), raid, s)).find((x) => x.battles[0] && x.battles[0].outcome !== "draw")!;
    expect(who(r.next, "bob").shieldUntilTide).toBe(1 + B.shieldTidesAfterPvpLoss);
    expect(who(r.next, "ann").shieldUntilTide).toBeNull();

    // Bob is shielded on Tides 2 and 3, so Ann cannot catch him, and on Tide 4 she can.
    for (const [tide, caught] of [[2, false], [3, false], [4, true]] as const) {
      const again = at(at({ ...r.next, tide }, "ann", "sea06"), "bob", "sea06");
      const fights = SEEDS.slice(0, 30).some((s) => resolveTide(map, again, [
        order("ann", { tide, intent: "hunt", huntFilter: "players" }), order("bob", { tide }),
      ], s).battles.length > 0);
      expect(fights).toBe(caught);
    }
  });

  it("puts a bounty on a hunter who wins in Crown Waters, equal to the loot", () => {
    const crown = at(at(world(["ann", "bob"]), "ann", "sea01", { levels: { ...maxed } }), "bob", "sea01", { plunderGold: 300 });
    const hit = SEEDS.map((s) => resolveTide(map, crown, raid, s))
      .find((r) => r.battles[0] && r.battles[0].outcome !== "draw" && r.battles[0].loot.length > 0
        && r.battles[0].sides[0]!.captainIds.includes("ann"));
    expect(hit).toBeDefined();
    const gained = hit!.battles[0]!.loot.reduce((t, l) => t + l.gold, 0);
    expect(gained).toBeGreaterThan(0);
    expect(who(hit!.next, "ann").bounty).toBe(gained);           // a fresh bounty does not shrink in the Tide it is earned
    expect(hit!.battles[0]!.bountiesAdded[0]?.reasons).toContain("crownWaters");
  });

  it("tows a ship whose hull hit zero to the nearest port, half patched and docked", () => {
    const mismatch = at(at(world(["ann", "bob"]), "ann", "sea06", { levels: { ...maxed }, hullPoints: maxHullPoints("sloop", 10) }), "bob", "sea06");
    const r = SEEDS.map((s) => resolveTide(map, mismatch, raid, s)).find((x) => x.battles[0]?.outcome === "decisive")!;
    expect(r).toBeDefined();
    const bob = find(r.next, "bob");
    expect(bob.nodeId).toBe(nearestPort(map, "sea06"));
    expect(bob.docked).toBe(true);
    expect(bob.hullPoints).toBeGreaterThanOrEqual(B.repair.strikeFreePatch * maxHullPoints("sloop", 0));
    expect(r.gazette.headlines.join(" ")).toContain("strike her colours");
    expect(r.log.some((e) => e.kind === "tow")).toBe(true);
  });

  it("collects the bounty on a beaten captain from the Admiralty and clears it", () => {
    const hunted = captainOf(at(at(world(["ann", "bob"]), "ann", "sea06", { levels: { ...maxed } }), "bob", "sea06"), "bob", { bounty: 100 });
    const r = SEEDS.map((s) => resolveTide(map, hunted, raid, s)).find((x) => x.battles[0] && x.battles[0].outcome !== "draw"
      && x.battles[0].sides[0]!.captainIds.includes("ann"))!;
    expect(r).toBeDefined();
    expect(who(r.next, "bob").bounty).toBe(0);
    expect(find(r.next, "ann").plunderGold).toBeGreaterThanOrEqual(100);
  });
});

describe("parley", () => {
  // Ann is far stronger than Bob, so she clears any parley threshold. Bob carries plunder and some Rum.
  const caught = () => at(at(world(["ann", "bob"]), "ann", "sea06", { levels: { ...maxed } }), "bob", "sea06",
    { plunderGold: 200, cargo: { rum: 5, sugar: 0, spice: 0 }, cargoCostBasis: { rum: 50, sugar: 0, spice: 0 } });
  const hunt = (noQuarter: boolean) => [
    order("ann", { intent: "hunt", huntFilter: "players", noQuarter }),
    order("bob", { parley: 1.25 }),
  ];

  it("lets the hunted pay 10% of plunder and cargo as tribute and sail on, with no battle", () => {
    const r = SEEDS.map((s) => resolveTide(map, caught(), hunt(false), s)).find((x) => x.log.some((e) => e.kind === "tribute"))!;
    expect(r).toBeDefined();
    expect(r.battles).toHaveLength(0);
    expect(find(r.next, "bob").plunderGold).toBe(180);
    expect(find(r.next, "bob").cargo.rum).toBe(4);   // 10% of 5 units, rounded to the nearest whole unit, is 1 (0.5 rounds up)
    expect(find(r.next, "ann").plunderGold).toBeGreaterThan(20);   // the plunder plus the cargo's value
    expect(r.gazette.headlines.join(" ")).toContain("tribute");
  });

  it("fights instead when the hunter sets No Quarter, and that refusal puts a bounty on the hunter", () => {
    for (const seed of SEEDS.slice(0, 80)) {
      expect(resolveTide(map, caught(), hunt(true), seed).log.some((e) => e.kind === "tribute")).toBe(false);
    }
    const won = SEEDS.map((s) => resolveTide(map, caught(), hunt(true), s))
      .find((x) => x.battles[0] && x.battles[0].outcome !== "draw" && x.battles[0].winner === 0)!;
    expect(won.battles[0]!.bountiesAdded[0]?.reasons).toContain("refusedParley");
  });

  it("does not offer a parley to a hunter that is not strong enough", () => {
    const even = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06");
    for (const seed of SEEDS.slice(0, 80)) {
      expect(resolveTide(map, even, hunt(false), seed).log.some((e) => e.kind === "tribute")).toBe(false);
    }
  });

  // A captain who sent no orders at sea sails Quietly towards the nearest port, so Ann waits on the first node of that way.
  const onTheWay = (snap: TideSnapshot) => at(snap, "ann", shortestPath(map, "sea06", nearestPort(map, "sea06"))[0]!);
  const waiting = [order("ann", { intent: "hunt", huntFilter: "players" })];

  it("offers the standing parley of a captain who sent no orders, and none when it is off", () => {
    const tribute = (snap: TideSnapshot, seed: number) => resolveTide(map, snap, waiting, seed).log.some((e) => e.kind === "tribute");
    const asked = onTheWay(captainOf(caught(), "bob", { standingParley: 1.25 }));
    expect(SEEDS.some((s) => tribute(asked, s))).toBe(true);
    const off = onTheWay(captainOf(caught(), "bob", { standingParley: "off" }));
    for (const seed of SEEDS) expect(tribute(off, seed)).toBe(false);
  });

  it("defends with the standing plan of a captain who sent no orders", () => {
    const standing: [Maneuver, Maneuver, Maneuver] = ["board", "broadside", "board"];
    const even = onTheWay(captainOf(at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06"), "bob", { standingPlan: standing }));
    const r = SEEDS.map((s) => resolveTide(map, even, waiting, s)).find((x) => x.battles.length > 0)!;
    expect(r).toBeDefined();
    expect(r.battles[0]!.rounds.map((round) => round.ships.find((s) => s.shipId === "bob")!.maneuver)).toEqual(standing);
  });
});

describe("fleets", () => {
  it("brings a fleet mate who is Escorting into the fight, on the same side", () => {
    const base = at(at(at(world(["ann", "bob", "cat"], { ann: "f1", bob: "f1" }), "ann", "sea06"), "bob", "sea06"), "cat", "sea06");
    const r = SEEDS.map((s) => resolveTide(map, base, [
      order("ann", { intent: "hunt", huntFilter: "players" }), order("bob", { intent: "escort" }), order("cat"),
    ], s)).find((x) => x.battles.length > 0)!;
    expect(r.battles[0]!.sides[0]!.captainIds).toEqual(["ann", "bob"]);
    expect(r.battles[0]!.sides[1]!.captainIds).toEqual(["cat"]);
  });

  it("never lets fleet mates hunt each other", () => {
    const base = at(at(world(["ann", "bob"], { ann: "f1", bob: "f1" }), "ann", "sea06"), "bob", "sea06");
    for (const seed of SEEDS.slice(0, 40)) {
      const r = resolveTide(map, base, [order("ann", { intent: "hunt", huntFilter: "anyone" }), order("bob")], seed);
      expect(r.battles).toHaveLength(0);
    }
  });
});

describe("the Treasure Galleon", () => {
  const COUNTER: [Maneuver, Maneuver, Maneuver] = ["outmaneuver", "broadside", "outmaneuver"];
  const pair = () => withNpcs(at(at(world(["ann", "bob"], { ann: "f1", bob: "f1" }), "ann", "sea06"), "bob", "sea06"), galleon("sea06"));
  const hunt = [
    order("ann", { intent: "hunt", huntFilter: "merchants", plan: COUNTER }),
    order("bob", { intent: "hunt", huntFilter: "merchants", plan: COUNTER }),
  ];

  it("is fought by every hunter at its node together and never flees", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const r = resolveTide(map, pair(), hunt, seed);
      expect(r.log.some((e) => e.kind === "escape")).toBe(false);
      expect(r.battles).toHaveLength(1);
      expect(r.battles[0]!.sides[0]!.captainIds).toEqual(["ann", "bob"]);
      expect(r.battles[0]!.sides[1]!.npcIds).toEqual(["npc-t1-galleon"]);
    }
  });

  it("pays each captain an equal co op share when they sink it, half for a Victory", () => {
    let wins = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const r = resolveTide(map, pair(), hunt, seed);
      const outcome = r.battles[0]!.outcome;
      if (outcome === "draw" || r.npcs[0]!.status !== "taken") continue;
      wins++;
      const expected = settleGalleonBattle(outcome, ["ann", "bob"], 1);
      for (const id of ["ann", "bob"]) {
        // Fleet mates on one node are each other's convoy, so the prize is topped up by one mate's share.
        const share = expected.shares[id]!.gold;
        expect(find(r.next, id).plunderGold).toBe(share + Math.round(share * B.fleet.convoyPerMate));
        expect(who(r.next, id).legend).toBe(B.legend.coopPrize);
      }
    }
    expect(wins).toBeGreaterThan(30);
  });

  it("is too strong for a lone ship", () => {
    const solo = withNpcs(at(world(["ann"]), "ann", "sea06"), galleon("sea06"));
    for (const seed of SEEDS.slice(0, 60)) {
      const r = resolveTide(map, solo, [order("ann", { intent: "hunt", huntFilter: "merchants", plan: COUNTER })], seed);
      expect(r.npcs[0]!.status).not.toBe("taken");
    }
  });
});

describe("income bonuses on prizes (engine/income.ts)", () => {
  const hunt = [order("ann", { intent: "hunt", huntFilter: "merchants" })];
  const prey = (fleets: Record<string, string> = {}, bobAt = "sea08") =>
    withNpcs(at(at(world(["ann", "bob"], fleets), "ann", "sea06"), "bob", bobAt), trader("npc-t1-m1", "sea06"));
  const orders = [...hunt, order("bob")];
  const takenSeed = SEEDS.find((s) => resolveTide(map, prey(), orders, s).npcs[0]!.status === "taken")!;
  const plain = resolveTide(map, prey(), orders, takenSeed);
  const prize = find(plain.next, "ann").plunderGold;
  const next = (snap: TideSnapshot) => resolveTide(map, snap, orders, takenSeed);

  it("starts from a prize worth having", () => {
    expect(prize).toBeGreaterThan(50);
    expect(plain.log.some((e) => e.kind === "bonus")).toBe(false);
  });

  it("adds 50% to a merchant prize with a stored Tide of Shore Leave, and spends that Tide", () => {
    const r = next(captainOf(prey(), "ann", { shoreLeaveTides: 2 }));
    expect(find(r.next, "ann").plunderGold).toBe(prize + Math.round(prize * B.catchUp.shoreLeaveBonus));
    expect(who(r.next, "ann")).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 1 });
    const line = r.log.find((e) => e.kind === "bonus")!;
    expect(line).toMatchObject({ captainId: "ann", visibility: "private" });
    expect(line.text).toContain("Shore Leave");
    expect(r.gazette.headlines.join(" ")).not.toContain("Shore Leave");   // a private line, not a headline
  });

  it("does not spend a second stored Tide when one was already spent on a sale earlier in this Tide", () => {
    const r = next(captainOf(prey(), "ann", { shoreLeaveTides: 1, shoreLeaveUsedTide: 1 }));
    expect(find(r.next, "ann").plunderGold).toBe(prize + Math.round(prize * B.catchUp.shoreLeaveBonus));
    expect(who(r.next, "ann")).toMatchObject({ shoreLeaveTides: 1, shoreLeaveUsedTide: 1 });
  });

  it("adds 20% for Fair Winds, set when the Tide opened", () => {
    const r = next(captainOf(prey(), "ann", { fairWinds: true }));
    expect(find(r.next, "ann").plunderGold).toBe(prize + Math.round(prize * B.catchUp.fairWindsBonus));
  });

  it("adds 10% for each fleet mate who ends the Tide on the same or an adjacent node, and nothing for one further away", () => {
    const f = { ann: "f1", bob: "f1" };
    const near = next(prey(f, map.neighbours("sea06")[0]!));
    expect(find(near.next, "ann").plunderGold).toBe(prize + Math.round(prize * B.fleet.convoyPerMate));
    const far = [...hopsFrom(map, "sea06")].find(([, hops]) => hops === 2)![0];
    expect(find(next(prey(f, far)).next, "ann").plunderGold).toBe(prize);
  });

  it("judges the convoy where the mates ended the Tide, not where they began it", () => {
    // Bob starts two hops away and sails to the node next to Ann's.
    const away = [...hopsFrom(map, "sea06")].find(([, hops]) => hops === 2)![0];
    const closing = [...orders, order("bob", { course: shortestPath(map, away, "sea06").slice(0, 1) })];
    const r = resolveTide(map, prey({ ann: "f1", bob: "f1" }, away), closing, takenSeed);
    expect(find(r.next, "ann").plunderGold).toBe(prize + Math.round(prize * B.fleet.convoyPerMate));
  });

  it("adds the bonuses together", () => {
    const r = next(captainOf(prey({ ann: "f1", bob: "f1" }, "sea06"), "ann", { shoreLeaveTides: 1, fairWinds: true }));
    const rate = B.catchUp.shoreLeaveBonus + B.catchUp.fairWindsBonus + B.fleet.convoyPerMate;
    expect(find(r.next, "ann").plunderGold).toBe(prize + Math.round(prize * rate));
  });

  it("pays no bonus on loot taken from another captain, and spends no Shore Leave on it", () => {
    const duel = at(at(world(["ann", "bob"]), "ann", "sea06"), "bob", "sea06", { plunderGold: 200 });
    const raid = [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob", { plan: ["board", "broadside", "outmaneuver"] })];
    const seed = SEEDS.find((s) => { const b = resolveTide(map, duel, raid, s).battles[0]; return b && b.outcome !== "draw" && b.winner === 0; })!;
    const blessed = resolveTide(map, captainOf(duel, "ann", { shoreLeaveTides: 2, fairWinds: true }), raid, seed);
    expect(find(blessed.next, "ann").plunderGold).toBe(find(resolveTide(map, duel, raid, seed).next, "ann").plunderGold);
    expect(who(blessed.next, "ann").shoreLeaveTides).toBe(2);
  });

  it("spends no Shore Leave on a Tide with no prize", () => {
    const r = resolveTide(map, captainOf(at(world(["ann"]), "ann", "sea06"), "ann", { shoreLeaveTides: 2 }), [order("ann")], 1);
    expect(who(r.next, "ann")).toMatchObject({ shoreLeaveTides: 2, shoreLeaveUsedTide: 0 });
  });

  it("does not depend on the order of captains: the same Tide gives the same result when the snapshot is shuffled", () => {
    const snap = captainOf(prey({ ann: "f1", bob: "f1" }, "sea06"), "ann", { shoreLeaveTides: 1, fairWinds: true });
    const shuffled = { ...snap, captains: [...snap.captains].reverse(), ships: [...snap.ships].reverse() };
    expect(JSON.stringify(next(shuffled).next)).toBe(JSON.stringify(next(snap).next));
  });
});

describe("Fair Winds for the Tide that opens", () => {
  const four = (legends: number[]) => {
    let snap = world(["ann", "bob", "cat", "dan"]);
    legends.forEach((legend, i) => { snap = captainOf(snap, ["ann", "bob", "cat", "dan"][i]!, { legend }); });
    return snap;
  };
  const present = ["ann", "bob", "cat", "dan"].map((id) => order(id));
  const winds = (snap: TideSnapshot) => resolveTide(map, snap, present, 1).next.captains.filter((c) => c.fairWinds).map((c) => c.id);

  it("goes to captains below 70% of the median Legend", () => {
    expect(winds(four([100, 100, 100, 10]))).toEqual(["dan"]);
    expect(winds(four([100, 100, 100, 70]))).toEqual([]);   // exactly 70% is not below
    expect(winds(four([100, 100, 40, 10]))).toEqual(["cat", "dan"]);
  });

  it("goes to nobody while the median Legend is zero, as at the start of a season", () => {
    expect(winds(four([0, 0, 0, 0]))).toEqual([]);
    expect(winds(four([50, 0, 0, 0]))).toEqual([]);
  });

  it("is taken away again when a captain catches up", () => {
    const behind = { ...four([100, 100, 100, 10]), captains: four([100, 100, 100, 10]).captains.map((c) => (c.id === "dan" ? { ...c, fairWinds: true } : c)) };
    expect(winds(behind)).toEqual(["dan"]);
    expect(winds({ ...behind, captains: behind.captains.map((c) => (c.id === "dan" ? { ...c, legend: 90 } : c)) })).toEqual([]);
  });

  it("does not count Ashore captains in the median", () => {
    // Three captains far ahead are Ashore at Legend 1000, the other two sit at 100 and 40: the median of the active two is 70.
    const snap = captainOf(captainOf(captainOf(captainOf(captainOf(world(["ann", "bob", "cat", "dan", "eve"]),
      "ann", { legend: 1000, status: "ashore", lastOrdersTide: -10 }), "bob", { legend: 1000, status: "ashore", lastOrdersTide: -10 }),
      "cat", { legend: 1000, status: "ashore", lastOrdersTide: -10 }), "dan", { legend: 100 }), "eve", { legend: 40 });
    const r = resolveTide(map, snap, [order("dan"), order("eve")], 1);
    expect(r.next.captains.filter((c) => c.fairWinds).map((c) => c.id)).toEqual(["eve"]);   // 40 is below 0.7 * 70 = 49
  });
});

describe("the end of the Tide", () => {
  it("shrinks old bounties by 10% and drifts prices back towards normal", () => {
    const snap = captainOf(world(["ann"]), "ann", { bounty: 100 });
    const hot = { ...snap, market: snap.market.map((r, i) => (i === 0 ? { ...r, drift: 0.5, soldThisTide: 9 } : r)) };
    const { next } = resolveTide(map, hot, [], 1);
    expect(who(next, "ann").bounty).toBe(90);
    expect(next.market[0]).toMatchObject({ drift: 0.75, soldThisTide: 0 });
  });

  it("spawns next Tide's NPCs, the galleon on Tide 7 and none after the last Tide", () => {
    const six = { ...world(["ann", "bob", "cat", "dan", "eve", "fay"]), tide: 6 };
    const present = (tide: number) => ["ann", "bob", "cat", "dan", "eve", "fay"].map((id) => order(id, { tide }));
    const r6 = resolveTide(map, six, present(6), 1);
    expect(r6.next.tide).toBe(7);
    expect(r6.next.npcs.some((n) => n.kind === "galleon")).toBe(true);
    expect(r6.next.npcs.every((n) => n.spawnedTide === 7)).toBe(true);
    expect(r6.next.npcs.filter((n) => n.kind !== "galleon").length).toBeGreaterThanOrEqual(4);
    const last = resolveTide(map, { ...six, tide: 14 }, [], 1);
    expect(last.next.tide).toBe(15);
    expect(last.next.npcs).toEqual([]);
  });

  it("picks the Trade Winds port when week 2 begins and keeps it all week", () => {
    const snap = world(["ann"]);
    expect(snap.boomPortId).toBeNull();
    const t7 = resolveTide(map, { ...snap, tide: 7 }, [], 1).next;
    expect(t7.boomPortId).not.toBeNull();
    expect(resolveTide(map, t7, [], 2).next.boomPortId).toBe(t7.boomPortId);
    expect(resolveTide(map, { ...snap, tide: 6 }, [], 1).next.boomPortId).toBeNull();
  });

  it("makes the Most Wanted pay out 50% more Legend to whoever beats them", () => {
    const seedWin = (mostWanted: boolean) => {
      let snap = at(at(world(["ann", "bob"]), "ann", "sea06", { levels: { ...maxed } }), "bob", "sea06");
      if (mostWanted) snap = captainOf(snap, "bob", { legend: 500 });
      const r = SEEDS.map((s) => resolveTide(map, snap, [order("ann", { intent: "hunt", huntFilter: "players" }), order("bob")], s))
        .find((x) => x.battles[0]?.outcome === "decisive" && x.battles[0].sides[0]!.captainIds.includes("ann"))!;
      return who(r.next, "ann").legend;
    };
    expect(seedWin(true)).toBeGreaterThan(seedWin(false));
  });
});
