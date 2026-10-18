// Public surface of the Rumtide engine. The server and the client import from here.

export { B, SEASON_PRESETS, type PresetId, type SeasonPreset } from "./balance.ts";
export * from "./types.ts";
export { Rng, rngFor, hash32 } from "./rng.ts";
export { loadMap, validateMap, MapError, bearingBetween, angleBetween, otherEnd, travelBearing, laneBetween, type World } from "./map.ts";
export {
  emptyKnowledge, startKnowledge, levelOf, raise, laneVisible, believedCurrent, onArrive, onSurvey, onLand,
  islandFullyCharted, coverage, setPencil,
} from "./knowledge.ts";
export {
  statValue, maxHullPoints, maxRiggingPoints, maxHands, holdCapacity, holdUsed, carriesCargo, upgradeCost,
  newShip, watchesFor, emptyHold, zeroLevels,
} from "./ship.ts";
export { windFor, windsFor, hopCost, estimateHop, windPart, terrainPart, chartedAt, type HopCost } from "./wcs.ts";
export { findRoute, pinnedRoute, type Route } from "./route.ts";
export { stepSlots, validatePlan, standingPlan, choosePlan, type PlanSource } from "./plan.ts";
export {
  resolveTide, stubEncounter, type TideInput, type TideResult, type EncounterContext, type EncounterOutcome,
  type EncounterResolver, type EncounterSide,
} from "./tide.ts";
export { newCaptain, newSeason, type NewCaptainSpec, type NewSeasonSpec } from "./season.ts";
export { formatReplay, replayHash, canonicalJson, describeWind } from "./replay.ts";

// Combat (GAMEPLAY 8). Doctrines, the encounter, fleets and Old Shellback come with P2.3 and later.
export * from "./combat/types.ts";
export {
  battleRng, isCrippled, hasLocalKnowledge, helmScore, windGauge, startingRange, helmContest, contestRecord, pairRow, applyPair,
  playableMove, resolveHelm, type ContestRoll, type PairOutcome, type HelmInput, type HelmResult,
} from "./combat/helm.ts";
export {
  gunsTrack, ammoFactor, gunnery, staleNow, nextGunsMemory, fireGuns, applyDamage, recordFiring,
  type GunsContext, type GunsFactors, type GunsResult,
} from "./combat/guns.ts";
export {
  boardingStrength, meleeRound, surrenders, captureCheck, grappleAttempts, cutFree, type CaptureResult, type CutFreeResult,
} from "./combat/boarding.ts";
export {
  runBattle, pointsOutcome, damageShare, type AbilityFire, type RoundChoice, type LastPlay, type RoundView, type Chooser,
  type BattleInput,
} from "./combat/battle.ts";
export {
  carriedBy, cargoValue, fairnessFactor, lootMultiplier, lootShare, capturePick, settleLoot, jettison,
  type Goods, type Carried, type Prices, type SalvagePile, type JettisonResult, type Multiplier, type CapturePick, type LootInput,
  type LootResult,
} from "./combat/loot.ts";
