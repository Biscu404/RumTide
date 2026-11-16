// The sandbox battle viewer (docs/briefs/sandbox.md, stage 1): builds two ships and runs one battle on the real engine_v3.
// Nothing here has a rule of its own. Ships are built the way the simulator's arena builds them (tools/v3/sim/arena.ts).

import {
  SHELLBACK_ID, applyStatline, battleShipOf, doctrineChooser, maxHands, maxHullPoints, maxRiggingPoints, newShip, runBattle,
  shellbackDoctrine, shellbackStatline, styleTemplate, templateDoctrine, FIGHTING_STYLES, SEASON_PRESETS,
} from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { BattleRecord, BattleShip, BattleSide, Doctrine, EnemyType, FightingStyle } from "../../supabase/functions/_shared/engine_v3/index.ts";

/** What a side of the viewer can be: a Fighting Style, or (on the right only) Old Shellback. */
export type Pick = FightingStyle | "shellback";

export const STYLE_PICKS: readonly FightingStyle[] = FIGHTING_STYLES;
export const RIGHT_PICKS: readonly Pick[] = [...FIGHTING_STYLES, "shellback"];

/** The viewer's two sides and the engine's names for them. The left ship is always the hunter. */
export const LEFT: BattleSide = "hunter";
export const RIGHT: BattleSide = "target";

/** Every sandbox battle is fought on this Tide: Old Shellback is still whole (he tires from Tide 9 on). */
export const SANDBOX_TIDE = 6;

const FLAGS = { charted: false, withCurrent: false, lurker: false };

export const pickName = (pick: Pick): string => (pick === "shellback" ? "Old Shellback" : styleTemplate(pick));

/** The doctrine a pick fights with: the style's template, or Old Shellback's own habits. */
export const doctrineFor = (pick: Pick): Doctrine => (pick === "shellback" ? shellbackDoctrine() : templateDoctrine(styleTemplate(pick)));

const enemyTypeOf = (pick: Pick): EnemyType => (pick === "shellback" ? "monster" : "player");

function battleShipFor(pick: Pick, side: BattleSide): BattleShip {
  const id = side === LEFT ? "left" : "right";
  if (pick === "shellback") {
    const ship = newShip(`ship_${id}`, SHELLBACK_ID, "Old Shellback", "sloop", "the_narrows", false);
    applyStatline(ship, shellbackStatline(SANDBOX_TIDE, SEASON_PRESETS.season0.shellbackDecayFromTide));
    return battleShipOf(ship, { id: SHELLBACK_ID }, side, FLAGS);
  }
  const name = `The ${styleTemplate(pick)}${side === LEFT ? "" : " II"}`;
  const ship = newShip(`ship_${id}`, `cap_${id}`, name, "sloop", "the_narrows", false, pick);
  ship.hullPoints = maxHullPoints(ship);
  ship.riggingPoints = maxRiggingPoints(ship);
  ship.hands = maxHands(ship);
  return battleShipOf(ship, { id: `cap_${id}` }, side, FLAGS);
}

export interface Fight {
  seed: number;
  picks: Record<BattleSide, Pick>;
  doctrines: Record<BattleSide, Doctrine>;
  record: BattleRecord;
}

/** One battle in open water in a Breeze. The same picks and seed always give the same battle. */
export function runFight(left: FightingStyle, right: Pick, seed: number): Fight {
  const picks: Record<BattleSide, Pick> = { hunter: left, target: right };
  const doctrines: Record<BattleSide, Doctrine> = { hunter: doctrineFor(left), target: doctrineFor(right) };
  const record = runBattle({
    tide: SANDBOX_TIDE, seed: seed >>> 0, at: "the_narrows", terrain: "open", wind: "breeze",
    hunter: battleShipFor(left, LEFT),
    target: battleShipFor(right, RIGHT),
    doctrines: { hunter: doctrines.hunter.name, target: doctrines.target.name },
    choosers: {
      hunter: doctrineChooser(doctrines.hunter, { enemyType: enemyTypeOf(right) }),
      target: doctrineChooser(doctrines.target, { enemyType: enemyTypeOf(left) }),
    },
  });
  return { seed: seed >>> 0, picks, doctrines, record };
}
