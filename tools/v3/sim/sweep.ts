// npm run sim:sweep
// The Old Shellback sweep (P3.2b). Every number of B.shellback is a cliff for check 5 on its own, so this tries combinations of
// them and keeps every result in the git ignored folder sim-results. It is a long run: start it in the background.
//
// Three phases, each of which writes a file and is skipped when its file is already there (the sweep file is added to instead):
//
//   library   The real doctrine search of check 5 (boss.ts, the quick effort) for each style at a few anchor combinations. Its
//             finalists, the style's own template and the Crabber are the fixed library the sweep scores, because a search is
//             about 27 seconds a style and a sweep needs thousands of them.
//   sweep     Random combinations, then a hill climb from the best ones a grid step at a time. A combination is scored for each
//             style by its library: every doctrine on a few fights, then the best three on more, and the best of those is the
//             style's rate. One line of JSON for each combination.
//   confirm   The real search again for the best combinations of the sweep, so the library cannot flatter or cheat a combination.
//             Its finalists join the library of the next sweep that is started under a new name with --library.
//
//   npm run sim:sweep                                  all three phases, into sim-results/shellback-*.json
//   npm run sim:sweep -- --name second --library sim-results/shellback-library.json,sim-results/shellback-confirm.json
//   npm run sim:sweep -- --phase sweep --random 600 --rounds 8 --beam 4
//   npm run sim:sweep -- --phase confirm --top 6
//
// The numbers it settles on are tried with `npm run sim:v3 -- --check 5 --set shellback.hull=...`, which is the judge.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Rng, styleTemplate, templateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { FIGHTING_STYLES } from "./arena.ts";
import { BOSS_HIGH, BOSS_LOW, BOSS_TIDE, crabber, searchStyle } from "./boss.ts";
import { EFFORTS } from "./effort.ts";
import type { BossJob } from "./jobs.ts";
import type { Patch } from "./patch.ts";
import { workerPool } from "./pool.ts";
import type { Pool } from "./pool.ts";
import { changesOf, complete, keyOf, neighbours, randomCombination, rank, scoreOf } from "./sweepSpace.ts";

const STYLES = FIGHTING_STYLES.map((s) => s.style);
type Rates = Record<string, number>;

// ---------- Flags ----------

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1]! : fallback;
};
const count = (name: string, fallback: number): number => {
  const n = Number(flag(name, String(fallback)));
  if (!Number.isInteger(n) || n < 0) { console.error(`${name} wants a whole number.`); process.exit(2); }
  return n;
};

const DIR = flag("--dir", "sim-results");
const NAME = flag("--name", "shellback");
const PHASE = flag("--phase", "all");
if (!["all", "library", "sweep", "confirm"].includes(PHASE)) { console.error("--phase wants all, library, sweep or confirm."); process.exit(2); }
const RANDOM = count("--random", 400);
const ROUNDS = count("--rounds", 8);
const BEAM = count("--beam", 4);
const TOP = count("--top", 5);
const WORKERS = count("--workers", 0) || undefined;
const SCREEN_SEEDS = count("--screen", 40);
const PICK_SEEDS = count("--pick", 200);
const PICKED = 3; // doctrines of a style that go on from the screen to the pick

const LIBRARY_FILE = `${DIR}/${NAME}-library.json`;
const SWEEP_FILE = `${DIR}/${NAME}-sweep.jsonl`;
const CONFIRM_FILE = `${DIR}/${NAME}-confirm.json`;
const LIBRARY_FILES = flag("--library", `${LIBRARY_FILE},${CONFIRM_FILE}`).split(",");

mkdirSync(DIR, { recursive: true });
const started = Date.now();
const minutes = (): string => `${((Date.now() - started) / 60000).toFixed(1)} min`;

// ---------- The real search at one combination (library and confirm) ----------

/** What a file of searches holds: for each combination, each style's confirmed rate and the doctrines its search ended with. */
interface Searched {
  patch: Patch; // only the numbers that differ from balance.ts
  rates: Rates;
  pass: boolean;
  doctrines: Record<string, Doctrine[]>;
}

