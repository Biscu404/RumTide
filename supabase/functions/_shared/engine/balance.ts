// supabase/functions/_shared/engine/balance.ts
// Every gameplay number lives here. Change values, rerun tools/sim, then playtest.
// The formulas of section 14 arrive with the first code that uses them (combat and loot so far).

import type { HullId, SeasonSettings } from "./types.ts";

export const B = {
  startGold: 120,

  // Section 4.4: movement happens in up to this many steps per Tide.
  movement: { steps: 3 },

  upgrade: { baseCost: 60, growth: 1.35, statPerLevel: 0.12, maxLevel: 10 },
  baseStat: 10,     // Cannons, Sails and Crew on a level 0 sloop
  baseHull: 100,    // Hull points on a level 0 sloop
  hullPerPR: 10,    // Hull points that count as one point of PR; an NPC's hull is this times its PR
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
          crownWaters: 0.5, maw: 1.5, calmSeasWeek: 0.5,
          calmSeasLastTide: 7 },  // week 1 (Tides 1 to 7) halves PvP loot, section 9 rule 10
  fairness: { floor: 0.25, underdogCap: 1.5, bountyBelowRatio: 2 / 3, bountyKeepPerTide: 0.9 },
  fleet: { battleBonusPerExtraShip: 0.10, battleBonusCap: 0.30,
           desperatePerExtraEnemy: 0.25, desperateCap: 0.75,
           convoyPerMate: 0.10, coopExponent: 1.5,
           capShare: 0.5, minCap: 2, maxCap: 4 },   // section 8.1: half the players, at least 2, at most 4
  escape: { quietMult: 1.3, min: 0.05, max: 0.75 },
  parley: { tribute: 0.10, thresholds: [1.25, 1.5] },
  shieldTidesAfterPvpLoss: 2,

  weekTides: 7,   // Tides per week: Calm Seas, the Trade Winds boom and the weekly galleon follow it

  trade: { basePrice: 20, madeMult: 0.6, wantedMult: 1.6,
           priceKeptPerUnitSold: 0.985, weeklyBoomMult: 2.0,
           weeklyBoomFromWeek: 1 + 1,        // Trade Winds, from week 2 (section 3.5)
           lastLanternMult: 1.8 },           // "wants everything, at a premium" (section 4.2)
  repair: { costPerHullPoint: 0.3, crewPatchAtSea: 0.10, strikeFreePatch: 0.5 },

  npc: { merchantsPerPlayer: 0.75, prizeUnitValue: 19,
         fatMerchantShare: 1 / 3,            // of the merchants spawned each Tide
         merchantVictoryPays: 0.5,           // a Victory over a merchant pays this share of the cargo
         smallTrader: { prVsMedian: 0.8, cargo: 10, favourite: "outmaneuver", favouriteShare: 0.6 },
         fatMerchant: { prVsMedian: 1.3, cargo: 30, plan: ["outmaneuver", "board", "board"] },
         galleon: { prVsMedian: 2.8, basePrize: 250, victoryPays: 0.5,
                    plan: ["broadside", "board", "broadside"] } },

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

// The formulas below are copied from section 14.

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const boom = (tide: number) => 1 + B.boomPerTide * tide;

// Hops per Tide.
export const speed = (hull: HullId, sailsLevel: number) =>
  Math.min(3, B.hulls[hull].speed + (sailsLevel >= B.sailsSpeedBonusAtLevel ? 1 : 0));

export const statValue = (hull: HullId, level: number) =>
  B.baseStat * B.hulls[hull].mult * (1 + B.upgrade.statPerLevel * level);

export const maxHullPoints = (hull: HullId, level: number) =>
  B.baseHull * B.hulls[hull].mult * (1 + B.upgrade.statPerLevel * level);

// costMult comes from the season preset (0.67 in Season 0, 1.0 in a full season).
export const upgradeCost = (currentLevel: number, costMult = 1) =>
  Math.round(B.upgrade.baseCost * B.upgrade.growth ** currentLevel * costMult);

export const hullCost = (hull: HullId, costMult = 1) =>
  Math.round(B.hulls[hull].cost * costMult);

// Cargo units are whole, so the Hold a captain can fill rounds down (docs/DECISIONS.md).
export const holdUnits = (hull: HullId, level: number) =>
  Math.floor(B.hulls[hull].hold * (1 + B.upgrade.statPerLevel * level));

// The Boom raises every price and prize by 4% per Tide.
export const cargoValue = (units: number, tide: number) => units * B.npc.prizeUnitValue * boom(tide);

export const npcPR = (kind: "smallTrader" | "fatMerchant" | "galleon", medianCaptainPR: number) =>
  B.npc[kind].prVsMedian * medianCaptainPR;  // NPC stats all equal PR, hull = hullPerPR * PR

// Co op prizes pay base * boom * N ** 1.5 in total, split evenly. This is one captain's share.
export const coopShare = (basePrize: number, tide: number, captains: number) =>
  (basePrize * boom(tide) * captains ** B.fleet.coopExponent) / captains;

// A fresh sloop has PR 10.
export const powerRating = (s: { hull: number; cannons: number; sails: number; crew: number }) =>
  (s.hull / B.hullPerPR + s.cannons + s.sails + s.crew) / 4;

export const roundDamage = (stat: number, matchup: number, stale: boolean, luck: number) =>
  B.combat.k * (stat / 10) ** B.combat.exponent * matchup * (stale ? B.combat.stale : 1) * luck;

export const escapeChance = (targetSails: number, hunterSails: number, quiet: boolean) =>
  clamp((targetSails / (targetSails + hunterSails)) * (quiet ? B.escape.quietMult : 1),
        B.escape.min, B.escape.max);

export const fairnessFactor = (loserPR: number, winnerSidePR: number) => {
  const r = loserPR / winnerSidePR;
  return r < 1 ? Math.max(B.fairness.floor, r ** 2) : Math.min(B.fairness.underdogCap, r);
};

export const lootTaken = (carriedValue: number, outcome: "decisive" | "victory",
                          fairness: number, zoneMult: number, tide: number) =>
  Math.min(carriedValue * B.loot[outcome] * fairness * zoneMult, B.loot.capPerBattle * boom(tide));

export const fleetBattleBonus = (extraShips: number) =>
  1 + Math.min(B.fleet.battleBonusCap, B.fleet.battleBonusPerExtraShip * extraShips);

export const desperateDefence = (extraEnemyShips: number) =>
  1 + Math.min(B.fleet.desperateCap, B.fleet.desperatePerExtraEnemy * extraEnemyShips);

// Most captains one fleet may hold (section 8.1): 3 in a six player game.
export const fleetCap = (players: number) =>
  clamp(Math.floor(players * B.fleet.capShare), B.fleet.minCap, B.fleet.maxCap);
