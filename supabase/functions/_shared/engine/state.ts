// Starting state for a new captain: a fresh sloop docked in port with the starting gold (section 5).

import { B, maxHullPoints, powerRating, statValue } from "./balance.ts";
import type { Captain, Ship } from "./types.ts";

export function newShip(captainId: string, nodeId: string): Ship {
  return {
    captainId, hull: "sloop", nodeId, docked: true,
    hullPoints: maxHullPoints("sloop", 0),
    levels: { hull: 0, cannons: 0, sails: 0, crew: 0, hold: 0 },
    plunderGold: 0,
    cargo: { rum: 0, sugar: 0, spice: 0 },
    cargoCostBasis: { rum: 0, sugar: 0, spice: 0 },
    shipwrightProgress: 0,
  };
}

export function newCaptain(id: string, seasonId: string): Captain {
  return {
    id, seasonId, userId: `user-${id}`,
    shipName: id, flag: "black", partingShot: "",
    legend: 0, chestGold: B.startGold, bounty: 0,
    shieldUntilTide: null, fleetId: null,
    standingPlan: ["broadside", "outmaneuver", "board"], standingParley: "off",
    shoreLeaveTides: 0, shoreLeaveUsedTide: 0, fairWinds: false, omens: [], lastOrdersTide: 0, status: "active",
  };
}

/** Power Rating of a ship as it stands (section 14). A fresh sloop is 10. */
export const shipPowerRating = (ship: Ship) =>
  powerRating({
    hull: maxHullPoints(ship.hull, ship.levels.hull),
    cannons: statValue(ship.hull, ship.levels.cannons),
    sails: statValue(ship.hull, ship.levels.sails),
    crew: statValue(ship.hull, ship.levels.crew),
  });
