// A battle told in plain words, round by round (P2.4, fleets P2.5, the Fighting Styles, the deck fight and Old Shellback P3.B2 piece 3).
// Used by formatReplay and `npm run tide:demo`. Pure: it reads a BattleRecord and its aftermath and returns lines of text.
//
// The words are the narrative writer's (docs/text/replay-lines.md, kept in lines.ts). This file decides when a line is shown, from the
// fields the records already have (D176), and picks one of a line's variants from a stable hash of the battle seed, the ships, the key
// and the round, so the same record always reads the same and no line takes a roll. A line that needs a fact the record does not keep
// works it out from what it does keep (the dash from the Helm table, why a crew fought with Fists from the orders and the Powder).

import { B } from "../balance.ts";
import { hash32 } from "../rng.ts";
import { CARGO_GOODS } from "../types.ts";
import type { ShipId, Terrain } from "../types.ts";
import { ammoFactor } from "./guns.ts";
import { applyPair } from "./helm.ts";
import { LINES } from "./lines.ts";
import type { LineKey } from "./lines.ts";
import type { Carried } from "./loot.ts";
import { isShellback } from "./shellback.ts";
import { dashBands, hasGrapnels, hasStyle } from "./styles.ts";
import { BATTLE_SIDES, DAMAGE_TRACKS, RANGES } from "./types.ts";
import type {
  BattleAftermath, BattleRecord, BattleShip, BattleSide, ContestRecord, DamageTrack, DeckOrder, GrappleRecord, GunsOrder, HelmMove, Range,
  RoundRecord, RoundShipRecord, SideBonus,
} from "./types.ts";

const C = B.combat;
const RANGE: Record<Range, string> = { far: "Far", long: "Long", medium: "Medium", short: "Short", close: "Close", grappled: "Grappled" };
const HELM: Record<HelmMove, string> = { closeIn: "Close In", hold: "Hold", openRange: "Open Range", crossTheirBow: "Cross Their Bow" };
const GUNS: Record<GunsOrder, string> = {
  roundShot: "Round shot", chainShot: "Chain shot", grapeshot: "Grapeshot", holdFire: "Hold Fire", board: "Board", repel: "Repel", mortar: "Mortar",
  hotShot: "Hot Shot", charge: "Charge", volley: "Volley", firePots: "Fire Pots",
};
const CONTEST: Record<ContestRecord["kind"], string> = {
  chase: "the chase", shallows: "reaching Close in the Shallows", cutFree: "cutting free", ram: "the ram", dash: "spoiling the rake",
  grapnel: "the grapnels",
};
const TRACK: Record<DamageTrack, string> = { hull: "Hull", rigging: "Rigging", hands: "Hands" };
const TERRAIN: Record<Terrain, string> = {
  open: "on open water", shallows: "in the Shallows", reef: "on a Reef", rocky: "in rocky water", fog: "in Fog", kelp: "in Kelp",
  strongCurrent: "in a Strong Current", harbour: "in a Harbour",
};
/** The three Drill stages of the boarding spec, by the name a crew trained to that stage goes by. */
const DRILL_STAGES = ["Deckhands", "Cutthroats", "Sea Wolves"] as const;
/** The line that tells what a crew fights with. */
const DECK_LINE: Record<DeckOrder, LineKey> = {
  charge: "deck.charge", volley: "deck.volley", repel: "deck.repel", firePots: "deck.firePots", fists: "deck.fists",
};
/** The line that tells why a crew fought with Fists. */
const FISTS_LINE = {
  guns: "deck.fists.guns", powder: "deck.fists.powder", drill: "deck.fists.drill", pots: "pots.none", surprise: "deck.fists.surprise",
  collide: "deck.fists.collide",
} as const satisfies Record<string, LineKey>;

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

// ---------- The words ----------

export type Vars = Readonly<Record<string, string | number>>;

/** A line's text with its {variables} filled in. A variable that is missing is left as it is, so a test can see it. */
export const fillLine = (template: string, vars: Vars): string => template.replace(/\{(\w+)\}/g, (whole, name: string) => String(vars[name] ?? whole));

/** Every variant of a line, filled in. For tests and tools that ask whether a text is one of the line's. */
export const lineVariants = (key: LineKey, vars: Vars): string[] => (LINES[key] as readonly string[]).map((t) => fillLine(t, vars));

// ---------- Who is who in a battle ----------

