// Splits a number of battles into jobs of a size a worker can answer quickly, so the pool stays busy to the end.

export interface Chunk {
  from: number;
  count: number;
}

export function chunked(total: number, size: number): Chunk[] {
  const out: Chunk[] = [];
  for (let from = 0; from < total; from += size) out.push({ from, count: Math.min(size, total - from) });
  return out;
}
