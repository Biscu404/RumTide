// Seeded random numbers. The engine never calls Math.random.
//
// Every random decision draws from a NAMED STREAM, derived from a seed plus labels, for example
// rngFor(tideSeed, "survey", shipId, stepIndex). Adding a new random roll somewhere therefore never
// shifts the rolls of any other system, and any single roll can be reproduced on its own.

/** cyrb128: hashes a string into four 32 bit integers. Public domain. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** A 32 bit FNV1a hash of a string, for compact fingerprints (replay hashes, tide seeds). */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  readonly key: string;

  constructor(key: string) {
    this.key = key;
    [this.a, this.b, this.c, this.d] = cyrb128(key);
    for (let i = 0; i < 12; i++) this.nextUint(); // warm up
  }

  /** sfc32 step. */
  nextUint(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    return this.nextUint() / 4294967296;
  }

  /** A float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** An integer in [lo, hi], both inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** One element of a non empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick on an empty array");
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** A shuffled copy (Fisher and Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** Picks a key by weight, iterating keys in the given order. */
  weighted<K extends string>(weights: Record<K, number>, order: readonly K[]): K {
    let total = 0;
    for (const k of order) total += weights[k];
    let roll = this.next() * total;
    for (const k of order) {
      roll -= weights[k];
      if (roll < 0) return k;
    }
    return order[order.length - 1] as K;
  }

  /** A child stream, independent of this one's position. */
  stream(...labels: (string | number)[]): Rng {
    return new Rng(this.key + "/" + labels.join("/"));
  }
}

/** The stream for a seed and a list of labels. */
export function rngFor(seed: number, ...labels: (string | number)[]): Rng {
  return new Rng(String(seed >>> 0) + "/" + labels.join("/"));
}
