// The short story of one round for the sandbox battle viewer, and the facts the picture animates from.
// Everything here only reads a BattleRecord and a Doctrine. It decides nothing and changes no outcome.

import { NO_RULE, RANGES } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleRecord, BattleSide, Doctrine, DoctrineRule, GunsOrder, Range, RoundRecord, RoundShipRecord } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { DECK_NAME, GUNS_NAME, HELM_HINT, HELM_NAME, RANGE_NAME, TRACK_NAME, conditionWords, contestWords, shipsBySide, stateAt } from "./words.ts";

const otherSide = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");
const pct = (chance: number): string => `${Math.round(chance * 100)}%`;
const whole = (n: number): number => Math.round(n);
const plural = (n: number, word: string): string => `${n} ${word}`;

/** What a ship does with each Guns order, in plain verbs, for "because rule 2 says: if ..., sail away and fire Round shot". */
const GUNS_DO: Record<GunsOrder, string> = {
  roundShot: "fire Round shot", chainShot: "fire Chain shot", grapeshot: "fire Grapeshot", holdFire: "hold fire", board: "throw the hooks",
  repel: "repel boarders", mortar: "fire the Mortar", hotShot: "fire Hot Shot", charge: "charge their deck", volley: "fire a Volley", firePots: "throw Fire Pots",
};

// ---------- What each ship chose, and why ----------

export interface Choice {
  side: BattleSide;
  name: string;
  line: string;
}

/** The one rule that fired, as "rule 1 says: if the ships are Grappled, sail away and repel boarders". */
function becauseWords(rule: DoctrineRule | undefined, index: number): string {
  if (index === NO_RULE || !rule) return "no rule fitted, so it played its fallback";
  const action = rule.then;
  const todo = action.kind === "fight"
    ? `${HELM_HINT[action.helm]} and ${GUNS_DO[action.guns]}`
    : action.kind === "surrender" ? "give up" : action.kind === "jettison" ? "throw the cargo overboard" : `use ${action.ability}`;
  if (rule.if.length === 0) return `none of the rules above fitted, so rule ${index + 1} (the last one) says: ${todo}`;
  return `rule ${index + 1} says: if ${rule.if.map(conditionWords).join(" and ")}, ${todo}`;
}

function choiceLine(name: string, r: RoundShipRecord, doctrine: Doctrine, struck: boolean): string {
  const rule = doctrine.rules[r.rule];
  const because = becauseWords(rule, r.rule);
  if (struck) return `${name} chose to surrender, because ${because}.`;
  let line = `${name} chose ${HELM_NAME[r.helm]} and ${GUNS_NAME[r.guns]}, because ${because}.`;
  if (rule?.then.kind === "fight" && rule.then.helm !== r.helm) {
    line += ` It has no Rigging left, so it could only play ${HELM_NAME[r.helm]} instead of ${HELM_NAME[rule.then.helm]}.`;
  }
  if (r.asked) line += ` Its rule asked for ${GUNS_NAME[r.asked]}, which this ship cannot fire, so it fired Round shot.`;
  if (r.mood === "rearing") line += " He is rearing up this round and his shell does not protect him.";
  if (r.tell) line += " He is gathering himself: he rears up next round.";
  return line;
}

// ---------- What happened when the choices met ----------

type Losses = { hull: number; rigging: number; hands: number };

function hooksLine(g: RoundRecord["grapples"][number], round: RoundRecord, names: Record<BattleSide, string>): string {
  const who = names[g.side];
  const foe = names[otherSide(g.side)];
  const roll = round.contests.find((c) => c.kind === "grapnel" && c.side === g.side);
  if (g.why === "snatch") return `${who} snatched ${foe} with his claws as it crossed in front of him.`;
  if (g.ok) {
    if (g.why === "grapnels" && roll) return `${who} threw the hooks and missed at first, but the grapnel lines had a ${pct(roll.chance)} chance and took hold. The ships are lashed together.`;
    if (g.why === "theyBoard") return `${who} threw the hooks, and because ${foe} was boarding too they held. The ships are lashed together.`;
    if (g.why === "theyHold") return `${who} threw the hooks, and because ${foe} held still they held. The ships are lashed together.`;
    return `${who} threw the hooks and steered well enough for them to hold. The ships are lashed together.`;
  }
  if (roll) return `${who} tried to board, but the hooks did not hold (the grapnel lines had a ${pct(roll.chance)} chance and missed).`;
  return `${who} tried to board, but the hooks did not hold.`;
}

