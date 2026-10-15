import type { GameMap } from "@engine/map.ts";
import { C, rgb } from "../palette.ts";

// Pure drawing helpers for MapScene. Map x and y run from 0 to 100 and are for drawing only.
// Nothing here touches Phaser, so it can be unit tested.

export const WORLD_UNIT = 10;
export const WORLD_MARGIN = 110;
/** Ships that share a node sit on a ring around it. */
export const SHIP_RING_RADIUS = 28;

export interface ShipMarker {
  captainId: string;
  shipName: string;
  nodeId: string;
  docked: boolean;
  hull: string;
  hullPoints: number;
  isMine: boolean;
  fleetId?: string | null;
  /** The fleet's sail colour as "#rrggbb", when the ship sails in a fleet (section 8.1). */
  fleetColour?: string;
}

export interface PlacedShip extends ShipMarker { x: number; y: number }

export interface WorldSize { width: number; height: number }

export function nodePoint(map: GameMap, nodeId: string): { x: number; y: number } {
  const node = map.node(nodeId);
  return { x: WORLD_MARGIN + node.x * WORLD_UNIT, y: WORLD_MARGIN + node.y * WORLD_UNIT };
}

export function worldSize(map: GameMap): WorldSize {
  let maxX = 0;
  let maxY = 0;
  for (const id of map.nodeIds) {
    const node = map.node(id);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  return { width: maxX * WORLD_UNIT + WORLD_MARGIN * 2, height: maxY * WORLD_UNIT + WORLD_MARGIN * 2 };
}

/** Below this zoom the marks (nodes, ships, names) are drawn larger, so they stay readable on a phone. */
export const MARKER_FULL_ZOOM = 0.8;
export const MAX_MARKER_BOOST = 2.5;

/** How much larger to draw nodes, ships and names at this camera zoom: 1 when zoomed in, up to 2.5 when zoomed far out. */
export function markerBoost(zoom: number): number {
  if (!(zoom > 0)) return MAX_MARKER_BOOST;
  return Math.min(MAX_MARKER_BOOST, Math.max(1, MARKER_FULL_ZOOM / zoom));
}

/** The zoom at which the whole world fits the view. */
export function fitZoom(viewWidth: number, viewHeight: number, world: WorldSize): number {
  return Math.min(viewWidth / world.width, viewHeight / world.height);
}

/** Ships on unknown nodes are dropped. Ships on one node are spread on a ring, in captain id order. */
export function placeShips(map: GameMap, markers: readonly ShipMarker[]): PlacedShip[] {
  const byNode = new Map<string, ShipMarker[]>();
  for (const marker of markers) {
    if (!map.has(marker.nodeId)) continue;
    const list = byNode.get(marker.nodeId) ?? [];
    list.push(marker);
    byNode.set(marker.nodeId, list);
  }

  const placed: PlacedShip[] = [];
  for (const nodeId of [...byNode.keys()].sort()) {
    const here = byNode.get(nodeId)!.sort((a, b) => (a.captainId < b.captainId ? -1 : a.captainId > b.captainId ? 1 : 0));
    const centre = nodePoint(map, nodeId);
    here.forEach((marker, i) => {
      if (here.length === 1) {
        placed.push({ ...marker, x: centre.x, y: centre.y });
        return;
      }
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / here.length;
      placed.push({
        ...marker,
        x: centre.x + Math.cos(angle) * SHIP_RING_RADIUS,
        y: centre.y + Math.sin(angle) * SHIP_RING_RADIUS,
      });
    });
  }
  return placed;
}

/**
 * Sail colours for captains who are not in a fleet. None of them is a fleet colour (FLEET_COLOURS in
 * the engine) or the gold of your own ship, so a fleet's colour on the map always means that fleet.
 */
export const SAIL_COLOURS = [C.orange, C.rose, C.foam, C.mist, C.blush, C.clay, C.steel, C.parchment].map(rgb);

/** The same name always gets the same sail colour. */
export function sailColour(shipName: string): number {
  let hash = 0;
  for (const ch of shipName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SAIL_COLOURS[hash % SAIL_COLOURS.length]!;
}

/** "#rrggbb" as the number Phaser wants. Anything else is a neutral grey, so a bad colour never breaks the map. */
export function hexColour(hex: string): number {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1), 16) : rgb(C.steel);
}
