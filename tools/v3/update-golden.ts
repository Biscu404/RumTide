// npm run golden:update
// Rewrites the six ship golden file after an intentional rule change. Read the git diff before committing it.

import { writeFileSync } from "node:fs";
import { canonicalJson } from "../../supabase/functions/_shared/engine_v3/index.ts";
import { GOLDEN_FILE, goldenSnapshot } from "./sixShips.ts";

const snap = goldenSnapshot();
writeFileSync(GOLDEN_FILE, JSON.stringify(JSON.parse(canonicalJson(snap)), null, 2) + "\n");
console.log(`Golden file updated. Fingerprint ${snap.hash}.`);