function shotWords(r: RoundShipRecord, name: string, enemy: string): string | null {
  if (r.mortar) return r.mortar.hit ? `${name}'s Mortar shell hit and took ${whole(r.shot.damage)} Hull off ${enemy}` : `${name}'s Mortar shell missed`;
  if (r.shot.track && r.shot.damage > 0) return `${name}'s ${GUNS_NAME[r.guns]} took ${whole(r.shot.damage)} ${TRACK_NAME[r.shot.track]} off ${enemy}`;
  return null;
}

function deckWords(round: RoundRecord, ships: Record<BattleSide, RoundShipRecord | undefined>, names: Record<BattleSide, string>): string | null {
  const m = round.melee;
  if (!m) return null;
  const hunter = ships.hunter?.deck;
  const target = ships.target?.deck;
  const lost = `${names.target} lost ${plural(whole(m.lost.target), "Hands")} and ${names.hunter} lost ${whole(m.lost.hunter)}`;
  const lostHunterFirst = `${names.hunter} lost ${plural(whole(m.lost.hunter), "Hands")} and ${names.target} lost ${whole(m.lost.target)}`;
  if (hunter && target) {
    if (hunter.pairing === "won") return `${DECK_NAME[hunter.order]} beat ${DECK_NAME[target.order]}, so ${lost}.`;
    if (hunter.pairing === "lost") return `${DECK_NAME[target.order]} beat ${DECK_NAME[hunter.order]}, so ${lostHunterFirst}.`;
    return `${DECK_NAME[hunter.order]} against ${DECK_NAME[target.order]} was an even match, so ${lostHunterFirst}.`;
  }
  return `The crews fought hand to hand: ${lostHunterFirst}.`;
}

function meetingLines(record: BattleRecord, round: RoundRecord, names: Record<BattleSide, string>): string[] {
  const start = shipsBySide(record.ships);
  const ships: Record<BattleSide, RoundShipRecord | undefined> = {
    hunter: round.ships.find((s) => s.ship === start.hunter.shipId),
    target: round.ships.find((s) => s.ship === start.target.shipId),
  };
  const nameOfShip = (id: string): string => record.ships.find((s) => s.shipId === id)?.name ?? id;
  const struckSide = round.struck[0];
  if (struckSide) return [`${names[struckSide]} struck its colours and gave up, so nothing else happened this round.`];
  const out: string[] = [];

  // 1. The Helm: both moves, who won any race, and the new distance.
  if (round.escaped) out.push("The ships drew apart past Far and lost each other.");
  else if (round.rangeBefore === round.rangeAfter) out.push(`The distance stayed at ${RANGE_NAME[round.rangeAfter]}.`);
  else out.push(`The distance went from ${RANGE_NAME[round.rangeBefore]} to ${RANGE_NAME[round.rangeAfter]}.`);
  for (const c of round.contests) {
    if (c.kind === "grapnel") continue; // told by the grapple line, with its chance
    const line = contestWords(c, names);
    if (line) out.push(line);
  }
  for (const g of round.grapples) out.push(hooksLine(g, round, names));
  for (const ram of round.rams ?? []) {
    const rammer = names[ram.side];
    const struck = names[otherSide(ram.side)];
    out.push(ram.hit ? `${rammer} rammed ${struck}: ${struck} lost ${whole(ram.hull)} Hull and ${rammer} lost ${whole(ram.self)}.` : `${rammer} tried to ram and missed.`);
  }

  // 2. What the guns or the crews did.
  const deck = deckWords(round, ships, names);
  const shots = (["hunter", "target"] as const)
    .map((side) => (ships[side] ? shotWords(ships[side]!, names[side], names[otherSide(side)]) : null))
    .filter((s): s is string => s !== null);
  if (shots.length > 0) out.push(`${shots.join(", and ")}.`);
  else if (!deck && round.rangeBefore !== "grappled") out.push("No shot did any damage this round.");
  if (deck) out.push(deck);

  // 3. The rest, only when it happened.
  for (const f of round.fires ?? []) {
    if (f.rounds > 0) out.push(`${nameOfShip(f.ship)} caught fire and will burn for ${f.rounds} round${f.rounds === 1 ? "" : "s"}.`);
    else out.push(`A Fire Pot flashed on the deck of ${nameOfShip(f.ship)} and cost it ${whole(f.hull ?? 0)} Hull.`);
  }
  for (const side of ["hunter", "target"] as const) {
    const r = ships[side];
    if (r?.fire) out.push(`The fire on ${names[side]} burned ${whole(r.fire.hull)} Hull.`);
    if (r && r.scrape > 0) out.push(`${names[side]} scraped a reef and lost ${whole(r.scrape)} Hull.`);
  }
  for (const side of round.crippled) out.push(`${names[side]} has no Rigging left and can no longer sail away.`);
  return out;
}

