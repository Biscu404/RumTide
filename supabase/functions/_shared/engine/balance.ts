// supabase/functions/_shared/engine/balance.ts
// Every gameplay number lives here. Change values, rerun tools/sim, then playtest.
// The formulas of section 14 arrive with the first code that uses them (speed so far).

import type { HullId, SeasonSettings } from "./types.ts";

export const B = {
  startGold: 120,

  // Section 4.4: movement happens in up to this many steps per Tide.
  movement: { steps: 3 },

  upgrade: { baseCost: 60, growth: 1.35, statPerLevel: 0.12, maxLevel: 10 },
  baseStat: 10,     // Cannons, Sails and Crew on a level 0 sloop
  baseHull: 100,    // Hull points on a level 0 sloop
  hulls: {
    sloop:      { mult: 1.0,  hold: 10, speed: 2, cost: 0 },
    brigantine: { mult: 1.35, hold: 16, speed: 2, cost: 600 },
    frigate:    { mult: 1.8,  hold: 24, speed: 3, cost: 2400 },
  },
  sailsSpeedBonusAtLevel: 5,  // +1 speed, never above 3
  shipwrightShareHint: 0.7,   // UI suggestion only: put 70% of income into the next hull

  boomPerTide: 0.04,

  combat: { k: 22, exponent: 0.6, win: 2.0, tie: 1.0, lose: 0.5, stale: 0.8,
            luckMin: 0.9, luckMax: 1.1, rounds: 3, victoryMargin: 0.10 },
  loot: { decisive: 0.40, victory: 0.20, capPerBattle: 600,
          crownWaters: 0.5, maw: 1.5, calmSeasWeek: 0.5 },
  fairness: { floor: 0.25, underdogCap: 1.5, bountyBelowRatio: 2 / 3, bountyKeepPerTide: 0.9 },
  fleet: { battleBonusPerExtraShip: 0.10, battleBonusCap: 0.30,
           desperatePerExtraEnemy: 0.25, desperateCap: 0.75,
           convoyPerMate: 0.10, coopExponent: 1.5 },
  escape: { quietMult: 1.3, min: 0.05, max: 0.75 },
  parley: { tribute: 0.10, thresholds: [1.25, 1.5] },
  shieldTidesAfterPvpLoss: 2,

  trade: { basePrice: 20, madeMult: 0.6, wantedMult: 1.6,
           priceKeptPerUnitSold: 0.985, weeklyBoomMult: 2.0 },
  repair: { costPerHullPoint: 0.3, crewPatchAtSea: 0.10, strikeFreePatch: 0.5 },

  npc: { merchantsPerPlayer: 0.75, prizeUnitValue: 19,
         smallTrader: { prVsMedian: 0.8, cargo: 10 },
         fatMerchant: { prVsMedian: 1.3, cargo: 30 },
         galleon: { prVsMedian: 2.8, basePrize: 250, victoryPays: 0.5 } },

  catchUp: { shoreLeaveBonus: 0.5, shoreLeaveCap: 3,
             fairWindsBelowMedian: 0.7, fairWindsBonus: 0.2,
             lateJoinGoldShare: 0.6, ashoreAfterMissed: 5 },

  legend: { perGoldProfit: 0.1, npcWin: 10, pvpWin: 25, coopPrize: 40,
            weeklyAward: 30, mostWantedMult: 1.5 },
} as const;

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

// Hops per Tide. Section 14.
export const speed = (hull: HullId, sailsLevel: number) =>
  Math.min(3, B.hulls[hull].speed + (sailsLevel >= B.sailsSpeedBonusAtLevel ? 1 : 0));
