import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMap } from "@engine/map.ts";
import type { Intent, Maneuver } from "@engine/types.ts";
import { callFunction } from "../net/api.ts";
import type { Me } from "../net/captain.ts";
import {
  INTENTS, MANEUVERS, PARLEYS, TRIANGLE, destinations, draftFor, fleetMates, isDirty,
  sentence, shipSpeed, toPayload, type Draft,
} from "./ordersModel.ts";

interface Props { client: SupabaseClient; map: GameMap; me: Me; onChanged: () => Promise<void> }

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** The Orders screen: course, intent, battle plan, parley, and the Ready button. */
export function OrdersPanel({ client, map, me, onChanged }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFor(me));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const open = me.tide.status === "open";
  const mates = fleetMates(me);
  const where = destinations(map, me.ship.nodeId, shipSpeed(me.ship));
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const setRound = (i: number, m: Maneuver) => set({ plan: draft.plan.map((x, j) => (j === i ? m : x)) as Draft["plan"] });

  const built = toPayload(map, me, draft, false);
  const dirty = !built.ok || isDirty(me.orders, built.payload);
  const route = built.ok ? built.payload.course.map((id) => map.node(id).name) : [];

  async function send(ready: boolean) {
    const result = toPayload(map, me, draft, ready);
    if (!result.ok) {
      setMessage({ text: result.reason, bad: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const reply = await callFunction(client, "submit_orders", result.payload);
    if (reply.ok) {
      set({ ready });
      setMessage({ text: ready ? "Orders saved. You are Ready." : "Orders saved.", bad: false });
      await onChanged();
    } else {
      setMessage({ text: reply.error, bad: true });
    }
    setBusy(false);
  }

  let status: string;
  if (!me.orders) status = "Not saved yet. If you do nothing, your standing orders are used.";
  else if (dirty) status = "You have unsaved changes.";
  else status = me.orders.ready ? "Saved. You are Ready." : "Saved. Not Ready yet.";

  return (
    <div class="panel-body">
      <p class="sentence">{sentence(map, me, draft)}</p>
      {!open && <p class="notice">The Tide is turning, so orders are closed. They open again with the next Tide.</p>}

      <fieldset disabled={!open || busy}>
        <label>
          Sail to
          <select value={draft.destination} onChange={(e) => set({ destination: e.currentTarget.value })}>
            <option value={me.ship.nodeId}>{me.ship.docked ? "Stay in port" : "Hold here"} ({map.node(me.ship.nodeId).name})</option>
            {where.map((d) => (
              <option key={d.nodeId} value={d.nodeId}>{d.name} ({d.hops} {d.hops === 1 ? "hop" : "hops"})</option>
            ))}
          </select>
        </label>
        <p class="dim small">
          Speed {shipSpeed(me.ship)}.{" "}
          {route.length > 0 ? `Route: ${route.join(", then ")}.` : "You will not move."}
        </p>

        <label>
          Intent
          <select value={draft.intent} onChange={(e) => set({ intent: e.currentTarget.value as Intent })}>
            {INTENTS.filter((i) => i.id !== "escort" || mates.length > 0).map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </label>
        <p class="dim small">{INTENTS.find((i) => i.id === draft.intent)?.help}</p>

        {draft.intent === "hunt" && (
          <>
            <label>
              Hunt
              <select value={draft.huntKind} onChange={(e) => set({ huntKind: e.currentTarget.value as Draft["huntKind"] })}>
                <option value="merchants">Merchants only</option>
                <option value="players">Players only</option>
                <option value="anyone">Anyone</option>
                <option value="captain" disabled={me.others.length === 0}>One captain</option>
              </select>
            </label>
            {draft.huntKind === "captain" && (
              <label>
                Which captain
                <select value={draft.huntCaptainId} onChange={(e) => set({ huntCaptainId: e.currentTarget.value })}>
                  <option value="">Choose</option>
                  {me.others.map((r) => <option key={r.id} value={r.id}>{r.shipName}</option>)}
                </select>
              </label>
            )}
            <label class="check">
              <input type="checkbox" checked={draft.noQuarter} onChange={(e) => set({ noQuarter: e.currentTarget.checked })} />
              No Quarter: refuse a parley
            </label>
          </>
        )}

        {draft.intent === "escort" && (
          <label>
            Escort
            <select value={draft.escortCaptainId} onChange={(e) => set({ escortCaptainId: e.currentTarget.value })}>
              {mates.map((r) => <option key={r.id} value={r.id}>{r.shipName}</option>)}
            </select>
          </label>
        )}

        <div class="rounds">
          {draft.plan.map((m, i) => (
            <label key={i}>
              Round {i + 1}
              <select value={m} onChange={(e) => setRound(i, e.currentTarget.value as Maneuver)}>
                {MANEUVERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p class="dim small">{TRIANGLE} Repeating a maneuver hits weaker.</p>

        <label>
          Parley if the hunter is
          <select
            value={String(draft.parley)}
            onChange={(e) => {
              const v = e.currentTarget.value;
              set({ parley: v === "off" ? "off" : (Number(v) as 1.25 | 1.5) });
            }}
          >
            {PARLEYS.map((p) => <option key={String(p.value)} value={String(p.value)}>{p.label}</option>)}
          </select>
        </label>
        <p class="dim small">A hunter that strong takes 10% of your plunder and cargo, and you sail on.</p>
      </fieldset>

      <p class="dim small" role="status">{status}</p>
      {message && <p class={message.bad ? "error" : "notice"} role={message.bad ? "alert" : "status"}>{message.text}</p>}

      <div class="actions">
        <button class="secondary" disabled={!open || busy || !dirty} onClick={() => void send(false)}>Save orders</button>
        {me.orders?.ready && !dirty ? (
          <button disabled={!open || busy} onClick={() => void send(false)}>Not Ready</button>
        ) : (
          <button disabled={!open || busy} onClick={() => void send(true)}>Ready</button>
        )}
      </div>
      <p class="dim small">Tide {me.tide.number} closes {when(me.tide.dueAt)}, or earlier if everyone is Ready.</p>
    </div>
  );
}
