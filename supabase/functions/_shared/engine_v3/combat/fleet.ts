// Fleets (GAME_DESIGN 7.5 and 9 rule 4, GAMEPLAY 8.8): sides of several ships, the flagship, the fleet bonus, Desperate
// Defence, and sharing damage out between the ships of a side.
// Pure: no network, no clock, no Math.random. The only rolls are the Helm contests of fleet mates, each from a child of the
// round's stream named after the ship, so adding a mate never shifts a roll of the flagships (D16).
//
// A battle has one range, and the two flagships' Helm moves move it (the pair table of 8.4). Every other ship, a fleet
// mate, is judged against the enemy flagship: its Helm move against the flagship's gives its own rake or flank shot,
// its Board order tries to grapple the flagship, and its Open Range tries to cut free of it. Its guns, its Hands and
// its Reef scrape are its own. A one ship a side battle uses none of this and runs exactly as it did before fleets.

import { B } from "../balance.ts";
import type { Rng } from "../rng.ts";
import type { ShipId, Terrain } from "../types.ts";
import { boardingStrength, grappleReason } from "./boarding.ts";
import { applyPair, contestRecord, playableMove, pairRow, reefScrape } from "./helm.ts";
import type {
  BattleShip, BattleSide, ContestRecord, DamageTrack, GrappleRecord, GunsOrder, HelmMove, MeleeRecord, Range, SideBonus,
} from "./types.ts";

const F = B.fleet;
const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing
const EPSILON = 1e-9; // keeps a share that is a whole number in exact arithmetic from rounding down in floating point

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

// ---------- The bonuses (7.5) ----------

/** 1 plus 10% for each ship beyond the first, up to +30%. */
export const fleetBonus = (extraShips: number): number =>
  NEUTRAL + Math.min(F.battleBonusCap, F.battleBonusPerExtraShip * Math.max(0, extraShips));

/** 1 plus 25% for each enemy ship beyond your own number, up to +75%. */
export const desperateDefence = (extraEnemyShips: number): number =>
  NEUTRAL + Math.min(F.desperateCap, F.desperatePerExtraEnemy * Math.max(0, extraEnemyShips));

/**
 * What a side's damage is multiplied by (7.5): the fleet bonus for its own ships, and Desperate Defence when the side is
 * made only of player ships and the enemy has more ships than it does. A side with an NPC ship never gets it: the
 * galleon and the Kraken are built for fleets already.
 */
export function sideBonus(own: number, enemy: number, onlyPlayers: boolean): SideBonus {
  const fleet = fleetBonus(own - 1);
  const desperate = onlyPlayers && enemy > own ? desperateDefence(enemy - own) : NEUTRAL;
  return { ships: own, fleet, desperate, total: fleet * desperate };
}

// ---------- The flagship (7.5) ----------

export interface FlagshipCandidate {
  id: ShipId;
  power: number; // the Power Rating (D26)
  lead: boolean; // the ship that started the hunt (hunter side) or was caught (target side)
}

