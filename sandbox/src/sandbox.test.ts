import { describe, expect, it } from "vitest";
import { B, templateDoctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { RIGHT_PICKS, STYLE_PICKS, runFight } from "./setup.ts";
import { doctrineWords, endingWords, rangeAt, roundLog, ruleWords, shipsBySide, stateAt } from "./words.ts";

describe("sandbox battle viewer: the battle", () => {
  it("gives the same battle for the same picks and seed, and another for a new seed", () => {
    const a = runFight("gunline", "boarder", 7);
    const b = runFight("gunline", "boarder", 7);
    expect(JSON.stringify(a.record)).toBe(JSON.stringify(b.record));
    const others = [8, 9, 10, 11].map((seed) => JSON.stringify(runFight("gunline", "boarder", seed).record));
    expect(others.some((r) => r !== JSON.stringify(a.record))).toBe(true);
  });

  it("puts a fresh full sloop of the style on each side, with the style's template", () => {
    const f = runFight("firebrand", "smuggler", 3);
    const ships = shipsBySide(f.record.ships);
    expect(ships.hunter.style).toBe("firebrand");
    expect(ships.hunter.firePots).toBe(B.styles.firebrand.startPots);
    expect(ships.hunter.hullPoints).toBe(ships.hunter.maxHullPoints);
    expect(ships.hunter.hands).toBe(ships.hunter.maxHands);
    expect(f.doctrines.target).toEqual(templateDoctrine("Smuggler"));
    expect(f.record.doctrines).toEqual({ hunter: "Firebrand", target: "Smuggler" });
  });

  it("builds Old Shellback whole, with his own doctrine and no Rigging", () => {
    const f = runFight("bombardier", "shellback", 5);
    const him = shipsBySide(f.record.ships).target;
    expect(him.name).toBe("Old Shellback");
    expect(him.maxHullPoints).toBe(B.shellback.hull);
    expect(him.maxRiggingPoints).toBe(0);
    expect(f.record.doctrines.target).toBe("Claw and Shell");
    expect(f.record.rounds.some((r) => r.ships.some((s) => s.mood !== undefined))).toBe(true);
  });
});

describe("sandbox battle viewer: the words", () => {
  it("reads a template as if then rules", () => {
    expect(doctrineWords(templateDoctrine("Bombardier"))).toEqual([
      "IF the ships are Grappled THEN Open Range and Repel",
      "IF the distance is Short or nearer THEN Open Range and Round shot",
      "IF the distance is Medium THEN Open Range and Mortar",
      "OTHERWISE Hold and Mortar",
    ]);
    expect(ruleWords(templateDoctrine("Smuggler").rules[0]!)).toBe(`IF my Hull is below ${B.styles.smuggler.strikeHullPct}% THEN Surrender`);
  });

  it("tells every round and the ending of every pairing without failing", () => {
    for (const left of STYLE_PICKS) {
      for (const right of RIGHT_PICKS) {
        for (const seed of [1, 2, 3]) {
          const f = runFight(left, right, seed);
          const n = f.record.rounds.length;
          expect(n).toBeGreaterThan(0);
          for (let i = 0; i < n; i++) {
            const log = roundLog(f.record, f.doctrines, i);
            expect(log.ships).toHaveLength(2);
            for (const s of log.ships) expect(s.lines.length).toBeGreaterThan(0);
            expect(log.events.length).toBeGreaterThan(0);
            for (const line of [...log.ships.flatMap((s) => s.lines), ...log.events]) expect(line).not.toMatch(/undefined|NaN|\[object/);
          }
          const end = endingWords(f.record, f.doctrines);
          expect(`${end.headline} ${end.how} ${end.why}`).not.toMatch(/undefined|NaN|\[object/);
          expect(end.how).not.toBe("Crippled"); // Crippled never ends a battle
        }
      }
    }
  });

  it("shows the ships as the record has them at the start and at the end", () => {
    const f = runFight("rammer", "gunline", 2);
    const start = shipsBySide(f.record.ships);
    const end = shipsBySide(f.record.final);
    expect(stateAt(f.record, 0).hunter.hull).toBe(start.hunter.hullPoints);
    const last = stateAt(f.record, f.record.rounds.length);
    expect(last.hunter).toEqual({ hull: end.hunter.hullPoints, rigging: end.hunter.riggingPoints, hands: end.hunter.hands });
    expect(last.target).toEqual({ hull: end.target.hullPoints, rigging: end.target.riggingPoints, hands: end.target.hands });
    expect(rangeAt(f.record, 0)).toBe(f.record.startRange);
  });

  it("names the winner the record names", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const f = runFight("boarder", "skirmisher", seed);
      const end = endingWords(f.record, f.doctrines);
      const winner = f.record.outcome.winner;
      if (winner) expect(end.headline).toBe(`${shipsBySide(f.record.ships)[winner].name} wins`);
      else expect(end.headline).toBe("Nobody wins");
    }
  });
});
