import { describe, expect, it } from "vitest";
import { RECIPES, duration, type SoundName } from "./recipes.ts";

const names = Object.keys(RECIPES) as SoundName[];

describe("sound recipes", () => {
  it("has a recipe for every sound the game plays", () => {
    expect(names.sort()).toEqual(["brass", "cannon", "coin", "drumRoll", "jingle", "splash", "struck"]);
  });

  for (const name of names) {
    it(`${name} is made of voices that Web Audio accepts`, () => {
      expect(RECIPES[name].length).toBeGreaterThan(0);
      for (const v of RECIPES[name]) {
        expect(v.at).toBeGreaterThanOrEqual(0);
        expect(v.length).toBeGreaterThan(0);
        // Pitches and cutoffs are ramped exponentially, which needs positive numbers.
        expect(v.from).toBeGreaterThan(0);
        if (v.to !== undefined) expect(v.to).toBeGreaterThan(0);
        // Loud enough to hear, never loud enough to clip alone.
        expect(v.gain).toBeGreaterThan(0);
        expect(v.gain).toBeLessThanOrEqual(0.6);
        expect(v.attack ?? 0.005).toBeLessThan(v.length);
        // The noise buffer is one second long, and a noise voice reads it once.
        if (v.wave === "noise") expect(v.length).toBeLessThanOrEqual(1);
      }
    });
  }

  it("keeps the quick sounds quick and the Tide jingle about 3 seconds long (section 2.3)", () => {
    expect(duration("coin")).toBeLessThan(0.6);
    expect(duration("cannon")).toBeLessThan(1);
    expect(duration("jingle")).toBeGreaterThanOrEqual(2.5);
    expect(duration("jingle")).toBeLessThanOrEqual(3.2);
  });

  it("builds the drum roll to finish before the plans are revealed, and gets louder as it goes", () => {
    const hits = RECIPES.drumRoll;
    expect(duration("drumRoll")).toBeLessThan(0.7);
    const gains = hits.map((h) => h.gain);
    expect(gains).toEqual([...gains].sort((a, b) => a - b));
  });
});
