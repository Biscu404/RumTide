// The logic behind each Edge Function (section 15.4 and 15.5), with no Deno, HTTP or Supabase in it.
// Each handler takes a Deps bundle (the store, the clock, a seed source) and a payload, validates the
// payload with Zod and then with the engine, and writes through the store. The Edge Function files
// only wire a request to one of these, which is what lets bots play a season through them.

import type { ZodType, z } from "zod";
import { courseLimit } from "../engine/explore.ts";
import type { GameMap } from "../engine/map.ts";
import {
  FleetError, acceptInvite, createFleet, declineInvite, fleetById, inviteCaptain, leaveFleet, type FleetBook,
} from "../engine/fleet.ts";
import { describeBonus, incomeFacts } from "../engine/income.ts";
import { courseError } from "../engine/movement.ts";
import {
  PortError, buyGood, buyUpgrade, feedShipwright, repairShip, sellGood, type PortContext,
} from "../engine/port.ts";
import { resolveTide } from "../engine/resolve.ts";
import { startSeason, type NewCaptain } from "../engine/season.ts";
import type { Captain, Gazette, MarketRow, Orders, Ship, Transaction } from "../engine/types.ts";
import { failureMessage, fleetLeaveMessage, gazetteMessage } from "./discord.ts";
import { localDate, nextDueAt } from "./schedule.ts";
import {
  adminSchema, fleetActionSchema, portActionSchema, standingOrdersSchema, submitOrdersSchema, type AdminPayload,
} from "./schemas.ts";
import {
  ApiError, type AdminLogEntry, type CaptainView, type GameStore, type SeasonInfo, type TideHistoryEntry,
} from "./store.ts";

export interface Deps {
  store: GameStore;
  getMap(mapId: string): GameMap;
  now(): Date;
  /** A fresh 32 bit seed for a Tide. The engine never makes its own. */
  newSeed(): number;
  /** A fresh id for a fleet. Defaults to a random UUID; tests give predictable ones. */
  newId?(): string;
  /** Post to the group chat. Optional, and allowed to fail. */
  notify?(text: string): Promise<void>;
  siteUrl?: string;
}

function parse<S extends ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue && issue.path.length > 0 ? `${issue.path.map(String).join(".")}: ` : "";
  throw new ApiError(`Bad request. ${where}${issue?.message ?? "Invalid payload"}`, 400);
}

/** The captain's view, if they play in an open Tide that is not past its due time. */
async function openView(deps: Deps, userId: string): Promise<CaptainView> {
  const view = await deps.store.captainView(userId);
  if (!view) throw new ApiError("You are not a captain in a running season", 404);
  const { tide } = view.active;
  if (tide.status !== "open" || deps.now().getTime() >= new Date(tide.dueAt).getTime()) {
    throw new ApiError("The Tide is turning. Try again once the new Tide opens.", 409);
  }
  return view;
}

// ---- submit_orders ----

export interface SubmitOrdersResult { orders: Orders; }

export async function submitOrders(deps: Deps, userId: string, body: unknown): Promise<SubmitOrdersResult> {
  const p = parse(submitOrdersSchema, body);
  const view = await openView(deps, userId);
  const { captain, ship } = view;
  if (p.tide !== view.active.tide.number) {
    throw new ApiError(`Orders are for Tide ${p.tide} but Tide ${view.active.tide.number} is open`, 409);
  }

  const map = deps.getMap(view.active.season.mapId);
  const problem = courseError(map, ship.nodeId, p.course, courseLimit(ship, captain));
  if (problem !== null) throw new ApiError(problem);

  const known = (id: string) => view.roster.find((r) => r.id === id);
  if (typeof p.huntFilter === "object" && (p.huntFilter.captainId === captain.id || !known(p.huntFilter.captainId))) {
    throw new ApiError("That captain cannot be hunted");
  }
  if (p.intent === "escort") {
    const mate = p.escortCaptainId === undefined ? undefined : known(p.escortCaptainId);
    if (!mate || mate.id === captain.id || mate.fleetId === null || mate.fleetId !== captain.fleetId) {
      throw new ApiError("You can only escort a captain in your own fleet");
    }
  }

  // Keep only the fields the intent uses, so a stale hunt filter never rides along.
  const orders: Orders = {
    tide: p.tide, captainId: captain.id, course: p.course, intent: p.intent,
    ...(p.intent === "hunt" && p.huntFilter !== undefined ? { huntFilter: p.huntFilter } : {}),
    ...(p.intent === "escort" ? { escortCaptainId: p.escortCaptainId! } : {}),
    plan: p.plan, parley: p.parley, noQuarter: p.noQuarter, ready: p.ready,
  };
  await deps.store.saveOrders(view.active.season.id, orders);
  return { orders };
}

