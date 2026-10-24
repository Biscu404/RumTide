import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import type { Captain } from "../types.ts";
import type { RoundView } from "./battle.ts";
import { runBattle } from "./battle.ts";
import {
  ABILITIES, DOCTRINE_SLOT_PERK, FALLBACK_PLAY, JETTISON_PLAY, NO_RULE, TEMPLATE_NAMES, conditionHolds, doctrineChooser,
  doctrineSlots, evaluateDoctrine, styleTemplate, templateDoctrine, templateDoctrines, validateDoctrine, validateDoctrines,
} from "./doctrine.ts";
import { FIGHTING_STYLES } from "../types.ts";
import type { AbilityRegistry, DoctrineContext, ValidateOptions } from "./doctrine.ts";
import { battleOf, deepFreeze, testShip } from "./testing.ts";
import type { BattleShip, Doctrine, DoctrineAction, DoctrineCondition, DoctrineRule, GunsOrder, HelmMove, Range } from "./types.ts";
import { RANGES } from "./types.ts";

const D = B.combat.doctrine;
const ctx: DoctrineContext = { enemyType: "player" };
const FAKE: AbilityRegistry = { "fake.flare": { id: "fake.flare", name: "Flare" }, "fake.smoke": { id: "fake.smoke", name: "Smoke" } };
const withFake: DoctrineContext = { enemyType: "player", abilities: FAKE };

const view = (over: Partial<RoundView> = {}, mine: Partial<BattleShip> = {}, theirs: Partial<BattleShip> = {}): RoundView => ({
  round: 1, side: "hunter", range: "long", terrain: "open", wind: "breeze", gauge: null,
  ships: { hunter: testShip("hunter", "sloop", mine), target: testShip("target", "sloop", theirs) },
  last: { hunter: null, target: null },
  jettisoned: { hunter: false, target: false },
  ...over,
});

const fight = (helm: HelmMove, guns: GunsOrder): DoctrineAction => ({ kind: "fight", helm, guns });
const rule = (conditions: DoctrineCondition[], then: DoctrineAction): DoctrineRule => ({ if: conditions, then });
const otherwise = (then: DoctrineAction = fight("hold", "roundShot")): DoctrineRule => ({ if: [], then });

