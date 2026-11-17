// Plain words for the sandbox battle viewer (docs/briefs/sandbox.md, stage 1). Everything here only reads a BattleRecord
// and a Doctrine and says what they hold, for someone who never read the rules. It decides nothing.

import { NO_RULE } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  BattleRecord, BattleShip, BattleSide, DamageTrack, DeckOrder, Doctrine, DoctrineAction, DoctrineCondition, DoctrineRule, GunsOrder,
  HelmMove, Mood, Range, RoundRecord, RoundShipRecord,
} from "../../supabase/functions/_shared/engine_v3/index.ts";

// ---------- Names ----------

export const RANGE_NAME: Record<Range, string> = { far: "Far", long: "Long", medium: "Medium", short: "Short", close: "Close", grappled: "Grappled" };

export const HELM_NAME: Record<HelmMove, string> = { closeIn: "Close In", hold: "Hold", openRange: "Open Range", crossTheirBow: "Cross Their Bow" };

export const HELM_HINT: Record<HelmMove, string> = {
  closeIn: "sail nearer",
  hold: "keep this distance",
  openRange: "sail away",
  crossTheirBow: "cut across their front for a harder shot",
};

export const GUNS_NAME: Record<GunsOrder, string> = {
  roundShot: "Round shot", chainShot: "Chain shot", grapeshot: "Grapeshot", holdFire: "Hold Fire", board: "Board", repel: "Repel",
  mortar: "Mortar", hotShot: "Hot Shot", charge: "Charge", volley: "Volley", firePots: "Fire Pots",
};

export const GUNS_HINT: Record<GunsOrder, string> = {
  roundShot: "cannon fire at their Hull",
  chainShot: "cannon fire at their Rigging",
  grapeshot: "cannon fire at their Hands",
  holdFire: "no shot now, a harder one next round",
  board: "throw hooks and lash the ships together",
  repel: "pikes at the rail, beats a Charge",
  mortar: "a slow shell at their Hull, best from far off",
  hotShot: "glowing shot at their Hull that can start a fire",
  charge: "storm their deck, beats a Volley",
  volley: "muskets across the rail, beats a Repel",
  firePots: "throw burning pitch onto their deck",
};

export const DECK_NAME: Record<DeckOrder, string> = { charge: "Charge", volley: "Volley", repel: "Repel", firePots: "Fire Pots", fists: "bare fists" };
export const TRACK_NAME: Record<DamageTrack, string> = { hull: "Hull", rigging: "Rigging", hands: "Hands" };
const MOOD_WORDS: Record<Mood, string> = {
  closing: "he is still coming closer",
  rearing: "he is rearing up",
  grappling: "he has reared up and now wants to grab",
};

const pct = (chance: number): string => `${Math.round(chance * 100)}%`;
const whole = (n: number): number => Math.round(n);

// ---------- A doctrine as if then rules ----------

export function conditionWords(c: DoctrineCondition): string {
  switch (c.kind) {
    case "range": {
      const name = RANGE_NAME[c.range];
      if (c.op === "is") return c.range === "grappled" ? "the ships are Grappled" : `the distance is ${name}`;
      return c.op === "atMost" ? `the distance is ${name} or nearer` : `the distance is ${name} or farther`;
    }
    case "round": return c.op === "is" ? `it is round ${c.n}` : `it is round ${c.n} or later`;
    case "track": return `${c.who === "mine" ? "my" : "their"} ${TRACK_NAME[c.track]} ${c.track === "hull" || c.track === "rigging" ? "is" : "are"} ${c.op} ${c.pct}%`;
    case "theirLastHelm": return `they played ${HELM_NAME[c.move]} last round`;
    case "theirLastGuns": return `they played ${GUNS_NAME[c.order]} last round`;
    case "enemyType": return `the enemy is a ${c.type}`;
    case "enemyCaptain": return `the enemy is the captain ${c.captainId}`;
    case "theirStyle": return `the enemy is a ${c.style}`;
    case "mood": return MOOD_WORDS[c.mood];
    case "terrain": return `the water is ${c.terrain}`;
    case "windGauge": return c.holder === "mine" ? "the wind favours me" : "the wind favours them";
    case "havePowder": return "I have Powder left";
    case "haveFirePots": return "I have Fire Pots left";
    case "abilityUnused": return `I have not used ${c.ability} yet`;
  }
}

