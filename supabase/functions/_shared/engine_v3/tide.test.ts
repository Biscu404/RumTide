import { describe, expect, it } from "vitest";
import { LEVEL, canonicalJson, levelOf, resolveTide, watchesFor } from "./index.ts";
import type { EncounterResolver, Orders, ReplayEvent } from "./index.ts";
import { kinds, run, season, ship, world } from "./testing.ts";

const o = (tide: number, steps: Orders["planA"]["steps"], planB?: Orders["planA"]["steps"]): Orders =>
  planB ? { tide, planA: { steps }, planB: { steps: planB } } : { tide, planA: { steps } };

const events = <K extends ReplayEvent["kind"]>(r: { replay: ReplayEvent[] }, kind: K) =>
  r.replay.filter((e): e is Extract<ReplayEvent, { kind: K }> => e.kind === kind);

describe("movement (P1.8)", () => {
  it("sails a route hop by hop, charting as it goes, and docks", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "dw_harbour" }]);
    const r = run(s, { a: o(6, [{ kind: "sail", to: "gh_harbour" }, { kind: "dock" }]) });
    const hops = events(r, "hop");
    expect(hops.map((h) => [h.from, h.to, h.cost, h.t])).toEqual([["dw_harbour", "gh_lee", 1, 0], ["gh_lee", "gh_harbour", 1, 1]]);
    expect(events(r, "dock")[0]?.t).toBe(3);
    expect(ship(r.state, "a")).toMatchObject({ waterId: "gh_harbour", docked: true });
    expect(r.state.tide).toBe(7);
  });

  it("stops a ship Becalmed Short when the true cost is more than it has left", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "tp_kelp" }]);
    ship(s, "a").shortRations = true; // 5 Watches
    // Kelp to Driftwood: the captain estimates 3 (kelp, current unknown); the truth is 4. With 5 Watches it still makes it.
    const r = run(s, { a: o(6, [{ kind: "sail", to: "dw_harbour" }]) });
    expect(events(r, "stop")).toEqual([]);
    expect(events(r, "hop")[0]?.cost).toBe(4);
    // Starting one hop further away, the same surprise strands the ship in the kelp.
    const s2 = season([{ id: "a", name: "A", shipName: "Gull", water: "tp_harbour" }]);
    ship(s2, "a").shortRations = true;
    const r2 = run(s2, { a: o(6, [{ kind: "sail", to: "tp_kelp" }, { kind: "sail", to: "dw_harbour" }]) });
    expect(events(r2, "stop")).toEqual([{ t: 2, kind: "stop", ship: "ship_a", water: "tp_kelp", reason: "becalmedShort", needed: 4, left: 3 }]);
    expect(ship(r2.state, "a").waterId).toBe("tp_kelp");
  });

  it("skips steps whose condition is false, and steps that make no sense here", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "gh_lee" }]);
    const r = run(s, { a: o(6, [
      { kind: "survey", if: { kind: "windIs", wind: "gale" } },
      { kind: "dock" },
      { kind: "land", site: "tarpot_town" },
    ]) });
    expect(events(r, "skip").map((e) => e.reason)).toEqual(["conditionFalse", "notAHarbour", "siteNotHere"]);
  });

  it("uses standing orders when a captain sends none", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "dw_shallows" }]);
    const r = run(s, {});
    expect(events(r, "plan")[0]?.source).toBe("standing");
    expect(ship(r.state, "a")).toMatchObject({ waterId: "dw_harbour", docked: true });
  });

  it("banks plunder when a ship docks", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "dw_shallows" }]);
    ship(s, "a").plunder = 75;
    const r = run(s, {});
    expect(r.state.captains.a!.chest).toBe(120 + 75);
    expect(ship(r.state, "a").plunder).toBe(0);
  });

  it("carries Plan B into the next Tide", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "gh_harbour" }]);
    const r = run(s, { a: o(6, [{ kind: "sail", to: "gh_lee" }], [{ kind: "sail", to: "dw_harbour" }]) });
    expect(r.state.captains.a!.queuedPlan?.tide).toBe(7);
    const r2 = resolveTide({ state: r.state, world, orders: {}, seed: 8, windOverride: { cradle: { kind: "breeze", from: 270 } } });
    expect(events(r2, "plan")[0]?.source).toBe("planB");
    expect(ship(r2.state, "a").waterId).toBe("dw_harbour");
    expect(r2.state.captains.a!.queuedPlan).toBeNull();
  });

  it("does not change the state it was given", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "dw_harbour" }]);
    const before = canonicalJson(s);
    run(s, { a: o(6, [{ kind: "sail", to: "gh_harbour" }]) });
    expect(canonicalJson(s)).toBe(before);
  });
});

