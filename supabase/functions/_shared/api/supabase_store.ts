// The GameStore for the real database: reads are plain selects with the service role, writes go
// through the Postgres functions in migrations/0002 so each one is a single transaction.
// Not run by the tests (they use memory_store.ts); migrations/ and this file are checked together
// by running a season against a real Supabase project.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TideSnapshot } from "../engine/season.ts";
import type { Captain, MarketRow, Npc, Orders, Ship } from "../engine/types.ts";
import {
  ApiError, type ActiveSeason, type ApplyTideArgs, type CaptainView, type CreateSeasonArgs, type GameStore,
  type PortChange, type SeasonInfo, type TideInfo, type TideState,
} from "./store.ts";

type Row = Record<string, unknown>;

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** A table row as an engine object: snake_case keys become camelCase. Nested JSON columns are left alone. */
function fromRow<T>(row: Row): T {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v])) as T;
}

const iso = (t: unknown) => new Date(String(t)).toISOString();

/** Postgres raised RT409 (see migrations/0002): a rule or a race, not a bug. */
const CONFLICT = "RT409";

/** Unwrap a Supabase answer, turning database errors into ApiErrors the caller can send on. */
function unwrap<T>(answer: { data: T; error: { code?: string; message: string } | null }): T {
  if (answer.error) {
    if (answer.error.code === CONFLICT) throw new ApiError(answer.error.message, 409);
    // 23505 is a unique violation, such as a second active season.
    if (answer.error.code === "23505") throw new ApiError("That already exists", 409);
    throw new Error(`Database error: ${answer.error.message}`);
  }
  return answer.data;
}

function seasonInfo(row: Row): SeasonInfo {
  const r = fromRow<Row & { settings: SeasonInfo["settings"] }>(row);
  return {
    id: String(r.id), name: String(r.name), status: r.status as SeasonInfo["status"], mapId: String(r.mapId),
    timezone: String(r.timezone), tideTimeLocal: String(r.tideTimeLocal), lengthTides: Number(r.lengthTides),
    settings: r.settings,
  };
}

function tideInfo(row: Row): TideInfo {
  return {
    seasonId: String(row.season_id), number: Number(row.number), status: row.status as TideInfo["status"],
    dueAt: iso(row.due_at), seed: Number(row.seed),
  };
}

const captainOf = (row: Row): Captain => {
  const { version: _version, ...rest } = fromRow<Captain & { version: number }>(row);
  return rest;
};

const ordersOf = (row: Row): Orders => ({
  tide: Number(row.tide), captainId: String(row.captain_id), course: row.course as string[],
  intent: row.intent as Orders["intent"],
  ...(row.hunt_filter ? { huntFilter: row.hunt_filter as Orders["huntFilter"] } : {}),
  ...(row.escort_captain_id ? { escortCaptainId: String(row.escort_captain_id) } : {}),
  plan: row.plan as Orders["plan"], parley: row.parley as Orders["parley"],
  noQuarter: Boolean(row.no_quarter), ready: Boolean(row.ready),
});

export class SupabaseStore implements GameStore {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  private async tideRow(seasonId: string, number?: number): Promise<Row> {
    const q = this.db.from("tides").select("*").eq("season_id", seasonId);
    const answer = number === undefined
      ? await q.order("number", { ascending: false }).limit(1).single()
      : await q.eq("number", number).single();
    return unwrap(answer) as Row;
  }

  async activeSeason(): Promise<ActiveSeason | null> {
    const season = unwrap(await this.db.from("seasons").select("*").eq("status", "active").maybeSingle()) as Row | null;
    if (!season) return null;
    const id = String(season.id);
    const tide = tideInfo(await this.tideRow(id));
    const last = unwrap(await this.db.from("tides").select("resolved_at").eq("season_id", id)
      .not("resolved_at", "is", null).order("number", { ascending: false }).limit(1).maybeSingle()) as Row | null;
    return { season: seasonInfo(season), tide, lastResolvedAt: last ? iso(last.resolved_at) : null };
  }

