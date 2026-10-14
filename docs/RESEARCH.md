# Rumtide: Research Notes

Version 0.1, 14 October 2026. Companion to [GAME_DESIGN.md](GAME_DESIGN.md).

## How to read this

Every finding has the same shape: what we found, where it came from, what to copy, what to avoid, and how strong the evidence is.

Evidence strength:

* **Strong**: a developer statement or official doc, backed by consistent player sentiment.
* **Medium**: one good source, or several sources that agree but are anecdotal.
* **Thin**: a single review, my own general knowledge, or an inference from a neighbouring genre.

A note on method. Direct Reddit threads were mostly unreachable from my research tools, so player sentiment comes from aggregated Steam review summaries (Vaporlens, which is itself an AI summary of reviews, so treat its weights as rough), official forums, a Reddit mirror, press reviews, developer interviews and design essays. Where a claim rests on my general knowledge rather than a fetched source, I say so.

# 1. Pirate and naval games

## 1.1 Puzzle Pirates (Three Rings, 2003)

**Found.** Nearly every activity is a short puzzle: sailing, gunnery, carpentry, swordfighting. Each ship has duty stations, crews work them at the same time, and better individual play makes the whole ship perform better. The team of six chose 2D sprites over 3D for budget reasons and chose horizontal progression over level tiers so the population would stay together. Daniel James described the core idea as pairing a puzzle game's "tight short time period fun loop" with the long term loop of MMO progression and community. New players adopted pirate speak instantly; James said a newcomer "immediately gets it". On Steam today the most praised things are the puzzles, the small friendly community and the player driven economy. The main complaints are a small population, inflation and exploits that hurt the economy, expensive doubloon monetization, and a sense of abandonment.

Blockades (the big group battles) are declared with a public notice period of usually 24 hours, run as five 45 minute rounds, require a war chest deposit, and are scheduled for when most players can attend.

