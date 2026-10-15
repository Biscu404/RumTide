import { describe, expect, it } from "vitest";
import { checkTideNews, lastSeenKey } from "./tideNews.ts";

function memoryStorage() {
  const data: Record<string, string> = {};
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
}

describe("checkTideNews", () => {
  it("is not news the first time a device sees a season, but remembers the Tide", () => {
    const storage = memoryStorage();
    expect(checkTideNews(storage, "s1", 4)).toBe(false);
    expect(storage.data[lastSeenKey("s1")]).toBe("4");
  });

  it("is news once when a later Tide has opened, and not again after that", () => {
    const storage = memoryStorage();
    checkTideNews(storage, "s1", 4);
    expect(checkTideNews(storage, "s1", 4)).toBe(false);
    expect(checkTideNews(storage, "s1", 5)).toBe(true);
    expect(checkTideNews(storage, "s1", 5)).toBe(false);
  });

  it("counts several missed Tides as one piece of news", () => {
    const storage = memoryStorage();
    checkTideNews(storage, "s1", 2);
    expect(checkTideNews(storage, "s1", 6)).toBe(true);
    expect(storage.data[lastSeenKey("s1")]).toBe("6");
  });

  it("keeps each season apart", () => {
    const storage = memoryStorage();
    checkTideNews(storage, "s1", 9);
    expect(checkTideNews(storage, "s2", 1)).toBe(false);
    expect(storage.data[lastSeenKey("s1")]).toBe("9");
  });

  it("is never news for an older Tide, or for a value in storage that is not a number", () => {
    const storage = memoryStorage();
    storage.data[lastSeenKey("s1")] = "8";
    expect(checkTideNews(storage, "s1", 3)).toBe(false);
    storage.data[lastSeenKey("s2")] = "soon";
    expect(checkTideNews(storage, "s2", 3)).toBe(false);
  });

  it("is quiet, not broken, when storage is missing or blocked", () => {
    expect(checkTideNews(null, "s1", 3)).toBe(false);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(checkTideNews(broken, "s1", 3)).toBe(false);
  });
});
