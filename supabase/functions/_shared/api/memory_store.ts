// A GameStore that lives in memory, with the same rules as the Postgres one: orders and port
// actions need an open Tide, port actions are compare and swap on the captain's version, and a
// Tide can be claimed once. Used by the handler tests and by the bot season, so a whole season
// can be played through the real handlers without a database.

import type { TideResult } from "../engine/resolve.ts";
import type { TideSnapshot } from "../engine/season.ts";
import type { Battle, Gazette, LogEvent, Orders, Transaction } from "../engine/types.ts";
import {
  ApiError, type ActiveSeason, type ApplyTideArgs, type CaptainView, type CreateSeasonArgs, type GameStore,
  type PortChange, type SeasonInfo, type TideInfo, type TideState,
} from "./store.ts";

interface SeasonRecord {
  info: SeasonInfo;
  tide: TideInfo;
  lastResolvedAt: string | null;
  snapshot: TideSnapshot;
  versions: Map<string, number>;
  orders: Map<string, Orders>;
}

const clone = <T>(x: T): T => structuredClone(x);
const ordersKey = (tide: number, captainId: string) => `${tide}:${captainId}`;

export class MemoryStore implements GameStore {
  private seasons = new Map<string, SeasonRecord>();

  /** Everything the Tides have produced, for tests and reports to read. */
  readonly battles: Battle[] = [];
  readonly log: LogEvent[] = [];
  readonly transactions: Transaction[] = [];
  readonly gazettes = new Map<number, Gazette>();
  readonly results: TideResult[] = [];
  /** The error of each failed Tide. */
  readonly failures: string[] = [];

  private active(): SeasonRecord | null {
    for (const rec of this.seasons.values()) if (rec.info.status === "active") return rec;
    return null;
  }

  private mustFind(seasonId: string): SeasonRecord {
    const rec = this.seasons.get(seasonId);
    if (!rec) throw new ApiError("Unknown season", 404);
    return rec;
  }

  private requireOpen(rec: SeasonRecord, tide: number) {
    if (rec.tide.number !== tide || rec.tide.status !== "open") throw new ApiError("That Tide is not open", 409);
  }

  /** The current snapshot, copied. */
  snapshot(seasonId?: string): TideSnapshot {
    return clone((seasonId ? this.mustFind(seasonId) : this.active() ?? [...this.seasons.values()].at(-1)!).snapshot);
  }

  /** Change the current snapshot in place, the way a bug or an admin fix would. For tests. */
  edit(seasonId: string, change: (snapshot: TideSnapshot) => void): void {
    change(this.mustFind(seasonId).snapshot);
  }

  tideInfo(seasonId: string): TideInfo { return clone(this.mustFind(seasonId).tide); }

  seasonInfo(seasonId: string): SeasonInfo { return clone(this.mustFind(seasonId).info); }

  async activeSeason(): Promise<ActiveSeason | null> {
    const rec = this.active();
    return rec ? clone({ season: rec.info, tide: rec.tide, lastResolvedAt: rec.lastResolvedAt }) : null;
  }

  async captainView(userId: string): Promise<CaptainView | null> {
    const rec = this.active();
    const captain = rec?.snapshot.captains.find((c) => c.userId === userId);
    if (!rec || !captain) return null;
    const ship = rec.snapshot.ships.find((s) => s.captainId === captain.id)!;
    return clone({
      active: { season: rec.info, tide: rec.tide, lastResolvedAt: rec.lastResolvedAt },
      boomPortId: rec.snapshot.boomPortId, captain, ship, version: rec.versions.get(captain.id)!,
      market: rec.snapshot.market.filter((m) => m.portId === ship.nodeId),
      roster: rec.snapshot.captains.map((c) => ({ id: c.id, fleetId: c.fleetId })),
    });
  }