async function searchAt(partial: Patch): Promise<Searched> {
  const pool = workerPool(WORKERS, partial);
  try {
    const rates: Rates = {};
    const doctrines: Record<string, Doctrine[]> = {};
    for (const style of STYLES) {
      const found = await searchStyle(pool, EFFORTS.quick, style, true);
      rates[style] = found.best.rate;
      doctrines[style] = found.finalists.slice(0, PICKED).map((f) => f.doctrine);
    }
    return { patch: partial, rates, pass: STYLES.every((s) => rates[s]! >= BOSS_LOW && rates[s]! <= BOSS_HIGH), doctrines };
  } finally {
    await pool.close();
  }
}

const show = (rates: Rates): string => STYLES.map((s) => `${s} ${Math.round(rates[s]! * 100)}%`).join(", ");
const showPatch = (patch: Patch): string => {
  const changes = Object.entries(changesOf(complete(patch)));
  return changes.length === 0 ? "balance.ts as it is" : changes.map(([k, v]) => `${k.replace("shellback.", "")}=${v}`).join(" ");
};

/** Combinations where different doctrines should be the best, so the library holds more than the plans that beat him today. */
const ANCHORS: Patch[] = [
  {},
  { "shellback.clawHands": 64 },
  { "shellback.armour": 0.6, "shellback.cannons": 32 },
  { "shellback.hull": 420, "shellback.retreatClaws": 0.15 },
  { "shellback.clawHands": 60, "shellback.retreatHull": 0.5, "shellback.cannons": 30 },
];

async function library(): Promise<void> {
  if (existsSync(LIBRARY_FILE)) { console.log(`${LIBRARY_FILE} is there already, so the library phase is skipped.`); return; }
  const out: Searched[] = [];
  for (const anchor of ANCHORS) {
    const found = await searchAt(anchor);
    out.push(found);
    writeFileSync(LIBRARY_FILE, JSON.stringify(out, null, 1) + "\n");
    console.log(`library ${out.length}/${ANCHORS.length} (${minutes()}): ${showPatch(anchor)}: ${show(found.rates)}`);
  }
}

// ---------- The sweep ----------

