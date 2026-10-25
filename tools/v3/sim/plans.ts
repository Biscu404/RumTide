// Doctrines for the simulator that the game does not ship (P3.1): random plans, random doctrines for the search, and
// plain words for printing a doctrine. Nothing here is a rule. The randomness is the simulator's own and is seeded.

import { HELM_MOVES, RANGES, rngFor, validateDoctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import type {
  Chooser, Doctrine, DoctrineAction, DoctrineCondition, DoctrineRule, FightingStyle, GunsOrder, HelmMove, Range, Rng,
} from "../../../supabase/functions/_shared/engine_v3/index.ts";

/**
 * The Guns orders every ship can give, whatever its style or Drill: the six explicit ones. The random plans of check 4 play only
 * these, so a ship with no style is measured as before. What a ship of a given style can try beyond them (the Mortar, Hot Shot, the
 * Deck orders) is decided in one place, plays.ts.
 */
export const SIM_GUNS_ORDERS: readonly GunsOrder[] = ["roundShot", "chainShot", "grapeshot", "holdFire", "board", "repel"];

// ---------- Random plans (the "random plans" of GAME_DESIGN 7.3, carried into v0.3) ----------

/** The Guns orders a random plan picks from when the ships are not at Close: ammo only. */
const AMMO: readonly GunsOrder[] = ["roundShot", "chainShot", "grapeshot"];
/** At Close, Board is a real choice too. */
const AMMO_AT_CLOSE: readonly GunsOrder[] = [...AMMO, "board"];
/** While Grappled, Repel is. */
const AMMO_GRAPPLED: readonly GunsOrder[] = [...AMMO, "repel"];

/**
 * A captain with no doctrine at all: every round an independent random Helm move and a random Guns order that can do
 * something at the range they are at (ammo anywhere, Board at Close, Repel when Grappled). The same battle seed and side
 * always give the same plan. This is the "random plan" of GAME_DESIGN 7.3: it measures how much the ships matter when
 * nobody is reading anybody.
 */
export function randomPlan(seed: number, side: string): Chooser {
  const rng = rngFor(seed, "sim", "plan", side);
  return (view) => {
    const helm = HELM_MOVES[Math.floor(rng.next() * HELM_MOVES.length)]!;
    const pool = view.range === "close" ? AMMO_AT_CLOSE : view.range === "grappled" ? AMMO_GRAPPLED : AMMO;
    const guns = pool[Math.floor(rng.next() * pool.length)]!;
    return { kind: "fight", rule: 0, abilities: [], helm, guns };
  };
}

// ---------- Random doctrines, for the search for a good one ----------

const RANGES_USED: readonly Range[] = RANGES; // the six distances
const PCTS = [25, 50, 75] as const;

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)]!;

/**
 * What a doctrine of the search may write: the Guns orders its ship can give, and the Fighting Styles a "their style is X"
 * condition may name. With no styles the condition is never written. The default is a ship with no style: the six orders of
 * SIM_GUNS_ORDERS and no style test, which is what the random doctrines of P3.1 were.
 */
export interface DoctrineSpace {
  orders: readonly GunsOrder[];
  styles: readonly FightingStyle[];
}

export const PLAIN_SPACE: DoctrineSpace = { orders: SIM_GUNS_ORDERS, styles: [] };

export function randomCondition(rng: Rng, space: DoctrineSpace = PLAIN_SPACE): DoctrineCondition {
  // The style test is one more kind of condition, drawn only when the space has styles, so a plain space draws exactly as before.
  switch (Math.floor(rng.next() * (space.styles.length > 0 ? 8 : 7))) {
    case 0: return { kind: "round", op: "is", n: 1 + Math.floor(rng.next() * 5) };
    case 1: return { kind: "round", op: "atLeast", n: 2 + Math.floor(rng.next() * 4) };
    case 2: return { kind: "range", op: pick(rng, ["is", "atLeast", "atMost"] as const), range: pick(rng, RANGES_USED) };
    case 3: return { kind: "track", who: "mine", track: pick(rng, ["hull", "rigging", "hands"] as const), op: pick(rng, ["above", "below"] as const), pct: pick(rng, PCTS) };
    case 4: return { kind: "track", who: "theirs", track: pick(rng, ["hull", "rigging", "hands"] as const), op: pick(rng, ["above", "below"] as const), pct: pick(rng, PCTS) };
    case 5: return { kind: "theirLastHelm", move: pick(rng, HELM_MOVES) };
    case 6: return { kind: "theirLastGuns", order: pick(rng, space.orders) };
    default: return { kind: "theirStyle", style: pick(rng, space.styles) };
  }
}

export const randomAction = (rng: Rng, space: DoctrineSpace = PLAIN_SPACE): DoctrineAction => ({
  kind: "fight", helm: pick(rng, HELM_MOVES), guns: pick(rng, space.orders),
});

export function randomRule(rng: Rng, space: DoctrineSpace = PLAIN_SPACE): DoctrineRule {
  const conditions = rng.next() < 0.35 ? 2 : 1;
  return { if: Array.from({ length: conditions }, () => randomCondition(rng, space)), then: randomAction(rng, space) };
}

