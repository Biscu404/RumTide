// A clock for the battle replay. Everything the replay does is scheduled on it up front, and the
// scene moves it forward by the time that passed. Pausing is not moving it, skipping is moving it a
// long way in one go, and restarting is building a new one. No Phaser in here, so it can be tested.

interface Event { at: number; seq: number; run: () => void }
interface Anim { start: number; duration: number; tick: (progress: number) => void; done?: () => void }

export class Timeline {
  /** Milliseconds of replay time that have passed. */
  clock = 0;
  /** When the replay is over. The builder sets it once it has scheduled everything. */
  end = 0;
  /** The moment events and animations being started belong to: the running event's time. */
  private now = 0;
  private seq = 0;
  private events: Event[] = [];
  private anims: Anim[] = [];

  /** Run `run` when the clock reaches `ms`. Events at the same time run in the order they were added. */
  at(ms: number, run: () => void): void {
    const event = { at: ms, seq: this.seq++, run };
    const index = this.events.findIndex((e) => e.at > ms);
    if (index === -1) this.events.push(event);
    else this.events.splice(index, 0, event);
  }

  /** Run `run` `ms` after the moment the running event belongs to. For events that schedule more events. */
  after(ms: number, run: () => void): void {
    this.at(this.now + ms, run);
  }

  /** Start an animation now (at the time of the event that is running). `tick` gets 0 to 1, and always ends on exactly 1. */
  anim(duration: number, tick: (progress: number) => void, done?: () => void): void {
    this.anims.push({ start: this.now, duration, tick, done });
  }

  get finished(): boolean {
    return this.clock >= this.end;
  }

  advance(ms: number): void {
    const target = this.clock + Math.max(0, ms);
    do {
      for (;;) {
        const next = this.events[0];
        if (!next || next.at > target) break;
        this.events.shift();
        this.now = next.at;
        this.tickAnims(next.at);
        next.run();
      }
      this.now = target;
      this.tickAnims(target);
      // A finished animation may have scheduled something that is already due, as when skipping ahead.
    } while (this.events[0] !== undefined && this.events[0].at <= target);
    this.clock = target;
  }

  private tickAnims(time: number): void {
    for (const a of [...this.anims]) {
      const progress = a.duration <= 0 ? 1 : Math.min(1, Math.max(0, (time - a.start) / a.duration));
      a.tick(progress);
      if (progress >= 1) {
        this.anims = this.anims.filter((x) => x !== a);
        // What `done` starts belongs to the moment the animation really ended.
        const at = this.now;
        this.now = Math.min(time, a.start + a.duration);
        a.done?.();
        this.now = at;
      }
    }
  }
}
