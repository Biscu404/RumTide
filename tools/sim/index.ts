// Balance simulation on the real engine:  npm run sim
// So far it covers the combat table of section 7.3 and the ganging claim of section 9. The pacing
// tables of sections 3.5 and 5.5 need trade and upgrades, which arrive on day 4.

import { simulateGang } from "./combat.ts";
import { BATTLES_PER_ROW, SECTION_7_3, pct, runSection73, section73Problems } from "./section73.ts";

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

const problems = section73Problems(rows);
if (problems.length > 0) {
  console.error("\nThe tables have drifted:\n" + problems.map((p) => `  ${p}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("\nSection 7.3 reproduced.");
}