// ---- port_action ----

export interface PortActionResult { message: string; chestGold: number; ship: Ship; }

export async function portAction(deps: Deps, userId: string, body: unknown): Promise<PortActionResult> {
  const p = parse(portActionSchema, body);
  const view = await openView(deps, userId);
  if (!view.ship.docked) throw new ApiError("The ship is not docked at a port");
  const { season, tide } = view.active;
  const map = deps.getMap(season.mapId);
  const ctx: PortContext = {
    map, tide: tide.number, settings: season.settings, boomPortId: view.boomPortId,
    income: incomeFacts(map, view.captain.id, view.roster),
  };
  const rowFor = (good: string): MarketRow => {
    const row = view.market.find((r) => r.good === good);
    if (!row) throw new ApiError("There is no market here");
    return row;
  };

  let result: { ship: Ship; captain: typeof view.captain; market?: MarketRow; message: string; kind: string };
  try {
    switch (p.action) {
      case "buy": {
        const r = buyGood(view.ship, view.captain, rowFor(p.good), p.good, p.units, ctx);
        result = { ...r, kind: "buy", message: `Bought ${r.units} ${p.good} for ${r.gold} doubloons.` };
        break;
      }
      case "sell": {
        const r = sellGood(view.ship, view.captain, rowFor(p.good), p.good, p.units, ctx);
        const why = r.bonus && r.bonus.extra > 0 ? describeBonus(r.bonus) : null;
        result = {
          ...r, market: r.row, kind: "sell",
          message: `Sold ${r.units} ${p.good} for ${r.gold} doubloons${why ? `, and ${why} added ${r.bonus!.extra}` : ""}.`,
        };
        break;
      }
      case "upgrade": {
        const r = buyUpgrade(view.ship, view.captain, p.stat, ctx);
        result = { ...r, kind: "upgrade", message: `${p.stat} is now level ${r.level}. It cost ${r.cost} doubloons.` };
        break;
      }
      case "repair": {
        const r = repairShip(view.ship, view.captain, ctx, p.points);
        result = { ...r, kind: "repair", message: r.points > 0 ? `Repaired ${r.points.toFixed(1)} hull points for ${r.cost} doubloons.` : "Nothing to repair." };
        break;
      }
      case "shipwright": {
        const r = feedShipwright(view.ship, view.captain, p.amount, ctx);
        result = {
          ...r, kind: "shipwright",
          message: r.completed ? `The Shipwright finished your ${r.completed}.` : `The Shipwright took ${r.paid} doubloons.`,
        };
        break;
      }
    }
  } catch (error) {
    if (error instanceof PortError) throw new ApiError(error.message);
    throw error;
  }

  const before = result.market ? rowFor(result.market.good) : null;
  const transaction: Omit<Transaction, "id"> = {
    captainId: view.captain.id, tide: tide.number, kind: result.kind,
    amount: result.captain.chestGold - view.captain.chestGold, balanceAfter: result.captain.chestGold,
    data: p,
  };
  await deps.store.applyPortChange({
    seasonId: season.id, tide: tide.number, captain: result.captain, ship: result.ship,
    expectedVersion: view.version, market: before && result.market ? { before, after: result.market } : null,
    transaction,
  });
  return { message: result.message, chestGold: result.captain.chestGold, ship: result.ship };
}

// ---- standing_orders (section 12.4) ----

