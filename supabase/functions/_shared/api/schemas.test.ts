import { describe, expect, it } from "vitest";
import { B } from "../engine/balance.ts";
import { submitOrdersSchema } from "./schemas.ts";

const orders = (parley: unknown) => ({
  tide: 1, course: [], intent: "trade", plan: ["broadside", "board", "outmaneuver"],
  parley, noQuarter: false, ready: true,
});

describe("submitOrdersSchema parley", () => {
  it("accepts off and exactly the thresholds in balance.ts", () => {
    expect(submitOrdersSchema.safeParse(orders("off")).success).toBe(true);
    for (const t of B.parley.thresholds) expect(submitOrdersSchema.safeParse(orders(t)).success).toBe(true);
  });

  it("refuses any other multiplier", () => {
    expect(submitOrdersSchema.safeParse(orders(1.1)).success).toBe(false);
    expect(submitOrdersSchema.safeParse(orders(2)).success).toBe(false);
  });
});