/** The highest Power Rating. A tie goes to the lead ship, which started the hunt, then to the lower ship id. */
export function pickFlagship(side: readonly FlagshipCandidate[]): ShipId {
  const best = [...side].sort((a, b) => b.power - a.power || Number(b.lead) - Number(a.lead) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  if (!best) throw new Error("A battle side needs at least one ship");
  return best.id;
}

// ---------- Whole numbers, shared out ----------

/**
 * Splits a whole number between parts in proportion to their weights, in whole units: each part gets the share rounded
 * down, and the units left go to the parts with the biggest remainders, the lower index first. The parts always add up
 * to `total`. If every weight is 0 the parts are equal.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  const whole = Math.max(0, Math.floor(total));
  if (n === 0) return [];
  if (n === 1) return [whole];
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  const exact = weights.map((w) => (sum > 0 ? (whole * Math.max(0, w)) / sum : whole / n));
  const parts = exact.map((x) => Math.floor(x + EPSILON));
  // The units left over go to the biggest remainders. Floating point can also leave a unit too many; take it back from the smallest.
  const byRemainder = exact.map((x, i) => ({ i, r: x - (parts[i] as number) })).sort((a, b) => b.r - a.r || a.i - b.i);
  let left = whole - parts.reduce((a, p) => a + p, 0);
  for (let k = 0; left > 0; k = (k + 1) % n) {
    (parts[(byRemainder[k] as { i: number }).i] as number) += 1;
    left -= 1;
  }
  for (let k = n - 1; left < 0; k = (k + n - 1) % n) {
    const i = (byRemainder[k] as { i: number }).i;
    if ((parts[i] as number) > 0) {
      (parts[i] as number) -= 1;
      left += 1;
    }
  }
  return parts;
}

/**
 * Like apportion, but no part may pass its cap. What a capped part cannot take goes to the parts that can, in the same
 * proportion; anything nobody has room for is left out, so the parts can add up to less than `total`.
 */
export function shareOut(total: number, weights: readonly number[], caps: readonly number[]): number[] {
  const parts = weights.map(() => 0);
  let left = Math.max(0, Math.floor(total));
  const room = (i: number) => Math.max(0, Math.floor(caps[i] as number)) - (parts[i] as number);
  for (let pass = 0; pass <= weights.length && left > 0; pass++) {
    const open = weights.map((_, i) => i).filter((i) => room(i) > 0);
    if (open.length === 0) break;
    const shares = apportion(left, open.map((i) => weights[i] as number));
    let gave = 0;
    open.forEach((i, k) => {
      const give = Math.min(shares[k] as number, room(i));
      (parts[i] as number) += give;
      gave += give;
    });
    left -= gave;
    if (gave === 0) break;
  }
  return parts;
}

// ---------- Damage to a side (7.5) ----------

export const trackNow = (ship: BattleShip, track: DamageTrack): number =>
  track === "hull" ? ship.hullPoints : track === "rigging" ? ship.riggingPoints : ship.hands;

/** Damage a side receives is split across its ships in proportion to their max Hull, never past what a ship has left on that track. */
export function shareDamage(victims: readonly BattleShip[], track: DamageTrack, total: number): number[] {
  return shareOut(total, victims.map((v) => v.maxHullPoints), victims.map((v) => trackNow(v, track)));
}

/** One ship's guns this round: the track it hit and the points on that track before any bonus. */
export interface Shot {
  ship: ShipId;
  track: DamageTrack | null;
  points: number;
}

/** What a side's guns deal in total, per track, in whole points: the points added up, times the side's bonus (7.5), rounded once. */
export function strikeTotals(shots: readonly Shot[], multiplier: number): Record<DamageTrack, number> {
  const sums: Record<DamageTrack, number> = { hull: 0, rigging: 0, hands: 0 };
  for (const shot of shots) if (shot.track) sums[shot.track] += shot.points;
  return { hull: Math.round(sums.hull * multiplier), rigging: Math.round(sums.rigging * multiplier), hands: Math.round(sums.hands * multiplier) };
}

/** A ship after its tracks lose points. Never below 0. */
export function withLosses(ship: BattleShip, lost: Record<DamageTrack, number>): BattleShip {
  return {
    ...ship,
    abilities: [...ship.abilities],
    guns: { ...ship.guns },
    hullPoints: Math.max(0, ship.hullPoints - lost.hull),
    riggingPoints: Math.max(0, ship.riggingPoints - lost.rigging),
    hands: Math.max(0, ship.hands - lost.hands),
  };
}

export const noLosses = (): Record<DamageTrack, number> => ({ hull: 0, rigging: 0, hands: 0 });

// ---------- Fleet mates at the Helm (8.4, 7.5) ----------

export interface MateHelm {
  move: HelmMove; // after the Crippled rule
  gunsMod: number; // its rake, flank or weakened shot, from its move against the enemy flagship's
  scrape: number; // Hull lost to a Reef scrape
  contest: ContestRecord | null; // the chase contest of Close In against Open Range, if it was rolled
}

/**
 * A fleet mate's Helm for the round, judged against the enemy flagship (7.5). The pair table of 8.4 gives it its guns
 * modifier; the range itself is moved by the flagships only. While Grappled the table does not apply. `rng` is the
 * round's stream; the chase roll comes from its child "helm/chase/<ship id>".
 */
export function mateHelm(
  mate: BattleShip, asked: HelmMove, score: number, foe: { move: HelmMove; score: number },
  range: Range, terrain: Terrain, rng: Rng,
): MateHelm {
  const move = playableMove(mate, asked);
  if (range === "grappled") return { move, gunsMod: NEUTRAL, scrape: 0, contest: null };
  const side = mate.side;
  const scores = { [side]: score, [other(side)]: foe.score } as Record<BattleSide, number>;
  let contest: ContestRecord | null = null;
  let chaseWinner: BattleSide = "hunter";
  if (pairRow(move, foe.move) === "closeOpen") {
    contest = { ...contestRecord(rng.stream("helm", "chase", mate.shipId), "chase", side, scores), ship: mate.shipId };
    chaseWinner = contest.winner;
  }
  const moves = { [side]: move, [other(side)]: foe.move } as Record<BattleSide, HelmMove>;
  const pair = applyPair(moves, range, chaseWinner);
  return { move, gunsMod: pair.gunsMod[side], scrape: reefScrape(terrain, mate, move), contest };
}

/** A fleet mate playing Open Range while Grappled tries to cut free of the enemy flagship (8.6). Null if it plays anything else. */
export function mateCutFree(mate: BattleShip, move: HelmMove, score: number, foeScore: number, rng: Rng): ContestRecord | null {
  if (move !== "openRange") return null;
  const side = mate.side;
  const scores = { [side]: score, [other(side)]: foeScore } as Record<BattleSide, number>;
  return { ...contestRecord(rng.stream("helm", "cutFree", mate.shipId), "cutFree", side, scores), ship: mate.shipId };
}

// ---------- Boarding for a fleet (8.6) ----------

export interface FleetGrappleInput {
  range: Range; // the range after the Helm step
  ids: Record<BattleSide, readonly ShipId[]>; // every ship of each side, in ship id order
  flagships: Record<BattleSide, ShipId>;
  orders: Record<ShipId, GunsOrder>;
  moves: Record<ShipId, HelmMove>;
  scores: Record<ShipId, number>;
}

/**
 * Board orders played at Close, one per ship that plays one, hunter side first. Each ship tries against the enemy
 * flagship's score, order and Helm move (8.5). A fleet mate's record names the ship; a flagship's does not, as in a
 * one ship battle. If any attempt succeeds the whole battle is Grappled.
 */
export function fleetGrapples(i: FleetGrappleInput): GrappleRecord[] {
  if (i.range !== "close") return [];
  const attempts: GrappleRecord[] = [];
  for (const side of ["hunter", "target"] as const) {
    const foe = i.flagships[other(side)];
    for (const id of i.ids[side]) {
      if (i.orders[id] !== "board") continue;
      const why = grappleReason(i.scores[id] as number, i.scores[foe] as number, i.orders[foe] as GunsOrder, i.moves[foe] as HelmMove);
      attempts.push({ side, ok: why !== "failed", why, ...(id === i.flagships[side] ? {} : { ship: id }) });
    }
  }
  return attempts;
}

export interface FleetMelee {
  record: MeleeRecord; // strength, Hands lost and Hands left, for each whole side
  lost: Record<ShipId, number>; // Hands each ship lost
  credit: Record<ShipId, number>; // each ship's part in the Hands its side killed, by boarding strength: a side's parts add up to 1
}

/**
 * The boarding melee of a Grappled round, side against side. A side's boarding strength is its ships' added up; it removes
 * 20% of that, times its bonus (7.5), from the enemy's Hands, shared out by max Hull and never past the Hands a ship has.
 */
export function fleetMelee(
  ids: Record<BattleSide, readonly ShipId[]>, ships: Record<ShipId, BattleShip>, orders: Record<ShipId, GunsOrder>,
  terrain: Terrain, bonus: Record<BattleSide, SideBonus>,
): FleetMelee {
  const crew = (side: BattleSide) => ids[side].map((id) => ships[id] as BattleShip);
  const strengthOf: Record<ShipId, number> = {};
  const strength = { hunter: 0, target: 0 };
  for (const side of ["hunter", "target"] as const) {
    for (const ship of crew(side)) {
      strengthOf[ship.shipId] = boardingStrength(ship, orders[ship.shipId] as GunsOrder, terrain);
      strength[side] += strengthOf[ship.shipId] as number;
    }
  }
  const lost: Record<ShipId, number> = {};
  const credit: Record<ShipId, number> = {};
  const sideLost = { hunter: 0, target: 0 };
  const hands = { hunter: 0, target: 0 };
  for (const side of ["hunter", "target"] as const) {
    const victims = crew(side);
    const have = victims.reduce((n, v) => n + v.hands, 0);
    sideLost[side] = Math.min(have, Math.round(C.boarding.killShare * strength[other(side)] * bonus[other(side)].total));
    hands[side] = have - sideLost[side];
    const parts = shareDamage(victims, "hands", sideLost[side]);
    victims.forEach((v, i) => { lost[v.shipId] = parts[i] as number; });
  }
  for (const side of ["hunter", "target"] as const) {
    const killers = crew(side);
    const parts = apportionFloat(1, killers.map((k) => strengthOf[k.shipId] as number));
    killers.forEach((k, i) => { credit[k.shipId] = parts[i] as number; });
  }
  return { record: { strength, lost: sideLost, hands }, lost, credit };
}

/** Splits an amount in proportion to weights, not in whole units: for credit that only has to add up. Equal parts if every weight is 0. */
export function apportionFloat(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  return weights.map((w) => (sum > 0 ? (total * Math.max(0, w)) / sum : weights.length > 0 ? total / weights.length : 0));
}
