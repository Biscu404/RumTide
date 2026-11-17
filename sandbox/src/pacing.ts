// How long each part of a round takes on screen in the sandbox battle viewer. Pure numbers and one helper, so the timing is tested.

import type { Motion } from "./summary.ts";

export const SPEEDS = ["slow", "normal", "fast"] as const;
export type Speed = (typeof SPEEDS)[number];
export const SPEED_NAME: Record<Speed, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const DEFAULT_SPEED: Speed = "slow";

/** How long Play waits after a round's animation is over before it plays the next round, so the words can be read. */
export const PAUSE_MS: Record<Speed, number> = { slow: 5000, normal: 3000, fast: 1500 };

export const GLIDE_MS = 500; // ships sliding to their new distance
export const SHOT_MS = 400; // the flash and the shot flying, before the hit lands
export const HIT_MS = 400; // the hit mark or splash
export const GHOST_HOLD_MS = 400; // the yellow ghost stays where the lost part was
export const GHOST_SLIDE_MS = 500; // then slides away
export const FLOAT_MS = 1100; // the "-30" floats up and fades

const MELEE_DELAY_MS = 200; // damage with no move and no shot (a deck fight) lands almost at once

/** When the bars take the damage of a round: when the ships have arrived and the shots have landed. */
export function hitDelayMs(m: Motion): number {
  const moved = m.rangeBefore !== m.rangeAfter || m.escaped;
  return (moved ? GLIDE_MS : MELEE_DELAY_MS) + (m.shots.length > 0 ? SHOT_MS : 0);
}

/** How long a round's animation runs from its start. With reduced motion nothing animates, so it is 0. */
export function roundAnimMs(m: Motion | null, calm: boolean): number {
  if (!m || calm) return 0;
  const hit = hitDelayMs(m);
  const lost = (["hunter", "target"] as const).some((s) => m.lost[s].hull + m.lost[s].rigging + m.lost[s].hands > 0);
  const moved = m.rangeBefore !== m.rangeAfter || m.escaped;
  const tail = lost ? GHOST_HOLD_MS + GHOST_SLIDE_MS : m.shots.length > 0 ? HIT_MS : 0;
  return Math.max(hit + tail, moved ? GLIDE_MS : 0) + 100;
}
