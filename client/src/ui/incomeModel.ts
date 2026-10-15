import { B } from "@engine/balance.ts";
import { bonusRate, incomeFacts, shoreLeaveActive, type IncomeFacts } from "@engine/income.ts";
import type { GameMap } from "@engine/map.ts";
import type { Ship } from "@engine/types.ts";
import type { Me } from "../net/captain.ts";
import type { ShipMarker } from "../scenes/layout.ts";
import { sellRevenue, type GoodQuote } from "./portModel.ts";

// What Shore Leave, Fair Winds and the convoy bonus mean for this captain right now, worked out with
// the same engine functions the server uses (engine/income.ts), so the screen and the server cannot
// disagree. The bonuses top up trade profit and merchant or galleon prizes (docs/DECISIONS.md).

const pct = (x: number) => `${Math.round(x * 100)}%`;

export interface IncomeView {
  facts: IncomeFacts;
  /** Stored Tides of Shore Leave, not counting one already spent this Tide. */
  stored: number;
  shoreLeave: boolean;
  fairWinds: boolean;
  convoyMates: number;
  /** The extra share of income that applies to the next profit this captain banks, such as 0.7. */
  rate: number;
  /** One sentence for each source that is paying out, or will. */
  lines: string[];
}

/** The ships are what the map shows: where every captain is and which fleet they are in. */
export function incomeView(
  map: GameMap, me: Pick<Me, "captain" | "ship" | "tide">, ships: readonly Pick<ShipMarker, "captainId" | "nodeId" | "fleetId">[],
): IncomeView {
  const { captain } = me;
  const roster = ships.map((s) => ({ id: s.captainId, fleetId: s.fleetId ?? null, nodeId: s.nodeId }));
  // The ship list comes from a separate read, so it may lag a moment behind: this captain's own place is known for certain.
  const mine = { id: captain.id, fleetId: captain.fleetId, nodeId: me.ship.nodeId };
  const facts = incomeFacts(map, captain.id, [...roster.filter((r) => r.id !== captain.id), mine]);
  const tide = me.tide.number;
  const shoreLeave = shoreLeaveActive(captain, tide);

  const lines: string[] = [];
  if (shoreLeave) {
    const spent = captain.shoreLeaveUsedTide === tide;
    lines.push(spent
      ? `Shore Leave is paying out this Tide: ${pct(B.catchUp.shoreLeaveBonus)} more on every sale profit and prize. ${captain.shoreLeaveTides} stored.`
      : `Shore Leave: ${captain.shoreLeaveTides} stored. One is spent on the first profit you bank this Tide, then every sale profit and prize this Tide pays ${pct(B.catchUp.shoreLeaveBonus)} more.`);
  }
  if (captain.fairWinds) lines.push(fairWindsLine());
  if (facts.convoyMates > 0) {
    lines.push(`Convoy: ${facts.convoyMates} fleet ${facts.convoyMates === 1 ? "mate is" : "mates are"} close by, so sale profit and prizes pay ${pct(B.fleet.convoyPerMate * facts.convoyMates)} more.`);
  }
  return {
    facts, stored: captain.shoreLeaveTides,
    shoreLeave, fairWinds: captain.fairWinds, convoyMates: facts.convoyMates,
    rate: bonusRate(captain, tide, facts), lines,
  };
}

/** A friendly buff, never pity (section 9 rule 8). */
export const fairWindsLine = () =>
  `Fair Winds fills your sails: ${pct(B.catchUp.fairWindsBonus)} more on sale profit and prizes this Tide.`;

export interface SaleEstimate {
  /** What the market pays, as the server rounds it. */
  revenue: number;
  /** Revenue less what the cargo cost. Negative for a sale at a loss. */
  profit: number;
  /** The bonus on top, which only a profit earns. */
  bonus: number;
}

/** What selling `units` of a quoted good would pay, with the bonus the server would add. */
export function estimateSale(
  quote: GoodQuote, units: number, ship: Pick<Ship, "cargoCostBasis" | "cargo">, rate: number,
): SaleEstimate {
  const revenue = sellRevenue(quote, units);
  const held = ship.cargo[quote.good];
  const cost = held === 0 ? 0 : ship.cargoCostBasis[quote.good] * (units / held);
  const profit = revenue - cost;
  return { revenue, profit, bonus: profit > 0 ? Math.round(profit * rate) : 0 };
}
