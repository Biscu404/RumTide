import { describe, expect, it } from "vitest";
import { B } from "../balance.ts";
import type { Captain } from "../types.ts";
import type { RoundView } from "./battle.ts";
import { runBattle } from "./battle.ts";
import {
  ABILITIES, DOCTRINE_SLOT_PERK, FALLBACK_PLAY, JETTISON_PLAY, NO_RULE, TEMPLATE_NAMES, conditionHolds, doctrineChooser,
  doctrineSlots, evaluateDoctrine, templateDoctrine, templateDoctrines, validateDoctrine, validateDoctrines,
} from "./doctrine.ts";
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

  it("range is, at least and at most read the range as a distance: Long is far and Grappled is near (D69)", () => {
    const table: [Range, boolean, boolean, boolean][] = [
      // range, is Medium, at least Medium, at most Medium
      ["long", false, true, false],
      ["medium", true, true, true],
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
      expect(holds({ kind: "range", op: "atMost", range: "long" }, view({ range }))).toBe(true);
    }
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
    expect(bad({ kind: "range", op: "is", range: "far" })).toEqual(["rule 1: unknown range far"]);
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
      { kind: "havePowder" }, { kind: "abilityUnused", ability: "fake.flare" },
    ];
    for (const c of conditions) expect(validateDoctrine({ name: "K", rules: [rule([c], fight("hold", "roundShot")), otherwise()] }, { slots: 3, abilities: FAKE })).toEqual([]);
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

describe("the four templates (GAMEPLAY 8.8)", () => {
  it("are Brawler, Skirmisher, Runner and Coward, and each is valid for a captain with the base slots", () => {
    expect([...TEMPLATE_NAMES]).toEqual(["Brawler", "Skirmisher", "Runner", "Coward"]);
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
    const a = templateDoctrine("Brawler");
    const b = templateDoctrine("Brawler");
    a.name = "Mine";
    a.rules.pop();
    expect(b).toEqual(templateDoctrine("Brawler"));
    expect(templateDoctrines()[0]).toEqual(templateDoctrine("Brawler"));
  });

  it("use only the thresholds in balance.ts", () => {
    const T = D.templates;
    const hands = templateDoctrine("Brawler").rules[2]!.if[0];
    expect(hands).toMatchObject({ kind: "track", track: "hands", pct: T.brawlerBoardHandsPct });
    expect(templateDoctrine("Skirmisher").rules[1]!.if[0]).toMatchObject({ pct: T.skirmisherChainRiggingPct });
    expect(templateDoctrine("Runner").rules[1]!.if[0]).toMatchObject({ pct: T.runnerChainRiggingPct });
    expect(templateDoctrine("Coward").rules[0]!.if[0]).toMatchObject({ who: "mine", track: "hull", pct: T.cowardStrikesHullPct });
  });

  const play = (name: Parameters<typeof templateDoctrine>[0], v: RoundView) => evaluateDoctrine(templateDoctrine(name), v, ctx);

  it("Brawler closes in, boards at Close and grapes the crew once Grappled", () => {
    expect(play("Brawler", view({ range: "long" }))).toMatchObject({ rule: 3, helm: "closeIn", guns: "roundShot" });
    expect(play("Brawler", view({ range: "medium" }))).toMatchObject({ rule: 3, helm: "closeIn", guns: "roundShot" });
    expect(play("Brawler", view({ range: "close" }))).toMatchObject({ rule: 1, helm: "closeIn", guns: "board" });
    expect(play("Brawler", view({ range: "grappled" }))).toMatchObject({ rule: 0, helm: "closeIn", guns: "grapeshot" });
    expect(play("Brawler", view({ range: "long" }, {}, { hands: 14 }))).toMatchObject({ rule: 2, helm: "closeIn", guns: "board" }); // a thin crew: go and take them
  });

  it("Skirmisher crosses their bow, shoots the Rigging first and chases a runner", () => {
    expect(play("Skirmisher", view())).toMatchObject({ rule: 1, helm: "crossTheirBow", guns: "chainShot" });
    expect(play("Skirmisher", view({}, {}, { riggingPoints: 40 }))).toMatchObject({ rule: 2, helm: "crossTheirBow", guns: "roundShot" });
    expect(play("Skirmisher", view({ last: { hunter: null, target: { helm: "openRange", guns: "roundShot" } } }))).toMatchObject({ rule: 0, helm: "closeIn", guns: "chainShot" });
  });

  it("Runner opens the range every round and tries to cut free when grappled", () => {
    expect(play("Runner", view())).toMatchObject({ rule: 1, helm: "openRange", guns: "chainShot" });
    expect(play("Runner", view({}, {}, { riggingPoints: 10 }))).toMatchObject({ rule: 2, helm: "openRange", guns: "roundShot" });
    expect(play("Runner", view({ range: "grappled" }))).toMatchObject({ rule: 0, helm: "openRange", guns: "repel" });
  });

  it("Coward holds and fires, and strikes the colours when its Hull falls below half", () => {
    expect(play("Coward", view())).toMatchObject({ kind: "fight", rule: 1, helm: "hold", guns: "roundShot" });
    expect(play("Coward", view({}, { hullPoints: 50 }))).toMatchObject({ kind: "fight", rule: 1 });
    expect(play("Coward", view({}, { hullPoints: 49 }))).toEqual({ kind: "surrender", rule: 0, abilities: [] });
  });

  const duel = (hunter: Parameters<typeof templateDoctrine>[0], target: Parameters<typeof templateDoctrine>[0], seed = 1234, over: Partial<BattleShip> = {}) =>
    runBattle(battleOf(
      testShip("hunter", "sloop", over), testShip("target"),
      { hunter: doctrineChooser(templateDoctrine(hunter), ctx), target: doctrineChooser(templateDoctrine(target), ctx) },
      { seed, doctrines: { hunter, target } },
    ));

  it("play out in a battle: the Brawler closes on a Coward who holds, and boards at Close", () => {
    const r = duel("Brawler", "Coward");
    expect(r.doctrines).toEqual({ hunter: "Brawler", target: "Coward" });
    expect(r.rounds[0]!.ships.map((s) => [s.helm, s.guns])).toEqual([["closeIn", "roundShot"], ["hold", "roundShot"]]);
    expect(r.rounds[0]!.rangeAfter).toBe("medium"); // Close In against Hold: one band
    expect(r.rounds[1]!.rangeAfter).toBe("close");
    expect(r.rounds[2]!.ships[0]).toMatchObject({ rule: 1, helm: "closeIn", guns: "board" });
    expect(r.rounds[2]!.grapples).toEqual([{ side: "hunter", ok: true, why: "helm" }]);
    expect(r.rounds[2]!.rangeAfter).toBe("grappled");
    expect(r.outcome.winner).toBe("hunter");
  });

  it("play out in a battle: the Runner escapes a Coward in the first round", () => {
    const r = duel("Runner", "Coward");
    expect(r.outcome).toEqual({ kind: "escaped", winner: null, loser: null, round: 1 });
    expect(r.rounds[0]!.row).toBe("holdOpen");
  });

  it("play out in a battle: the Skirmisher rakes a Brawler that closes in and shoots its Rigging", () => {
    const r = duel("Skirmisher", "Brawler");
    expect(r.rounds[0]!.row).toBe("crossClose");
    expect(r.rounds[0]!.ships[0]).toMatchObject({ rule: 1, helm: "crossTheirBow", guns: "chainShot" });
    expect(r.rounds[0]!.ships[0]!.shot.track).toBe("rigging");
    expect(r.rounds[0]!.ships[0]!.shot.damage).toBeGreaterThan(r.rounds[0]!.ships[1]!.shot.damage); // the raked ship's guns are weaker
    expect(r.outcome.winner).toBe("hunter");
  });

  it("play out in a battle: a Coward strikes its colours once its Hull falls below half", () => {
    const r = duel("Brawler", "Coward", 1234, { cannons: 30 });
    expect(r.outcome.kind).toBe("struckColours");
    expect(r.outcome).toMatchObject({ winner: "hunter", loser: "target" });
    const last = r.rounds.at(-1)!;
    expect(last.struck).toEqual(["target"]);
    expect(last.ships[1]!.rule).toBe(0);
    expect(r.rounds.at(-2)!.ships[1]!.hullPoints).toBeLessThan(50);
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
          expect(r.rounds.length).toBeLessThanOrEqual(B.combat.rounds);
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