describe("meetings and encounters (P1.8)", () => {
  it("catches a ship head on in a lane", () => {
    const s = season([
      { id: "a", name: "A", shipName: "Gull", water: "gh_lee" },
      { id: "b", name: "B", shipName: "Sock", water: "dw_harbour" },
    ]);
    ship(s, "b").hold.rum = 2;
    const r = run(s, {
      a: o(6, [{ kind: "sail", to: "dw_harbour", stance: "hunt", filter: { kind: "carryingCargo" } }]),
      b: o(6, [{ kind: "sail", to: "gh_harbour" }]),
    });
    expect(r.encounters).toEqual([{ t: 0.75, at: "ln_dw_gh", onLane: true, hunter: "ship_a", target: "ship_b", result: "battlePending" }]);
    // Both stop, back in the water each one left.
    expect(ship(r.state, "a").waterId).toBe("gh_lee");
    expect(ship(r.state, "b").waterId).toBe("dw_harbour");
  });

  it("lets ships pass without a fight when nobody is hunting", () => {
    const s = season([
      { id: "a", name: "A", shipName: "Gull", water: "gh_lee" },
      { id: "b", name: "B", shipName: "Sock", water: "dw_harbour" },
    ]);
    const r = run(s, { a: o(6, [{ kind: "sail", to: "dw_harbour" }]), b: o(6, [{ kind: "sail", to: "gh_harbour" }]) });
    expect(events(r, "meet")).toHaveLength(1);
    expect(r.encounters).toEqual([]);
    expect(ship(r.state, "b").waterId).toBe("gh_harbour");
  });

  it("springs a Lurk on a ship that sails into the water", () => {
    const s = season([
      { id: "d", name: "D", shipName: "Gannet", water: "gh_reefside" },
      { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" },
    ]);
    const r = run(s, { d: o(6, [{ kind: "lurk", filter: { kind: "players" } }]), e: o(6, [{ kind: "sail", to: "gh_reefside" }]) });
    expect(r.encounters).toMatchObject([{ t: 2, at: "gh_reefside", hunter: "ship_d", target: "ship_e" }]);
  });

  it("never fights in a Harbour", () => {
    const s = season([
      { id: "a", name: "A", shipName: "Gull", water: "gh_lee" },
      { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" },
    ]);
    const r = run(s, { a: o(6, [{ kind: "sail", to: "gh_harbour", stance: "hunt", filter: { kind: "anyone" } }]) });
    expect(events(r, "meet")).toHaveLength(1);
    expect(r.encounters).toEqual([]);
  });

  it("keeps the Harbour Mistress's Truce in the Cradle until Tide 5, for players only", () => {
    const lurker = { id: "d", name: "D", shipName: "Gannet", water: "gh_reefside" };
    const player = { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" };
    const merchant = { id: "m", name: "M", shipName: "Fat Purse", water: "gh_harbour", kind: "npc" as const, npcRole: "merchant" as const };
    const lurk = (tide: number) => o(tide, [{ kind: "lurk", filter: { kind: "anyone" } }]);
    const sail = (tide: number) => o(tide, [{ kind: "sail", to: "gh_reefside" }]);
    expect(run(season([lurker, player], 4), { d: lurk(4), e: sail(4) }).encounters).toEqual([]);
    expect(run(season([lurker, merchant], 4), { d: lurk(4), m: sail(4) }).encounters.map((e) => e.target)).toEqual(["ship_m"]);
    expect(run(season([lurker, player], 5), { d: lurk(5), e: sail(5) }).encounters.map((e) => e.target)).toEqual(["ship_e"]);
  });

  it("protects fleet mates and shielded captains", () => {
    const caps = [
      { id: "d", name: "D", shipName: "Gannet", water: "gh_reefside" },
      { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" },
    ];
    const orders = { d: o(6, [{ kind: "lurk", filter: { kind: "anyone" } }]), e: o(6, [{ kind: "sail", to: "gh_reefside" }]) };
    const fleet = season(caps);
    fleet.captains.d!.fleetId = "f1";
    fleet.captains.e!.fleetId = "f1";
    expect(run(fleet, orders).encounters).toEqual([]);
    const shielded = season(caps);
    shielded.captains.e!.shieldUntilTide = 6;
    expect(run(shielded, orders).encounters).toEqual([]);
  });

  it("hands encounters to the resolver it is given", () => {
    const s = season([
      { id: "d", name: "D", shipName: "Gannet", water: "gh_reefside" },
      { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" },
    ]);
    const escape: EncounterResolver = (ctx) => ({ result: `escaped from ${ctx.hunter.ship.name}`, freeze: [ctx.hunter.ship.id] });
    const r = resolveTide({
      state: s, world, seed: 1, windOverride: { cradle: { kind: "breeze", from: 270 } }, resolveEncounter: escape,
      orders: { d: o(6, [{ kind: "lurk", filter: { kind: "anyone" } }]), e: o(6, [{ kind: "sail", to: "gh_reefside" }, { kind: "sail", to: "gh_lee" }]) },
    });
    expect(r.encounters[0]?.result).toBe("escaped from Gannet");
    expect(ship(r.state, "e").waterId).toBe("gh_lee"); // it kept sailing
  });

  it("can only hunt what its filter matches", () => {
    const s = season([
      { id: "d", name: "D", shipName: "Gannet", water: "gh_reefside" },
      { id: "e", name: "E", shipName: "Widow", water: "gh_harbour" },
    ]);
    const r = run(s, { d: o(6, [{ kind: "lurk", filter: { kind: "merchants" } }]), e: o(6, [{ kind: "sail", to: "gh_reefside" }]) });
    expect(r.encounters).toEqual([]);
  });
});

describe("weather, supplies and knowledge in a Tide (P1.8)", () => {
  it("tears rigging in a gale", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "dw_harbour" }]);
    const r = run(s, { a: o(6, [{ kind: "sail", to: "gh_lee" }]) }, { wind: { cradle: { kind: "gale", from: 270 } } });
    expect(events(r, "galeDamage")).toHaveLength(1);
    expect(ship(r.state, "a").riggingPoints).toBe(95);
  });

  it("eats Provisions at sea, and Short Rations cost a Watch next Tide", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "gh_lee" }]);
    ship(s, "a").hold.provisions = 1;
    const r1 = run(s, {});
    // Standing orders dock it in Gullhaven: docked ships eat nothing.
    expect(ship(r1.state, "a").hold.provisions).toBe(1);
    const s2 = season([{ id: "a", name: "A", shipName: "Gull", water: "gh_lee" }]);
    ship(s2, "a").hold.provisions = 0;
    const r2 = run(s2, { a: o(6, [{ kind: "sail", to: "gh_reefside" }]) });
    expect(ship(r2.state, "a").shortRations).toBe(true);
    expect(watchesFor(ship(r2.state, "a"), r2.state.captains.a!).total).toBe(5);
  });

  it("finds a hidden passage on some seeds and not others, always the same way", () => {
    const tryHidden = (seed: number) => {
      const s = season([{ id: "a", name: "A", shipName: "Gull", water: "gh_reefside" }]);
      const r = run(s, { a: o(6, [{ kind: "survey" }]) }, { seed });
      return levelOf(r.state.captains.a!.knowledge, "ln_gh_reefside_wr_fog") >= LEVEL.sketched;
    };
    const results = Array.from({ length: 40 }, (_, i) => tryHidden(i + 1));
    expect(results.some(Boolean)).toBe(true);
    expect(results.some((x) => !x)).toBe(true);
    expect(Array.from({ length: 40 }, (_, i) => tryHidden(i + 1))).toEqual(results);
  });

  it("announces a fully charted island", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull", water: "tp_harbour" }]);
    const k = s.captains.a!.knowledge;
    for (const id of ["tp_harbour", "tp_channel", "ln_tp_harbour_channel", "ln_tp_channel_gh", "ln_tp_kelp_dw", "tarpot_town", "tarpot_tar_pits"]) k.levels[id] = 3;
    const r = run(s, { a: o(6, [{ kind: "sail", to: "tp_kelp" }]) });
    expect(events(r, "islandCharted")).toMatchObject([{ captain: "a", island: "tarpot_isle" }]);
  });

  it("emits a replay that starts and ends cleanly", () => {
    const s = season([{ id: "a", name: "A", shipName: "Gull" }]);
    const k = kinds(run(s, {}));
    expect(k[0]).toBe("tideStart");
    expect(k[k.length - 1]).toBe("tideEnd");
  });
});
