// Fleets (section 8.1): who sails with whom, and the rules for forming and leaving one. Pure
// functions over a FleetBook, so the same rules run in the handlers, the memory store and the tests.
// Every function returns a new book and throws a FleetError (a message safe to show the player)
// when a rule says no. What a fleet is worth in a fight lives in combat.ts and balance.ts.
//
// Joining is immediate. Leaving is announced now and takes effect when the next Tide opens, so the
// captain is still a fleet mate while this Tide resolves and the knife is visible for one Tide.

import { fleetCap } from "./balance.ts";
import type { Fleet, FleetInvite, FleetMember } from "./types.ts";

export class FleetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FleetError";
  }
}

export interface FleetBook {
  fleets: Fleet[];
  members: FleetMember[];
  invites: FleetInvite[];
}

export const emptyBook = (): FleetBook => ({ fleets: [], members: [], invites: [] });

/** The flags a fleet can fly. Art comes later; the ids are what the server stores. */
export const FLAGS = ["skull", "anchor", "cutlass", "kraken", "gull", "star"] as const;

/** Sail colours for fleets, from the Endesga 32 palette. The first one nobody is using is handed out. */
export const FLEET_COLOURS = ["#e43b44", "#0099db", "#63c74d", "#feae34", "#b55088", "#2ce8f5"] as const;

export const NAME_LENGTH = { min: 2, max: 24 } as const;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Fleets and members in id order, so a book never depends on the order things were added. */
function tidy(book: FleetBook): FleetBook {
  return {
    fleets: [...book.fleets].sort((a, b) => compare(a.id, b.id)),
    members: [...book.members].sort((a, b) => compare(a.fleetId, b.fleetId) || compare(a.captainId, b.captainId)),
    invites: [...book.invites].sort((a, b) => compare(a.fleetId, b.fleetId) || compare(a.captainId, b.captainId)),
  };
}

export const membersOf = (book: FleetBook, fleetId: string): FleetMember[] =>
  book.members.filter((m) => m.fleetId === fleetId);

export const membershipOf = (book: FleetBook, captainId: string): FleetMember | null =>
  book.members.find((m) => m.captainId === captainId) ?? null;

export const fleetById = (book: FleetBook, fleetId: string): Fleet | null =>
  book.fleets.find((f) => f.id === fleetId) ?? null;

/** The fleet each captain sails in, for the captains who are in one. */
export function fleetIds(book: FleetBook): Map<string, string> {
  return new Map(book.members.map((m) => [m.captainId, m.fleetId]));
}

/** A name as stored: trimmed, with runs of spaces made single. Throws when it is not allowed. */
export function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < NAME_LENGTH.min || name.length > NAME_LENGTH.max) {
    throw new FleetError(`A fleet name needs ${NAME_LENGTH.min} to ${NAME_LENGTH.max} characters`);
  }
  if (/\p{C}/u.test(name)) throw new FleetError("That name has characters a fleet name cannot use");
  return name;
}

function colourFor(book: FleetBook): string {
  const used = new Set(book.fleets.map((f) => f.colour));
  return FLEET_COLOURS.find((c) => !used.has(c)) ?? FLEET_COLOURS[book.fleets.length % FLEET_COLOURS.length]!;
}

export interface CreateFleet {
  id: string;
  seasonId: string;
  captainId: string;
  name: string;
  flag: string;
  tide: number;
}

/** A captain who is not in a fleet founds one and is its first member. */
export function createFleet(book: FleetBook, a: CreateFleet): FleetBook {
  if (membershipOf(book, a.captainId)) throw new FleetError("You are already in a fleet. Leave it first.");
  const name = cleanName(a.name);
  if (!(FLAGS as readonly string[]).includes(a.flag)) throw new FleetError("Pick one of the flags on offer");
  if (book.fleets.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    throw new FleetError("Another fleet already has that name");
  }
  return tidy({
    ...book,
    fleets: [...book.fleets, { id: a.id, seasonId: a.seasonId, name, flag: a.flag, colour: colourFor(book), createdTide: a.tide }],
    members: [...book.members, { fleetId: a.id, captainId: a.captainId, joinedTide: a.tide, leavingAtTide: null }],
  });
}

export interface InviteArgs {
  from: string;
  to: string;
  tide: number;
  /** Captains in the season, which sets the size cap. */
  players: number;
  /** Is this id a captain in the season? */
  known(captainId: string): boolean;
}

/** A member who is not leaving asks another captain, who has no fleet, to join. */
export function inviteCaptain(book: FleetBook, a: InviteArgs): FleetBook {
  const mine = membershipOf(book, a.from);
  if (!mine) throw new FleetError("Found a fleet before you invite anyone");
  if (mine.leavingAtTide !== null) throw new FleetError("You are leaving this fleet, so you cannot invite anyone");
  if (a.to === a.from) throw new FleetError("You are already in your own fleet");
  if (!a.known(a.to)) throw new FleetError("There is no such captain");
  if (membershipOf(book, a.to)) throw new FleetError("That captain is already in a fleet");
  if (membersOf(book, mine.fleetId).length >= fleetCap(a.players)) {
    throw new FleetError(`A fleet holds at most ${fleetCap(a.players)} captains in this season`);
  }
  if (book.invites.some((i) => i.fleetId === mine.fleetId && i.captainId === a.to)) {
    throw new FleetError("That captain has already been invited");
  }
  return tidy({ ...book, invites: [...book.invites, { fleetId: mine.fleetId, captainId: a.to, invitedBy: a.from, tide: a.tide }] });
}

