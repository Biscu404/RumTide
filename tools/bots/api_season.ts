// The same bots, the same seasons, but every move goes through the handlers behind the Edge
// Functions (day 6 of section 19.1): port actions through `portAction`, orders through
// `submitOrders`, and each Tide turned by `resolveDueTide` when its time comes, on a clock the
// runner moves. The store is in memory, so no database is needed, but the validation, the version
// checks, the Tide claim, the scheduling and the Discord post are the real ones.
//
// The bots also work out what their state should be after a port visit. The runner checks the
// store against that after every visit, and the season ends exactly as the direct one in
// season.ts: the handlers add nothing and lose nothing.

import { SEASON_PRESETS } from "@engine/balance.ts";
import { incomeFacts, incomeRoster } from "@engine/income.ts";
import type { GameMap } from "@engine/map.ts";
import type { PortContext } from "@engine/port.ts";
import type { TideSnapshot } from "@engine/season.ts";
import type { Orders } from "@engine/types.ts";
import { portAction, resolveDueTide, startNewSeason, submitOrders, type Deps } from "../../supabase/functions/_shared/api/handlers.ts";
import { MemoryStore } from "../../supabase/functions/_shared/api/memory_store.ts";
import { ApiError, type GameStore, type TideInfo } from "../../supabase/functions/_shared/api/store.ts";
import { brine } from "../sim/trader.ts";
import type { Bot } from "./captains.ts";
import { checkState, sixCaptains } from "./season.ts";

/** How the runner looks at, and sets up, the store it is playing on. */
export interface Backend {
  store: GameStore;
  seasonId: string;
  /** The user id a bot signs in as. */
  userId(botId: string): string;
  snapshot(): Promise<TideSnapshot>;
  tide(): Promise<TideInfo>;
  ended(): Promise<boolean>;
  /** Move ships before Tide 1, so fleet mates can set out from one port. */
  place(nodeByCaptain: Record<string, string>): Promise<void>;
  /** Transactions written so far, if the store can count them. */
  transactions?(): number;
  failures?(): string[];
}

export function memoryBackend(seasonId = "bots"): Backend {
  const store = new MemoryStore();
  return {
    store, seasonId, userId: (id) => `user-${id}`,
    snapshot: async () => store.snapshot(seasonId),
    tide: async () => store.tideInfo(seasonId),
    ended: async () => store.seasonInfo(seasonId).status === "ended",
    place: async (nodes) => store.edit(seasonId, (snap) => {
      snap.ships = snap.ships.map((s) => (s.captainId in nodes ? { ...s, nodeId: nodes[s.captainId]! } : s));
    }),
    transactions: () => store.transactions.length,
    failures: () => store.failures,
  };
}

export interface ApiSeasonReport {
  seed: number;
  final: TideSnapshot;
  /** What was posted to the Discord webhook. */
  posts: string[];
  /** Port actions the bots made, and the orders they sent. */
  portActions: number;
  orders: number;
  problems: string[];
}

/** The seeds the direct season in season.ts uses, in the order the handlers ask for them. */
const seedsFor = (seed: number, tides: number) => [seed, ...Array.from({ length: tides + 1 }, (_, i) => seed * 1000 + i + 1)];

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Orders as the client sends them: no captain id, the server knows who is calling. */
function payload(o: Orders) {
  const { captainId: _captain, ...rest } = o;
  return rest;
}

