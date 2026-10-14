// Seeded random numbers (mulberry32). The only source of randomness in the engine.
// The same seed always gives the same sequence, so any Tide can be replayed exactly.

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** A float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** One element of a non empty list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (Fisher Yates). The input is not changed. */
  shuffle<T>(items: readonly T[]): T[];
}

export function createRng(seed: number): Rng {
  let state = seed | 0;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(`Rng.int needs a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  return {
    next,
    int,
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (items) => {
      if (items.length === 0) throw new RangeError("Rng.pick needs a non empty list");
      return items[int(items.length)]!;
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}
