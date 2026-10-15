// Section 4.4 rule 7 and section 10.1: the exploration deck of 12 events.
//
// A ship that sails to an island or a wreck with the Explore intent, and does not fight on the way,
// draws one event when its course ends. Which events can come up leans on the kind of node, and an
// event that could do nothing for this ship (a repair for an undamaged hull, a rum cache with a full
// Hold) is left out of the draw. Pure: the only randomness is the Rng passed in, and a draw always
// takes the same numbers whatever the event turns out to be.
//
// Four events leave an Omen behind, which the captain carries into the Tides to come (resolve.ts
// spends them): Castaway and Cursed Coin wait for the next battle, Mermaid's Song and the Hermit
// Cartographer last for the next Tide only.

import { B, boom, maxHullPoints, speed } from "./balance.ts";
import type { GameMap } from "./map.ts";
import { galleonNodeFor } from "./npc.ts";
import { holdFree } from "./port.ts";
import type { Rng } from "./rng.ts";
import type { Captain, Omen, SeasonSettings, Ship } from "./types.ts";

export const EXPLORE_EVENTS = [
  "buriedChest", "castaway", "monkeyThief", "turtleSoup", "rumCache", "cursedCoin",
  "messageInBottle", "oldWreck", "reefScrape", "hermit", "mermaid", "ghostLantern",
] as const;
export type ExploreEvent = typeof EXPLORE_EVENTS[number];

/** The Omens that wait for the next battle. The other two last for the next Tide whether or not they were used. */
export const BATTLE_OMENS: readonly Omen[] = ["castaway", "cursedCoin"];
export const TIDE_OMENS: readonly Omen[] = ["mermaid", "cartographer"];

/** What the draw needs to know about the season. */
export interface ExploreWorld {
  map: GameMap;
  seasonId: string;
  /** The Tide being resolved. */
  tide: number;
  settings: Pick<SeasonSettings, "mawOpens" | "galleonTides">;
}

export interface ExploreResult {
  event: ExploreEvent;
  /** The ship after the event: plunder, hull and cargo as changed. */
  ship: Ship;
  /** The effect this event leaves for later Tides, or null. */
  omen: Omen | null;
  /** The Gazette line everyone reads. It names no amounts. */
  headline: string;
  /** The captain's own line, with the amounts. Null when nothing happened that the captain should hear about. */
  note: string | null;
}

const round1 = (x: number) => x.toFixed(1);
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Most hops a course may have: speed, plus the Hermit Cartographer's extra hop, but never more than a Tide has steps. */
export function courseLimit(ship: Pick<Ship, "hull" | "levels">, captain: Pick<Captain, "omens">): number {
  const base = speed(ship.hull, ship.levels.sails);
  if (!captain.omens.includes("cartographer")) return base;
  return Math.max(base, Math.min(base + B.explore.hermit.extraHops, B.movement.steps));
}

/** The next Tide a Treasure Galleon comes on that is far enough ahead for a bottle to tell something new, or null. */
export function bottleGalleonTide(world: { tide: number; settings: Pick<SeasonSettings, "galleonTides"> }): number | null {
  // A galleon on the very next Tide is on the map when the Tide opens, so the bottle would tell nothing new.
  const ahead = world.settings.galleonTides.filter((t) => t >= world.tide + 2);
  return ahead.length === 0 ? null : Math.min(...ahead);
}

function isEligible(event: ExploreEvent, world: ExploreWorld, ship: Ship): boolean {
  switch (event) {
    case "turtleSoup": return ship.hullPoints < maxHullPoints(ship.hull, ship.levels.hull);
    case "rumCache": return holdFree(ship) >= 1;
    case "hermit": return speed(ship.hull, ship.levels.sails) < B.movement.steps;
    case "messageInBottle": return bottleGalleonTide(world) !== null;
    default: return true;
  }
}

/** The relative chance of each event that can come up for this ship, in deck order. */
export function drawOdds(world: ExploreWorld, ship: Ship): { event: ExploreEvent; weight: number }[] {
  const type = world.map.node(ship.nodeId).type;
  if (type !== "island" && type !== "wreck") throw new Error(`Nothing can be explored at ${ship.nodeId}`);
  return EXPLORE_EVENTS
    .map((event) => ({ event, weight: isEligible(event, world, ship) ? B.explore.weights[event][type === "island" ? 0 : 1] : 0 }))
    .filter((e) => e.weight > 0);
}

/** Draw one event. Takes exactly one random number. */
export function drawEvent(world: ExploreWorld, ship: Ship, rng: Rng): ExploreEvent {
  const odds = drawOdds(world, ship);
  let roll = rng.next() * odds.reduce((t, e) => t + e.weight, 0);
  for (const e of odds) {
    roll -= e.weight;
    if (roll < 0) return e.event;
  }
  return odds[odds.length - 1]!.event;   // only reached by rounding at the very top of the range
}

/** Draw an event for a ship that has just arrived, and apply it. */
export function explore(world: ExploreWorld, ship: Ship, captain: Pick<Captain, "shipName">, rng: Rng): ExploreResult {
  return applyEvent(drawEvent(world, ship, rng), world, ship, captain, rng);
}

