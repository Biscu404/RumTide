// Try a number without editing balance.ts (P3.2). `--set combat.rake=1.5` changes B.combat.rake for one run of the simulator,
// on every worker, and puts it back after. The engine reads its numbers from B when it uses them, so this is the same as
// editing the file and running again. Only numbers can be set, and a path that does not exist is an error, so a typo cannot
// run a whole simulation on the old number.

import { B } from "../../../supabase/functions/_shared/engine_v3/index.ts";

/** Dotted paths into B, each with the number to use: { "combat.rake": 1.5, "shellback.cannons": 20 }. */
export type Patch = Record<string, number>;

/** "combat.rake=1.5" to { "combat.rake": 1.5 }. Throws on anything else. */
export function parseSet(text: string): Patch {
  const at = text.indexOf("=");
  const value = Number(text.slice(at + 1));
  if (at <= 0 || text.slice(at + 1).trim() === "" || !Number.isFinite(value)) throw new Error(`--set wants path=number, for example combat.rake=1.5. Got ${text}.`);
  return { [text.slice(0, at)]: value };
}

/** Sets every number in the patch on B and returns a function that puts them all back. */
export function applyPatch(patch: Patch): () => void {
  const undo: (() => void)[] = [];
  try {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split(".");
      const leaf = keys[keys.length - 1]!;
      let holder: Record<string, unknown> = B as unknown as Record<string, unknown>;
      for (const key of keys.slice(0, -1)) {
        const next = holder[key];
        if (next === null || typeof next !== "object") throw new Error(`There is no B.${path}: ${key} is not a group of numbers.`);
        holder = next as Record<string, unknown>;
      }
      const before = holder[leaf];
      if (typeof before !== "number") throw new Error(`There is no number at B.${path}.`);
      holder[leaf] = value;
      undo.push(() => { holder[leaf] = before; });
    }
  } catch (e) {
    for (const f of undo.reverse()) f();
    throw e;
  }
  return () => { for (const f of undo.reverse()) f(); };
}

export const patchText = (patch: Patch): string =>
  Object.keys(patch).length === 0 ? "no changes to balance.ts" : Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ");
