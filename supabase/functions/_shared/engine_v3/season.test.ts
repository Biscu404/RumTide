import { describe, expect, it } from "vitest";
import { B, TEMPLATE_NAMES, doctrineSlots, newSeason, templateDoctrine, validateDoctrines } from "./index.ts";
import { season, world } from "./testing.ts";

describe("new captains and seasons (P2.4)", () => {
  it("gives every captain the Boarder template as their only doctrine, the Brawler's successor", () => {
    const state = season([
      { id: "a", name: "A", shipName: "Gull" },
      { id: "m", name: "M", shipName: "Biscuit", kind: "npc", npcRole: "merchant" },
    ]);
    for (const c of Object.values(state.captains)) {
      expect(c.doctrines).toEqual([templateDoctrine("Boarder")]);
      expect(c.defaultDoctrine).toBe("Boarder");
      expect(validateDoctrines(c.doctrines, { slots: doctrineSlots(c) })).toEqual([]);
    }
    expect(TEMPLATE_NAMES).toContain(state.captains.a!.defaultDoctrine);
  });

  it("starts with no parley, no No Quarter, no bounty and no boss beaten", () => {
    const c = season([{ id: "a", name: "A", shipName: "Gull" }]).captains.a!;
    expect(c).toMatchObject({ parley: "off", noQuarter: false, bounty: 0, bossesBeaten: [] });
  });

  it("gives each captain their own copy of the doctrine", () => {
    const state = season([{ id: "a", name: "A", shipName: "Gull" }, { id: "b", name: "B", shipName: "Sock" }]);
    state.captains.a!.doctrines[0]!.name = "Edited";
    expect(state.captains.b!.doctrines[0]!.name).toBe("Boarder");
  });

  it("starts a season with no Wrecks and no Flotsam", () => {
    const state = newSeason({ seasonId: "s", preset: "season0", seed: 1, world, captains: [{ id: "a", name: "A", shipName: "Gull" }] });
    expect(state.wrecks).toEqual({});
    expect(state.flotsam).toEqual({});
    expect(B.combat.doctrine.savedDoctrines).toBeGreaterThanOrEqual(state.captains.a!.doctrines.length);
  });
});
