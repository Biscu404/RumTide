import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMap } from "@engine/map.ts";
import type { Fleet } from "@engine/types.ts";
import { callFunction } from "../net/api.ts";
import type { Me } from "../net/captain.ts";
import type { FleetsState } from "../net/fleets.ts";
import type { FleetPayload } from "../net/payloads.ts";
import type { ShipMarker } from "../scenes/layout.ts";
import { FLAG_CHOICES, fleetScreen } from "./fleetModel.ts";

interface Props {
  client: SupabaseClient;
  map: GameMap;
  me: Me;
  state: FleetsState;
  ships: ShipMarker[];
  onChanged: () => Promise<void>;
}

const flagLabel = (id: string) => FLAG_CHOICES.find((f) => f.id === id)?.label ?? id;

function Sail({ fleet }: { fleet: Fleet }) {
  return (
    <span class="fleet-name">
      <span class="swatch" style={{ background: fleet.colour }} aria-hidden="true" />
      <strong>{fleet.name}</strong> <span class="dim small">{flagLabel(fleet.flag)} flag</span>
    </span>
  );
}

/** The Fleet screen: found, invite, accept, leave, and what fleet mates plan this Tide (section 8.1). */
export function FleetPanel({ client, map, me, state, ships, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [name, setName] = useState("");
  const [flag, setFlag] = useState(FLAG_CHOICES[0]!.id);
  const [invitee, setInvitee] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const open = me.tide.status === "open";
  const screen = fleetScreen(map, me, state, ships);
  const { mine } = screen;

  async function send(body: FleetPayload) {
    setBusy(true);
    setMessage(null);
    const reply = await callFunction<{ message: string }>(client, "fleet_action", body);
    if (reply.ok) {
      setMessage({ text: reply.data.message, bad: false });
      setConfirmLeave(false);
      setInvitee("");
      await onChanged();
    } else {
      setMessage({ text: reply.error, bad: true });
    }
    setBusy(false);
  }

  return (
    <div class="panel-body">
      {!open && <p class="notice">The Tide is turning, so fleets cannot change. They open again with the next Tide.</p>}
      <p class="dim small">
        A fleet holds up to {screen.cap} captains in this season. Fleet mates see each other's orders, cannot hunt
        each other, and fight side by side. Leaving takes effect when the next Tide opens, and everyone is told.
      </p>

      {mine && (
        <>
          <h2><Sail fleet={mine.fleet} /></h2>
          <ul class="lines">
            {mine.members.map((m) => (
              <li key={m.captainId}>
                <strong>{m.shipName}</strong>{m.isMe && " (you)"}
                {m.leavingAtTide !== null && <> <span class="tag">leaving when Tide {m.leavingAtTide} opens</span></>}
                {!m.isMe && m.ready !== null && <> <span class="tag">{m.ready ? "Ready" : "Not Ready"}</span></>}
                {m.orders && <div class="dim small">{m.orders}</div>}
              </li>
            ))}
          </ul>
          {mine.waitingOn.length > 0 && (
            <p class="dim small">Waiting for an answer from {mine.waitingOn.map((w) => w.shipName).join(", ")}.</p>
          )}

          <fieldset disabled={!open || busy}>
            {mine.canInvite && screen.invitable.length > 0 && (
              <div class="row">
                <select value={invitee} onChange={(e) => setInvitee(e.currentTarget.value)} aria-label="Captain to invite">
                  <option value="">Invite a captain</option>
                  {screen.invitable.map((c) => <option key={c.id} value={c.id}>{c.shipName}</option>)}
                </select>
                <button disabled={invitee === ""} onClick={() => void send({ action: "invite", captainId: invitee })}>Invite</button>
              </div>
            )}
            {mine.full && !mine.iAmLeaving && <p class="dim small">The fleet is full.</p>}
            {mine.canInvite && screen.invitable.length === 0 && !mine.full && (
              <p class="dim small">Every captain without a fleet has been asked already.</p>
            )}

            {!mine.iAmLeaving && !confirmLeave && (
              <div class="actions">
                <button class="secondary" onClick={() => setConfirmLeave(true)}>Leave the fleet</button>
              </div>
            )}
            {!mine.iAmLeaving && confirmLeave && (
              <div class="sentence">
                <p>
                  {mine.members.length === 1
                    ? `You are the only one in the ${mine.fleet.name}, so leaving disbands it now.`
                    : `Leave the ${mine.fleet.name}? You sail with them until Tide ${me.tide.number + 1} opens, and everyone will see that you are going.`}
                </p>
                <div class="actions">
                  <button onClick={() => void send({ action: "leave" })}>
                    {mine.members.length === 1 ? "Disband" : "Give notice"}
                  </button>
                  <button class="secondary" onClick={() => setConfirmLeave(false)}>Stay</button>
                </div>
              </div>
            )}
            {mine.iAmLeaving && <p class="dim small">You have given notice. You sail alone once the next Tide opens.</p>}
          </fieldset>
        </>
      )}

      {!mine && screen.invitations.length > 0 && (
        <>
          <h3>Invitations</h3>
          <div class="cards">
            {screen.invitations.map((i) => (
              <div class="card" key={i.fleet.id}>
                <Sail fleet={i.fleet} />
                <span class="dim small">Asked by {i.from}. Sailing with: {i.members.join(", ")}.</span>
                <div class="actions">
                  <button disabled={!open || busy || i.full} onClick={() => void send({ action: "accept", fleetId: i.fleet.id })}>
                    {i.full ? "Full" : "Join"}
                  </button>
                  <button class="secondary" disabled={!open || busy} onClick={() => void send({ action: "decline", fleetId: i.fleet.id })}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {screen.canFound && (
        <>
          <h3>Found a fleet</h3>
          <fieldset disabled={!open || busy}>
            <label>
              Name
              <input value={name} maxLength={24} placeholder="The Red Tide" onInput={(e) => setName(e.currentTarget.value)} />
            </label>
            <label>
              Flag
              <select value={flag} onChange={(e) => setFlag(e.currentTarget.value)}>
                {FLAG_CHOICES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <div class="actions">
              <button disabled={name.trim().length < 2} onClick={() => void send({ action: "create", name, flag: flag as FleetFlag })}>
                Found it
              </button>
            </div>
            <p class="dim small">The fleet gets a sail colour of its own. Then you can invite captains who have no fleet.</p>
          </fieldset>
        </>
      )}

      {screen.others.length > 0 && (
        <>
          <h3>Other fleets</h3>
          <ul class="lines">
            {screen.others.map((o) => (
              <li key={o.fleet.id}>
                <Sail fleet={o.fleet} />{o.full && <> <span class="tag">full</span></>}
                <div class="dim small">
                  {o.members.map((m) => (m.leavingAtTide === null ? m.shipName : `${m.shipName} (leaving when Tide ${m.leavingAtTide} opens)`)).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {message && <p class={message.bad ? "error" : "notice"} role={message.bad ? "alert" : "status"}>{message.text}</p>}
    </div>
  );
}

type FleetFlag = Extract<FleetPayload, { action: "create" }>["flag"];