export interface StandingOrdersResult { plan: Captain["standingPlan"]; parley: Captain["standingParley"]; }

/**
 * Set the plan and parley a captain falls back on in a Tide they send no orders for. Zod has already
 * checked the shape, and there is nothing more for the engine to check. Like orders, only while the Tide is open.
 */
export async function standingOrders(deps: Deps, userId: string, body: unknown): Promise<StandingOrdersResult> {
  const p = parse(standingOrdersSchema, body);
  const view = await openView(deps, userId);
  await deps.store.saveStandingOrders({
    seasonId: view.active.season.id, tide: view.active.tide.number, captainId: view.captain.id,
    plan: p.plan, parley: p.parley,
  });
  return { plan: p.plan, parley: p.parley };
}

// ---- fleet_action (section 8.1) ----

export interface FleetActionResult { message: string; }

/**
 * Found a fleet, invite a captain, accept or decline an invitation, or give notice to leave. Joining
 * is immediate. Leaving takes effect when the next Tide opens and is announced to the group chat.
 * Like orders and port actions, fleets can only change while the Tide is open.
 */
export async function fleetAction(deps: Deps, userId: string, body: unknown): Promise<FleetActionResult> {
  const p = parse(fleetActionSchema, body);
  const view = await openView(deps, userId);
  const { season, tide } = view.active;
  const { captain, roster } = view;
  const { book, rev } = await deps.store.loadFleets(season.id);
  const players = roster.length;
  const nameOf = (id: string) => roster.find((r) => r.id === id)?.shipName ?? "a captain";
  const fleetName = (b: FleetBook, id: string) => fleetById(b, id)?.name ?? "the fleet";

  let next: FleetBook;
  let message: string;
  let announce: string | null = null;
  try {
    switch (p.action) {
      case "create": {
        const id = (deps.newId ?? (() => crypto.randomUUID()))();
        next = createFleet(book, { id, seasonId: season.id, captainId: captain.id, name: p.name, flag: p.flag, tide: tide.number });
        message = `You founded the ${fleetName(next, id)}.`;
        break;
      }
      case "invite": {
        next = inviteCaptain(book, {
          from: captain.id, to: p.captainId, tide: tide.number, players, known: (id) => roster.some((r) => r.id === id),
        });
        message = `You invited ${nameOf(p.captainId)}.`;
        break;
      }
      case "accept": {
        next = acceptInvite(book, { captainId: captain.id, fleetId: p.fleetId, tide: tide.number, players });
        message = `You joined the ${fleetName(next, p.fleetId)}.`;
        break;
      }
      case "decline": {
        next = declineInvite(book, captain.id, p.fleetId);
        message = "Invitation declined.";
        break;
      }
      case "leave": {
        const out = leaveFleet(book, captain.id, tide.number);
        next = out.book;
        if (out.kind === "disbanded") {
          message = `The ${out.fleet.name} is disbanded.`;
        } else {
          message = `You will leave the ${out.fleet.name} when Tide ${out.effectiveTide} opens. Your fleet mates can see it.`;
          announce = fleetLeaveMessage(season.name, captain.shipName, out.fleet.name, out.effectiveTide);
        }
        break;
      }
    }
  } catch (error) {
    if (error instanceof FleetError) throw new ApiError(error.message);
    throw error;
  }

  await deps.store.applyFleetChange({ seasonId: season.id, tide: tide.number, expectedRev: rev, book: next });
  if (announce !== null) await deps.notify?.(announce).catch(() => {});
  return { message };
}

// ---- resolve_tide ----