  async captainView(userId: string): Promise<CaptainView | null> {
    const active = await this.activeSeason();
    if (!active) return null;
    const seasonId = active.season.id;
    const row = unwrap(await this.db.from("captains").select("*").eq("season_id", seasonId).eq("user_id", userId).maybeSingle()) as Row | null;
    if (!row) return null;
    const captain = captainOf(row);
    const ship = fromRow<Ship>(unwrap(await this.db.from("ships").select("*").eq("captain_id", captain.id).single()) as Row);
    const market = (unwrap(await this.db.from("market").select("*").eq("season_id", seasonId).eq("port_id", ship.nodeId)) as Row[])
      .map((r) => fromRow<MarketRow>(r));
    const roster = (unwrap(await this.db.from("captains").select("id, fleet_id").eq("season_id", seasonId).order("id")) as Row[])
      .map((r) => ({ id: String(r.id), fleetId: (r.fleet_id as string | null) ?? null }));
    const tide = await this.tideRow(seasonId, active.tide.number);
    return {
      active, boomPortId: (tide.boom_port_id as string | null) ?? null, captain, ship,
      version: Number(row.version), market, roster,
    };
  }

  async saveOrders(seasonId: string, orders: Orders): Promise<void> {
    unwrap(await this.db.rpc("save_orders", { p_season: seasonId, p_orders: orders }));
  }

  async applyPortChange(change: PortChange): Promise<void> {
    unwrap(await this.db.rpc("apply_port_change", { p_args: change }));
  }

  async readyCount(seasonId: string, tide: number): Promise<{ active: number; ready: number }> {
    const active = (unwrap(await this.db.from("captains").select("id").eq("season_id", seasonId).eq("status", "active")) as Row[])
      .map((r) => String(r.id));
    const ready = new Set((unwrap(await this.db.from("orders").select("captain_id").eq("season_id", seasonId).eq("tide", tide).eq("ready", true)) as Row[])
      .map((r) => String(r.captain_id)));
    return { active: active.length, ready: active.filter((id) => ready.has(id)).length };
  }

  async claimTide(seasonId: string, tide: number): Promise<boolean> {
    return unwrap(await this.db.rpc("claim_tide", { p_season: seasonId, p_tide: tide })) === true;
  }

  async loadTideState(seasonId: string): Promise<TideState> {
    const season = seasonInfo(unwrap(await this.db.from("seasons").select("*").eq("id", seasonId).single()) as Row);
    const tide = await this.tideRow(seasonId);
    const number = Number(tide.number);
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

    const captains = (unwrap(await this.db.from("captains").select("*").eq("season_id", seasonId)) as Row[]).map(captainOf).sort(byId);
    const ids = captains.map((c) => c.id);
    const ships = (unwrap(await this.db.from("ships").select("*").in("captain_id", ids)) as Row[])
      .map((r) => fromRow<Ship>(r)).sort((a, b) => (a.captainId < b.captainId ? -1 : 1));
    const npcs = (unwrap(await this.db.from("npcs").select("*").eq("season_id", seasonId).eq("spawned_tide", number)) as Row[])
      .map((r) => fromRow<Npc>(r)).sort(byId);
    const market = (unwrap(await this.db.from("market").select("*").eq("season_id", seasonId)) as Row[])
      .map((r) => fromRow<MarketRow>(r))
      .sort((a, b) => (a.portId < b.portId ? -1 : a.portId > b.portId ? 1 : a.good < b.good ? -1 : 1));
    const orders = (unwrap(await this.db.from("orders").select("*").eq("season_id", seasonId).eq("tide", number)) as Row[]).map(ordersOf);

    const snapshot: TideSnapshot = {
      seasonId, settings: season.settings, lengthTides: season.lengthTides, tide: number,
      captains, ships, npcs, market, boomPortId: (tide.boom_port_id as string | null) ?? null,
    };
    return { snapshot, orders };
  }

  async applyTideResult(args: ApplyTideArgs): Promise<void> {
    unwrap(await this.db.rpc("apply_tide_result", { p_args: args }));
  }

  async failTide(seasonId: string, tide: number, message: string): Promise<void> {
    unwrap(await this.db.rpc("fail_tide", { p_season: seasonId, p_tide: tide, p_error: message }));
  }

  async createSeason(args: CreateSeasonArgs): Promise<void> {
    unwrap(await this.db.rpc("create_season", { p_args: args }));
  }
}
