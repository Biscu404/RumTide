import { describe, expect, it, vi } from "vitest";
import { failureMessage, gazetteMessage, postToDiscord } from "./discord.ts";

describe("gazetteMessage", () => {
  it("names the Tide, lists the headlines and links the site", () => {
    const text = gazetteMessage("Season 0", 7, { headlines: ["The Wet Sock was boarded.", "A quiet night."] }, "https://rumtide.example");
    expect(text).toBe(
      "**The Brine Gazette: Season 0, Tide 7**\n• The Wet Sock was boarded.\n• A quiet night.\nSee the replays: https://rumtide.example",
    );
  });

  it("stays under Discord's 2000 characters however many headlines there are", () => {
    const headlines = Array.from({ length: 200 }, (_, i) => `Headline number ${i + 1} is rather long and wordy, as pirates are.`);
    const text = gazetteMessage("Season 0", 3, { headlines }, "https://rumtide.example");
    expect(text.length).toBeLessThan(2000);
    expect(text).toMatch(/…and \d+ more in the Gazette\./);
    expect(text).toContain("Headline number 1 ");
  });

  it("says a Tide failed without giving the error away", () => {
    expect(failureMessage("Season 0", 4)).toMatch(/Tide 4 .* could not be resolved/);
  });
});

describe("postToDiscord", () => {
  it("posts JSON and never pings anyone", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await postToDiscord("https://discord.test/hook", "hello @everyone", fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://discord.test/hook");
    expect(JSON.parse(init.body as string)).toEqual({ content: "hello @everyone", allowed_mentions: { parse: [] } });
  });

  it("throws when Discord refuses", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 429 }));
    await expect(postToDiscord("https://discord.test/hook", "x", fetchImpl as unknown as typeof fetch)).rejects.toThrow(/429/);
  });
});
