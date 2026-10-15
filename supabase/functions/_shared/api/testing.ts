// Test and bot helpers for the handlers: the Brine map, a clock you can move, a MemoryStore, and a
// season ready to play. Not imported by any Edge Function, so it may use Node.

import { readFileSync } from "node:fs";
import { loadMap } from "../engine/map.ts";
import type { Deps, StartSeasonInput } from "./handlers.ts";
import { startNewSeason } from "./handlers.ts";
import { MemoryStore } from "./memory_store.ts";

export const brineMap = loadMap(
  JSON.parse(readFileSync(new URL("../maps/brine.json", import.meta.url), "utf8")),
);

/** Wednesday 14 October 2026, 12:00 in Bucharest (UTC+3 until 25 October). The Tide is due at 21:00. */
export const NOON = new Date("2026-10-14T09:00:00Z");

export interface TestWorld {
  deps: Deps;
  store: MemoryStore;
  /** What the Discord webhook was sent. */
  posts: string[];
  /** The userId of a captain id. */
  user(captainId: string): string;
  setNow(date: Date): void;
}

export function testWorld(options: { notifyFails?: boolean } = {}): TestWorld {
  const store = new MemoryStore();
  const posts: string[] = [];
  let now = NOON;
  let seeds = 0;
  let fleets = 0;
  const deps: Deps = {
    store, getMap: () => brineMap, now: () => now, newSeed: () => 1000 + ++seeds, newId: () => `fleet-${++fleets}`,
    notify: async (text) => {
      if (options.notifyFails) throw new Error("Discord is down");
      posts.push(text);
    },
    siteUrl: "https://rumtide.example",
  };
  return { deps, store, posts, user: (id) => `user-${id}`, setNow: (date) => { now = date; } };
}

export async function seasonWorld(
  captains: StartSeasonInput["captains"] | string[] = ["ann", "bob", "cat"],
  options: { notifyFails?: boolean; preset?: StartSeasonInput["preset"] } = {},
): Promise<TestWorld & { seasonId: string }> {
  const world = testWorld(options);
  const seasonId = "s0";
  await startNewSeason(world.deps, {
    seasonId, name: "Season 0", mapId: brineMap.id, preset: options.preset ?? "season0",
    timezone: "Europe/Bucharest", tideTimeLocal: "21:00",
    captains: captains.map((c) => (typeof c === "string" ? { id: c, userId: world.user(c) } : c)),
  });
  return { ...world, seasonId };
}
