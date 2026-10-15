import type { SupabaseClient } from "@supabase/supabase-js";
import type { Battle, Gazette, NpcKind } from "@engine/types.ts";
import { battleFromRow, type Row } from "./rows.ts";

/** Everything the Gazette screen shows for one Tide. */
export interface TideReport {
  tide: number;
  /** Null when the Tide has no Gazette yet. */
  gazette: Gazette | null;
  battles: Battle[];
  /** Lines only this captain (or their fleet) may read. */
  ownLog: string[];
  captainNames: Record<string, string>;
  /** Each captain's Parting Shot, for the winner's line in the replay. Empty for captains who wrote none. */
  partingShots: Record<string, string>;
  npcKinds: Record<string, NpcKind>;
}

function rows(what: string, result: { data: unknown; error: { message: string } | null }): Row[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as Row[];
}

/** The numbers of the Tides that have a Gazette, newest first. */
export async function loadResolvedTides(client: SupabaseClient, seasonId: string): Promise<number[]> {
  const result = await client.from("public_tides").select("number")
    .eq("season_id", seasonId).eq("status", "resolved").order("number", { ascending: false });
  return rows("tides", result).map((r) => Number(r.number));
}

/**
 * Reads one resolved Tide: its headlines, its battles and the lines meant for this player.
 * Read only. Row level security keeps other captains' private lines out, and the Tide seed is
 * not in `public_tides`.
 */
export async function loadTideReport(client: SupabaseClient, seasonId: string, tide: number): Promise<TideReport> {
  const [tides, battles, captains, npcs, log] = await Promise.all([
    client.from("public_tides").select("gazette").eq("season_id", seasonId).eq("number", tide),
    client.from("battles").select("*").eq("season_id", seasonId).eq("tide", tide).order("id"),
    client.from("public_captains").select("id, ship_name, parting_shot").eq("season_id", seasonId),
    client.from("public_npcs").select("id, kind").eq("season_id", seasonId),
    client.from("log_events").select("id, text").eq("season_id", seasonId).eq("tide", tide).neq("visibility", "public").order("id"),
  ]);
  const gazette = rows("tide", tides)[0]?.gazette as Gazette | null | undefined;
  return {
    tide,
    gazette: gazette ?? null,
    battles: rows("battles", battles).map(battleFromRow),
    ownLog: rows("log", log).map((r) => String(r.text)),
    captainNames: Object.fromEntries(rows("captains", captains).map((r) => [String(r.id), String(r.ship_name)])),
    partingShots: Object.fromEntries(rows("captains", captains).map((r) => [String(r.id), String(r.parting_shot ?? "")])),
    npcKinds: Object.fromEntries(rows("npcs", npcs).map((r) => [String(r.id), r.kind as NpcKind])),
  };
}