describe("conditions (GAMEPLAY 8.8)", () => {
  const holds = (c: DoctrineCondition, v: RoundView = view(), side: "hunter" | "target" = "hunter", x: DoctrineContext = ctx) =>
    conditionHolds(c, v, side, x);

  it("range is, at least and at most read the range as a distance over the six: Far is farthest and Grappled is nearest (D69)", () => {
    const table: [Range, boolean, boolean, boolean][] = [
      // range, is Medium, at least Medium, at most Medium
      ["far", false, true, false],
      ["long", false, true, false],
      ["medium", true, true, true],
      ["short", false, false, true],
      ["close", false, false, true],
      ["grappled", false, false, true],
    ];
    for (const [range, is, atLeast, atMost] of table) {
      expect(holds({ kind: "range", op: "is", range: "medium" }, view({ range })), `${range} is`).toBe(is);
      expect(holds({ kind: "range", op: "atLeast", range: "medium" }, view({ range })), `${range} at least`).toBe(atLeast);
      expect(holds({ kind: "range", op: "atMost", range: "medium" }, view({ range })), `${range} at most`).toBe(atMost);
    }
    for (const range of RANGES) {
      expect(holds({ kind: "range", op: "atLeast", range: "grappled" }, view({ range }))).toBe(true); // any distance is at least none
      expect(holds({ kind: "range", op: "atMost", range: "far" }, view({ range }))).toBe(true);
    }
    expect(holds({ kind: "range", op: "atMost", range: "short" }, view({ range: "short" }))).toBe(true);
    expect(holds({ kind: "range", op: "atMost", range: "short" }, view({ range: "medium" }))).toBe(false);
    expect(holds({ kind: "range", op: "atLeast", range: "long" }, view({ range: "far" }))).toBe(true);
    expect(holds({ kind: "range", op: "is", range: "far" }, view({ range: "far" }))).toBe(true);
  });

  it("their style is X reads the enemy ship's Fighting Style, and is false against a ship with no style (D128)", () => {
    const rammer = view({}, {}, { style: "rammer" });
    expect(holds({ kind: "theirStyle", style: "rammer" }, rammer)).toBe(true);
    expect(holds({ kind: "theirStyle", style: "gunline" }, rammer)).toBe(false);
    expect(holds({ kind: "theirStyle", style: "rammer" }, view({}, { style: "rammer" }))).toBe(false); // my own style is not theirs
    expect(holds({ kind: "theirStyle", style: "bombardier" }, view({ side: "target" }, { style: "bombardier" }), "target")).toBe(true);
    for (const style of FIGHTING_STYLES) expect(holds({ kind: "theirStyle", style }, view()), style).toBe(false); // Old Shellback has none
  });

  it("round is N, or at least N", () => {
    expect(holds({ kind: "round", op: "is", n: 3 }, view({ round: 3 }))).toBe(true);
    expect(holds({ kind: "round", op: "is", n: 3 }, view({ round: 4 }))).toBe(false);
    expect(holds({ kind: "round", op: "atLeast", n: 3 }, view({ round: 2 }))).toBe(false);
    expect(holds({ kind: "round", op: "atLeast", n: 3 }, view({ round: 3 }))).toBe(true);
    expect(holds({ kind: "round", op: "atLeast", n: 3 }, view({ round: 5 }))).toBe(true);
  });

  it("my or their Hull, Rigging or Hands above or below a percent, strictly", () => {
    const v = view({}, { hullPoints: 30, riggingPoints: 60, hands: 15 }, { hullPoints: 90, riggingPoints: 10, hands: 30 });
    // mine: Hull 30%, Rigging 60%, Hands 50%. theirs: Hull 90%, Rigging 10%, Hands 100%.
    const t = (who: "mine" | "theirs", track: "hull" | "rigging" | "hands", op: "above" | "below", pct: number) =>
      holds({ kind: "track", who, track, op, pct }, v);
    expect(t("mine", "hull", "below", 31)).toBe(true);
    expect(t("mine", "hull", "below", 30)).toBe(false);
    expect(t("mine", "hull", "above", 30)).toBe(false);
    expect(t("mine", "hull", "above", 29)).toBe(true);
    expect(t("mine", "rigging", "above", 50)).toBe(true);
    expect(t("mine", "hands", "below", 50)).toBe(false);
    expect(t("mine", "hands", "below", 51)).toBe(true);
    expect(t("theirs", "hull", "above", 80)).toBe(true);
    expect(t("theirs", "rigging", "below", 20)).toBe(true);
    expect(t("theirs", "hands", "above", 99)).toBe(true);
    expect(t("theirs", "hands", "below", 100)).toBe(false);
  });

  it("judges the ship on the other side when the target is the one choosing", () => {
    const v = view({ side: "target" }, { hullPoints: 30 }, { hullPoints: 90 }); // mine and theirs are about the hunter and the target as set up
    expect(holds({ kind: "track", who: "mine", track: "hull", op: "above", pct: 80 }, v, "target")).toBe(true);
    expect(holds({ kind: "track", who: "theirs", track: "hull", op: "below", pct: 40 }, v, "target")).toBe(true);
  });

  it("treats a track the ship does not have as empty, so a monster has 0% Rigging (D70)", () => {
    const v = view({}, {}, { maxRiggingPoints: 0, riggingPoints: 0 });
    expect(holds({ kind: "track", who: "theirs", track: "rigging", op: "above", pct: 0 }, v)).toBe(false);
    expect(holds({ kind: "track", who: "theirs", track: "rigging", op: "below", pct: 30 }, v)).toBe(true);
  });

  it("their last Helm move or Guns order, false before round 1", () => {
    const v = view({ last: { hunter: null, target: { helm: "openRange", guns: "chainShot" } } });
    expect(holds({ kind: "theirLastHelm", move: "openRange" }, v)).toBe(true);
    expect(holds({ kind: "theirLastHelm", move: "hold" }, v)).toBe(false);
    expect(holds({ kind: "theirLastGuns", order: "chainShot" }, v)).toBe(true);
    expect(holds({ kind: "theirLastGuns", order: "roundShot" }, v)).toBe(false);
    expect(holds({ kind: "theirLastHelm", move: "openRange" }, view())).toBe(false);
    expect(holds({ kind: "theirLastGuns", order: "chainShot" }, view())).toBe(false);
    // The Deck orders are Guns orders for this condition: "their last Guns order was Repel" reads the Repel of a deck fight too.
    for (const order of ["charge", "volley", "repel", "firePots", "hotShot"] as const) {
      const played = view({ last: { hunter: null, target: { helm: "hold", guns: order } } });
      expect(holds({ kind: "theirLastGuns", order }, played), order).toBe(true);
      expect(holds({ kind: "theirLastGuns", order: "roundShot" }, played), order).toBe(false);
    }
    // The target reads the hunter's play, not its own.
    expect(holds({ kind: "theirLastHelm", move: "openRange" }, v, "target")).toBe(false);
  });

  it("enemy type comes from the context, and a named enemy captain from the enemy ship", () => {
    expect(holds({ kind: "enemyType", type: "player" })).toBe(true);
    expect(holds({ kind: "enemyType", type: "merchant" })).toBe(false);
    expect(holds({ kind: "enemyType", type: "merchant" }, view(), "hunter", { enemyType: "merchant" })).toBe(true);
    expect(holds({ kind: "enemyCaptain", captainId: "cap_target" })).toBe(true);
    expect(holds({ kind: "enemyCaptain", captainId: "cap_hunter" })).toBe(false);
    expect(holds({ kind: "enemyCaptain", captainId: "cap_hunter" }, view({ side: "target" }), "target")).toBe(true);
  });

  it("terrain, and the wind gauge as mine or theirs (nobody holds it in a Calm)", () => {
    expect(holds({ kind: "terrain", terrain: "reef" }, view({ terrain: "reef" }))).toBe(true);
    expect(holds({ kind: "terrain", terrain: "reef" }, view({ terrain: "fog" }))).toBe(false);
    const mine = view({ gauge: "hunter" });
    expect(holds({ kind: "windGauge", holder: "mine" }, mine)).toBe(true);
    expect(holds({ kind: "windGauge", holder: "theirs" }, mine)).toBe(false);
    expect(holds({ kind: "windGauge", holder: "mine" }, mine, "target")).toBe(false);
    expect(holds({ kind: "windGauge", holder: "theirs" }, mine, "target")).toBe(true);
    const calm = view({ gauge: null, wind: "calm" });
    expect(holds({ kind: "windGauge", holder: "mine" }, calm)).toBe(false);
    expect(holds({ kind: "windGauge", holder: "theirs" }, calm)).toBe(false);
  });

  it("I have Powder, and an ability is still unused", () => {
    expect(holds({ kind: "havePowder" })).toBe(true);
    expect(holds({ kind: "havePowder" }, view({}, { powder: 0 }))).toBe(false);
    expect(holds({ kind: "havePowder" }, view({}, { powder: 0 }, { powder: 9 }), "target")).toBe(true);
  });

  it("I have Fire Pots: a pot in my hold, whatever my Drill, and false for a ship that never carried any", () => {
    expect(holds({ kind: "haveFirePots" })).toBe(false);
    expect(holds({ kind: "haveFirePots" }, view({}, { firePots: 2 }))).toBe(true);
    expect(holds({ kind: "haveFirePots" }, view({}, { firePots: 0 }))).toBe(false);
    expect(holds({ kind: "haveFirePots" }, view({}, { firePots: 2 }, {}), "target")).toBe(false); // the target looks at its own hold
    expect(holds({ kind: "haveFirePots" }, view({}, {}, { firePots: 1 }), "target")).toBe(true);
    expect(holds({ kind: "abilityUnused", ability: "fake.flare" }, view({}, { abilities: ["fake.flare"] }))).toBe(true);
    expect(holds({ kind: "abilityUnused", ability: "fake.flare" }, view())).toBe(false);
    expect(holds({ kind: "abilityUnused", ability: "fake.flare" }, view({}, {}, { abilities: ["fake.flare"] }))).toBe(false);
  });

  it("an unknown condition is false rather than a crash", () => {
    expect(holds({ kind: "weather" } as unknown as DoctrineCondition)).toBe(false);
  });
});