export function actionWords(a: DoctrineAction): string {
  switch (a.kind) {
    case "fight": return `${HELM_NAME[a.helm]} and ${GUNS_NAME[a.guns]}`;
    case "ability": return `use ${a.ability}`;
    case "surrender": return "Surrender";
    case "jettison": return "throw the cargo overboard";
  }
}

/** One rule as a sentence: "IF the distance is Short or nearer THEN Open Range and Round shot", or "OTHERWISE ..." for the last. */
export const ruleWords = (rule: DoctrineRule): string =>
  rule.if.length === 0 ? `OTHERWISE ${actionWords(rule.then)}` : `IF ${rule.if.map(conditionWords).join(" and ")} THEN ${actionWords(rule.then)}`;

/** A doctrine as numbered rules, in the order the ship reads them. */
export const doctrineWords = (doctrine: Doctrine): string[] => doctrine.rules.map(ruleWords);

// ---------- A round in normal words ----------

export interface ShipLog {
  side: BattleSide;
  name: string;
  lines: string[];
}

export interface RoundLog {
  round: number;
  title: string;
  ships: ShipLog[]; // the left ship first
  events: string[]; // what happened between the ships
}

const otherSide = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

/** The two flagships of a one ship a side battle, by side. */
export function shipsBySide(ships: readonly BattleShip[]): Record<BattleSide, BattleShip> {
  const hunter = ships.find((s) => s.side === "hunter");
  const target = ships.find((s) => s.side === "target");
  if (!hunter || !target) throw new Error("A battle needs a ship on each side");
  return { hunter, target };
}

/** Hull, Rigging and Hands of each side when `shown` rounds have been played (0 is the start). */
export function stateAt(record: BattleRecord, shown: number): Record<BattleSide, { hull: number; rigging: number; hands: number }> {
  const start = shipsBySide(record.ships);
  const out = {
    hunter: { hull: start.hunter.hullPoints, rigging: start.hunter.riggingPoints, hands: start.hunter.hands },
    target: { hull: start.target.hullPoints, rigging: start.target.riggingPoints, hands: start.target.hands },
  };
  const round = record.rounds[shown - 1];
  if (!round) return out;
  for (const side of ["hunter", "target"] as const) {
    const r = round.ships.find((s) => s.ship === start[side].shipId);
    if (r) out[side] = { hull: r.hullPoints, rigging: r.riggingPoints, hands: r.hands };
  }
  return out;
}

/** The distance when `shown` rounds have been played. */
export const rangeAt = (record: BattleRecord, shown: number): Range => record.rounds[shown - 1]?.rangeAfter ?? record.startRange;

function lossWords(before: { hull: number; rigging: number; hands: number }, after: { hull: number; rigging: number; hands: number }): string | null {
  const parts: string[] = [];
  if (before.hull - after.hull > 0) parts.push(`${whole(before.hull - after.hull)} Hull`);
  if (before.rigging - after.rigging > 0) parts.push(`${whole(before.rigging - after.rigging)} Rigging`);
  if (before.hands - after.hands > 0) parts.push(`${whole(before.hands - after.hands)} Hands`);
  return parts.length > 0 ? `Lost this round: ${parts.join(", ")}.` : null;
}

