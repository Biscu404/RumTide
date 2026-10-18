// Every gameplay number lives in this file. Nothing else in the codebase may contain one.
// Change a value, run `npm run check` (and later tools/sim), then playtest.
// Section numbers point at docs/GAMEPLAY.md (v0.3). When tuning, double or halve; never nudge by 5%.
// Blocks marked "used from Pn" are not read by code yet; they are here so the numbers have one home.

export const B = {
  // Starting kit for a new captain (5.1, 6.5).
  start: { gold: 120, provisions: 4, powder: 6, handsShare: 1.0 },

  // Hulls (6.1). Watches per Tide, crewmate slots, max Hands at Berths 0, rig type, cost in doubloons.
  hulls: {
    sloop: { mult: 1.0, hold: 10, watches: 6, crewSlots: 2, maxHands: 30, rig: "foreAft", cost: 0, provisionsPerTide: 1, powderPerRound: 1 },
    brigantine: { mult: 1.35, hold: 16, watches: 6, crewSlots: 3, maxHands: 60, rig: "mixed", cost: 600, provisionsPerTide: 2, powderPerRound: 2 },
    frigate: { mult: 1.8, hold: 24, watches: 7, crewSlots: 5, maxHands: 120, rig: "square", cost: 2400, provisionsPerTide: 3, powderPerRound: 3 },
  },

  // Stats and upgrades (6.2). Linear benefit, exponential cost.
  baseStat: 10, // Cannons and Sails on a level 0 sloop
  baseHull: 100, // Hull points on a level 0 sloop
  baseRigging: 100, // Rigging points on a level 0 sloop
  upgrade: { baseCost: 60, growth: 1.35, perLevel: 0.12, maxLevel: 10, materialsDiscount: 0.3 },

  // Hold space each unit takes (6.5). Supplies pack small; cargo is a full unit.
  holdSpace: { provisions: 0.5, powder: 0.5, timber: 1, rum: 1, sugar: 1, spice: 1 },

  // Watches (3.1).
  watches: {
    cap: 9,
    min: 1,
    sailsBonusLevel: 5, // Sails level that grants +1 Watch
    seamanshipBonusRank: 2, // captain Seamanship rank that grants +1 Watch
    lowHandsShare: 0.4, // below this share of max Hands: 1 Watch less
    heavyHoldShare: 0.8, // hold fuller than this: 1 Watch less
  },

  // Action costs in Watches (3.2).
  actions: { hopBase: 2, hopMin: 1, survey: 2, land: 2, dock: 1, lurkMin: 2, salvage: 2, repair: 2, meet: 1 },
  repairAtSea: { hullShare: 0.15, timber: 2 },

  // Terrain: extra Watches to leave a water (2.2).
  terrain: { kelpLeave: 1, reefUnchartedLeave: 1, shallowsFrigateLeave: 1 },

  // WCS: currents (3.3). Positive numbers cost Watches, negative save them.
  current: {
    none: { with: 0, against: 0 },
    mild: { with: -1, against: 1 },
    strong: { with: -1, against: 2 },
  },

  // WCS: wind (3.3).
  wind: {
    chances: {
      default: { calm: 0.15, breeze: 0.7, gale: 0.15 },
      cradle: { calm: 0.2, breeze: 0.72, gale: 0.08 },
      rumhaven_reach: { calm: 0.15, breeze: 0.7, gale: 0.15 },
      saltteeth_shoals: { calm: 0.25, breeze: 0.65, gale: 0.1 },
    } as Record<string, { calm: number; breeze: number; gale: number }>,
    coneDegrees: 45, // a hop within this many degrees of downwind or upwind counts as such
    calm: 1,
    breeze: { down: -1, up: 1 },
    gale: { down: -1, up: 2, riggingDamagePerHop: 0.05 },
    sloop: { ignoresCalm: true, breezeUp: 0, galeUp: 1 }, // fore and aft rig sails well into the wind
    frigateExtraDown: -1, // square rig flies downwind
  },

  // Exploration and knowledge (4).
  survey: { hiddenRevealChance: 0.3 },
  knowledge: { waterPoints: 1, lanePoints: 0.5, sitePoints: 1, sketchedShare: 0.5 },
  sight: { baseRange: 0, lookoutRange: 1 },

  // Plans (3.6).
  plan: { baseSteps: 3, maxSteps: 6, seamanshipStepRank: 4 },

  // Hands (6.4). Used from P5.
  hands: { costEach: 3, poolPerTide: { village: 5, town: 15, city: 40 }, woundedShare: 0.5, woundedReturnTides: 2, volunteerShare: 0.2 },

  // Combat (8). Used from P2.
  combat: {
    rounds: 5,
    k: 22,
    exponent: 0.6,
    luckMin: 0.9,
    luckMax: 1.1,
    windGaugeBonus: 1.2,
    lurkerGaugeBonus: 1.2,
    rake: 2.0,
    flank: 1.25,
    weakened: 0.75,
    staleAfterRepeats: 3,
    stale: 0.8,
    holdFireNext: 1.5,
    gunneryFullShare: 0.6,
    outOfPowder: 0.5,
    grapeDamagePerHand: 3,
    range: {
      round: { long: 0.6, medium: 1.0, close: 1.0, grappled: 0.5 },
      chain: { long: 1.0, medium: 0.8, close: 0.4, grappled: 0 },
      grape: { long: 0, medium: 0.5, close: 1.2, grappled: 1.0 },
    },
    terrainHelm: { shallowsSloop: 1.15, localKnowledge: 1.15, withStrongCurrent: 1.15 },
    terrainGuns: { rockyLong: 0.75, fogLong: 0.5 },
    reefScrape: 10,
    kelpBoarding: 1.15,
    boarding: { killShare: 0.2, repel: 1.3, captureRatio: 0.4, captureOwnShare: 0.2 },
    victoryMargin: 0.1,
    doctrine: { baseSlots: 3, maxSlots: 7, savedDoctrines: 3 },
  },

  // Loot (8.7, v0.2 9). Used from P2.
  loot: { sunkGrab: 0.25, captured: 0.4, struck: 0.15, victory: 0.2, capPerBattle: 600, cradlePvp: 0.5, flotsamTides: 2, wreckTides: 4, salvagePerAction: 5 },
  fairness: { floor: 0.25, underdogCap: 1.5, bountyBelowRatio: 2 / 3, bountyKeepPerTide: 0.9 },
  escape: { quietMult: 1.3, fogBonus: 0.2, min: 0.05, max: 0.75 },
  parley: { tribute: 0.1, thresholds: [1.25, 1.5] },
  shieldTidesAfterPvpLoss: 4, // two days at two Tides a day
  fleet: { battleBonusPerExtraShip: 0.1, battleBonusCap: 0.3, desperatePerExtraEnemy: 0.25, desperateCap: 0.75, convoyPerMate: 0.1, coopExponent: 1.5 },

  // Economy (9). Used from P5. Every number here is retuned for two Tides a day in P6.3.
  economy: { boomPerTide: 0.02, basePrice: 20, madeMult: 0.6, wantedMult: 1.6, priceKeptPerUnitSold: 0.985, driftBackShare: 0.5, shortageMult: 3, priceSheetTides: 2 },
  supplies: { provisionsPrice: 4, powderPrice: 6 },
  repair: { costPerHullPoint: 0.3, villageMaxShare: 0.5 },

  // Reputation (5.4). Used from P8.
  reputation: {
    startTrust: 50,
    fearFameDriftPerTide: 0.02,
    trustDriftPerTide: 1,
    tiers: { mid: 25, high: 60 },
    deeds: {
      keepPact: { trust: 5, fame: 1 },
      breakPact: { trust: -25, fear: 5, fame: 5 },
      contract: { trust: 2, fame: 1 },
      winPvp: { fear: 5, fame: 2 },
      sink: { fear: 6, fame: 2 },
      capture: { fear: 4, fame: 3 },
      refuseParley: { trust: -5, fear: 4 },
      frontPage: { fame: 3 },
      bigHotspot: { fame: 6 },
      chartIsland: { fame: 2 },
      firstArchipelago: { fame: 8 },
      caughtSpying: { trust: -10, fame: 2 },
    },
  },

  // Crew (7). Used from P8.
  crew: { maxLevel: 10, maxTraits: 4, startLoyalty: 50, poachBelow: 30, leaveBelow: 10, injuryChance: 0.25, injuryTides: 2, prisonerTides: 3, ransomCap: 100 },

  // Hotspots (11). Used from P10.
  hotspots: { smallPerArchipelagoPerTide: [1, 2], mediumEveryTides: [8, 10], bigWarningTides: 2 },

  // Old Shellback (2.5). Used from P2.6.
  shellback: { hull: 300, clawHands: 40, decayPerTide: 0.08 },

  // Agendas (15) and wagers (17). Used from P11.
  agendas: { drawCount: 3, accuseRight: 40, accuseWrongLegend: 20, accuseWrongFame: 10, rewardShare: 0.18 },
  wagers: { bookieCut: 0.05, maxStakeChestShare: 0.15, maxStakeBoom: 200, marketsPerTide: [3, 6], proposeCost: 20 },
} as const;

