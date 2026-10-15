import Phaser from "phaser";
import { sound } from "../audio/sound.ts";
import { C, rgb } from "../palette.ts";
import { MANEUVER_STYLE, shortName, type Edge, type Replay, type ReplayRound, type ReplayShip } from "../ui/replayModel.ts";
import { Timeline } from "./timeline.ts";

// Shapes in Endesga 32 colours until there is sprite art. Phaser only draws here: what
// happens is decided by the Replay model, which is built from the saved battle, and the Timeline
// that every beat is scheduled on. Every menu and button is Preact (ReplayView).

/** Internal resolution (section 2.1). The host scales it up by whole numbers only. */
export const REPLAY_WIDTH = 320;
export const REPLAY_HEIGHT = 180;

const SKY = [C.nightSea, C.slate, C.dusk, C.steel].map(rgb);
const HORIZON = 96;
const SEA = rgb(C.deepSea);
const WAVE = rgb(C.shallows);
const WATERLINE = 122;
const INK = rgb(C.ink);
const GOLD = C.goldLight;
const TEXT = C.parchment;
const FONT = "monospace";

// Cosmetic timings in milliseconds.
const INTRO = 800;
const BANNER = 700;
const REVEAL_EVERY = 250;
const HOLD = 600;
const FLIGHT = 250;
const AFTER_FIRE = 1300;
const SINK = 1200;

const EDGE_TEXT: Record<Edge, { text: string; colour: string }> = {
  edge: { text: "EDGE", colour: C.jungle },
  even: { text: "EVEN", colour: C.mist },
  weak: { text: "WEAK", colour: C.danger },
};

/** Everything drawn for one ship. */
interface Rig {
  ship: ReplayShip;
  x: number;
  y: number;
  body: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Graphics;
  move: Phaser.GameObjects.Text;
  edge: Phaser.GameObjects.Text;
  /** The hull shown now, which the bar follows. */
  hull: number;
}

const ease = (p: number) => 1 - (1 - p) * (1 - p);
const pop = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;   // overshoots 1 a little, then settles

/**
 * The battle replay (section 16.1): two sides side on, plans revealed one round at a time, smoke,
 * damage numbers and hulls going down. Pausing, skipping and replaying are `setPaused`, `skip` and
 * `restart`, called from the buttons around it. Calls `onFinished` when the last beat has played.
 */
export class ReplayScene extends Phaser.Scene {
  private readonly replay: Replay;
  /** False only for the first showing when the player asked for less motion. Watching again always plays it. */
  private autoplay: boolean;
  private readonly onFinished: (() => void) | undefined;
  private tl = new Timeline();
  private paused = false;
  private announced = false;
  private rigs = new Map<string, Rig>();
  private waves?: Phaser.GameObjects.Graphics;
  private waveClock = -1;
  private banner?: Phaser.GameObjects.Text;
  private bobbing = false;
  /** True while skipping ahead, so a whole battle of sounds does not play at once. */
  private skipping = false;

  constructor(replay: Replay, options: { autoplay?: boolean; onFinished?: () => void } = {}) {
    super("replay");
    this.replay = replay;
    this.autoplay = options.autoplay ?? true;
    this.onFinished = options.onFinished;
  }

  create(): void {
    this.tl = new Timeline();
    this.paused = false;
    this.announced = false;
    this.rigs = new Map();
    this.waveClock = -1;
    this.bobbing = false;

    this.cameras.main.setBackgroundColor(SEA);
    this.drawBackdrop();
    this.waves = this.add.graphics().setDepth(1);
    this.banner = this.text(REPLAY_WIDTH / 2, 10, "", 8, TEXT).setDepth(70);
    this.buildRigs();
    this.schedule();
    if (!this.autoplay) this.skip();
  }

  update(_time: number, delta: number): void {
    if (!this.paused) this.tl.advance(Math.min(delta, 100));
    if (this.tl.clock !== this.waveClock) {
      this.waveClock = this.tl.clock;
      this.drawWaves();
      this.bob();
    }
    if (!this.announced && this.tl.finished) {
      this.announced = true;
      this.onFinished?.();
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Jump to how the battle ended. */
  skip(): void {
    this.skipping = true;
    try {
      this.tl.advance(Math.max(0, this.tl.end - this.tl.clock));
    } finally {
      this.skipping = false;
    }
  }

  /** Play it from the start, even if it first opened on the last frame. */
  restart(): void {
    this.autoplay = true;
    this.scene.restart();
  }

  /** A sound that goes with a beat. Beats that are skipped over make no noise. */
  private cue(name: Parameters<typeof sound.play>[0]): void {
    if (!this.skipping) sound.play(name);
  }

  // ---- drawing ----

  private text(x: number, y: number, text: string, size: number, colour: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color: colour }).setOrigin(0.5);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics().setDepth(0);
    const band = HORIZON / SKY.length;
    SKY.forEach((colour, i) => g.fillStyle(colour, 1).fillRect(0, i * band, REPLAY_WIDTH, band));
    g.fillStyle(SEA, 1).fillRect(0, HORIZON, REPLAY_WIDTH, REPLAY_HEIGHT - HORIZON);
    g.fillStyle(rgb(C.slate), 1).fillRect(0, HORIZON, REPLAY_WIDTH, 1);
  }

