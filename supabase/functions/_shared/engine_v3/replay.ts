// Turning a replay into readable text, and fingerprinting it.

import type { ReplayEvent, SeasonState, Wind } from "./types.ts";
import type { World } from "./map.ts";
import { hash32 } from "./rng.ts";

const COMPASS_NAMES: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

export function describeWind(w: Wind): string {
  if (w.kind === "calm") return "calm";
  return `${w.kind} from the ${COMPASS_NAMES[w.from] ?? w.from + " degrees"}`;
}

/** JSON with object keys sorted, so equal data always gives equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) out[key] = (v as Record<string, unknown>)[key];
      return out;
    }
    if (v === Number.POSITIVE_INFINITY) return "Infinity";
    return v;
  });
}

/** An 8 character fingerprint of a replay. Two runs with the same input must print the same one. */
export function replayHash(events: ReplayEvent[]): string {
  return hash32(canonicalJson(events)).toString(16).padStart(8, "0");
}

/** One line per event, in plain words. */
export function formatReplay(world: World, state: SeasonState, events: ReplayEvent[]): string[] {
  const shipName = (id: string) => state.ships[id]?.name ?? id;
  const place = (id: string) => world.water[id]?.name ?? world.site[id]?.name ?? world.island[id]?.name ?? id;
  const lanePlace = (id: string) => {
    const l = world.lane[id];
    return l ? `the lane between ${place(l.a)} and ${place(l.b)}` : id;
  };
  const time = (t: number) => `t${t.toFixed(t % 1 === 0 ? 0 : 2).padStart(t % 1 === 0 ? 1 : 4)}`.padEnd(6);
  const named = (id: string) => (world.lane[id] ? lanePlace(id) : place(id));
  const list = (ids: string[]) => (ids.length ? ids.map(named).join(", ") : "nothing new");
  const lines: string[] = [];
  for (const e of events) {
    const at = time(e.t);
    switch (e.kind) {
      case "tideStart":
        lines.push(`${at} Tide ${e.tide} begins. ` + Object.entries(e.winds).map(([a, w]) => `Wind over ${world.map.archipelagos.find((x) => x.id === a)?.name ?? a}: ${describeWind(w)}.`).join(" "));
        break;
      case "plan": lines.push(`${at} ${shipName(e.ship)} sails on ${e.source === "orders" ? "its orders" : e.source === "planB" ? "its Plan B" : "standing orders"}: ${e.steps} step${e.steps === 1 ? "" : "s"}, ${e.watches} Watches.`); break;
      case "undock": lines.push(`${at} ${shipName(e.ship)} casts off from ${place(e.water)}.`); break;
      case "hop": lines.push(`${at} ${shipName(e.ship)} sails from ${place(e.from)} to ${place(e.to)} (${e.cost} Watch${e.cost === 1 ? "" : "es"}, arrives t${e.ends}).`); break;
      case "arrive": lines.push(`${at} ${shipName(e.ship)} reaches ${place(e.water)}.${e.charted.length ? " Charted: " + list(e.charted) + "." : ""}`); break;
      case "stop": lines.push(`${at} ${shipName(e.ship)} is ${e.reason === "becalmedShort" ? "becalmed short" : "out of Watches"} in ${place(e.water)}: needed ${e.needed}, had ${e.left}.`); break;
      case "skip": lines.push(`${at} ${shipName(e.ship)} skips step ${e.step} (${e.reason}).`); break;
      case "survey": lines.push(`${at} ${shipName(e.ship)} surveys ${place(e.water)}. Charted: ${list(e.charted)}.${e.revealed.length ? " Found a hidden passage: " + e.revealed.map(lanePlace).join(", ") + "!" : ""}`); break;
      case "land": lines.push(`${at} ${shipName(e.ship)} lands at ${place(e.site)}.${e.unlocked.length ? " Discovered: " + e.unlocked.join(", ") + "." : ""}`); break;
      case "dock": lines.push(`${at} ${shipName(e.ship)} docks in ${place(e.water)}${e.banked ? `, banking ${e.banked} doubloons` : ""}.`); break;
      case "lurk": lines.push(`${at} ${shipName(e.ship)} lies in wait in ${place(e.water)}.`); break;
      case "repair": lines.push(`${at} ${shipName(e.ship)} patches its hull (${e.hullPoints} Hull).`); break;
      case "galeDamage": lines.push(`${at} The gale tears at ${shipName(e.ship)}'s rigging (${e.riggingPoints} left).`); break;
      case "meet": lines.push(`${at} ${shipName(e.a)} and ${shipName(e.b)} sight each other ${e.onLane ? "on " + lanePlace(e.at) : "in " + place(e.at)}.`); break;
      case "encounter": lines.push(`${at} ENCOUNTER ${e.onLane ? "on " + lanePlace(e.at) : "in " + place(e.at)}: ${shipName(e.hunter)} catches ${shipName(e.target)} (${e.result}).`); break;
      case "islandCharted": lines.push(`${at} ${state.captains[e.captain]?.name ?? e.captain} has fully charted ${place(e.island)}.`); break;
      case "supplies":
        lines.push(e.shortRations
          ? `${at} ${shipName(e.ship)} runs out of Provisions${e.provisionsUsed ? ` after eating ${e.provisionsUsed}` : ""} and goes on Short Rations.`
          : `${at} ${shipName(e.ship)} eats ${e.provisionsUsed} Provisions (${e.provisionsLeft} left).`);
        break;
      case "tideEnd": lines.push(`${at} Tide ${e.tide} ends.`); break;
    }
  }
  return lines;
}
