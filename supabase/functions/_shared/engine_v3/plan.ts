// Voyage plans (GAMEPLAY 3.6): validation, step slots, Plan B and standing orders.

import { B } from "./balance.ts";
import { LEVEL } from "./types.ts";
import type { ArchipelagoId, Captain, Condition, HuntFilter, Orders, Ship, Step, VoyagePlan, WaterId, Wind } from "./types.ts";
import type { World } from "./map.ts";
import { levelOf } from "./knowledge.ts";
import { findRoute } from "./route.ts";
import { findDoctrine } from "./combat/doctrine.ts";

/** How many steps a captain's plan may have (3.6). */
export function stepSlots(captain: Captain): number {
  let n = B.plan.baseSteps;
  if (captain.skills.seamanship >= B.plan.seamanshipStepRank) n += 1;
  n += captain.perks.filter((p) => p === "navigator.step").length;
  return Math.min(B.plan.maxSteps, n);
}

function filterProblem(f: HuntFilter | undefined, label: string): string | null {
  if (!f) return `${label}: needs a filter`;
  if (!["anyone", "players", "npcs", "merchants", "carryingCargo", "captain"].includes(f.kind)) return `${label}: unknown filter ${String((f as { kind: unknown }).kind)}`;
  if (f.kind === "captain" && !f.captainId) return `${label}: a captain filter needs a captainId`;
  return null;
}

function conditionProblem(c: Condition | undefined, label: string): string | null {
  if (!c) return null;
  switch (c.kind) {
    case "shipInSight": return filterProblem(c.filter, label + " condition");
    case "watchesAtLeast": return Number.isInteger(c.n) && c.n >= 0 ? null : `${label}: watchesAtLeast needs a whole number`;
    case "hullBelow": return c.pct > 0 && c.pct <= 100 ? null : `${label}: hullBelow needs 1 to 100`;
    case "windIs": return ["calm", "breeze", "gale"].includes(c.wind) ? null : `${label}: unknown wind`;
    case "captainHere": return c.captainId ? null : `${label}: captainHere needs a captainId`;
    default: return `${label}: unknown condition ${String((c as { kind: unknown }).kind)}`;
  }
}

function doctrineProblem(captain: Captain, name: string | undefined, label: string): string | null {
  if (name === undefined) return null;
  return findDoctrine(captain, name) ? null : `${label}: you have no doctrine called ${String(name)}`;
}

/**
 * Checks a plan the way submit_orders will. Returns a list of problems; empty means valid.
 * The resolver also skips any step that is invalid at run time, so a bad step never crashes a Tide.
 */
export function validatePlan(w: World, captain: Captain, plan: VoyagePlan): string[] {
  const p: string[] = [];
  if (!plan || !Array.isArray(plan.steps)) return ["plan: needs a list of steps"];
  const slots = stepSlots(captain);
  const planDoctrine = doctrineProblem(captain, plan.doctrine, "plan");
  if (planDoctrine) p.push(planDoctrine);
  if (plan.steps.length > slots) p.push(`plan: ${plan.steps.length} steps, this captain may use ${slots}`);
  plan.steps.forEach((s: Step, i) => {
    const label = `step ${i + 1}`;
    const cp = conditionProblem(s.if, label);
    if (cp) p.push(cp);
    switch (s.kind) {
      case "sail": {
        if (!w.water[s.to]) p.push(`${label}: unknown water ${s.to}`);
        else if (levelOf(captain.knowledge, s.to) < LEVEL.rumoured) p.push(`${label}: you do not know ${s.to}`);
        if (s.stance && !["trade", "quiet", "hunt"].includes(s.stance)) p.push(`${label}: unknown stance ${s.stance}`);
        if (s.stance === "hunt") { const fp = filterProblem(s.filter, label); if (fp) p.push(fp); }
        if (s.route) for (const r of s.route) if (!w.water[r]) p.push(`${label}: route has unknown water ${r}`);
        { const dp = doctrineProblem(captain, s.doctrine, label); if (dp) p.push(dp); }
        break;
      }
      case "lurk": {
        const fp = filterProblem(s.filter, label);
        if (fp) p.push(fp);
        if (s.ambushRange !== undefined && s.ambushRange !== "long" && s.ambushRange !== "medium") p.push(`${label}: an ambush starts at long or medium range`);
        const dp = doctrineProblem(captain, s.doctrine, label);
        if (dp) p.push(dp);
        break;
      }
      case "land": {
        if (!w.site[s.site]) p.push(`${label}: unknown site ${s.site}`);
        else if (levelOf(captain.knowledge, s.site) < LEVEL.sketched) p.push(`${label}: you do not know ${s.site}`);
        break;
      }
      case "survey": case "dock": case "repair": break;
      default: p.push(`${label}: unknown step ${String((s as { kind: unknown }).kind)}`);
    }
  });
  return p;
}

/**
 * The nearest Harbour the captain knows (at least Sketched) that they can route to, by estimated Watches. Ties go to the
 * lower water id. Null when no known Harbour can be reached. Standing orders and towing both use it (D17, D75).
 */
export function nearestKnownHarbour(w: World, captain: Captain, ship: Ship, winds: Record<ArchipelagoId, Wind>): WaterId | null {
  let best: { water: WaterId; cost: number } | null = null;
  for (const id of w.waterIds) {
    if (w.water[id]?.terrain !== "harbour" || levelOf(captain.knowledge, id) < LEVEL.sketched) continue;
    const r = findRoute(w, captain.knowledge, ship.waterId, id, ship.hull, winds);
    if (r && (!best || r.estimate < best.cost)) best = { water: id, cost: r.estimate };
  }
  return best ? best.water : null;
}

/**
 * Standing orders when a captain gave none (3.6): docked ships stay docked; ships at sea sail to the
 * nearest known Harbour and Dock.
 */
export function standingPlan(w: World, captain: Captain, ship: Ship, winds: Record<ArchipelagoId, Wind>): VoyagePlan {
  if (ship.docked) return { steps: [] };
  const here = w.water[ship.waterId];
  if (here?.terrain === "harbour") return { steps: [{ kind: "dock" }] };
  const harbour = nearestKnownHarbour(w, captain, ship, winds);
  if (!harbour) return { steps: [] };
  return { steps: [{ kind: "sail", to: harbour, stance: "quiet" }, { kind: "dock" }] };
}

export type PlanSource = "orders" | "planB" | "standing";

/** Which plan a captain sails this Tide: fresh orders, else a carried Plan B, else standing orders. */
export function choosePlan(
  w: World, captain: Captain, ship: Ship, tide: number, orders: Orders | undefined, winds: Record<ArchipelagoId, Wind>,
): { plan: VoyagePlan; source: PlanSource } {
  if (orders && orders.tide === tide) return { plan: orders.planA, source: "orders" };
  if (captain.queuedPlan && captain.queuedPlan.tide === tide) return { plan: captain.queuedPlan.plan, source: "planB" };
  return { plan: standingPlan(w, captain, ship, winds), source: "standing" };
}
