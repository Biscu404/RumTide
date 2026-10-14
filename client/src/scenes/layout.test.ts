import { describe, expect, it } from "vitest";
import { loadMap } from "@engine/map.ts";
import brine from "../../../supabase/functions/_shared/maps/brine.json";
import { fitZoom, nodePoint, placeShips, sailColour, worldSize, WORLD_MARGIN, WORLD_UNIT, type ShipMarker } from "./layout.ts";

const map = loadMap(brine);

const ship = (captainId: string, nodeId: string): ShipMarker => ({
  captainId, shipName: captainId, nodeId, docked: false, hull: "sloop", hullPoints: 10, isMine: false,
});

describe("MapScene layout", () => {
  it("places a node from its map position", () => {
    const regal = map.node("port_regal");
    expect(nodePoint(map, "port_regal")).toEqual({
      x: WORLD_MARGIN + regal.x * WORLD_UNIT,
      y: WORLD_MARGIN + regal.y * WORLD_UNIT,
    });
  });

  it("makes a world that holds every node with a margin", () => {
    const world = worldSize(map);
    for (const id of map.nodeIds) {
      const p = nodePoint(map, id);
      expect(p.x).toBeLessThanOrEqual(world.width - WORLD_MARGIN);
      expect(p.y).toBeLessThanOrEqual(world.height - WORLD_MARGIN);
    }
  });

  it("fits the world to the smaller side of the view", () => {
    expect(fitZoom(500, 1000, { width: 1000, height: 1000 })).toBe(0.5);
    expect(fitZoom(2000, 500, { width: 1000, height: 1000 })).toBe(0.5);
  });

  it("puts a lone ship on its node and spreads shared nodes on a ring", () => {
    const [alone] = placeShips(map, [ship("a", "port_regal")]);
    expect(alone).toMatchObject(nodePoint(map, "port_regal"));

    const pair = placeShips(map, [ship("b", "port_regal"), ship("a", "port_regal")]);
    expect(pair.map((s) => s.captainId)).toEqual(["a", "b"]);
    expect(pair[0]).not.toMatchObject({ x: pair[1]!.x, y: pair[1]!.y });
  });

  it("drops ships on nodes the map does not have", () => {
    expect(placeShips(map, [ship("a", "nowhere")])).toEqual([]);
  });

  it("gives the same sail colour to the same name", () => {
    expect(sailColour("Black Pearl")).toBe(sailColour("Black Pearl"));
  });
});