export type Balance = typeof B;

// What differs between seasons. Nothing else may hardcode these (v0.2 section 14).
export const SEASON_PRESETS = {
  season0: {
    id: "season0",
    lengthTides: 28,
    timezone: "Europe/Bucharest",
    tideTimesLocal: ["13:00", "20:00"],
    firstTideLocal: "20:00",
    progressionCostMult: 0.67,
    hullsEnabled: ["sloop", "brigantine"],
    archipelagos: ["cradle", "rumhaven_reach", "saltteeth_shoals"],
    startArchipelago: "cradle",
    startWater: "gh_harbour",
    cradleTruceUntilTide: 5, // hunting players in the Cradle is allowed from this Tide on
    shellbackDecayFromTide: 9,
    bigHotspotTides: [8, 15, 22, 28],
    mediumHotspots: false,
    agendaDrawTide: 3,
    agendaActTwoTide: 14,
    skillMaxRank: 3,
    backgrounds: ["navy_deserter", "smugglers_kid", "merchants_heir", "shipwrights_apprentice", "castaway", "fishers_child"],
  },
  season1: {
    id: "season1",
    lengthTides: 42,
    timezone: "Europe/Bucharest",
    tideTimesLocal: ["13:00", "20:00"],
    firstTideLocal: "20:00",
    progressionCostMult: 1.0,
    hullsEnabled: ["sloop", "brigantine", "frigate"],
    archipelagos: ["cradle", "rumhaven_reach", "saltteeth_shoals", "crown_keys", "mistveil_isles", "the_maw", "grimbeards_rest"],
    startArchipelago: "cradle",
    startWater: "gh_harbour",
    cradleTruceUntilTide: 5,
    shellbackDecayFromTide: 9,
    bigHotspotTides: [7, 14, 21, 28, 35, 42],
    mediumHotspots: true,
    agendaDrawTide: 3,
    agendaActTwoTide: 21,
    skillMaxRank: 5,
    backgrounds: ["navy_deserter", "smugglers_kid", "merchants_heir", "shipwrights_apprentice", "castaway", "fishers_child", "cartographer", "disgraced_noble", "tavern_brawler"],
  },
} as const;

export type PresetId = keyof typeof SEASON_PRESETS;
export type SeasonPreset = (typeof SEASON_PRESETS)[PresetId];
