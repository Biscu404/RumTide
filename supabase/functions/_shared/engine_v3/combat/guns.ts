// Guns (GAMEPLAY 8.5): the damage formula, the ammo by range table, Hold Fire, staleness, Powder.
// Pure: no network, no clock, no Math.random. Luck comes from the round's stream (see battleRng in helm.ts).
//
// fireGuns works out what one ship's guns do to another. Both ships of a round fire from the state they had
// when the round began, so the caller calls it once per ship and only then applies both results with
// applyDamage and recordFiring, which return new ships and leave the old ones alone.

import { B } from "../balance.ts";
import type { Rng } from "../rng.ts";
import type { Terrain } from "../types.ts";
import type { BattleShip, DamageTrack, GunsMemory, GunsOrder, Range } from "./types.ts";

const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing

type Ammo = { key: keyof typeof C.range; track: DamageTrack };

/**
 * The orders that fire the great guns, and the track each one hits. Hold Fire, Board and the Deck orders fire nothing here:
 * they count in the deck fight (deck.ts). Only a Bombardier fires the Mortar and only a Firebrand fires Hot Shot.
 */
const AMMO: Partial<Record<GunsOrder, Ammo>> = {
  roundShot: { key: "round", track: "hull" },
  chainShot: { key: "chain", track: "rigging" },
  grapeshot: { key: "grape", track: "hands" },
  mortar: { key: "mortar", track: "hull" },
  hotShot: { key: "hot", track: "hull" },
};

const TRACK_FIELD = { hull: "hullPoints", rigging: "riggingPoints", hands: "hands" } as const;

/** The track an order damages, or null for an order that fires nothing. */
export const gunsTrack = (order: GunsOrder): DamageTrack | null => AMMO[order]?.track ?? null;

/** The "range factor" of the ammo table: 0 for an order that fires nothing, and for every order while Grappled (the guns are quiet). */
export const ammoFactor = (order: GunsOrder, range: Range): number => {
  const ammo = AMMO[order];
  return ammo && range !== "grappled" ? C.range[ammo.key][range] : 0;
};

/** A shot's raw damage as points on the track it hits: Grapeshot removes one Hand for every grapeDamagePerHand damage (D30). */
export const shotPoints = (track: DamageTrack | null, raw: number): number => (track === "hands" ? raw / C.grapeDamagePerHand : raw);

/** Gunnery: full strength at 60% of max Hands, in proportion below that (6.4). */
export function gunnery(ship: BattleShip): number {
  const full = C.gunneryFullShare * ship.maxHands;
  return full > 0 ? Math.min(NEUTRAL, ship.hands / full) : NEUTRAL;
}

/** Playing `order` now would make it the staleAfterRepeats-th round in a row with the same order (8.5). The Mortar never goes stale. */
export const staleNow = (memory: GunsMemory, order: GunsOrder): boolean =>
  order !== "mortar" && (memory.order === order ? memory.repeats + 1 : 1) >= C.staleAfterRepeats;

/** What a ship remembers after playing `order`: the streak, and Hold Fire's bonus for the next round only. */
export const nextGunsMemory = (memory: GunsMemory, order: GunsOrder): GunsMemory => ({
  order,
  repeats: memory.order === order ? memory.repeats + 1 : 1,
  charged: order === "holdFire",
});

/** Long range shots are weaker in Rocky water (cover) and in Fog (2.2), at Long and at Far (spec section 1). */
function terrainFactor(range: Range, terrain: Terrain): number {
  if (range !== "long" && range !== "far") return NEUTRAL;
  if (terrain === "rocky") return C.terrainGuns.rockyLong;
  if (terrain === "fog") return C.terrainGuns.fogLong;
  return NEUTRAL;
}

export interface GunsContext {
  terrain: Terrain;
  helmMod: number; // this ship's rake, flank or stern shot, or weakened modifier from resolveHelm (gunsMod); NEUTRAL for none
  exposed?: number; // the defender reared up: Round shot does this many times the damage this round (D102); absent means NEUTRAL
  zeroing?: number; // the Mortar's Zeroing In factor this round (styles.ts zeroingFactor); absent means NEUTRAL
  longNines?: boolean; // a Gunline that Holds: its Round shot at Long counts the longNines factor instead of the table's
}

const OPEN_WATER: GunsContext = { terrain: "open", helmMod: NEUTRAL };

/** Every factor of the damage formula, so a replay can say why a shot hurt as much as it did. */
export interface GunsFactors {
  base: number; // k x (Cannons / base stat) ^ exponent
  range: number; // the ammo by range table
  gunnery: number;
  helm: number;
  terrain: number;
  exposed: number; // Round shot against a monster that has reared up, else neutral
  powder: number; // the out of Powder factor, else neutral
  charged: number; // Hold Fire's bonus the round after it, else neutral
  stale: number; // the stale factor from the third round in a row with the same order, else neutral (the Mortar never goes stale)
  luck: number; // between luckMin and luckMax
  zeroing?: number; // only for the Mortar: Zeroing In
}

