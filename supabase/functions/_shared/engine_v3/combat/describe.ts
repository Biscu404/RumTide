// A battle told in plain words, round by round (P2.4). Used by formatReplay and `npm run tide:demo`.
// Pure: it reads a BattleRecord and its aftermath and returns lines of text.

import { CARGO_GOODS } from "../types.ts";
import type { Terrain } from "../types.ts";
import type { Carried } from "./loot.ts";
import { BATTLE_SIDES } from "./types.ts";
import type {
  BattleAftermath, BattleRecord, BattleSide, DamageTrack, GunsOrder, HelmMove, Range, RoundRecord, RoundShipRecord,
} from "./types.ts";

const RANGE: Record<Range, string> = { long: "Long", medium: "Medium", close: "Close", grappled: "Grappled" };
const HELM: Record<HelmMove, string> = { closeIn: "Close In", hold: "Hold", openRange: "Open Range", crossTheirBow: "Cross Their Bow" };
const GUNS: Record<GunsOrder, string> = {
  roundShot: "Round shot", chainShot: "Chain shot", grapeshot: "Grapeshot", holdFire: "Hold Fire", board: "Board", repel: "Repel",
};
const TRACK: Record<DamageTrack, string> = { hull: "Hull", rigging: "Rigging", hands: "Hands" };
const TERRAIN: Record<Terrain, string> = {
  open: "on open water", shallows: "in the Shallows", reef: "on a Reef", rocky: "in rocky water", fog: "in Fog", kelp: "in Kelp",
  strongCurrent: "in a Strong Current", harbour: "in a Harbour",
};

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");
const percent = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** "30 doubloons and 2 rum", or "nothing". */
export function describeCarried(c: Carried): string {
  const parts: string[] = [];
  if (c.plunder > 0) parts.push(plural(c.plunder, "doubloon"));
  for (const good of CARGO_GOODS) {
    const units = c.goods[good] ?? 0;
    if (units > 0) parts.push(`${units} ${good}`);
  }
  if (parts.length === 0) return "nothing";
  return parts.length === 1 ? (parts[0] as string) : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export interface BattleWords {
  place: (id: string) => string; // a water or a lane, as the player would say it
}

function roundLines(record: BattleRecord, round: RoundRecord): string[] {
  const names: Record<BattleSide, string> = {
    hunter: record.ships[0]?.name ?? record.hunter,
    target: record.ships[1]?.name ?? record.target,
  };
  const ship = (side: BattleSide): RoundShipRecord => round.ships[side === "hunter" ? 0 : 1] as RoundShipRecord;
  const lines: string[] = [`Round ${round.round}, at ${RANGE[round.rangeBefore]} range.`];

  if (round.struck.length > 0) {
    for (const side of round.struck) lines.push(`  ${names[side]} strikes its colours. Nothing else happens this round.`);
    return lines;
  }

  for (const side of BATTLE_SIDES) {
    const s = ship(side);
    const rule = s.rule < 0 ? "no rule fits, so the fallback" : `rule ${s.rule + 1}`;
    const jettison = s.jettison ? " It heaves its cargo over the side." : "";
    lines.push(`  ${names[side]} plays ${HELM[s.helm]} and ${GUNS[s.guns]} (${rule}).${jettison}`);
  }
  for (const c of round.contests) {
    const what = c.kind === "chase" ? "the chase" : c.kind === "shallows" ? "reaching Close in the Shallows" : "cutting free";
    lines.push(`  Helm contest for ${what}: ${names[c.winner]} wins (${names[c.side]} had a ${percent(c.chance)} chance).`);
  }
  for (const side of BATTLE_SIDES) {
    if (ship(side).scrape > 0) lines.push(`  ${names[side]} scrapes the reef and loses ${ship(side).scrape} Hull.`);
  }
  if (round.escaped) {
    lines.push("  Both ships turn away past Long range, and the fight is over.");
  } else {
    lines.push(
      round.rangeAfter === round.rangeBefore
        ? `  The range stays ${RANGE[round.rangeAfter]}.`
        : `  The range goes from ${RANGE[round.rangeBefore]} to ${RANGE[round.rangeAfter]}.`,
    );
    for (const g of round.grapples) {
      lines.push(g.ok ? `  ${names[g.side]} grapples the enemy.` : `  ${names[g.side]} tries to grapple and fails.`);
    }
    for (const side of BATTLE_SIDES) {
      const shot = ship(side).shot;
      if (shot.track) {
        lines.push(
          shot.damage > 0
            ? `  ${names[side]}'s ${GUNS[ship(side).guns]} takes ${shot.damage} ${TRACK[shot.track]} off ${names[other(side)]}.`
            : `  ${names[side]}'s ${GUNS[ship(side).guns]} does no harm to ${names[other(side)]}.`,
        );
      } else if (ship(side).guns === "holdFire") {
        lines.push(`  ${names[side]} holds fire and saves the shot for next round.`);
      }
    }
    if (round.melee) {
      const m = round.melee;
      lines.push(
        `  The crews fight hand to hand: ${names.hunter} (strength ${m.strength.hunter}) loses ${plural(m.lost.hunter, "Hand")}, `
        + `${names.target} (strength ${m.strength.target}) loses ${plural(m.lost.target, "Hand")}. `
        + `${m.hands.hunter} and ${m.hands.target} Hands are left.`,
      );
    }
  }
  for (const side of round.crippled) lines.push(`  ${names[side]}'s Rigging is gone. It is Crippled and cannot Open Range or Cross Their Bow.`);
  return lines;
}

/** The whole battle, then what it changed in the world. The first line is the header; the rest are indented. */
export function describeBattle(record: BattleRecord, aftermath: BattleAftermath, words: BattleWords): string[] {
  const hunter = record.ships[0]?.name ?? record.hunter;
  const target = record.ships[1]?.name ?? record.target;
  const nameOf = (id: string | null) => (id === record.hunter ? hunter : id === record.target ? target : String(id));
  const gauge = record.gauge ? `${record.gauge === "hunter" ? hunter : target} holds the wind gauge.` : "Nobody holds the wind gauge.";
  const lines: string[] = [
    `BATTLE at ${words.place(record.at)}: ${hunter} (${record.doctrines.hunter}) against ${target} (${record.doctrines.target}). `
    + `They fight ${TERRAIN[record.terrain]}, in a ${record.wind}. They start at ${RANGE[record.startRange]} range. ${gauge}`,
  ];
  for (const round of record.rounds) for (const line of roundLines(record, round)) lines.push("  " + line);

  const o = record.outcome;
  const winner = o.winner ? (o.winner === "hunter" ? hunter : target) : null;
  const loser = o.loser ? (o.loser === "hunter" ? hunter : target) : null;
  switch (o.kind) {
    case "sunk": lines.push(`  ${loser} is sunk in round ${o.round}. ${winner} wins.`); break;
    case "captured": lines.push(`  ${winner} wins the boarding in round ${o.round}. ${loser} is captured.`); break;
    case "struckColours": lines.push(`  ${loser} has struck its colours. ${winner} wins.`); break;
    case "victory": lines.push(`  ${winner} wins on points after round ${o.round}.`); break;
    case "escaped": lines.push(`  Escaped: the ships part in round ${o.round}. Nobody wins and nobody loses anything.`); break;
    case "draw": lines.push(`  A draw after round ${o.round}. Nobody wins and nobody loses anything.`); break;
    case "crippled": lines.push(`  ${loser} is crippled.`); break;
  }

  const a = aftermath;
  if (a.loot && describeCarried(a.loot.taken) === "nothing") {
    lines.push(`  ${nameOf(a.winner)} finds nothing worth taking on ${nameOf(a.loser)}.`);
  } else if (a.loot) {
    const notes: string[] = [];
    if (a.pvp && a.loot.fairness !== 1) notes.push(`the fairness factor is ${a.loot.fairness.toFixed(2)}`);
    if (a.loot.cradle !== 1) notes.push("loot is halved in the Cradle");
    if (a.loot.capped) notes.push("the per battle cap applies");
    lines.push(`  ${nameOf(a.winner)} takes ${describeCarried(a.loot.taken)} (${percent(a.loot.share)} of what ${nameOf(a.loser)} carried${notes.length ? ", " + notes.join(", ") : ""}).`);
  }
  if (a.wreck) lines.push(`  ${describeCarried(a.wreck)} is left in a Wreck at ${words.place(a.wreck.water)} until Tide ${a.wreck.untilTide}.`);
  for (const f of a.flotsam) lines.push(`  ${describeCarried(f)} floats free at ${words.place(f.water)} until Tide ${f.untilTide}.`);
  if (a.bounty.collected > 0) lines.push(`  ${nameOf(a.winner)} collects the ${a.bounty.collected} doubloon bounty on ${nameOf(a.loser)}.`);
  if (a.bounty.added > 0) lines.push(`  The Admiralty puts a ${a.bounty.added} doubloon bounty on ${nameOf(a.winner)}.`);
  if (a.shieldUntil !== null) lines.push(`  ${nameOf(a.loser)} is shielded from other players until Tide ${a.shieldUntil}.`);
  return lines;
}
