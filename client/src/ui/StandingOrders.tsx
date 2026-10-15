import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Maneuver } from "@engine/types.ts";
import { callFunction } from "../net/api.ts";
import type { Me } from "../net/captain.ts";
import { MANEUVERS, PARLEYS, TRIANGLE } from "./ordersModel.ts";
import {
  shoreLeaveNote, standingChanged, standingDraftFor, standingPayload, standingSentence, type StandingDraft,
} from "./standingModel.ts";

interface Props { client: SupabaseClient; me: Me; onChanged: () => Promise<void> }

/**
 * Standing orders (section 12.4): what the ship does, and how it fights, in a Tide the captain sends
 * no orders for. Saved on their own, so they work even if the captain never opens the Orders form.
 */
export function StandingOrders({ client, me, onChanged }: Props) {
  const [draft, setDraft] = useState<StandingDraft>(() => standingDraftFor(me.captain));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const open = me.tide.status === "open";
  const changed = standingChanged(me.captain, draft);
  const setRound = (i: number, m: Maneuver) => setDraft({ ...draft, plan: draft.plan.map((x, j) => (j === i ? m : x)) as StandingDraft["plan"] });

  async function save() {
    setBusy(true);
    setMessage(null);
    const reply = await callFunction(client, "standing_orders", standingPayload(draft));
    if (reply.ok) {
      setMessage({ text: "Standing orders saved.", bad: false });
      await onChanged();
    } else {
      setMessage({ text: reply.error, bad: true });
    }
    setBusy(false);
  }

  return (
    <details class="battle standing">
      <summary>Standing orders and Shore Leave</summary>
      <p class="sentence">{standingSentence(draft)}</p>
      <fieldset disabled={!open || busy}>
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
        <p class="dim small">{TRIANGLE}</p>
        <label>
          Parley if the hunter is
          <select
            value={String(draft.parley)}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setDraft({ ...draft, parley: v === "off" ? "off" : (Number(v) as 1.25 | 1.5) });
            }}
          >
            {PARLEYS.map((p) => <option key={String(p.value)} value={String(p.value)}>{p.label}</option>)}
          </select>
        </label>
      </fieldset>
      {!open && <p class="notice">The Tide is turning, so standing orders are closed until the next Tide opens.</p>}
      {message && <p class={message.bad ? "error" : "notice"} role={message.bad ? "alert" : "status"}>{message.text}</p>}
      <div class="actions">
        <button disabled={!open || busy || !changed} onClick={() => void save()}>Save standing orders</button>
      </div>
      <p class="dim small">{shoreLeaveNote(me.captain)}</p>
    </details>
  );
}