  private drawWaves(): void {
    const g = this.waves;
    if (!g) return;
    g.clear();
    g.fillStyle(WAVE, 0.55);
    [104, 112, 121, 131, 142, 154, 167].forEach((row, i) => {
      const drift = ((this.tl.clock / 1000) * (6 + i * 1.5) * (i % 2 === 0 ? 1 : -1)) % 28;
      for (let x = -28; x < REPLAY_WIDTH + 28; x += 28) g.fillRect(Math.round(x + drift), row, 10, 1);
    });
  }

  private drawShip(g: Phaser.GameObjects.Graphics, sail: number): void {
    g.fillStyle(rgb(C.woodDark), 1);                                   // hull
    g.fillTriangle(-18, -6, 18, -6, 14, 4).fillTriangle(-18, -6, 14, 4, -14, 4);
    g.fillStyle(rgb(C.wood), 1).fillRect(-18, -8, 36, 2);            // deck
    g.fillStyle(INK, 1);                                          // cannon ports
    for (const x of [-9, 0, 9]) g.fillRect(x - 1, -4, 3, 2);
    g.fillStyle(rgb(C.woodDeep), 1).fillRect(-1, -36, 2, 30);            // mast
    g.fillStyle(sail, 1);
    g.fillTriangle(2, -34, 2, -10, 21, -10);                      // main sail
    g.fillTriangle(-2, -30, -2, -12, -15, -12);                   // fore sail
    g.fillStyle(INK, 1).fillRect(-1, -40, 7, 4);                  // flag
  }

  private drawBar(rig: Rig): void {
    const share = Math.max(0, Math.min(1, rig.hull / rig.ship.maxHull));
    rig.bar.clear();
    rig.bar.fillStyle(INK, 1).fillRect(rig.x - 16, 37, 32, 5);
    rig.bar.fillStyle(share > 0.5 ? rgb(C.jungle) : share > 0.25 ? rgb(C.gold) : rgb(C.danger), 1)
      .fillRect(rig.x - 15, 38, Math.round(30 * share), 3);
  }

  private drawIcon(g: Phaser.GameObjects.Graphics, shape: "circle" | "triangle" | "diamond", colour: number): void {
    g.clear();
    g.fillStyle(colour, 1).lineStyle(1, rgb(C.foam), 1);
    if (shape === "circle") {
      g.fillCircle(0, 0, 5).strokeCircle(0, 0, 5);
    } else if (shape === "triangle") {
      g.fillTriangle(0, -6, 6, 5, -6, 5).strokeTriangle(0, -6, 6, 5, -6, 5);
    } else {
      g.fillTriangle(0, -7, 6, 0, -6, 0).fillTriangle(0, 7, 6, 0, -6, 0);
      g.strokeTriangle(0, -7, 6, 0, -6, 0).strokeTriangle(0, 7, 6, 0, -6, 0);
    }
  }

  // ---- the ships ----

  private buildRigs(): void {
    const count = (side: 0 | 1) => this.replay.ships.filter((s) => s.side === side).length;
    const crowded = this.replay.ships.some((s) => s.slot > 0);
    for (const ship of this.replay.ships) {
      const gap = count(ship.side) <= 3 ? 44 : 36;
      const x = ship.side === 0 ? 112 - ship.slot * gap : 208 + ship.slot * gap;
      const y = WATERLINE + (ship.slot % 2) * 5;

      const body = this.add.graphics().setPosition(x, y).setDepth(10 + y);
      this.drawShip(body, ship.sail);
      if (ship.side === 1) body.setScale(-1, 1);
      const name = this.text(x, 30, shortName(ship.label, crowded ? 8 : 11), 8, TEXT).setDepth(50);
      const bar = this.add.graphics().setDepth(50);
      const mark = this.text(x, 54, "?", 12, GOLD).setDepth(50).setVisible(false);
      const icon = this.add.graphics().setPosition(x, 52).setDepth(50).setVisible(false);
      const move = this.text(x, 63, "", 8, TEXT).setDepth(50).setVisible(false);
      const edge = this.text(x, 71, "", 8, C.mist).setDepth(50).setVisible(false);

      const rig: Rig = { ship, x, y, body, bar, name, mark, icon, move, edge, hull: ship.hullBefore };
      this.drawBar(rig);
      this.rigs.set(ship.id, rig);
    }
  }

