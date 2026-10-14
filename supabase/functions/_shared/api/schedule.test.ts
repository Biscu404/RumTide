import { describe, expect, it } from "vitest";
import { localDate, nextDueAt } from "./schedule.ts";

const TZ = "Europe/Bucharest";
const iso = (d: Date) => d.toISOString();

describe("nextDueAt", () => {
  it("is 21:00 on the clock: 18:00 UTC in summer time", () => {
    expect(iso(nextDueAt(new Date("2026-10-14T09:00:00Z"), TZ, "21:00"))).toBe("2026-10-14T18:00:00.000Z");
  });

  it("moves to the next day once the time has passed, even by a second", () => {
    expect(iso(nextDueAt(new Date("2026-10-14T18:00:00Z"), TZ, "21:00"))).toBe("2026-10-15T18:00:00.000Z");
    expect(iso(nextDueAt(new Date("2026-10-14T17:59:59Z"), TZ, "21:00"))).toBe("2026-10-14T18:00:00.000Z");
  });

  it("skips today when the day's Tide has been used early", () => {
    expect(iso(nextDueAt(new Date("2026-10-14T09:00:00Z"), TZ, "21:00", true))).toBe("2026-10-15T18:00:00.000Z");
  });

  it("keeps 21:00 on the clock when daylight saving ends (25 October 2026)", () => {
    // Clocks go back at 04:00 on 25 October: 24 October is still UTC+3, 25 October onwards is UTC+2.
    expect(iso(nextDueAt(new Date("2026-10-24T09:00:00Z"), TZ, "21:00"))).toBe("2026-10-24T18:00:00.000Z");
    expect(iso(nextDueAt(new Date("2026-10-24T19:00:00Z"), TZ, "21:00"))).toBe("2026-10-25T19:00:00.000Z");
    expect(iso(nextDueAt(new Date("2026-10-25T20:00:00Z"), TZ, "21:00"))).toBe("2026-10-26T19:00:00.000Z");
  });

  it("works across a month and a year end", () => {
    expect(iso(nextDueAt(new Date("2026-12-31T20:00:00Z"), TZ, "21:00"))).toBe("2027-01-01T19:00:00.000Z");
  });

  it("works in a zone behind UTC", () => {
    expect(iso(nextDueAt(new Date("2026-07-01T12:00:00Z"), "America/New_York", "21:00"))).toBe("2026-07-02T01:00:00.000Z");
  });

  it("rejects a Tide time that is not HH:MM", () => {
    expect(() => nextDueAt(new Date(), TZ, "9pm")).toThrow();
    expect(() => nextDueAt(new Date(), TZ, "25:00")).toThrow();
  });
});

describe("localDate", () => {
  it("is the date on the clock in the zone, not in UTC", () => {
    expect(localDate(new Date("2026-10-14T22:30:00Z"), TZ)).toBe("2026-10-15");
    expect(localDate(new Date("2026-10-14T20:59:00Z"), TZ)).toBe("2026-10-14");
  });
});
