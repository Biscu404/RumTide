# Rumtide crew: install and use guide

Eight specialist roles for Claude Code, a few project skills, and the tools that make them work. This guide takes you from a plain repo to a working crew in about an hour, then shows how to use it well.

## What you are installing

| Role | What it is | Main files |
|-|-|-|
| Direction and Production | `producer` subagent, also runnable as the whole session | `.claude/agents/producer.md` |
| Art Direction | `art-director` subagent plus the `rumtide-art-bible` skill | `.claude/agents/art-director.md` |
| Art | `pixel-artist` subagent plus the `pixel-art-studio` skill | `.claude/agents/pixel-artist.md` |
| Game Design | `game-designer` subagent | `.claude/agents/game-designer.md` |
| Narrative and Writing | `narrative-writer` subagent plus the `rumtide-lore` skill | `.claude/agents/narrative-writer.md` |
| Engineering | `engineer` subagent plus 16 official Phaser 4 skills | `.claude/agents/engineer.md` |
| QA and Playtesting | `qa-tester` subagent plus two checker scripts | `.claude/agents/qa-tester.md` |
| Audio | `sound-designer` subagent plus the `rumtide-sound` skill | `.claude/agents/sound-designer.md` |

Two workflow commands tie them together: `/feature` runs one feature through the crew, and `/gate` runs a quality gate before a milestone.

## What changed since the research report

I opened the real files before writing this, and three recommendations changed.

1. **I wrote lean agents instead of copying the Claude Code Game Studios ones.** Its `producer.md` is 164 lines of gate verdict formats, director escalations and approval prompts that assume the rest of that studio (74 skills and 14 hook scripts), and the files use em dashes, which your `CLAUDE.md` forbids. The structure inspired these agents. None of its text was copied.
2. **I dropped game-creator.** It is built for Phaser 3, expects its own EventBus and a `window.__GAME__` hook, and I found no licence file in the repo. Rumtide is on pinned Phaser 4 with Preact menus and a deterministic engine, so those conventions would fight your architecture.
3. **The producer works better as a main session agent than I said.** The official docs allow `claude --agent producer`, with an allowlist of which subagents it may spawn. Details in Part 4. Nested subagents are also allowed by default, up to three layers, so the earlier worry about that limit was too cautious.

## Before you start (10 minutes)

### Requirements

| Need | Check with | Notes |
|-|-|-|
| Claude Code 2.1.233 or later | `claude --version` | Older versions lack `claude plugin validate`. Update first if needed. |
| Node 22 or later | `node --version` | Your `package.json` already requires it. |
| git | `git --version` | The installer uses it. |
| Python 3.10 or later with Pillow | `python3 -c "import PIL; print(PIL.__version__)"` | Needed by pixel-art-studio and the palette checker. Installed in step 4. |
| bash | `bash --version` | Built in on macOS and Linux. On Windows use Git Bash or WSL. |

### Make a safe branch

```bash
git status                     # should be clean
git switch -c crew-setup
```

### Check the document paths

The agents assume `docs/GAME_DESIGN.md`, `docs/GAMEPLAY.md`, `docs/DECISIONS.md` and `docs/RESEARCH.md`. If any of them lives elsewhere in your repo, fix the references after step 1:

```bash
grep -rn "docs/GAMEPLAY.md" .claude
```

## Part 1: Install

### Step 1. Unpack the bundle at the repo root

```bash
# macOS, Linux, WSL, Git Bash
unzip -n ~/Downloads/rumtide-crew.zip -d .
```

```powershell
# Windows PowerShell
Expand-Archive $HOME\Downloads\rumtide-crew.zip -DestinationPath .
```

The bundle only adds new files and refuses to overwrite existing ones. You should now have this, and `git status` should show only new files:

```
.claude/agents/            eight role files
.claude/skills/            rumtide-art-bible, rumtide-lore, rumtide-sound, feature, gate
tools/agents/              installer, prose checker, settings example, snippets, THIRD_PARTY.md
tools/assets/              palette checker
docs/CREW.md               this guide
```

If `.claude/settings.json` or `.claude/skills` already existed, nothing in them was touched. The bundle ships no settings file on purpose.

### Step 2. Install the third party skills

Always dry run first. A dry run still downloads and verifies the pinned commits, it just copies nothing into your repo.