  /** The "?" over each ship bobs while the plans are hidden. */
  private bob(): void {
    if (!this.bobbing) return;
    for (const rig of this.rigs.values()) rig.mark.setY(54 + Math.sin(this.tl.clock / 110 + rig.x) * 1.5);
  }

  // ---- the timeline ----

  private schedule(): void {
    const { tl, replay } = this;
    const order = [...replay.ships].sort((a, b) => a.side - b.side || a.slot - b.slot);
    const hud = [...this.rigs.values()].flatMap((r) => [r.name, r.bar]);
    hud.forEach((o) => o.setAlpha(0));

    // Ships sail in.
    tl.at(0, () => {
      for (const rig of this.rigs.values()) {
        const from = rig.ship.side === 0 ? -190 : 190;
        tl.anim(INTRO, (p) => rig.body.setX(rig.x + from * (1 - ease(p))));
      }
      tl.anim(INTRO, (p) => hud.forEach((o) => o.setAlpha(p)));
    });

    let t = INTRO + 200;
    for (const round of replay.rounds) {
      tl.at(t, () => this.openRound(round));
      const reveal = t + BANNER;
      order.forEach((ship, i) => tl.at(reveal + i * REVEAL_EVERY, () => this.reveal(ship, round)));
      const fire = reveal + order.length * REVEAL_EVERY + HOLD;
      tl.at(fire, () => this.fire());
      tl.at(fire + FLIGHT, () => this.hits(round));
      tl.at(fire + 1000, () => this.clearMoves());
      t = fire + AFTER_FIRE;
    }
    tl.at(t, () => this.ending());
    tl.end = t + SINK + 2600;
  }

  private openRound(round: ReplayRound): void {
    const banner = this.banner!;
    banner.setText(`Round ${round.round}`).setAlpha(0);
    this.tl.anim(250, (p) => banner.setAlpha(p));
    this.bobbing = true;
    this.cue("drumRoll");
    for (const rig of this.rigs.values()) {
      rig.mark.setVisible(true);
      rig.icon.setVisible(false);
      rig.move.setVisible(false);
      rig.edge.setVisible(false);
    }
  }

  private reveal(ship: ReplayShip, round: ReplayRound): void {
    const rig = this.rigs.get(ship.id)!;
    const move = round.moves.find((m) => m.shipId === ship.id);
    if (!move) return;
    const style = MANEUVER_STYLE[move.maneuver];
    const crowded = this.replay.ships.some((s) => s.slot > 0);
    rig.mark.setVisible(false);
    this.drawIcon(rig.icon, style.shape, style.colour);
    rig.icon.setVisible(true).setScale(0);
    rig.move.setText(crowded ? style.label.slice(0, 6) : style.label).setVisible(true);
    const edge = EDGE_TEXT[move.edge];
    rig.edge.setText(move.stale ? `${edge.text} REPEAT` : edge.text).setColor(edge.colour).setVisible(true);
    this.tl.anim(220, (p) => rig.icon.setScale(pop(p)));
  }

  private fire(): void {
    this.bobbing = false;
    let n = 0;
    for (const rig of this.rigs.values()) {
      this.tl.after(n++ * 70, () => this.cue("cannon"));  // a ragged volley, not one hit
      const dir = rig.ship.side === 0 ? 1 : -1;       // side 0 fires to the right
      const muzzle = rig.x + dir * 20;
      const flash = this.add.graphics().setDepth(60).setPosition(muzzle, rig.y - 3);
      flash.fillStyle(rgb(C.goldLight), 1).fillCircle(0, 0, 4);
      this.tl.anim(160, (p) => flash.setAlpha(1 - p).setScale(1 + p), () => flash.destroy());
      for (let k = 0; k < 6; k++) this.tl.after(k * 60, () => this.puff(muzzle, rig.y - 6, dir, k));
    }
  }