/** The doctrines a style is scored with: its template, the Crabber, and what every search in the library files ended with. */
function loadLibrary(): Record<string, Doctrine[]> {
  const out: Record<string, Doctrine[]> = {};
  const files = LIBRARY_FILES.filter((f) => existsSync(f));
  if (files.length === 0) throw new Error(`No library file: run the library phase first (${LIBRARY_FILES.join(", ")}).`);
  const searches = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as Searched[]);
  for (const style of STYLES) {
    const seen = new Set<string>();
    out[style] = [templateDoctrine(styleTemplate(style)), crabber(), ...searches.flatMap((s) => s.doctrines[style] ?? [])].filter((d) => {
      const key = JSON.stringify(d.rules);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return out;
}

interface Line {
  patch: Patch; // every number of the grid
  rates: Rates;
  loss: number;
  spread: number;
  /** "screen" when the screen alone showed the combination to be far out, so the bigger pick was not run. */
  judgedOn: "screen" | "pick";
  from: string; // "baseline", "random" or "climb 3"
}

async function rate(pool: Pool, patch: Patch, lib: Record<string, Doctrine[]>, from: string): Promise<Line> {
  const job = (style: (typeof STYLES)[number], doctrine: Doctrine, label: string, seeds: number): BossJob =>
    ({ doctrine, ship: { style }, tide: BOSS_TIDE, label: `sweep/${style}/${label}`, from: 0, count: seeds, patch });
  const screenJobs = STYLES.flatMap((style) => lib[style]!.map((d) => job(style, d, "screen", SCREEN_SEEDS)));
  const screened = await pool.run("boss", screenJobs);
  const rates: Rates = {};
  const best: Record<string, Doctrine[]> = {};
  let at = 0;
  for (const style of STYLES) {
    const scored = lib[style]!.map((doctrine) => ({ doctrine, won: screened[at++]!.beaten })).sort((a, b) => b.won - a.won);
    rates[style] = scored[0]!.won / SCREEN_SEEDS;
    best[style] = scored.slice(0, PICKED).map((s) => s.doctrine);
  }
  const rough = scoreOf(STYLES.map((s) => rates[s]!));
  if (rough.loss > 1) return { patch, rates, ...rough, judgedOn: "screen", from };
  const picked = await pool.run("boss", STYLES.flatMap((style) => best[style]!.map((d) => job(style, d, "pick", PICK_SEEDS))));
  at = 0;
  for (const style of STYLES) rates[style] = Math.max(...best[style]!.map(() => picked[at++]!.beaten)) / PICK_SEEDS;
  return { patch, rates, ...scoreOf(STYLES.map((s) => rates[s]!)), judgedOn: "pick", from };
}

const readLines = (): Line[] =>
  existsSync(SWEEP_FILE) ? readFileSync(SWEEP_FILE, "utf8").split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as Line) : [];

async function sweep(): Promise<void> {
  const lib = loadLibrary();
  console.log(`sweep: the library holds ${STYLES.map((s) => `${lib[s]!.length} for the ${s}`).join(", ")}.`);
  const lines = readLines();
  const seen = new Set(lines.map((l) => keyOf(l.patch)));
  const pool = workerPool(WORKERS);
  const tryOne = async (patch: Patch, from: string): Promise<void> => {
    if (seen.has(keyOf(patch))) return;
    seen.add(keyOf(patch));
    const line = await rate(pool, patch, lib, from);
    lines.push(line);
    appendFileSync(SWEEP_FILE, JSON.stringify(line) + "\n");
  };
  const report = (what: string): void => {
    const top = [...lines].sort((a, b) => rank(a) - rank(b))[0]!;
    console.log(`${what} (${minutes()}, ${lines.length} tried): best loss ${top.loss.toFixed(3)}: ${showPatch(top.patch)}: ${show(top.rates)}`);
  };
  try {
    await tryOne(complete({}), "baseline");
    const rng = new Rng(`p32b/sweep/${NAME}`);
    for (let i = 0; i < RANDOM; i++) {
      await tryOne(randomCombination(rng), "random");
      if ((i + 1) % 50 === 0) report(`random ${i + 1}/${RANDOM}`);
    }
    for (let round = 1; round <= ROUNDS; round++) {
      const before = lines.length;
      const beam = [...lines].sort((a, b) => rank(a) - rank(b)).slice(0, BEAM);
      for (const parent of beam) for (const next of neighbours(parent.patch)) await tryOne(next, `climb ${round}`);
      report(`climb ${round}/${ROUNDS}`);
      if (lines.length === before) { console.log("Every neighbour of the best combinations has been tried, so the climb stops."); break; }
    }
  } finally {
    await pool.close();
  }
}

// ---------- Confirm ----------

async function confirm(): Promise<void> {
  const out: Searched[] = existsSync(CONFIRM_FILE) ? JSON.parse(readFileSync(CONFIRM_FILE, "utf8")) as Searched[] : [];
  const done = new Set(out.map((s) => keyOf(complete(s.patch))));
  const best = readLines().filter((l) => l.judgedOn === "pick").sort((a, b) => rank(a) - rank(b)).slice(0, TOP);
  for (const line of best) {
    if (done.has(keyOf(line.patch))) continue;
    const found = await searchAt(changesOf(line.patch));
    out.push(found);
    writeFileSync(CONFIRM_FILE, JSON.stringify(out, null, 1) + "\n");
    console.log(`confirm ${out.length} (${minutes()}): ${found.pass ? "PASS" : "fail"}: ${showPatch(line.patch)}`);
    console.log(`  the sweep said ${show(line.rates)}`);
    console.log(`  the search says ${show(found.rates)}`);
  }
  const passed = out.filter((s) => s.pass);
  console.log(passed.length === 0 ? "No confirmed combination has every style in the band." : `${passed.length} confirmed combinations have every style in the band:`);
  for (const s of passed) console.log(`  ${Object.entries(s.patch).map(([k, v]) => `--set ${k}=${v}`).join(" ")}`);
}

if (PHASE === "all" || PHASE === "library") await library();
if (PHASE === "all" || PHASE === "sweep") await sweep();
if (PHASE === "all" || PHASE === "confirm") await confirm();
console.log(`Done in ${minutes()}. The results are in ${DIR}.`);
