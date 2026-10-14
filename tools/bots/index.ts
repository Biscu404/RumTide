// Bot season:  npm run bots   (or  npm run bots -- 40  to play 40 seasons of each roster)
// Six scripted captains play all 14 Tides of Season 0 on the real engine, over many seeds, and then a
// brawl of six raiders does the same. It prints the first season Tide by Tide, then totals, and fails
// if any state is impossible, a season throws, the same seed gives a different season, or the totals
// look wrong (section 15.6, day 5 of section 19.1).

import { brawlProblems, commonProblems, mean, sixCaptainProblems, totals } from "./checks.ts";
import { brawl, playSeason, sixCaptains, type SeasonReport } from "./season.ts";

const SEASONS = Math.max(1, Number(process.argv[2]) || 30);
const reports: SeasonReport[] = [];
const brawls: SeasonReport[] = [];
for (let seed = 1; seed <= SEASONS; seed++) {
  reports.push(playSeason(seed, sixCaptains(seed)));
  brawls.push(playSeason(seed, brawl(seed)));
}

// ---- The first season in detail ----

const first = reports[0]!;
const pad = (x: unknown, n: number) => String(x).padEnd(n);
console.log(`Bot season, seed ${first.seed}: ${first.tides.length} Tides, ${first.captains.length} captains\n`);
console.log("Tide | Battles | Merchants taken | Tributes | Escapes | Towed | Galleon");
for (const t of first.tides) {
  console.log([
    pad(t.tide, 4), pad(t.battles, 7), pad(t.merchantsTaken, 15), pad(t.tributes, 8), pad(t.escapes, 7), pad(t.towed, 5),
    t.galleonFights === 0 ? "" : t.galleonSunk ? "sunk" : "survived",
  ].join(" | ").trimEnd());
}
console.log("\nCaptain | Role           | Legend | Chest | Hull       | Levels | PR   | Fights | Wins | Struck | Merchants | Shore Leave");
for (const c of [...first.captains].sort((a, b) => b.legend - a.legend)) {
  console.log([
    pad(c.id, 7), pad(c.role, 14), pad(Math.round(c.legend), 6), pad(Math.round(c.chestGold), 5), pad(c.hull, 10),
    pad(c.levels, 6), pad(c.pr.toFixed(1), 4), pad(c.battles, 6), pad(c.wins, 4), pad(c.struck, 6), pad(c.merchants, 9), c.shoreLeave,
  ].join(" | "));
}
console.log("\nGazette, Tide 7:");
for (const line of first.gazettes[6]!) console.log(`  ${line}`);

// ---- Totals over every season ----

const line = (reps: SeasonReport[]) => {
  const t = totals(reps);
  return `battles ${t.battles.toFixed(1)} (captain against captain ${t.pvp.toFixed(1)}, fleet ${t.fleetBattles.toFixed(1)}, with a bounty ${t.withBounty.toFixed(1)}), `
    + `merchants taken ${t.merchantsTaken.toFixed(1)}, tributes ${t.tributes.toFixed(1)}, escapes ${t.escapes.toFixed(1)}, ships towed ${t.towed.toFixed(1)}`;
};
const galleonSeasons = (tide: number) => reports.filter((r) => r.tides[tide - 1]?.galleonFights);
console.log(`\nTotals over ${SEASONS} seasons (mean per season):`);
console.log(`  ${line(reports)}`);
console.log(`  galleon fought in ${galleonSeasons(7).length} seasons on Tide 7 and ${galleonSeasons(14).length} on Tide 14; `
  + `sunk in ${totals(reports).galleonSeasons} seasons`);
console.log("\nCaptain | Role           | Legend | Chest | Levels | Brigantine by end | Fights | Wins");
for (const id of first.captains.map((c) => c.id)) {
  const rows = reports.map((r) => r.captains.find((c) => c.id === id)!);
  console.log([
    pad(id, 7), pad(rows[0]!.role, 14), pad(Math.round(mean(rows.map((c) => c.legend))), 6),
    pad(Math.round(mean(rows.map((c) => c.chestGold))), 5), pad(mean(rows.map((c) => c.levels)).toFixed(1), 6),
    pad(`${Math.round(100 * rows.filter((c) => c.hull !== "sloop").length / rows.length)}%`, 17),
    pad(mean(rows.map((c) => c.battles)).toFixed(1), 6), mean(rows.map((c) => c.wins)).toFixed(1),
  ].join(" | "));
}
console.log(`\nBrawl (six raiders in two fleets of three), ${SEASONS} seasons, mean per season:`);
console.log(`  ${line(brawls)}`);

const problems = [
  ...commonProblems("six captains", reports, (seed) => playSeason(seed, sixCaptains(seed))),
  ...commonProblems("brawl", brawls, (seed) => playSeason(seed, brawl(seed))),
  ...sixCaptainProblems(reports),
  ...brawlProblems(brawls),
];
if (problems.length > 0) {
  console.error("\nThe bot season found problems:\n" + problems.map((p) => `  ${p}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`\nBot season passed: ${SEASONS} seasons of each roster, no errors, deterministic, results sane.`);
}
