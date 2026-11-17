import { describe, expect, it } from "vitest";
import {
  BETA_PATH, MAX_TIDE, advanceQuestion, backQuestion, betaPage, readStoredPlan, readSubmissions, readTide, stepTide, submissionSummary, submittedCount,
} from "./betaModel.ts";

describe("betaPage", () => {
  it("knows the three beta paths, with or without a trailing slash", () => {
    expect(betaPage("/sandbox")).toBe("battle");
    expect(betaPage("/sandbox/")).toBe("battle");
    expect(betaPage("/sandbox/tide")).toBe("tide");
    expect(betaPage("/sandbox/admin/")).toBe("admin");
  });
  it("leaves every other path to the game", () => {
    for (const path of ["/", "", "/sandbox/other", "/sandboxes", "/admin", "/sandbox/tide/extra"]) expect(betaPage(path)).toBeNull();
  });
  it("round trips the paths it hands out", () => {
    for (const [page, path] of Object.entries(BETA_PATH)) expect(betaPage(path)).toBe(page);
  });
});

describe("stepTide", () => {
  it("moves one Tide forward or back", () => {
    expect(stepTide(5, 1)).toBe(6);
    expect(stepTide(5, -1)).toBe(4);
  });
  it("never goes under Tide 1 or over the last Tide", () => {
    expect(stepTide(1, -1)).toBeNull();
    expect(stepTide(MAX_TIDE, 1)).toBeNull();
  });
});

describe("readTide", () => {
  it("reads a Tide row and refuses anything else", () => {
    expect(readTide({ tide: 3 })).toBe(3);
    for (const bad of [null, undefined, {}, { tide: 0 }, { tide: 1.5 }, { tide: "3" }, { tide: 1000 }]) expect(readTide(bad)).toBeNull();
  });
});

describe("the confirm words", () => {
  it("name both Tides and say what happens", () => {
    expect(advanceQuestion(3)).toContain("Tide 3 to Tide 4");
    expect(backQuestion(3)).toContain("from 3 to 2");
  });
});

describe("the submissions list", () => {
  const rows = [
    { user_id: "a", email: "a@x.test", submitted_at: "2026-11-17T10:00:00Z", style: "gunline", steps: 2 },
    { user_id: "b", email: "b@x.test", submitted_at: null, style: null, steps: 0 },
    { user_id: 7, email: "junk" },
  ];
  it("reads good rows, drops broken ones and counts who has saved", () => {
    const read = readSubmissions(rows);
    expect(read).toHaveLength(2);
    expect(submittedCount(read)).toBe(1);
    expect(submissionSummary(read)).toBe("1 of 2 accounts have a plan saved");
  });
  it("copes with no data", () => {
    expect(readSubmissions(null)).toEqual([]);
    expect(submissionSummary([])).toBe("0 of 0 accounts have a plan saved");
  });
});

describe("readStoredPlan", () => {
  it("accepts a plan of known steps", () => {
    const plan = readStoredPlan({ style: "rammer", steps: [{ kind: "sail", to: "w1" }, { kind: "dock" }] });
    expect(plan?.steps).toHaveLength(2);
  });
  it("accepts a plan with no steps", () => {
    expect(readStoredPlan({ style: "gunline", steps: [] })).toEqual({ style: "gunline", steps: [] });
  });
  it("refuses plans that are not shaped like one", () => {
    for (const bad of [null, {}, { style: 3, steps: [] }, { style: "x", steps: "no" }, { style: "x", steps: [{ kind: "teleport" }] }, { style: "x", steps: [null] }, { style: "x", steps: new Array(7).fill({ kind: "dock" }) }]) {
      expect(readStoredPlan(bad)).toBeNull();
    }
  });
});
