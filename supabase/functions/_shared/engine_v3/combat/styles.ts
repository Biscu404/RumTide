// Fighting Styles (docs/specs/fighting-styles.md, D121 to D141): the traits of the Bombardier, the Gunline, the Skirmisher,
// the Rammer, the Boarder, the Firebrand and the Smuggler.
//
// A trait belongs to the ship's captain and pays only in a round its own move or order is played (D122), so a captain who
// writes another style's rules does not get that style's trait. Every number is in `B.styles`. Pure, with no randomness of
// its own: the rolls a trait needs (a Ram, a Mortar shell, the dash spoiling a rake, grapnels taking hold, a fire catching)
// are drawn by helm.ts and battle.ts, each from its own labelled stream, so no other roll moves (D16).

import { B } from "../balance.ts";
import { drillUnlocked } from "../ship.ts";
import type { FightingStyle } from "../types.ts";
import { BATTLE_SIDES } from "./types.ts";
import type { BattleShip, BattleSide, GunsOrder, HelmMove, HelmRow, Range } from "./types.ts";

const S = B.styles;
const C = B.combat;
const NEUTRAL = 1; // a factor that changes nothing

const other = (side: BattleSide): BattleSide => (side === "hunter" ? "target" : "hunter");

/** The ship sails with this Fighting Style. A ship with no style (Old Shellback, an NPC) has none of the traits. */
export const hasStyle = (ship: Pick<BattleShip, "style">, style: FightingStyle): boolean => ship.style === style;

// ---------- Orders ----------

/**
 * The Guns order a ship really fires. Only a Bombardier has a Mortar and only a Firebrand has Hot Shot, so any other ship that
 * is given one (a doctrine copied from another style) fires Round shot instead, and a copied doctrine always plays (spec edge
 * cases). The Deck orders pass through: they are settled in the deck fight (deck.ts), where a crew that cannot use one fights with Fists.
 */
export function playableOrder(ship: Pick<BattleShip, "style">, order: GunsOrder): GunsOrder {
  if (order === "mortar" && !hasStyle(ship, "bombardier")) return "roundShot";
  if (order === "hotShot" && !hasStyle(ship, "firebrand")) return "roundShot";
  return order;
}

// ---------- Helm ----------

/**
 * Slippery: a Smuggler's Helm score counts `slippery` times in a round it Opens Range. The chase: a Boarder's counts `chase`
 * times in a round it Closes In (D139). Either applies to every contest of the round.
 */
export const styleHelmFactor = (ship: Pick<BattleShip, "style">, move: HelmMove): number => {
  if (hasStyle(ship, "smuggler") && move === "openRange") return S.smuggler.slippery;
  if (hasStyle(ship, "boarder") && move === "closeIn") return S.boarder.chase;
  return NEUTRAL;
};

/** Spotters: a battle with a Bombardier flagship starts at Far (it would otherwise start at Long, see startingRange). */
export const spotters = (flagships: readonly Pick<BattleShip, "style">[]): boolean =>
  S.bombardier.startFar && flagships.some((s) => hasStyle(s, "bombardier"));

/** Dash: the bands a Rammer's Close In moves beyond the table's. 0 for any other ship or move. */
export const dashBands = (ship: Pick<BattleShip, "style">, move: HelmMove): number =>
  hasStyle(ship, "rammer") && move === "closeIn" ? S.rammer.dashBands : 0;

/**
 * The guns modifiers of one pair of the Helm table once each ship's trait is counted:
 * Kite (a Skirmisher that Opens Range is not weakened), Braced (a rake against a Gunline that Holds is `bracedRake`, and the
 * Gunline is not weakened by it) and Steady Deck (a Gunline that Holds does `steadyDeck` more). `moves` are as played.
 */
export function styleGunsMods(
  row: HelmRow, ships: Record<BattleSide, Pick<BattleShip, "style">>, moves: Record<BattleSide, HelmMove>, gunsMod: Record<BattleSide, number>,
): Record<BattleSide, number> {
  const out = { ...gunsMod };
  for (const side of BATTLE_SIDES) {
    const ship = ships[side];
    if (S.skirmisher.kite && hasStyle(ship, "skirmisher") && moves[side] === "openRange" && out[side] === C.weakened) out[side] = NEUTRAL;
    if (hasStyle(ship, "gunline") && moves[side] === "hold") {
      if (row === "crossHold") {
        out[other(side)] = Math.min(out[other(side)], S.gunline.bracedRake);
        out[side] = NEUTRAL;
      }
      out[side] *= S.gunline.steadyDeck;
    }
  }
  return out;
}

/** The dash spoils a rake: a Rammer that Closes In while the other ship crosses its bow may spoil the rake (a Helm contest). */
export const canSpoilRake = (row: HelmRow, ship: Pick<BattleShip, "style">, move: HelmMove): boolean =>
  row === "crossClose" && hasStyle(ship, "rammer") && move === "closeIn";

