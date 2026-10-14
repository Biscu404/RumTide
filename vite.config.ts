import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromRoot("./client"),
  plugins: [preact()],
  resolve: {
    // One copy of the rules: the client imports the engine that the Edge Functions use.
    alias: { "@engine": fromRoot("./supabase/functions/_shared/engine") },
  },
  build: { outDir: fromRoot("./dist"), emptyOutDir: true },
});
