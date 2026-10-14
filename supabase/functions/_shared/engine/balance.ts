// supabase/functions/_shared/engine/balance.ts
// Every gameplay number lives here. Change values, rerun tools/sim, then playtest.
// The main table B and the formulas (section 14) arrive with the first code that uses them.

import type { SeasonSettings } from "./types.ts";

// Everything a preset fills in when a season is created: the settings (minus the preset name)
// plus the season length, which lives on Season itself.
type SeasonPreset =
  { readonly [K in Exclude<keyof SeasonSettings, "preset">]: Readonly<SeasonSettings[K]> } &
  { readonly lengthTides: number };

// What differs between Season 0 (the beta) and a full season. Nothing else may hardcode these.
export const SEASON_PRESETS = {
  season0: { lengthTides: 14, progressionCostMult: 0.67, hullsEnabled: ["sloop", "brigantine"],
             galleonTides: [7, 14], fogOfLegendTides: 0, mawOpens: false, mutinyRules: false },
  full:    { lengthTides: 28, progressionCostMult: 1.0,  hullsEnabled: ["sloop", "brigantine", "frigate"],
             galleonTides: [7, 14, 21], fogOfLegendTides: 3, mawOpens: true, mutinyRules: false },
} as const satisfies Record<SeasonSettings["preset"], SeasonPreset>;
