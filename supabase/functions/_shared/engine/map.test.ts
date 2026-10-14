import { describe, expect, it } from "vitest";
import brineJson from "../maps/brine.json";
import { hopsFrom, loadMap } from "./map.ts";

const brine = loadMap(brineJson);
const ports = brine.nodeIds.filter((id) => brine.node(id).type === "port");

describe("the Brine (section 4.2)", () => {
  it("has 36 nodes with the right mix", () => {
    const count = (type: string) => brine.nodeIds.filter((id) => brine.node(id).type === type).length;
    expect(brine.nodeIds).toHaveLength(36);
    expect(count("port")).toBe(6);
    expect(count("sea")).toBe(16);
    expect(count("island")).toBe(8);
    expect(count("wreck")).toBe(5);
    expect(count("fort")).toBe(1);
  });

  it("has the six named ports", () => {
    expect(ports).toEqual(["driftwood_key", "gullrock", "last_lantern", "port_regal", "rumhaven", "saint_brine"]);
  });

  it("puts only the two Crown ports in Crown Waters and Last Lantern on the Maw edge", () => {
    const zoneOf = (id: string) => brine.node(id).zone;
    expect(zoneOf("port_regal")).toBe("crown");
    expect(zoneOf("saint_brine")).toBe("crown");
    expect(zoneOf("last_lantern")).toBe("maw");
    for (const id of ["rumhaven", "gullrock", "driftwood_key"]) expect(zoneOf(id)).toBe("free");
  });

  it("places every port 2 to 4 hops from its nearest port", () => {
    for (const port of ports) {
      const dist = hopsFrom(brine, port);
      const nearest = Math.min(...ports.filter((p) => p !== port).map((p) => dist.get(p)!));
      expect(nearest, port).toBeGreaterThanOrEqual(2);
      expect(nearest, port).toBeLessThanOrEqual(4);
    }
  });

  it("is connected, with no dead ends and no crowded junctions", () => {
    expect(hopsFrom(brine, "port_regal").size).toBe(36);
    for (const id of brine.nodeIds) {
      expect(brine.neighbours(id).length, id).toBeGreaterThanOrEqual(2);
      expect(brine.neighbours(id).length, id).toBeLessThanOrEqual(6);
    }
  });

  it("lists neighbours in sorted order and lanes work both ways", () => {
    for (const id of brine.nodeIds) {
      const list = brine.neighbours(id);
      expect([...list].sort()).toEqual(list);
      for (const other of list) expect(brine.adjacent(other, id)).toBe(true);
    }
  });
});

describe("loadMap validation", () => {
  const node = (id: string) => ({ id, name: id, type: "sea", zone: "free", x: 0, y: 0 });
  const map = (nodes: unknown[], lanes: unknown[]) => ({ id: "t", name: "t", nodes, lanes });

  it("accepts a tiny map", () => {
    const m = loadMap(map([node("a"), node("b")], [["a", "b"]]));
    expect(m.neighbours("a")).toEqual(["b"]);
  });

  it.each([
    ["duplicate node", map([node("a"), node("a")], [])],
    ["unknown lane end", map([node("a")], [["a", "z"]])],
    ["self lane", map([node("a"), node("b")], [["a", "a"], ["a", "b"]])],
    ["duplicate lane", map([node("a"), node("b")], [["a", "b"], ["b", "a"]])],
    ["disconnected map", map([node("a"), node("b"), node("c")], [["a", "b"]])],
    ["bad node type", map([{ ...node("a"), type: "lake" }], [])],
    ["bad zone", map([{ ...node("a"), zone: "mars" }], [])],
    ["missing coordinates", map([{ ...node("a"), x: undefined }], [])],
    ["not a map at all", { nodes: 5 }],
  ])("rejects %s", (_, raw) => {
    expect(() => loadMap(raw)).toThrow();
  });

  it("throws for an unknown node lookup", () => {
    expect(() => brine.node("atlantis")).toThrow();
    expect(() => brine.neighbours("atlantis")).toThrow();
  });
});
