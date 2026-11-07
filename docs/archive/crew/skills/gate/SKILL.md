---
name: gate
description: "Runs a full quality gate before a Rumtide milestone, internal playtest or Season start."
argument-hint: "[milestone name]"
disable-model-invocation: true
---

Run a quality gate for: $ARGUMENTS

You are the coordinator. Use the Agent tool. Subagents do not see this conversation, so state the goal, the files, and the report format in each delegation. Steps 1 to 5 are independent and may run in parallel.

1. **qa-tester:** run the full sweep with `npm run bots -- 100`, and write `docs/qa/gate_<milestone>.md` (milestone name in lowercase, words joined by underscores).
2. **art-director:** review every asset under `client/public/assets/sprites/` (or only those changed since the last gate, if you can tell from git) and run the palette check. Verdict line first.
3. **narrative-writer:** check all player facing text against the rumtide-lore rules: tone, length budgets, variables, glossary, dashes.
4. **game-designer:** read the sim and bot numbers from the QA report against the tables and pillars in the design documents. Give a balance verdict and name the one number to change first.
5. **sound-designer:** compare `docs/audio/events.md` with the audio files that exist. Skip if there is no audio yet.
6. **producer:** read all five reports and give a verdict, READY or NOT READY, with blockers, a cut list and the risks that grew since the last gate.

If a step could not run, mark it NOT ASSESSED. Never guess.

Finish with one screen for Biscu: the verdict, the blockers, and the next three actions.
