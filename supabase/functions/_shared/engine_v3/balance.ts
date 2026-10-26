// Every gameplay number lives in this file. Nothing else in the codebase may contain one.
// Change a value, run `npm run check` (and later tools/sim), then playtest.
// Section numbers point at docs/GAMEPLAY.md (v0.3). When tuning, double or halve; never nudge by 5%.
// Blocks marked "used from Pn" are not read by code yet; they are here so the numbers have one home.

export const B = {
  // Starting kit for a new captain (5.1, 6.5).
  start: { gold: 120, provisions: 4, powder: 6, firePots: 0, handsShare: 1.0 },

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

  // Hold space each unit takes (6.5). Supplies pack small, Fire Pots too; cargo is a full unit.
  holdSpace: { provisions: 0.5, powder: 0.5, firePots: 0.5, timber: 1, rum: 1, sugar: 1, spice: 1 },

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
    // The range factor of each Guns order at the five distances where the great guns fire (docs/specs/fighting-styles.md
    // section 1). While Grappled the great guns are quiet and the deck fight decides, so there is no Grappled column
    // (boarding spec, D116 to D118). Only a Bombardier fires the Mortar and only a Firebrand fires Hot Shot.
    range: {
      round: { far: 0.2, long: 0.6, medium: 1.0, short: 1.0, close: 1.0 },
      chain: { far: 0.4, long: 1.0, medium: 0.8, short: 0.6, close: 0.4 },
      grape: { far: 0, long: 0, medium: 0.5, short: 0.85, close: 1.2 },
      mortar: { far: 1.1, long: 1.1, medium: 0.85, short: 0, close: 0 },
      hot: { far: 0, long: 0.3, medium: 0.3, short: 1.0, close: 1.0 },
    },
    terrainHelm: { shallowsSloop: 1.15, localKnowledge: 1.15, withStrongCurrent: 1.15 },
    terrainGuns: { rockyLong: 0.75, fogLong: 0.5 }, // at Long and at Far
    // Helm pair table (8.4): how many range bands each row moves. A band is one step of the six distances
    // (Far, Long, Medium, Short, Close, Grappled), and growing past Far is an escape.
    bands: { closeClose: 2, closeHold: 1, chase: 1, holdOpen: 1, openOpen: 2, rakeCloseIn: 1, crossFails: 1 },
    reefScrape: 10,
    kelpBoarding: 1.15,
    boarding: { killShare: 0.2, captureRatio: 0.4, captureOwnShare: 0.2 },
    // The deck fight while Grappled (boarding spec section 2). Each side removes killShare of its boarding strength, times
    // the hit of its Deck order, times the pairing of the cycle (Charge beats Volley, Volley beats Repel, Repel beats
    // Charge: pairWin for the winning order, pairLose for the losing one), times the guard of the other crew's order. Fire
    // Pots ignore the guard of Repel. A thrown Fire Pot catches fireChance of the time; when its thrower is not a Firebrand
    // the fire costs the throwing ship and the enemy flagship fireHull at once, and never takes a ship below 1 Hull.
    deck: {
      hit: { charge: 1.5, volley: 1.1, repel: 0.6, firePots: 1.4, fists: 1.0 },
      guard: { charge: 1.25, volley: 1.0, repel: 0.6, firePots: 1.0, fists: 1.0 },
      pairWin: 1.8, pairLose: 0.75,
      fireChance: 0.3, fireHull: 8,
    },
    // The boarder is the ship whose Board order made the grapple (boarding spec section 3). First over the rail: its Board
    // fights as a Charge with this strength bonus in the grapple round. Lashed fast: its Helm score counts this many times in
    // every Cut Free contest while the grapple lasts.
    edge: { firstOverTheRail: 1.25, lashedFast: 2 },
    // Fire (fighting styles spec section 3): a burning ship loses hull Hull at the end of each round for rounds rounds
    // (styles.firebrand.extraFireRounds more when a Firebrand started it).
    fire: { hull: 12, rounds: 2 },
    quietCutFree: true, // D135: in the round a ship cuts free the great guns of both ships stay quiet
    overtime: 2, // D127: a deck fight still going after the last round goes on for up to this many more
    victoryMargin: 0.05, // D132
    // Doctrines (8.8). Slots count the rules that have conditions; the Otherwise rule is always there and is free (D64).
    // slotRanks: the Command ranks that each give +1 slot. The thresholds of the templates are in `styles` (the Smuggler's
    // is styles.smuggler.strikeHullPct).
    doctrine: { baseSlots: 3, maxSlots: 7, savedDoctrines: 3, slotRanks: [1, 4], maxConditions: 2 },
  },

  // Fighting Styles (docs/specs/fighting-styles.md sections 2 and 3, D121 to D141). Each trait pays only in a round its own
  // move or order is played.
  styles: {
    // The Mortar hits mortarHit of the time and takes the rake, flank and weakened factors (D137). Zeroing In adds zeroStep
    // for each round in a row the range has not changed, up to zeroMax. The crew is handsShare of the Hands. Spotters: a
    // battle with a Bombardier flagship starts at Far.
    // A Mortar hit starts a fire mortarFire of the time, which burns mortarFireRounds.
    bombardier: { mortarHit: 0.8, mortarFire: 0.4, mortarFireRounds: 2, mortarTakesRakes: true, zeroStep: 0.1, zeroMax: 1.5, handsShare: 0.6, startFar: true },
    // In a round it Holds: a rake against it is bracedRake instead of the rake, a Ram against it does bracedRam, its guns do
    // steadyDeck, and its Round shot counts longNines at Long. Fire drill: a burning Gunline loses fireDrill of the fire's Hull.
    gunline: { bracedRake: 1.35, bracedRam: 0.7, steadyDeck: 1.4, longNines: 0.8, fireDrill: 0.6 },
    skirmisher: { kite: true }, // Opening Range does not weaken its guns
    // Dash: Close In moves dashBands more. A Ram does ramHull to them and ramSelf to the Rammer (D139). A rake the dash spoils is spoiledRake.
    rammer: { dashBands: 1, ramHull: 30, ramSelf: 4, spoiledRake: 1.75 },
    // Fighters: its crew fights with fighters times the boarding strength. The chase: its Helm score counts chase times in a
    // round it Closes In. A Ram against a Boarder that plays Board does ramWhileBoarding (its grapnels are on the prow).
    // Grapnel lines: Board works from Short too, and a Board that fails on Helm score becomes a Helm contest with its score
    // counted grapnelBonus times. The Drill 10 Grapnels unlock (drill.unlocks) is the contest alone, for any style.
    boarder: { grapnelLines: true, grapnelBonus: 3, fighters: 1.2, ramWhileBoarding: 0.5, chase: 1.3 },
    // Hot Shot starts a fire hotShotFire of its hits and burns hotShotPowder times the Powder. A Firebrand starts with
    // startPots Fire Pots and its fires burn extraFireRounds longer. Fireship: a ship that Rams a Firebrand catches a blaze of
    // ramBlazeRounds, and while Grappled with a Firebrand the enemy deck catches fire emberChance of the time each round.
    // Tinderbox: a crew fighting a Firebrand on deck fights at tinderbox of its strength, and a burning Firebrand loses ownFire
    // times the fire's Hull.
    firebrand: { hotShotFire: 0.3, hotShotPowder: 2, startPots: 2, extraFireRounds: 1, ramBlazeRounds: 2, emberChance: 0.4, tinderbox: 0.8, ownFire: 2 },
    smuggler: { slippery: 1.25, strikeHullPct: 40 }, // Helm times slippery in a round it Opens Range; the template strikes below strikeHullPct
  },

  // Drill, the sixth ship upgrade (boarding spec section 4, D119, D120, D141). Three stages of stageSize levels, perLevel
  // boarding strength for each level of a stage (Deckhands, Cutthroats, Sea Wolves). A level costs what the same level of any
  // other upgrade costs (`upgrade`), so there is no price here. Finishing a stage unlocks Fire Pots, Grapnels and Second
  // Wave: after the exchange the crew strikes once more at secondWaveShare of its strength. The cap is a season preset number.
  drill: {
    stageSize: 5, perLevel: [0.04, 0.06, 0.08],
    unlocks: { firePots: 5, grapnels: 10, secondWave: 15 },
    secondWaveShare: 0.25,
    // Drill luck (P3.2): in each round of a deck fight a crew's Drill bonus counts from 1 - luck to 1 + luck times what it is
    // worth, a seeded draw, so a drilled crew wins most deck fights and not every one. A crew with no Drill has no bonus to vary.
    luck: 3,
  },

  // Power Rating (D26, D136): S = (max Hull / hullPer + Cannons + Sails + Hands / handsPer) / divisor, and the rating is
  // F x (S / F) ^ exponent, where F is S for a fresh sloop, so a fresh sloop is still 10.
  power: { hullPer: 10, handsPer: 3, divisor: 4, exponent: 1.6 },

  // Towing (8.7): a Sunk or Captured ship is towed to the nearest known Harbour with Hull raised to at least this share of its max.
  tow: { hullShare: 0.5 },

  // Loot (8.7, v0.2 9). Used from P2.
  loot: { sunkGrab: 0.25, captured: 0.4, struck: 0.15, victory: 0.2, capPerBattle: 600, cradlePvp: 0.5, flotsamTides: 2, wreckTides: 4, salvagePerAction: 5 },
  fairness: { floor: 0.25, underdogCap: 1.5, bountyBelowRatio: 2 / 3, bountyKeepPerTide: 0.9 },
  escape: { quietMult: 1.3, fogBonus: 0.2, min: 0.05, max: 0.75 },
  parley: { tribute: 0.1, thresholds: [1.25, 1.5] },
  shieldTidesAfterPvpLoss: 4, // two days at two Tides a day
  fleet: { battleBonusPerExtraShip: 0.1, battleBonusCap: 0.3, desperatePerExtraEnemy: 0.25, desperateCap: 0.75, convoyPerMate: 0.1, coopExponent: 1.5 },

  // Economy (9). Used from P5. Every number here is retuned for two Tides a day in P6.3.
  economy: { boomPerTide: 0.02, basePrice: 20, madeMult: 0.6, wantedMult: 1.6, priceKeptPerUnitSold: 0.985, driftBackShare: 0.5, shortageMult: 3, priceSheetTides: 2 },
  supplies: { provisionsPrice: 4, powderPrice: 6, firePotPrice: 8 }, // the Fire Pot price is a placeholder: P5 sets the prices
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

  // Old Shellback (docs/specs/fighting-styles.md section 7, D100, D133, D140). hull, clawHands and decayPerTide are his statline.
  // cannons (D140), sails and helm are not in GAMEPLAY 2.5: his Sails (the escape roll and the Power Rating) stay the base stat of a
  // fresh sloop, 10, and his Helm score is fixed, so no gauge or terrain changes it.
  // His shell: every hit on him does armour of its damage, except in the round he rears up. A Mortar shell does mortarFactor
  // times its damage and ignores the shell. His moods: each fight he rears up in one of rearUpRounds (a seeded roll), closes in
  // before it and grapples after it. snatch: a ship that crosses his bow at Short or Close while he Closes In is caught in his
  // claws. He retreats into his shell, and is beaten, when his Hull falls below retreatHull of its full or his claws below
  // retreatClaws of theirs. pointsBeatHim: whether a Victory on points beats him (it does not).
  shellback: {
    hull: 300, clawHands: 52, decayPerTide: 0.08,
    cannons: 22, sails: 10, helm: 10,
    armour: 0.8, mortarFactor: 3, rearUpRounds: [2, 3, 4], snatch: true,
    retreatHull: 0.35, retreatClaws: 0.25, pointsBeatHim: false,
  },

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
    drillMaxLevel: 15, // D120: all three Drill stages
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
    drillMaxLevel: 15,
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
