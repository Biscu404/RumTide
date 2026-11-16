// Plain words for the sandbox Tide (docs/briefs/sandbox.md, stage 2). Everything here only reads a plan, a replay or a
// season state and says what they hold, for someone who never read the rules. It decides nothing. Battles inside the Tide
// are worded by stage 1's words.ts.

import { B, describeCarried, maxHands, maxHullPoints, maxRiggingPoints, CARGO_GOODS, LEVEL, levelOf } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  BattleSide, Captain, Doctrine, HuntFilter, ReplayEvent, SeasonState, Ship, Stance, Step, Terrain, TideResult, Wind,
} from "../../supabase/functions/_shared/engine_v3/index.ts";
import { RANGE_NAME, endingWords, roundLog } from "./words.ts";
import type { Ending, RoundLog } from "./words.ts";
import { LAST_WATCH, YOU, YOUR_SHIP, world } from "./tideSetup.ts";
import type { Problem, StepEstimate } from "./tideSetup.ts";

// ---------- Names ----------

export const TERRAIN_NAME: Record<Terrain, string> = {
  open: "Open water", shallows: "Shallows", reef: "Reef", rocky: "Rocks", fog: "Fog", kelp: "Kelp", strongCurrent: "Strong current", harbour: "Harbour",
};

const COMPASS: Record<number, string> = {
  0: "north", 45: "north east", 90: "east", 135: "south east", 180: "south", 225: "south west", 270: "west", 315: "north west",
};

export function windWords(w: Wind): string {
  if (w.kind === "calm") return "calm, no wind at all";
  return `${w.kind === "gale" ? "a Gale" : "a Breeze"} from the ${COMPASS[w.from] ?? `${w.from} degrees`}`;
}

export const placeName = (id: string): string => world.water[id]?.name ?? world.site[id]?.name ?? world.island[id]?.name ?? id;

export function laneName(id: string): string {
  const lane = world.lane[id];
  return lane ? `between ${placeName(lane.a)} and ${placeName(lane.b)}` : id;
}

const watches = (n: number): string => `${n} ${n === 1 ? "Watch" : "Watches"}`;
const doubloons = (n: number): string => `${n} ${n === 1 ? "doubloon" : "doubloons"}`;

// ---------- The planner ----------

export const STANCE_WORDS: Record<Stance, string> = {
  trade: "Peaceful: never start a fight",
  quiet: "Quiet: a better chance to slip away if hunted",
  hunt: "Hunting: attack ships you meet on the way",
};

/** The hunt filters the sandbox offers, with the words for each. */
export const FILTER_PICKS: readonly { filter: HuntFilter; words: string }[] = [
  { filter: { kind: "anyone" }, words: "any ship" },
  { filter: { kind: "players" }, words: "other captains (not merchants)" },
  { filter: { kind: "merchants" }, words: "merchants" },
  { filter: { kind: "carryingCargo" }, words: "ships with cargo or doubloons aboard" },
];

const filterWords = (f: HuntFilter | undefined): string => FILTER_PICKS.find((p) => p.filter.kind === (f?.kind ?? "anyone"))?.words ?? "any ship";

export function stepWords(step: Step): string {
  switch (step.kind) {
    case "sail": {
      const how = step.stance === "hunt" ? `, hunting ${filterWords(step.filter)}` : step.stance === "quiet" ? ", quietly" : "";
      return `Sail to ${placeName(step.to)}${how}`;
    }
    case "survey": return "Survey the water you are in";
    case "land": return `Land at ${placeName(step.site)}`;
    case "dock": return "Dock in the Harbour";
    case "lurk": return `Lie in wait for ${filterWords(step.filter)}`;
    case "repair": return "Repair the Hull at sea";
  }
}

export const STEP_HINT: Record<Step["kind"], string> = {
  sail: "The ship finds its own way along the lanes on your chart. Each stretch costs about 2 Watches, more or less with wind and current.",
  survey: `Costs ${watches(B.actions.survey)}. Charts the water you are in and can turn up a hidden passage.`,
  land: `Costs ${watches(B.actions.land)}. Go ashore at a place on the island you are at.`,
  dock: `Costs ${watches(B.actions.dock)}. Only in a Harbour. A docked ship cannot be attacked, and the doubloons aboard go to your chest for good.`,
  lurk: `Takes every Watch you have left (at least ${B.actions.lurkMin}). You wait here and jump ships that come by.`,
  repair: `Costs ${watches(B.actions.repair)} and ${B.repairAtSea.timber} Timber. Mends some Hull without a Harbour.`,
};