describe("evaluating a doctrine (GAMEPLAY 8.3 step 1, 8.8)", () => {
  it("the first rule whose conditions hold gives the Helm move and Guns order", () => {
    const d: Doctrine = {
      name: "Top down",
      rules: [
        rule([{ kind: "range", op: "is", range: "close" }], fight("closeIn", "board")),
        rule([{ kind: "range", op: "is", range: "long" }], fight("closeIn", "chainShot")),
        rule([{ kind: "round", op: "atLeast", n: 1 }], fight("hold", "grapeshot")), // also true, but below the Long rule
        otherwise(),
      ],
    };
    expect(evaluateDoctrine(d, view({ range: "long" }), ctx)).toEqual({ kind: "fight", rule: 1, abilities: [], helm: "closeIn", guns: "chainShot" });
    expect(evaluateDoctrine(d, view({ range: "close" }), ctx)).toMatchObject({ rule: 0, helm: "closeIn", guns: "board" });
    expect(evaluateDoctrine(d, view({ range: "medium" }), ctx)).toMatchObject({ rule: 2, helm: "hold", guns: "grapeshot" });
  });

  it("a doctrine whose first rule never matches falls through to Otherwise", () => {
    const d: Doctrine = { name: "Dud", rules: [rule([{ kind: "round", op: "is", n: 9 }], fight("closeIn", "board")), otherwise(fight("openRange", "chainShot"))] };
    expect(evaluateDoctrine(d, view(), ctx)).toEqual({ kind: "fight", rule: 1, abilities: [], helm: "openRange", guns: "chainShot" });
  });

  it("a rule with two conditions needs both", () => {
    const d: Doctrine = {
      name: "Both",
      rules: [rule([{ kind: "range", op: "is", range: "long" }, { kind: "round", op: "is", n: 2 }], fight("closeIn", "board")), otherwise()],
    };
    expect(evaluateDoctrine(d, view({ range: "long", round: 1 }), ctx).rule).toBe(1);
    expect(evaluateDoctrine(d, view({ range: "medium", round: 2 }), ctx).rule).toBe(1);
    expect(evaluateDoctrine(d, view({ range: "long", round: 2 }), ctx).rule).toBe(0);
  });

  it("Surrender strikes the colours and records the rule", () => {
    const d: Doctrine = { name: "Coward", rules: [rule([{ kind: "track", who: "mine", track: "hull", op: "below", pct: 50 }], { kind: "surrender" }), otherwise()] };
    expect(evaluateDoctrine(d, view({}, { hullPoints: 49 }), ctx)).toEqual({ kind: "surrender", rule: 0, abilities: [] });
    expect(evaluateDoctrine(d, view({}, { hullPoints: 50 }), ctx).kind).toBe("fight");
  });

  it("Jettison throws the cargo over and plays Hold and Hold Fire, once (D65)", () => {
    const d: Doctrine = { name: "Dump", rules: [rule([{ kind: "round", op: "atLeast", n: 1 }], { kind: "jettison" }), otherwise(fight("closeIn", "roundShot"))] };
    expect(evaluateDoctrine(d, view(), ctx)).toEqual({ kind: "fight", rule: 0, abilities: [], ...JETTISON_PLAY, jettison: true });
    expect(JETTISON_PLAY).toEqual({ helm: "hold", guns: "holdFire" });
    // Once the cargo is gone the rule is spent, and the doctrine plays the rules below it.
    const again = evaluateDoctrine(d, view({ jettisoned: { hunter: true, target: false } }), ctx);
    expect(again).toEqual({ kind: "fight", rule: 1, abilities: [], helm: "closeIn", guns: "roundShot" });
    // The other ship's cargo is its own business.
    expect(evaluateDoctrine(d, view({ jettisoned: { hunter: false, target: true } }), ctx)).toMatchObject({ rule: 0, jettison: true });
  });

  it("plays a plain fallback and says so when no rule gives a play (D68)", () => {
    const noOtherwise: Doctrine = { name: "Open", rules: [rule([{ kind: "round", op: "is", n: 4 }], fight("closeIn", "board"))] };
    expect(evaluateDoctrine(noOtherwise, view(), ctx)).toEqual({ kind: "fight", rule: NO_RULE, abilities: [], ...FALLBACK_PLAY });
    expect(NO_RULE).toBe(-1);
    expect(evaluateDoctrine({ name: "Empty", rules: [] }, view(), ctx).rule).toBe(NO_RULE);
    const endsInAbility: Doctrine = { name: "Slot", rules: [{ if: [], then: { kind: "ability", ability: "fake.flare" } }] };
    expect(evaluateDoctrine(endsInAbility, view({}, { abilities: ["fake.flare"] }), withFake)).toEqual({
      kind: "fight", rule: NO_RULE, abilities: [{ rule: 0, ability: "fake.flare" }], ...FALLBACK_PLAY,
    });
  });

  it("never crashes on a doctrine that is not shaped right", () => {
    const junk = { name: "Junk", rules: [null, { if: "x", then: { kind: "dance" } }, { if: [{ kind: "round", op: "is", n: 1 }] }] } as unknown as Doctrine;
    expect(evaluateDoctrine(junk, view(), ctx).rule).toBe(NO_RULE);
    expect(evaluateDoctrine(undefined as unknown as Doctrine, view(), ctx).rule).toBe(NO_RULE);
  });

  it("does not change the view it is given, and gives the same answer for the same view", () => {
    const d = templateDoctrine("Skirmisher");
    const v = deepFreeze(view({ last: { hunter: null, target: { helm: "openRange", guns: "roundShot" } } }));
    const a = evaluateDoctrine(deepFreeze(d), v, ctx);
    expect(evaluateDoctrine(d, v, ctx)).toEqual(a);
  });
});

