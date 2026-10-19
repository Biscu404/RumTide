// npm run tide:demo
// Resolves the six ship fixture Tide and prints the replay in plain words, the final positions,
// and a fingerprint. Run it twice: the fingerprint must never change unless the rules did.

// `npm run tide:demo -- --shellback` shows a fresh sloop with the starting Brawler challenging Old Shellback in the Narrows
// instead (GAMEPLAY 2.5). `-- --shellback 9` or any other Tide shows how tired he is by then.

import { canonicalJson, coverage, formatReplay, hash32, newSeason, replayHash, resolveTide } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SIX_SHIPS_WIND, cradle, sixShips } from "./sixShips.ts";

const crabAt = process.argv.indexOf("--shellback");
if (crabAt >= 0) {
  const tide = Number(process.argv[crabAt + 1]) || 6;
  const crab = newSeason({
    seasonId: "shellback", preset: "season0", seed: 5, world: cradle,
    captains: [{ id: "cap_p", name: "Pip", shipName: "The Gull", water: "the_narrows", docked: false }],
  });
  crab.tide = tide;
  const challenge = { tide, planA: { steps: [{ kind: "lurk" as const, filter: { kind: "npcs" as const } }] } };
  const fight = resolveTide({ state: crab, world: cradle, orders: { cap_p: challenge }, seed: hash32(`shellback/tide/${tide}`), windOverride: SIX_SHIPS_WIND });
  console.log(`Rumtide engine demo: The Gull (a fresh sloop, the starting Brawler) challenges Old Shellback, Tide ${tide}\n`);
  for (const line of formatReplay(cradle, fight.state, fight.replay)) console.log("  " + line);
  const beaten = fight.state.captains.cap_p!.bossesBeaten;
  console.log(`\nPip has beaten: ${beaten.length ? beaten.join(", ") : "nobody yet"}. Replay fingerprint: ${replayHash(fight.replay)}`);
  process.exit(0);
}

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
