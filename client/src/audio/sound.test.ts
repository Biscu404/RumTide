import { describe, expect, it } from "vitest";
import { RECIPES } from "./recipes.ts";
import { STORAGE_KEY, Sound, type AudioPort } from "./sound.ts";

// A stand in for the Web Audio API that only counts what is scheduled.
function fakeAudio(state = "running") {
  const made = { oscillators: 0, noises: 0, gains: 0, starts: [] as number[] };
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = () => ({ connect: () => undefined });
  const port = {
    currentTime: 1,
    sampleRate: 8000,
    state,
    destination: {},
    resumed: 0,
    resume() { this.resumed++; this.state = "running"; return Promise.resolve(); },
    createGain: () => { made.gains++; return { ...node(), gain: param() }; },
    createOscillator: () => {
      made.oscillators++;
      return { ...node(), type: "sine", frequency: param(), start: (t: number) => made.starts.push(t), stop: () => undefined };
    },
    createBiquadFilter: () => ({ ...node(), type: "lowpass", frequency: param() }),
    createBufferSource: () => {
      made.noises++;
      return { ...node(), buffer: null, start: (t: number) => made.starts.push(t), stop: () => undefined };
    },
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { port: port as unknown as AudioPort & { resumed: number }, made };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

const voices = (name: keyof typeof RECIPES) => RECIPES[name].length;

describe("Sound", () => {
  it("is silent until the first tap", () => {
    const { port, made } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    sound.play("coin");
    expect(made.oscillators).toBe(0);
    sound.unlock();
    sound.play("coin");
    expect(made.oscillators).toBe(voices("coin"));
  });

  it("makes the audio context once, and wakes it if the browser suspended it", () => {
    const { port } = fakeAudio("suspended");
    let made = 0;
    const sound = new Sound(() => { made++; return port; }, memoryStorage());
    sound.unlock();
    sound.unlock();
    expect(made).toBe(1);
    expect(port.resumed).toBe(1);
    expect(sound.unlocked).toBe(true);
  });

  it("schedules noise voices from a noise buffer and the rest as oscillators", () => {
    const { port, made } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    sound.unlock();
    sound.play("cannon");
    expect(made.noises).toBe(RECIPES.cannon.filter((v) => v.wave === "noise").length);
    expect(made.oscillators).toBe(RECIPES.cannon.filter((v) => v.wave !== "noise").length);
    expect(Math.min(...made.starts)).toBeGreaterThan(port.currentTime);
  });

  it("plays nothing while muted, and remembers the choice", () => {
    const { port, made } = fakeAudio();
    const storage = memoryStorage();
    const sound = new Sound(() => port, storage);
    sound.unlock();
    sound.setMuted(true);
    sound.play("coin");
    expect(made.oscillators).toBe(0);
    expect(storage.data[STORAGE_KEY]).toBe("off");

    const later = new Sound(() => port, storage);
    expect(later.muted).toBe(true);
    later.setMuted(false);
    expect(storage.data[STORAGE_KEY]).toBe("on");
    expect(new Sound(() => port, storage).muted).toBe(false);
  });

  it("starts with sound on when nothing is remembered, and survives storage that throws", () => {
    const { port } = fakeAudio();
    expect(new Sound(() => port, memoryStorage()).muted).toBe(false);
    expect(new Sound(() => port, null).muted).toBe(false);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const sound = new Sound(() => port, broken);
    expect(sound.muted).toBe(false);
    sound.setMuted(true);
    expect(sound.muted).toBe(true);
  });

  it("holds one sound for the first tap, which is how the Tide jingle waits for you", () => {
    const { port, made } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    sound.playWhenUnlocked("coin");
    sound.playWhenUnlocked("jingle");
    expect(made.oscillators).toBe(0);
    sound.unlock();
    expect(made.oscillators).toBe(RECIPES.jingle.filter((v) => v.wave !== "noise").length);
    sound.unlock();
    expect(made.oscillators).toBe(RECIPES.jingle.length); // not played again
  });

  it("does not play a held sound if sound was switched off before the tap", () => {
    const { port, made } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    sound.playWhenUnlocked("jingle");
    sound.setMuted(true);
    sound.unlock();
    expect(made.oscillators).toBe(0);
  });

  it("plays at once if it is already unlocked", () => {
    const { port, made } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    sound.unlock();
    sound.playWhenUnlocked("coin");
    expect(made.oscillators).toBe(voices("coin"));
  });

  it("stays silent, without crashing, where there is no Web Audio", () => {
    const sound = new Sound(() => null, memoryStorage());
    sound.unlock();
    sound.play("coin");
    sound.playWhenUnlocked("jingle");
    expect(sound.unlocked).toBe(false);
    const throwing = new Sound(() => { throw new Error("no audio"); }, memoryStorage());
    expect(() => throwing.unlock()).not.toThrow();
  });

  it("unlocks on the first press and then stops listening", () => {
    const { port } = fakeAudio();
    const sound = new Sound(() => port, memoryStorage());
    const listeners = new Map<string, () => void>();
    const target = {
      addEventListener: (type: string, fn: () => void) => { listeners.set(type, fn); },
      removeEventListener: (type: string) => { listeners.delete(type); },
    };
    sound.listenForFirstTap(target as unknown as Window);
    expect([...listeners.keys()].sort()).toEqual(["keydown", "pointerdown"]);
    listeners.get("pointerdown")!();
    expect(sound.unlocked).toBe(true);
    expect(listeners.size).toBe(0);
  });
});