```bash
bash tools/agents/install_third_party.sh --dry-run
bash tools/agents/install_third_party.sh
```

Options:

| Option | Effect |
|-|-|
| `--all-phaser` | Install all 28 Phaser skills instead of the 16 Rumtide needs |
| `--with-webapp-testing` | Also install Anthropic's Playwright testing skill (needs Python Playwright, see Part 5) |
| `--force` | Replace skills that are already installed |
| `--dry-run` | Show what would be installed |

What the installer does and why it is safe to run:

* Every source is pinned to a full commit hash and the script verifies the hash after downloading. If it does not match, it stops and installs nothing from that source. I tested this with a deliberately wrong hash.
* Phaser skills come from the official `phaserjs/phaser` repo at tag `v4.2.1`, which matches the version pinned in your design document. That version has all 28 skills.
* Physics skills are left out by default because Rumtide is turn based and resolves Tides on the server.
* The installer only writes into `.claude/skills/` and `tools/agents/licenses/`.

### Step 3. Read what you installed

Third party skills are instructions that can ship scripts. Look before you trust:

```bash
grep -rn -E "allowed-tools|hooks|subprocess|requests|urllib|socket" .claude/skills
```

At the pinned commits I found:

* The Phaser skills are Markdown only, and use only `name` and `description` in their headers.
* pixel-art-studio uses only Pillow and the standard library. It makes no network calls, runs no subprocesses and uses no `eval`. It does write learned palettes into its own `references/learned/` folder.
* webapp-testing contains a helper that starts your dev server with `subprocess`. That is its purpose, and it is why it is optional.

If you see anything new after a future update, such as `allowed-tools`, read it before accepting. The official docs warn that a project skill can grant itself broad tool access, even in a folder you have not trusted.

### Step 4. Install Pillow

This is a local tool, not a project dependency, so it does not touch `package.json`.

```bash
python3 -m pip install pillow
```

```powershell
py -m pip install pillow
```

### Step 5. Add the npm scripts and git ignores

Merge the two scripts from `tools/agents/package-scripts.snippet.json` into the `scripts` block of your `package.json`:

```json
"assets:check": "python3 tools/assets/check_palette.py client/public/assets",
"prose:check": "python3 tools/agents/check_prose.py docs client/src supabase"
```

On Windows without `python3` on the path, use `py` instead of `python3` in both lines.

Add these lines to `.gitignore`:

```
art/previews/
.claude/settings.local.json
.claude/agent-memory-local/
```

Check that both scripts run (the first prints that there are no PNGs yet, which is fine):

```bash
npm run assets:check
npm run prose:check
```

`prose:check` scans `docs`, `client/src` and `supabase` for em dashes, en dashes and spaced hyphens used as dashes. I ran it against your four design documents and it found none, so a clean result means your own rule is being kept.

### Step 6. Add the crew section to CLAUDE.md

Append the contents of `tools/agents/CLAUDE.crew-section.md` to the end of your `CLAUDE.md`. It is short on purpose. Every subagent loads `CLAUDE.md` when it starts, so anything you add there is paid for on every delegation. Procedures belong in skills, which load only when needed.

### Step 7. Create the working folders

```bash
mkdir -p art/briefs art/src art/previews docs/specs docs/qa docs/audio docs/text client/public/assets/sprites
```

```powershell
"art/briefs","art/src","art/previews","docs/specs","docs/qa","docs/audio","docs/text","client/public/assets/sprites" | ForEach-Object { New-Item -ItemType Directory -Force $_ }
```

Git does not track empty folders. They fill up as the roles work.

### Step 8. Optional hardening (recommended)

`tools/agents/settings.example.json` holds a small set of rules. Merge it into `.claude/settings.json` (create the file if you have none):

| Rule | What it does |
|-|-|
| `Bash(git push --force *)` and `Bash(rm -rf *)` deny | Stops two destructive commands for the main session and every subagent |
| `Read(./.env)` style denies | Keeps secrets such as the Supabase service role key out of the model's context |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` set to 2 | Keeps delegation chains short and reviewable. The default is 3 layers. |

Check the deny rule syntax against the permissions page of the official docs, since it evolves. Adjust the `.env` paths to wherever your secrets really live.

### Step 9. Commit

```bash
git add .claude tools docs art CLAUDE.md package.json .gitignore
git commit -m "Add crew roles, skills and checker tools"
```

