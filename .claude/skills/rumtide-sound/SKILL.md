---
name: rumtide-sound
description: "Rumtide's sound rules: shanty flavoured chiptune, the four music loops, battle stings, the Tide jingle, sound effect events, mix and file limits, muted start behaviour and the cut order. Use when a scene, mechanic or moment needs sound or when checking audio."
---

# Rumtide sound

Source: `docs/GAME_DESIGN.md` section 2.3. If this file and that section disagree, the document wins.

## Direction

Shanty flavoured chiptune with a slightly rough folk feel, short stings for battle, and one signature Tide jingle. Reference points from the design: worn instruments and stings that do not push players into fights, clear melodies, a satisfying coin sound, crew shanties.

## Music (cut first when time is short)

Four loops, 60 to 90 seconds each:

| Loop | Mood | Plays when |
|-|-|-|
| Port | Relaxed shanty, accordion and whistle | In ports |
| Open Sea | Rolling 6/8 rhythm | On the map |
| Tide Report | Hopeful, builds slowly | On the Tide Report and Gazette |
| Danger | Low drums | On the map only when a hunter is adjacent |

Battle replays use stings, not loops: a drum roll when plans are revealed, a brass hit for a won round, a sad trombone slide for a struck flag.

## The Tide jingle

A 3 second motif, bell plus fanfare. It plays when the Tide resolves and in every notification. It is the group's bell, so keep it short and always the same.

## Sound effects (make these first)

Starter list, the sound-designer finalises it. Coin, upgrade ding (every number that goes up gets a small celebration), cannon, splash, hull hit, grapple, UI tap, Ready press, port bell, reef scrape, parley horn. Each gets one row in `docs/audio/events.md`.

## Behaviour rules

* Audio starts muted until the first tap, because browsers require it, and remembers the player's choice.
* Music never pushes players into fights. Danger plays only when a hunter is adjacent.
* One sound per event. Rapid repeats may not stack into noise: set an overlap rule per event.

## Mix and files (proposed, adjust after listening on a phone)

* Effects sit below the Tide jingle, which sits above music.
* Keep every loop under 400 KB and the whole Season 0 audio under 3 MB.
* Prefer `.ogg` for loops and effects. Names are lowercase with underscores, for example `sfx_coin.ogg`, `mus_port.ogg`, `jingle_tide.ogg`.

## Tools with no budget

BeepBox or jummbox in the browser for music, jsfxr for effects, freesound.org for CC0 waves and gulls. Record the source and licence of anything that is not made by the team.

## Cut order

Music first, then extra stings. Keep the Tide jingle and the coin, cannon and splash sounds as long as possible.
