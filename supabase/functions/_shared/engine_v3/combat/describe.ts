// A battle told in plain words, round by round (P2.4, fleets P2.5). Used by formatReplay and `npm run tide:demo`.
// Pure: it reads a BattleRecord and its aftermath and returns lines of text.

import { CARGO_GOODS } from "../types.ts";
import type { Terrain } from "../types.ts";
import type { Carried } from "./loot.ts";
import { BATTLE_SIDES, DAMAGE_TRACKS } from "./types.ts";
import type {
  BattleAftermath, BattleRecord, BattleSide, ContestRecord, DamageTrack, GunsOrder, HelmMove, Range, RoundRecord, SideBonus,
} from "./types.ts";

// The Fighting Styles have plain names only here; their replay lines (rams, mortar arcs, style badges) are P3.B2 piece 3.
const RANGE: Record<Range, string> = { far: "Far", long: "Long", medium: "Medium", short: "Short", close: "Close", grappled: "Grappled" };
const HELM: Record<HelmMove, string> = { closeIn: "Close In", hold: "Hold", openRange: "Open Range", crossTheirBow: "Cross Their Bow" };
const GUNS: Record<GunsOrder, string> = {
  roundShot: "Round shot", chainShot: "Chain shot", grapeshot: "Grapeshot", holdFire: "Hold Fire", board: "Board", repel: "Repel", mortar: "Mortar",
};
const CONTEST: Record<ContestRecord["kind"], string> = {
  chase: "the chase", shallows: "reaching Close in the Shallows", cutFree: "cutting free", ram: "the ram", dash: "spoiling the rake",
};
const TRACK: Record<DamageTrack, string> = { hull: "Hull", rigging: "Rigging", hands: "Hands" };
const TERRAIN: Record<Terrain, string> = {
  open: "on open water", shallows: "in the Shallows", reef: "on a Reef", rocky: "in rocky water", fog: "in Fog", kelp: "in Kelp",
  strongCurrent: "in a Strong Current", harbour: "in a Harbour",
};

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");
const percent = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const cap = (text: string | null): string => (text ? `${text[0]?.toUpperCase()}${text.slice(1)}` : "");

/** "A", "A and B", "A, B and C". */
const listOf = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

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

/** Who is who in a battle: ship names, and which ships make up each side. */
function cast(record: BattleRecord) {
  const nameOf = (id: string | null): string => record.ships.find((s) => s.shipId === id)?.name ?? String(id);
  const members = (side: BattleSide): string[] => record.fleet?.sides[side] ?? [side === "hunter" ? record.hunter : record.target];
  const flagName = (side: BattleSide): string => nameOf(side === "hunter" ? record.hunter : record.target);
  // A side as one singular phrase: the ship, or "the fleet of" its ships.
  const sideName = (side: BattleSide): string =>
    members(side).length > 1 ? `the fleet of ${listOf(members(side).map(nameOf))}` : flagName(side);
  return { nameOf, members, sideName, flagName };
}

/** What a side's damage bonus is worth, in words; empty for a lone ship. */
function bonusLine(label: string, b: SideBonus): string | null {
  if (b.total <= 1) return null;
  const parts: string[] = [];
  if (b.fleet > 1) parts.push(`fleet bonus ${percent(b.fleet - 1)}`);
  if (b.desperate > 1) parts.push(`Desperate Defence ${percent(b.desperate - 1)}`);
  return `${cap(label)} deals ${percent(b.total - 1)} more damage (${parts.join(", ")}).`;
}