  async saveOrders(seasonId: string, orders: Orders): Promise<void> {
    const rec = this.mustFind(seasonId);
    this.requireOpen(rec, orders.tide);
    rec.orders.set(ordersKey(orders.tide, orders.captainId), clone(orders));
  }

  async applyPortChange(change: PortChange): Promise<void> {
    const rec = this.mustFind(change.seasonId);
    this.requireOpen(rec, change.tide);
    const id = change.captain.id;
    if (rec.versions.get(id) !== change.expectedVersion) throw new ApiError("Your ship changed. Please try again.", 409);
    const rows = rec.snapshot.market;
    let index = -1;
    if (change.market) {
      const { before } = change.market;
      index = rows.findIndex((r) => r.portId === before.portId && r.good === before.good);
      const now = rows[index];
      if (!now || now.drift !== before.drift || now.soldThisTide !== before.soldThisTide) {
        throw new ApiError("The market moved. Please try again.", 409);
      }
    }
    const s = rec.snapshot;
    s.captains = s.captains.map((c) => (c.id === id ? clone(change.captain) : c));
    s.ships = s.ships.map((x) => (x.captainId === id ? clone(change.ship) : x));
    if (change.market) rows[index] = clone(change.market.after);
    rec.versions.set(id, change.expectedVersion + 1);
    this.transactions.push({ ...clone(change.transaction), id: `txn-${this.transactions.length + 1}` });
  }

  async readyCount(seasonId: string, tide: number): Promise<{ active: number; ready: number }> {
    const rec = this.mustFind(seasonId);
    const active = rec.snapshot.captains.filter((c) => c.status === "active");
    return { active: active.length, ready: active.filter((c) => rec.orders.get(ordersKey(tide, c.id))?.ready).length };
  }

  async claimTide(seasonId: string, tide: number): Promise<boolean> {
    const rec = this.mustFind(seasonId);
    if (rec.tide.number !== tide || rec.tide.status !== "open") return false;
    rec.tide.status = "resolving";
    return true;
  }

  async loadTideState(seasonId: string): Promise<TideState> {
    const rec = this.mustFind(seasonId);
    const orders = [...rec.orders.values()].filter((o) => o.tide === rec.tide.number);
    return clone({ snapshot: rec.snapshot, orders });
  }

  async applyTideResult({ seasonId, result, resolvedAt, next }: ApplyTideArgs): Promise<void> {
    const rec = this.mustFind(seasonId);
    if (rec.tide.number !== result.tide || rec.tide.status !== "resolving") throw new ApiError("That Tide is not being resolved", 409);
    rec.snapshot = clone(result.next);
    for (const c of rec.snapshot.captains) rec.versions.set(c.id, (rec.versions.get(c.id) ?? 0) + 1);
    this.battles.push(...clone(result.battles));
    this.log.push(...clone(result.log));
    this.gazettes.set(result.tide, clone(result.gazette));
    this.results.push(clone(result));
    rec.lastResolvedAt = resolvedAt;
    if (next) {
      rec.tide = { seasonId, number: result.next.tide, status: "open", dueAt: next.dueAt, seed: next.seed };
    } else {
      rec.tide.status = "resolved";
      rec.info.status = "ended";
    }
  }

  async failTide(seasonId: string, tide: number, message: string): Promise<void> {
    const rec = this.mustFind(seasonId);
    if (rec.tide.number === tide && rec.tide.status === "resolving") rec.tide.status = "failed";
    this.failures.push(message);
  }

  async createSeason({ season, snapshot, dueAt, seed }: CreateSeasonArgs): Promise<void> {
    if (this.seasons.has(season.id)) throw new ApiError("That season already exists", 409);
    this.seasons.set(season.id, {
      info: clone({ ...season, status: "active" }),
      tide: { seasonId: season.id, number: snapshot.tide, status: "open", dueAt, seed },
      lastResolvedAt: null, snapshot: clone(snapshot),
      versions: new Map(snapshot.captains.map((c) => [c.id, 0])), orders: new Map(),
    });
  }
}
