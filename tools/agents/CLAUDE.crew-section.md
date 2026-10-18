## Crew (specialist roles)

* Eight roles live in `.claude/agents/`: producer, art-director, pixel-artist, game-designer, narrative-writer, engineer, qa-tester, sound-designer. Use the matching role for its kind of work. Details and workflows are in `docs/CREW.md`.
* When documents disagree, the order of authority is `docs/DECISIONS.md`, then `docs/GAMEPLAY.md`, then `docs/GAME_DESIGN.md`.
* Art follows the `rumtide-art-bible` skill (Endesga 32 only). Run `npm run assets:check` after touching assets.
* Player facing text follows the `rumtide-lore` skill. Run `npm run prose:check` after writing text.
* Slash commands: `/feature` runs one feature through the crew, `/gate` runs a quality gate.
* Roles report back in under 200 words: what changed, files touched, what to check, open questions.