Do not push yet. Verify first.

## Part 2: Verify (15 minutes)

### V1. Check the files parse

```bash
claude plugin validate .claude/agents
claude plugin validate .claude/skills
```

Both should finish without errors. Claude Code silently skips an agent whose header has no `name`, no `description` or broken YAML, so this check matters. Field names are case sensitive (`maxTurns`, `disallowedTools`) and a misspelled field is ignored without a warning.

### V2. Start a session and look around

```bash
claude
```

Inside the session:

1. Run `/doctor`. It reports the context cost of your skills and flags problems with `CLAUDE.md`.
2. Type `/` and confirm that `/feature` and `/gate` appear in the menu.
3. Ask: `Which subagents can you delegate to?` You should see the eight Rumtide roles plus Claude Code's built in ones.

If the `.claude/agents` folder did not exist when the session started, quit and start again. A running session does not notice a brand new agents folder. After that, edits to agent files are picked up within seconds.

### V3. Catch misspelled fields

```bash
claude --debug
```

Then search the debug log at `~/.claude/debug/<session-id>.txt` for `does not recognize or apply`. It names fields Claude Code ignored, with a suggested spelling (Claude Code 2.1.296 or later).

### V4. Smoke test each role

Open a session in the repo root and paste these one at a time. The `@` form guarantees that a specific role runs.

| Role | Prompt | What good looks like |
|-|-|-|
| art-director | `@"art-director (agent)" What size is the sloop, and which colours may a ship use?` | 32 by 32 and Endesga 32 only, with the art bible as the source |
| game-designer | `Use the game-designer subagent to find where the fairness factor lives and which balance.ts names control it. Change nothing.` | It searches the docs and `balance.ts` and does not edit anything |
| narrative-writer | `Use the narrative-writer subagent to write three Gazette headline templates for a captain breaking a blockade, in all three Favour tiers.` | Nine headlines, each under 60 characters, no dashes, only real variables |
| engineer | `Use the engineer subagent to run typecheck and tests and report. Change nothing.` | It runs both commands and quotes the real results |
| sound-designer | `Use the sound-designer subagent to list the Season 0 sound events in a table.` | A table with trigger, mood, length, loudness tier, scene |
| qa-tester | `Use the qa-tester subagent to run the sweep and write docs/qa/baseline.md.` | It runs the commands in order and lists what it did not test |
| pixel-artist | `Use the pixel-artist subagent to make a 16 by 16 gold coin icon. Write your own one line brief first.` | A build script in `art/src/`, a PNG in `client/public/assets/sprites/icons/`, and a passing palette check |
| producer | Start with `claude --agent producer`, then: `Summarise where Rumtide stands in five lines and list the next three tasks.` | It offers to create `docs/STATUS.md` and does not try to run commands |

If a role produces nonsense, read its file. The prompt is short enough that the problem is usually visible.

## Part 3: First real runs (1 to 2 hours)

Do these in order. Each one produces a file the crew relies on later. Use `claude --agent producer` for the first, a normal `claude` session for the rest.

**C1. Status board.**

```
Create docs/STATUS.md from docs/DECISIONS.md and the current repo. Include: current phase,
what is done, what is in progress, what is next, what is blocked, the cut list from the
design docs, and the top five risks. Show me before you save.
```

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

**C6. The first live loop, text only (safe, no code).**

```
/feature Write the first 20 Gazette headline templates, each with three Favour tiers
```

Watch what happens. The producer should split it, the narrative-writer should write it, and qa-tester should run the prose check. If the loop works, you have proved delegation, reporting and the dash rule on something cheap.

**C7. The first live loop with art.**

```
/feature One sloop sprite, 32 by 32, with a sail colour palette swap
```

Expected flow: art-director writes a brief, pixel-artist builds and checks it, art-director approves, and the engineer is not needed. If the sprite fails the palette check, the loop should send it back to the artist, not forward.

## Part 4: Working with the crew day to day

### Two ways to work

| Mode | Command | Use it for |
|-|-|-|
| Normal session | `claude` | Engineering and quick changes. You and Claude, with all skills available. Delegate to a role when its kind of work comes up. |
| Producer session | `claude --agent producer` | Planning, status, scope decisions, coordinating a feature across roles |