function shipLines(
  r: RoundShipRecord, doctrine: Doctrine, struck: boolean, enemy: string, grappledBefore: boolean,
): string[] {
  const lines: string[] = [];
  const rule = doctrine.rules[r.rule];
  const ruleLine = r.rule === NO_RULE || !rule ? "No rule fitted, so it played the fallback." : `Rule ${r.rule + 1} fired: ${ruleWords(rule)}.`;
  if (struck) return [ruleLine, "It struck its colours and gave up."];
  lines.push(ruleLine);
  if (r.mood === "rearing") lines.push("He rears up: he holds still, and this round his shell does not protect him.");
  if (r.tell) lines.push("He is gathering himself. He rears up next round.");
  lines.push(`Helm: ${HELM_NAME[r.helm]} (${HELM_HINT[r.helm]}).`);
  if (rule?.then.kind === "fight" && rule.then.helm !== r.helm) {
    lines.push(`Its rule said ${HELM_NAME[rule.then.helm]}, but with no Rigging left it is Crippled and can only hold or close in.`);
  }
  lines.push(`Guns: ${GUNS_NAME[r.guns]} (${GUNS_HINT[r.guns]}).`);
  if (r.asked) lines.push(`Its rule said ${GUNS_NAME[r.asked]}, which this ship cannot fire.`);
  if (r.mortar) {
    lines.push(r.mortar.hit ? `The shell hit and took ${whole(r.shot.damage)} Hull off ${enemy}.` : "The shell missed.");
  } else if (r.shot.track && r.shot.damage > 0) {
    lines.push(`The shot took ${whole(r.shot.damage)} ${TRACK_NAME[r.shot.track]} off ${enemy}.`);
  } else if (r.shot.track && grappledBefore) {
    lines.push("The cannons cannot fire while the ships are lashed together.");
  } else if (r.shot.track) {
    lines.push("The shot did no damage.");
  }
  if (r.shell !== undefined && r.shell < 1) lines.push("His shell soaked up part of the shot.");
  if (r.shell !== undefined && r.shell > 1) lines.push("The shell cracked his armour for extra damage.");
  if (r.deck) {
    const how = r.deck.pairing === "won" ? "which beat the enemy's order" : r.deck.pairing === "lost" ? "which lost to the enemy's order" : "an even match";
    lines.push(`Deck fight: it fought with ${DECK_NAME[r.deck.order]}, ${how}.`);
    if (r.deck.thrown) lines.push(r.deck.thrown.fire ? "Its Fire Pot caught." : "Its Fire Pot did not catch.");
  }
  if (r.fire) lines.push(`It is on fire: the flames burned ${whole(r.fire.hull)} Hull${r.fire.left > 0 ? ` and burn ${r.fire.left} more round${r.fire.left === 1 ? "" : "s"}` : ""}.`);
  if (r.scrape > 0) lines.push(`It scraped a reef and lost ${whole(r.scrape)} Hull.`);
  if (r.jettison) lines.push("It threw its cargo overboard.");
  return lines;
}

type Contest = RoundRecord["contests"][number];

const CONTEST_WORDS: Record<Exclude<Contest["kind"], "cutFree" | "ram">, string> = {
  chase: "won the race between closing in and getting away",
  shallows: "kept control in the shallows",
  dash: "won the dash across the bow",
  grapnel: "won the struggle over the grapnel hooks",
};

/** One Helm contest as a sentence, with the chance the winner had. A Ram's contest is told by the Ram itself. */
export function contestWords(c: Contest, names: Record<BattleSide, string>): string | null {
  if (c.kind === "ram") return null;
  const chance = `it had a ${pct(c.winner === c.side ? c.chance : 1 - c.chance)} chance`;
  if (c.kind === "cutFree") {
    return c.winner === c.side ? `${names[c.winner]} cut the ships apart and got free (${chance}).` : `${names[c.winner]} kept the ships lashed together (${chance}).`;
  }
  return `${names[c.winner]} ${CONTEST_WORDS[c.kind]} (${chance}).`;
}

function eventLines(round: RoundRecord, names: Record<BattleSide, string>, nameOfShip: (id: string) => string): string[] {
  const out: string[] = [];
  if (round.overtime) out.push("Extra round: the deck fight was still going.");
  for (const c of round.contests) {
    const line = contestWords(c, names);
    if (line) out.push(line);
  }
  for (const ram of round.rams ?? []) {
    const rammer = names[ram.side];
    const struck = names[otherSide(ram.side)];
    out.push(ram.hit ? `${rammer} rammed ${struck}: ${struck} lost ${whole(ram.hull)} Hull and ${rammer} lost ${whole(ram.self)}.` : `${rammer} tried to ram and missed.`);
  }
  for (const g of round.grapples) {
    const who = names[g.side];
    if (g.why === "snatch") out.push(`${who} snatched ${names[otherSide(g.side)]} with his claws as it crossed in front of him.`);
    else if (g.ok) out.push(`${who} threw the hooks and they held. The ships are lashed together.`);
    else out.push(`${who} tried to board, but the hooks did not hold.`);
  }
  for (const f of round.fires ?? []) {
    if (f.rounds > 0) out.push(`${nameOfShip(f.ship)} caught fire. It will burn for ${f.rounds} round${f.rounds === 1 ? "" : "s"}.`);
    else out.push(`A Fire Pot flashed on the deck of ${nameOfShip(f.ship)} and cost it ${whole(f.hull ?? 0)} Hull.`);
  }
  if (round.melee) {
    const m = round.melee;
    out.push(`The crews fought hand to hand: ${names.hunter} lost ${whole(m.lost.hunter)} Hands and ${names.target} lost ${whole(m.lost.target)}.`);
  }
  for (const side of round.crippled) out.push(`${names[side]} has no Rigging left. It is Crippled: it can no longer sail away or cross their bow.`);
  if (round.escaped) out.push("The ships drew apart past Far and lost each other.");
  else if (round.rangeBefore === round.rangeAfter) out.push(`The distance stayed at ${RANGE_NAME[round.rangeAfter]}.`);
  else out.push(`The distance went from ${RANGE_NAME[round.rangeBefore]} to ${RANGE_NAME[round.rangeAfter]}.`);
  return out;
}

