// Balance simulation on the real engine:  npm run sim
// Covers the combat table of section 7.3 and the ganging claim of section 9, the solo trader's
// pacing of sections 3.5 and 5.5, and the Treasure Galleon claims of section 8.2.
// The tables for fleets arrive with the fleet rules and the bot season (day 5).

import { simulateGang } from "./combat.ts";
import { RUNS, SECTION_3_5, SECTION_5_5, cumulative, economyProblems, runFullSeason, runSeason0 } from "./economy.ts";
import { galleonProblems, runGalleon } from "./galleon.ts";
import { BATTLES_PER_ROW, SECTION_7_3, pct, runSection73, section73Problems } from "./section73.ts";

const problems: string[] = [];

// ---- Section 7.3 ----

const rows = runSection73();

console.log(`Section 7.3: ${BATTLES_PER_ROW} battles per row, random plans\n`);
console.log("Power ratio | Stronger wins (doc) | Weaker wins | Draws  | Decisive (doc)");
rows.forEach((row, i) => {
  const want = SECTION_7_3[i]!;
  console.log([
    String(row.ratio).padEnd(11),
    `${pct(row.strongerWins)} (${pct(want.strongerWins)})`.padEnd(19),
    pct(row.weakerWins).padEnd(11),
    pct(row.draws).padEnd(6),
    `${pct(row.decisive)} (${pct(want.decisive)})`,
  ].join(" | "));
});

console.log(`\nSection 9 rule 4: three equal ships against one win ${pct(simulateGang(3, BATTLES_PER_ROW, 9))} (doc says about 96%)`);
problems.push(...section73Problems(rows));

// ---- Sections 3.5 and 5.5 ----

const season0 = runSeason0();
const full = runFullSeason();
const { careful, casual } = season0;
const round = (x: number) => String(Math.round(x));

console.log(`\nSection 3.5: a solo trader in Season 0, mean of ${RUNS} runs. Sales pay out every second Tide on a two Tide leg, so`);
console.log("income is shown per Tide and as a running total.\n");
console.log("Tide | Doc income | Careful | Casual | Doc total | Careful total | Casual total | Doc levels | Careful | Casual");
SECTION_3_5.income.forEach((doc, i) => {
  console.log([
    String(i + 1).padEnd(4),
    round(doc).padEnd(10), round(careful.income[i]!).padEnd(7), round(casual.income[i]!).padEnd(6),
    round(cumulative(SECTION_3_5.income, i + 1)).padEnd(9),
    round(cumulative(careful.income, i + 1)).padEnd(13), round(cumulative(casual.income, i + 1)).padEnd(12),
    SECTION_3_5.levels[i]!.toFixed(1).padEnd(10), careful.levels[i]!.toFixed(1).padEnd(7), casual.levels[i]!.toFixed(1),
  ].join(" | "));
});
console.log(`\nEarned by Tide 14: doc about ${SECTION_3_5.earnedByTide14}, careful ${round(careful.earned)}, casual ${round(casual.earned)}`);
console.log(`Brigantine, median Tide: doc ${SECTION_3_5.brigantineMedianTide}, careful ${careful.brigantineTide}, casual ${casual.brigantineTide}`);
console.log(`Section 5.5 (28 Tides, full costs): earned doc about ${SECTION_5_5.earnedBySeasonEnd}, careful ${round(full.careful.earned)}, casual ${round(full.casual.earned)}; `
  + `Brigantine doc ${SECTION_5_5.brigantineMedianTide}, careful ${full.careful.brigantineTide}, casual ${full.casual.brigantineTide}`);
problems.push(...economyProblems(season0, full));

// ---- Section 8.2 ----

const galleon = runGalleon();
console.log("\nSection 8.2: the Treasure Galleon at Tide 7 (median PR 12), 5,000 fights per row\n");
console.log("Ships | Plans   | Win    | Decisive | Doc");
for (const row of galleon) {
  console.log([
    String(row.ships).padEnd(5), row.plans.padEnd(7), pct(row.win).padEnd(6), pct(row.decisive).padEnd(8), row.doc,
  ].join(" | "));
}
problems.push(...galleonProblems(galleon));

if (problems.length > 0) {
  console.error("\nThe tables have drifted:\n" + problems.map((p) => `  ${p}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("\nSim checks passed: 7.3 reproduced; 3.5, 5.5 and 8.2 bracketed or in range (see DECISIONS.md).");
}