Why not run everything as the producer: a session started with `--agent` uses that agent's prompt instead of Claude Code's default system prompt, and the producer has no Bash tool. It is a planner, not a coder. Do not set `agent` in `settings.json`, because that would turn every session into a producer session.

Handy shortcut:

```bash
alias crew='claude --agent producer'          # bash or zsh
```

```powershell
function crew { claude --agent producer @args }   # PowerShell profile
```

The producer may spawn only the seven other roles. That allowlist is in its `tools` line, and it applies only when the producer runs as the main session.

### Which role for which request

| You want | Ask | Example |
|-|-|-|
| A plan or a decision about order | producer | `Plan the next two weeks to Season 0 and show what to cut if I lose a week.` |
| A rule or a number changed | game-designer | `Fights feel decided by stats. Tune it using the tuning guide and show before and after.` |
| A new look or a review | art-director | `Write the brief for the brigantine, then review it when it exists.` |
| A sprite or icon | pixel-artist | `Make the brigantine from art/briefs/ship_brigantine_48.md.` |
| Any player facing text | narrative-writer | `Write the 12 exploration event cards with one joke each.` |
| Code | engineer, or the normal session | `Implement docs/specs/standing_orders.md.` |
| Proof that it works | qa-tester | `Run the sweep after that last change.` |
| Sound plans | sound-designer | `Specify the Tide jingle and the battle stings.` |
| A whole feature | `/feature` | `/feature Standing orders` |
| Milestone check | `/gate` | `/gate season_0_internal_playtest` |

### Delegating well

Subagents start fresh. They see `CLAUDE.md` and their own prompt, not your conversation. So every delegation should include:

1. The goal in one sentence.
2. The exact files or doc sections to read.
3. Acceptance criteria that a command can check.
4. What not to touch.
5. A request to report in under 200 words.

Keep tasks to half a day or two days of work. One role per task. If a task needs two roles, it is two tasks.

### Three worked examples

**Balance tuning.** You say: `Use the game-designer subagent. Playtest bots show fights feel decided by stats. Use the tuning guide in GAME_DESIGN section 14.` The designer states the problem with a number from `npm run sim`, changes one value in `balance.ts` (the guide suggests `combat.exponent` to 0.4), reruns sim and bots, and reports before and after. It does not touch engine logic. If the fix needs logic, it hands a spec to the engineer.

**A new ship sprite.** art-director writes `art/briefs/ship_frigate_64.md`. pixel-artist builds `art/src/ship_frigate_64.py`, renders a preview, critiques and fixes it twice, exports to `client/public/assets/sprites/ships/`, and runs the palette check. art-director reviews and starts with `ART REVIEW: APPROVED` or `CHANGES NEEDED`. The engineer then wires the file using the path in the brief.

**Gazette text.** narrative-writer reads `docs/LORE.md`, writes three variants per headline in three Favour tiers, and lists any new variables it needs from the engineer. qa-tester runs `npm run prose:check` and the text length budgets. Text is data: the writer never edits engine code.

### Who owns which files

| Files | Owner |
|-|-|
| `docs/STATUS.md`, `docs/IDEAS.md`, new entries in `docs/DECISIONS.md` | producer |
| `docs/specs/`, numbers in `balance.ts` | game-designer |
| `docs/LORE.md`, `docs/text/` | narrative-writer |
| `art/briefs/`, the art bible skill | art-director (with your approval for changes) |
| `art/src/`, `client/public/assets/sprites/` | pixel-artist |
| `docs/audio/` | sound-designer |
| `docs/qa/` | qa-tester |
| All other code, migrations, Edge Functions, wiring of assets and sound | engineer |

When two roles need the same file, one of them is wrong. Fix the ownership before the work, not after.

### The gate before a milestone

```
/gate season_0_internal_playtest
```

QA, art, text, balance and sound reviews run, mostly in parallel, then the producer gives READY or NOT READY with blockers and a cut list. A step that cannot run is reported as NOT ASSESSED, never guessed. The Season 0 definition of done is in `GAME_DESIGN.md` 16.1.

## Part 5: Best practices

### Keep the context cheap