describe("the ability slot (GAMEPLAY 8.3 step 2, 8.8), with a fake ability", () => {
  const flare = (extra: DoctrineRule[] = []): Doctrine => ({
    name: "Flare",
    rules: [
      rule([{ kind: "round", op: "atLeast", n: 2 }, { kind: "abilityUnused", ability: "fake.flare" }], { kind: "ability", ability: "fake.flare" }),
      ...extra,
      rule([{ kind: "range", op: "is", range: "long" }], fight("closeIn", "chainShot")),
      otherwise(fight("crossTheirBow", "roundShot")),
    ],
  });
  const armed = { abilities: ["fake.flare"] };

  it("an ability rule fires its ability and evaluation continues below it for the Helm move and Guns order", () => {
    expect(evaluateDoctrine(flare(), view({ round: 2, range: "long" }, armed), withFake)).toEqual({
      kind: "fight", rule: 1, abilities: [{ rule: 0, ability: "fake.flare" }], helm: "closeIn", guns: "chainShot",
    });
    expect(evaluateDoctrine(flare(), view({ round: 2, range: "close" }, armed), withFake)).toEqual({
      kind: "fight", rule: 2, abilities: [{ rule: 0, ability: "fake.flare" }], helm: "crossTheirBow", guns: "roundShot",
    });
  });

  it("an ability rule whose conditions fail does not fire", () => {
    expect(evaluateDoctrine(flare(), view({ round: 1, range: "long" }, armed), withFake)).toEqual({
      kind: "fight", rule: 1, abilities: [], helm: "closeIn", guns: "chainShot",
    });
  });

  it("does not fire an ability the ship has used up or never had", () => {
    const noUnusedCheck: Doctrine = { name: "Always", rules: [rule([], { kind: "ability", ability: "fake.flare" }), otherwise()] };
    expect(evaluateDoctrine(noUnusedCheck, view({}, {}), withFake).abilities).toEqual([]); // the ship does not carry it
    expect(evaluateDoctrine(noUnusedCheck, view({}, armed), withFake).abilities).toEqual([{ rule: 0, ability: "fake.flare" }]);
  });

  it("does not fire an ability that is not registered, and the registry holds none yet", () => {
    expect(Object.keys(ABILITIES)).toEqual([]);
    expect(Object.isFrozen(ABILITIES)).toBe(true);
    expect(evaluateDoctrine(flare(), view({ round: 2, range: "long" }, armed), ctx).abilities).toEqual([]);
    expect(evaluateDoctrine(flare(), view({ round: 2, range: "long" }, armed), { enemyType: "player", abilities: { "fake.smoke": FAKE["fake.smoke"]! } }).abilities).toEqual([]);
  });

  it("several ability rules fire in order, and one ability fires once a round", () => {
    const two: Doctrine = {
      name: "Two",
      rules: [
        rule([], { kind: "ability", ability: "fake.smoke" }),
        rule([], { kind: "ability", ability: "fake.flare" }),
        rule([], { kind: "ability", ability: "fake.flare" }),
        otherwise(),
      ],
    };
    const r = evaluateDoctrine(two, view({}, { abilities: ["fake.flare", "fake.smoke"] }), withFake);
    expect(r.abilities).toEqual([{ rule: 0, ability: "fake.smoke" }, { rule: 1, ability: "fake.flare" }]);
    expect(r).toMatchObject({ kind: "fight", rule: 3 });
  });

  it("an ability fires even when the rule below it surrenders, and not when a rule above it already gave the play", () => {
    const d: Doctrine = { name: "Last words", rules: [rule([], { kind: "ability", ability: "fake.flare" }), rule([], { kind: "surrender" })] };
    expect(evaluateDoctrine(d, view({}, armed), withFake)).toEqual({ kind: "surrender", rule: 1, abilities: [{ rule: 0, ability: "fake.flare" }] });
    const early: Doctrine = { name: "Early", rules: [rule([{ kind: "range", op: "is", range: "long" }], fight("hold", "holdFire")), rule([], { kind: "ability", ability: "fake.flare" }), otherwise()] };
    expect(evaluateDoctrine(early, view({}, armed), withFake)).toMatchObject({ rule: 0, abilities: [] });
  });

  it("in a battle the ability fires once, is recorded in the replay and is used up", () => {
    const d: Doctrine = { name: "Flare once", rules: [flare().rules[0]!, otherwise(fight("hold", "holdFire"))] };
    const one = (over: Partial<BattleShip>) => runBattle(battleOf(
      testShip("hunter", "sloop", over), testShip("target"),
      { hunter: doctrineChooser(d, withFake), target: doctrineChooser({ name: "Idle", rules: [otherwise(fight("hold", "holdFire"))] }, ctx) },
    ));
    const r = one(armed);
    const fired = r.rounds.map((round) => round.ships[0]!.abilities);
    expect(fired).toEqual([[], [{ rule: 0, ability: "fake.flare" }], [], [], []]); // round 2 only; later rounds see it used
    expect(r.ships[0]!.abilities).toEqual(["fake.flare"]);
    expect(r.final[0]!.abilities).toEqual([]);
    // The same ship without the ability never fires it.
    expect(one({}).rounds.flatMap((round) => round.ships[0]!.abilities)).toEqual([]);
  });
});

describe("slots (GAMEPLAY 8.8, D64)", () => {
  const captain = (command: number, perks: string[] = []): Pick<Captain, "skills" | "perks"> => ({ skills: { seamanship: 0, command, cunning: 0 }, perks });

  it("starts at 3, gains one at Command ranks 1 and 4, and one for each slot perk", () => {
    expect(D.baseSlots).toBe(3);
    expect([0, 1, 2, 3, 4, 5].map((c) => doctrineSlots(captain(c)))).toEqual([3, 4, 4, 4, 5, 5]);
    expect(doctrineSlots(captain(0, [DOCTRINE_SLOT_PERK]))).toBe(4); // a Helmsman, or the Navy Deserter
    expect(doctrineSlots(captain(0, [DOCTRINE_SLOT_PERK, DOCTRINE_SLOT_PERK]))).toBe(5);
    expect(doctrineSlots(captain(0, ["navigator.step", "lookout"]))).toBe(3);
  });

  it("never goes past the cap of 7", () => {
    expect(doctrineSlots(captain(5, [DOCTRINE_SLOT_PERK, DOCTRINE_SLOT_PERK]))).toBe(7);
    expect(doctrineSlots(captain(5, Array(6).fill(DOCTRINE_SLOT_PERK)))).toBe(D.maxSlots);
    expect(D.maxSlots).toBe(7);
  });
});

