// Section 4.4, rules 1 to 3: courses, steps and meetings.
// Encounters, escape rolls and battles (rules 4 to 6) are built on top of this on day 3.

import { B } from "./balance.ts";
import type { GameMap } from "./map.ts";

/** A ship on the move: where it is now and the hops it still has left. */
export interface Mover {
  id: string;
  nodeId: string;
  course: readonly string[];
}

export interface Meeting {
  step: number;
  kind: "same" | "swap";
  /** Where they met. For a swap, the lower node id of the lane they crossed. */
  nodeId: string;
  /** Only for a swap: the lane both ships used, node ids in sorted order. */
  lane?: [string, string];
  /** The two ship ids, in sorted order. */
  ships: [string, string];
}

export interface StepResult {
  step: number;
  ships: Mover[];          // positions after the step, sorted by ship id
  meetings: Meeting[];     // sorted by node id, then ship ids
}

const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Why a course is not allowed, or null if it is fine. Used by submit_orders and the client preview. */
export function courseError(map: GameMap, from: string, course: readonly string[], maxSpeed: number): string | null {
  if (course.length > maxSpeed) return `Course has ${course.length} hops but speed is ${maxSpeed}`;
  let here = from;
  for (const next of course) {
    if (!map.has(next)) return `Unknown node ${next}`;
    if (!map.adjacent(here, next)) return `No lane from ${here} to ${next}`;
    here = next;
  }
  return null;
}

/**
 * Move every ship that is not stopped one hop along its course, then find the meetings.
 * Ships in `stopped` stay where they are (they were in an encounter earlier in the Tide)
 * but can still be met by ships that arrive.
 */
export function advanceStep(
  map: GameMap, ships: readonly Mover[], step: number, stopped: ReadonlySet<string> = new Set(),
): StepResult {
  const sorted = [...ships].sort((a, b) => compareIds(a.id, b.id));
  const moved = new Set<string>();

  const after: Mover[] = sorted.map((ship) => {
    const next = ship.course[0];
    if (next === undefined || stopped.has(ship.id)) return ship;
    if (!map.adjacent(ship.nodeId, next)) {
      throw new Error(`Ship ${ship.id} cannot sail from ${ship.nodeId} to ${next}`);
    }
    moved.add(ship.id);
    return { id: ship.id, nodeId: next, course: ship.course.slice(1) };
  });

  const meetings: Meeting[] = [];
  for (let i = 0; i < after.length; i++) {
    for (let j = i + 1; j < after.length; j++) {
      const a = after[i]!, b = after[j]!;
      const ships: [string, string] = [a.id, b.id];
      if (a.nodeId === b.nodeId) {
        meetings.push({ step, kind: "same", nodeId: a.nodeId, ships });
      } else if (moved.has(a.id) && moved.has(b.id)
                 && sorted[i]!.nodeId === b.nodeId && sorted[j]!.nodeId === a.nodeId) {
        const lane = [a.nodeId, b.nodeId].sort(compareIds) as [string, string];
        meetings.push({ step, kind: "swap", nodeId: lane[0], lane, ships });
      }
    }
  }
  meetings.sort((x, y) => compareIds(x.nodeId, y.nodeId)
    || compareIds(x.ships[0], y.ships[0]) || compareIds(x.ships[1], y.ships[1]));

  return { step, ships: after, meetings };
}

/**
 * Play all the steps of a Tide with nobody stopping. Used for tests, previews and bots.
 * The real resolver calls advanceStep itself so it can stop ships that fight.
 */
export function simulateMovement(map: GameMap, ships: readonly Mover[]): StepResult[] {
  const results: StepResult[] = [];
  let current = ships;
  for (let step = 1; step <= B.movement.steps; step++) {
    if (current.every((s) => s.course.length === 0)) break;
    const result = advanceStep(map, current, step);
    results.push(result);
    current = result.ships;
  }
  return results;
}
