// What the client may send (section 15.4). Zod checks the shape of each payload first; the engine
// then checks it against the rules. The client never sends gold, positions, damage or times.

import { z } from "zod";
import { B } from "../engine/balance.ts";

const maneuver = z.enum(["broadside", "outmaneuver", "board"]);
const good = z.enum(["rum", "sugar", "spice"]);
const stat = z.enum(["hull", "cannons", "sails", "crew", "hold"]);
const id = z.string().min(1).max(64);
const [lowParley, highParley] = B.parley.thresholds;
const parley = z.union([z.literal("off"), z.literal(lowParley), z.literal(highParley)]);

export const submitOrdersSchema = z.strictObject({
  tide: z.number().int().min(1),
  /** Node ids. The engine checks the lanes and the speed. 12 is only a sanity limit on the payload. */
  course: z.array(id).max(12),
  intent: z.enum(["trade", "quiet", "hunt", "explore", "escort"]),
  huntFilter: z.union([z.enum(["merchants", "players", "anyone"]), z.strictObject({ captainId: id })]).optional(),
  escortCaptainId: id.optional(),
  plan: z.tuple([maneuver, maneuver, maneuver]),
  parley,
  noQuarter: z.boolean(),
  ready: z.boolean(),
});
export type SubmitOrdersPayload = z.infer<typeof submitOrdersSchema>;

const units = z.number().int().min(1).max(1000);

export const portActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("buy"), good, units }),
  z.strictObject({ action: z.literal("sell"), good, units }),
  z.strictObject({ action: z.literal("upgrade"), stat }),
  /** Omit `points` to repair as much as the Chest can pay for. */
  z.strictObject({ action: z.literal("repair"), points: z.number().positive().max(1000).optional() }),
  z.strictObject({ action: z.literal("shipwright"), amount: z.number().int().min(1).max(1_000_000) }),
]);
export type PortActionPayload = z.infer<typeof portActionSchema>;

export const adminSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("status") }),
  /** `tide` is the Tide the page shows, so a stale page cannot resolve a Tide that has moved on. */
  z.strictObject({ action: z.literal("resolve"), tide: z.number().int().min(1) }),
  /** Start a season now. `who` is everyone who has signed up, or only the caller (for trying things out). */
  z.strictObject({
    action: z.literal("start"),
    name: z.string().trim().min(1).max(60),
    preset: z.enum(["season0", "full"]),
    who: z.enum(["all", "me"]),
    /** The wall clock time Tides are due, such as "21:00". */
    tideTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  }),
]);
export type AdminPayload = z.infer<typeof adminSchema>;
