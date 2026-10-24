// SCRATCH ONLY. Prints a few battles between two styles round by round. Usage: LADDER=6 node tools/proto/trace2.ts '<cfg>' A B count
import { B, battleShipOf, doctrineChooser, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor } from "../v3/sim/arena.ts";
const cfg = JSON.parse(process.argv[2]!);
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) { const k = path.split("."); let h: any = B; for (const x of k.slice(0, -1)) h = h[x]; h[k[k.length - 1]!] = value; }
const [A, Bn, count] = [process.argv[3]!, process.argv[4]!, Number(process.argv[5] ?? 3)];
const scene = SCENES[0]!;
for (let i = 0; i < count; i++) {
  const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", { charted: false, withCurrent: false, lurker: false });
  const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", { charted: false, withCurrent: false, lurker: false });
  hs.style = A; ts.style = Bn; for (const s of [hs, ts]) { s.drill = 0; s.pots = s.style === "Firebrand" ? B.proto.firebrandPots : 0; if (s.style === "Bombardier") { s.maxHands = Math.round(s.maxHands * B.proto.bombHands); s.hands = s.maxHands; } }
  const hd: any = { name: A, rules: cfg.templates[A] }, td: any = { name: Bn, rules: cfg.templates[Bn] };
  const rec: any = runBattle({ tide: 5, seed: seedFor(`trace/${A}/${Bn}`, i), at: "dw_shallows", terrain: scene.terrain, wind: scene.wind, hunter: hs, target: ts,
    doctrines: { hunter: A, target: Bn }, choosers: { hunter: doctrineChooser(hd, { enemyType: "player" }), target: doctrineChooser(td, { enemyType: "player" }) } });
  console.log(`--- battle ${i}: ${rec.outcome.kind} winner ${rec.outcome.winner}`);
  for (const r of rec.rounds) {
    const s = r.ships.map((x: any) => `${x.helm ?? x.move ?? ""}/${x.guns ?? x.order ?? ""} H${x.hullPoints ?? x.hull} N${x.hands}`).join("  |  ");
    console.log(`r${r.round} ${r.rangeBefore}->${r.rangeAfter} grapples:${JSON.stringify(r.grapples?.map((g: any) => g.side + ":" + g.ok))}  ${s}`);
  }
}
