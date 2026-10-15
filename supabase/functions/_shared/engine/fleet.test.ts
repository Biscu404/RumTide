import { describe, expect, it } from "vitest";
import { B, fleetCap } from "./balance.ts";
import {
  FLEET_COLOURS, FleetError, acceptInvite, cleanName, createFleet, declineInvite, emptyBook, fleetIds,
  inviteCaptain, leaveFleet, membersOf, settleDepartures, type FleetBook,
} from "./fleet.ts";

const PLAYERS = 6;
const known = (id: string) => ["ann", "bob", "cat", "dan", "eve", "fay"].includes(id);

const found = (book: FleetBook, captainId: string, id: string, name = id, flag = "skull", tide = 1) =>
  createFleet(book, { id, seasonId: "s0", captainId, name, flag, tide });
const invite = (book: FleetBook, from: string, to: string, tide = 1, players = PLAYERS) =>
  inviteCaptain(book, { from, to, tide, players, known });
const join = (book: FleetBook, captainId: string, fleetId: string, tide = 1, players = PLAYERS) =>
  acceptInvite(book, { captainId, fleetId, tide, players });

/** Run something that should throw a FleetError and return its message. */
function refusal(run: () => unknown): string {
  try { run(); } catch (e) {
    expect(e).toBeInstanceOf(FleetError);
    return (e as Error).message;
  }
  throw new Error("Expected a FleetError");
}

/** ann founds "Red Tide" and bob joins. */
function pair(): FleetBook {
  return join(invite(found(emptyBook(), "ann", "f1", "Red Tide"), "ann", "bob"), "bob", "f1");
}

describe("fleetCap", () => {
  it("is half the players, at least 2 and at most 4 (section 8.1)", () => {
    expect([2, 3, 4, 5, 6, 7, 8, 10, 12, 20].map(fleetCap)).toEqual([2, 2, 2, 2, 3, 3, 4, 4, 4, 4]);
    expect(fleetCap(6)).toBe(3);
    expect(B.fleet.minCap).toBeLessThanOrEqual(B.fleet.maxCap);
  });
});

describe("createFleet", () => {
  it("founds a fleet with its founder as the only member and the first free colour", () => {
    const book = found(emptyBook(), "ann", "f1", "  Red   Tide ", "anchor", 3);
    expect(book.fleets).toEqual([
      { id: "f1", seasonId: "s0", name: "Red Tide", flag: "anchor", colour: FLEET_COLOURS[0], createdTide: 3 },
    ]);
    expect(book.members).toEqual([{ fleetId: "f1", captainId: "ann", joinedTide: 3, leavingAtTide: null }]);
    expect(found(book, "bob", "f2").fleets[1]!.colour).toBe(FLEET_COLOURS[1]);
  });

  it("gives a colour that is free again once its fleet is gone", () => {
    let book = found(emptyBook(), "ann", "f1");
    book = found(book, "bob", "f2");
    book = leaveFleet(book, "ann", 1).book;
    expect(found(book, "cat", "f3").fleets.find((f) => f.id === "f3")!.colour).toBe(FLEET_COLOURS[0]);
  });

  it("refuses a captain who is already in a fleet, a bad name, a bad flag and a taken name", () => {
    const book = found(emptyBook(), "ann", "f1", "Red Tide");
    expect(refusal(() => found(book, "ann", "f2", "Other"))).toMatch(/already in a fleet/);
    expect(refusal(() => found(book, "bob", "f2", "x"))).toMatch(/2 to 24/);
    expect(refusal(() => found(book, "bob", "f2", "a".repeat(25)))).toMatch(/2 to 24/);
    expect(refusal(() => found(book, "bob", "f2", "Bad\u0007name"))).toMatch(/characters/);
    expect(refusal(() => found(book, "bob", "f2", "Fine", "jolly-roger"))).toMatch(/flags/);
    expect(refusal(() => found(book, "bob", "f2", "red TIDE"))).toMatch(/already has that name/);
  });

  it("does not change the book it was given", () => {
    const book = emptyBook();
    found(book, "ann", "f1");
    expect(book).toEqual(emptyBook());
  });
});

describe("cleanName", () => {
  it("trims and squeezes spaces", () => {
    expect(cleanName("  The   Black  Pearl ")).toBe("The Black Pearl");
  });
});

