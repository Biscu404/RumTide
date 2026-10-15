import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipMarker } from "../scenes/layout.ts";

export type SeasonStatus = "active" | "ended";

export interface SeasonInfo {
  id: string; name: string; mapId: string; currentTide: number; lengthTides: number;
  /** An ended season is shown read only: orders are closed, the Gazette and Legend stay open. */
  status: SeasonStatus;
  /** The status of the season's current Tide, so the screen can tell a finished season from one stopped early. */
  tideStatus: string | null;
}

export interface World {
  season: SeasonInfo | null;
  ships: ShipMarker[];
}

interface SeasonRow { id: string; name: string; map_id: string; current_tide: number; length_tides: number; status: string; created_at: string }
interface CaptainRow { id: string; ship_name: string; fleet_id?: string | null; user_id?: string }
interface ShipRow { captain_id: string; node_id: string; docked: boolean; hull: string; hull_points: number }

function fail<T>(what: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/**
 * The season the app shows: the running one, or when none is running the most recent one that ended.
 * A draft never started, so it is never shown. At most one season is active (a unique index), so
 * "active first" and "newest first" only disagree if an older season is still running.
 */
export function pickSeason<T extends { status: string; created_at: string }>(rows: readonly T[]): T | null {
  const shown = rows.filter((r) => r.status === "active" || r.status === "ended");
  const active = shown.find((r) => r.status === "active");
  if (active) return active;
  const newestFirst = [...shown].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return newestFirst[0] ?? null;
}

/**
 * Reads the season to show and where every ship is. Read only: the client never writes game tables.
 * Row level security does not look at a season's status, so an ended season reads like a running one.
 */
export async function loadWorld(client: SupabaseClient, userId: string): Promise<World> {
  const seasons = fail("seasons", await client
    .from("seasons")
    .select("id, name, map_id, current_tide, length_tides, status, created_at")
    .in("status", ["active", "ended"])
    .order("created_at", { ascending: false })
    .limit(20)) as SeasonRow[];
  const row = pickSeason(seasons);
  if (!row) return { season: null, ships: [] };

  const [captains, mine, tide] = await Promise.all([
    client.from("public_captains").select("id, ship_name, fleet_id").eq("season_id", row.id),
    client.from("captains").select("id").eq("season_id", row.id).eq("user_id", userId),
    client.from("public_tides").select("status").eq("season_id", row.id).eq("number", row.current_tide),
  ]);
  const season: SeasonInfo = {
    id: row.id, name: row.name, mapId: row.map_id, currentTide: row.current_tide, lengthTides: row.length_tides,
    status: row.status === "ended" ? "ended" : "active",
    tideStatus: ((fail("tide", tide) as { status: string }[])[0]?.status) ?? null,
  };
  const captainRows = fail("captains", captains) as CaptainRow[];
  const myIds = new Set((fail("my captain", mine) as CaptainRow[]).map((c) => c.id));
  if (captainRows.length === 0) return { season, ships: [] };

  const shipRows = fail("ships", await client
    .from("public_ships")
    .select("captain_id, node_id, docked, hull, hull_points")
    .in("captain_id", captainRows.map((c) => c.id))) as ShipRow[];

  const names = new Map(captainRows.map((c) => [c.id, c.ship_name]));
  const fleets = new Map(captainRows.map((c) => [c.id, c.fleet_id ?? null]));
  const ships = shipRows.map((s): ShipMarker => ({
    captainId: s.captain_id,
    shipName: names.get(s.captain_id) ?? "Unknown ship",
    nodeId: s.node_id,
    docked: s.docked,
    hull: s.hull,
    hullPoints: s.hull_points,
    isMine: myIds.has(s.captain_id),
    fleetId: fleets.get(s.captain_id) ?? null,
  }));
  return { season, ships };
}
