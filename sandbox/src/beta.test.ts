import { describe, expect, it } from "vitest";
import { replayHash } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Step } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { newTide, runTide, planProblems } from "./tideSetup.ts";

// The closed beta saves a plan as JSON and plays the sea of the shared Tide number (D250, D252). The sea must be the
// same for everyone on one Tide, and a plan read back from the database must play exactly as the plan that was saved.
const STEPS: Step[] = [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "anyone" } }, { kind: "dock" }];

describe("the beta Tide", () => {
  it("is the same sea for every player on one Tide number, and a different one on the next", () => {
    const a = newTide("gunline", 4), b = newTide("gunline", 4), c = newTide("gunline", 5);
    expect(JSON.stringify(a.botOrders)).toBe(JSON.stringify(b.botOrders));
    expect(JSON.stringify(a.winds)).toBe(JSON.stringify(b.winds));
    expect(JSON.stringify(a.botOrders)).not.toBe(JSON.stringify(c.botOrders) + JSON.stringify(c.winds));
  });

  it("plays a plan read back from JSON exactly like the plan that was saved", () => {
    const setup = newTide("rammer", 9);
    const stored = JSON.parse(JSON.stringify({ style: "rammer", steps: STEPS })) as { steps: Step[] };
    expect(planProblems(setup, { steps: stored.steps })).toEqual(planProblems(setup, { steps: STEPS }));
    expect(replayHash(runTide(setup, { steps: stored.steps }).replay)).toBe(replayHash(runTide(setup, { steps: STEPS }).replay));
  });
});
