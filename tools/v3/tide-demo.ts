// npm run tide:demo
// Resolves the six ship fixture Tide and prints the replay in plain words, the final positions,
// and a fingerprint. Run it twice: the fingerprint must never change unless the rules did.

import { canonicalJson, coverage, formatReplay, replayHash, resolveTide } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { cradle, sixShips } from "./sixShips.ts";

const { state, orders, seed, windOverride } = sixShips();
const result = resolveTide({ state, world: cradle, orders, seed, windOverride });

if (process.argv.includes("--hash")) {
  console.log(replayHash(result.replay));
  process.exit(0);
}

console.log(`Rumtide engine demo: the six ship fixture, Tide ${state.tide}\n`);
for (const line of formatReplay(cradle, result.state, result.replay)) console.log("  " + line);

console.log("\nWhere everyone ended up:");
for (const ship of Object.values(result.state.ships).sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const captain = result.state.captains[ship.captainId]!;
  const where = cradle.water[ship.waterId]?.name ?? ship.waterId;
  const cov = Math.round(coverage(cradle, captain.knowledge) * 100);
  console.log(`  ${ship.name.padEnd(13)} ${where.padEnd(20)} ${ship.docked ? "docked" : "at sea"}  chest ${String(captain.chest).padStart(4)}  chart ${cov}%`);
}
console.log(`\nEncounters: ${result.encounters.length}. Replay fingerprint: ${replayHash(result.replay)} (${canonicalJson(result.replay).length} bytes)`);
