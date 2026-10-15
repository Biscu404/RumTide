import type { SeasonInfo } from "../net/world.ts";

// What the screen does when the season it shows is over, with no Preact in it so it can be tested.
// A season is over when its status is `ended`: Tide 14 resolved on its own, or the game master ended
// it early. The app then keeps it as a read only record. Orders, Port and Fleet are closed, because
// the server would refuse them anyway; the Legend ranking and the Gazette stay open.

export type DeskTab = "orders" | "port" | "fleet" | "legend" | "gazette";

const PLAY_TABS: readonly DeskTab[] = ["orders", "port", "fleet", "legend", "gazette"];
const READ_TABS: readonly DeskTab[] = ["legend", "gazette"];

type SeasonShape = Pick<SeasonInfo, "name" | "currentTide" | "lengthTides" | "tideStatus">;

export const isOver = (season: Pick<SeasonInfo, "status"> | null): boolean => season?.status === "ended";

/**
 * Did the season run its course? That is so when the last Tide was resolved. A season the game master
 * ended earlier, or during the last Tide before it resolved, was "early": it has no final Gazette.
 */
export function seasonEnding(season: Pick<SeasonInfo, "currentTide" | "lengthTides" | "tideStatus">): "finished" | "early" {
  return season.currentTide >= season.lengthTides && season.tideStatus === "resolved" ? "finished" : "early";
}

/** The header text. */
export function seasonTitle(season: SeasonShape & Pick<SeasonInfo, "status">): string {
  if (season.status !== "ended") return `${season.name}, Tide ${season.currentTide} of ${season.lengthTides}`;
  return seasonEnding(season) === "finished"
    ? `${season.name}, season over after Tide ${season.currentTide} of ${season.lengthTides}`
    : `${season.name}, season ended early at Tide ${season.currentTide} of ${season.lengthTides}`;
}

/** The line next to the title once the season is over. */
export function overNote(season: Pick<SeasonInfo, "currentTide" | "lengthTides" | "tideStatus">): string {
  return seasonEnding(season) === "finished"
    ? "The season is over and orders are closed. Legend shows the final ranking and the Gazette keeps every Tide."
    : "The game master ended this season early. Orders are closed. Legend and the Gazette stay open to read.";
}

/** The tabs on the captain's desk: all of them while the season runs, only the readable ones after. */
export const deskTabs = (over: boolean): readonly DeskTab[] => (over ? READ_TABS : PLAY_TABS);

/**
 * The tab to show. A tab the player collapsed (null) stays collapsed. A tab that is closed now that
 * the season is over gives way to the Legend, which is where the final ranking is.
 */
export function shownTab(tab: DeskTab | null, over: boolean): DeskTab | null {
  if (tab === null) return null;
  return deskTabs(over).includes(tab) ? tab : "legend";
}