function roundLines(record: BattleRecord, round: RoundRecord): string[] {
  const { nameOf, sideName, flagName, members } = cast(record);
  const lines: string[] = [`Round ${round.round}, at ${RANGE[round.rangeBefore]} range.`];
  const fleet = round.fleet !== undefined;

  if (round.struck.length > 0) {
    for (const side of round.struck) {
      const strikers = (round.fleet?.struck ?? []).filter((id) => members(side).includes(id)).map(nameOf);
      lines.push(
        fleet
          ? `  ${listOf(strikers)} ${strikers.length > 1 ? "strike" : "strikes"} the colours, and ${sideName(side)} stands down. Nothing else happens this round.`
          : `  ${flagName(side)} strikes its colours. Nothing else happens this round.`,
      );
    }
    return lines;
  }

  for (const s of round.ships) {
    const rule = s.rule < 0 ? "no rule fits, so the fallback" : `rule ${s.rule + 1}`;
    const jettison = s.jettison ? " It heaves its cargo over the side." : "";
    const rears = s.exposed ? ` It rears up and shows its soft underside: Round shot does ${s.exposed} times the damage to it.` : "";
    lines.push(`  ${nameOf(s.ship)} plays ${HELM[s.helm]} and ${GUNS[s.guns]} (${rule}).${jettison}${rears}`);
  }
  for (const c of round.contests) {
    const mine = c.ship ? nameOf(c.ship) : flagName(c.side);
    const winner = c.winner === c.side ? mine : flagName(other(c.side));
    lines.push(`  Helm contest for ${CONTEST[c.kind]}: ${winner} wins (${mine} had a ${percent(c.chance)} chance).`);
  }
  for (const s of round.ships) {
    if (s.scrape > 0) lines.push(`  ${nameOf(s.ship)} scrapes the reef and loses ${s.scrape} Hull.`);
  }
  if (round.escaped) {
    lines.push("  Both ships turn away past Far range, and the fight is over.");

  } else {
    lines.push(
      round.rangeAfter === round.rangeBefore
        ? `  The range stays ${RANGE[round.rangeAfter]}.`
        : `  The range goes from ${RANGE[round.rangeBefore]} to ${RANGE[round.rangeAfter]}.`,
    );
    for (const g of round.grapples) {
      const who = g.ship ? nameOf(g.ship) : flagName(g.side);
      lines.push(g.ok ? `  ${who} grapples the enemy.` : `  ${who} tries to grapple and fails.`);
    }
    for (const s of round.ships) {
      const shot = s.shot;
      const side: BattleSide = members("hunter").includes(s.ship) ? "hunter" : "target";
      if (shot.track) {
        if (fleet) {
          lines.push(
            shot.damage > 0
              ? `  ${nameOf(s.ship)}'s ${GUNS[s.guns]} lands ${shot.damage} ${TRACK[shot.track]}.`
              : `  ${nameOf(s.ship)}'s ${GUNS[s.guns]} does no harm.`,
          );
        } else {
          lines.push(
            shot.damage > 0
              ? `  ${nameOf(s.ship)}'s ${GUNS[s.guns]} takes ${shot.damage} ${TRACK[shot.track]} off ${flagName(other(side))}.`
              : `  ${nameOf(s.ship)}'s ${GUNS[s.guns]} does no harm to ${flagName(other(side))}.`,
          );
        }
      } else if (s.guns === "holdFire") {
        lines.push(`  ${nameOf(s.ship)} holds fire and saves the shot for next round.`);
      }
    }
    if (round.fleet) {
      // The damage a fleet receives is shared out between its ships by max Hull (7.5).
      for (const side of BATTLE_SIDES) {
        const hurt = members(side).flatMap((id) => {
          const lost = DAMAGE_TRACKS.filter((t) => (round.fleet?.taken[id]?.[t] ?? 0) > 0).map((t) => `${round.fleet?.taken[id]?.[t]} ${TRACK[t]}`);
          return lost.length > 0 ? [`${nameOf(id)} loses ${listOf(lost)}`] : [];
        });
        if (members(side).length > 1 && hurt.length > 0) lines.push(`  The fire on ${sideName(side)} is shared out by max Hull: ${hurt.join("; ")}.`);
      }
    }
    if (round.melee) {
      const m = round.melee;
      lines.push(
        `  The crews fight hand to hand: ${sideName("hunter")} (strength ${m.strength.hunter}) loses ${plural(m.lost.hunter, "Hand")}, `
        + `${sideName("target")} (strength ${m.strength.target}) loses ${plural(m.lost.target, "Hand")}. `
        + `${m.hands.hunter} and ${m.hands.target} Hands are left.`,
      );
    }
  }
  if (round.fleet) {
    for (const id of round.fleet.crippled) lines.push(`  ${nameOf(id)}'s Rigging is gone. It is Crippled and cannot Open Range or Cross Their Bow.`);
  } else {
    for (const side of round.crippled) lines.push(`  ${flagName(side)}'s Rigging is gone. It is Crippled and cannot Open Range or Cross Their Bow.`);
  }
  return lines;
}

