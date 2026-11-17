import { describe, expect, it } from "vitest";
import { RANGES } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { runFight, RIGHT_PICKS, STYLE_PICKS } from "./setup.ts";
import { GHOST_HOLD_MS, GHOST_SLIDE_MS, GLIDE_MS, PAUSE_MS, DEFAULT_SPEED, hitDelayMs, roundAnimMs } from "./pacing.ts";
import { roundMotion, roundSummary } from "./summary.ts";
import { shipsBySide, stateAt } from "./words.ts";

const BAD = /undefined|NaN|\[object|—|–/;

describe("battle viewer round summary", () => {
  it("tells every round of every pairing with a choice for each ship and a short meeting, in clean words", () => {
    for (const left of STYLE_PICKS) {
      for (const right of RIGHT_PICKS) {
        for (const seed of [1, 2, 3]) {
          const f = runFight(left, right, seed);
          for (let i = 0; i < f.record.rounds.length; i++) {
            const s = roundSummary(f.record, f.doctrines, i);
            expect(s.choices.map((c) => c.side)).toEqual(["hunter", "target"]);
            expect(s.meeting.length).toBeGreaterThan(0);
            expect(s.meeting.length).toBeLessThanOrEqual(8);
            for (const line of [...s.choices.map((c) => c.line), ...s.meeting]) expect(line).not.toMatch(BAD);
            for (const c of s.choices) expect(c.line).toMatch(/because (rule \d+ says: if |none of the rules above|no rule fitted)/);
          }
        }
      }
    }
  });

  it("names only the rule that fired, in plain words", () => {
    const f = runFight("bombardier", "boarder", 1);
    const first = roundSummary(f.record, f.doctrines, 0);
    const fired = f.record.rounds[0]!.ships.find((s) => s.ship === shipsBySide(f.record.ships).hunter.shipId)!.rule;
    expect(first.choices[0]!.line).toContain(`rule ${fired + 1}`);
    expect(first.choices[0]!.line.match(/rule \d+/g)).toHaveLength(1);
  });

  it("says who won the deck fight and how many Hands each side lost, as the record has them", () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const f = runFight("boarder", "gunline", seed);
      f.record.rounds.forEach((round, i) => {
        const m = round.melee;
        const a = round.ships[0]?.deck;
        const b = round.ships[1]?.deck;
        if (!m || !a || !b || a.pairing === "even") return;
        const text = roundSummary(f.record, f.doctrines, i).meeting.join(" ");
        expect(text).toContain(" beat ");
        expect(text).toContain(`lost ${Math.round(m.lost.hunter)}`);
        expect(text).toContain(`lost ${Math.round(m.lost.target)}`);
        checked += 1;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("gives the grapnel chance when the hooks were won or lost on a roll", () => {
    let found = 0;
    for (const left of STYLE_PICKS) {
      for (const right of RIGHT_PICKS) {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          const f = runFight(left, right, seed);
          f.record.rounds.forEach((round, i) => {
            const roll = round.contests.find((c) => c.kind === "grapnel");
            if (!roll) return;
            const text = roundSummary(f.record, f.doctrines, i).meeting.join(" ");
            expect(text).toContain(`${Math.round(roll.chance * 100)}% chance`);
            found += 1;
          });
        }
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe("battle viewer round motion", () => {
  it("matches the record: the distance change, the damage and the hooks", () => {
    for (const left of STYLE_PICKS) {
      for (const right of RIGHT_PICKS) {
        const f = runFight(left, right, 4);
        f.record.rounds.forEach((round, i) => {
          const m = roundMotion(f.record, i);
          const delta = RANGES.indexOf(round.rangeAfter) - RANGES.indexOf(round.rangeBefore);
          if (!round.escaped) expect(m.direction).toBe(delta > 0 ? "closing" : delta < 0 ? "opening" : "holding");
          else expect(m.direction).toBe("opening");
          const before = stateAt(f.record, i);
          const after = stateAt(f.record, i + 1);
          for (const side of ["hunter", "target"] as const) {
            expect(m.lost[side].hull).toBeCloseTo(Math.max(0, before[side].hull - after[side].hull));
            expect(m.lost[side].hands).toBeGreaterThanOrEqual(0);
          }
          if (m.hooksThrown) expect(round.rangeAfter).toBe("grappled");
          if (m.cutApart) expect(round.rangeBefore).toBe("grappled");
          if (round.rangeBefore === "grappled") expect(m.shots.every((s) => s.kind !== "cannon")).toBe(true);
        });
      }
    }
  });

  it("shows a cannon shot for a Round shot that landed", () => {
    const f = runFight("gunline", "boarder", 1);
    const i = f.record.rounds.findIndex((r) => r.rangeBefore !== "grappled" && r.ships[0]!.shot.damage > 0 && r.ships[0]!.guns === "roundShot");
    expect(i).toBeGreaterThanOrEqual(0);
    const hit = roundMotion(f.record, i).shots.find((s) => s.from === "hunter");
    expect(hit).toMatchObject({ kind: "cannon", to: "target", hit: true });
  });
});

describe("battle viewer pacing", () => {
  it("starts slow, and slower speeds wait longer between rounds", () => {
    expect(DEFAULT_SPEED).toBe("slow");
    expect(PAUSE_MS.slow).toBeGreaterThan(PAUSE_MS.normal);
    expect(PAUSE_MS.normal).toBeGreaterThan(PAUSE_MS.fast);
  });

  it("takes the damage on the bars after the ships arrive, and runs the whole animation after that", () => {
    const f = runFight("gunline", "boarder", 1);
    const i = f.record.rounds.findIndex((r) => r.rangeBefore !== r.rangeAfter && r.ships.some((s) => s.shot.damage > 0));
    expect(i).toBeGreaterThanOrEqual(0);
    const m = roundMotion(f.record, i);
    expect(hitDelayMs(m)).toBeGreaterThanOrEqual(GLIDE_MS);
    expect(roundAnimMs(m, false)).toBeGreaterThanOrEqual(hitDelayMs(m) + GHOST_HOLD_MS + GHOST_SLIDE_MS);
  });

  it("does not animate at all with reduced motion", () => {
    const f = runFight("gunline", "boarder", 1);
    expect(roundAnimMs(roundMotion(f.record, 0), true)).toBe(0);
    expect(roundAnimMs(null, false)).toBe(0);
  });
});
