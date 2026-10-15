// Bot season:  npm run bots   (or  npm run bots -- 40  to play 40 seasons of each roster)
// Six scripted captains play all 14 Tides of Season 0 on the real engine, over many seeds, and then a
// brawl of six raiders and a voyage of four explorers do the same. It prints the first season Tide by Tide, then totals, and fails
// if any state is impossible, a season throws, the same seed gives a different season, or the totals
// look wrong (section 15.6, day 5 of section 19.1).

import { awayExperiment } from "./away.ts";
import { apiProblems } from "./checks.ts";
import { brawlProblems, commonProblems, mean, sixCaptainProblems, totals, voyageProblems } from "./checks.ts";
import { playSeasonThroughApi } from "./api_season.ts";
import { brawl, playSeason, sixCaptains, voyage, type SeasonReport } from "./season.ts";

const SEASONS = Math.max(1, Number(process.argv[2]) || 30);
const reports: SeasonReport[] = [];
const brawls: SeasonReport[] = [];
const voyages: SeasonReport[] = [];
for (let seed = 1; seed <= SEASONS; seed++) {
  reports.push(playSeason(seed, sixCaptains(seed)));
  brawls.push(playSeason(seed, brawl(seed)));
  voyages.push(playSeason(seed, voyage(seed)));
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
console.log("\nCaptain | Role           | Legend | Chest | Hull       | Levels | PR   | Fights | Wins | Struck | Merchants | Shore Leave (left / peak / paid)");
for (const c of [...first.captains].sort((a, b) => b.legend - a.legend)) {
  console.log([
    pad(c.id, 7), pad(c.role, 14), pad(Math.round(c.legend), 6), pad(Math.round(c.chestGold), 5), pad(c.hull, 10),
    pad(c.levels, 6), pad(c.pr.toFixed(1), 4), pad(c.battles, 6), pad(c.wins, 4), pad(c.struck, 6), pad(c.merchants, 9),
    `${c.shoreLeave} / ${c.shoreLeavePeak} / ${c.shoreLeaveSpent}`,
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

// ---- Exploration (section 10.1) ----

const eventTotals = new Map<string, number>();
for (const r of voyages) for (const [event, n] of Object.entries(r.events)) eventTotals.set(event, (eventTotals.get(event) ?? 0) + n);
const drawn = [...eventTotals.values()].reduce((a, b) => a + b, 0);
console.log(`\nVoyage (four explorers, a raider and a trader), ${SEASONS} seasons, mean per season:`);
console.log(`  ${line(voyages)}`);
console.log(`  ${(drawn / SEASONS).toFixed(1)} exploration events, ${(mean(voyages.map((r) => r.longCourses))).toFixed(1)} longer courses under a Hermit's chart`);
console.log("  " + [...eventTotals].sort((a, b) => b[1] - a[1]).map(([event, n]) => `${event} ${(n / SEASONS).toFixed(1)}`).join(", "));
const explorers = ["ann", "bob", "cat", "dan"].map((id) => voyages.map((r) => r.captains.find((c) => c.id === id)!));
console.log(`  explorers average Legend ${Math.round(mean(explorers.flat().map((c) => c.legend)))}, Chest ${Math.round(mean(explorers.flat().map((c) => c.chestGold)))}, `
  + `upgrade levels ${mean(explorers.flat().map((c) => c.levels)).toFixed(1)}; the trader ${Math.round(mean(voyages.map((r) => r.captains.find((c) => c.id === "fay")!.legend)))} Legend`);

// ---- A week away (Shore Leave, section 12.4) ----

const away = awayExperiment(reports.map((r) => r.seed));
const share = (x: number) => `${Math.round(100 * x)}%`;
console.log(`\nBob away for Tides 5 to 7 against Bob at his desk, same ${away.seasons} seeds (the doc says about 85% to 93%):`);
console.log(`  Legend ${share(away.legend)}, upgrade levels ${share(away.levels)}, Chest ${share(away.chest)}; `
  + `Shore Leave peaked at ${away.peak.toFixed(1)} and paid out in ${away.spent.toFixed(1)} Tides`);

// ---- The same seasons through the real handlers ----

let portActions = 0, orderCount = 0;
const apiChecked: string[] = [];
const throughApi = async (label: string, reps: SeasonReport[], roster: (seed: number) => ReturnType<typeof sixCaptains>) => {
  for (const r of reps) {
    const api = await playSeasonThroughApi(r.seed, roster(r.seed));
    portActions += api.portActions;
    orderCount += api.orders;
    apiChecked.push(...apiProblems(label, r, api));
  }
};
await throughApi("six captains", reports, sixCaptains);
await throughApi("brawl", brawls, brawl);
await throughApi("voyage", voyages, voyage);
console.log(`
Through the handlers (submit_orders, port_action, resolve_tide): ${portActions} port actions and ${orderCount} orders over ${3 * SEASONS} seasons.`);

const problems = [
  ...apiChecked,
  ...commonProblems("six captains", reports, (seed) => playSeason(seed, sixCaptains(seed))),
  ...commonProblems("brawl", brawls, (seed) => playSeason(seed, brawl(seed))),
  ...commonProblems("voyage", voyages, (seed) => playSeason(seed, voyage(seed))),
  ...sixCaptainProblems(reports),
  ...brawlProblems(brawls),
  ...voyageProblems(voyages),
];
if (problems.length > 0) {
  console.error("\nThe bot season found problems:\n" + problems.map((p) => `  ${p}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`\nBot season passed: ${SEASONS} seasons of each of three rosters, no errors, deterministic, results sane, and the handlers play them identically.`);
}