/** What one event does to a ship. Only the Buried Chest takes a random number of its own. */
export function applyEvent(
  event: ExploreEvent, world: ExploreWorld, ship: Ship, captain: Pick<Captain, "shipName">, rng: Rng,
): ExploreResult {
  const node = world.map.node(ship.nodeId);
  const who = captain.shipName, where = node.name;
  const reward = world.settings.mawOpens && node.zone === "maw" ? B.explore.mawRewardMult : 1;
  /** Gold and rum rewards grow with the Boom and, in the Maw, with the Maw. */
  const doubloons = (base: number) => Math.round(base * boom(world.tide) * reward);
  const maxHull = maxHullPoints(ship.hull, ship.levels.hull);
  const done = (headline: string, note: string | null, changes: Partial<Ship> = {}, omen: Omen | null = null): ExploreResult =>
    ({ event, ship: { ...ship, ...changes }, omen, headline, note });

  switch (event) {
    case "buriedChest": {
      const gold = doubloons(rng.range(B.explore.buriedChest.min, B.explore.buriedChest.max));
      return done(`${who} dug a buried chest out of the sand at ${where}.`,
        `The chest held ${gold} doubloons. They are plunder until you reach a port.`,
        { plunderGold: ship.plunderGold + gold });
    }
    case "castaway":
      return done(`${who} pulled a castaway out of the surf at ${where}.`,
        `The castaway joins your crew. ${omenText("castaway")}`, {}, "castaway");
    case "monkeyThief": {
      const lost = Math.floor(ship.plunderGold * B.explore.monkeyThief.plunderLost);
      return done(`A monkey at ${where} picked ${who}'s pockets and now sits on the rail, very pleased.`,
        lost > 0 ? `The monkey made off with ${lost} doubloons of your plunder.` : "The monkey found nothing worth taking and sulked.",
        { plunderGold: ship.plunderGold - lost });
    }
    case "turtleSoup": {
      const mended = Math.min(B.explore.turtleSoup.hullRepaired * maxHull, maxHull - ship.hullPoints);
      return done(`${who} stopped at ${where} for turtle soup and patched the hull while it simmered.`,
        `Repaired ${round1(mended)} hull points.`, { hullPoints: ship.hullPoints + mended });
    }
    case "rumCache": {
      const units = Math.min(Math.round(B.explore.rumCache.units * reward), holdFree(ship));
      return done(`${who} found a rum cache at ${where}.`,
        `${units} Rum went into your Hold, and it cost you nothing.`,
        { cargo: { ...ship.cargo, rum: ship.cargo.rum + units } });
    }
    case "cursedCoin": {
      const gold = doubloons(B.explore.cursedCoin.gold);
      return done(`${who} pocketed a coin at ${where} that the crew swear is cursed.`,
        `The coin is worth ${gold} doubloons of plunder. ${omenText("cursedCoin")}`,
        { plunderGold: ship.plunderGold + gold }, "cursedCoin");
    }
    case "messageInBottle": {
      const tide = bottleGalleonTide(world)!;
      const spot = world.map.node(galleonNodeFor(world.map, world.seasonId, tide)).name;
      return done(`${who} fished a message in a bottle out of the water at ${where}.`,
        `The message says the Treasure Galleon will be off ${spot} on Tide ${tide}.`);
    }
    case "oldWreck": {
      const gold = doubloons(B.explore.oldWreck.gold);
      return done(`${who} stripped an old wreck at ${where} of everything not nailed down.`,
        `The salvage is worth ${gold} doubloons of plunder.`, { plunderGold: ship.plunderGold + gold });
    }
    case "reefScrape": {
      const torn = Math.max(0, Math.min(B.explore.reefScrape.hullLost * maxHull, ship.hullPoints - 1));
      return done(`${who} scraped a reef at ${where} and said several words.`,
        `The reef tore ${round1(torn)} hull points.`, { hullPoints: ship.hullPoints - torn });
    }
    case "hermit":
      return done(`${who} met a hermit cartographer at ${where}, who talked for an hour.`,
        `The hermit sold you a shortcut. ${omenText("cartographer")}`, {}, "cartographer");
    case "mermaid":
      return done(`${who} heard a mermaid sing off ${where}.`, `Her song fills your sails. ${omenText("mermaid")}`, {}, "mermaid");
    case "ghostLantern":
      return done(`${who} saw a ghost lantern off ${where}. The crew will not stop talking about it.`, null);
  }
}

// ---- Omens ----

export const OMEN_NAMES: Record<Omen, string> = {
  castaway: "Castaway", cursedCoin: "Cursed Coin", mermaid: "Mermaid's Song", cartographer: "Hermit's chart",
};

/** What an Omen does, in a sentence for the Orders screen and the Gazette. */
export function omenText(omen: Omen): string {
  switch (omen) {
    case "castaway": return `+${pct(B.explore.castaway.crewBonus)} Crew in your next battle.`;
    case "cursedCoin":
      return `Your luck in your next battle runs from ${B.explore.cursedCoin.luckMin.toFixed(1)} to ${B.explore.cursedCoin.luckMax.toFixed(1)}, not ${B.combat.luckMin.toFixed(1)} to ${B.combat.luckMax.toFixed(1)}.`;
    case "mermaid": return `+${pct(B.explore.mermaid.escapeMult - 1)} to your escape chance this Tide.`;
    case "cartographer": return `Your course may be ${B.explore.hermit.extraHops === 1 ? "one hop" : `${B.explore.hermit.extraHops} hops`} longer this Tide.`;
  }
}

/** Omens as a sorted list with no repeats, so the same state always looks the same. */
export const omenList = (omens: Iterable<Omen>): Omen[] => [...new Set(omens)].sort();
