import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The sandbox (docs/briefs/sandbox.md): its own page on its own port, apart from the v0.2 client in ./client.
// It imports engine_v3 by relative path, so it needs no alias.
export default defineConfig({
  root: fromRoot("./sandbox"),
  plugins: [preact()],
  server: { port: 5180, strictPort: true, fs: { allow: [fromRoot(".")] } },
  build: { outDir: fromRoot("./dist-sandbox"), emptyOutDir: true },
});
