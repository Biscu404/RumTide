// Prints the gate pace of GAMEPLAY 2.5 for a flat win chance across the band of check 5, by fights a Tide. The table of D226.
//   node tools/v3/sim/gateTable.ts

import { gatePace } from "./boss.ts";

const pad = (s: string, n: number): string => s.padEnd(n);
console.log(`${pad("win", 6)}${pad("fights", 8)}${pad("median", 8)}${pad("last", 8)}by Tide 12`);
for (const chance of [0.35, 0.45, 0.55, 0.65, 0.8, 1]) {
  for (const fights of [1, 2, 3, 6]) {
    const g = gatePace([chance], 5, 6, 4000, fights);
    console.log(`${pad(`${Math.round(chance * 100)}%`, 6)}${pad(String(fights), 8)}${pad(g.medianTide.toFixed(1), 8)}${pad(g.lastTide.toFixed(1), 8)}${Math.round(g.lastByTwelve * 100)}%`);
  }
}