describe("validation", () => {
  const ok: ValidateOptions = { slots: 3 };
  const good = (): Doctrine => ({ name: "Good", rules: [rule([{ kind: "range", op: "is", range: "close" }], fight("closeIn", "board")), otherwise()] });
  const problems = (d: unknown, opts = ok) => validateDoctrine(d as Doctrine, opts);

  it("accepts a sound doctrine", () => {
    expect(problems(good())).toEqual([]);
  });

  it("accepts the Boarders example of GAMEPLAY 8.8 with the slots it needs, once the ability is registered", () => {
    const boarders: Doctrine = {
      name: "Boarders",
      rules: [
        rule([{ kind: "track", who: "theirs", track: "hull", op: "below", pct: 30 }], fight("closeIn", "board")),
        rule([{ kind: "range", op: "is", range: "long" }], fight("closeIn", "chainShot")),
        rule([{ kind: "enemyType", type: "merchant" }], fight("closeIn", "grapeshot")),
        rule([{ kind: "round", op: "is", n: 3 }, { kind: "abilityUnused", ability: "fake.flare" }], { kind: "ability", ability: "fake.flare" }),
        otherwise(fight("crossTheirBow", "roundShot")),
      ],
    };
    expect(problems(boarders, { slots: 3 })).toEqual(["doctrine: 4 rules with conditions, this captain has 3 slots", "rule 4: unknown ability fake.flare", "rule 4: unknown ability fake.flare"]);
    expect(problems(boarders, { slots: 4 })).toEqual(["rule 4: unknown ability fake.flare", "rule 4: unknown ability fake.flare"]);
    expect(validateDoctrine(boarders, { slots: 4, abilities: FAKE })).toEqual([]);
  });

  it("the Otherwise rule is free: a captain with 3 slots may have 3 rules and Otherwise, not 4", () => {
    const rules = (n: number): DoctrineRule[] => [...Array.from({ length: n }, (_, i) => rule([{ kind: "round", op: "is", n: i + 1 }], fight("hold", "roundShot"))), otherwise()];
    expect(problems({ name: "Three", rules: rules(3) })).toEqual([]);
    expect(problems({ name: "Four", rules: rules(4) })).toEqual(["doctrine: 4 rules with conditions, this captain has 3 slots"]);
    expect(problems({ name: "Four", rules: rules(4) }, { slots: 4 })).toEqual([]);
    expect(problems({ name: "Just Otherwise", rules: rules(0) })).toEqual([]);
  });

  it("needs a name and at least the Otherwise rule", () => {
    expect(problems({ ...good(), name: "  " })).toEqual(["doctrine: needs a name"]);
    expect(problems({ ...good(), name: 4 })).toEqual(["doctrine: needs a name"]);
    expect(problems({ name: "Bare", rules: [] })).toEqual(["doctrine: needs at least the Otherwise rule"]);
    expect(problems({ name: "Bare" })).toEqual(["doctrine: needs at least the Otherwise rule"]);
    expect(problems(null)).toEqual(["doctrine: needs a name and a list of rules"]);
  });

  it("only the last rule has no conditions, and it has none", () => {
    expect(problems({ name: "A", rules: [rule([], fight("hold", "roundShot")), otherwise()] })).toEqual(["rule 1: only the last rule may have no conditions"]);
    expect(problems({ name: "B", rules: [rule([{ kind: "havePowder" }], fight("hold", "roundShot"))] })).toEqual(["Otherwise: the last rule has no conditions"]);
  });

  it("allows at most two conditions on a rule", () => {
    const three = rule([{ kind: "havePowder" }, { kind: "round", op: "is", n: 1 }, { kind: "terrain", terrain: "open" }], fight("hold", "roundShot"));
    expect(problems({ name: "C", rules: [three, otherwise()] })).toEqual(["rule 1: 3 conditions, the most is 2"]);
  });

  it("the last rule must give a play: Fight or Surrender, not an ability or Jettison", () => {
    expect(problems({ name: "D", rules: [otherwise({ kind: "surrender" })] })).toEqual([]);
    expect(problems({ name: "E", rules: [otherwise({ kind: "jettison" })] })).toEqual(["Otherwise: the last rule must give a Helm move and a Guns order, or Surrender"]);
    expect(problems({ name: "F", rules: [otherwise({ kind: "ability", ability: "fake.flare" })] }, { slots: 3, abilities: FAKE })).toEqual([
      "Otherwise: the last rule must give a Helm move and a Guns order, or Surrender",
    ]);
  });

  it("rejects unknown moves, orders and actions", () => {
    expect(problems({ name: "G", rules: [otherwise({ kind: "fight", helm: "ram", guns: "roundShot" } as unknown as DoctrineAction)] })).toEqual(["Otherwise: unknown Helm move ram"]);
    expect(problems({ name: "H", rules: [otherwise({ kind: "fight", helm: "hold", guns: "cannonball" } as unknown as DoctrineAction)] })).toEqual(["Otherwise: unknown Guns order cannonball"]);
    expect(problems({ name: "I", rules: [otherwise({ kind: "dance" } as unknown as DoctrineAction)] })).toEqual(["Otherwise: unknown action dance"]);
  });

  it("rejects badly formed conditions", () => {
    const bad = (c: unknown) => problems({ name: "J", rules: [rule([c as DoctrineCondition], fight("hold", "roundShot")), otherwise()] });
    expect(bad({ kind: "range", op: "is", range: "horizon" })).toEqual(["rule 1: unknown range horizon"]);
    expect(bad({ kind: "theirStyle", style: "pirate" })).toEqual(["rule 1: unknown Fighting Style pirate"]);
    expect(bad({ kind: "theirStyle" })).toEqual(["rule 1: unknown Fighting Style undefined"]);
    expect(bad({ kind: "range", op: "near", range: "close" })).toEqual(["rule 1: unknown range test near"]);
    expect(bad({ kind: "round", op: "is", n: 0 })).toEqual([`rule 1: the round must be a whole number from 1 to ${B.combat.rounds}`]);
    expect(bad({ kind: "round", op: "atLeast", n: B.combat.rounds + 1 })).toHaveLength(1);
    expect(bad({ kind: "round", op: "atLeast", n: 2.5 })).toHaveLength(1);
    expect(bad({ kind: "round", op: "above", n: 2 })).toEqual(["rule 1: unknown round test above"]);
    expect(bad({ kind: "track", who: "mine", track: "hull", op: "below", pct: 101 })).toEqual(["rule 1: the percent must be from 0 to 100"]);
    expect(bad({ kind: "track", who: "mine", track: "hull", op: "below", pct: -1 })).toHaveLength(1);
    expect(bad({ kind: "track", who: "mine", track: "hull", op: "below", pct: Number.NaN })).toHaveLength(1);
    expect(bad({ kind: "track", who: "yours", track: "hull", op: "below", pct: 5 })).toHaveLength(1);
    expect(bad({ kind: "track", who: "mine", track: "powder", op: "below", pct: 5 })).toEqual(["rule 1: unknown track powder"]);
    expect(bad({ kind: "track", who: "mine", track: "hull", op: "equal", pct: 5 })).toHaveLength(1);
    expect(bad({ kind: "theirLastHelm", move: "ram" })).toEqual(["rule 1: unknown Helm move ram"]);
    expect(bad({ kind: "theirLastGuns", order: "ram" })).toEqual(["rule 1: unknown Guns order ram"]);
    expect(bad({ kind: "theirLastGuns", order: "fists" })).toEqual(["rule 1: unknown Guns order fists"]); // Fists is never a choice
    expect(bad({ kind: "haveFirePots" })).toEqual([]);
    expect(bad({ kind: "enemyType", type: "kraken" })).toEqual(["rule 1: unknown enemy type kraken"]);
    expect(bad({ kind: "enemyCaptain", captainId: "" })).toHaveLength(1);
    expect(bad({ kind: "terrain", terrain: "lava" })).toEqual(["rule 1: unknown terrain lava"]);
    expect(bad({ kind: "windGauge", holder: "nobody" })).toHaveLength(1);
    expect(bad({ kind: "weather" })).toEqual(["rule 1: unknown condition weather"]);
    expect(bad(null)).toEqual(["rule 1: unknown condition undefined"]);
  });

  it("accepts every valid condition", () => {
    const conditions: DoctrineCondition[] = [
      { kind: "range", op: "atLeast", range: "grappled" }, { kind: "round", op: "atLeast", n: B.combat.rounds },
      { kind: "track", who: "theirs", track: "hands", op: "above", pct: 0 }, { kind: "track", who: "mine", track: "rigging", op: "below", pct: 100 },
      { kind: "theirLastHelm", move: "crossTheirBow" }, { kind: "theirLastGuns", order: "repel" }, { kind: "enemyType", type: "brethren" },
      { kind: "enemyCaptain", captainId: "cap_x" }, { kind: "terrain", terrain: "strongCurrent" }, { kind: "windGauge", holder: "theirs" },
      { kind: "havePowder" }, { kind: "haveFirePots" }, { kind: "abilityUnused", ability: "fake.flare" },
      { kind: "range", op: "is", range: "far" }, { kind: "range", op: "atMost", range: "short" }, { kind: "theirLastGuns", order: "mortar" },
      ...FIGHTING_STYLES.map((style): DoctrineCondition => ({ kind: "theirStyle", style })),
    ];
    for (const c of conditions) expect(validateDoctrine({ name: "K", rules: [rule([c], fight("hold", "roundShot")), otherwise()] }, { slots: 3, abilities: FAKE })).toEqual([]);
  });

  it("accepts the Mortar in any captain's doctrine, because a copied doctrine always plays (it fires Round shot without the style)", () => {
    expect(validateDoctrine({ name: "Copied", rules: [otherwise(fight("hold", "mortar"))] }, { slots: 3 })).toEqual([]);
  });

  it("names the rule number the way the screen counts them", () => {
    const d: Doctrine = { name: "L", rules: [rule([{ kind: "havePowder" }], fight("hold", "roundShot")), rule([{ kind: "terrain", terrain: "lava" as never }], fight("hold", "roundShot")), otherwise()] };
    expect(problems(d)).toEqual(["rule 2: unknown terrain lava"]);
  });

  it("a captain keeps at most 3 doctrines with different names", () => {
    const named = (name: string): Doctrine => ({ ...good(), name });
    expect(validateDoctrines([named("A"), named("B"), named("C")], ok)).toEqual([]);
    expect(D.savedDoctrines).toBe(3);
    expect(validateDoctrines([named("A"), named("B"), named("C"), named("D")], ok)).toEqual(["doctrines: 4 saved, a captain may keep 3"]);
    expect(validateDoctrines([named("Boarders"), named(" boarders ")], ok)).toEqual(["doctrines: two are called  boarders "]);
    expect(validateDoctrines([named("A"), { name: "B", rules: [] }], ok)).toEqual(["B: doctrine: needs at least the Otherwise rule"]);
    expect(validateDoctrines("no" as unknown as Doctrine[], ok)).toEqual(["doctrines: needs a list"]);
  });
});

