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
  statValue, maxHullPoints, maxRiggingPoints, maxHands, crewShare, cannonsOf, sailsOf, holdCapacity, holdUsed, carriesCargo, upgradeCost, powerRating,
  drillOf, drillCap, drillStage, drillBonus, drillFactor, drillUnlocked, drillCost, type DrillUnlock,
  newShip, watchesFor, emptyHold, zeroLevels,
} from "./ship.ts";
export { windFor, windsFor, hopCost, estimateHop, windPart, terrainPart, chartedAt, type HopCost } from "./wcs.ts";
export { findRoute, pinnedRoute, type Route } from "./route.ts";
export { stepSlots, validatePlan, standingPlan, nearestKnownHarbour, choosePlan, type PlanSource } from "./plan.ts";
export {
  resolveTide, stubEncounter, type TideInput, type TideResult, type EncounterContext, type EncounterOutcome,
  type EncounterResolver, type EncounterSide,
} from "./tide.ts";
export { newCaptain, newBoss, newSeason, type NewCaptainSpec, type NewSeasonSpec } from "./season.ts";
export { formatReplay, replayHash, canonicalJson, describeWind } from "./replay.ts";

// Combat (GAMEPLAY 8) and Old Shellback (2.5).
export * from "./combat/types.ts";
export {
  battleRng, isCrippled, hasLocalKnowledge, helmScore, windGauge, startingRange, helmContest, contestRecord, pairRow, applyPair,
  playableMove, reefScrape, resolveHelm, type ContestRoll, type PairOutcome, type HelmInput, type HelmResult,
} from "./combat/helm.ts";
export {
  gunsTrack, ammoFactor, shotPoints, gunnery, staleNow, nextGunsMemory, fireGuns, applyDamage, recordFiring,
  type GunsContext, type GunsFactors, type GunsResult, type MortarShell,
} from "./combat/guns.ts";
export {
  boardingStrength, lacksHands, surrenders, captureCheck, captureCheckBySide, grappleAttempts, grappleReason, cutFree, lashedScores,
  grapnelContest, type CaptureResult, type CutFreeResult, type StrengthOptions,
} from "./combat/boarding.ts";
export { pairing, pairFactor, crewOrder, hasSecondWave, deckKill, type CrewContext } from "./combat/deck.ts";
export { blazeRounds, ignite, fireLoss, flashLoss, type Blaze, type Blazes } from "./combat/fire.ts";
export {
  runBattle, pointsOutcome, damageShare, sideShare, type AbilityFire, type RoundChoice, type LastPlay, type RoundView, type Chooser,
  type BattleInput, type BattleMate,
} from "./combat/battle.ts";
export {
  carriedBy, cargoValue, fairnessFactor, lootMultiplier, lootShare, capturePick, settleLoot, jettison, scale, sumCarried, splitCarried,
  splitByHolding,
  type Goods, type Carried, type Prices, type SalvagePile, type JettisonResult, type Multiplier, type CapturePick, type LootInput,
  type LootResult,
} from "./combat/loot.ts";
export {
  ABILITIES, DOCTRINE_SLOT_PERK, JETTISON_PLAY, FALLBACK_PLAY, NO_RULE, TEMPLATE_NAMES, conditionHolds, evaluateDoctrine, doctrineChooser,
  findDoctrine, pickDoctrine,
  doctrineSlots, validateDoctrine, validateDoctrines, templateDoctrine, templateDoctrines, styleTemplate,
  type AbilityDef, type AbilityRegistry, type DoctrineContext, type ValidateOptions, type TemplateName,
} from "./combat/doctrine.ts";
export {
  combatEncounter, escapeChance, parleyResult, enemyTypeOf, battleShipOf, applyBattle, towShip,
  type ParleyResult, type BattleFlags, type ApplyBattleInput, type BattleApplied,
} from "./combat/encounter.ts";
export {
  fleetBonus, desperateDefence, sideBonus, pickFlagship, apportion, shareOut, shareDamage, strikeTotals, withLosses, mateHelm, mateCutFree,
  fleetGrapples, grapnelRescue, fleetMelee, type FlagshipCandidate, type Shot, type MateHelm, type FleetMelee, type FleetGrappleInput,
  type MeleeInput,
} from "./combat/fleet.ts";
export { describeBattle, describeCarried, type BattleWords } from "./combat/describe.ts";
export {
  hasStyle, playableOrder, styleHelmFactor, spotters, dashBands, styleGunsMods, canSpoilRake, spoiledRake, isRam, ramHull, ramSelf,
  zeroingFactor, firesLongNines, boardsFromShort, hasGrapnels, grapnelBonus, fightersFactor, tinderboxFactor, canThrowPots, shotFireChance,
  emberChance,
} from "./combat/styles.ts";
export {
  SHELLBACK_ID, SHELLBACK_DOCTRINE, isBoss, shellbackStatline, applyStatline, shellbackDoctrine, bossPlan, upkeepBosses, recordBossWin,
  hasBeaten, bossAtStrait, mayCross,
} from "./combat/shellback.ts";
