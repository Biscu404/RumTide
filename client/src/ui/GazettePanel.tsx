import { useEffect, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMap } from "@engine/map.ts";
import { loadResolvedTides, loadTideReport, type TideReport } from "../net/gazette.ts";
import { describeBattle } from "./gazetteModel.ts";

interface Props { client: SupabaseClient; map: GameMap; seasonId: string; seasonName: string; currentTide: number }

/** The Gazette screen: the Tide's headlines, this captain's own log, and a text replay of every battle. */
export function GazettePanel({ client, map, seasonId, seasonName, currentTide }: Props) {
  const [tides, setTides] = useState<number[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [report, setReport] = useState<TideReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadResolvedTides(client, seasonId).then(
      (list) => { if (live) { setTides(list); setChosen(list[0] ?? null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [client, seasonId, currentTide]);

  useEffect(() => {
    if (chosen === null) { setReport(null); return; }
    let live = true;
    setReport(null);
    loadTideReport(client, seasonId, chosen).then(
      (r) => { if (live) { setReport(r); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [client, seasonId, chosen]);

  if (error) return <div class="panel-body"><p role="alert" class="error">{error}</p></div>;
  if (tides === null) return <div class="panel-body"><p class="dim">Loading</p></div>;
  if (tides.length === 0) {
    return <div class="panel-body"><p class="dim">The first Brine Gazette is printed after the first Tide.</p></div>;
  }

  const names = report ? { captains: report.captainNames, npcs: report.npcKinds } : null;
  return (
    <div class="panel-body">
      <h2>The Brine Gazette: {seasonName}</h2>
      <label>
        Tide
        <select value={chosen ?? ""} onChange={(e) => setChosen(Number((e.target as HTMLSelectElement).value))}>
          {tides.map((n) => <option key={n} value={n}>Tide {n}</option>)}
        </select>
      </label>
      {!report && <p class="dim">Loading</p>}
      {report && names && (
        <>
          <h3>Headlines</h3>
          {report.gazette
            ? <ul class="lines">{report.gazette.headlines.map((h, i) => <li key={i}>{h}</li>)}</ul>
            : <p class="dim">This Tide has no Gazette.</p>}
          {report.ownLog.length > 0 && (
            <>
              <h3>Your log</h3>
              <ul class="lines">{report.ownLog.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </>
          )}
          <h3>Battles</h3>
          {report.battles.length === 0 && <p class="dim">No battles this Tide.</p>}
          {report.battles.map((battle) => {
            const text = describeBattle(battle, names, map);
            return (
              <details key={battle.id} class="battle">
                <summary>{text.title} <span class="dim">off {text.place}</span></summary>
                {text.rounds.map((r) => (
                  <div key={r.round} class="card">
                    <strong>Round {r.round}</strong>
                    {r.ships.map((line, i) => <span key={i}>{line}</span>)}
                    <span class="dim">{r.summary}</span>
                  </div>
                ))}
                <p><strong>{text.result}</strong></p>
                {text.aftermath.map((line, i) => <p key={i} class="dim">{line}</p>)}
              </details>
            );
          })}
        </>
      )}
    </div>
  );
}
