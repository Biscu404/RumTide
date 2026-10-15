import { useEffect, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fleet } from "@engine/types.ts";
import { loadLegend } from "../net/legend.ts";
import { fairWindsLine } from "./incomeModel.ts";
import { legendScreen, type LegendRow } from "./legendModel.ts";

interface Props {
  client: SupabaseClient;
  seasonId: string;
  myCaptainId: string;
  /** The Tide that is open, and the season's length and fog from its settings. */
  tide: number;
  lengthTides: number;
  fogOfLegendTides: number;
  fleets: readonly Pick<Fleet, "id" | "name" | "colour">[];
  /** Fair Winds is shown here because it is judged on Legend: below 70% of the median. */
  fairWinds: boolean;
  /** The season has ended, so this is the final ranking, with no fog. */
  over: boolean;
}

/** The Legend screen: every captain ranked by Legend, with Most Wanted, fleets and Ashore marked. */
export function LegendPanel({ client, seasonId, myCaptainId, tide, lengthTides, fogOfLegendTides, fleets, fairWinds, over }: Props) {
  const [rows, setRows] = useState<LegendRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadLegend(client, seasonId).then(
      (list) => { if (live) { setRows(list); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, [client, seasonId, tide]);

  if (error) return <div class="panel-body"><p role="alert" class="error">{error}</p></div>;
  if (rows === null) return <div class="panel-body"><p class="dim">Loading</p></div>;

  const screen = legendScreen({ captains: rows, fleets, myCaptainId, tide, lengthTides, fogOfLegendTides, ended: over });
  return (
    <div class="panel-body">
      <h2>{screen.final ? "Final Legend" : "Legend"}</h2>
      {screen.note && <p class="dim small" role="status">{screen.note}</p>}
      {fairWinds && !over && <p class="notice small">{fairWindsLine()}</p>}
      <table class="legend">
        <thead>
          <tr><th scope="col">Rank</th><th scope="col">Captain</th><th scope="col" class="num">Legend</th><th scope="col" class="num">Bounty</th></tr>
        </thead>
        <tbody>
          {screen.entries.map((e) => (
            <tr key={e.captainId} class={e.isMe ? "me" : undefined}>
              <td>{e.rank ?? "-"}</td>
              <td>
                <div><strong>{e.shipName}</strong>{e.isMe && <span class="dim"> (you)</span>}</div>
                {(e.champion || e.mostWanted || e.ashore || e.fleetName) && (
                  <div class="marks">
                    {e.champion && <span class="tag">Champion</span>}
                    {e.mostWanted && <span class="tag">Most Wanted</span>}
                    {e.ashore && <span class="tag">Ashore</span>}
                    {e.fleetName && (
                      <span class="fleet-name small">
                        <span class="swatch" style={{ background: e.fleetColour ?? undefined }} aria-hidden="true" />
                        {e.fleetName}
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td class="num">{e.legend ?? "hidden"}</td>
              <td class="num">{e.bounty > 0 ? e.bounty : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
