// The one locked palette (section 2.1): Endesga 32, checked against Lospec. Every colour the client
// draws comes from here, in Phaser, in the replay model and in style.css (its :root block repeats
// the UI roles, and palette.test.ts fails if the two drift apart or a stray hex turns up elsewhere).

/** All 32 colours, in the palette's own order. */
export const ENDESGA_32 = [
  "#be4a2f", "#d77643", "#ead4aa", "#e4a672", "#b86f50", "#733e39", "#3e2731", "#a22633",
  "#e43b44", "#f77622", "#feae34", "#fee761", "#63c74d", "#3e8948", "#265c42", "#193c3e",
  "#124e89", "#0099db", "#2ce8f5", "#ffffff", "#c0cbdc", "#8b9bb4", "#5a6988", "#3a4466",
  "#262b44", "#181425", "#ff0044", "#68386c", "#b55088", "#f6757a", "#e8b796", "#c28569",
] as const;

/** Colours by the roles of section 2.1. Use these names, not the hex. */
export const C = {
  deepSea: "#124e89",
  nightSea: "#262b44",
  shallows: "#0099db",
  highlight: "#2ce8f5",
  parchment: "#ead4aa",
  sand: "#e4a672",
  wood: "#b86f50",
  woodDark: "#733e39",
  woodDeep: "#3e2731",
  gold: "#feae34",
  goldLight: "#fee761",
  jungle: "#63c74d",
  jungleDark: "#3e8948",
  jungleDeep: "#265c42",
  danger: "#e43b44",
  dangerDark: "#a22633",
  ink: "#181425",
  slate: "#3a4466",
  foam: "#ffffff",
  mist: "#c0cbdc",
  // Used for the sky, sails and the pixel look of the UI.
  steel: "#8b9bb4",
  dusk: "#5a6988",
  orange: "#f77622",
  rose: "#f6757a",
  blush: "#e8b796",
  clay: "#d77643",
  plum: "#b55088",
} as const;

/** "#rrggbb" as the number that Phaser's drawing calls want. */
export function rgb(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/**
 * The page colours. style.css repeats these in its :root block, because CSS cannot import TypeScript.
 * Every pair that carries text is checked for contrast in palette.test.ts (small text in sunlight).
 */
export const UI = {
  bg: C.ink,
  panel: C.nightSea,
  text: C.parchment,
  dim: C.steel,
  accent: C.gold,
  accentInk: C.ink,
  line: C.slate,
  frame: C.woodDark,
  frameDeep: C.woodDeep,
  error: C.rose,
} as const;
