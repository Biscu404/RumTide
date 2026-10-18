// Doctrines (GAMEPLAY 8.8): rule evaluation, validation, slots, the four beginner templates and the ability slot.
// Pure: no network, no clock, no randomness. A doctrine decides nothing by chance; every roll of a battle is in
// battle.ts, helm.ts and guns.ts.
//
// evaluateDoctrine reads one round's RoundView and gives runBattle a RoundChoice. doctrineChooser wraps it as the
// Chooser that runBattle takes (D50). Evaluation never throws on bad data: a rule it cannot read does not fire, and
// a doctrine that gives no play falls back to a plain one, so a broken doctrine never crashes a Tide.

import { B } from "../balance.ts";
import type { Captain, Terrain } from "../types.ts";
import type { AbilityFire, Chooser, RoundChoice, RoundView } from "./battle.ts";
import { DAMAGE_TRACKS, ENEMY_TYPES, GUNS_ORDERS, HELM_MOVES, RANGES } from "./types.ts";
import type {
  BattleShip, BattleSide, DamageTrack, Doctrine, DoctrineAction, DoctrineCondition, DoctrineRule, EnemyType, GunsOrder,
  HelmMove, Range,
} from "./types.ts";

const D = B.combat.doctrine;
const PERCENT = 100;

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

// ---------- The ability slot (8.8, 8.3 step 2) ----------

/** One crew ability a doctrine rule can call. What it does to the battle arrives with crew (P8.4). */
export interface AbilityDef {
  id: string;
  name: string;
}

/** Abilities by id. Crew abilities are registered here by P8.4; this task registers none (the brief). */
export type AbilityRegistry = Readonly<Record<string, AbilityDef>>;

export const ABILITIES: AbilityRegistry = Object.freeze({});

// ---------- Context ----------

export interface DoctrineContext {
  /** What kind of ship the enemy is, for the "enemy type" condition. P2.4 works it out from the enemy's Captain. */
  enemyType: EnemyType;
  /** Defaults to ABILITIES, which holds none yet. */
  abilities?: AbilityRegistry;
}

// ---------- Plays ----------

/** The play of a round in which a ship heaves its cargo over the side: it holds course and holds fire (D65). */
export const JETTISON_PLAY: { helm: HelmMove; guns: GunsOrder } = { helm: "hold", guns: "holdFire" };

/** The play of a doctrine that gave none, which only a doctrine that failed validation can do (D68). */
export const FALLBACK_PLAY: { helm: HelmMove; guns: GunsOrder } = { helm: "hold", guns: "roundShot" };

/** The `rule` of a round record when no rule gave the play and the fallback was played. */
export const NO_RULE = -1;

// ---------- Conditions ----------

/** How far apart the ships are: Long is the farthest and Grappled the nearest (D69). */
const distance = (range: Range): number => RANGES.length - 1 - RANGES.indexOf(range);

function percentOf(ship: BattleShip, track: DamageTrack): number {
  const [now, max] =
    track === "hull" ? [ship.hullPoints, ship.maxHullPoints]
    : track === "rigging" ? [ship.riggingPoints, ship.maxRiggingPoints]
    : [ship.hands, ship.maxHands];
  return max > 0 ? (now / max) * PERCENT : 0; // a track the ship does not have is empty (D70)
}

/** Does one condition hold for the ship on `side`? An unknown condition is false. */
export function conditionHolds(condition: DoctrineCondition, view: RoundView, side: BattleSide, ctx: DoctrineContext): boolean {
  const mine = view.ships[side];
  const theirs = view.ships[other(side)];
  const theirLast = view.last[other(side)];
  switch (condition.kind) {
    case "range":
      if (condition.op === "is") return view.range === condition.range;
      return condition.op === "atLeast" ? distance(view.range) >= distance(condition.range) : distance(view.range) <= distance(condition.range);
    case "round":
      return condition.op === "is" ? view.round === condition.n : view.round >= condition.n;
    case "track": {
      const pct = percentOf(condition.who === "mine" ? mine : theirs, condition.track);
      return condition.op === "above" ? pct > condition.pct : pct < condition.pct;
    }
    case "theirLastHelm": return theirLast?.helm === condition.move;
    case "theirLastGuns": return theirLast?.guns === condition.order;
    case "enemyType": return ctx.enemyType === condition.type;
    case "enemyCaptain": return theirs.captainId === condition.captainId;
    case "terrain": return view.terrain === condition.terrain;
    case "windGauge": return view.gauge === (condition.holder === "mine" ? side : other(side));
    case "havePowder": return mine.powder > 0;
    case "abilityUnused": return mine.abilities.includes(condition.ability);
    default: return false;
  }
}