const PROBLEM_WORDS: Record<Problem, string> = {
  conditionFalse: "This step will be skipped.",
  invalid: "This step makes no sense here.",
  noKnownRoute: "Your chart shows no way there.",
  notAHarbour: "You can only dock in a Harbour, and you will not be in one at this point.",
  siteNotHere: "That place is on another island than the one you will be at.",
  siteUnknown: "You do not know that place well enough to land there.",
  nothingToRepair: "Your Hull is whole, so there is nothing to repair.",
  noTimber: `A repair at sea needs ${B.repairAtSea.timber} Timber and you have too little.`,
  alreadyThere: "You will already be there, so this step is skipped.",
  outOfWatches: "You will not have enough Watches left for this.",
  notReached: "You will have no Watches left by then.",
};

/** What the planner says under a step: its cost as your captain reckons it, or why it will not happen. */
export function estimateWords(step: Step, est: StepEstimate): string {
  if (est.problem === "outOfWatches" && est.stopsAt) {
    return `You will run out of Watches on the way and stop at ${placeName(est.stopsAt)}${est.watches > 0 ? `, after ${watches(est.watches)}` : ""}.`;
  }
  if (est.problem) return PROBLEM_WORDS[est.problem];
  const about = `About ${watches(est.watches)}`;
  if (step.kind === "sail") {
    const via = est.path.slice(1, -1).map(placeName);
    return `${about}${via.length > 0 ? `, by way of ${via.join(" and ")}` : ""}.${est.guess ? " Part of this is a guess, because your chart of these waters is only a sketch." : ""}`;
  }
  if (step.kind === "lurk") return `Every Watch you have left: ${est.watches}.`;
  return `${about}.`;
}

// ---------- The clock ----------

export const clockWords = (watch: number): string =>
  watch === 0 ? "The Tide begins" : watch >= LAST_WATCH ? `After ${watches(watch)}: the Tide ends` : `After ${watches(watch)}`;

// ---------- One event in plain words ----------

const SKIP_WORDS: Record<string, string> = {
  conditionFalse: "its condition was not met",
  invalid: "it made no sense there",
  noKnownRoute: "its chart showed no way there",
  notAHarbour: "it was not in a Harbour",
  siteNotHere: "that place is on another island",
  siteUnknown: "it did not know that place well enough",
  nothingToRepair: "its Hull was whole",
  noTimber: "it had too little Timber",
  alreadyThere: "it was already there",
};