export async function playSeasonThroughApi(
  seed: number, bots: Bot[] = sixCaptains(seed), map: GameMap = brine, backend: Backend = memoryBackend(`bots-${seed}`),
): Promise<ApiSeasonReport> {
  const preset = "season0";
  const lengthTides = SEASON_PRESETS[preset].lengthTides;
  const sorted = [...bots].sort((a, b) => (a.id < b.id ? -1 : 1));
  const { store, seasonId, userId: user } = backend;

  const posts: string[] = [];
  const seeds = seedsFor(seed, lengthTides);
  let now = new Date("2026-10-14T09:00:00Z");   // 12:00 in Bucharest; Tide 1 is due at 21:00
  const deps: Deps = {
    store, getMap: () => map, now: () => now, newSeed: () => seeds.shift() ?? 0,
    notify: async (text) => { posts.push(text); },
    siteUrl: "https://rumtide.example",
  };

  const problems: string[] = [];
  let portActions = 0, orderCount = 0;
  await startNewSeason(deps, {
    seasonId, name: "Season 0", mapId: map.id, preset, timezone: "Europe/Bucharest", tideTimeLocal: "21:00",
    captains: sorted.map((b) => ({ id: b.id, userId: user(b.id), fleetId: b.fleetId })),
  });

  // Fleet mates set out together from one port, as in the direct season.
  for (const fleet of new Set(sorted.map((b) => b.fleetId).filter((f): f is string => f !== null))) {
    const mates = sorted.filter((b) => b.fleetId === fleet).map((b) => b.id);
    const home = (await backend.snapshot()).ships.find((s) => s.captainId === mates[0])!.nodeId;
    await backend.place(Object.fromEntries(mates.map((id) => [id, home])));
  }
  problems.push(...checkState(map, await backend.snapshot(), "start"));

  for (let tide = 1; tide <= lengthTides; tide++) {
    const info = await backend.tide();
    now = new Date(new Date(info.dueAt).getTime() - 3 * 3600_000);
    if (info.number !== tide) { problems.push(`Tide ${tide}: the store has Tide ${info.number} open`); break; }

    for (const bot of sorted) {
      const snap = await backend.snapshot();
      const view = {
        map, snap,
        ctx: {
          map, tide, settings: snap.settings, boomPortId: snap.boomPortId,
          income: incomeFacts(map, bot.id, incomeRoster(snap)),
        } satisfies PortContext,
        ship: snap.ships.find((s) => s.captainId === bot.id)!,
        captain: snap.captains.find((c) => c.id === bot.id)!,
      };
      const turn = bot.play(view);
      const who = `Tide ${tide}, ${bot.id}`;

      try {
        for (const action of turn.actions) {
          await portAction(deps, user(bot.id), action);
          portActions++;
        }
        if (turn.orders && !bot.absent.includes(tide)) {
          await submitOrders(deps, user(bot.id), payload(turn.orders));
          orderCount++;
        }
      } catch (error) {
        const what = error instanceof ApiError ? `${error.status} ${error.message}` : String(error);
        problems.push(`${who}: the handlers refused a move: ${what}`);
        continue;
      }

      // The store must hold exactly what the bot worked out. `docked` is the one field a bot
      // changes for itself when it loads cargo and sails, and the resolver sets it again anyway.
      const after = await backend.snapshot();
      const ship = after.ships.find((s) => s.captainId === bot.id)!;
      if (!sameJson({ ...ship, docked: 0 }, { ...turn.ship, docked: 0 })) problems.push(`${who}: the ship in the store is not the ship the bot expected`);
      if (!sameJson(after.captains.find((c) => c.id === bot.id), turn.captain)) problems.push(`${who}: the captain in the store is not the one the bot expected`);
      if (!sameJson(after.market, turn.market)) problems.push(`${who}: the market in the store is not the one the bot expected`);
    }
    problems.push(...checkState(map, await backend.snapshot(), `Tide ${tide} after port visits`, false));

    now = new Date(info.dueAt);
    const outcome = await resolveDueTide(deps);
    if (outcome.status !== "resolved" || outcome.reason !== "scheduled") {
      problems.push(`Tide ${tide}: resolve_tide answered ${JSON.stringify(outcome)}`);
      break;
    }
    problems.push(...checkState(map, await backend.snapshot(), `Tide ${tide} resolved`));
  }

  if (!(await backend.ended())) problems.push("the season never ended");
  if (posts.length !== lengthTides) problems.push(`${posts.length} Discord posts for ${lengthTides} Tides`);
  posts.forEach((text, i) => { if (!text.includes(`Tide ${i + 1}`)) problems.push(`Discord post ${i + 1} does not name its Tide`); });
  problems.push(...(backend.failures?.() ?? []).map((f) => `a Tide failed: ${f}`));
  const written = backend.transactions?.();
  if (written !== undefined && written !== portActions) problems.push(`${portActions} port actions but ${written} transactions`);

  return { seed, final: await backend.snapshot(), posts, portActions, orders: orderCount, problems };
}
