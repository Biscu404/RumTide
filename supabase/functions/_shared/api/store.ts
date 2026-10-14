// The one seam between the Edge Function logic and the database. handlers.ts only talks to this
// interface, so the same code runs against Postgres (supabase_store.ts) and against memory
// (memory_store.ts, for tests and bot seasons).
//
// Every method is one round trip or one transaction. Writes that must not interleave use
// compare and swap: a captain row carries a `version`, and a write made against an old version
// fails with a 409 so the caller can look again.

import type { TideResult } from "../engine/resolve.ts";
import type { TideSnapshot } from "../engine/season.ts";
import type { Captain, MarketRow, Orders, Season, Ship, Tide, Transaction } from "../engine/types.ts";

/** An error whose message is safe to show the player. `status` becomes the HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type SeasonInfo = Omit<Season, "currentTide">;

export interface TideInfo {
  seasonId: string;
  number: number;
  status: Tide["status"];
  /** ISO time. */
  dueAt: string;
  /** Fixed when the Tide opens, so a retry resolves it the same way. */
  seed: number;
}

/** The running season and the Tide that is open (or resolving, or failed). */
export interface ActiveSeason {
  season: SeasonInfo;
  tide: TideInfo;
  /** When the last Tide resolved, ISO, or null before the first. */
  lastResolvedAt: string | null;
}

/** Everything a single captain's request needs. */
export interface CaptainView {
  active: ActiveSeason;
  boomPortId: string | null;
  captain: Captain;
  ship: Ship;
  /** Bumped by every write to this captain or ship. */
  version: number;
  /** The market rows at the ship's node. Empty at sea. */
  market: MarketRow[];
  /** Every captain in the season, for checking hunt and escort targets. */
  roster: { id: string; fleetId: string | null }[];
}

export interface PortChange {
  seasonId: string;
  tide: number;
  captain: Captain;
  ship: Ship;
  /** The `version` the change was worked out from. */
  expectedVersion: number;
  /** A market row that changed, as it was and as it is now. */
  market: { before: MarketRow; after: MarketRow } | null;
  transaction: Omit<Transaction, "id">;
}

export interface TideState {
  snapshot: TideSnapshot;
  orders: Orders[];
}

export interface ApplyTideArgs {
  seasonId: string;
  result: TideResult;
  /** ISO time the Tide was resolved. */
  resolvedAt: string;
  /** The next Tide, or null when the season is over. */
  next: { dueAt: string; seed: number } | null;
}

export interface CreateSeasonArgs {
  season: SeasonInfo;
  snapshot: TideSnapshot;
  dueAt: string;
  seed: number;
}

export interface GameStore {
  /** The season with status "active", or null. */
  activeSeason(): Promise<ActiveSeason | null>;
  /** The captain this user plays in the active season, or null. */
  captainView(userId: string): Promise<CaptainView | null>;
  /** Save (replace) one captain's orders for a Tide. Throws a 409 unless that Tide is open. */
  saveOrders(seasonId: string, orders: Orders): Promise<void>;
  /** Write a port action. Throws a 409 if the Tide is not open or the captain changed since `expectedVersion`. */
  applyPortChange(change: PortChange): Promise<void>;
  /** Active captains, and how many of them have pressed Ready for this Tide. */
  readyCount(seasonId: string, tide: number): Promise<{ active: number; ready: number }>;
  /** Move the Tide from `from` (open, or failed when an admin retries it) to resolving. True for exactly one caller. */
  claimTide(seasonId: string, tide: number, from?: "open" | "failed"): Promise<boolean>;
  loadTideState(seasonId: string): Promise<TideState>;
  /** Write the whole result and open the next Tide (or end the season), in one transaction. */
  applyTideResult(args: ApplyTideArgs): Promise<void>;
  /** Mark a resolving Tide as failed. Nothing else changes, so it can be retried. */
  failTide(seasonId: string, tide: number, message: string): Promise<void>;
  createSeason(args: CreateSeasonArgs): Promise<void>;
  /** Is this user one of the game masters (a row in `admins`)? */
  isAdmin(userId: string): Promise<boolean>;
  /** The last Tides of a season, newest first, with any error. */
  tideHistory(seasonId: string): Promise<TideHistoryEntry[]>;
  /** The last admin actions of a season, newest first. */
  adminLog(seasonId: string): Promise<AdminLogEntry[]>;
  appendAdminLog(entry: AdminLogEntry): Promise<void>;
}

export interface TideHistoryEntry {
  number: number;
  status: Tide["status"];
  /** ISO time. */
  dueAt: string;
  /** ISO time, or null if the Tide has not resolved. */
  resolvedAt: string | null;
  error: string | null;
}

export interface AdminLogEntry {
  seasonId: string;
  /** ISO time. */
  at: string;
  adminId: string | null;
  action: "resolve" | "retry";
  tide: number;
  /** The status the resolver ended on, such as "resolved", "failed" or "busy". */
  outcome: string;
  detail: string | null;
}
