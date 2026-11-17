// The beta's admin tab (D249 to D258): the shared Tide, a confirmed advance, a way back one, and who has a plan saved.
// Hiding the button is only for tidiness. The database refuses a Tide change from anyone who is not in `admins`.
import { useCallback, useEffect, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSubmissions, loadTideLog, setTide, type TideMove } from "../net/beta.ts";
import { advanceQuestion, backQuestion, stepTide, submissionSummary, type Submission } from "./betaModel.ts";

interface Props { client: SupabaseClient; tide: number; onTide: (tide: number) => void }

type Confirming = "advance" | "back" | null;

function when(iso: string): string {
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BetaAdmin({ client, tide, onTide }: Props) {
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [moves, setMoves] = useState<TideMove[]>([]);

  const reload = useCallback(() => {
    loadSubmissions(client).then(setRows, (e) => setMessage(e instanceof Error ? e.message : String(e)));
    loadTideLog(client).then(setMoves, () => { /* the log is a nicety */ });
  }, [client]);

  // The list follows the Tide, and refreshes every ten seconds while the page is open so a saved plan shows up.
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 10_000);
    return () => clearInterval(timer);
  }, [reload, tide]);

  const next = stepTide(tide, 1);
  const prev = stepTide(tide, -1);

  async function move(by: 1 | -1) {
    const target = stepTide(tide, by);
    if (target === null) return;
    setBusy(true);
    setMessage(null);
    try {
      onTide(await setTide(client, target));
      setMessage(by === 1 ? `Everyone is now on Tide ${target}.` : `Set back to Tide ${target}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  return (
    <section class="beta-admin" aria-label="Game master">
      <h1>Game master</h1>
      <div class="beta-card">
        <p class="dim">The Tide every player is on</p>
        <p class="bigtide" aria-live="polite">Tide {tide}</p>
        {confirming === null ? (
          <div class="row">
            <button disabled={busy || next === null} onClick={() => setConfirming("advance")}>Advance to Tide {next ?? "?"}</button>
            <button class="secondary" disabled={busy || prev === null} onClick={() => setConfirming("back")}>Set back to Tide {prev ?? "?"}</button>
          </div>
        ) : (
          <div role="alertdialog" aria-label="Confirm">
            <p>{confirming === "advance" ? advanceQuestion(tide) : backQuestion(tide)}</p>
            <div class="row">
              <button disabled={busy} onClick={() => void move(confirming === "advance" ? 1 : -1)}>
                {confirming === "advance" ? "Yes, advance" : "Yes, set back"}
              </button>
              <button class="secondary" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button>
            </div>
          </div>
        )}
        {message && <p class="notice" role="status">{message}</p>}
      </div>

      <div class="beta-card">
        <h2>Plans saved for Tide {tide}</h2>
        {rows === null ? <p class="dim">Loading</p> : (
          <>
            <p class="dim">{submissionSummary(rows)}</p>
            <table class="beta-table">
              <thead><tr><th>Account</th><th>Plan</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.email}</td>
                    <td>{r.submittedAt ? `Saved ${when(r.submittedAt)}, ${r.style ?? "?"}, ${r.steps} ${r.steps === 1 ? "step" : "steps"}` : <span class="dim">Nothing yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div class="beta-card">
        <h2>Recent moves of the Tide</h2>
        {moves.length === 0 ? <p class="dim">None yet.</p> : (
          <ul>{moves.map((m) => <li key={`${m.at}${m.to}`}>{when(m.at)}: Tide {m.from} to Tide {m.to}</li>)}</ul>
        )}
      </div>
    </section>
  );
}
