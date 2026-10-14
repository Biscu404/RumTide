// What makes a bot season "sane" (day 5 of section 19.1). Impossible states, crashes and seasons that
// do not replay from their seed always fail. The bands below are loose on purpose: they catch a
// broken engine, not a balance opinion.

import type { ApiSeasonReport } from "./api_season.ts";
import type { SeasonReport } from "./season.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: number[]) => sum(xs) / xs.length;

/** Totals over a group of seasons, for printing and for the bands. */
export function totals(reports: readonly SeasonReport[]) {
  const per = (pick: (r: SeasonReport) => number) => mean(reports.map(pick));
  const battleSum = (pick: (r: SeasonReport["battles"][number]) => boolean) => per((r) => r.battles.filter(pick).length);
  const tideSum = (pick: (t: SeasonReport["tides"][number]) => number) => per((r) => sum(r.tides.map(pick)));
  return {
    battles: per((r) => r.battles.length),
    pvp: battleSum((b) => b.sides.every((s) => s.npcIds.length === 0)),
    fleetBattles: battleSum((b) => b.sides.some((s) => s.captainIds.length > 1)),
    withBounty: battleSum((b) => b.bountiesAdded.length > 0),
    merchantsTaken: tideSum((t) => t.merchantsTaken),
    tributes: tideSum((t) => t.tributes),
    escapes: tideSum((t) => t.escapes),
    towed: tideSum((t) => t.towed),
    galleonSeasons: reports.filter((r) => r.tides.some((t) => t.galleonSunk)).length,
  };
}

/** Problems every season must be free of, whatever the roster. */
export function commonProblems(label: string, reports: readonly SeasonReport[], replay: (seed: number) => SeasonReport): string[] {
  const problems: string[] = [];
  for (const r of reports) {
    for (const p of r.problems.slice(0, 5)) problems.push(`${label} seed ${r.seed}: ${p}`);
    if (r.problems.length > 5) problems.push(`${label} seed ${r.seed}: and ${r.problems.length - 5} more`);
    if (r.tides.length !== 14) problems.push(`${label} seed ${r.seed}: only ${r.tides.length} Tides were played`);
  }
  // The same seed must give the same season, down to the last doubloon.
  for (const r of reports.slice(0, 3)) {
    if (JSON.stringify(replay(r.seed).final) !== JSON.stringify(r.final)) {
      problems.push(`${label} seed ${r.seed}: replaying it gave a different season`);
    }
  }
  return problems;
}

const captain = (reports: readonly SeasonReport[], id: string) => reports.map((r) => r.captains.find((c) => c.id === id)!);

/** The Season 0 roster: two traders, a raider, a reaver and a convoy. */
export function sixCaptainProblems(reports: readonly SeasonReport[]): string[] {
  const problems: string[] = [];
  const t = totals(reports);
  const need = (ok: boolean, what: string) => { if (!ok) problems.push(`six captains: ${what}`); };

  need(t.battles >= 3, `only ${t.battles.toFixed(1)} battles a season, expected a few`);
  need(t.merchantsTaken >= 1, "merchants are almost never beaten");
  need(t.escapes >= 1, "nobody ever slips away");
  need(t.towed > 0, "no ship was ever struck");

  const ann = captain(reports, "ann");
  need(ann.filter((c) => c.hull !== "sloop").length >= 0.8 * ann.length, "the careful solo trader should own a Brigantine by Tide 14 in most seasons");
  need(mean(ann.map((c) => c.levels)) >= 15, "the careful solo trader should have bought at least 15 upgrade levels");
  need(captain(reports, "bob").every((c) => c.shoreLeave >= 1), "a captain who missed Tides 5 to 7 should have Shore Leave stored");
  for (const id of ["ann", "bob", "cat", "dan", "eve", "fay"]) {
    need(mean(captain(reports, id).map((c) => c.legend)) > 0, `${id} ends with no Legend`);
  }
  return problems;
}

/** Everyone hunts: the PvP rules must all fire. */
export function brawlProblems(reports: readonly SeasonReport[]): string[] {
  const problems: string[] = [];
  const t = totals(reports);
  const need = (ok: boolean, what: string) => { if (!ok) problems.push(`brawl: ${what}`); };
  need(t.pvp >= 2, `only ${t.pvp.toFixed(1)} captain against captain battles a season`);
  need(t.fleetBattles >= 0.5, "fleet battles are almost never fought");
  need(t.withBounty > 0, "no bounty was ever earned");
  need(t.towed >= 2, "ships are almost never struck");
  return problems;
}

/** A season played through the handlers must be clean and end exactly as the direct season did. */
export function apiProblems(label: string, direct: SeasonReport, api: ApiSeasonReport): string[] {
  const problems = api.problems.slice(0, 5).map((p) => `${label} seed ${direct.seed} through the handlers: ${p}`);
  if (api.problems.length > 5) problems.push(`${label} seed ${direct.seed} through the handlers: and ${api.problems.length - 5} more`);
  if (JSON.stringify(api.final) !== JSON.stringify(direct.final)) {
    problems.push(`${label} seed ${direct.seed}: the handlers ended in a different season than the direct run`);
  }
  if (api.portActions === 0 || api.orders === 0) problems.push(`${label} seed ${direct.seed}: the bots made no port actions or no orders`);
  return problems;
}
