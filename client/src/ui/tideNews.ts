// Has a Tide resolved since this player was last here? Then the Tide jingle plays (section 2.3). The
// last Tide seen is kept on the device, per season, so it is a convenience and never game state.

type Store = Pick<Storage, "getItem" | "setItem">;

export const lastSeenKey = (seasonId: string) => `rumtide.lastTide.${seasonId}`;

/**
 * True when `current` is later than the Tide this device last saw in the season. The first visit
 * is not news, because there is nothing it could have missed. Records `current` as seen.
 */
export function checkTideNews(storage: Store | null, seasonId: string, current: number): boolean {
  let news = false;
  try {
    const stored = storage?.getItem(lastSeenKey(seasonId)) ?? null;
    const seen = stored === null ? NaN : Number(stored);
    const known = Number.isInteger(seen);
    news = known && current > seen;
    // A missing or garbled value is replaced, so it cannot stay wrong for good.
    if (!known || news) storage?.setItem(lastSeenKey(seasonId), String(current));
  } catch {
    // Blocked storage means no jingle, never a crash.
  }
  return news;
}