  private puff(x: number, y: number, dir: number, k: number): void {
    const g = this.add.graphics().setDepth(60).setPosition(x, y);
    g.fillStyle(rgb(C.mist), 1).fillCircle(0, 0, 1);
    const drift = dir * (6 + k * 3), rise = 10 + k * 2;
    this.tl.anim(700, (p) => {
      g.setPosition(x + drift * p, y - rise * p).setScale(2 + 4 * p).setAlpha(0.85 * (1 - p));
    }, () => g.destroy());
  }

  /** The shells land: damage numbers float up, hulls go down, ships that were hit shake. */
  private hits(round: ReplayRound): void {
    if (round.winner !== null) this.cue("brass");
    for (const rig of this.rigs.values()) {
      const lost = round.hullLost[rig.ship.id] ?? 0;
      const from = rig.hull;
      const to = round.hullAfter[rig.ship.id] ?? from;
      this.tl.anim(500, (p) => { rig.hull = from + (to - from) * p; this.drawBar(rig); });
      if (lost <= 0) continue;

      // Over the hull, in front of the sails, where it cannot be taken for part of the name or the plan.
      const top = rig.y - 14;
      const number = this.add.text(rig.x, top, `-${Math.max(1, Math.round(lost))}`, {
        fontFamily: FONT, fontSize: "10px", color: C.foam, stroke: C.dangerDark, strokeThickness: 3,
      }).setOrigin(0.5).setDepth(65);
      this.tl.anim(900, (p) => number.setY(top - 18 * ease(p)).setAlpha(p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4), () => number.destroy());

      const x = rig.x;
      this.tl.anim(320, (p) => rig.body.setX(x + Math.sin(p * 28) * 2 * (1 - p)));
    }
  }

  private clearMoves(): void {
    const rigs = [...this.rigs.values()];
    this.tl.anim(200, (p) => {
      for (const rig of rigs) { rig.icon.setAlpha(1 - p); rig.move.setAlpha(1 - p); rig.edge.setAlpha(1 - p); }
    }, () => {
      for (const rig of rigs) {
        rig.icon.setVisible(false).setAlpha(1);
        rig.move.setVisible(false).setAlpha(1);
        rig.edge.setVisible(false).setAlpha(1);
      }
    });
  }

  private ending(): void {
    const { ending } = this.replay;
    this.bobbing = false;
    this.banner!.setVisible(false);

    // Ships that struck their colours list and sink a little.
    if (ending.struck.length > 0) {
      this.cue("struck");
      this.tl.after(SINK * 0.7, () => this.cue("splash"));
    }
    for (const id of ending.struck) {
      const rig = this.rigs.get(id);
      if (!rig) continue;
      const lean = rig.ship.side === 0 ? -1 : 1;
      this.tl.anim(SINK, (p) => rig.body.setAngle(lean * 22 * ease(p)).setY(rig.y + 14 * ease(p)).setAlpha(1 - 0.45 * p));
    }

    this.tl.after(SINK / 2, () => {
      const head = this.text(REPLAY_WIDTH / 2, 148, ending.headline, 14, GOLD).setDepth(70).setAlpha(0);
      const who = this.text(REPLAY_WIDTH / 2, 164, ending.winners, 8, TEXT).setDepth(70).setAlpha(0);
      this.tl.anim(300, (p) => { head.setAlpha(p); who.setAlpha(p); });
    });

    const shot = ending.partingShot;
    const rig = shot ? this.rigs.get(shot.shipId) : undefined;
    if (shot && rig) this.tl.after(SINK + 700, () => this.speak(rig, shot.text));
  }

  /** A Parting Shot over the winner's deck (section 2.4). */
  private speak(rig: Rig, line: string): void {
    const words = this.add.text(0, 0, `"${line}"`, {
      fontFamily: FONT, fontSize: "8px", color: C.ink, align: "center", wordWrap: { width: 120 },
    }).setOrigin(0.5).setDepth(81);
    const w = Math.ceil(words.width) + 8, h = Math.ceil(words.height) + 6;
    const x = Math.min(REPLAY_WIDTH - w / 2 - 2, Math.max(w / 2 + 2, rig.x));
    const y = 3 + h / 2;                                  // at the very top, clear of the names below
    words.setPosition(x, y);
    const bubble = this.add.graphics().setDepth(80);
    bubble.fillStyle(rgb(C.parchment), 1).fillRect(x - w / 2, y - h / 2, w, h);
    bubble.fillTriangle(rig.x - 3, y + h / 2, rig.x + 3, y + h / 2, rig.x, y + h / 2 + 4);
    this.tl.anim(250, (p) => { bubble.setAlpha(p); words.setAlpha(p); });
  }
}