/** One line for a replay event. Battles have their own card (battleWords), so they give null here. */
export function eventWords(e: ReplayEvent, before: SeasonState): string | null {
  const ship = (id: string): string => before.ships[id]?.name ?? id;
  const where = (at: string, onLane: boolean): string => (onLane ? `on the lane ${laneName(at)}` : `at ${placeName(at)}`);
  const newMarks = (ids: string[]): string => {
    const names = ids.filter((id) => world.water[id] || world.site[id]).map(placeName);
    return names.length > 0 ? ` Now charted: ${names.join(", ")}.` : "";
  };
  switch (e.kind) {
    case "tideStart": return `Tide ${e.tide} begins. The wind: ${Object.values(e.winds).map(windWords).join(", ")}.`;
    case "plan":
      if (e.source === "standing") return `${ship(e.ship)} has no orders, so it makes for the nearest Harbour.`;
      return e.steps === 0
        ? `${ship(e.ship)} has no plan and stays where it is.`
        : `${ship(e.ship)} sets out with a plan of ${e.steps} ${e.steps === 1 ? "step" : "steps"} and ${watches(e.watches)} to spend.`;
    case "undock": return `${ship(e.ship)} casts off from ${placeName(e.water)}.`;
    case "hop": return `${ship(e.ship)} sails from ${placeName(e.from)} toward ${placeName(e.to)}. The stretch takes ${watches(e.cost)}.`;
    case "arrive": return `${ship(e.ship)} reaches ${placeName(e.water)}.${e.ship === YOUR_SHIP ? newMarks(e.charted) : ""}`;
    case "stop":
      return `${ship(e.ship)} stops at ${placeName(e.water)}: the next part of its plan needs ${watches(e.needed)} and it has ${e.left} left.`;
    case "skip": return `${ship(e.ship)} skips step ${e.step} of its plan, because ${SKIP_WORDS[e.reason] ?? "it could not be done"}.`;
    case "survey":
      return `${ship(e.ship)} surveys ${placeName(e.water)}.${e.ship === YOUR_SHIP ? newMarks(e.charted) : ""}`
        + (e.revealed.length > 0 ? ` It finds a hidden passage ${e.revealed.map(laneName).join(", and one ")}!` : "");
    case "land":
      return `${ship(e.ship)} sends a boat ashore at ${placeName(e.site)}.${e.unlocked.length > 0 ? " It finds a clue to a hidden passage." : " Nothing more can be found there yet."}`;
    case "dock": return `${ship(e.ship)} docks at ${placeName(e.water)}${e.banked > 0 ? ` and puts ${doubloons(e.banked)} safely in the chest` : ""}. Nobody can attack it there.`;
    case "lurk": return `${ship(e.ship)} lies in wait at ${placeName(e.water)} for the rest of the Tide.`;
    case "repair": return `${ship(e.ship)} patches its Hull at sea, up to ${e.hullPoints}.`;
    case "galeDamage": return `The Gale tears at the Rigging of ${ship(e.ship)}, down to ${e.riggingPoints}.`;
    case "meet": return `${ship(e.a)} and ${ship(e.b)} sight each other ${where(e.at, e.onLane)}.`;
    case "encounter": return `${ship(e.hunter)} goes after ${ship(e.target)} ${where(e.at, e.onLane)}.`;
    case "parley":
      return e.accepted
        ? `${ship(e.target)} pays ${describeCarried(e.paid)} to be left alone, and both sail on.`
        : `${ship(e.target)} offers to pay to be left alone, but ${ship(e.hunter)} refuses.`;
    case "escape": {
      const odds = `${Math.round(e.chance * 100)} in 100`;
      return e.escaped
        ? `${ship(e.target)} tries to slip away (a chance of ${odds}) and gets clean away. ${ship(e.hunter)} loses the rest of its Tide to the chase.`
        : `${ship(e.target)} tries to slip away (a chance of ${odds}) and is caught. They fight.`;
    }
    case "battle": return null;
    case "towed":
      return e.from === e.to
        ? `${ship(e.ship)} is towed back into ${placeName(e.to)} and docked there with ${e.hullPoints} Hull.`
        : `${ship(e.ship)} is towed from ${placeName(e.from)} to ${placeName(e.to)} and docked there with ${e.hullPoints} Hull.`;
    case "bossRecovers": return `${ship(e.ship)} is whole again.`;
    case "islandCharted": return `${before.captains[e.captain]?.name ?? e.captain} ${e.captain === YOU ? "have" : "has"} now charted all of ${placeName(e.island)}.`;
    case "supplies":
      return e.shortRations
        ? `${ship(e.ship)} runs out of Provisions. A hungry crew gives one Watch less next Tide.`
        : `The crew of ${ship(e.ship)} eats ${e.provisionsUsed} of its Provisions (${e.provisionsLeft} left).`;
    case "tideEnd": return `Tide ${e.tide} ends.`;
  }
}

// ---------- A battle inside the Tide ----------

export interface BattleCard {
  title: string;
  start: string;
  ending: Ending;
  after: string[]; // what the battle did to the ships and their captains
  rounds: RoundLog[];
}

type BattleEvent = Extract<ReplayEvent, { kind: "battle" }>;

