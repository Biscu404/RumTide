import { RECIPES, type SoundName, type Voice } from "./recipes.ts";

// Plays the recipes with the Web Audio API. Browsers only allow sound after a tap, so the audio
// context is made on the first tap (`listenForFirstTap`), and nothing is heard before it. The
// on/off choice is remembered in localStorage (section 2.3). Cosmetic only: the server never hears of it.

export const STORAGE_KEY = "rumtide.sound";
const MASTER_VOLUME = 0.5;
const NOISE_SECONDS = 1;
const SILENT = 0.0001;

/** The part of the Web Audio API that is used, so a test can stand in for it. */
export interface AudioPort {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createBiquadFilter(): BiquadFilterNode;
  createBufferSource(): AudioBufferSourceNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
}

type Store = Pick<Storage, "getItem" | "setItem">;

export class Sound {
  private context: AudioPort | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private waiting: SoundName | null = null;
  private off: boolean;

  constructor(
    private readonly makeContext: () => AudioPort | null,
    private readonly storage: Store | null,
  ) {
    this.off = this.read() === "off";
  }

  get muted(): boolean {
    return this.off;
  }

  get unlocked(): boolean {
    return this.context !== null;
  }

  setMuted(muted: boolean): void {
    this.off = muted;
    if (muted) this.waiting = null;
    try {
      this.storage?.setItem(STORAGE_KEY, muted ? "off" : "on");
    } catch {
      // Storage can be blocked (private windows). The choice then lasts until the page is closed.
    }
  }

  /** Call from a tap or key press. Makes the audio context the first time, and plays what was waiting for it. */
  unlock(): void {
    if (!this.context) {
      try {
        this.context = this.makeContext();
      } catch {
        this.context = null;
      }
      if (!this.context) return;
      const master = this.context.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(this.context.destination);
      this.master = master;
    }
    if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) this.play(waiting);
  }

  /** Unlocks on the first pointer press or key press anywhere on the page. */
  listenForFirstTap(target: Pick<Window, "addEventListener" | "removeEventListener">): void {
    const once = () => {
      this.unlock();
      target.removeEventListener("pointerdown", once, true);
      target.removeEventListener("keydown", once, true);
    };
    target.addEventListener("pointerdown", once, true);
    target.addEventListener("keydown", once, true);
  }

  /** Plays now. Silent when muted, or before the first tap. */
  play(name: SoundName): void {
    if (this.off || !this.context || !this.master) return;
    const start = this.context.currentTime + 0.01;
    for (const voice of RECIPES[name]) this.voice(voice, start);
  }

  /** For a sound that belongs to something that happened while the page was closed: it plays at the first tap. */
  playWhenUnlocked(name: SoundName): void {
    if (this.off) return;
    if (this.context) this.play(name);
    else this.waiting = name;
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private voice(v: Voice, start: number): void {
    const ctx = this.context!;
    const from = start + v.at;
    const to = from + v.length;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(SILENT, from);
    gain.gain.linearRampToValueAtTime(v.gain, from + (v.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(SILENT, to);
    gain.connect(this.master!);

    if (v.wave === "noise") {
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(v.from, from);
      if (v.to !== undefined) filter.frequency.exponentialRampToValueAtTime(v.to, to);
      source.connect(filter);
      filter.connect(gain);
      source.start(from);
      source.stop(to);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.from, from);
    if (v.to !== undefined) osc.frequency.exponentialRampToValueAtTime(v.to, to);
    osc.connect(gain);
    osc.start(from);
    osc.stop(to);
  }

  /** One second of white noise, made once. A fixed seed, so every device makes the same cannon. */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const ctx = this.context!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x2545f491;
    for (let i = 0; i < data.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      data[i] = ((state >>> 0) / 0xffffffff) * 2 - 1;
    }
    this.noise = buffer;
    return buffer;
  }
}

function browserStorage(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function browserContext(): AudioPort | null {
  const Ctor = (globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext });
  const Make = Ctor.AudioContext ?? Ctor.webkitAudioContext;
  return Make ? new Make() : null;
}

/** The game's one sound player. */
export const sound = new Sound(browserContext, browserStorage());
