// Check 9 (P3.B3): Lashed fast works (boarding spec acceptance 3). An equal ship that tries to Cut Free from its boarder should win
// at most about a third of its tries.
//
// The setup: a Boarder (style and template, so it boards from Short and holds the edge) against an equal fresh sloop with no style
// whose doctrine plays Open Range whenever it is Grappled (CUTTER). Over the 9 scenes and both seats, count the Cut Free contests
// the Cutter tried while the Boarder held the edge, and the share it won. Lashed fast counts the Boarder's Helm score twice in
// those contests, so an equal ship should win about 1 try in 3. The check passes when the share is at most LASHED_MAX, a third
// plus room for noise, and when there are at least LASHED_MIN_TRIES tries to judge by.
//
// The control, printed and not judged: two equal fresh sloops with no style that both Board, so nobody holds the edge, and one of
// them (the Boarding Cutter) plays Open Range whenever it is Grappled. Its tries should win about half, which shows the doubling is
// what moved the share.

import type { Doctrine } from "../../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, styleFighter } from "./arena.ts";
import type { Fighter } from "./arena.ts";
import { chunked } from "./chunks.ts";
import type { Effort } from "./effort.ts";
import { emptyDuels, mergeDuels } from "./jobs.ts";
import type { CutFreeCount, DuelsJob } from "./jobs.ts";
import type { Pool } from "./pool.ts";
import { share, wilson } from "./stats.ts";

export const LASHED_MAX = 0.4; // "at most about a third": a third plus room for the noise of a few hundred tries
export const LASHED_MIN_TRIES = 100; // fewer tries than this cannot show a share, and the check does not pass on them

const when = (range: "grappled"): { kind: "range"; op: "is"; range: "grappled" } => ({ kind: "range", op: "is", range });

/** A sloop that stays put, and tries to cut free whenever it is Grappled. The foe of the Boarder. */
export const CUTTER: Doctrine = {
  name: "Cutter",
  rules: [
    { if: [when("grappled")], then: { kind: "fight", helm: "openRange", guns: "repel" } },
    { if: [], then: { kind: "fight", helm: "hold", guns: "roundShot" } },
  ],
};

/** The control's Boarder with no style: it closes in and Boards at Close, then charges. */
const GRABBER: Doctrine = {
  name: "Grabber",
  rules: [
    { if: [when("grappled")], then: { kind: "fight", helm: "hold", guns: "charge" } },
    { if: [{ kind: "range", op: "atMost", range: "close" }], then: { kind: "fight", helm: "closeIn", guns: "board" } },
    { if: [], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
  ],
};

/** The control's other sloop: it Boards too, and tries to cut free whenever it is Grappled. */
const BOARDING_CUTTER: Doctrine = {
  name: "Boarding Cutter",
  rules: [
    { if: [when("grappled")], then: { kind: "fight", helm: "openRange", guns: "repel" } },
    { if: [{ kind: "range", op: "atMost", range: "close" }], then: { kind: "fight", helm: "closeIn", guns: "board" } },
    { if: [], then: { kind: "fight", helm: "closeIn", guns: "roundShot" } },
  ],
};

export interface LashedData {
  /** The Cutter's tries against the Boarder's edge. */
  held: CutFreeCount;
  /** The control: tries when nobody holds the edge. */
  control: CutFreeCount;
  battles: number;
}

export async function runLashed(pool: Pool, effort: Effort): Promise<LashedData> {
  const jobs: DuelsJob[] = [];
  const isControl: boolean[] = [];
  const pairs: { control: boolean; a: Fighter; b: Fighter }[] = [
    { control: false, a: styleFighter("boarder"), b: { name: "Cutter", doctrine: CUTTER } },
    { control: true, a: { name: "Grabber", doctrine: GRABBER }, b: { name: "Boarding Cutter", doctrine: BOARDING_CUTTER } },
  ];
  for (const pair of pairs) {
    for (const scene of SCENES) for (const hunts of [true, false]) {
      for (const part of chunked(effort.lashedPerCell, 250)) {
        const label = `lashed/${pair.control ? "control" : "edge"}/${scene.name}/${hunts ? "h" : "t"}`;
        jobs.push({ a: hunts ? pair.a : pair.b, b: hunts ? pair.b : pair.a, scene: scene.name, label, from: part.from, count: part.count });
        isControl.push(pair.control);
      }
    }
  }
  const results = await pool.run("duels", jobs);
  const edge = emptyDuels();
  const control = emptyDuels();
  results.forEach((r, i) => mergeDuels(isControl[i] ? control : edge, r));
  return {
    held: edge.cutFree.held,
    // The control's tries have no edge to hold, so they are the "open" ones.
    control: control.cutFree.open,
    battles: edge.tally.n,
  };
}

export interface LashedVerdict {
  pass: boolean;
  tries: number;
  wins: number;
  share: number;
  range: [number, number];
  enough: boolean;
  control: { tries: number; wins: number; share: number; range: [number, number] };
  battles: number;
}

export function judgeLashed(data: LashedData): LashedVerdict {
  const enough = data.held.tries >= LASHED_MIN_TRIES;
  const s = share(data.held.wins, data.held.tries);
  return {
    pass: enough && s <= LASHED_MAX,
    tries: data.held.tries, wins: data.held.wins, share: s, range: wilson(data.held.wins, data.held.tries), enough,
    control: { tries: data.control.tries, wins: data.control.wins, share: share(data.control.wins, data.control.tries), range: wilson(data.control.wins, data.control.tries) },
    battles: data.battles,
  };
}
