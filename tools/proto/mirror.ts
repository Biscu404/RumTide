// SCRATCH ONLY. Look at mirror battles round by round.
import { B, battleShipOf, doctrineChooser, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor, verdictFor } from "../v3/sim/arena.ts";
const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const st: string = cfg.style; const scene = SCENES.find((s) => s.name === (cfg.scene ?? "open/breeze"))!;
const kinds: Record<string, number> = {};
for (let i = 0; i < (cfg.n ?? 20); i++) {
  const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
  const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags);
  const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags);
  for (const s of [hs, ts]) { s.style = st; s.drill = 0; if (st === "Bombardier") { s.maxHands = Math.round(s.maxHands * B.proto.bombHands); s.hands = s.maxHands; } s.pots = st === "Firebrand" ? B.proto.firebrandPots : 0; }
  const d = { name: st, rules: cfg.templates[st] } as Doctrine;
  const r: any = runBattle({ tide: 5, seed: seedFor(`seat/${st}/${st}/${scene.name}`, i), at: "dw_shallows", terrain: scene.terrain, wind: scene.wind, hunter: hs, target: ts,
    doctrines: { hunter: st, target: st }, choosers: { hunter: doctrineChooser(d, { enemyType: "player" }), target: doctrineChooser(d, { enemyType: "player" }) } });
  const k = `${r.outcome.kind}:${verdictFor(r, "hunter")}`; kinds[k] = (kinds[k] ?? 0) + 1;
  if (i < (cfg.show ?? 1)) { console.log(JSON.stringify(r.outcome), Object.keys(r.rounds[0])); for (const rd of r.rounds) console.log(rd.round, rd.rangeBefore, "->", rd.rangeAfter, JSON.stringify(rd.orders ?? rd.plays ?? null)?.slice(0, 300), JSON.stringify(rd.melee)?.slice(0, 400), JSON.stringify(rd.ships ?? rd.after ?? null)?.slice(0, 300)); }
}
console.log(JSON.stringify(kinds));
