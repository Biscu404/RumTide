---
name: rumtide-lore
description: "Rumtide's voice and writing rules: tone, humour limits, the Gazette and its editor Polly Quillsworth, headline wording by Favour tier, glossary, text length budgets and a writing checklist. Use when writing or checking any player facing text, story, character, event card, item flavour or NPC line."
---

# Rumtide lore and voice

Facts come from `docs/LORE.md`, `docs/GAMEPLAY.md` (sections 1.4, 2 and 16) and `docs/GAME_DESIGN.md` (sections 2.4 and 10). This skill only holds the voice rules. If they disagree, the documents win.

## Tone

* Warm, cheeky, a bit absurd. Think Monkey Island and Kingdom of Loathing, not grimdark.
* One joke per item at most, in one or two short lines. Example of the register: *"A Suspiciously Damp Map. Someone has clearly sat on it."* and *"Ghost Lantern. Nothing happens. Your crew will not stop talking about it."*
* No toilet humour, no cruelty, no real world colonial villains. The antagonists are the stuffy Admiralty, sea monsters and each other.
* Pirate speak lives in labels only: doubloons, Struck Colours, Parley, Shore Leave. A glossary tooltip explains each term once. Do not write whole lines in pirate dialect.
* **Tease what a captain did in the game, never who they are.** Real friends read this.

## Hard rules

* No dashes in any text. Use commas and full stops. Run `npm run prose:check` after writing text files.
* Never invent a mechanic. A story idea that needs a new rule goes to the producer.
* Any fact you invent is marked PROPOSED until Biscu approves it.
* Use only variables the engine event log provides. Write them like `{captain}` and `{port}`. Need a new one? List it under "Needs from engineer".

## The Gazette

* One edition per Tide, same format every time. Sections: three headlines, the battle of the Tide, market news, wind forecasts, rivalry tallies, hotspot notices, one rumour (possibly false), and Polly's gossip column.
* The editor is Polly Quillsworth (a working name). She holds a Favour score for every captain, from hostile to adoring, and Favour decides the wording of the same event.
* For every headline template write three tiers: adoring, neutral, hostile. Example pair from the design: *BRAVE BISCU BREAKS BLOCKADE* against *BISCU BUMBLES THROUGH BLOCKADE*. The hostile tier mocks the deed, not the person.
* Running gags are allowed when they count real events, such as a repeated blunder with a running tally.
* Season 0 plan: about 200 headline templates with variables.

## Player written text

Ship names, flags and the one line Parting Shot taunt shown in replays are written by players. Keep the Parting Shot input short and filter it. Provide a few example Parting Shots in the "How to play" page.

## Text budgets (proposed starting limits, test on a small phone)

| Text | Limit |
|-|-|
| Gazette headline | 60 characters |
| Event title | 32 characters |
| Event body | 140 characters |
| Item name | 28 characters |
| Item flavour | 90 characters |
| NPC line | 120 characters |
| Tooltip | 100 characters |
| Parting Shot (player) | 80 characters |

## Checklist before you hand text over

1. Matches the tone and has one joke at most.
2. Under the length budget.
3. Only real variables.
4. Glossary terms used correctly, no pirate dialect.
5. No dashes, no cruelty, nobody real is the butt of the joke.
6. Still fits the mechanic it describes and the art it sits beside.
7. Three variants written, pick marked.