/** The modifiers once a dashing Rammer has spoiled the rake: the rake is `spoiledRake`, and the Rammer is not weakened. */
export function spoiledRake(rammer: BattleSide, gunsMod: Record<BattleSide, number>): Record<BattleSide, number> {
  return { ...gunsMod, [rammer]: NEUTRAL, [other(rammer)]: S.rammer.spoiledRake } as Record<BattleSide, number>;
}

// ---------- The Ram ----------

/** At Close, a Rammer's Close In is a Ram (spec section 3). A Crippled Rammer can still Close In, so it can still Ram. */
export const isRam = (ship: Pick<BattleShip, "style">, move: HelmMove, range: Range): boolean =>
  range === "close" && hasStyle(ship, "rammer") && move === "closeIn";

/**
 * The Hull a Ram that lands takes off the struck ship: `ramHull`, times `bracedRam` against a Gunline that Holds, and times
 * `ramWhileBoarding` against a Boarder that plays Board, because its grapnels are already on the Rammer's bow.
 */
export const ramHull = (struck: Pick<BattleShip, "style">, struckMove: HelmMove, struckOrder?: GunsOrder): number =>
  Math.round(
    S.rammer.ramHull
    * (hasStyle(struck, "gunline") && struckMove === "hold" ? S.gunline.bracedRam : NEUTRAL)
    * (hasStyle(struck, "boarder") && struckOrder === "board" ? S.boarder.ramWhileBoarding : NEUTRAL),
  );

/** The Hull a Ram that lands costs the Rammer itself (D139). */
export const ramSelf = (): number => S.rammer.ramSelf;

// ---------- Guns ----------

/** Zeroing In: the Mortar's factor after `streak` rounds in a row with the range unchanged, `zeroStep` each, up to `zeroMax`. */
export const zeroingFactor = (streak: number): number => Math.min(S.bombardier.zeroMax, NEUTRAL + S.bombardier.zeroStep * Math.max(0, streak));

/** Long Nines: a Gunline that Holds fires its Round shot at Long at `longNines` instead of the table's Long factor. */
export const firesLongNines = (ship: Pick<BattleShip, "style">, move: HelmMove): boolean => hasStyle(ship, "gunline") && move === "hold";

// ---------- The Boarder (spec section 3) ----------

/** Grapnel lines: a Boarder's Board works from Short as well as from Close. */
export const boardsFromShort = (ship: Pick<BattleShip, "style">): boolean => S.boarder.grapnelLines && hasStyle(ship, "boarder");

/**
 * Grapnels: Lashed fast holds for the ship in every grapple it is in, and a Board that would fail on Helm score gets a Helm
 * contest instead. A Boarder has them from the start (its grapnel lines); any other ship unlocks them at Drill 10.
 */
export const hasGrapnels = (ship: Pick<BattleShip, "style" | "drill">): boolean =>
  boardsFromShort(ship) || drillUnlocked(ship.drill ?? 0, "grapnels");

/** The Boarder's score counts `grapnelBonus` times in the Helm contest of a failed Board; any other ship's counts once. */
export const grapnelBonus = (ship: Pick<BattleShip, "style">): number => (hasStyle(ship, "boarder") ? S.boarder.grapnelBonus : NEUTRAL);

/** Fighters: a Boarder's crew fights with `fighters` times the boarding strength. */
export const fightersFactor = (ship: Pick<BattleShip, "style">): number => (hasStyle(ship, "boarder") ? S.boarder.fighters : NEUTRAL);

// ---------- The Firebrand (spec section 3) ----------

/** Tinderbox: a crew fighting a Firebrand on deck fights at `tinderbox` of its strength. `foes` are the ships of the other side. */
export const tinderboxFactor = (foes: readonly Pick<BattleShip, "style">[]): number =>
  foes.some((f) => hasStyle(f, "firebrand")) ? S.firebrand.tinderbox : NEUTRAL;

/** Fire Pots need a pot in the hold and the right to throw it: a Firebrand has it from the start, any other style at Drill 5. */
export const canThrowPots = (ship: Pick<BattleShip, "style" | "drill" | "firePots">): boolean =>
  (ship.firePots ?? 0) > 0 && (hasStyle(ship, "firebrand") || drillUnlocked(ship.drill ?? 0, "firePots"));

/** The chance a shot of this order starts a fire when it hits: a Hot Shot hit `hotShotFire`, a Mortar hit `mortarFire`, any other 0. */
export const shotFireChance = (order: GunsOrder): number =>
  order === "hotShot" ? S.firebrand.hotShotFire : order === "mortar" ? S.bombardier.mortarFire : 0;

/** Fireship: while Grappled with a Firebrand, the enemy deck catches fire `emberChance` of the time each round. */
export const emberChance = (ship: Pick<BattleShip, "style">): number => (hasStyle(ship, "firebrand") ? S.firebrand.emberChance : 0);
