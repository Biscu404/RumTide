// How hard a simulator run works (P3.1, P3.B3). `full` is the run the P3 checks are judged on, `quick` is for tuning loops,
// and `tiny` is for the tests of the simulator itself.

export interface Effort {
  name: "tiny" | "quick" | "full";
  /** Battles per scene, per ordered pair of styles, for checks 1, 3 and 6. */
  fieldPerCell: number;
  /** The same for check 7, equal spending, once for each number of levels spent. */
  spendPerCell: number;
  /**
   * Check 2. The scenes the best play is searched in, the seeds per pair and scene that are played through, and the rounds tried:
   * `situationRounds` in an open fight, `grappledRounds` in a Grappled one (overtime included). `drilledScenes` are the scenes of
   * the Grappled situations between ships at Drill 5, where Fire Pots count. A group of battles that start a round at the same
   * distance is a situation when it has `situationMinSeeds` of them.
   */
  situationScenes: string[];
  situationSeeds: number;
  situationRounds: number[];
  grappledRounds: number[];
  drilledScenes: string[];
  situationMinSeeds: number;
  /** Battles per power ratio, per scene and seat, for check 4. */
  powerPerCell: number;
  /** Battles per scene and seat for each row of check 8 (Drill), check 9 (Lashed fast) and check 10 (the Smuggler escapes). */
  drillPerCell: number;
  lashedPerCell: number;
  smugglerPerCell: number;
  /** Old Shellback, check 5: the search for a good doctrine and the fights that judge it, once for each style. */
  boss: {
    random: number; // random doctrines to start from
    generations: number;
    keep: number; // parents kept each generation
    perParent: number; // mutations of each parent
    searchSeeds: number; // fights to score a candidate while searching
    finalists: number; // the best of the search, judged again on fresh fights
    heldOut: number; // fights to pick the best finalist
    confirm: number; // fresh fights for the number that is reported
    reference: number; // fights for each reference doctrine
    gateSeeds: number; // fights for each Tide of the gate pace
  };
}

const ALL_SCENES = ["open/breeze", "open/calm", "open/gale", "shallows", "reef", "reef/charted", "rocky", "fog", "kelp"];

export const EFFORTS: Record<Effort["name"], Effort> = {
  tiny: {
    name: "tiny", fieldPerCell: 20, spendPerCell: 10,
    situationScenes: ["open/breeze"], situationSeeds: 8, situationRounds: [1, 3], grappledRounds: [3], drilledScenes: ["open/breeze"], situationMinSeeds: 3,
    powerPerCell: 20, drillPerCell: 10, lashedPerCell: 20, smugglerPerCell: 10,
    boss: { random: 6, generations: 1, keep: 2, perParent: 2, searchSeeds: 8, finalists: 2, heldOut: 8, confirm: 10, reference: 10, gateSeeds: 10 },
  },
  quick: {
    name: "quick", fieldPerCell: 200, spendPerCell: 100,
    situationScenes: ["open/breeze", "shallows", "reef", "rocky", "kelp"], situationSeeds: 100, situationRounds: [1, 2, 3, 4],
    grappledRounds: [3, 4, 5, 6, 7], drilledScenes: ["open/breeze", "shallows"], situationMinSeeds: 20,
    powerPerCell: 200, drillPerCell: 100, lashedPerCell: 200, smugglerPerCell: 200,
    boss: { random: 128, generations: 3, keep: 12, perParent: 10, searchSeeds: 60, finalists: 6, heldOut: 300, confirm: 600, reference: 300, gateSeeds: 200 },
  },
  full: {
    name: "full", fieldPerCell: 1000, spendPerCell: 500,
    situationScenes: ALL_SCENES, situationSeeds: 200, situationRounds: [1, 2, 3, 4], grappledRounds: [3, 4, 5, 6, 7], drilledScenes: ALL_SCENES,
    situationMinSeeds: 40, powerPerCell: 600, drillPerCell: 500, lashedPerCell: 1000, smugglerPerCell: 1000,
    boss: { random: 256, generations: 5, keep: 16, perParent: 16, searchSeeds: 100, finalists: 8, heldOut: 600, confirm: 2000, reference: 1000, gateSeeds: 600 },
  },
};