describe("invite and accept", () => {
  it("lets a member invite a captain without a fleet, who joins at once", () => {
    const invited = invite(found(emptyBook(), "ann", "f1"), "ann", "bob", 2);
    expect(invited.invites).toEqual([{ fleetId: "f1", captainId: "bob", invitedBy: "ann", tide: 2 }]);
    const joined = join(invited, "bob", "f1", 2);
    expect(joined.invites).toEqual([]);
    expect(membersOf(joined, "f1").map((m) => m.captainId)).toEqual(["ann", "bob"]);
    expect(joined.members.find((m) => m.captainId === "bob")).toMatchObject({ joinedTide: 2, leavingAtTide: null });
  });

  it("only lets a member invite, and only a real captain who is free", () => {
    const book = found(emptyBook(), "ann", "f1");
    expect(refusal(() => invite(book, "bob", "cat"))).toMatch(/Found a fleet/);
    expect(refusal(() => invite(book, "ann", "ann"))).toMatch(/your own fleet/);
    expect(refusal(() => invite(book, "ann", "ghost"))).toMatch(/no such captain/);
    const both = found(book, "bob", "f2");
    expect(refusal(() => invite(both, "ann", "bob"))).toMatch(/already in a fleet/);
    expect(refusal(() => invite(invite(book, "ann", "cat"), "ann", "cat"))).toMatch(/already been invited/);
  });

  it("stops inviting once the fleet is full, and stops accepting too", () => {
    let book = pair();
    book = join(invite(book, "ann", "cat"), "cat", "f1");
    expect(membersOf(book, "f1")).toHaveLength(fleetCap(PLAYERS));
    expect(refusal(() => invite(book, "ann", "dan"))).toMatch(/at most 3/);

    // Two invitations out while there was one place left: the first to accept gets it.
    let race = pair();
    race = invite(invite(race, "ann", "cat"), "ann", "dan");
    race = join(race, "cat", "f1");
    expect(refusal(() => join(race, "dan", "f1"))).toMatch(/full/);
  });

  it("caps a four player season at one pair", () => {
    const book = invite(found(emptyBook(), "ann", "f1"), "ann", "bob", 1, 4);
    const pairUp = join(book, "bob", "f1", 1, 4);
    expect(refusal(() => invite(pairUp, "ann", "cat", 1, 4))).toMatch(/at most 2/);
  });

  it("drops every other invitation to a captain who joins a fleet", () => {
    let book = found(found(emptyBook(), "ann", "f1", "One"), "bob", "f2", "Two");
    book = invite(invite(book, "ann", "cat"), "bob", "cat");
    book = join(book, "cat", "f2");
    expect(book.invites).toEqual([]);
    expect(refusal(() => join(book, "cat", "f1"))).toMatch(/not there/);
  });

  it("refuses an accept with no invitation", () => {
    expect(refusal(() => join(found(emptyBook(), "ann", "f1"), "bob", "f1"))).toMatch(/not there/);
  });

  it("lets a captain decline, once", () => {
    const invited = invite(found(emptyBook(), "ann", "f1"), "ann", "bob");
    const book = declineInvite(invited, "bob", "f1");
    expect(book.invites).toEqual([]);
    expect(refusal(() => declineInvite(book, "bob", "f1"))).toMatch(/not there/);
  });

  it("does not let a member who is leaving invite anyone", () => {
    const leaving = leaveFleet(pair(), "ann", 4).book;
    expect(refusal(() => invite(leaving, "ann", "cat"))).toMatch(/leaving/);
  });
});

describe("leaving", () => {
  it("takes effect at the next Tide, so the captain is still a fleet mate until it opens", () => {
    const out = leaveFleet(pair(), "bob", 4);
    expect(out.kind).toBe("notice");
    if (out.kind !== "notice") return;
    expect(out.effectiveTide).toBe(5);
    expect(out.fleet.name).toBe("Red Tide");
    expect(out.book.members.find((m) => m.captainId === "bob")!.leavingAtTide).toBe(5);
    expect(fleetIds(out.book).get("bob")).toBe("f1");        // still sailing with the fleet this Tide
    expect(out.book.members.find((m) => m.captainId === "ann")!.leavingAtTide).toBeNull();
  });

  it("refuses a captain with no fleet and a second notice", () => {
    expect(refusal(() => leaveFleet(emptyBook(), "ann", 1))).toMatch(/not in a fleet/);
    const noticed = leaveFleet(pair(), "bob", 1).book;
    expect(refusal(() => leaveFleet(noticed, "bob", 1))).toMatch(/already given notice/);
  });

  it("disbands a fleet at once when the only member leaves", () => {
    const book = invite(found(emptyBook(), "ann", "f1"), "ann", "bob");
    const out = leaveFleet(book, "ann", 2);
    expect(out.kind).toBe("disbanded");
    expect(out.book).toEqual(emptyBook());
  });

  it("frees the captain when the next Tide opens, and keeps the rest of the fleet", () => {
    const trio = join(invite(pair(), "ann", "cat"), "cat", "f1");
    const noticed = leaveFleet(trio, "bob", 4).book;

    const stillThisTide = settleDepartures(noticed, 4);
    expect(stillThisTide.departed).toEqual([]);

    const opened = settleDepartures(noticed, 5);
    expect(opened.departed).toEqual(["bob"]);
    expect([...fleetIds(opened.book).keys()]).toEqual(["ann", "cat"]);
    expect(opened.book.fleets).toHaveLength(1);
  });

  it("removes a fleet whose members all left, with its invitations", () => {
    let book = invite(pair(), "ann", "cat");
    book = leaveFleet(leaveFleet(book, "ann", 4).book, "bob", 4).book;
    const opened = settleDepartures(book, 5);
    expect(opened.departed).toEqual(["ann", "bob"]);
    expect(opened.book).toEqual(emptyBook());
  });

  it("lets a departed captain found or join another fleet", () => {
    const opened = settleDepartures(leaveFleet(pair(), "bob", 1).book, 2).book;
    const again = found(opened, "bob", "f9", "Second Chance");
    expect(again.fleets.map((f) => f.name)).toEqual(["Red Tide", "Second Chance"]);
  });
});

describe("books", () => {
  it("come out in id order whatever order things happened in", () => {
    let book = found(emptyBook(), "ann", "fb", "Bravo");
    book = found(book, "bob", "fa", "Alpha");
    expect(book.fleets.map((f) => f.id)).toEqual(["fa", "fb"]);
    expect(book.members.map((m) => m.fleetId)).toEqual(["fa", "fb"]);
  });
});
