import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline.ts";

describe("Timeline", () => {
  it("runs events when the clock reaches them, in time order and then in the order added", () => {
    const tl = new Timeline();
    const seen: string[] = [];
    tl.at(300, () => seen.push("c"));
    tl.at(100, () => seen.push("a"));
    tl.at(100, () => seen.push("b"));
    tl.advance(99);
    expect(seen).toEqual([]);
    tl.advance(1);
    expect(seen).toEqual(["a", "b"]);
    tl.advance(500);
    expect(seen).toEqual(["a", "b", "c"]);
    expect(tl.clock).toBe(600);
  });

  it("runs an animation from the time its event ran, whatever the step size", () => {
    const run = (steps: number[]) => {
      const tl = new Timeline();
      const seen: number[] = [];
      tl.at(100, () => tl.anim(200, (p) => seen.push(p)));
      for (const s of steps) tl.advance(s);
      return seen;
    };
    // Stepping 50 at a time: the animation starts at 100 and ends at 300.
    expect(run([50, 50, 50, 50, 50, 50, 50]).filter((p) => p > 0 && p < 1)).toEqual([0.25, 0.5, 0.75]);
    expect(run([50, 50, 50, 50, 50, 50, 50]).at(-1)).toBe(1);
    // One huge step gives the same end: the animation is told it is finished, exactly once.
    expect(run([10_000]).filter((p) => p === 1)).toHaveLength(1);
  });

  it("lets an animation start another when it is done, in order", () => {
    const tl = new Timeline();
    const seen: string[] = [];
    tl.at(0, () => tl.anim(100, () => {}, () => { seen.push("first"); tl.at(150, () => seen.push("then")); }));
    tl.advance(5_000);
    expect(seen).toEqual(["first", "then"]);
  });

  it("schedules from the moment of the running event, not from where the clock has got to", () => {
    const tl = new Timeline();
    const seen: number[] = [];
    tl.at(100, () => tl.after(50, () => seen.push(tl.clock)));
    tl.advance(10_000);          // one big step: the follow up still belongs at 150, and still runs
    expect(seen).toEqual([0]);   // the clock itself only moves at the end of the step
    const ran: number[] = [];
    const b = new Timeline();
    b.at(100, () => b.after(50, () => b.anim(100, (p) => ran.push(p))));
    b.advance(175);
    expect(ran.at(-1)).toBe(0.25);   // started at 150, 25 of 100 ms done at 175
  });

  it("skips to the end and reports it is finished", () => {
    const tl = new Timeline();
    let fired = 0;
    for (let i = 0; i < 10; i++) tl.at(i * 1000, () => fired++);
    tl.end = 12_000;
    expect(tl.finished).toBe(false);
    tl.advance(tl.end - tl.clock);
    expect(fired).toBe(10);
    expect(tl.finished).toBe(true);
  });

  it("does not move backwards", () => {
    const tl = new Timeline();
    tl.advance(100);
    tl.advance(-50);
    expect(tl.clock).toBe(100);
  });
});