| Item | Size, roughly | When it loads |
|-|-|-|
| The eight agent descriptions together | about 440 tokens of a 15,000 token limit | Every session |
| The 20 skill descriptions (21 with webapp-testing) | one or two lines each | Every session. `/feature` and `/gate` are not counted, because they are user only. `/doctor` shows the cost, `/skill-doctor` finds unused ones. |
| `rumtide-art-bible` | 3.6 KB | Preloaded when art-director or pixel-artist starts |
| `rumtide-lore` | 3.5 KB | Preloaded when narrative-writer starts |
| `rumtide-sound` | 2.7 KB | Preloaded when sound-designer starts |
| `pixel-art-studio` | 9.5 KB, its references load on demand | Preloaded when pixel-artist starts |
| 16 Phaser skills | about 299 KB together | Only when the engineer loads one |

Preloading injects the full skill into the agent every time it starts. That is right for short rule sets and wrong for big references. Do not add the Phaser skills to a `skills:` line.

Only the engineer and qa-tester have the `Skill` tool. Leaving `Skill` out of an agent's `tools` list stops it loading skills at all, so add it if you give another role a skill to load on demand.

### Make rules mechanical

Prompts get forgotten, checks do not. The palette checker and dash checker are the examples. When Claude keeps breaking a rule, write a small script and put it in the sweep. If it must hold on every edit, the official docs suggest a hook.

### Parallel work

Run only read mostly roles in parallel: narrative-writer, art-director, sound-designer and game-designer spec writing. Never let two roles edit the same file. For risky experiments, a subagent can be given `isolation: worktree` in its header so it works in a throwaway copy of the repo.

### Cost

Subagents use the same usage limits as your main session, and you plan two developers on two subscriptions. The agents already use Sonnet for qa-tester and sound-designer. If limits get tight, set `CLAUDE_CODE_SUBAGENT_MODEL` to `sonnet` or `haiku` in settings. Add `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` set to `1` to apply it to every subagent, which also ignores the `model` line in each agent file.

### Memory between sessions (optional, off by default)

Adding `memory: project` to an agent's header gives it a folder in `.claude/agent-memory/<name>/` where it can keep notes, shared through git. It suits art-director and narrative-writer. Memory also gives the agent Read, Write and Edit tools, which would let qa-tester edit files, so do not enable it there. Skip it until you see an agent repeating the same mistake, and review what it writes like any other file.

### Improve it from evidence

After two weeks, check which roles you actually used and which instructions Claude ignored. Fix the file, not the conversation. Anthropic's `skill-creator` plugin (`/plugin install skill-creator@claude-plugins-official`) can run with and without comparisons on a skill. Change the art bible only with your approval, and record the change in `docs/DECISIONS.md`.

### The second developer

* The whole `.claude/` folder is in git, so both of you get the same crew. Treat agent and skill edits like code changes, with review.
* Personal overrides go in `.claude/settings.local.json`, which is git ignored.
* A natural split that matches your design doc: one person owns `supabase/`, the engine, qa-tester and game-designer work. The other owns `client/`, art, audio and narrative. The producer files and `DECISIONS.md` are shared, and engine changes need both to review.
* Each person uses their own subscription and branch. Merge daily and use the Cloudflare preview link for each branch.

## Part 6: Safety and trust

**Bash access.** Five roles have Bash: art-director, pixel-artist, game-designer, engineer and qa-tester. The tool cannot be limited to certain commands in an agent file, so each prompt names what it may run, and the deny rules from Step 8 catch the worst cases. To remove permission prompts for the safe commands, add allow rules to `.claude/settings.local.json`, for example `Bash(npm run *)` and `Bash(python3 tools/*)`.

**Network.** Only the installer uses the network. No role has web search or fetch tools. The pixel-art-studio scripts make no network calls.

**Secrets.** Keep the Supabase service role key out of prompts and out of files the agents read. The `Read` denies in the settings example help. Never paste secrets into a delegation.

**Updating third party skills.** Never bump a pin blindly. Clone the upstream repo, compare the old and new commits, read the changes in `skills/` or the skill folder, then edit the hash in `tools/agents/install_third_party.sh` and rerun with `--force`.

**Untrusted content.** A downloaded CC0 pack, its README or a licence text is data, not instructions. If an agent reports "the README says to run this command", do not run it without reading it first. Claude Code scans subagent reports for instruction shaped text since version 2.1.210, but that is a backstop, not a guarantee.

**Licences.** Record the source, author and licence of every imported asset in `client/public/assets/CREDITS.md`. Rumtide is non commercial and for friends, but keep the file anyway. It also protects you if the project grows. The upstream licences for the installed skills are in `tools/agents/licenses/`.

