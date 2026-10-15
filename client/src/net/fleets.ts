import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fleet, FleetInvite, FleetMember, Orders } from "@engine/types.ts";
import { fleetFromRow, fleetInviteFromRow, fleetMemberFromRow, ordersFromRow, type Row } from "./rows.ts";

/** Every fleet in the season, who is in it, and what this captain is allowed to see of it. */
export interface FleetsState {
  fleets: Fleet[];
  members: FleetMember[];
  /** Only the invitations row level security shows this captain: the ones for them and the ones their fleet sent. */
  invites: FleetInvite[];
  /** Fleet mates' orders for the open Tide (section 8.1: nobody else sees them). Not including the captain's own. */
  mateOrders: Orders[];
}

export const NO_FLEETS: FleetsState = { fleets: [], members: [], invites: [], mateOrders: [] };

function rows(what: string, result: { data: unknown; error: { message: string } | null }): Row[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as Row[];
}

/**
 * Reads the fleets of the season. Read only: fleets change through the fleet_action function. Fleets,
 * their members and the date a member leaves are public, so anyone can see a notice to leave.
 */
export async function loadFleets(
  client: SupabaseClient, seasonId: string, tideNumber: number, myCaptainId: string,
): Promise<FleetsState> {
  const [fleetRows, inviteRows, orderRows] = await Promise.all([
    client.from("fleets").select("*").eq("season_id", seasonId).order("id"),
    client.from("fleet_invites").select("*").eq("season_id", seasonId).order("fleet_id"),
    client.from("orders").select("*").eq("season_id", seasonId).eq("tide", tideNumber).neq("captain_id", myCaptainId),
  ]);
  const fleets = rows("fleets", fleetRows).map(fleetFromRow);
  const memberRows = fleets.length === 0
    ? []
    : rows("fleet members", await client.from("fleet_members").select("*").in("fleet_id", fleets.map((f) => f.id)));
  return {
    fleets,
    members: memberRows.map(fleetMemberFromRow),
    invites: rows("invitations", inviteRows).map(fleetInviteFromRow),
    mateOrders: rows("orders", orderRows).map(ordersFromRow),
  };
}
