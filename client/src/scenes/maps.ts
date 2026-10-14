import { loadMap, type GameMap } from "@engine/map.ts";
import brine from "../../../supabase/functions/_shared/maps/brine.json";

// Maps by the `map_id` stored on a season. Season 0 only has the Brine.
const MAPS: Record<string, GameMap> = { brine: loadMap(brine) };

export const DEFAULT_MAP_ID = "brine";

export function mapById(id: string): GameMap {
  const map = MAPS[id];
  if (!map) throw new Error(`Unknown map "${id}"`);
  return map;
}
