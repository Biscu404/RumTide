import { describe, expect, it } from "vitest";
import { createRng } from "./rng.ts";

describe("createRng", () => {
  it("matches the mulberry32 reference values for seed 12345", () => {
    const rng = createRng(12345);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([0.9797282677609473, 0.3067522644996643, 0.484205421525985]);
  });

  it("gives the same sequence for the same seed", () => {
    const a = createRng(99), b = createRng(99);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("gives different sequences for different seeds", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("keeps next() inside [0, 1)", () => {
    const rng = createRng(5);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int() stays in range and reaches every value", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(6));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("int() rejects bad limits", () => {
    const rng = createRng(3);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(1.5)).toThrow(RangeError);
  });

  it("range() stays between its bounds, the way combat luck will use it", () => {
    const rng = createRng(8);
    for (let i = 0; i < 1000; i++) {
      const x = rng.range(0.9, 1.1);
      expect(x).toBeGreaterThanOrEqual(0.9);
      expect(x).toBeLessThan(1.1);
    }
  });

  it("is roughly uniform", () => {
    const rng = createRng(21);
    let sum = 0;
    for (let i = 0; i < 20_000; i++) sum += rng.next();
    expect(sum / 20_000).toBeCloseTo(0.5, 1);
  });

  it("pick() returns an element and rejects an empty list", () => {
    const rng = createRng(4);
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("shuffle() is a deterministic permutation that leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = createRng(7).shuffle(input);
    expect(out).toEqual([5, 2, 3, 4, 6, 1]);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
