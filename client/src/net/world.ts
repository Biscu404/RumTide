import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShipMarker } from "../scenes/layout.ts";

export interface SeasonInfo { id: string; name: string; mapId: string; currentTide: number; lengthTides: number }

export interface World {
  season: SeasonInfo | null;
  ships: ShipMarker[];
}

interface SeasonRow { id: string; name: string; map_id: string; current_tide: number; length_tides: number }
interface CaptainRow { id: string; ship_name: string; fleet_id?: string | null; user_id?: string }
interface ShipRow { captain_id: string; node_id: string; docked: boolean; hull: string; hull_points: number }

function fail<T>(what: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/** Reads the active season and where every ship is. Read only: the client never writes game tables. */
export async function loadWorld(client: SupabaseClient, userId: string): Promise<World> {
  const seasons = fail("seasons", await client
    .from("seasons")
    .select("id, name, map_id, current_tide, length_tides")
    .eq("status", "active")
    .limit(1)) as SeasonRow[];
  const row = seasons[0];
  if (!row) return { season: null, ships: [] };

  const season: SeasonInfo = {
    id: row.id, name: row.name, mapId: row.map_id, currentTide: row.current_tide, lengthTides: row.length_tides,
  };

  const [captains, mine] = await Promise.all([
    client.from("public_captains").select("id, ship_name, fleet_id").eq("season_id", season.id),
    client.from("captains").select("id").eq("season_id", season.id).eq("user_id", userId),
  ]);
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
