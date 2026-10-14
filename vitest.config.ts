import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Reuse the Vite setup (aliases, Preact), but run from the repo root so tests anywhere are found.
export default mergeConfig(viteConfig, defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    include: ["supabase/**/*.test.ts", "tools/**/*.test.ts", "client/**/*.test.{ts,tsx}"],
  },
}));
