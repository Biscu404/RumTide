// Lets scripts run with plain Node (which strips TypeScript types itself) import the engine
// as "@engine/...", the same alias Vite and tsconfig use:  node --import ./tools/register.mjs tools/sim/index.ts
import { registerHooks } from "node:module";

const engine = new URL("../supabase/functions/_shared/engine/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@engine/")) {
      return nextResolve(new URL(specifier.slice("@engine/".length), engine).href, context);
    }
    return nextResolve(specifier, context);
  },
});