* **Copy:** short personal skill moments that feed a shared ship; big group battles that are announced in advance; crews and flags as identity; progression that never splits friends apart.
* **Avoid:** an open economy without sinks (inflation), monetization that feels like gambling, letting the game go stale.
* **Strength:** Strong.
* Sources: [Engadget, The Game Archaeologist](https://www.engadget.com/2012-07-10-the-game-archaeologist-puzzle-pirates.html), [Vaporlens review summary](https://vaporlens.app/app/99910/puzzle_pirates), [YPPedia: Blockades](https://yppedia.puzzlepirates.com/Official:Blockades).

## 1.2 Sea of Thieves (Rare, 2018)

**Found.** Rare built tools that let players "truly feel like they were working together" and let stories emerge from combining those tools. Progression is cosmetic on purpose "to remove barriers that stop players playing together", and quest progress is shared by the whole crew. Loot stays on your ship until you cash it in at an outpost, which creates deliberate tension: "To have that high high you've got to have the low low." When you sink you lose the chests on board, but you keep banked gold, items and reputation. Rare wants a loss to feel meaningful but not crippling.

Player sentiment: praise for deep but accessible ship mechanics, art, the pirate fantasy and group play. The most mentioned complaint by far is PvP disrupting PvE, followed by griefing aimed at new and solo players, lack of meaningful progression, a poor solo experience and cheating. Safer Seas (December 2023) added single crew servers, but at 30% of normal gold and reputation and a reputation cap of level 40. Players argue about it: PvP fans say loot risk is the whole thrill, PvE fans say harassment drove them away, and many see the reduced rewards as a half measure.

The Emissary system is a great reference for risk that escalates with visibility. Emissary grades 1 to 5 multiply gold from 1x to 2.5x. Sinking loses your status. Reaper's Bones emissaries are visible on every crew's map, and at grade 5 a Reaper crew can see every other emissary ship.

* **Copy:** only carried loot is at risk, banking makes it safe; shared crew progress; cosmetic trophies; bigger rewards come with being more visible and more hunted.
* **Avoid:** forcing peaceful players into PvP with no good way to progress; a "safe mode" with crippled rewards that players resent; no progression at all (a deliberate trade off that many players dislike).
* **Strength:** Strong.
* Sources: [Windows Central interview](https://www.windowscentral.com/the-sea-of-thieves-vision-interview), [Vaporlens review summary](https://vaporlens.app/app/1172620/sea_of_thieves), [Safer Seas press release](https://www.gamedeveloper.com/press-release/safer-seas-mode-brings-single-crew-servers-to-_sea-of-thieves_), [Reddit mirror: Safer Seas and PvE growth](https://lr.us.psf.lt/r/Seaofthieves/comments/17167h0/safer_seas_and_pve_growth), [GamesRadar on Emissaries](https://gamesradar.com/sea-of-thieves-emissaries).

## 1.3 Sid Meier's Pirates! (1987, 2004)

**Found.** Meier wanted adventure rather than pure combat: "Pirates had adventures." You cannot lose outright. A lost duel means prison and escape, a sunk ship means washing ashore. The career ends with retirement and a final score. Soren Johnson's summary of Meier's lessons uses Pirates! as the positive example of the "Covert Action rule": its sailing, fighting and dancing minigames last minutes and serve one larger goal. Other lessons: a game is a series of interesting choices, choices must be informed, realism serves play, the player must always be the star, and make bold changes when tuning (double or halve, never nudge).

Players still praise the integrated minigames most, then the balanced difficulty and the open world freedom. Complaints: shallow economy and town management, repetition once mastered, unclear goals, and forced retirement or harsh losses that felt unfair to some.

* **Copy:** setbacks instead of game overs; short scenes that all serve one main loop; a career with a graceful end and a score; tune boldly.
* **Avoid:** a thin trade layer; battles that all feel the same; a clock that punishes one player personally.
* **Strength:** Strong.
* Sources: [No Dice No Glory retrospective](https://nodicenoglory.com/retrospective-of-sid-meiers-pirates/), [Game Developer: Sid Meier's key design lessons](https://www.gamedeveloper.com/game-platforms/analysis-sid-meier-s-key-design-lessons), [Vaporlens review summary](https://vaporlens.app/app/3920/sid_meiers_pirates).

## 1.4 Assassin's Creed IV: Black Flag (2013)

**Found.** Reviewers single out naval combat and the freedom of the sea as what kept them playing, often over the story. Upgrades bought with plunder (cargo space, ram, sails, a custom figurehead) make the ship feel like yours. The crew sings shanties while you sail. Skull and Bones reviewers keep naming Black Flag as the better game.

* **Copy:** the ship as a character that visibly changes as you upgrade it; crew shanties as ambience.
* **Strength:** Medium.
* Source: [UFV Cascade review](https://ufvcascade.ca/cascade-arcade-assassins-creed-iv-black-flag/), plus the Skull and Bones comparisons in 1.5.

## 1.5 Skull and Bones (Ubisoft, 2024)

**Found.** Naval combat is the most praised part. Complaints: bugs and instability, repetitive mechanics, a grindy late game, tedious fetch missions, a small map, poor value at full price, and unfavourable comparisons with Black Flag.

* **Avoid:** live service grind where the only change is bigger numbers; fetch quests as filler.
* **Strength:** Medium.
* Source: [Vaporlens review summary](https://vaporlens.app/app/2853730/skull_and_bones).

## 1.6 Indie and browser pirate games

* **Windward (Tasharen):** each player has their own ship, friends sail together, trade, fight and claim territory. The reviewer rated the co op 4 out of 5 and the game 3 out of 5: co op and multiship battles are the best part, the slow opening and poor explanations are the worst. *Copy* the "own ship, sail together" model. *Avoid* unexplained systems. [Co Optimus review](https://www.co-optimus.com/review/1478/page/2/windward-co-op-review.html). Strength: Medium.
* **Pixel Piracy:** ship building from parts bought at islands is the highlight; constant toilet humour and fiddly crew feeding and wages (crew starve or mutiny) are the main complaints. *Copy* buying parts that visibly change the ship. *Avoid* gross out humour and upkeep that punishes you for being away. [GamersNexus review](https://gamersnexus.net/games/1484-pixel-piracy-review-parlay-please). Strength: Medium.
* **Plunder, Online Pirate Battle (CrazyGames, 2026):** top down broadside combat where turning and positioning matter, quick matches, rated 9.0 from about 1,300 votes, but progress only lasts one session. *Copy* the readable broadside silhouettes for our replays. *Avoid* nothing carrying over. [CrazyGames page](https://www.crazygames.com/game/plunder-2d---online-pirate-battle-brp). Strength: Thin.
* **Pirates of the Burning Sea, Pirate101, Pirates of the Caribbean Online:** heavy PvP "EVE on water", board game style turn combat, and a kid friendly Disney MMO revived by fans. Mostly useful as proof that turn based naval combat and fan loyalty both work. [Massively OP list](https://massivelyop.com/2026/06/10/perfect-ten-pirate-mmos-that-boarded-and-plundered-our-gaming-pcs/). Strength: Thin.

# 2. Async and turn based multiplayer

## 2.1 Neptune's Pride (Iron Helmet, 2010)

**Found.** A real time browser strategy game where a match takes "on average, a month, a real world month" and "never stops playing". Diaries describe lost sleep, paranoia, every conversation getting "an agenda", and friends turned against each other. A player knocked out early switched his goal to "not being the first to lose". Another ended the game early because he "didn't want to drag things out for another week". Yet players still recommend it because it is against real people. The sequel added a turn based mode: the clock jumps 6, 8, 12 or 24 hours once every player presses submit, or when the deadline passes, at which point missing players are made ready automatically.

* **Copy:** resolve when everyone is ready or when the deadline hits, whichever comes first; diplomacy and rivalry as the main drama.
* **Avoid:** real time pressure that rewards checking at 3am; month long games where a beaten player has nothing to do; elimination.
* **Strength:** Strong.
* Sources: [bit tech, The Price of Neptune's Pride](https://www.bit-tech.net/reviews/gaming/pc/the-price-of-neptune-s-pride/1/), [bit tech, The Last War Diary](https://bit-tech.net/reviews/gaming/pc/neptune-s-pride-the-last-war-diary/3/), [Electron Dance, The Remnant](https://www.electrondance.com/the-remnant/), [Triton Codex: turn based games](https://triton.ironhelmet.com/help/turn_based_games).

## 2.2 Subterfuge (Ron Carmel and Noel Llopis, 2015)

**Found.** The design goal was to "Respect the player's time (with a capital R)" and to minimize, not maximize, time spent in the game. Push alerts fire only for important events. Outcomes are deterministic, and a "time machine" lets you preview a plan's result. Orders can be scheduled. Nothing important resolves in under about 8 hours (one sleep cycle), so heavy checkers gain little. Games last six to nine days, and the game "is actually meant to be played two minutes at a time". A reviewer spent about five minutes a day.

* **Copy:** deterministic resolution and a preview tool; notifications only when something matters; two minute sessions; nothing can happen faster than a night's sleep.
* **Strength:** Strong.
* Sources: [Game Developer, Quality of life in Subterfuge](https://www.gamedeveloper.com/design/quality-of-life-in-subterfuge), [MCV interview](https://www.mcvuk.com/we-wanted-to-minimise-the-number-of-times-per-day-a-player-has-to-check-in/), [Kill Screen](https://www.killscreen.com/subterfuge-strategy-game-parents-and-busy-people/).

## 2.3 Diplomacy online

**Found.** In a study of 10 online games, every single game was hit by a departing player, missed orders lasted several turns, and players who believe they cannot win tend to stop playing. A collapse shifts the balance between the survivors. The suggested human fix is to keep struggling players engaged so they still feel like "one of the guys". Diplomacy is also famous for straining friendships.

* **Copy:** plan for dropouts from day one (standing orders, caretaker behaviour); always give a losing player a reason to log in.
* **Avoid:** any design where one absent player breaks the game for everyone.
* **Strength:** Medium.
* Sources: [Diplomacy Zine, NMRs and civil disorder](https://diplom.org/Zine/S2013R/Hartl/nmrcd.htm), [Bloomberg, the map that ruined a thousand friendships](https://www.bloomberg.com/news/articles/2013-03-07/diplomacy-the-map-that-ruined-a-thousand-friendships).

## 2.4 BBS door games (Legend of the Red Dragon, TradeWars 2002)

**Found.** Each day gave you a fixed number of turns; when they ran out you came back tomorrow. Because only one person could dial in at a time, absent players defended automatically ("when attacking them, they will automatically defend"), and NPCs filled the world between humans. Leaderboards and player to player interaction carried the social side.

* **Copy:** a daily action budget; automatic defence for absent players; NPCs so the world never feels empty; a daily news feed and leaderboard.
* **Strength:** Medium.
* Source: [Andrew Chen on BBS door games](https://andrewchen.com/bbs-door-games-social-gaming-innovation-from-the-1980s/amp/).

## 2.5 Kingdom of Loathing

**Found.** 40 adventures per day as a base, stockpiled up to a cap of 200, with a daily "rollover" reset. Almost every item and quest carries a joke. "Ascension" restarts you from level one with a small meta reward (karma).

* **Copy:** unused actions bank up to a cap, so a missed day is not wasted; jokes in every item description; a reset with a small meta reward.
* **Strength:** Medium.
* Source: [Wikipedia: Kingdom of Loathing](https://en.wikipedia.org/wiki/Kingdom_of_Loathing).

## 2.6 Travian

**Found.** David Edery's analysis: real time pacing stops people with endless free time from overwhelming everyone, and alliances matter because you cannot survive alone. But the time each town demands grows with success, offline players are attacked with little auto defence, coordination happens on outside forums, and personalization is weak so quitting costs nothing. His fixes: make advancement not demand more time, give auto defence and coordination tools, and add personalization.

* **Copy:** big goals need alliances; personalization builds attachment.
* **Avoid:** time demands that grow as you succeed; punishing people for sleeping.
* **Strength:** Strong (detailed, though from 2007).
* Source: [Edery, Travian Under the Microscope](https://edery.org/2007/03/travian-under-the-microscope/).

## 2.7 Words With Friends, Frozen Synapse, Conclave

* **Words With Friends:** multiplayer only, you are in a game within seconds, growth came from friends inviting friends. The earlier Chess With Friends lacked push alerts, which was flagged as a weakness. *Copy* zero friction entry and "your move" alerts. [TechCrunch](https://techcrunch.com/?p=188060). Strength: Medium.
* **Frozen Synapse:** simultaneous turns, unlimited planning time, a simulate button that assumes the enemy keeps their current plan, then about five seconds of deterministic playback that both players watch, plus saved replays. Metacritic 85, IGF Audience Award. *Copy* plan, commit, watch the playback. [Wikipedia](https://en.wikipedia.org/wiki/Frozen_Synapse). Strength: Strong.
* **Conclave (async co op RPG):** a fixed turn order made players wait on each other, so it was removed; open order created conflicts that needed resolution rules. *Copy* simultaneous orders resolved by rules, not a turn queue. [Game Developer](https://gamedeveloper.com/design/making-asynchronous-gameplay-work-for-more-than-two-players). Strength: Medium.

# 3. Incremental and idle progression

## 3.1 The math of idle games (Anthony Pecorella, Kongregate)

**Found.** Idle games are "a seesaw between production rates and costs". Cost grows exponentially (`cost = base * rate ** owned`, AdVenture Capitalist uses a rate of 1.07) while production grows linearly times multipliers. Early on you can afford something every moment; then costs overwhelm; then milestone multipliers "bump you back up", producing a satisfying sawtooth. Prestige resets let each run go further than the last.

* **Copy:** exponential costs with linear benefits; milestone jumps (a new ship hull) that restart the feeling of fast progress; a seasonal reset.
* **Avoid:** long flat stretches with nothing to buy; options whose value becomes irrelevant.
* **Strength:** Strong for single player idle games, Medium once you translate it to PvP.
* Source: [The Math of Idle Games, Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i). Pecorella also gave a GDC talk on the same material, Quest for Progress, which I did not review.

## 3.2 Framing: World of Warcraft rested XP

**Found.** WoW originally reduced XP the longer you played and "people just hated it". Blizzard doubled the XP needed per level and reframed the same math as a 200% bonus after time away. Identical outcome, opposite feelings.

* **Copy:** every catch up or anti binge mechanic is framed as a bonus, never a penalty.
* **Strength:** Strong.
* Source: [Psychology of Games](https://www.psychologyofgames.com/2010/03/framing-and-world-of-warcrafts-rest-system/).

## 3.3 Numbers you can feel

**Found.** Frank Lantz (Universal Paperclips) says incremental games make exponential growth and huge differences in scale feel concrete, "physical things you can hold in your fingers".

* **Copy:** make growth visible: the sprite changes from sloop to frigate, the hold fills, the chest overflows.
* **Strength:** Medium.
* Source: [PCGamesInsider interview](https://www.pcgamesinsider.biz/interviews-and-opinion/66271/interview-paperclips-developer-frank-lantz/).

## 3.4 The tension between vertical and horizontal progression

Puzzle Pirates and Sea of Thieves chose horizontal, mostly cosmetic progression to keep friends playing together. Sea of Thieves players list "lack of meaningful progression" as a top complaint. Black Flag and Pixel Piracy players love upgrades that change the ship. **Sources disagree**, so the design takes a middle path: real but capped stat growth inside a season, cosmetics for identity, and a reset at season end.

# 4. Cooperation in small groups

## 4.1 Daniel Cook: design patterns for building friendships

**Found.** Friendship needs proximity, similarity, reciprocity and disclosure. Concrete patterns: balance player count against map size ("density"); a clearly published schedule of recurring events; faction identity; cheap, low risk reciprocity loops that escalate to bigger commitments later; specialized roles that "naturally clump together"; gifting; non zero sum interactions early, zero sum choices only after bonds form; quiet moments for chat; and keeping groups together across sessions.

* **Copy:** a fixed daily ritual and weekly event schedule; fleets with names and flags; roles that depend on each other; cheap ways to help (escorting) before costly ones; peaceful weeks before the cutthroat ones.
* **Strength:** Strong.
* Source: [Game Developer, Game Design Patterns for Building Friendships](https://gamedeveloper.com/design/game-design-patterns-for-building-friendships).

## 4.2 Raph Koster: the trust spectrum

**Found.** Surveyed players ranked cooperating with friends and competing with friends as their top choices, far above cooperating with strangers. Groups of 3 to 4 and sessions of 10 to 30 minutes were the sweet spot. Good designs mix low trust play (anyone can succeed alone) with higher trust synergy, avoid a "broken line" with nothing in between, keep roles overlapping so nobody is indispensable, and make each role a full game. These choices also reduce quarterbacking.

* **Copy:** solo play is always viable, but fleets of 2 or 3 get synergy; roles overlap.
* **Strength:** Strong.
* Source: [Game Developer, The Trust Spectrum](https://www.gamedeveloper.com/design/the-trust-spectrum).

## 4.3 Quarterbacking (the alpha player problem)

**Found.** In co op games one dominant player can work out the best play and direct everyone else, which makes the others feel redundant. Known remedies: hidden information or limited communication, time limits, semi cooperative hidden goals, and personal ownership of decisions.

* **Copy:** every captain owns their ship and their own secret battle plan; a captain's personal score sits next to the fleet's shared goal.
* **Strength:** Medium.
* Sources: [Justin Gary, Why Cooperation Is Hard to Design](https://justingarydesign.substack.com/p/the-quarterback-problem), [Meeple Mountain, Benching the Quarterback](https://www.meeplemountain.com/articles/benching-the-quarterback-how-to-deal-with-alpha-players-in-co-op-games/).

## 4.4 Elite Dangerous: Community Goals

**Found.** Server wide projects with tiers; reaching higher tiers raises everyone's reward; your own participation tier scales your personal payout; some goals change the world (new stations); they are time limited (about a week).

* **Copy:** a season finale goal that everyone feeds, with tiered rewards and a visible world change.
* **Strength:** Medium.
* Source: [Elite Dangerous wiki: Community Goals](https://elite-dangerous.fandom.com/wiki/Community_Goals).

# 5. Fair PvP in small groups

## 5.1 Shields after defeat (Clash of Clans)

**Found.** After a successful attack against you, your village gets a shield of 12 to 16 hours depending on damage. Attacking someone else while shielded eats into your shield. Purpose: recovery time after a loss.

* **Copy:** a short protection window after a loss that ends early if you go on the attack.
* **Strength:** Strong.
* Source: [Clash Ninja guide](https://www.clash.ninja/guides/what-are-shields-and-guard).

## 5.2 Risk zones (Albion Online)

**Found.** Blue zones are safe, yellow zones only knock you down and damage gear, red zones are full loot with a reputation penalty for attackers, black zones are lawless. The best resources sit in the dangerous zones.

* **Copy:** a few map zones where the rules and rewards change, so players pick their risk by where they sail.
* **Strength:** Strong.
* Source: [Albion zones guide](https://www.albionmarket.gg/guides/zones-and-flagging).

## 5.3 Reading the opponent (Sirlin, yomi)

**Found.** Balance means many viable options and no dominant move. Every strong move needs a counter. Double blind commitment (both sides lock in before seeing the other's choice) makes weaker moves useful. A wrong guess should not lead to inescapable death, and repeating the same move should get weaker over time (move staling).

* **Copy:** a three way maneuver triangle with secret, simultaneous plans; repetition penalty; no single round decides everything.
* **Strength:** Strong.
* Sources: [Sirlin, Balancing Multiplayer Games Part 2](https://sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options), [Game Developer, Know Thy Enemy: Designing for Yomi](https://www.gamedeveloper.com/design/know-thy-enemy-designing-for-yomi-in-games).

## 5.4 Kingmaking and leader bashing

**Found.** Eric Jaffe calls kingmaking a "cursed problem", unsolvable because it comes from two conflicting promises. Tools that help: barriers (limit how much you can affect others), gates (hide exact scores), carrots (reward second and third place), and s'mores (make the politics so fun nobody minds). Kemet makes attacking the leader a constant fact of play; Dominant Species hides the score so late swings feel like skill. Cole Wehrle argues kingmaking can be fine when the story matters more than the winner. **Sources disagree** on whether to fight it or embrace it.

* **Copy:** hide exact scores in the final days; prizes for many categories; make the leader a visible but rewarding target.
* **Strength:** Medium (board game design, few digital examples).
* Sources: [Skeleton Code Machine, Is kingmaking cursed?](https://www.skeletoncodemachine.com/p/is-kingmaking-cursed), [The Thoughtful Gamer, Losing Propositions](https://thethoughtfulgamer.com/2017/09/16/losing-propositions/).

## 5.5 Downward spirals

**Found.** Negative feedback that makes a losing player weaker becomes a self sustaining spiral (Children of the Nile, shmups that strip power ups). It feels fair when losses can be recovered (Dark Souls lets you retrieve dropped souls) or when the game is short.

* **Copy:** never take upgrades away; losses come only from what you were carrying.
* **Strength:** Medium.
* Source: [Game Wisdom, Examining Negative Feedback](https://game-wisdom.com/?p=4530).

# 6. The pixel pirate vibe

## 6.1 Monkey Island nostalgia

**Found.** When Return to Monkey Island dropped pixel art for a new style, a loud part of the fanbase called it "ugly", "cheap" and "lifeless", and Ron Gilbert said the reaction made him sad. Pixel art is part of the series' identity for many fans. From general knowledge (not fetched): Monkey Island's tone is light, absurd and self aware, and Michael Land's main theme has a reggae and calypso flavour.

* **Copy:** cheerful, witty, never grim; island music with a Caribbean lilt; insult style banter as flavour, written by us.
* **Strength:** Medium for the nostalgia, Thin for the music claim.
* Source: [Nintendo Life](https://www.nintendolife.com/news/2022/05/negative-fan-reaction-to-return-to-monkey-island-made-its-creator-sad).

## 6.2 Sea of Thieves, Flinthook and Black Flag audio

**Found.** Robin Beanland chose worn, imperfect instruments, including a concertina that sounds like it "spent its life on a pirate ship", and scaled combat music back to short stings so music would not push players into fights; "the players may just want to pull alongside each other and play shanties together". Flinthook's score is praised for fast, clear melodies, a calmer shanty in the shop, and coins that "clack satisfyingly, as every pirate should". Black Flag's crew shanties are a fan favourite.

* **Copy:** slightly rough folk instruments (accordion, fiddle, whistle, hand drum) rendered as chiptune; a shanty for the calm moments; short stings for battle; very satisfying coin sounds.
* **Strength:** Strong.
* Sources: [GameMusic.net interview with Robin Beanland](https://gamemusic.net/?p=11690), [The Sound Architect on Flinthook](https://www.thesoundarchitect.co.uk/flinthook-game-audio-review/).

## 6.3 Palettes and assets

**Found.** Popular palettes: PICO 8 (16 colours, bold and readable at tiny sizes), Endesga 32 (warm rust to cream tones, described as a strong all round choice), Resurrect 64 (varied environments that still feel unified), Sweetie 16 (softer and warmer). Free, high quality pirate assets exist: Pixel Frog's Treasure Hunters pack (CC0, rated 4.9 from 176 ratings, includes a pirate ship, a merchant ship, characters and a wood and paper UI kit) and Kenney's Pirate Pack (190 top down assets, CC0).

* **Copy:** lock one palette early and recolour every asset into it; start from CC0 packs.
* **Avoid:** mixing packs with different palettes and pixel densities (my general knowledge, but it is the most common reason indie pixel games look cheap).
* **Strength:** Strong for the facts, Medium for the advice.
* Sources: [Sprite AI palette guide](https://www.sprite-ai.art/guides/pixel-art-color-palettes), [Pixel Frog Treasure Hunters](https://pixelfrog-assets.itch.io/treasure-hunters), [Kenney Pirate Pack](https://kenney.nl/assets/pirate-pack).

# 7. Technology checks

* **Phaser:** the current release is v4.2.1 "Giedi" (9 July 2026), so Phaser 4 is a released line, not a beta. [Phaser download page](https://phaser.io/download/stable). My general knowledge: AI coding assistants have seen far more Phaser 3 code than Phaser 4 code, so expect occasional outdated API suggestions.
* **Supabase Free plan:** 500 MB database, 50,000 monthly active users, 500,000 Edge Function invocations a month, 2 free projects, and projects are paused after one week of inactivity. [Automation Atlas summary](https://automationatlas.io/answers/supabase-free-tier-limits-2026/). Realtime on Free: 200 concurrent connections, 100 messages per second. [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits). Edge Functions: 2 seconds of CPU time per request, 150 seconds wall clock on Free, 256 MB memory. [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits). Scheduling works through pg_cron plus pg_net. [Supabase scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions).
* **Web push on iPhone:** only works when the site is added to the home screen and permission is requested from a user tap. [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications).

# 8. Where the evidence disagrees

1. **Is PvP loot risk the fun or the problem?** Sea of Thieves PvP fans say risk is the thrill; PvE fans quit over it. Resolution in the design: only carried plunder is at risk, ports are safe, rewards scale with the zone you choose, and peaceful play stays fully rewarded.
2. **Vertical or horizontal progression?** Puzzle Pirates and Sea of Thieves chose cosmetic; their players complain about thin progression. Resolution: capped vertical growth within a season plus cosmetics that persist.
3. **Betrayal.** Neptune's Pride diaries call betrayal both the magic and the poison. Resolution: betrayal exists but is telegraphed one tide ahead.
4. **Kingmaking.** Wehrle says embrace it, Jaffe says it is an anti pattern. Resolution: hide exact scores late, reward many categories, keep the finale cooperative.

# 9. Gaps in the evidence

* I found no postmortem of a daily turn pirate game for small friend groups. The async lessons come from space strategy, board games and BBS games.
* Rigorous data on what keeps a group of six friends playing is thin; most evidence is diaries and anecdotes.
* Reddit threads were mostly unreachable; Steam sentiment comes via AI summaries.
* Idle game math is single player; how it behaves in PvP is my inference, checked with a simulation in the design doc rather than with real players.

The honest conclusion: the design below is a strong, evidence informed starting point, but your first two week season with real friends is the real research. Plan to change the numbers after it.