/** Round `index` (0 based) of a one ship a side battle, in plain words. */
export function roundLog(record: BattleRecord, doctrines: Record<BattleSide, Doctrine>, index: number): RoundLog {
  const round = record.rounds[index];
  if (!round) throw new Error(`No round ${index + 1} in this battle`);
  const start = shipsBySide(record.ships);
  const names: Record<BattleSide, string> = { hunter: start.hunter.name, target: start.target.name };
  const before = stateAt(record, index);
  const after = stateAt(record, index + 1);
  const ships: ShipLog[] = (["hunter", "target"] as const).map((side) => {
    const r = round.ships.find((s) => s.ship === start[side].shipId)!;
    const lines = shipLines(r, doctrines[side], round.struck.includes(side), names[otherSide(side)], round.rangeBefore === "grappled");
    const lost = lossWords(before[side], after[side]);
    if (lost) lines.push(lost);
    return { side, name: names[side], lines };
  });
  const nameOfShip = (id: string): string => record.ships.find((s) => s.shipId === id)?.name ?? id;
  return { round: round.round, title: `Round ${round.round}`, ships, events: eventLines(round, names, nameOfShip) };
}

// ---------- The ending ----------

export interface Ending {
  headline: string; // who won
  how: string; // Sunk, Captured, Escaped, Surrendered, Won on points or Draw
  why: string; // one line
}

export function endingWords(record: BattleRecord, doctrines: Record<BattleSide, Doctrine>): Ending {
  const start = shipsBySide(record.ships);
  const names: Record<BattleSide, string> = { hunter: start.hunter.name, target: start.target.name };
  const o = record.outcome;
  const winner = o.winner ? names[o.winner] : "";
  const loser = o.loser ? names[o.loser] : "";
  const last = record.rounds[record.rounds.length - 1];
  switch (o.kind) {
    case "sunk":
      return { headline: `${winner} wins`, how: "Sunk", why: `${loser} ran out of Hull in round ${o.round} and went down.` };
    case "captured":
      return { headline: `${winner} wins`, how: "Captured", why: `${loser} had too few Hands left to hold its own deck in round ${o.round}, so ${winner} took the ship.` };
    case "struckColours": {
      if (o.drivenOff) {
        const cause = o.drivenOff === "hull" ? "his Hull was beaten low enough" : "too many of his claws were broken";
        return { headline: `${winner} wins`, how: "Driven off", why: `${loser} pulled back into his shell in round ${o.round}, because ${cause}.` };
      }
      const r = o.loser ? last?.ships.find((s) => s.ship === start[o.loser!].shipId) : undefined;
      const rule = r && o.loser ? doctrines[o.loser].rules[r.rule] : undefined;
      const because = rule ? `, because its own doctrine told it to (rule ${r!.rule + 1}: ${ruleWords(rule)})` : "";
      return { headline: `${winner} wins`, how: "Surrendered", why: `${loser} gave up in round ${o.round}${because}.` };
    }
    case "escaped": {
      const runners = last ? last.ships.filter((s) => s.helm === "openRange").map((s) => record.ships.find((b) => b.shipId === s.ship)?.name ?? s.ship) : [];
      const who = runners.length > 0 ? `${runners.join(" and ")} sailed away` : "The ships drew apart";
      return { headline: "Nobody wins", how: "Escaped", why: `${who} past Far in round ${o.round}, so the fight ended with no winner.` };
    }
    case "victory":
      return {
        headline: `${winner} wins`, how: "Won on points",
        why: `Nobody was finished after ${o.round} rounds. ${winner} had done more harm (${pct(record.dealt[o.winner!])} of the enemy against ${pct(record.dealt[o.loser!])}).`,
      };
    case "draw":
      return {
        headline: "Nobody wins", how: "Draw",
        why: `After ${o.round} rounds the harm done was too close to call (${pct(record.dealt.hunter)} against ${pct(record.dealt.target)}).`,
      };
    case "crippled":
      return { headline: "Nobody wins", how: "Crippled", why: "A ship lost all its Rigging." };
  }
}
