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

// Combat (GAMEPLAY 8). Boarding, runBattle and the rest come with P2.2 and later.
export * from "./combat/types.ts";
export {
  battleRng, isCrippled, hasLocalKnowledge, helmScore, windGauge, startingRange, helmContest, pairRow, applyPair, playableMove,
  resolveHelm, type ContestRoll, type PairOutcome, type HelmInput, type HelmResult,
} from "./combat/helm.ts";
export {
  gunsTrack, ammoFactor, gunnery, staleNow, nextGunsMemory, fireGuns, applyDamage, recordFiring,
  type GunsContext, type GunsFactors, type GunsResult,
} from "./combat/guns.ts";
