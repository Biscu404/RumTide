import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadWorld, pickSeason } from "./world.ts";

type Row = Record<string, unknown>;

/**
 * Just enough of the Supabase query builder for loadWorld: it filters and sorts the rows it was given
 * and records which tables were read. It does not model row level security. That is checked by
 * reading the policies, which never look at a season's status (supabase/migrations/20261014000003).
 */
function fakeClient(tables: Record<string, Row[]>) {
  const reads: string[] = [];
  const client = {
    from(table: string) {
      reads.push(table);
      let rows = [...(tables[table] ?? [])];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { rows = rows.filter((r) => r[column] === value); return query; },
        in: (column: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[column])); return query; },
        order: (column: string, options?: { ascending?: boolean }) => {
          const sign = options?.ascending === false ? -1 : 1;
          rows.sort((a, b) => sign * String(a[column]).localeCompare(String(b[column])));
          return query;
        },
        limit: (count: number) => { rows = rows.slice(0, count); return query; },
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: rows, error: null }),
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, reads };
}

const season = (id: string, status: string, created: string, extra: Row = {}): Row => ({
  id, name: `Season ${id}`, map_id: "brine", current_tide: 14, length_tides: 14, status, created_at: created, ...extra,
});

describe("pickSeason", () => {
  const draft = season("d", "draft", "2026-11-01T00:00:00Z");
  const old = season("o", "ended", "2026-09-01T00:00:00Z");
  const recent = season("r", "ended", "2026-10-01T00:00:00Z");
  const live = season("a", "active", "2026-10-10T00:00:00Z");
  const pick = (rows: Row[]) => pickSeason(rows as { id: string; status: string; created_at: string }[])?.id ?? null;

  it("shows nothing when there is no season, or only a draft", () => {
    expect(pick([])).toBeNull();
    expect(pick([draft])).toBeNull();
  });

  it("shows the most recent ended season when none is running", () => {
    expect(pick([old, recent])).toBe("r");
    expect(pick([recent, old, draft])).toBe("r");
  });

  it("prefers the running season over an ended one, whichever is newer", () => {
    expect(pick([old, recent, live])).toBe("a");
    expect(pick([live, season("n", "ended", "2026-12-01T00:00:00Z")])).toBe("a");
  });
});

describe("loadWorld", () => {
  const tables = (seasons: Row[]): Record<string, Row[]> => ({
    seasons,
    public_captains: [
      { id: "c1", season_id: "e", ship_name: "Wet Sock", fleet_id: null },
      { id: "c2", season_id: "e", ship_name: "Black Gull", fleet_id: "f1" },
      { id: "c3", season_id: "a", ship_name: "Other Season", fleet_id: null },
    ],
    captains: [{ id: "c2", season_id: "e", user_id: "me" }, { id: "c3", season_id: "a", user_id: "me" }],
    public_ships: [
      { captain_id: "c1", node_id: "rumhaven", docked: true, hull: "sloop", hull_points: 40 },
      { captain_id: "c2", node_id: "sea03", docked: false, hull: "sloop", hull_points: 22 },
      { captain_id: "c3", node_id: "rumhaven", docked: true, hull: "sloop", hull_points: 50 },
    ],
    public_tides: [
      { season_id: "e", number: 14, status: "resolved" },
      { season_id: "e", number: 13, status: "resolved" },
      { season_id: "a", number: 2, status: "open" },
    ],
  });

  it("returns no season when the database has none", async () => {
    const { client } = fakeClient(tables([]));
    expect(await loadWorld(client, "me")).toEqual({ season: null, ships: [] });
  });

  it("reads an ended season, with its last Tide and every ship where the season left it", async () => {
    const { client } = fakeClient(tables([season("e", "ended", "2026-10-01T00:00:00Z")]));
    const world = await loadWorld(client, "me");
    expect(world.season).toEqual({
      id: "e", name: "Season e", mapId: "brine", currentTide: 14, lengthTides: 14, status: "ended", tideStatus: "resolved",
    });
    expect(world.ships.map((s) => [s.captainId, s.shipName, s.nodeId, s.isMine, s.fleetId])).toEqual([
      ["c1", "Wet Sock", "rumhaven", false, null],
      ["c2", "Black Gull", "sea03", true, "f1"],
    ]);
  });

  it("reads the running season in preference to an ended one", async () => {
    const { client } = fakeClient(tables([
      season("e", "ended", "2026-10-01T00:00:00Z"),
      season("a", "active", "2026-10-10T00:00:00Z", { current_tide: 2 }),
    ]));
    const world = await loadWorld(client, "me");
    expect(world.season).toMatchObject({ id: "a", status: "active", currentTide: 2, tideStatus: "open" });
    expect(world.ships.map((s) => s.captainId)).toEqual(["c3"]);
  });

  it("reads only, never writes", async () => {
    const { client, reads } = fakeClient(tables([season("e", "ended", "2026-10-01T00:00:00Z")]));
    await loadWorld(client, "me");
    expect(new Set(reads)).toEqual(new Set(["seasons", "public_captains", "captains", "public_tides", "public_ships"]));
  });
});
