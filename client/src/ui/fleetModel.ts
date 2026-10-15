import { fleetCap } from "@engine/balance.ts";
import { FLAGS } from "@engine/fleet.ts";
import type { GameMap } from "@engine/map.ts";
import type { Fleet, Orders } from "@engine/types.ts";
import type { FleetsState } from "../net/fleets.ts";
import type { Me } from "../net/captain.ts";
import type { ShipMarker } from "../scenes/layout.ts";
import { draftFromOrders, sentence } from "./ordersModel.ts";

// What the Fleet screen shows, with no Preact in it so it can be tested. The server checks every
// fleet action again (fleet_action), so nothing here is trusted. It only saves a round trip.

export const FLAG_CHOICES: readonly { id: string; label: string }[] = FLAGS.map((id) => ({
  id, label: id[0]!.toUpperCase() + id.slice(1),
}));

export interface MemberView {
  captainId: string;
  shipName: string;
  isMe: boolean;
  /** The Tide this member's notice to leave runs out, or null. */
  leavingAtTide: number | null;
  /** Section 8.1: fleet mates see each other's orders. Null for yourself, whose orders are on the Orders tab. */
  orders: string | null;
  ready: boolean | null;
}

export interface MyFleetView {
  fleet: Fleet;
  members: MemberView[];
  cap: number;
  full: boolean;
  iAmLeaving: boolean;
  /** Captains this fleet has asked and is waiting on. */
  waitingOn: { captainId: string; shipName: string }[];
  /** Can I ask someone? A fleet with room, and not for a member who is leaving. */
  canInvite: boolean;
}

export interface InvitationView {
  fleet: Fleet;
  from: string;
  members: string[];
  full: boolean;
}

export interface OtherFleetView {
  fleet: Fleet;
  members: { shipName: string; leavingAtTide: number | null }[];
  full: boolean;
}

export interface FleetScreen {
  cap: number;
  mine: MyFleetView | null;
  /** Only while I am not in a fleet. */
  invitations: InvitationView[];
  others: OtherFleetView[];
  /** Captains with no fleet whom my fleet has not asked yet. Empty when I cannot invite. */
  invitable: { id: string; shipName: string }[];
  canFound: boolean;
}

/** Fleets keep their sail colour on the map: ships in a fleet get the fleet's colour. */
export function withFleetColours(ships: readonly ShipMarker[], fleets: readonly Fleet[]): ShipMarker[] {
  const colour = new Map(fleets.map((f) => [f.id, f.colour]));
  return ships.map((s) => {
    const sail = s.fleetId == null ? undefined : colour.get(s.fleetId);
    return sail === undefined ? s : { ...s, fleetColour: sail };
  });
}

export function fleetScreen(
  map: GameMap, me: Me, state: FleetsState, ships: readonly ShipMarker[],
): FleetScreen {
  const everyone = [{ id: me.captain.id, shipName: me.captain.shipName }, ...me.others];
  const nameOf = (id: string) => everyone.find((c) => c.id === id)?.shipName ?? "a captain";
  const players = everyone.length;
  const cap = fleetCap(players);
  const sizeOf = (fleetId: string) => state.members.filter((m) => m.fleetId === fleetId).length;

  const myMembership = state.members.find((m) => m.captainId === me.captain.id) ?? null;
  const myFleet = myMembership ? state.fleets.find((f) => f.id === myMembership.fleetId) ?? null : null;

  let mine: MyFleetView | null = null;
  if (myMembership && myFleet) {
    const iAmLeaving = myMembership.leavingAtTide !== null;
    const full = sizeOf(myFleet.id) >= cap;
    mine = {
      fleet: myFleet, cap, full, iAmLeaving,
      canInvite: !iAmLeaving && !full,
      members: state.members.filter((m) => m.fleetId === myFleet.id).map((m): MemberView => {
        const isMe = m.captainId === me.captain.id;
        const orders = isMe ? undefined : state.mateOrders.find((o) => o.captainId === m.captainId);
        return {
          captainId: m.captainId, shipName: nameOf(m.captainId), isMe, leavingAtTide: m.leavingAtTide,
          orders: isMe ? null : ordersLine(map, orders, ships.find((s) => s.captainId === m.captainId), everyone),
          ready: isMe ? null : orders?.ready ?? false,
        };
      }),
      waitingOn: state.invites.filter((i) => i.fleetId === myFleet.id)
        .map((i) => ({ captainId: i.captainId, shipName: nameOf(i.captainId) })),
    };
  }

  const invitations: InvitationView[] = myMembership ? [] : state.invites
    .filter((i) => i.captainId === me.captain.id)
    .flatMap((i) => {
      const fleet = state.fleets.find((f) => f.id === i.fleetId);
      if (!fleet) return [];
      return [{
        fleet, from: nameOf(i.invitedBy), full: sizeOf(fleet.id) >= cap,
        members: state.members.filter((m) => m.fleetId === fleet.id).map((m) => nameOf(m.captainId)),
      }];
    });

  const others: OtherFleetView[] = state.fleets
    .filter((f) => f.id !== myFleet?.id)
    .map((fleet) => ({
      fleet, full: sizeOf(fleet.id) >= cap,
      members: state.members.filter((m) => m.fleetId === fleet.id)
        .map((m) => ({ shipName: nameOf(m.captainId), leavingAtTide: m.leavingAtTide })),
    }));

  const inAFleet = new Set(state.members.map((m) => m.captainId));
  const asked = new Set(state.invites.filter((i) => i.fleetId === myFleet?.id).map((i) => i.captainId));
  const invitable = mine?.canInvite
    ? me.others.filter((o) => !inAFleet.has(o.id) && !asked.has(o.id)).map((o) => ({ id: o.id, shipName: o.shipName }))
    : [];

  return { cap, mine, invitations, others, invitable, canFound: myMembership === null };
}

/** A fleet mate's orders as one sentence, or why there is none yet. */
function ordersLine(
  map: GameMap, orders: Orders | undefined, ship: ShipMarker | undefined, everyone: { id: string; shipName: string }[],
): string {
  if (!orders) return "No orders yet. Their standing orders apply if they send none.";
  if (!ship) return "Orders sent.";
  return sentence(map, { ship, others: everyone }, draftFromOrders(orders, ship.nodeId));
}
