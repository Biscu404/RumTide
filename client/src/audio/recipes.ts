// The game's sounds as data (section 2.3): a few oscillator and noise voices each, played by sound.ts
// through the Web Audio API. There are no audio files to download. Pure data, so it can be tested.

export type SoundName = "coin" | "cannon" | "splash" | "drumRoll" | "brass" | "struck" | "jingle";

export interface Voice {
  /** "noise" is white noise through a low pass filter, for cannons and water. */
  wave: "sine" | "square" | "triangle" | "sawtooth" | "noise";
  /** Seconds after the sound starts, and how long the voice lasts. */
  at: number;
  length: number;
  /** Pitch in Hz. For noise it is the low pass cutoff instead. */
  from: number;
  /** Where the pitch (or cutoff) glides to by the end of the voice. */
  to?: number;
  /** Peak volume, 0 to 1. The voice fades out exponentially after it. */
  gain: number;
  /** Seconds to fade in. Defaults to 5 milliseconds, so there is no click. */
  attack?: number;
}

/** Pitches in Hz, named by note, for the brass hit and the fanfare. */
const NOTE = { g3: 196, d4: 293.66, g4: 392, c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5, e6: 1318.51, b5: 987.77 } as const;

/** A bell: its pitch plus the inharmonic partial that makes it ring like metal. */
const bell = (at: number, pitch: number, length: number, gain: number): Voice[] => [
  { wave: "sine", at, length, from: pitch, gain },
  { wave: "sine", at, length: length * 0.6, from: pitch * 2.76, gain: gain * 0.35 },
];

/** A roll of soft drum hits that gets louder, ending just before the plans are revealed. */
const roll = (): Voice[] =>
  Array.from({ length: 10 }, (_, i) => ({
    wave: "sine" as const, at: i * 0.06, length: 0.09, from: 150, to: 90, gain: 0.12 + i * 0.03,
  }));

export const RECIPES: Record<SoundName, Voice[]> = {
  // Two quick blips, the second higher and longer.
  coin: [
    { wave: "square", at: 0, length: 0.07, from: NOTE.b5, gain: 0.12 },
    { wave: "square", at: 0.07, length: 0.3, from: NOTE.e6, gain: 0.12 },
  ],
  // A thump that falls in pitch, under a burst of noise that closes up.
  cannon: [
    { wave: "sine", at: 0, length: 0.35, from: 150, to: 40, gain: 0.5 },
    { wave: "noise", at: 0, length: 0.5, from: 1400, to: 150, gain: 0.45 },
  ],
  splash: [
    { wave: "noise", at: 0, length: 0.5, from: 2600, to: 400, gain: 0.25, attack: 0.04 },
  ],
  drumRoll: roll(),
  // A short brass chord for a round won.
  brass: [
    { wave: "sawtooth", at: 0, length: 0.4, from: NOTE.g3, gain: 0.1, attack: 0.02 },
    { wave: "sawtooth", at: 0, length: 0.4, from: NOTE.d4, gain: 0.1, attack: 0.02 },
    { wave: "sawtooth", at: 0, length: 0.4, from: NOTE.g4, gain: 0.1, attack: 0.02 },
  ],
  // The sad trombone: three slides, each lower than the last, the final one long.
  struck: [
    { wave: "sawtooth", at: 0, length: 0.32, from: 233, to: 220, gain: 0.12, attack: 0.03 },
    { wave: "sawtooth", at: 0.35, length: 0.32, from: 220, to: 208, gain: 0.12, attack: 0.03 },
    { wave: "sawtooth", at: 0.7, length: 0.9, from: 208, to: 130, gain: 0.12, attack: 0.03 },
  ],
  // The Tide jingle (section 2.3): a bell, then a rising fanfare that lands on a bell and a held chord. About 3 seconds.
  jingle: [
    ...bell(0, NOTE.c6, 1.1, 0.16),
    { wave: "square", at: 0.5, length: 0.22, from: NOTE.g4, gain: 0.08 },
    { wave: "square", at: 0.75, length: 0.22, from: NOTE.c5, gain: 0.08 },
    { wave: "square", at: 1.0, length: 0.22, from: NOTE.e5, gain: 0.08 },
    { wave: "square", at: 1.25, length: 1.75, from: NOTE.g5, gain: 0.08 },
    { wave: "triangle", at: 1.25, length: 1.75, from: NOTE.c5, gain: 0.12 },
    ...bell(1.25, NOTE.c6, 1.75, 0.16),
  ],
};

/** When the last voice of a sound ends, in seconds. */
export function duration(name: SoundName): number {
  return Math.max(...RECIPES[name].map((v) => v.at + v.length));
}