// ---------- Evaluation (8.3 step 1, 8.8) ----------

/**
 * Checks the doctrine top down for the ship on `view.side`. The first rule whose conditions all hold fires:
 * Fight gives the Helm move and Guns order; Surrender strikes the colours; Jettison throws the cargo over and plays
 * Hold and Hold Fire. An ability rule fires its ability and evaluation goes on below it, so the abilities collect
 * in `abilities` and a later rule still gives the play. A rule is skipped as if its conditions failed when its
 * ability is not registered or already used, or when the ship has already jettisoned.
 */
export function evaluateDoctrine(doctrine: Doctrine, view: RoundView, ctx: DoctrineContext): RoundChoice {
  const side = view.side;
  const registry = ctx.abilities ?? ABILITIES;
  const abilities: AbilityFire[] = [];
  const rules = Array.isArray(doctrine?.rules) ? doctrine.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const conditions = Array.isArray(rule.if) ? rule.if : [];
    if (!conditions.every((c) => conditionHolds(c, view, side, ctx))) continue;
    const action = rule.then;
    switch (action?.kind) {
      case "fight":
        return { kind: "fight", rule: i, abilities, helm: action.helm, guns: action.guns };
      case "surrender":
        return { kind: "surrender", rule: i, abilities };
      case "jettison":
        if (view.jettisoned[side]) break; // the hold is already empty
        return { kind: "fight", rule: i, abilities, ...JETTISON_PLAY, jettison: true };
      case "ability": {
        const usable = registry[action.ability] !== undefined && view.ships[side].abilities.includes(action.ability);
        const already = abilities.some((a) => a.ability === action.ability);
        if (usable && !already) abilities.push({ rule: i, ability: action.ability });
        break;
      }
      default:
        break;
    }
  }
  return { kind: "fight", rule: NO_RULE, abilities, ...FALLBACK_PLAY };
}

/** The Chooser runBattle takes for one side (D50). */
export const doctrineChooser = (doctrine: Doctrine, ctx: DoctrineContext): Chooser => (view) => evaluateDoctrine(doctrine, view, ctx);

// ---------- Which doctrine a ship fights with (8.8) ----------

/** The saved doctrine with this name, ignoring case and spaces at the ends; undefined when there is none. */
export function findDoctrine(captain: Pick<Captain, "doctrines">, name: string | undefined): Doctrine | undefined {
  if (typeof name !== "string" || !Array.isArray(captain.doctrines)) return undefined;
  const want = name.trim().toLowerCase();
  return captain.doctrines.find((d) => typeof d?.name === "string" && d.name.trim().toLowerCase() === want);
}

/**
 * The doctrine a captain fights with: the one asked for (the step's, else the plan's), else the captain's default, else
 * their first saved doctrine, else a fresh Brawler. It always gives one, so a missing name never stops a battle (D68).
 */
export function pickDoctrine(captain: Pick<Captain, "doctrines" | "defaultDoctrine">, wanted: string | undefined): Doctrine {
  return findDoctrine(captain, wanted) ?? findDoctrine(captain, captain.defaultDoctrine) ?? captain.doctrines?.[0] ?? templateDoctrine("Brawler");
}

// ---------- Slots (8.8) ----------

/** The perk that gives a captain one more doctrine slot: a Helmsman, the Navy Deserter background (granted by crew and Background). */
export const DOCTRINE_SLOT_PERK = "doctrine.slot";

/**
 * How many rules with conditions a captain's doctrine may have: 3, plus one at Command ranks 1 and 4, plus one for each
 * slot perk, up to 7 (D64). The Otherwise rule is always there and does not count.
 */
export function doctrineSlots(captain: Pick<Captain, "skills" | "perks">): number {
  let n = D.baseSlots;
  for (const rank of D.slotRanks) if (captain.skills.command >= rank) n += 1;
  n += captain.perks.filter((p) => p === DOCTRINE_SLOT_PERK).length;
  return Math.min(D.maxSlots, n);
}

// ---------- Validation ----------

const TERRAINS: Record<Terrain, true> = { open: true, shallows: true, reef: true, rocky: true, fog: true, kelp: true, strongCurrent: true, harbour: true };

