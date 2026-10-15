import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegendRow } from "../ui/legendModel.ts";

/**
 * Every captain's Legend, from `public_captains` (section 15.4: Legend, bounty and fleet are public,
 * Chest and cargo are not). Read only.
 */
export async function loadLegend(client: SupabaseClient, seasonId: string): Promise<LegendRow[]> {
  const result = await client.from("public_captains")
    .select("id, ship_name, legend, bounty, fleet_id, status").eq("season_id", seasonId);
  if (result.error) throw new Error(`Legend: ${result.error.message}`);
  return ((result.data ?? []) as Record<string, unknown>[]).map((r): LegendRow => ({
    id: String(r.id), shipName: String(r.ship_name), legend: Number(r.legend), bounty: Number(r.bounty),
    fleetId: r.fleet_id ? String(r.fleet_id) : null, status: r.status === "ashore" ? "ashore" : "active",
  }));
}