describe("the templates (GAMEPLAY 8.8, Fighting Styles spec section 6)", () => {
  it("are the Bombardier, Gunline, Skirmisher, Rammer, Boarder, Firebrand and Smuggler, and each is valid for a captain with the base slots", () => {
    expect([...TEMPLATE_NAMES]).toEqual(["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand", "Smuggler"]);
    expect([...TEMPLATE_NAMES]).not.toContain("Brawler"); // the Brawler split into the Rammer and the Boarder (D123)
    expect(templateDoctrines().map((d) => d.name)).toEqual([...TEMPLATE_NAMES]);
    for (const name of TEMPLATE_NAMES) {
      const d = templateDoctrine(name);
      expect(d.name).toBe(name);
      expect(validateDoctrine(d, { slots: D.baseSlots }), name).toEqual([]);
      expect(d.rules.length - 1, `${name} rules with conditions`).toBeLessThanOrEqual(D.baseSlots);
      expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    }
    expect(validateDoctrines(templateDoctrines().slice(0, D.savedDoctrines), { slots: D.baseSlots })).toEqual([]);
  });

  it("hand out fresh copies, so editing one captain's doctrine changes nobody else's", () => {
    const a = templateDoctrine("Boarder");
    const b = templateDoctrine("Boarder");
    a.name = "Mine";
    a.rules.pop();
    expect(b).toEqual(templateDoctrine("Boarder"));
    expect(templateDoctrines()[TEMPLATE_NAMES.indexOf("Boarder")]).toEqual(templateDoctrine("Boarder"));
    // Even a deep edit of one copy, inside a rule that several templates have, leaves every other template whole.
    const pristine = structuredClone(templateDoctrines());
    for (const mine of templateDoctrines()) {
      for (const r of mine.rules) {
        r.if.pop();
        if (r.then.kind === "fight") r.then.helm = "hold";
      }
    }
    expect(templateDoctrines()).toEqual(pristine);
  });

  it("use only the thresholds in balance.ts", () => {
    expect(D).not.toHaveProperty("templates"); // the Brawler's Hands threshold went with the Brawler
    expect(templateDoctrine("Smuggler").rules[0]!.if[0]).toMatchObject({ who: "mine", track: "hull", pct: B.styles.smuggler.strikeHullPct });
    expect(B.styles.smuggler.strikeHullPct).toBe(40);
  });

  it("are the template each Fighting Style gives, and a captain with no style starts with the Boarder, the Brawler's successor", () => {
    expect(FIGHTING_STYLES.map(styleTemplate)).toEqual(["Bombardier", "Gunline", "Skirmisher", "Rammer", "Boarder", "Firebrand", "Smuggler"]);
    expect(styleTemplate(undefined)).toBe("Boarder");
  });

  const play = (name: Parameters<typeof templateDoctrine>[0], v: RoundView) => evaluateDoctrine(templateDoctrine(name), v, ctx);
  const at = (name: Parameters<typeof templateDoctrine>[0], range: Range) => {
    const c = play(name, view({ range }));
    return c.kind === "fight" ? [c.rule, c.helm, c.guns] : [c.rule, "surrender"];
  };

  it("Bombardier shells with the Mortar from Long and Far, turns away at Medium, and runs with Round shot when they come near", () => {
    expect(at("Bombardier", "far")).toEqual([3, "hold", "mortar"]);
    expect(at("Bombardier", "long")).toEqual([3, "hold", "mortar"]);
    expect(at("Bombardier", "medium")).toEqual([2, "openRange", "mortar"]);
    expect(at("Bombardier", "short")).toEqual([1, "openRange", "roundShot"]);
    expect(at("Bombardier", "close")).toEqual([1, "openRange", "roundShot"]);
    expect(at("Bombardier", "grappled")).toEqual([0, "openRange", "repel"]);
  });

  it("Gunline closes from Long and Far, holds with Round shot at Medium and Short, and with Grapeshot at Close", () => {
    expect(at("Gunline", "far")).toEqual([2, "closeIn", "roundShot"]);
    expect(at("Gunline", "long")).toEqual([2, "closeIn", "roundShot"]);
    expect(at("Gunline", "medium")).toEqual([3, "hold", "roundShot"]);
    expect(at("Gunline", "short")).toEqual([3, "hold", "roundShot"]);
    expect(at("Gunline", "close")).toEqual([1, "hold", "grapeshot"]);
    expect(at("Gunline", "grappled")).toEqual([0, "openRange", "repel"]);
  });

  it("Skirmisher closes while they are far, crosses their bow at Short and Close, and the moment they charge", () => {
    expect(at("Skirmisher", "far")).toEqual([2, "closeIn", "roundShot"]);
    expect(at("Skirmisher", "medium")).toEqual([2, "closeIn", "roundShot"]);
    expect(at("Skirmisher", "short")).toEqual([3, "crossTheirBow", "roundShot"]);
    expect(at("Skirmisher", "close")).toEqual([3, "crossTheirBow", "roundShot"]);
    expect(at("Skirmisher", "grappled")).toEqual([0, "openRange", "repel"]);
    const charged = view({ range: "long", last: { hunter: null, target: { helm: "closeIn", guns: "roundShot" } } });
    expect(play("Skirmisher", charged)).toMatchObject({ rule: 1, helm: "crossTheirBow", guns: "roundShot" });
  });

  it("Rammer closes in every round, and backs off from a ship that crossed its bow", () => {
    for (const range of ["far", "long", "medium", "short", "close"] as const) expect(at("Rammer", range)).toEqual([2, "closeIn", "roundShot"]);
    expect(at("Rammer", "grappled")).toEqual([0, "openRange", "repel"]);
    const crossed = view({ range: "close", last: { hunter: null, target: { helm: "crossTheirBow", guns: "roundShot" } } });
    expect(play("Rammer", crossed)).toMatchObject({ rule: 1, helm: "openRange", guns: "roundShot" });
  });

  it("Smuggler opens the range with Chain shot, cuts free when grappled, and strikes its colours below 40% Hull", () => {
    expect(at("Smuggler", "long")).toEqual([2, "openRange", "chainShot"]);
    expect(at("Smuggler", "grappled")).toEqual([1, "openRange", "repel"]);
    expect(play("Smuggler", view({}, { hullPoints: 40 }))).toMatchObject({ kind: "fight", rule: 2 });
    expect(play("Smuggler", view({ range: "grappled" }, { hullPoints: 39 }))).toEqual({ kind: "surrender", rule: 0, abilities: [] });
  });

  it("Boarder closes in with Round shot, boards from Short, charges once Grappled and answers a Repel with muskets (spec section 6)", () => {
    for (const range of ["far", "long", "medium"] as const) expect(at("Boarder", range)).toEqual([3, "closeIn", "roundShot"]);
    expect(at("Boarder", "short")).toEqual([2, "closeIn", "board"]);
    expect(at("Boarder", "close")).toEqual([2, "closeIn", "board"]);
    expect(at("Boarder", "grappled")).toEqual([1, "hold", "charge"]);
    const repelled = view({ range: "grappled", last: { hunter: null, target: { helm: "hold", guns: "repel" } } });
    expect(play("Boarder", repelled)).toMatchObject({ rule: 0, helm: "hold", guns: "volley" });
    const charged = view({ range: "grappled", last: { hunter: null, target: { helm: "hold", guns: "charge" } } });
    expect(play("Boarder", charged)).toMatchObject({ rule: 1, helm: "hold", guns: "charge" });
  });

  it("Firebrand throws Fire Pots once Grappled, Hot Shot at Short and Close, Round shot while they are far, and Hot Shot on a crossed bow", () => {
    expect(at("Firebrand", "grappled")).toEqual([0, "hold", "firePots"]);
    for (const range of ["far", "long", "medium"] as const) expect(at("Firebrand", range)).toEqual([2, "closeIn", "roundShot"]);
    for (const range of ["short", "close"] as const) expect(at("Firebrand", range)).toEqual([3, "closeIn", "hotShot"]);
    const crossed = view({ range: "medium", last: { hunter: null, target: { helm: "crossTheirBow", guns: "roundShot" } } });
    expect(play("Firebrand", crossed)).toMatchObject({ rule: 1, helm: "openRange", guns: "hotShot" });
  });

  it("fit the three rules with conditions of a captain with the base slots, as written in the spec", () => {
    for (const name of ["Boarder", "Firebrand"] as const) expect(templateDoctrine(name).rules.length).toBe(D.baseSlots + 1);
    expect(templateDoctrine("Boarder").rules[0]!.if).toEqual([{ kind: "range", op: "is", range: "grappled" }, { kind: "theirLastGuns", order: "repel" }]);
  });

  it("always play: Hot Shot without the style, Fire Pots without pots or Drill 5 and Volley without Powder are replaced, not refused", () => {
    // Validation takes the orders at face value; the replacement happens when the round is played (styles.ts, deck.ts).
    const copied: Doctrine = { name: "Copied", rules: [rule([{ kind: "range", op: "is", range: "grappled" }], fight("hold", "firePots")), otherwise(fight("closeIn", "hotShot"))] };
    expect(validateDoctrine(copied, { slots: D.baseSlots })).toEqual([]);
    const volley: Doctrine = { name: "Volley", rules: [rule([{ kind: "haveFirePots" }, { kind: "havePowder" }], fight("hold", "volley")), otherwise(fight("hold", "charge"))] };
    expect(validateDoctrine(volley, { slots: D.baseSlots })).toEqual([]);
  });

  const duel = (
    hunter: Parameters<typeof templateDoctrine>[0], target: Parameters<typeof templateDoctrine>[0], seed = 1234, over: Partial<BattleShip> = {},
    input: Partial<Parameters<typeof battleOf>[3]> = {},
  ) =>
    runBattle(battleOf(
      testShip("hunter", "sloop", over), testShip("target"),
      { hunter: doctrineChooser(templateDoctrine(hunter), ctx), target: doctrineChooser(templateDoctrine(target), ctx) },
      { seed, doctrines: { hunter, target }, ...input },
    ));

  it("play out in a battle: the Boarder closes on a Gunline that holds near, boards it from Short and charges over the rail", () => {
    const r = duel("Boarder", "Gunline");
    expect(r.doctrines).toEqual({ hunter: "Boarder", target: "Gunline" });
    expect(r.rounds[0]!.ships.map((s) => [s.helm, s.guns])).toEqual([["closeIn", "roundShot"], ["closeIn", "roundShot"]]);
    expect(r.rounds[0]!.rangeAfter).toBe("short"); // both Close In from Long: two bands
    // At Short the Boarder boards at once. Its chase (1.3) puts its Helm score above the Gunline, so the Board works on Helm score.
    expect(r.rounds[1]!.ships.map((s) => [s.rule, s.helm, s.guns])).toEqual([[2, "closeIn", "board"], [3, "hold", "roundShot"]]);
    expect(r.rounds[1]!.grapples).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    expect(r.rounds[1]!.rangeAfter).toBe("grappled");
    expect(r.rounds[1]!.edge).toBe("hunter");
    expect(r.rounds[1]!.melee!.firstOver).toBe("hunter");
    expect(r.rounds[1]!.ships.map((s) => s.deck!.order)).toEqual(["charge", "fists"]); // First over the rail: the Gunline fights with Fists
    expect(r.rounds[2]!.ships.map((s) => [s.rule, s.helm, s.guns])).toEqual([[1, "hold", "charge"], [0, "openRange", "repel"]]);
    expect(r.rounds[2]!.ships.map((s) => s.deck!.order)).toEqual(["charge", "repel"]); // and now the Gunline repels
  });

  it("play out in a battle: the Skirmisher crosses the bow of a Boarder that charges, and rakes it", () => {
    const r = duel("Skirmisher", "Boarder");
    expect(r.rounds[0]!.ships[0]).toMatchObject({ rule: 2, helm: "closeIn", guns: "roundShot" }); // far apart: close in
    expect(r.rounds[0]!.rangeAfter).toBe("short");
    expect(r.rounds[1]!.row).toBe("crossClose");
    expect(r.rounds[1]!.ships[0]).toMatchObject({ rule: 1, helm: "crossTheirBow", guns: "roundShot" }); // it charged last round
    expect(r.rounds[1]!.ships[0]!.shot.damage).toBeGreaterThan(r.rounds[1]!.ships[1]!.shot.damage); // the raked ship's guns are weaker
  });

  it("play out in a battle: a Smuggler that cannot run strikes its colours once its Hull falls below 40%", () => {
    // In Kelp the range never goes beyond Medium, so the Smuggler cannot get away from a ship that holds and shoots.
    const r = runBattle(battleOf(
      testShip("hunter", "sloop", { cannons: 25 }), testShip("target"),
      { hunter: doctrineChooser({ name: "Gunner", rules: [otherwise(fight("hold", "roundShot"))] }, ctx), target: doctrineChooser(templateDoctrine("Smuggler"), ctx) },
      { terrain: "kelp" },
    ));
    expect(r.outcome).toMatchObject({ kind: "struckColours", winner: "hunter", loser: "target" });
    expect(r.rounds.at(-1)!.ships[1]!.rule).toBe(0);
    expect(r.rounds.at(-2)!.ships[1]!.hullPoints).toBeLessThan(40);
    expect(r.rounds.at(-2)!.ships[1]!.helm).toBe("openRange");
  });


  it("every template against every template ends sanely over many seeds, and the same seed gives the same BattleRecord", () => {
    const kinds = new Set<string>();
    for (const a of TEMPLATE_NAMES) {
      for (const b of TEMPLATE_NAMES) {
        for (let seed = 1; seed <= 20; seed++) {
          const r = duel(a, b, seed);
          expect(r, `${a} v ${b} seed ${seed}`).toEqual(duel(a, b, seed));
          kinds.add(r.outcome.kind);
          expect(r.rounds.length).toBeGreaterThan(0);
          expect(r.rounds.length).toBeLessThanOrEqual(B.combat.rounds + B.combat.overtime);
          for (const s of r.final) {
            expect(s.hullPoints).toBeGreaterThanOrEqual(0);
            expect(s.riggingPoints).toBeGreaterThanOrEqual(0);
            expect(s.hands).toBeGreaterThanOrEqual(0);
          }
          for (const round of r.rounds) for (const s of round.ships) expect(s.rule).toBeGreaterThanOrEqual(0); // validated doctrines never hit the fallback
        }
      }
    }
    expect(kinds.has("escaped")).toBe(true);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
});
