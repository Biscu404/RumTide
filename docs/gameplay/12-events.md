# 12. Events

## 12.1 Sizes

| Size | Steps | Spread over | Options per step | How often, per captain |
|-|-|-|-|-|
| Squall | 1 | Instant | 2 | Up to 1 new one per Tide |
| Tale | 2 to 5 | 2 to 6 Tides | 2 or 3 | One active at a time; a new one about every 4 Tides |
| Saga | 5 to 8 | The season | 2 or 3 | Your Background Saga and your Agenda Saga |

## 12.2 Triggers

* **Place:** Landing on a site, entering a water, docking in a settlement.
* **State:** a crewmate's trait plus time aboard, a reputation threshold, Short Rations, a rival nearby, an item held.
* **Time:** the start of an Act, the aftermath of a Big Hotspot.
* Each Tide the engine collects every event a captain qualifies for and draws at most one new Squall, by weight. Tales start from Squall choices, from sites, or from traits.

## 12.3 A choice

* Each option has: text; optional requirements (role, trait, Background, reputation tier, item, gold); immediate effects; optional delayed effects, which resolve some Tides later and are reported in the Gazette.
* Options you cannot take are shown greyed out with their requirement (*"[Surgeon] Treat the fever"*), so players learn what a crew would unlock.
* Consequences are hinted in words, never in numbers (*"The crew looks nervous"*).
* No option is obviously right.

## 12.4 Event file format

Events are data files, so you and Claude can write dozens without touching game code.

```json
{
  "id": "singing_skull",
  "size": "tale",
  "trigger": { "on": "land", "siteTag": "wreck", "chance": 0.15 },
  "steps": {
    "found": {
      "text": "Your crew fishes up a skull that hums shanties.",
      "options": [
        { "id": "keep", "text": "Keep it. The crew loves the music.",
          "effects": [ { "loyaltyAll": 3 }, { "ifTrait": "superstitious", "loyaltyLoss": 5 } ],
          "next": { "step": "humming", "afterTides": 1 } },
        { "id": "sell", "text": "Sell it to the tavern keeper.",
          "requires": { "docked": "town" },
          "effects": [ { "gold": 40 } ] },
        { "id": "toss", "text": "Toss it back. Some things should stay drowned.",
          "effects": [] }
      ]
    },
    "humming": {
      "text": "At night the skull hums a direction, always the same one.",
      "options": [
        { "id": "follow", "text": "Follow it.", "next": { "step": "owner", "afterTides": 1 } },
        { "id": "gag", "text": "Gag it with a sock.", "effects": [ { "addTrait": "jinxed_ship" } ] }
      ]
    },
    "owner": {
      "text": "The humming leads to a wreck full of treasure, and to Captain Mags, who wants her skull back.",
      "options": [
        { "id": "fight", "text": "Fight her for it.", "effects": [ { "battle": "brethren:mags" } ] },
        { "id": "return", "text": "Give it back.", "effects": [ { "favour": "brethren:mags" } ] },
        { "id": "bargain", "text": "[Quartermaster] Bargain.", "requires": { "role": "quartermaster" },
          "effects": [ { "gold": 120 }, { "grudge": "brethren:mags" } ] }
      ]
    }
  }
}
```

Whatever the choice, *The Singing Skull* ends with a named Brethren rival or ally: **events feed the rival system.**

## 12.5 Special forms

* **Mirror Tales:** two captains get opposite sides of the same Tale without being told who the other is (*"Deliver the crate to Gullhaven"* against *"Intercept the crate before Gullhaven"*). The ending depends on both. The Gazette reveals who was who.
* **Cross player Squalls:** a choice about another captain (*"A bottle washes up with a letter addressed to Mihai. Read it, deliver it, or sell it to his rival?"*).
* **Background Sagas** (5.2), **Agenda Sagas** (15), **trait Tales** (7.8).

## 12.6 Content needed for Season 0

* 30 Squalls, 8 Tales, short 3 step Sagas for the 6 Backgrounds in Season 0, and trait Tales for 4 traits.
* Written to the tone rules in v0.2 section 2.4. Claude can draft them in bulk from a short style guide; you edit for voice.
