# 10. Intel

## 10.1 The intel item

```ts
interface Intel {
  id: string;
  type: "chart" | "currentChart" | "sighting" | "priceSheet" | "rumour" | "secret"
      | "doctrine" | "treasureMap" | "mapFragment" | "letter";
  subject: string;              // an island, a lane set, a captain, a port
  payload: unknown;             // the knowledge itself
  sourceCaptainId: string | null;
  createdTide: number;
  expiresTide: number | null;
  copyable: boolean;            // copies can be duplicated; originals only move
  isTrue: boolean;              // server only, never sent to clients
  forgedBy?: string;            // server only
}
```

## 10.2 Types

| Type | About | Copy or original | Expires | Main sources | Phase |
|-|-|-|-|-|-|
| Chart | An island (full) or an archipelago (sketch) | Copy | No | Exploring, cartographers, trades, captures | S0 |
| Current Chart | The currents of lanes in an area | Copy | No | Surveys, Navigators, cartographers | S0 |
| Sighting | A ship: where, when, how full, heading | Copy | After 4 Tides | Lookouts, Lurking, harbourmaster bribes, the Gazette | S0 |
| Price Sheet | Prices at one port | Copy | After 2 Tides | Visiting, Quartermasters, trades | S0 |
| Rumour | Something in the future: a hotspot, an NPC's plan | Copy | When it happens | Taverns, events, Gazette plants | S0 |
| Secret | A person: an NPC's weakness, a player's agenda clue, a crewmate's loyalty | Copy | No | Events, Spies, captures | S1 |
| Doctrine Copy | One saved doctrine as it was when taken | Copy | No | Capture pick | S1 |
| Treasure Map | One dig spot | Original | No | Events, wrecks, Brethren | S0 |
| Map Fragment | A piece of Grimbeard's map | Original | No | Story, Big Hotspots, captures | S1 |
| Sealed Letter | Quest item | Original | Varies | Events | S1 |

## 10.3 Rules

* **Trading:** intel goes into the trade window alongside goods and gold. The buyer sees the type, subject, source and age, but not the payload until the trade completes. With copies, the seller keeps theirs; originals move.
* **Fleet sharing:** fleet mates share copies for free with one tap.
* **Stealing:**
  * The Capture pick: one original, or two copies (8.7).
  * A Spy's **Infiltrate** (port action, once per Tide, Infiltrator branch): try to copy one random entry from a captain docked in the same port. Chance = Spy level against the target's Cunning. If caught: Trust minus 10, the target learns who it was, and a Grudge starts.
* **Decay:** Sightings and Price Sheets fade on your Chart and then expire.
* **Overselling:** selling the same copy to many captains is allowed, and the Gazette may notice (*"The Whisper Rock chart has now been sold to half the Brine"*).

## 10.4 The Forger

* **Exactly one Forger exists in the world:** a legendary NPC, *Inkfinger Isolde* (working name), hidden in the Mistveil Isles in Season 1 (Saltteeth Shoals in Season 0).
* **Recruiting her:** finish her Tale *The Perfect Copy*, 4 steps over several Tides: find her, deliver something rare, survive her betrayal test, pay her price. She takes a crewmate slot.
* **Only one captain has her at a time.** She can be poached or turned like any crewmate, and her loyalty is fickle (minus 2 per Tide unless paid), so she will change hands, and everyone will want her.
* **Forger's Kit:** a second route. At most 2 kits exist per season, found in Medium Hotspots or deep sites. Each kit has 3 uses.
* **What she forges** (one per Tide, costs gold): any copyable intel (a chart with wrong currents, a false sighting, a fake rumour, a fake price sheet). Once per season she can forge a **Treasure Map**, an original that leads to an empty dig, or to wherever her owner is lurking.
* Forgeries are flagged false on the server and look exactly like the source they claim.

## 10.5 Checking intel

* **Acting on it** reveals the truth: you sail the lane and the current is wrong, you dig and the chest is not there.
* **Navigator, Cartographer branch:** 70% to detect a forgery; inspecting takes 1 Tide.
* **Captain Cunning rank 3:** 60% to detect.
* **When a forgery is found:** the victim sees who sold it to them, which starts a Grudge. A Cartographer's detection also traces the forger's owner 50% of the time (Trust minus 15 for them, publicly).