/** The whole battle, then what it changed in the world. The first line is the header; the rest are indented. */
export function describeBattle(record: BattleRecord, aftermath: BattleAftermath, words: BattleWords): string[] {
  const { nameOf, members, sideName, flagName } = cast(record);
  const hunter = flagName("hunter");
  const target = flagName("target");
  const gauge = record.gauge ? `${flagName(record.gauge)} holds the wind gauge.` : "Nobody holds the wind gauge.";
  // A fleet names every ship with its own doctrine; a lone ship names its doctrine.
  const label = (side: BattleSide): string =>
    record.fleet
      ? listOf(members(side).map((id) => `${nameOf(id)} (${record.fleet?.doctrines[id] ?? record.doctrines[side]})`))
      : `${flagName(side)} (${record.doctrines[side]})`;
  const lines: string[] = [
    `BATTLE at ${words.place(record.at)}: ${label("hunter")} against ${label("target")}. `
    + `They fight ${TERRAIN[record.terrain]}, in a ${record.wind}. They start at ${RANGE[record.startRange]} range. ${gauge}`,
  ];
  if (record.fleet) {
    for (const side of BATTLE_SIDES) {
      const line = bonusLine(sideName(side), record.fleet.bonus[side]);
      if (line) lines.push("  " + line);
    }
  }
  for (const round of record.rounds) for (const line of roundLines(record, round)) lines.push("  " + line);

  const o = record.outcome;
  const winner = o.winner ? sideName(o.winner) : null;
  const loser = o.loser ? sideName(o.loser) : null;
  switch (o.kind) {
    case "sunk": {
      // In a fleet battle the ships at 0 Hull are the ones that went down.
      const down = record.fleet && o.loser ? record.final.filter((f) => f.side === o.loser && f.hullPoints <= 0).map((f) => nameOf(f.shipId)) : [];
      lines.push(`  ${down.length > 0 ? listOf(down) : cap(loser)} ${down.length > 1 ? "are" : "is"} sunk in round ${o.round}. ${cap(winner)} wins.`);
      break;
    }
    case "captured": lines.push(`  ${cap(winner)} wins the boarding in round ${o.round}. ${cap(loser)} is captured.`); break;
    case "struckColours": lines.push(`  ${cap(loser)} has struck its colours. ${cap(winner)} wins.`); break;
    case "victory": lines.push(`  ${cap(winner)} wins on points after round ${o.round}.`); break;
    case "escaped": lines.push(`  Escaped: the ships part in round ${o.round}. Nobody wins and nobody loses anything.`); break;
    case "draw": lines.push(`  A draw after round ${o.round}. Nobody wins and nobody loses anything.`); break;
    case "crippled": lines.push(`  ${cap(loser)} is crippled.`); break;
  }

  const a = aftermath;
  const named = (id: string | null) => (id === record.hunter ? hunter : id === record.target ? target : String(id));
  if (a.fleet && a.loot) {
    const notes: string[] = [];
    if (a.pvp && a.loot.fairness !== 1) notes.push(`the fairness factor is ${a.loot.fairness.toFixed(2)}`);
    if (a.loot.cradle !== 1) notes.push("loot is halved in the Cradle");
    if (a.loot.capped) notes.push("the per battle cap applies");
    if (describeCarried(a.loot.taken) === "nothing") {
      lines.push(`  ${cap(sideName(o.winner as BattleSide))} finds nothing worth taking on ${sideName(o.loser as BattleSide)}.`);
    } else {
      lines.push(`  The winning side takes ${describeCarried(a.loot.taken)} (${percent(a.loot.share)} of what the losing side carried${notes.length ? ", " + notes.join(", ") : ""}).`);
      for (const id of a.fleet.winners) {
        const got = a.fleet.taken[id];
        if (got && describeCarried(got) !== "nothing") lines.push(`  ${nameOf(id)} gets ${describeCarried(got)}.`);
      }
    }
  } else if (a.loot && describeCarried(a.loot.taken) === "nothing") {
    lines.push(`  ${named(a.winner)} finds nothing worth taking on ${named(a.loser)}.`);
  } else if (a.loot) {
    const notes: string[] = [];
    if (a.pvp && a.loot.fairness !== 1) notes.push(`the fairness factor is ${a.loot.fairness.toFixed(2)}`);
    if (a.loot.cradle !== 1) notes.push("loot is halved in the Cradle");
    if (a.loot.capped) notes.push("the per battle cap applies");
    lines.push(`  ${named(a.winner)} takes ${describeCarried(a.loot.taken)} (${percent(a.loot.share)} of what ${named(a.loser)} carried${notes.length ? ", " + notes.join(", ") : ""}).`);
  }
  if (a.beaten) {
    const boss = record.ships.find((s) => s.captainId === a.beaten?.boss)?.name ?? a.beaten.boss;
    const names = a.beaten.by.map((c) => record.ships.find((s) => s.captainId === c)?.name ?? c);
    lines.push(`  ${cap(listOf(names))} ${names.length > 1 ? "have" : "has"} beaten ${boss}, and may now pass the gate it guards. ${boss} will be back next Tide.`);
  }
  if (a.wreck) lines.push(`  ${describeCarried(a.wreck)} is left in a Wreck at ${words.place(a.wreck.water)} until Tide ${a.wreck.untilTide}.`);
  for (const f of a.flotsam) lines.push(`  ${describeCarried(f)} floats free at ${words.place(f.water)} until Tide ${f.untilTide}.`);
  if (a.fleet) {
    const captainShip = (captain: string) => record.ships.find((s) => s.captainId === captain)?.name ?? captain;
    for (const b of a.fleet.bounties) {
      if (b.collected > 0) lines.push(`  ${captainShip(b.captain)} collects ${b.collected} doubloons of bounty.`);
      if (b.added > 0) lines.push(`  The Admiralty puts a ${b.added} doubloon bounty on ${captainShip(b.captain)}.`);
    }
    if (a.shieldUntil !== null) lines.push(`  ${cap(sideName(o.loser as BattleSide))} is shielded from other players until Tide ${a.shieldUntil}.`);
  } else {
    if (a.bounty.collected > 0) lines.push(`  ${named(a.winner)} collects the ${a.bounty.collected} doubloon bounty on ${named(a.loser)}.`);
    if (a.bounty.added > 0) lines.push(`  The Admiralty puts a ${a.bounty.added} doubloon bounty on ${named(a.winner)}.`);
    if (a.shieldUntil !== null) lines.push(`  ${named(a.loser)} is shielded from other players until Tide ${a.shieldUntil}.`);
  }
  return lines;
}