export interface ValidateOptions {
  slots: number; // see doctrineSlots
  abilities?: AbilityRegistry; // defaults to ABILITIES
}

const isPct = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= PERCENT;
const isRound = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= B.combat.rounds;

function conditionProblem(c: DoctrineCondition, label: string, registry: AbilityRegistry): string | null {
  switch (c?.kind) {
    case "range":
      if (!["is", "atLeast", "atMost"].includes(c.op)) return `${label}: unknown range test ${String(c.op)}`;
      return RANGES.includes(c.range) ? null : `${label}: unknown range ${String(c.range)}`;
    case "round":
      if (!["is", "atLeast"].includes(c.op)) return `${label}: unknown round test ${String(c.op)}`;
      return isRound(c.n) ? null : `${label}: the round must be a whole number from 1 to ${B.combat.rounds}`;
    case "track":
      if (!["mine", "theirs"].includes(c.who)) return `${label}: a Hull, Rigging or Hands test is about mine or theirs`;
      if (!DAMAGE_TRACKS.includes(c.track)) return `${label}: unknown track ${String(c.track)}`;
      if (!["above", "below"].includes(c.op)) return `${label}: a track is above or below a percent`;
      return isPct(c.pct) ? null : `${label}: the percent must be from 0 to ${PERCENT}`;
    case "theirLastHelm": return HELM_MOVES.includes(c.move) ? null : `${label}: unknown Helm move ${String(c.move)}`;
    case "theirLastGuns": return GUNS_ORDERS.includes(c.order) ? null : `${label}: unknown Guns order ${String(c.order)}`;
    case "enemyType": return ENEMY_TYPES.includes(c.type) ? null : `${label}: unknown enemy type ${String(c.type)}`;
    case "enemyCaptain": return typeof c.captainId === "string" && c.captainId !== "" ? null : `${label}: an enemy captain test needs a captainId`;
    case "terrain": return TERRAINS[c.terrain] ? null : `${label}: unknown terrain ${String(c.terrain)}`;
    case "windGauge": return ["mine", "theirs"].includes(c.holder) ? null : `${label}: the wind gauge is mine or theirs`;
    case "havePowder": return null;
    case "abilityUnused": return registry[c.ability] ? null : `${label}: unknown ability ${String(c.ability)}`;
    default: return `${label}: unknown condition ${String((c as { kind?: unknown } | undefined)?.kind)}`;
  }
}

function actionProblem(a: DoctrineAction, label: string, registry: AbilityRegistry): string | null {
  switch (a?.kind) {
    case "fight":
      if (!HELM_MOVES.includes(a.helm)) return `${label}: unknown Helm move ${String(a.helm)}`;
      return GUNS_ORDERS.includes(a.guns) ? null : `${label}: unknown Guns order ${String(a.guns)}`;
    case "ability": return registry[a.ability] ? null : `${label}: unknown ability ${String(a.ability)}`;
    case "surrender": case "jettison": return null;
    default: return `${label}: unknown action ${String((a as { kind?: unknown } | undefined)?.kind)}`;
  }
}

/**
 * Checks a doctrine the way save_doctrine will. Returns a list of problems; empty means valid.
 * Every rule but the last has one or two conditions and counts against the slots; the last rule is Otherwise, with no
 * condition, and must give a Helm move and Guns order or Surrender so that every round has a play (D64).
 */
export function validateDoctrine(doctrine: Doctrine, opts: ValidateOptions): string[] {
  if (!doctrine || typeof doctrine !== "object") return ["doctrine: needs a name and a list of rules"];
  const registry = opts.abilities ?? ABILITIES;
  const p: string[] = [];
  if (typeof doctrine.name !== "string" || doctrine.name.trim() === "") p.push("doctrine: needs a name");
  if (!Array.isArray(doctrine.rules) || doctrine.rules.length === 0) return [...p, "doctrine: needs at least the Otherwise rule"];

  const last = doctrine.rules.length - 1;
  if (last > opts.slots) p.push(`doctrine: ${last} rules with conditions, this captain has ${opts.slots} slots`);
  doctrine.rules.forEach((rule: DoctrineRule, i) => {
    const label = i === last ? "Otherwise" : `rule ${i + 1}`;
    if (!rule || !Array.isArray(rule.if)) { p.push(`${label}: needs a list of conditions`); return; }
    if (rule.if.length > D.maxConditions) p.push(`${label}: ${rule.if.length} conditions, the most is ${D.maxConditions}`);
    if (i === last && rule.if.length > 0) p.push(`${label}: the last rule has no conditions`);
    if (i < last && rule.if.length === 0) p.push(`${label}: only the last rule may have no conditions`);
    for (const c of rule.if) {
      const cp = conditionProblem(c, label, registry);
      if (cp) p.push(cp);
    }
    const ap = actionProblem(rule.then, label, registry);
    if (ap) p.push(ap);
    else if (i === last && rule.then.kind !== "fight" && rule.then.kind !== "surrender") {
      p.push(`${label}: the last rule must give a Helm move and a Guns order, or Surrender`);
    }
  });
  return p;
}

