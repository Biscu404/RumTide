import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLEET_COLOURS } from "@engine/fleet.ts";
import { C, ENDESGA_32, UI, rgb } from "./palette.ts";
import { SAIL_COLOURS } from "./scenes/layout.ts";

const clientDir = fileURLToPath(new URL("..", import.meta.url));
const srcDir = fileURLToPath(new URL(".", import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

const luminance = (hex: string) => {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
};
/** WCAG contrast ratio, 1 to 21. */
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe("the palette", () => {
  it("is the 32 distinct Endesga 32 colours", () => {
    expect(ENDESGA_32).toHaveLength(32);
    expect(new Set(ENDESGA_32).size).toBe(32);
    for (const hex of ENDESGA_32) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("holds every role colour, and the UI colours are role colours", () => {
    for (const hex of [...Object.values(C), ...Object.values(UI)]) expect(ENDESGA_32).toContain(hex);
  });

  it("turns #rrggbb into the number Phaser wants", () => {
    expect(rgb("#e43b44")).toBe(0xe43b44);
    expect(rgb(C.ink)).toBe(0x181425);
  });

  it("gives fleets only palette colours, and keeps free sail colours apart from them", () => {
    for (const hex of FLEET_COLOURS) expect(ENDESGA_32).toContain(hex);
    const fleet = FLEET_COLOURS.map(rgb);
    for (const sail of SAIL_COLOURS) {
      expect(ENDESGA_32.map(rgb)).toContain(sail);
      expect(fleet).not.toContain(sail);
      expect([rgb(C.gold), rgb(C.goldLight)]).not.toContain(sail);
    }
    expect(new Set(SAIL_COLOURS).size).toBe(SAIL_COLOURS.length);
  });
});

describe("style.css", () => {
  const css = read(join(srcDir, "ui", "style.css"));
  const root = /:root\s*\{([^}]*)\}/.exec(css)![1]!;

  it("repeats the UI colours of palette.ts in its :root block", () => {
    for (const [name, hex] of Object.entries(UI)) {
      expect(root, `--${kebab(name)}`).toContain(`--${kebab(name)}: ${hex};`);
    }
    const declared = [...root.matchAll(/--([a-z-]+):\s*#/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(UI).map(kebab).sort());
  });

  it("uses the variables everywhere else, so no stray colour sneaks in", () => {
    expect(css.replace(root, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});

describe("colours in the client", () => {
  it("come from palette.ts and nowhere else", () => {
    const strays: string[] = [];
    for (const path of sourceFiles(srcDir)) {
      if (!/\.(ts|tsx)$/.test(path) || /\.test\.tsx?$/.test(path) || path.endsWith("palette.ts")) continue;
      for (const hit of read(path).matchAll(/#[0-9a-fA-F]{3,8}\b|\b0x[0-9a-fA-F]{6}\b/g)) strays.push(`${path}: ${hit[0]}`);
    }
    expect(strays).toEqual([]);
  });

  it("let the page shell use a palette colour too", () => {
    const html = read(join(clientDir, "index.html"));
    for (const hit of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) expect(ENDESGA_32).toContain(hit[0].toLowerCase());
  });
});

describe("contrast", () => {
  // 4.5 is the WCAG minimum for text, and small pixel text read on a phone in sunlight needs it.
  const pairs: Array<[string, string, string]> = [
    ["text on the page", UI.text, UI.bg],
    ["text on a panel", UI.text, UI.panel],
    ["dim text on the page", UI.dim, UI.bg],
    ["dim text on a panel", UI.dim, UI.panel],
    ["accent text on the page", UI.accent, UI.bg],
    ["accent text on a panel", UI.accent, UI.panel],
    ["button text on its gold", UI.accentInk, UI.accent],
    ["error text on the page", UI.error, UI.bg],
    ["error text on a panel", UI.error, UI.panel],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} is at least 4.5 to 1`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