/** Who is who in a battle: ship names, and which ships make up each side. */
function cast(record: BattleRecord) {
  const nameOf = (id: string | null): string => record.ships.find((s) => s.shipId === id)?.name ?? String(id);
  const members = (side: BattleSide): string[] => record.fleet?.sides[side] ?? [side === "hunter" ? record.hunter : record.target];
  const flagId = (side: BattleSide): ShipId => (side === "hunter" ? record.hunter : record.target);
  const flagName = (side: BattleSide): string => nameOf(flagId(side));
  // A side as one singular phrase: the ship, or "the fleet of" its ships.
  const sideName = (side: BattleSide): string =>
    members(side).length > 1 ? `the fleet of ${listOf(members(side).map(nameOf))}` : flagName(side);
  const sideOf = (id: ShipId): BattleSide => (members("hunter").includes(id) ? "hunter" : "target");
  const shipOf = (id: ShipId): BattleShip | undefined => record.ships.find((s) => s.shipId === id);
  return { nameOf, members, sideName, flagName, flagId, sideOf, shipOf };
}

/** What the telling remembers from round to round, and what it has already said once. */
interface Story {
  record: BattleRecord;
  say: (key: LineKey, vars: Vars, round?: number, salt?: string, variant?: number) => string;
  once: (key: string) => boolean; // true the first time it is asked, false after
  zeroing: Record<ShipId, number>; // each Mortar's Zeroing In factor last round
  powder: Record<ShipId, number>; // each ship's Powder as the round began
  edgeSaid: BattleSide | null; // the side whose edge the telling has already named
}

function startStory(record: BattleRecord): Story {
  const said = new Set<string>();
  return {
    record,
    say: (key, vars, round = 0, salt = "", variant) => {
      const variants = LINES[key] as readonly string[];
      const at = variant !== undefined ? Math.min(variant, variants.length - 1) : variants.length === 1 ? 0 : hash32(`${record.seed}/${record.hunter}/${record.target}/text/${key}/${round}/${salt}`) % variants.length;
      return fillLine(variants[at] as string, vars);
    },
    once: (key) => (said.has(key) ? false : (said.add(key), true)),
    zeroing: {},
    powder: Object.fromEntries(record.ships.map((s) => [s.shipId, s.powder])),
    edgeSaid: null,
  };
}

/** What a side's damage bonus is worth, in words; empty for a lone ship. */
function bonusLine(label: string, b: SideBonus): string | null {
  if (b.total <= 1) return null;
  const parts: string[] = [];
  if (b.fleet > 1) parts.push(`fleet bonus ${percent(b.fleet - 1)}`);
  if (b.desperate > 1) parts.push(`Desperate Defence ${percent(b.desperate - 1)}`);
  return `${cap(label)} deals ${percent(b.total - 1)} more damage (${parts.join(", ")}).`;
}

// ---------- Facts worked out from the record ----------

/** The Drill stage a Drill level belongs to: Deckhands, Cutthroats or Sea Wolves. */
const stageOf = (drill: number): string => DRILL_STAGES[Math.min(DRILL_STAGES.length - 1, Math.max(0, Math.ceil(drill / B.drill.stageSize) - 1))] as string;

/** The range the great guns fired at in a round, or null when they were quiet: the grapple round fires at Close, and a Grappled round fires nothing. */
const gunRangeOf = (round: RoundRecord): Range | null =>
  round.rangeBefore === "grappled" ? null : round.rangeAfter === "grappled" ? "close" : round.rangeAfter;

/**
 * Did a Rammer's Dash add a band this round? The pair table moves the range to one place; the Dash moves it one band further, so a
 * Rammer that played Close In and ended nearer than the table puts it was dashing (spec section 3). Only the flagships move the range.
 */
function dashed(record: BattleRecord, round: RoundRecord, side: BattleSide): boolean {
  const { flagId, shipOf } = cast(record);
  const mine = round.ships.find((s) => s.ship === flagId(side));
  const theirs = round.ships.find((s) => s.ship === flagId(other(side)));
  const ship = shipOf(flagId(side));
  if (!mine || !ship || !theirs || dashBands(ship, mine.helm) <= 0 || round.rangeBefore === "grappled" || round.escaped) return false;
  const moves = side === "hunter" ? { hunter: mine.helm, target: theirs.helm } : { hunter: theirs.helm, target: mine.helm };
  const chase = round.contests.find((c) => c.kind === "chase" && c.ship === undefined);
  const table = applyPair(moves, round.rangeBefore, chase ? chase.winner : "hunter").position;
  const here = RANGES.indexOf(round.rangeBefore);
  const now = RANGES.indexOf(round.rangeAfter);
  return table > here && table < RANGES.indexOf("grappled") && now > table && round.rangeAfter !== "grappled";
}