/** Checks a captain's whole list of saved doctrines: at most three, with names that differ. */
export function validateDoctrines(doctrines: Doctrine[], opts: ValidateOptions): string[] {
  if (!Array.isArray(doctrines)) return ["doctrines: needs a list"];
  const p: string[] = [];
  if (doctrines.length > D.savedDoctrines) p.push(`doctrines: ${doctrines.length} saved, a captain may keep ${D.savedDoctrines}`);
  const seen = new Set<string>();
  for (const d of doctrines) {
    const name = typeof d?.name === "string" ? d.name.trim().toLowerCase() : "";
    if (name !== "" && seen.has(name)) p.push(`doctrines: two are called ${d.name}`);
    seen.add(name);
    for (const problem of validateDoctrine(d, opts)) p.push(`${typeof d?.name === "string" ? d.name : "doctrine"}: ${problem}`);
  }
  return p;
}

// ---------- The four templates (8.8) ----------

export const TEMPLATE_NAMES = ["Brawler", "Skirmisher", "Runner", "Coward"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

const T = D.templates;
const fight = (helm: HelmMove, guns: GunsOrder): DoctrineAction => ({ kind: "fight", helm, guns });

/** Closes in, boards at Close, thins their crew with Grapeshot once the ships are locked together. */
const brawler = (): Doctrine => ({
  name: "Brawler",
  rules: [
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: fight("closeIn", "grapeshot") },
    { if: [{ kind: "range", op: "is", range: "close" }], then: fight("closeIn", "board") },
    { if: [{ kind: "track", who: "theirs", track: "hands", op: "below", pct: T.brawlerBoardHandsPct }], then: fight("closeIn", "board") },
    { if: [], then: fight("closeIn", "roundShot") },
  ],
});

/** Crosses their bow for the rake, wrecks their Rigging first, and chases down a ship that tries to run. */
const skirmisher = (): Doctrine => ({
  name: "Skirmisher",
  rules: [
    { if: [{ kind: "theirLastHelm", move: "openRange" }], then: fight("closeIn", "chainShot") },
    { if: [{ kind: "track", who: "theirs", track: "rigging", op: "above", pct: T.skirmisherChainRiggingPct }], then: fight("crossTheirBow", "chainShot") },
    { if: [], then: fight("crossTheirBow", "roundShot") },
  ],
});

/** Flees every round, cuts their Rigging so they cannot keep up, and tries to break free if they grapple. */
const runner = (): Doctrine => ({
  name: "Runner",
  rules: [
    { if: [{ kind: "range", op: "is", range: "grappled" }], then: fight("openRange", "repel") },
    { if: [{ kind: "track", who: "theirs", track: "rigging", op: "above", pct: T.runnerChainRiggingPct }], then: fight("openRange", "chainShot") },
    { if: [], then: fight("openRange", "roundShot") },
  ],
});

/** Holds its ground and fires, and strikes the colours when its Hull is half gone. */
const coward = (): Doctrine => ({
  name: "Coward",
  rules: [
    { if: [{ kind: "track", who: "mine", track: "hull", op: "below", pct: T.cowardStrikesHullPct }], then: { kind: "surrender" } },
    { if: [], then: fight("hold", "roundShot") },
  ],
});

const BUILDERS: Record<TemplateName, () => Doctrine> = { Brawler: brawler, Skirmisher: skirmisher, Runner: runner, Coward: coward };

/** A fresh copy of a template, safe to rename and edit. */
export const templateDoctrine = (name: TemplateName): Doctrine => BUILDERS[name]();

/** Fresh copies of all four templates, in the order of TEMPLATE_NAMES. */
export const templateDoctrines = (): Doctrine[] => TEMPLATE_NAMES.map(templateDoctrine);