export interface RoundSummary {
  round: number;
  choices: Choice[]; // the left ship first
  meeting: string[]; // what happened when the two choices met
}

/** Round `index` (0 based) as a few plain sentences: what each ship chose and why, then what happened. */
export function roundSummary(record: BattleRecord, doctrines: Record<BattleSide, Doctrine>, index: number): RoundSummary {
  const round = record.rounds[index];
  if (!round) throw new Error(`No round ${index + 1} in this battle`);
  const start = shipsBySide(record.ships);
  const names: Record<BattleSide, string> = { hunter: start.hunter.name, target: start.target.name };
  const choices = (["hunter", "target"] as const).map((side): Choice => {
    const r = round.ships.find((s) => s.ship === start[side].shipId)!;
    return { side, name: names[side], line: choiceLine(names[side], r, doctrines[side], round.struck.includes(side)) };
  });
  return { round: round.round, choices, meeting: meetingLines(record, round, names) };
}

// ---------- What the picture animates ----------

export interface Shot {
  from: BattleSide;
  to: BattleSide;
  kind: "cannon" | "mortar" | "volley";
  hit: boolean; // false is a splash in the water
}

export interface Motion {
  rangeBefore: Range;
  rangeAfter: Range;
  escaped: boolean;
  direction: "closing" | "opening" | "holding";
  hooksThrown: boolean; // the ships were not lashed together before this round and are now
  cutApart: boolean; // the ships were lashed together before this round and are not now
  shots: Shot[];
  lost: Record<BattleSide, Losses>; // what each ship lost this round (never below 0)
}

const rank = (r: Range): number => RANGES.indexOf(r);

/** Round `index` (0 based) as what the picture moves: the distance change, hooks, shots and the damage taken. */
export function roundMotion(record: BattleRecord, index: number): Motion {
  const round = record.rounds[index];
  if (!round) throw new Error(`No round ${index + 1} in this battle`);
  const start = shipsBySide(record.ships);
  const grappledBefore = round.rangeBefore === "grappled";
  const shots: Shot[] = [];
  for (const side of ["hunter", "target"] as const) {
    const r = round.ships.find((s) => s.ship === start[side].shipId);
    if (!r) continue;
    const to = otherSide(side);
    if (r.mortar) shots.push({ from: side, to, kind: "mortar", hit: r.mortar.hit });
    else if (r.shot.track && !grappledBefore && !round.struck.includes(side)) shots.push({ from: side, to, kind: "cannon", hit: r.shot.damage > 0 });
    if (r.deck?.order === "volley" && round.melee) shots.push({ from: side, to, kind: "volley", hit: true });
  }
  const before = stateAt(record, index);
  const after = stateAt(record, index + 1);
  const lostOf = (side: BattleSide): Losses => ({
    hull: Math.max(0, before[side].hull - after[side].hull),
    rigging: Math.max(0, before[side].rigging - after[side].rigging),
    hands: Math.max(0, before[side].hands - after[side].hands),
  });
  const delta = round.escaped ? -1 : rank(round.rangeAfter) - rank(round.rangeBefore);
  return {
    rangeBefore: round.rangeBefore,
    rangeAfter: round.rangeAfter,
    escaped: round.escaped,
    direction: delta > 0 ? "closing" : delta < 0 ? "opening" : "holding",
    hooksThrown: !grappledBefore && round.rangeAfter === "grappled" && !round.escaped,
    cutApart: grappledBefore && (round.rangeAfter !== "grappled" || round.escaped),
    shots,
    lost: { hunter: lostOf("hunter"), target: lostOf("target") },
  };
}