/**
 * Why a crew fought with Fists, from the orders and the Powder (boarding spec section 2), or null when the record does not say.
 * In the grapple round a crew that did not board chose its order before the grapple (surprise), and two ships that closed in
 * together fight with Fists both (collide).
 */
function fistsWhy(round: RoundRecord, s: RoundShipRecord, boardedBy: BattleSide | undefined, side: BattleSide): keyof typeof FISTS_LINE | null {
  if (round.rangeBefore !== "grappled") return boardedBy === undefined ? "collide" : side !== boardedBy ? "surprise" : null;
  switch (s.guns) {
    case "volley": return "powder";
    case "firePots": return (s.firePots ?? 0) > 0 ? "drill" : "pots";
    case "charge": case "repel": return null;
    default: return "guns";
  }
}

// ---------- A round ----------

function roundLines(story: Story, round: RoundRecord): string[] {
  const { record, say } = story;
  const { nameOf, members, sideName, flagName, flagId, sideOf, shipOf } = cast(record);
  const rec = (id: ShipId): RoundShipRecord | undefined => round.ships.find((s) => s.ship === id);
  const n = round.round;
  const fleet = round.fleet !== undefined;
  const lines: string[] = [
    round.overtime ? say("round.header.overtime", { round: n, range: RANGE[round.rangeBefore] }, n) : `Round ${n}, at ${RANGE[round.rangeBefore]} range.`,
  ];
  if (round.overtime) lines.push("  " + say(n >= C.rounds + C.overtime ? "overtime.last" : "overtime.start", { round: n }, n));

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

  const bossName = record.ships.find(isShellback)?.name ?? "";

  // What each ship plays. A ship that was given an order it cannot give says so; Old Shellback shows his tell and his rear up.
  for (const s of round.ships) {
    const rule = s.rule < 0 ? "no rule fits, so the fallback" : `rule ${s.rule + 1}`;
    const jettison = s.jettison ? " It heaves its cargo over the side." : "";
    lines.push(`  ${nameOf(s.ship)} plays ${HELM[s.helm]} and ${GUNS[s.guns]} (${rule}).${jettison}`);
    if (s.asked === "mortar") lines.push("  " + say("mortar.refused", { ship: nameOf(s.ship) }, n, s.ship));
    if (s.asked === "hotShot") lines.push("  " + say("hotshot.refused", { ship: nameOf(s.ship) }, n, s.ship));
    if (s.tell) lines.push("  " + say("shellback.tell", { boss: nameOf(s.ship) })); // the same wording whatever the round, so it does not give the round away
    if (s.mood === "rearing") lines.push("  " + say("shellback.rears", { boss: nameOf(s.ship) }, n));
  }

  // The Helm contests, and what they mean.
  for (const c of round.contests) {
    const mine = c.ship ? nameOf(c.ship) : flagName(c.side);
    const theirs = flagName(other(c.side));
    const winner = c.winner === c.side ? mine : theirs;
    lines.push(`  Helm contest for ${CONTEST[c.kind]}: ${winner} wins (${mine} had a ${percent(c.chance)} chance).`);
    if (c.kind === "dash") lines.push("  " + say(c.winner === c.side ? "ram.dash.spoils" : "ram.dash.fails", { ship: mine, enemy: theirs }, n, mine));
    if (c.kind === "cutFree") {
      // Lashed fast: the other flagship holds the edge or has Grapnels, so its Helm score counts double.
      const foe = shipOf(flagId(other(c.side)));
      const lashed = round.edge === other(c.side) || (foe !== undefined && hasGrapnels(foe));
      if (lashed) lines.push("  " + say("cutfree.hard", { ship: mine, enemy: theirs }, n, mine));
      lines.push("  " + say(c.winner === c.side ? "cutfree.win" : "cutfree.fail", { ship: mine, enemy: theirs }, n, mine));
      if (c.winner === c.side) lines.push("  " + say("cutfree.quiet", {}, n));
    }
  }
  for (const s of round.ships) {
    if (s.scrape > 0) lines.push(`  ${nameOf(s.ship)} scrapes the reef and loses ${s.scrape} Hull.`);
  }

  if (round.escaped) {
    const opened = BATTLE_SIDES.map((side) => rec(flagId(side))).filter((s): s is RoundShipRecord => s !== undefined && s.helm === "openRange");
    lines.push(
      "  " + (opened.length === 1
        ? say("outcome.escaped.one", { ship: nameOf(opened[0]!.ship), enemy: flagName(other(sideOf(opened[0]!.ship))) }, n)
        : say("outcome.escaped.both", {}, n)),
    );
  } else {
    // The Dash, then the range. The writer's "two bands" lines are for exactly two; for more they use the last wording, which names none.
    const step = RANGES.indexOf(round.rangeAfter) - RANGES.indexOf(round.rangeBefore);
    const wide = Math.abs(step) > 2 ? 2 : undefined;
    for (const side of BATTLE_SIDES) {
      if (dashed(record, round, side)) {
        lines.push("  " + say("ram.dash", { ship: flagName(side), from: RANGE[round.rangeBefore], to: RANGE[round.rangeAfter] }, n, side, wide));
      }
    }
    const move = { from: RANGE[round.rangeBefore], to: RANGE[round.rangeAfter], range: RANGE[round.rangeAfter] };
    lines.push("  " + say(step >= 2 ? "range.closes2" : step === 1 ? "range.closes" : step <= -2 ? "range.opens2" : step === -1 ? "range.opens" : "range.stays", move, n, "", wide));

    // The Ram lands after the Helm step and before the guns (spec section 3).
    for (const ram of round.rams ?? []) {
      const who = ram.ship ? nameOf(ram.ship) : flagName(ram.side);
      const foeId = flagId(other(ram.side));
      const foe = rec(foeId);
      const vars = { ship: who, enemy: flagName(other(ram.side)), hull: ram.hull, self: ram.self };
      if (!ram.hit) {
        lines.push("  " + say(ram.why === "crossed" ? "ram.miss.crossed" : ram.why === "outrun" ? "ram.miss.outrun" : "ram.miss.contest", vars, n, who));
        continue;
      }
      const struck = shipOf(foeId);
      const braced = struck !== undefined && hasStyle(struck, "gunline") && foe?.helm === "hold";
      const grapnels = struck !== undefined && hasStyle(struck, "boarder") && foe?.guns === "board";
      lines.push("  " + say(braced ? "ram.braced" : grapnels ? "ram.grapnels" : "ram.hit", vars, n, who));
    }
    for (const f of round.fires ?? []) {
      if (f.source === "ram") lines.push("  " + say("fire.lit.ram", { ship: nameOf(f.ship), by: nameOf(f.by), rounds: f.rounds }, n, f.ship));
    }

    // Boarding: grapnels, the Board order and Old Shellback's claws.
    for (const g of round.grapples) lines.push(...grappleLines(story, round, g));
    if (new Set(round.grapples.filter((g) => g.ok && g.why !== "snatch").map((g) => g.side)).size === 2) lines.push("  " + say("edge.bothBoard", {}, n));

    // The great guns.
    for (const s of round.ships) lines.push(...shotLines(story, round, s, fleet, bossName));
    for (const f of round.fires ?? []) {
      if (f.source === "hotShot" || f.source === "mortar") {
        lines.push("  " + say(f.source === "hotShot" ? "fire.lit.hotShot" : "fire.lit.mortar", { ship: nameOf(f.ship), by: nameOf(f.by), rounds: f.rounds }, n, f.ship));
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
    if (round.melee) lines.push(...deckLines(story, round));
  }

  // Fires burn at the end of the round, after the deck fight.
  for (const s of round.ships) {
    if (!s.fire) continue;
    const ship = shipOf(s.ship);
    const key: LineKey = ship && hasStyle(ship, "gunline") ? "fire.drill" : ship && hasStyle(ship, "firebrand") ? "fire.pitch" : "fire.burns";
    lines.push("  " + say(key, { ship: nameOf(s.ship), hull: s.fire.hull }, n, s.ship));
    if (s.hullPoints <= 0) lines.push("  " + say("fire.sinks", { ship: nameOf(s.ship), round: n }, n, s.ship));
    else if (s.fire.left <= 0) lines.push("  " + say("fire.out", { ship: nameOf(s.ship) }, n, s.ship));
  }
  if (round.fleet) {
    for (const id of round.fleet.crippled) lines.push(`  ${nameOf(id)}'s Rigging is gone. It is Crippled and cannot Open Range or Cross Their Bow.`);
  } else {
    for (const side of round.crippled) lines.push(`  ${flagName(side)}'s Rigging is gone. It is Crippled and cannot Open Range or Cross Their Bow.`);
  }

  // What the telling carries to the next round.
  for (const s of round.ships) {
    story.powder[s.ship] = s.powder;
    story.zeroing[s.ship] = s.mortar ? s.mortar.zeroing : 1;
  }
  if (round.rangeBefore === "grappled" && round.rangeAfter !== "grappled") story.edgeSaid = null; // cut free: the edge ends with the grapple
  return lines;
}

/** A Board order, a grapnel line, a claw: did a ship grapple, and how. */
function grappleLines(story: Story, round: RoundRecord, g: GrappleRecord): string[] {
  const { record, say } = story;
  const { nameOf, flagName } = cast(record);
  const n = round.round;
  const who = g.ship ? nameOf(g.ship) : flagName(g.side);
  const enemy = flagName(other(g.side));
  if (g.why === "snatch") return ["  " + say("shellback.snatch", { ship: enemy, boss: who }, n)];
  if (!g.ok) return ["  " + say("board.fail", { ship: who, enemy }, n, who)];
  if (g.why === "grapnels") return ["  " + say("board.grapnels.win", { ship: who, enemy }, n, who)];
  if (g.from === "short") return ["  " + say("board.short.ok", { ship: who, enemy }, n, who)];
  return [`  ${who} grapples the enemy.`];
}

/** One ship's great guns this round, in words: the shot, the Mortar, the Hot Shot, Old Shellback's shell, and the Powder. */
function shotLines(story: Story, round: RoundRecord, s: RoundShipRecord, fleet: boolean, bossName: string): string[] {
  const { record, say, once } = story;
  const { nameOf, flagName, sideOf } = cast(record);
  const n = round.round;
  const lines: string[] = [];
  const me = nameOf(s.ship);
  const enemy = flagName(other(sideOf(s.ship)));
  const shot = s.shot;
  const at = gunRangeOf(round);
  const vars = { ship: me, enemy, hull: shot.damage, boss: bossName, factor: B.shellback.mortarFactor, range: RANGE[at ?? round.rangeAfter] };

  if (s.shell !== undefined && shot.damage > 0 && shot.track === "hull") {
    // A hit on his Hull: his shell turned a fifth of it aside, or a Mortar shell fell on it from above. (The writer's lines say Hull,
    // so a Grapeshot into his claws is told by the plain line.)
    if (once("shell.intro")) lines.push("  " + say("shellback.shell.intro", vars, n));
    lines.push("  " + say(s.mortar ? "shellback.mortar" : "shellback.shell", vars, n, s.ship));
  } else if (s.mortar) {
    lines.push(
      !s.mortar.hit ? "  " + say("mortar.miss", vars, n, s.ship)
        : shot.damage > 0 ? "  " + say("mortar.hit", vars, n, s.ship)
        : `  ${me}'s Mortar does no harm to ${enemy}.`,
    );
  } else if (s.guns === "hotShot" && shot.track) {
    lines.push(shot.damage > 0 ? "  " + say("hotshot.hit", vars, n, s.ship) : `  ${me}'s Hot Shot does no harm to ${enemy}.`);
  } else if (shot.track) {
    if (fleet) {
      lines.push(shot.damage > 0 ? `  ${me}'s ${GUNS[s.guns]} lands ${shot.damage} ${TRACK[shot.track]}.` : `  ${me}'s ${GUNS[s.guns]} does no harm.`);
    } else {
      lines.push(
        shot.damage > 0
          ? `  ${me}'s ${GUNS[s.guns]} takes ${shot.damage} ${TRACK[shot.track]} off ${enemy}.`
          : `  ${me}'s ${GUNS[s.guns]} does no harm to ${enemy}.`,
      );
    }
  } else if (s.guns === "holdFire") {
    lines.push(`  ${me} holds fire and saves the shot for next round.`);
  }

  // What the Mortar and the Hot Shot add to the story.
  if (s.mortar) {
    if (s.mortar.zeroing > 1) lines.push("  " + say("mortar.zeroing", { ...vars, bonus: Math.round((s.mortar.zeroing - 1) * 100) }, n, s.ship));
    else if ((story.zeroing[s.ship] ?? 1) > 1) lines.push("  " + say("mortar.zeroing.reset", vars, n, s.ship));
  }
  if (s.guns === "hotShot" && shot.track) {
    if (at && ammoFactor("hotShot", at) < 1) lines.push("  " + say("hotshot.toofar", vars, n, s.ship));
    if (s.powder <= 0 && (story.powder[s.ship] ?? 0) > 0) lines.push("  " + say("hotshot.dry", vars, n, s.ship));
  }
  if (shot.track !== null && (story.powder[s.ship] ?? 1) <= 0 && once(`dry/${s.ship}`)) lines.push("  " + say("mortar.dry", vars, n, s.ship));
  lines.push(...traitLines(story, round, s));
  return lines;
}

/** A trait shown once a battle, in the round it pays (spec section 3): the point is that no trait is a hidden bonus. */
function traitLines(story: Story, round: RoundRecord, s: RoundShipRecord): string[] {
  const { record, say, once } = story;
  const { nameOf, flagId, sideOf, shipOf } = cast(record);
  const ship = shipOf(s.ship);
  if (!ship?.style) return [];
  const foe = round.ships.find((x) => x.ship === flagId(other(sideOf(s.ship))));
  const show = (key: LineKey): string[] => (once(`${key}/${s.ship}`) ? ["  " + say(key, { ship: nameOf(s.ship) }, round.round, s.ship)] : []);
  switch (ship.style) {
    case "gunline":
      if (s.helm !== "hold") return [];
      return [
        ...(foe?.helm === "crossTheirBow" ? show("trait.braced") : []),
        ...(s.guns === "roundShot" && round.rangeAfter === "long" ? show("trait.longNines") : []),
        ...(s.shot.track ? show("trait.steady") : []),
      ];
    case "skirmisher": return s.helm === "openRange" && foe?.helm === "hold" ? show("trait.kite") : [];
    case "smuggler": return s.helm === "openRange" ? show("trait.slippery") : [];
    default: return [];
  }
}

/** The deck fight of a Grappled round: the orders, who won the exchange, the edge, the Fire Pots and the strength of the crews. */
function deckLines(story: Story, round: RoundRecord): string[] {
  const { record, say, once } = story;
  const { nameOf, sideName, flagName, flagId, sideOf, shipOf } = cast(record);
  const n = round.round;
  const melee = round.melee!;
  // The guns of the round the ships grapple fire at Close first, so only a round that began Grappled says they are quiet.
  const lines: string[] = round.rangeBefore === "grappled" ? ["  " + say("deck.quiet", {}, n)] : [];
  const snatched = round.grapples.some((g) => g.ok && g.why === "snatch");
  const fighting = round.ships.filter((s) => s.deck);

  // What each crew fights with. A crew that fights with Fists says why, when the record lets us know.
  const collided = round.rangeBefore !== "grappled" && melee.firstOver === undefined && fighting.every((s) => s.deck!.order === "fists");
  for (const s of fighting) {
    const me = nameOf(s.ship);
    const order = s.deck!.order;
    if (order !== "fists") {
      lines.push("  " + say(DECK_LINE[order], { ship: me }, n, s.ship));
      continue;
    }
    const why = fistsWhy(round, s, melee.firstOver, sideOf(s.ship));
    if (why === "collide") {
      if (collided && once(`collide/${n}`)) lines.push("  " + say(FISTS_LINE.collide, {}, n));
    } else if (why) {
      lines.push("  " + say(FISTS_LINE[why], { ship: me }, n, s.ship));
    } else {
      lines.push("  " + say("deck.fists", { ship: me }, n, s.ship));
    }
  }

  // Who won the exchange of the two flagships' orders.
  const [a, b] = BATTLE_SIDES.map((side) => round.ships.find((s) => s.ship === flagId(side)));
  if (a?.deck && b?.deck) {
    const nameFor = (s: RoundShipRecord): string => nameOf(s.ship);
    const won = a.deck.pairing === "won" ? [a, b] : b.deck.pairing === "won" ? [b, a] : null;
    const pots = a.deck.order === "firePots" && b.deck.order === "repel" ? [a, b] : b.deck.order === "firePots" && a.deck.order === "repel" ? [b, a] : null;
    if (won) {
      const [w, l] = won as [RoundShipRecord, RoundShipRecord];
      const pair = `${w.deck!.order}/${l.deck!.order}`;
      const key: LineKey | null = pair === "charge/volley" ? "pair.chargeVolley" : pair === "volley/repel" ? "pair.volleyRepel" : pair === "repel/charge" ? "pair.repelCharge" : null;
      if (key) lines.push("  " + say(key, { winner: nameFor(w), loser: nameFor(l) }, n));
    } else if (pots) {
      lines.push("  " + say("pair.pots", { winner: nameFor(pots[0]!), loser: nameFor(pots[1]!) }, n));
    } else if (a.deck.pairing === "even" && a.deck.order === b.deck.order && a.deck.order !== "fists" && a.deck.order !== "firePots") {
      lines.push("  " + say("pair.even", {}, n));
    }
  }

  // The edge: First over the rail in the grapple round, and who holds the edge after. The snatch says so itself.
  const holder = round.edge ?? null;
  if (melee.firstOver && !snatched) {
    lines.push("  " + say("edge.firstOver", { ship: sideName(melee.firstOver), enemy: sideName(other(melee.firstOver)) }, n));
  }
  if (holder !== null && !snatched && holder !== story.edgeSaid) {
    lines.push("  " + say("edge.holds", { ship: sideName(holder), enemy: sideName(other(holder)) }, n));
  }
  if (holder !== null) story.edgeSaid = holder;

  // Traits that count on deck, said once.
  for (const s of fighting) {
    const ship = shipOf(s.ship);
    if (!ship) continue;
    const me = nameOf(s.ship);
    const firebrand = record.ships.find((x) => sideOf(x.shipId) !== sideOf(s.ship) && hasStyle(x, "firebrand"));
    if (firebrand && once(`tinderbox/${s.ship}`)) lines.push("  " + say("tinderbox", { ship: me, enemy: firebrand.name }, n, s.ship));
    if (hasStyle(ship, "boarder") && once(`fighters/${s.ship}`)) lines.push("  " + say("fighters", { ship: me }, n, s.ship));
    if ((ship.drill ?? 0) > 0 && once(`drill/${s.ship}`)) lines.push("  " + say("drill.stage", { ship: me, stage: stageOf(ship.drill ?? 0) }, n, s.ship));
    if ((ship.drill ?? 0) >= B.drill.unlocks.secondWave && once(`wave/${s.ship}`)) lines.push("  " + say("drill.secondWave", { ship: me }, n, s.ship));
  }

  const strength = (side: BattleSide): number => Math.round(melee.strength[side] * 10) / 10; // one decimal: a Fighters crew under Tinderbox is 28.8
  lines.push(
    `  The crews fight hand to hand: ${sideName("hunter")} (strength ${strength("hunter")}) loses ${plural(melee.lost.hunter, "Hand")}, `
    + `${sideName("target")} (strength ${strength("target")}) loses ${plural(melee.lost.target, "Hand")}. `
    + `${melee.hands.hunter} and ${melee.hands.target} Hands are left.`,
  );

  // Fire Pots thrown, and the fires the deck fight lit.
  for (const s of fighting) {
    const thrown = s.deck!.thrown;
    if (!thrown) continue;
    const me = nameOf(s.ship);
    const enemy = flagName(other(sideOf(s.ship)));
    const vars = { ship: me, enemy };
    const ship = shipOf(s.ship);
    if (!thrown.fire) {
      lines.push("  " + say("pots.noFire", vars, n, s.ship));
    } else if (ship && hasStyle(ship, "firebrand")) {
      lines.push("  " + say("pots.caught", vars, n, s.ship));
    } else {
      const flashes = (round.fires ?? []).filter((f) => f.source === "firePots" && f.rounds === 0 && f.hull !== undefined);
      const blow = flashes.find((f) => f.by === s.ship)?.hull ?? 0;
      const recoil = flashes.find((f) => f.ship === s.ship)?.hull ?? 0;
      lines.push(
        blow === recoil
          ? "  " + say("pots.flash", { ...vars, hull: blow }, n, s.ship)
          // DRAFT wording: the writer's flash lines say both ships lose the same Hull, which is not so when one has little left.
          : `  ${me}'s pot flashes. ${enemy} loses ${blow} Hull and ${me} loses ${recoil}.`,
      );
    }
    if ((s.firePots ?? 0) === 0) lines.push("  " + say("pots.last", vars, n, s.ship));
  }
  for (const f of round.fires ?? []) {
    if (f.source === "embers") lines.push("  " + say("fire.lit.embers", { ship: nameOf(f.ship), by: nameOf(f.by), rounds: f.rounds }, n, f.ship));
  }
  return lines;
}

/** The whole battle, then what it changed in the world. The first line is the header; the rest are indented. */
export function describeBattle(record: BattleRecord, aftermath: BattleAftermath, words: BattleWords): string[] {
  const { nameOf, members, sideName, flagName, flagId } = cast(record);
  const hunter = flagName("hunter");
  const target = flagName("target");
  const gauge = record.gauge ? `${flagName(record.gauge)} holds the wind gauge.` : "Nobody holds the wind gauge.";
  const story = startStory(record);
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
  // The style badge of each ship, so a trait is never a hidden bonus (spec section 2), and the Bombardier's spotters.
  for (const s of record.ships) {
    if (s.style) lines.push("  " + story.say("badge.head", { ship: s.name, style: cap(s.style) }, 0, s.shipId));
  }
  const spotter = record.ships.find((s) => (s.shipId === record.hunter || s.shipId === record.target) && s.style === "bombardier");
  if (record.startRange === "far" && spotter) {
    lines.push("  " + story.say("start.far", { ship: spotter.name, enemy: flagName(other(spotter.shipId === record.hunter ? "hunter" : "target")) }));
  }
  for (const round of record.rounds) for (const line of roundLines(story, round)) lines.push("  " + line);

  const o = record.outcome;
  const winner = o.winner ? sideName(o.winner) : null;
  const loser = o.loser ? sideName(o.loser) : null;
  const boss = record.ships.find(isShellback);
  switch (o.kind) {
    case "sunk": {
      // In a fleet battle the ships at 0 Hull are the ones that went down.
      const down = record.fleet && o.loser ? record.final.filter((f) => f.side === o.loser && f.hullPoints <= 0).map((f) => nameOf(f.shipId)) : [];
      lines.push(`  ${down.length > 0 ? listOf(down) : cap(loser)} ${down.length > 1 ? "are" : "is"} sunk in round ${o.round}. ${cap(winner)} wins.`);
      break;
    }
    case "captured": lines.push(`  ${cap(winner)} wins the boarding in round ${o.round}. ${cap(loser)} is captured.`); break;
    case "struckColours":
      lines.push(
        o.drivenOff
          ? "  " + story.say(o.drivenOff === "hull" ? "shellback.driven.hull" : "shellback.driven.claws", { boss: boss?.name ?? cap(loser) }, o.round)
          : `  ${cap(loser)} has struck its colours. ${cap(winner)} wins.`,
      );
      break;
    case "victory": {
      const lead = Math.round(((record.dealt[o.winner as BattleSide] ?? 0) - (record.dealt[o.loser as BattleSide] ?? 0)) * 100);
      lines.push("  " + story.say("outcome.victory", { winner: cap(winner), round: o.round, lead }, o.round));
      break;
    }
    case "escaped": {
      // One ship that opened range already said so in the round, together with "nobody wins"; two ships that did get this line.
      const last = record.rounds[record.rounds.length - 1];
      const opened = (last?.ships ?? []).filter((s) => (s.ship === flagId("hunter") || s.ship === flagId("target")) && s.helm === "openRange");
      if (opened.length !== 1) lines.push(`  Escaped: the ships part in round ${o.round}. Nobody wins and nobody loses anything.`);
      break;
    }
    case "draw": {
      lines.push("  " + story.say("outcome.draw", { round: o.round }, o.round));
      // A lead on points does not beat Old Shellback: the other side led by enough to win anywhere else, and he is not beaten.
      if (boss) {
        const lead = (record.dealt[other(boss.side)] ?? 0) - (record.dealt[boss.side] ?? 0);
        if (lead >= C.victoryMargin - 1e-9) lines.push("  " + story.say("shellback.points", { boss: boss.name, ship: flagName(other(boss.side)) }, o.round));
      }
      break;
    }
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
    const bossName = record.ships.find((s) => s.captainId === a.beaten?.boss)?.name ?? a.beaten.boss;
    const names = a.beaten.by.map((c) => record.ships.find((s) => s.captainId === c)?.name ?? c);
    const vars = { boss: bossName, captains: listOf(names) };
    const how: LineKey | null = o.drivenOff ? "shellback.beaten.driven" : o.kind === "sunk" ? "shellback.beaten.sunk" : o.kind === "captured" ? "shellback.beaten.captured" : null;
    if (how) {
      lines.push("  " + story.say(how, vars, o.round));
      lines.push("  " + story.say("shellback.back", vars, o.round));
    } else {
      lines.push(`  ${cap(listOf(names))} ${names.length > 1 ? "have" : "has"} beaten ${bossName}, and may now pass the gate it guards. ${bossName} will be back next Tide.`);
    }
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