export function battleWords(e: BattleEvent, before: SeasonState): BattleCard {
  const { record, aftermath } = e;
  const ship = (id: string | null): string => (id ? before.ships[id]?.name ?? id : "");
  const doctrineOf = (side: BattleSide): Doctrine => {
    const captain = before.captains[(before.ships[record[side]] as Ship).captainId] as Captain;
    return captain.doctrines.find((d) => d.name === record.doctrines[side]) ?? (captain.doctrines[0] as Doctrine);
  };
  const doctrines: Record<BattleSide, Doctrine> = { hunter: doctrineOf("hunter"), target: doctrineOf("target") };
  const winner = ship(aftermath.winner), loser = ship(aftermath.loser);
  const after: string[] = [];
  if (aftermath.loot) {
    const taken = describeCarried(aftermath.loot.taken);
    after.push(taken === "nothing" ? `${loser} had nothing aboard worth taking.` : `${winner} takes ${taken} from ${loser}.`);
  }
  if (aftermath.wreck) after.push(`The rest of what ${loser} carried lies in its wreck at ${placeName(aftermath.wreck.water)}.`);
  if (aftermath.flotsam.length > 0) after.push("Cargo thrown overboard is left floating there.");
  if (aftermath.bounty.added > 0) after.push(`The Admiralty puts a bounty of ${doubloons(aftermath.bounty.added)} on ${winner} for hunting a weaker ship. Whoever beats ${winner} collects it.`);
  if (aftermath.bounty.collected > 0) after.push(`${winner} collects the bounty of ${doubloons(aftermath.bounty.collected)} on ${loser}.`);
  if (aftermath.shieldUntil !== null) after.push(`${loser} cannot be hunted by other captains through Tide ${aftermath.shieldUntil}.`);
  if (aftermath.towed) after.push(`${loser} will be towed to a Harbour when the Tide ends.`);
  after.push("Both ships stay where they fought for the rest of the Tide.");
  return {
    title: `${ship(record.hunter)} against ${ship(record.target)} at ${world.lane[record.at] ? `the lane ${laneName(record.at)}` : placeName(record.at)}`,
    start: `${ship(record.hunter)} started it. The fight began at ${RANGE_NAME[record.startRange]} distance, in ${TERRAIN_NAME[record.terrain].toLowerCase()}.`,
    ending: endingWords(record, doctrines),
    after,
    rounds: record.rounds.map((_, i) => roundLog(record, doctrines, i)),
  };
}

// ---------- How the Tide went ----------

export interface SummaryRow {
  name: string;
  was: string;
  now: string;
  changed: boolean;
}

const cargoWords = (ship: Ship): string => {
  const parts = CARGO_GOODS.filter((g) => ship.hold[g] > 0).map((g) => `${ship.hold[g]} ${g}`);
  return parts.length > 0 ? parts.join(", ") : "none";
};

const whereWords = (ship: Ship): string => `${placeName(ship.waterId)}${ship.docked ? " (docked)" : " (at sea)"}`;

/** Your ship and chest before and after the Tide, one row per thing worth knowing. */
export function summaryRows(before: SeasonState, result: TideResult): SummaryRow[] {
  const a = before.ships[YOUR_SHIP] as Ship, b = result.state.ships[YOUR_SHIP] as Ship;
  const ca = before.captains[YOU] as Captain, cb = result.state.captains[YOU] as Captain;
  const row = (name: string, was: string | number, now: string | number): SummaryRow => ({ name, was: String(was), now: String(now), changed: String(was) !== String(now) });
  return [
    row("Where", whereWords(a), whereWords(b)),
    row(`Hull (of ${maxHullPoints(b)})`, Math.round(a.hullPoints), Math.round(b.hullPoints)),
    row(`Rigging (of ${maxRiggingPoints(b)})`, Math.round(a.riggingPoints), Math.round(b.riggingPoints)),
    row(`Hands (of ${maxHands(b)})`, Math.round(a.hands), Math.round(b.hands)),
    row("Doubloons in your chest (safe)", ca.chest, cb.chest),
    row("Doubloons aboard (can be taken)", a.plunder, b.plunder),
    row("Cargo", cargoWords(a), cargoWords(b)),
    row("Powder", a.hold.powder, b.hold.powder),
    row("Provisions", a.hold.provisions, b.hold.provisions),
    row("Bounty on your head", ca.bounty, cb.bounty),
  ];
}

/** Places you had not Charted before the Tide and have now. */
export function newlyCharted(before: SeasonState, result: TideResult): string[] {
  const was = (before.captains[YOU] as Captain).knowledge, now = (result.state.captains[YOU] as Captain).knowledge;
  return [...world.map.waters, ...world.map.sites]
    .filter((p) => levelOf(now, p.id) >= LEVEL.charted && levelOf(was, p.id) < LEVEL.charted)
    .map((p) => p.name);
}

/** One line for each other ship: where it ended and in what shape. */
export function othersWords(result: TideResult): string[] {
  return Object.keys(result.state.ships).sort().filter((id) => id !== YOUR_SHIP).map((id) => {
    const s = result.state.ships[id] as Ship;
    return `${s.name}: ${whereWords(s)}, Hull ${Math.round(s.hullPoints)} of ${maxHullPoints(s)}, ${doubloons(s.plunder)} aboard.`;
  });
}
