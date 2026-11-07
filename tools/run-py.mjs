// Runs a Python script with whichever Python the machine has: `py` on Windows, `python3` or `python` elsewhere.
// Usage: node tools/run-py.mjs <script.py> [args...]
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node tools/run-py.mjs <script.py> [args...]");
  process.exit(2);
}

for (const python of ["py", "python3", "python"]) {
  const run = spawnSync(python, args, { stdio: "inherit" });
  if (run.error && run.error.code === "ENOENT") continue;
  process.exit(run.status ?? 1);
}

console.error("No Python found. Install Python 3 (the checks need `py`, `python3` or `python` on the PATH).");
process.exit(127);
