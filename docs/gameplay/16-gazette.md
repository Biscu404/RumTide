# 16. The Gazette

## 16.1 Editions

* One edition every Tide (13:00 and 20:00), the same format both times.
* Sections: three headlines; the battle of the Tide (with a replay link); market news; wind forecasts; rivalry tallies; hotspot notices; one rumour (possibly false); Polly's gossip column.
* Posted to Discord with the Tide jingle (v0.2 12).

## 16.2 Bias

* The editor, **Polly Quillsworth** (working name), holds a **Favour** score for every captain, from hostile to adoring.
* Favour moves with paid services, with Fame, and with scoops (giving Polly a piece of intel raises her Favour toward you).
* Favour decides the wording: the same event becomes *"BRAVE BISCU BREAKS BLOCKADE"* or *"BISCU BUMBLES THROUGH BLOCKADE"*.
* Nicknames come from reputation titles and running gags: repeated blunders get a running count.

## 16.3 Paid services [S1]

From the Gazette Office scene in any City, or its menu.

| Service | Effect | Cost (× the Boom) |
|-|-|-|
| Puff Piece | A flattering story about you or your fleet next edition; +3 Fame | 40 |
| Smear | An anonymous negative story about a rival; minus 3 Fame for them | 60 |
| Bury | A story about you (a betrayal, a loss) is left out | 80 |
| Plant | A rumour you build from templates is printed; every reader gets it as Rumour intel | 100 |
| Exposé | Reveal who paid for any story in the last 3 editions | 120 |

* **Sealed bids:** when two requests clash (a Puff against a Smear of the same captain, a Bury against an Exposé), the higher payment wins and the loser gets half back.
* Exposés can reveal Plants too: *"SCANDAL: the 'galleon at Gullhaven' rumour was planted by Anna."*

## 16.4 How it is written

* Season 0: about 200 headline templates with variables, and Favour based word choices.
* Later option: Claude writes each edition from the Tide's event log in Polly's voice, for cents a day. The engine stays deterministic, because the text is only presentation, written after the Tide resolves.
