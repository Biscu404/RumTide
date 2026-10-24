// SCRATCH ONLY. Checks 3 and 4 of GAMEPLAY 8.9 on the Fighting Styles prototype.
// Usage: LADDER=6 node tools/proto/checks.ts '{"mode":"seat"|"power","set":{...},"templates":{...},"n":60}'
import { B, battleShipOf, doctrineChooser, rngFor, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Chooser, Doctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, ratingOf, seedFor, sloopForRatio, verdictFor } from "../v3/sim/arena.ts";

const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const n: number = cfg.n ?? 60;
const T: Record<string, any[]> = cfg.templates;
const STYLES = Object.keys(T).filter((s) => s !== "Smuggler");

function ships(h: string | null, t: string | null, scene: any, specH: any = {}, specT: any = {}) {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const hs: any = battleShipOf(buildShip("a", specH), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b", specT), { id: "cap_b" }, "target", flags);
  for (const [s, st] of [[hs, h], [ts, t]] as const) {
    if (!st) continue;
    s.style = st; s.drill = 0;
    if (st === "Bombardier") { s.maxHands = Math.round(s.maxHands * B.proto.bombHands); s.hands = s.maxHands; }
    s.pots = st === "Firebrand" ? B.proto.firebrandPots : 0;
  }
  return { hs, ts };
}

const out: any = { mode: cfg.mode };
if (cfg.mode === "seat") {
  // Check 3: of decided battles, how many the hunter won. Pooled over every pair (mirrors included) and per mirror, per scene.
  const rows: any[] = [];
  let pooledH = 0, pooledD = 0;
  for (const scene of SCENES) {
    let sh = 0, sd = 0;
    for (const a of STYLES) for (const b of STYLES) {
      let h = 0, d = 0;
      for (let i = 0; i < n; i++) {
        const { hs, ts } = ships(a, b, scene);
        const r = runBattle({ tide: 5, seed: seedFor(`seat/${a}/${b}/${scene.name}`, i), at: "dw_shallows", terrain: scene.terrain, wind: scene.wind, hunter: hs, target: ts,
          doctrines: { hunter: a, target: b }, choosers: { hunter: doctrineChooser({ name: a, rules: T[a] } as Doctrine, { enemyType: "player" }), target: doctrineChooser({ name: b, rules: T[b] } as Doctrine, { enemyType: "player" }) } });
        const v = verdictFor(r, "hunter");
        if (v === "win") { h++; d++; } else if (v === "loss") d++;
      }
      sh += h; sd += d;
      if (a === b) rows.push({ row: `${a} mirror`, scene: scene.name, hunter: d ? Math.round((1000 * h) / d) / 10 : null, decided: d });
    }
    rows.push({ row: "pooled field", scene: scene.name, hunter: sd ? Math.round((1000 * sh) / sd) / 10 : null, decided: sd });
    pooledH += sh; pooledD += sd;
  }
  out.overall = Math.round((1000 * pooledH) / pooledD) / 10;
  out.rows = rows;
}
if (cfg.mode === "power") {
  // Check 4: random plans, the stronger ship at a ratio of Power Rating, escapes left out, both seats, every scene.
  const AMMO = ["roundShot", "chainShot", "grapeshot"];
  const plan = (seed: number, side: string): Chooser => {
    const rng = rngFor(seed, "sim", "plan", side);
    return (view: any) => {
      const helm = ["closeIn", "hold", "openRange", "crossTheirBow"][Math.floor(rng.next() * 4)]!;
      const pool = view.range === "grappled" ? ["charge", "volley", "repel"] : view.range === "close" ? [...AMMO, "board"] : AMMO;
      return { kind: "fight", rule: 0, abilities: [], helm, guns: pool[Math.floor(rng.next() * pool.length)]! } as any;
    };
  };
  out.rows = [];
  for (const ratio of [1, 1.25, 1.5, 2]) {
    const spec = sloopForRatio(ratio);
    let w = 0, fought = 0;
    for (const scene of SCENES) for (const seat of ["hunter", "target"] as const) for (let i = 0; i < n; i++) {
      const seed = seedFor(`power/${ratio}/${scene.name}/${seat}`, i);
      const { hs, ts } = seat === "hunter" ? ships(null, null, scene, spec, {}) : ships(null, null, scene, {}, spec);
      const r = runBattle({ tide: 5, seed, at: "dw_shallows", terrain: scene.terrain, wind: scene.wind, hunter: hs, target: ts,
        doctrines: { hunter: "random", target: "random" }, choosers: { hunter: plan(seed, "hunter"), target: plan(seed, "target") } });
      const v = verdictFor(r, seat);
      if (v === "escape") continue;
      fought++;
      if (v === "win") w++;
    }
    out.rows.push({ ratio, actual: Math.round((100 * ratingOf(spec)) / ratingOf()) / 100, strongerWins: Math.round((1000 * w) / fought) / 10, fought });
  }
}
console.log(JSON.stringify(out));