export type ResolveOutcome =
  | { status: "idle" }
  | { status: "waiting"; dueAt: string }
  | { status: "busy" }
  | { status: "resolved"; tide: number; reason: "scheduled" | "early" | "forced"; gazette: Gazette; seasonEnded: boolean }
  | { status: "failed"; tide: number; error: string };

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * pg_cron calls this every 5 minutes (section 15.5). It resolves the open Tide when it is due, when
 * everyone is Ready, or when `force` says so (the admin's Resolve now). Safe to call at any time and
 * from several places at once: the claim lets exactly one caller resolve a Tide.
 */
export async function resolveDueTide(deps: Deps, opts: { force?: boolean } = {}): Promise<ResolveOutcome> {
  const { store } = deps;
  const active = await store.activeSeason();
  if (!active) return { status: "idle" };
  const { season, tide } = active;
  // Only the admin's force retries a failed Tide. The cron leaves it alone until someone looks at it.
  const retry = opts.force === true && tide.status === "failed";
  if (tide.status !== "open" && !retry) return { status: "busy" };

  const now = deps.now();
  let reason: "scheduled" | "early" | "forced";
  if (opts.force) {
    reason = "forced";
  } else if (now.getTime() >= new Date(tide.dueAt).getTime()) {
    reason = "scheduled";
  } else {
    // Early Tide: everyone is Ready, and no Tide has turned yet today (section 11.2).
    const usedToday = active.lastResolvedAt !== null
      && localDate(new Date(active.lastResolvedAt), season.timezone) === localDate(now, season.timezone);
    const { active: captains, ready } = await store.readyCount(season.id, tide.number);
    if (usedToday || captains === 0 || ready < captains) return { status: "waiting", dueAt: tide.dueAt };
    reason = "early";
  }

  if (!(await store.claimTide(season.id, tide.number, retry ? "failed" : "open"))) return { status: "busy" };

  let result;
  let ended = false;
  try {
    const state = await store.loadTideState(season.id);
    if (state.snapshot.tide !== tide.number) {
      throw new Error(`Snapshot is for Tide ${state.snapshot.tide} but Tide ${tide.number} is being resolved`);
    }
    result = resolveTide(deps.getMap(season.mapId), state.snapshot, state.orders, tide.seed);
    ended = result.tide >= season.lengthTides;
    await store.applyTideResult({
      seasonId: season.id, result, resolvedAt: now.toISOString(),
      // An early or forced Tide uses up the day, so the next one is due tomorrow.
      next: ended ? null : {
        dueAt: nextDueAt(now, season.timezone, season.tideTimeLocal, reason !== "scheduled").toISOString(),
        seed: deps.newSeed(),
      },
    });
  } catch (error) {
    await store.failTide(season.id, tide.number, message(error)).catch(() => {});
    await deps.notify?.(failureMessage(season.name, tide.number)).catch(() => {});
    return { status: "failed", tide: tide.number, error: message(error) };
  }

  await deps.notify?.(gazetteMessage(season.name, tide.number, result.gazette, deps.siteUrl)).catch(() => {});
  return { status: "resolved", tide: tide.number, reason, gazette: result.gazette, seasonEnded: ended };
}

// ---- admin (section 10.4) ----

export type AdminResult =
  | { season: null; tides: []; log: [] }
  | {
    season: { id: string; name: string; lengthTides: number; timezone: string };
    tide: { number: number; status: string; dueAt: string };
    tides: TideHistoryEntry[];
    log: AdminLogEntry[];
  }
  | { outcome: ResolveOutcome }
  | { started: { seasonId: string; name: string; captains: number } };

/**
 * The game master's page. Callers must be in `admins`. `status` reads the running season, its recent
 * Tides and the admin log. `resolve` forces the open Tide now, or retries it when it has failed.
 * `start` begins a season when none is running. Each `resolve` and `start` is written to the admin log,
 * so every admin action leaves a trace.
 */
export async function adminRequest(deps: Deps, userId: string, body: unknown): Promise<AdminResult> {
  const p = parse(adminSchema, body);
  if (!(await deps.store.isAdmin(userId))) throw new ApiError("Only the game master can do that", 403);
  const active = await deps.store.activeSeason();

  if (p.action === "status") {
    if (!active) return { season: null, tides: [], log: [] };
    const { season, tide } = active;
    return {
      season: { id: season.id, name: season.name, lengthTides: season.lengthTides, timezone: season.timezone },
      tide: { number: tide.number, status: tide.status, dueAt: tide.dueAt },
      tides: await deps.store.tideHistory(season.id),
      log: await deps.store.adminLog(season.id),
    };
  }

  if (p.action === "start") {
    if (active) throw new ApiError(`${active.season.name} is already running`, 409);
    return await startFromAdmin(deps, userId, p);
  }

  if (!active) throw new ApiError("No season is running", 404);
  if (active.tide.number !== p.tide) {
    throw new ApiError(`Tide ${active.tide.number} is the Tide now, not Tide ${p.tide}. Reload the page.`, 409);
  }
  const action = active.tide.status === "failed" ? "retry" : "resolve";
  const outcome = await resolveDueTide(deps, { force: true });
  await deps.store.appendAdminLog({
    seasonId: active.season.id, at: deps.now().toISOString(), adminId: userId, action, tide: p.tide,
    outcome: outcome.status, detail: outcome.status === "failed" ? outcome.error : null,
  });
  return { outcome };
}

// ---- starting a season ----

const DEFAULT_MAP_ID = "brine";
const DEFAULT_TIMEZONE = "Europe/Bucharest";
const DEFAULT_TIDE_TIME = "21:00";

/** Ship names for captains who have not chosen one. Not account names: those stay private. */
const SHIP_NAMES = [
  "Black Gull", "Salt Widow", "Red Tern", "Grey Heron", "Iron Petrel", "Wild Skua",
  "Sea Magpie", "Pale Kestrel", "Night Cormorant", "Crooked Albatross",
];
const shipNameFor = (i: number) => (i < SHIP_NAMES.length ? SHIP_NAMES[i]! : `${SHIP_NAMES[i % SHIP_NAMES.length]!} ${Math.floor(i / SHIP_NAMES.length) + 1}`);

async function startFromAdmin(
  deps: Deps, adminId: string, p: Extract<AdminPayload, { action: "start" }>,
): Promise<AdminResult> {
  const userIds = p.who === "me" ? [adminId] : await deps.store.listUserIds();
  if (userIds.length === 0) throw new ApiError("Nobody has signed up yet", 409);
  const seasonId = crypto.randomUUID();
  await startNewSeason(deps, {
    seasonId, name: p.name, mapId: DEFAULT_MAP_ID, preset: p.preset,
    timezone: DEFAULT_TIMEZONE, tideTimeLocal: p.tideTimeLocal ?? DEFAULT_TIDE_TIME,
    captains: userIds.map((userId, i) => ({ id: crypto.randomUUID(), userId, shipName: shipNameFor(i) })),
  });
  await deps.store.appendAdminLog({
    seasonId, at: deps.now().toISOString(), adminId, action: "start", tide: 1, outcome: "started",
    detail: `${userIds.length} ${userIds.length === 1 ? "captain" : "captains"}, ${p.preset}`,
  });
  return { started: { seasonId, name: p.name, captains: userIds.length } };
}

export interface StartSeasonInput {
  seasonId: string;
  name: string;
  mapId: string;
  preset: SeasonInfo["settings"]["preset"];
  timezone: string;
  tideTimeLocal: string;
  captains: (NewCaptain & { userId: string })[];
}

/** Tide 1: every captain docked in a port, the first Tide open and due at the next Tide time. */
export async function startNewSeason(deps: Deps, input: StartSeasonInput): Promise<void> {
  const map = deps.getMap(input.mapId);
  const snapshot = startSeason(map, input.seasonId, input.preset, input.captains, deps.newSeed());
  const userIds = new Map(input.captains.map((c) => [c.id, c.userId]));
  snapshot.captains = snapshot.captains.map((c) => ({ ...c, userId: userIds.get(c.id)! }));
  await deps.store.createSeason({
    season: {
      id: input.seasonId, name: input.name, status: "active", mapId: input.mapId, timezone: input.timezone,
      tideTimeLocal: input.tideTimeLocal, lengthTides: snapshot.lengthTides, settings: snapshot.settings,
    },
    snapshot,
    dueAt: nextDueAt(deps.now(), input.timezone, input.tideTimeLocal).toISOString(),
    seed: deps.newSeed(),
  });
}
