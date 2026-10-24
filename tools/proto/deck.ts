// SCRATCH ONLY. The deck cycle on its own: a boarder who plays one fixed order against a defender who plays one fixed order.
// Usage: node tools/proto/deck.ts '{"drill":0,"n":300,"set":{...}}'
import { B, battleShipOf, doctrineChooser, runBattle } from "../../supabase/functions/_shared/engine_v3/index.ts";
import type { Doctrine, DoctrineRule } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { SCENES, buildShip, seedFor, verdictFor } from "../v3/sim/arena.ts";

const cfg = JSON.parse(process.argv[2] ?? "{}");
const n: number = cfg.n ?? 300;
const drill: number = cfg.drill ?? 0;
for (const [path, value] of Object.entries(cfg.set ?? {}) as [string, number][]) {
  const keys = path.split("."); let h: any = B;
  for (const k of keys.slice(0, -1)) h = h[k];
  h[keys[keys.length - 1]!] = value;
}
const fight = (helm: string, guns: string): any => ({ kind: "fight", helm, guns });
const rule = (c: any[], then: any): DoctrineRule => ({ if: c, then }) as DoctrineRule;
const grappled = { kind: "range", op: "is", range: "grappled" };
const boarder = (x: string): Doctrine => ({ name: `B-${x}`, rules: [rule([grappled], fight("hold", x)), rule([{ kind: "range", op: "is", range: "close" }], fight("closeIn", "board")), rule([], fight("closeIn", "roundShot"))] }) as Doctrine;
const defender = (y: string): Doctrine => ({ name: `D-${y}`, rules: [rule([grappled], fight("hold", y)), rule([], fight("hold", "roundShot"))] }) as Doctrine;

const orders = ["charge", "volley", "repel", ...(drill >= B.proto.fireAt ? ["firePots"] : [])];
const out: any = { drill, n, rows: {} };
for (const x of orders) {
  out.rows[x] = {};
  for (const y of orders) {
    let win = 0, loss = 0, other = 0, tot = 0;
    for (const scene of SCENES) {
      for (let i = 0; i < n; i++) {
        const flags = { charted: scene.charted === true, withCurrent: false, lurker: false };
        const hs: any = battleShipOf(buildShip("a"), { id: "cap_a" }, "hunter", flags);
        const ts: any = battleShipOf(buildShip("b"), { id: "cap_b" }, "target", flags);
        for (const s of [hs, ts]) { s.drill = drill; s.pots = drill >= B.proto.fireAt ? B.proto.pots : 0; }
        const hd = boarder(x), td = defender(y);
        const rec = runBattle({
          tide: 5, seed: seedFor(`deck/${x}/${y}/${scene.name}`, i), at: "dw_shallows", terrain: scene.terrain, wind: scene.wind,
          hunter: hs, target: ts, doctrines: { hunter: hd.name, target: td.name },
          choosers: { hunter: doctrineChooser(hd, { enemyType: "player" }), target: doctrineChooser(td, { enemyType: "player" }) },
        });
        const v = verdictFor(rec, "hunter");
        // only count battles that were boarded
        if (!(rec as any).rounds?.some((r: any) => r.rangeAfter === "grappled")) continue;
        tot++; if (v === "win") win++; else if (v === "loss") loss++; else other++;
      }
    }
    out.rows[x][y] = { win: Math.round((1000 * win) / tot) / 10, loss: Math.round((1000 * loss) / tot) / 10, n: tot };
  }
}
console.log(JSON.stringify(out));
