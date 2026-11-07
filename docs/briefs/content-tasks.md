# Brief: content and check tasks C2 to C5

Four tasks that were waiting in the old crew guide, moved here word for word on 7 November 2026 so they are easy to find. None is started. C2 to C4 need the roles parked in `docs/archive/crew/` (restore them first, see `docs/CREW.md`). C5 is a task for the main session and needs no role.

Do them in order. Each one produces a file the crew relies on later.

**C2. Lore.**

```
Use the narrative-writer subagent. Create docs/LORE.md from docs/GAMEPLAY.md sections 1.4, 2
and 16 and docs/GAME_DESIGN.md sections 2.4 and 10. Facts only, copied from those documents.
Keep it under two pages. Mark nothing as canon that the documents do not say.
```

**C3. Art bible check.**

```
Use the art-director subagent. Compare the rumtide-art-bible skill with docs/GAME_DESIGN.md
section 2.1 and list any mismatch. Then run the palette check on client/public/assets.
```

All 20 role colours in section 2.1 appear in the Endesga 32 list that ships with the pixel-art-studio skill. That list is also what the checker uses. The design document says to verify values against Lospec before locking, so do one quick manual check there and then consider the palette locked.

**C4. Sound events.**

```
Use the sound-designer subagent. Create docs/audio/events.md for Season 0: every sound event,
its trigger, mood, length, loudness tier and scene, in priority order with music last.
```

**C5. Baseline QA.**

```
Use the qa-tester subagent. Run the full sweep and write docs/qa/baseline.md. I want the
real numbers from sim and bots recorded, because every later change is compared with them.
```
