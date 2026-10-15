import { describe, expect, it } from "vitest";
import { deskTabs, isOver, overNote, seasonEnding, seasonTitle, shownTab } from "./seasonModel.ts";

const running = { name: "Season 0", status: "active" as const, currentTide: 5, lengthTides: 14, tideStatus: "open" };
const finished = { ...running, status: "ended" as const, currentTide: 14, tideStatus: "resolved" };
const early = { ...running, status: "ended" as const, currentTide: 5, tideStatus: "open" };

describe("a season that is over", () => {
  it("is over when it has ended, and not before", () => {
    expect(isOver(running)).toBe(false);
    expect(isOver(finished)).toBe(true);
    expect(isOver(early)).toBe(true);
    expect(isOver(null)).toBe(false);
  });

  it("tells a season that ran its course from one that was stopped early", () => {
    expect(seasonEnding(finished)).toBe("finished");
    expect(seasonEnding(early)).toBe("early");
    // Stopped during the last Tide, before it resolved: there is no final Gazette, so it was early.
    expect(seasonEnding({ ...finished, tideStatus: "open" })).toBe("early");
    expect(seasonEnding({ ...finished, tideStatus: null })).toBe("early");
    // Resolved Tide, but not the last one.
    expect(seasonEnding({ ...early, tideStatus: "resolved" })).toBe("early");
  });

  it("says in the header that the season is over", () => {
    expect(seasonTitle(running)).toBe("Season 0, Tide 5 of 14");
    expect(seasonTitle(finished)).toBe("Season 0, season over after Tide 14 of 14");
    expect(seasonTitle(early)).toBe("Season 0, season ended early at Tide 5 of 14");
  });

  it("explains what is still open to read", () => {
    expect(overNote(finished)).toContain("final ranking");
    expect(overNote(early)).toContain("ended this season early");
    for (const note of [overNote(finished), overNote(early)]) {
      expect(note).toMatch(/orders are closed/i);
      expect(note).not.toMatch(/[-–—]/);
    }
  });
});

describe("the captain's desk", () => {
  it("offers every tab while the season runs", () => {
    expect(deskTabs(false)).toEqual(["orders", "port", "fleet", "legend", "gazette"]);
  });

  it("closes Orders, Port and Fleet once the season is over, and keeps Legend and the Gazette", () => {
    expect(deskTabs(true)).toEqual(["legend", "gazette"]);
  });

  it("shows the tab the player chose while the season runs, collapsed or not", () => {
    for (const tab of ["orders", "port", "fleet", "legend", "gazette"] as const) expect(shownTab(tab, false)).toBe(tab);
    expect(shownTab(null, false)).toBeNull();
  });

  it("moves a closed tab to the Legend when the season ends, so the final ranking is what you see", () => {
    for (const tab of ["orders", "port", "fleet"] as const) expect(shownTab(tab, true)).toBe("legend");
    expect(shownTab("legend", true)).toBe("legend");
    expect(shownTab("gazette", true)).toBe("gazette");
  });

  it("leaves a collapsed desk collapsed", () => {
    expect(shownTab(null, true)).toBeNull();
  });
});
