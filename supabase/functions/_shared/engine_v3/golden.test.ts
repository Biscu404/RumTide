// The golden test (P1.9): the six ship fixture must always produce exactly the saved replay.
// If a rule change is intentional, run `npm run golden:update`, read the diff, and commit it with the change.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "./index.ts";
import { GOLDEN_FILE, goldenSnapshot } from "../../../../tools/v3/sixShips.ts";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

describe("six ship golden Tide (P1.9, P2.4)", () => {
  it("is identical on every run", () => {
    expect(canonicalJson(goldenSnapshot())).toBe(canonicalJson(goldenSnapshot()));
  });

  it("matches the saved golden file", () => {
    const saved = canonicalJson(JSON.parse(readFileSync(GOLDEN_FILE, "utf8")));
    expect(canonicalJson(goldenSnapshot())).toBe(saved);
  });

  it("gives the same fingerprint in a separate Node process", () => {
    const out = execFileSync(process.execPath, ["tools/v3/tide-demo.ts", "--hash"], { cwd: ROOT, encoding: "utf8" }).trim();
    expect(out).toBe(goldenSnapshot().hash);
  });

  it("shows every Phase 1 rule at once", () => {
    const r = goldenSnapshot();
    expect(r.encounters.map((e) => [e.hunter, e.target, e.onLane])).toEqual([
      ["ship_cap_a", "ship_cap_b", true], // head on in a lane
      ["ship_cap_d", "ship_cap_e", false], // a Lurk springs
    ]);
    const kinds = new Set(r.replay.map((e) => e.kind));
    for (const k of ["stop", "survey", "dock", "lurk", "meet", "encounter", "supplies", "undock"]) expect(kinds.has(k as never)).toBe(true);
    expect(r.ships.ship_cap_c).toMatchObject({ water: "tp_kelp", shortRations: true }); // becalmed short
    expect(r.ships.ship_cap_f).toMatchObject({ water: "dw_harbour", docked: true }); // standing orders
  });

  it("plays both encounters as real battles and tows the loser (P2.4)", () => {
    const r = goldenSnapshot();
    expect(r.encounters.map((e) => e.result)).toEqual(["draw", "captured"]);
    const kinds = r.replay.map((e) => e.kind);
    expect(kinds.filter((k) => k === "escape")).toHaveLength(2); // both targets tried to slip away and were caught
    expect(kinds.filter((k) => k === "battle")).toHaveLength(2);
    const battles = r.replay.flatMap((e) => (e.kind === "battle" ? [e] : []));
    expect(battles.map((b) => b.record.rounds.length)).toEqual([5, 5]);
    expect(battles[1]!.aftermath).toMatchObject({ winner: "ship_cap_e", loser: "ship_cap_d", towed: true, loot: { taken: { plunder: 18 } } });
    expect(r.replay.filter((e) => e.kind === "towed")).toMatchObject([{ ship: "ship_cap_d", to: "gh_harbour", banked: 82, hullPoints: 90 }]);
    expect(r.ships.ship_cap_d).toMatchObject({ water: "gh_harbour", docked: true }); // towed home
  });
});