## Part 7: Troubleshooting

| Symptom | Cause | Fix |
|-|-|-|
| An agent does not appear | The `.claude/agents` folder was created after the session started, or the header is invalid | Restart Claude Code, then run `claude plugin validate .claude/agents` |
| A skill does not trigger | Description too vague, or broken YAML | Run `claude --debug` and `claude plugin validate .claude/skills`. Invoke it directly as `/name`. |
| New skills folder not noticed | The skills folder did not exist at session start | Run `/reload-skills` |
| The producer cannot spawn a role | It is running as a subagent, not as the main session | Start it with `claude --agent producer`. The allowlist only works there. |
| The engineer ignores the Phaser skills | `Skill` missing from its `tools` line | Add `Skill` to the line |
| A role edits files it should not | Instruction not specific enough | Add a "you must not" line, and consider removing the Write or Edit tool |
| Phaser 3 code appears | The model fell back to old training data | Tell the engineer to load the right Phaser skill and check `node_modules/phaser/types/phaser.d.ts` |
| Warning about agent descriptions over 15,000 tokens | Too many agents or very long descriptions | Shorten the `description` lines, move detail into the body |
| `pixel-art-studio` fails on `import PIL` | Pillow is not installed for the Python you are using | `python3 -m pip install pillow`, or `py -m pip install pillow` on Windows |
| The installer says HASH MISMATCH | The upstream commit is not the one pinned, or the download was altered | Do not continue. Check the URL and hash and look at the upstream repo before anything else. |
| The installer fails on Windows | PowerShell or cmd cannot run bash | Use Git Bash or WSL |
| Subagent output arrives late or in the background | Fork mode runs subagents in the background by default in interactive sessions | Wait for the completion notice, or check `/tasks` |

## Part 8: Maintenance

A ten minute weekly routine:

1. Run `/doctor` and look at context cost.
2. Skim `docs/STATUS.md`. If it is stale, the crew is working from old information.
3. Skim the last QA report. Is the same bug class coming back? That points to a missing check.
4. Read any agent file that gave bad output this week and fix the instruction.
5. Move one recurring problem from a prompt into a script.

Adding a ninth role, such as a release manager, is worth doing only when a job keeps being done badly by the others. Copy an existing agent file, give it the fewest tools that work, one owner folder and a 200 word report rule. To remove a role, delete its file and its name from the producer's `tools` line.

## Appendix A: File inventory

| Path | Purpose |
|-|-|
| `.claude/agents/*.md` | The eight roles |
| `.claude/skills/rumtide-art-bible/` | Palette, sizes, UI look, art rules |
| `.claude/skills/rumtide-lore/` | Voice, humour limits, Gazette rules, text budgets |
| `.claude/skills/rumtide-sound/` | Sound direction, events, file limits |
| `.claude/skills/feature/` | `/feature` workflow |
| `.claude/skills/gate/` | `/gate` workflow |
| `tools/agents/install_third_party.sh` | Pinned installer for Phaser, pixel-art-studio and optional webapp-testing |
| `tools/agents/check_prose.py` | Dash checker |
| `tools/assets/check_palette.py` | Palette and alpha checker |
| `tools/agents/CLAUDE.crew-section.md` | Text to append to `CLAUDE.md` |
| `tools/agents/settings.example.json` | Optional deny rules and nesting depth |
| `tools/agents/package-scripts.snippet.json` | npm scripts to merge |
| `tools/agents/THIRD_PARTY.md` | Sources, pins and licences |

## Appendix B: Tool access by role

| Role | Read, Grep, Glob | Write, Edit | Bash | Skill | Other |
|-|-|-|-|-|-|
| producer | yes | yes | no | no | Agent, limited to the seven other roles |
| art-director | yes | yes | yes | no | |
| pixel-artist | yes | yes | yes | no | |
| game-designer | yes | yes | yes | no | |
| narrative-writer | yes | yes | no | no | |
| engineer | yes | yes | yes | yes | |
| qa-tester | yes | Write only | yes | yes | |
| sound-designer | yes | yes | no | no | |

## Appendix C: Official documentation

* Subagents: https://code.claude.com/docs/en/sub-agents
* Skills: https://code.claude.com/docs/en/skills