/** A Mortar shell's own roll (D137): it hits `mortarHit` of the time, and a shell that misses does nothing. */
export interface MortarShell {
  roll: number;
  hit: boolean;
}

export interface GunsResult {
  order: GunsOrder;
  track: DamageTrack | null; // null when the order fires nothing
  raw: number; // the formula's result, before rounding and before it is capped by what the target has left
  damage: number; // points taken off the track (Hands lost for Grapeshot), whole, never negative, never more than the target has
  powderUsed: number;
  factors: GunsFactors | null; // null when the order fires nothing, and then no luck is rolled
  shell?: MortarShell; // only for the Mortar
}

/**
 * One ship's guns against another at the new range:
 * damage = k x (Cannons / base stat)^exponent x range x gunnery x helm x terrain x powder x luck, with Hold Fire's bonus
 * and staleness (every factor is in GunsFactors, every number in B.combat). Round shot removes Hull, Chain shot Rigging,
 * Grapeshot Hands at grapeDamagePerHand damage each. Damage is rounded to whole points and capped at what the target
 * has on that track. A ship out of Powder still fires, at the out of Powder factor, and burns none (D27).
 * `rng` is the round's stream; luck is drawn from its child "guns/<attacker id>".
 *
 * The Mortar hits Hull, never goes stale, takes the Zeroing In factor, and draws its hit roll from "mortar/<attacker id>":
 * a shell that misses does no damage but still burns its Powder. Only a Bombardier fires it; runBattle sees to that
 * (styles.ts playableOrder). Long Nines changes the range factor of a Gunline's Round shot at Long. Hot Shot hits Hull and
 * burns `hotShotPowder` times the Powder (with less left it fires and uses up the rest). While Grappled the great guns are
 * quiet: nothing fires, no luck is rolled and no Powder is burned.
 */
export function fireGuns(
  attacker: BattleShip,
  defender: BattleShip,
  range: Range,
  order: GunsOrder,
  rng: Rng,
  ctx: GunsContext = OPEN_WATER,
): GunsResult {
  const ammo = AMMO[order];
  if (!ammo || range === "grappled") return { order, track: null, raw: 0, damage: 0, powderUsed: 0, factors: null };

  const dry = attacker.powder <= 0;
  const mortar = ammo.key === "mortar";
  const factors: GunsFactors = {
    base: C.k * (attacker.cannons / B.baseStat) ** C.exponent,
    range: ctx.longNines && ammo.key === "round" && range === "long" ? B.styles.gunline.longNines : C.range[ammo.key][range],
    gunnery: gunnery(attacker),
    helm: ctx.helmMod,
    terrain: terrainFactor(range, ctx.terrain),
    exposed: ammo.key === "round" ? ctx.exposed ?? NEUTRAL : NEUTRAL,
    powder: dry ? C.outOfPowder : NEUTRAL,
    charged: attacker.guns.charged ? C.holdFireNext : NEUTRAL,
    stale: staleNow(attacker.guns, order) ? C.stale : NEUTRAL,
    luck: rng.stream("guns", attacker.shipId).range(C.luckMin, C.luckMax),
    ...(mortar ? { zeroing: ctx.zeroing ?? NEUTRAL } : {}),
  };
  let shell: MortarShell | undefined;
  if (mortar) {
    const roll = rng.stream("mortar", attacker.shipId).next();
    shell = { roll, hit: roll < B.styles.bombardier.mortarHit };
  }
  const raw = shell && !shell.hit ? 0 : Object.values(factors).reduce((product, f) => product * f, NEUTRAL);
  const points = shotPoints(ammo.track, raw);
  const available = defender[TRACK_FIELD[ammo.track]];
  return {
    order,
    track: ammo.track,
    raw,
    damage: Math.max(0, Math.min(Math.round(points), available)),
    powderUsed: dry ? 0 : Math.min(attacker.powder, B.hulls[attacker.hull].powderPerRound * (order === "hotShot" ? B.styles.firebrand.hotShotPowder : 1)),
    factors,
    ...(shell ? { shell } : {}),
  };
}


const copyShip = (ship: BattleShip): BattleShip => ({ ...ship, abilities: [...ship.abilities], guns: { ...ship.guns } });

/** The defender after a shot lands: the track goes down by the damage, and never below zero. */
export function applyDamage(ship: BattleShip, result: GunsResult): BattleShip {
  const next = copyShip(ship);
  if (result.track) {
    const field = TRACK_FIELD[result.track];
    next[field] = Math.max(0, next[field] - result.damage);
  }
  return next;
}

/** The attacker after firing: the Powder burned, and the memory that drives staleness and Hold Fire's bonus. */
export function recordFiring(ship: BattleShip, order: GunsOrder, result: GunsResult): BattleShip {
  const next = copyShip(ship);
  next.powder = Math.max(0, next.powder - result.powderUsed);
  next.guns = nextGunsMemory(ship.guns, order);
  return next;
}
