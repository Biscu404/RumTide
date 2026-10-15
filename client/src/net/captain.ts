import type { SupabaseClient } from "@supabase/supabase-js";
import type { Captain, MarketRow, Orders, SeasonSettings, Ship } from "@engine/types.ts";
import { captainFromRow, marketFromRow, ordersFromRow, shipFromRow, type Row } from "./rows.ts";

export interface Rival { id: string; shipName: string; fleetId: string | null }

/** Everything the Orders and Port screens need about the player's own captain. */
export interface Me {
  captain: Captain;
  ship: Ship;
  tide: { number: number; status: string; dueAt: string; boomPortId: string | null };
  settings: SeasonSettings;
  /** The orders already saved for the open Tide, or null. */
  orders: Orders | null;
  /** The market rows at the ship's node. Empty at sea. */
  market: MarketRow[];
  /** Every other captain in the season, for hunt targets and escorts. */
  others: Rival[];
}

function rows(what: string, result: { data: unknown; error: { message: string } | null }): Row[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as Row[];
}

/**
 * Reads the player's captain, ship, open Tide, saved orders and the market where they are docked.
 * Read only: what a player may read is decided by row level security, and every change goes through
 * the Edge Functions. Returns null when the player has no captain in the season.
 */
export async function loadMe(client: SupabaseClient, userId: string, seasonId: string, tideNumber: number): Promise<Me | null> {
  const [captains, season, tides, others] = await Promise.all([
    client.from("captains").select("*").eq("season_id", seasonId).eq("user_id", userId),
    client.from("seasons").select("settings").eq("id", seasonId).single(),
    client.from("public_tides").select("number, status, due_at, boom_port_id").eq("season_id", seasonId).eq("number", tideNumber),
    client.from("public_captains").select("id, ship_name, fleet_id").eq("season_id", seasonId),
  ]);
  const captainRow = rows("captain", captains)[0];
  if (!captainRow) return null;
  const captain = captainFromRow(captainRow);
  const tideRow = rows("tide", tides)[0];
  if (!tideRow || season.error || !season.data) throw new Error(`season: ${season.error?.message ?? "not found"}`);

  const ships = rows("ship", await client.from("ships").select("*").eq("captain_id", captain.id));
  if (!ships[0]) throw new Error("ship: not found");
  const ship = shipFromRow(ships[0]);

  const [orderRows, marketRows] = await Promise.all([
    client.from("orders").select("*").eq("season_id", seasonId).eq("tide", tideNumber).eq("captain_id", captain.id),
    ship.docked
      ? client.from("market").select("*").eq("season_id", seasonId).eq("port_id", ship.nodeId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const orders = rows("orders", orderRows)[0];

  return {
    captain, ship,
    tide: {
      number: Number(tideRow.number), status: String(tideRow.status), dueAt: new Date(String(tideRow.due_at)).toISOString(),
      boomPortId: tideRow.boom_port_id ? String(tideRow.boom_port_id) : null,
    },
    settings: season.data.settings as SeasonSettings,
    orders: orders ? ordersFromRow(orders) : null,
    market: rows("market", marketRows).map(marketFromRow),
    others: rows("captains", others)
      .filter((r) => String(r.id) !== captain.id)
      .map((r): Rival => ({ id: String(r.id), shipName: String(r.ship_name), fleetId: r.fleet_id ? String(r.fleet_id) : null })),
  };
}
