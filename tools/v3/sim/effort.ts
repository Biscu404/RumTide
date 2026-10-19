// How hard a simulator run works (P3.1). `full` is the run the P3 checks are judged on, `quick` is for tuning loops,
// and `tiny` is for the tests of the simulator itself.

export interface Effort {
  name: "tiny" | "quick" | "full";
  /** Battles per scene, per ordered pair of templates, for checks 1 and 3. */
  fieldPerCell: number;
  /** Scenes the best play of check 2 is searched in, the seeds per play, and the rounds tried. */
  situationScenes: string[];
  situationSeeds: number;
  situationRounds: number[];
  /** Battles per power ratio, per scene and seat, for check 4. */
  powerPerCell: number;
  /** Old Shellback, check 5: the search for a good doctrine and the fights that judge it. */
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
    name: "tiny", fieldPerCell: 20, situationScenes: ["open/breeze"], situationSeeds: 12, situationRounds: [1, 3], powerPerCell: 20,
    boss: { random: 6, generations: 1, keep: 2, perParent: 2, searchSeeds: 8, finalists: 2, heldOut: 8, confirm: 10, reference: 10, gateSeeds: 10 },
  },
  quick: {
    name: "quick", fieldPerCell: 200, situationScenes: ["open/breeze", "shallows", "reef", "rocky", "fog", "kelp"], situationSeeds: 100,
    situationRounds: [1, 2, 3, 4], powerPerCell: 200,
    boss: { random: 128, generations: 3, keep: 12, perParent: 10, searchSeeds: 60, finalists: 6, heldOut: 300, confirm: 600, reference: 300, gateSeeds: 200 },
  },
  full: {
    name: "full", fieldPerCell: 1000, situationScenes: ALL_SCENES, situationSeeds: 300, situationRounds: [1, 2, 3, 4], powerPerCell: 600,
    boss: { random: 256, generations: 5, keep: 16, perParent: 16, searchSeeds: 100, finalists: 8, heldOut: 600, confirm: 2000, reference: 1000, gateSeeds: 600 },
  },
};