/** A valid doctrine with up to `slots` rules with conditions and an Otherwise, named for the search. */
export function randomDoctrine(rng: Rng, name: string, slots = 3, space: DoctrineSpace = PLAIN_SPACE): Doctrine {
  const count = 1 + Math.floor(rng.next() * slots);
  const doctrine: Doctrine = {
    name,
    rules: [...Array.from({ length: count }, () => randomRule(rng, space)), { if: [], then: randomAction(rng, space) }],
  };
  return doctrine;
}

/**
 * A copy with one thing changed: a condition, an action, a rule added or dropped. The result is always valid for `slots`. Whatever
 * is written new comes from `space`; what the doctrine already had stays, even an order the space does not list.
 */
export function mutateDoctrine(rng: Rng, d: Doctrine, name: string, slots = 3, space: DoctrineSpace = PLAIN_SPACE): Doctrine {
  const rules: DoctrineRule[] = d.rules.map((r) => ({ if: r.if.map((c) => ({ ...c })), then: { ...r.then } }));
  const last = rules.length - 1;
  switch (Math.floor(rng.next() * 5)) {
    case 0: // new action on a rule (Otherwise included)
      rules[Math.floor(rng.next() * rules.length)]!.then = randomAction(rng, space);
      break;
    case 1: { // new condition in a rule with conditions
      if (last === 0) break;
      const r = rules[Math.floor(rng.next() * last)]!;
      const at = Math.floor(rng.next() * r.if.length);
      r.if[at] = randomCondition(rng, space);
      break;
    }
    case 2: // add a rule
      if (last < slots) rules.splice(Math.floor(rng.next() * (last + 1)), 0, randomRule(rng, space));
      break;
    case 3: // drop a rule
      if (last > 1) rules.splice(Math.floor(rng.next() * last), 1);
      break;
    default: { // add or drop a second condition
      if (last === 0) break;
      const r = rules[Math.floor(rng.next() * last)]!;
      if (r.if.length === 1) r.if.push(randomCondition(rng, space)); else r.if.pop();
    }
  }
  const out: Doctrine = { name, rules };
  return validateDoctrine(out, { slots }).length === 0 ? out : { name, rules: d.rules.map((r) => ({ if: r.if.map((c) => ({ ...c })), then: { ...r.then } })) };
}

// ---------- Words ----------

const HELM_WORDS: Record<HelmMove, string> = { closeIn: "Close In", hold: "Hold", openRange: "Open Range", crossTheirBow: "Cross Their Bow" };
const GUNS_WORDS: Record<GunsOrder, string> = {
  roundShot: "Round shot", chainShot: "Chain shot", grapeshot: "Grapeshot", holdFire: "Hold Fire", board: "Board", repel: "Repel", mortar: "Mortar",
  hotShot: "Hot Shot", charge: "Charge", volley: "Volley", firePots: "Fire Pots",
};
const RANGE_WORDS: Record<Range, string> = { far: "Far", long: "Long", medium: "Medium", short: "Short", close: "Close", grappled: "Grappled" };

export const helmWord = (m: HelmMove): string => HELM_WORDS[m];
export const gunsWord = (g: GunsOrder): string => GUNS_WORDS[g];

export function conditionText(c: DoctrineCondition): string {
  switch (c.kind) {
    case "range": return `range ${c.op === "is" ? "is" : c.op === "atLeast" ? "is at least" : "is at most"} ${RANGE_WORDS[c.range]}`;
    case "round": return `round ${c.op === "is" ? "is" : "is at least"} ${c.n}`;
    case "track": return `${c.who === "mine" ? "my" : "their"} ${c.track} ${c.op} ${c.pct}%`;
    case "theirLastHelm": return `their last Helm move was ${HELM_WORDS[c.move]}`;
    case "theirLastGuns": return `their last Guns order was ${GUNS_WORDS[c.order]}`;
    case "enemyType": return `enemy type is ${c.type}`;
    case "enemyCaptain": return `enemy captain is ${c.captainId}`;
    case "theirStyle": return `their style is ${c.style}`;
    case "mood": return `his mood is ${c.mood}`; // Old Shellback's own doctrine only; the search never writes one
    case "terrain": return `terrain is ${c.terrain}`;
    case "windGauge": return `the wind gauge is ${c.holder}`;
    case "havePowder": return "I have Powder";
    case "haveFirePots": return "I have Fire Pots";
    case "abilityUnused": return `${c.ability} is unused`;
  }
}

export function actionText(a: DoctrineAction): string {
  switch (a.kind) {
    case "fight": return `${HELM_WORDS[a.helm]}, ${GUNS_WORDS[a.guns]}`;
    case "ability": return `ability ${a.ability}`;
    case "surrender": return "Surrender";
    case "jettison": return "Jettison";
  }
}

/** A doctrine as numbered lines in plain words, the way GAMEPLAY 8.8 prints the Boarders example. */
export function doctrineLines(d: Doctrine): string[] {
  return d.rules.map((r, i) =>
    r.if.length === 0 ? `${i + 1}. Otherwise: ${actionText(r.then)}` : `${i + 1}. IF ${r.if.map(conditionText).join(" AND ")} THEN ${actionText(r.then)}`);
}
