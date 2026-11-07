# Rumtide crew: install, verify and first runs (archived)

Parts 1 to 3 of the old crew guide, moved here word for word on 5 November 2026 because the crew is installed and these steps are done. Parts 4 and 5 (working with the crew day to day, best practices) are in `docs/CREW.md`. The first real runs C1 to C7 are in Part 3 below.

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

**C2 to C5** moved to `docs/briefs/content-tasks.md`.

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