export interface AcceptArgs {
  captainId: string;
  fleetId: string;
  tide: number;
  players: number;
}

/** The invited captain joins at once. Every other invitation to them is dropped. */
export function acceptInvite(book: FleetBook, a: AcceptArgs): FleetBook {
  if (!book.invites.some((i) => i.fleetId === a.fleetId && i.captainId === a.captainId)) {
    throw new FleetError("That invitation is not there any more");
  }
  if (membershipOf(book, a.captainId)) throw new FleetError("You are already in a fleet. Leave it first.");
  if (!fleetById(book, a.fleetId)) throw new FleetError("That fleet no longer exists");
  if (membersOf(book, a.fleetId).length >= fleetCap(a.players)) {
    throw new FleetError("That fleet is full");
  }
  return tidy({
    ...book,
    members: [...book.members, { fleetId: a.fleetId, captainId: a.captainId, joinedTide: a.tide, leavingAtTide: null }],
    invites: book.invites.filter((i) => i.captainId !== a.captainId),
  });
}

/** The invited captain says no. */
export function declineInvite(book: FleetBook, captainId: string, fleetId: string): FleetBook {
  if (!book.invites.some((i) => i.fleetId === fleetId && i.captainId === captainId)) {
    throw new FleetError("That invitation is not there any more");
  }
  return tidy({ ...book, invites: book.invites.filter((i) => !(i.fleetId === fleetId && i.captainId === captainId)) });
}

export type LeaveOutcome =
  /** Notice given: the captain sails with the fleet until the Tide turns, and the fleet can see it. */
  | { kind: "notice"; book: FleetBook; fleet: Fleet; effectiveTide: number }
  /** The captain was alone in the fleet, so there is nobody to warn and the fleet is gone. */
  | { kind: "disbanded"; book: FleetBook; fleet: Fleet };

/** Section 8.1: leaving takes effect at the next Tide, and is announced. */
export function leaveFleet(book: FleetBook, captainId: string, tide: number): LeaveOutcome {
  const mine = membershipOf(book, captainId);
  if (!mine) throw new FleetError("You are not in a fleet");
  if (mine.leavingAtTide !== null) throw new FleetError("You have already given notice");
  const fleet = fleetById(book, mine.fleetId)!;

  if (membersOf(book, mine.fleetId).length === 1) {
    return {
      kind: "disbanded", fleet,
      book: tidy({
        fleets: book.fleets.filter((f) => f.id !== fleet.id),
        members: book.members.filter((m) => m.fleetId !== fleet.id),
        invites: book.invites.filter((i) => i.fleetId !== fleet.id),
      }),
    };
  }
  const effectiveTide = tide + 1;
  return {
    kind: "notice", fleet, effectiveTide,
    book: tidy({
      ...book,
      members: book.members.map((m) => (m.captainId === captainId ? { ...m, leavingAtTide: effectiveTide } : m)),
    }),
  };
}

/**
 * Called as `tide` opens: everyone whose notice runs out by then is out of their fleet, and a fleet
 * with nobody left is gone with its invitations. Returns the captains who left, in id order.
 */
export function settleDepartures(book: FleetBook, tide: number): { book: FleetBook; departed: string[] } {
  const gone = (m: FleetMember) => m.leavingAtTide !== null && m.leavingAtTide <= tide;
  const members = book.members.filter((m) => !gone(m));
  const alive = new Set(members.map((m) => m.fleetId));
  return {
    departed: book.members.filter(gone).map((m) => m.captainId).sort(compare),
    book: tidy({
      fleets: book.fleets.filter((f) => alive.has(f.id)),
      members,
      invites: book.invites.filter((i) => alive.has(i.fleetId)),
    }),
  };
}

/** A book for captains who already carry a fleet id, such as a season set up with its fleets (the bots do). */
export function bookFromCaptains(
  seasonId: string, tide: number, captains: readonly { id: string; fleetId: string | null }[],
): FleetBook {
  const ids = [...new Set(captains.map((c) => c.fleetId).filter((f): f is string => f !== null))].sort(compare);
  return tidy({
    fleets: ids.map((id, i) => ({
      id, seasonId, name: id, flag: FLAGS[0], colour: FLEET_COLOURS[i % FLEET_COLOURS.length]!, createdTide: tide,
    })),
    members: captains.flatMap((c) => (c.fleetId === null ? [] : [{ fleetId: c.fleetId, captainId: c.id, joinedTide: tide, leavingAtTide: null }])),
    invites: [],
  });
}
