import type { Battle, Captain, Good, MarketRow, Orders, Ship } from "@engine/types.ts";

// Turns the rows the client may read (snake_case, see supabase/migrations/20261014000003_security.sql)
// into the engine's types, so the Orders and Port screens can use the same functions as the server.
// Read only: the client never writes these tables.

export type Row = Record<string, unknown>;

export function captainFromRow(row: Row): Captain {
  return {
    id: String(row.id), seasonId: String(row.season_id), userId: String(row.user_id),
    shipName: String(row.ship_name), flag: String(row.flag), partingShot: String(row.parting_shot ?? ""),
    legend: Number(row.legend), chestGold: Number(row.chest_gold), bounty: Number(row.bounty),
    shieldUntilTide: row.shield_until_tide === null || row.shield_until_tide === undefined ? null : Number(row.shield_until_tide),
    fleetId: row.fleet_id ? String(row.fleet_id) : null,
    standingPlan: row.standing_plan as Captain["standingPlan"],
    standingParley: row.standing_parley as Captain["standingParley"],
    shoreLeaveTides: Number(row.shore_leave_tides), lastOrdersTide: Number(row.last_orders_tide),
    status: row.status as Captain["status"],
  };
}

export function shipFromRow(row: Row): Ship {
  return {
    captainId: String(row.captain_id), hull: row.hull as Ship["hull"], nodeId: String(row.node_id),
    docked: Boolean(row.docked), hullPoints: Number(row.hull_points), levels: row.levels as Ship["levels"],
    plunderGold: Number(row.plunder_gold), cargo: row.cargo as Ship["cargo"],
    cargoCostBasis: row.cargo_cost_basis as Ship["cargoCostBasis"], shipwrightProgress: Number(row.shipwright_progress),
  };
}

export function ordersFromRow(row: Row): Orders {
  return {
    tide: Number(row.tide), captainId: String(row.captain_id), course: row.course as string[],
    intent: row.intent as Orders["intent"],
    ...(row.hunt_filter ? { huntFilter: row.hunt_filter as Orders["huntFilter"] } : {}),
    ...(row.escort_captain_id ? { escortCaptainId: String(row.escort_captain_id) } : {}),
    plan: row.plan as Orders["plan"], parley: row.parley as Orders["parley"],
    noQuarter: Boolean(row.no_quarter), ready: Boolean(row.ready),
  };
}

export function marketFromRow(row: Row): MarketRow {
  return {
    seasonId: String(row.season_id), portId: String(row.port_id), good: row.good as Good,
    drift: Number(row.drift), soldThisTide: Number(row.sold_this_tide),
  };
}

export function battleFromRow(row: Row): Battle {
  return {
    id: String(row.id), tide: Number(row.tide), nodeId: String(row.node_id),
    sides: row.sides as Battle["sides"], rounds: row.rounds as Battle["rounds"],
    outcome: row.outcome as Battle["outcome"],
    winner: row.winner === null || row.winner === undefined ? null : (Number(row.winner) as 0 | 1),
    loot: row.loot as Battle["loot"], bountiesAdded: row.bounties_added as Battle["bountiesAdded"],
  };
}
