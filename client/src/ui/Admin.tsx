import { useCallback, useEffect, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { explain } from "../net/api.ts";

// The shapes the admin function returns (supabase/functions/_shared/api/handlers.ts, adminRequest).
// Keep them in step with that file. The client only reads them; the server decides everything.
interface SeasonInfo { id: string; name: string; lengthTides: number; timezone: string }
interface TideRow { number: number; status: string; dueAt: string; resolvedAt: string | null; error: string | null }
interface LogRow { at: string; adminId: string | null; action: string; tide: number; outcome: string; detail: string | null }
interface StatusReply {
  season: SeasonInfo | null;
  tide?: { number: number; status: string; dueAt: string };
  tides: TideRow[];
  log: LogRow[];
}
interface StartReply { started: { seasonId: string; name: string; captains: number } }
interface EndReply { ended: { seasonId: string; name: string; tide: number } }
interface ResolveReply {
  outcome: { status: string; tide?: number; reason?: string; error?: string; seasonEnded?: boolean };
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function outcomeText(reply: ResolveReply["outcome"]): string {
  switch (reply.status) {
    case "resolved":
      return `Tide ${reply.tide} resolved (${reply.reason}).${reply.seasonEnded ? " The season is over." : ""} The Gazette went to Discord if a webhook is set.`;
    case "failed":
      return `Tide ${reply.tide} failed: ${reply.error}. Fix the cause, then retry it.`;
    case "busy":
      return "Nothing to do. The Tide is already resolving or has resolved.";
    case "waiting":
      return "The Tide is not due and not everyone is Ready, so nothing was resolved.";
    default:
      return `Nothing happened (${reply.status}).`;
  }
}

export function Admin({ client, onClose }: { client: SupabaseClient; onClose: () => void }) {
  const [status, setStatus] = useState<StatusReply | null>(null);
  const [start, setStart] = useState({ name: "Season 0", preset: "season0", who: "all", tideTimeLocal: "21:00" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error: failure } = await client.functions.invoke<StatusReply>("admin", { body: { action: "status" } });
    if (failure) {
      setError(await explain(failure));
      setStatus(null);
    } else {
      setError(null);
      setStatus(data);
    }
    setBusy(false);
  }, [client]);

  useEffect(() => { void load(); }, [load]);

  async function resolveNow(tide: number, retry: boolean) {
    const question = retry
      ? `Retry Tide ${tide}? It resolves from the same seed, so the result is the same as before.`
      : `Resolve Tide ${tide} now? This cannot be undone.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setMessage(null);
    const { data, error: failure } = await client.functions.invoke<ResolveReply>("admin", {
      body: { action: "resolve", tide },
    });
    setBusy(false);
    if (failure) setError(await explain(failure));
    else if (data) setMessage(outcomeText(data.outcome));
    await load();
  }

  async function endSeason(tide: number, name: string) {
    const question = `End "${name}" now at Tide ${tide}? Nobody can play it any more and it cannot be started again. You can start a new season after.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setMessage(null);
    const { data, error: failure } = await client.functions.invoke<EndReply>("admin", {
      body: { action: "end", tide },
    });
    setBusy(false);
    if (failure) setError(await explain(failure));
    else if (data) setMessage(`${data.ended.name} ended at Tide ${data.ended.tide}. You can start a new season now.`);
    await load();
  }

  async function startSeason(event: Event) {
    event.preventDefault();
    const who = start.who === "me" ? "only you" : "everyone who has signed up";
    if (!window.confirm(`Start "${start.name}" now with ${who}? Tide 1 opens at once.`)) return;
    setBusy(true);
    setMessage(null);
    const { data, error: failure } = await client.functions.invoke<StartReply>("admin", {
      body: { action: "start", ...start },
    });
    setBusy(false);
    if (failure) setError(await explain(failure));
    else if (data) setMessage(`${data.started.name} started with ${data.started.captains} ${data.started.captains === 1 ? "captain" : "captains"}. Go back to the map to play.`);
    await load();
  }

  const season = status?.season;
  const current = status?.tide;

  return (
    <div class="screen">
      <header class="bar">
        <strong>Game master</strong>
        {season && <span class="dim">{season.name}, {season.lengthTides} Tides, {season.timezone}</span>}
        <span class="spacer" />
        <button class="secondary" disabled={busy} onClick={() => void load()}>Refresh</button>
        <button class="secondary" onClick={onClose}>Back to the map</button>
      </header>

      <main class="admin">
        {error && <p class="notice" role="alert">{error}</p>}
        {message && <p class="notice" role="status">{message}</p>}
        {!season && !error && status && (
          <section class="admin-panel">
            <h2>Start a season</h2>
            <p class="dim">No season is running. Every account that has signed up becomes a captain, or choose only you to try things out alone.</p>
            <form class="admin-form" onSubmit={(e) => void startSeason(e)}>
              <label>
                Name
                <input value={start.name} maxLength={60} required onInput={(e) => setStart({ ...start, name: e.currentTarget.value })} />
              </label>
              <label>
                Length
                <select value={start.preset} onChange={(e) => setStart({ ...start, preset: e.currentTarget.value })}>
                  <option value="season0">Season 0: 14 Tides, six friends</option>
                  <option value="full">Full season: 28 Tides</option>
                </select>
              </label>
              <label>
                Captains
                <select value={start.who} onChange={(e) => setStart({ ...start, who: e.currentTarget.value })}>
                  <option value="all">Everyone who has signed up</option>
                  <option value="me">Only me (testing)</option>
                </select>
              </label>
              <label>
                Tide time each day
                <input type="time" value={start.tideTimeLocal} required onInput={(e) => setStart({ ...start, tideTimeLocal: e.currentTarget.value })} />
              </label>
              <button type="submit" disabled={busy || !start.name.trim()}>Start season now</button>
            </form>
          </section>
        )}

        {season && current && (
          <section class="admin-panel">
            <h2>Tide {current.number}: {current.status}</h2>
            <p class="dim">Due {when(current.dueAt)}</p>
            {current.status === "open" && (
              <button disabled={busy} onClick={() => void resolveNow(current.number, false)}>
                Resolve Tide {current.number} now
              </button>
            )}
            {current.status === "failed" && (
              <button disabled={busy} onClick={() => void resolveNow(current.number, true)}>
                Retry Tide {current.number}
              </button>
            )}
            {current.status === "resolving" && (
              <p class="dim">This Tide is being resolved right now. If it stays this way for minutes, tell the developer.</p>
            )}
            <p class="dim small">Ending a season is for a playtest or a season that went wrong. Nobody can give orders after that, but the Legend and the Gazette stay readable in the app and nothing is deleted.</p>
            <button class="secondary" disabled={busy || current.status === "resolving"} onClick={() => void endSeason(current.number, season.name)}>
              End this season
            </button>
          </section>
        )}

        {status && status.tides.length > 0 && (
          <section class="admin-panel">
            <h2>Recent Tides</h2>
            <ul class="admin-list">
              {status.tides.map((t) => (
                <li key={t.number}>
                  <strong>Tide {t.number}</strong> {t.status}
                  {t.resolvedAt && <span class="dim"> resolved {when(t.resolvedAt)}</span>}
                  {t.error && <div class="error">{t.error}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {status && status.log.length > 0 && (
          <section class="admin-panel">
            <h2>Admin log</h2>
            <ul class="admin-list">
              {status.log.map((entry, i) => (
                <li key={i}>
                  <span class="dim">{when(entry.at)}</span> {entry.action} Tide {entry.tide}: {entry.outcome}
                  {entry.detail && <div class="error">{entry.detail}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
