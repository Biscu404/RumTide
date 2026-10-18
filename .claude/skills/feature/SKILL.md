---
name: feature
description: "Runs one Rumtide feature through the whole crew workflow, from scope check to closing notes."
argument-hint: "[feature idea or roadmap task id]"
disable-model-invocation: true
---

Run this feature through the crew: $ARGUMENTS

You are the coordinator. Use the Agent tool to delegate to the named subagents. They do not see this conversation, so every delegation states the goal, the exact files or doc sections to read, the acceptance criteria and what not to touch, and asks for a report in under 200 words.

## Steps

1. **Scope.** Check the feature against the MVP table in `docs/GAME_DESIGN.md` 16.1 and the Season 0 column of `docs/GAMEPLAY.md` section 21. If it is out of scope, add it to `docs/IDEAS.md`, tell Biscu, and stop.
2. **Plan.** Ask the producer to read `docs/STATUS.md` and split the feature into tasks with owners and checkable acceptance criteria.
3. **Spec.** If the feature changes how the game plays, ask the game-designer for a one page spec in `docs/specs/`. Show it to Biscu and wait for approval before going further. Skip this step for pure bug fixes and pure presentation work.
4. **Prepare in parallel, only the roles the feature needs.** narrative-writer for text, art-director for the art brief, sound-designer for sound events.
5. **Make assets.** pixel-artist builds from the approved brief. art-director reviews the result.
6. **Build.** engineer implements with the spec, the assets and the text in hand. Engine changes come with unit tests.
7. **Verify.** qa-tester runs the sweep and writes a report to `docs/qa/`.
8. **Fix loop.** Send blockers and major bugs back to the right role. Allow two rounds. If it still fails, stop and ask Biscu.
9. **Close.** Follow the Definition of done in `CLAUDE.md`. It is the one rule for what to update and when.

## Rules

* One feature at a time. Do not start the next one.
* Never skip the approval at step 3 when a rule changes.
* If a step cannot run, say so. Do not pretend it passed.

Finish with a summary under 150 words: what was built, what was checked and the result, what Biscu should try by hand, and any open decision.
