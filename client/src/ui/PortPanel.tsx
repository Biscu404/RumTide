import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMap } from "@engine/map.ts";
import type { Good } from "@engine/types.ts";
import { callFunction } from "../net/api.ts";
import type { Me } from "../net/captain.ts";
import type { PortPayload } from "../net/payloads.ts";
import {
  GOOD_LABEL, MAX_LEVEL, STATS, buyCost, hold, maxBuy, portContext, quotes, repairQuote, sellRevenue, shipwright, upgrades,
} from "./portModel.ts";

interface Props { client: SupabaseClient; map: GameMap; me: Me; onChanged: () => Promise<void> }

const doubloons = (n: number) => `${Math.round(n).toLocaleString()} doubloons`;

/** The Port screen: trade, repairs, upgrades and the Shipwright. Every action happens at once on the server. */
export function PortPanel({ client, map, me, onChanged }: Props) {
  const [units, setUnits] = useState<Record<Good, number>>({ rum: 1, spice: 1, sugar: 1 });
  const [instalment, setInstalment] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  const { ship, captain } = me;
  const open = me.tide.status === "open";

  if (!ship.docked) {
    return (
      <div class="panel-body">
        <p>Your ship is at sea. Trade, repairs and upgrades open when you are docked in a port.</p>
      </div>
    );
  }

  async function act(payload: PortPayload) {
    setBusy(true);
    setMessage(null);
    const reply = await callFunction<{ message: string }>(client, "port_action", payload);
    if (reply.ok) {
      setMessage({ text: reply.data.message, bad: false });
      await onChanged();
    } else {
      setMessage({ text: reply.error, bad: true });
    }
    setBusy(false);
  }

  const ctx = portContext(map, me);
  const room = hold(me);
  const repair = repairQuote(ctx, me);
  const wright = shipwright(me);
  const boomed = me.tide.boomPortId === ship.nodeId;

  return (
    <div class="panel-body">
      <h2>{map.node(ship.nodeId).name}</h2>
      {boomed && <p class="notice">Trade Winds: this port is booming this week.</p>}
      {!open && <p class="notice">The Tide is turning, so the port is shut until the next Tide opens.</p>}
      {message && <p class={message.bad ? "error" : "notice"} role={message.bad ? "alert" : "status"}>{message.text}</p>}

      <p>
        Chest <strong>{doubloons(captain.chestGold)}</strong>. Hold <strong>{room.used} of {room.capacity}</strong>.
        {ship.plunderGold > 0 && <> Plunder aboard {doubloons(ship.plunderGold)}.</>}
      </p>

      <h3>Market</h3>
      <div class="cards">
        {quotes(map, me).map((q) => {
          const n = Math.max(1, Math.floor(units[q.good] || 1));
          return (
            <div class="card" key={q.good}>
              <strong>{GOOD_LABEL[q.good]}</strong> {q.note && <span class="tag">{q.note}</span>}
              <div class="dim small">Buy {q.buyPrice.toFixed(1)} each. Sell {q.sellPrice.toFixed(1)} each, falling as you sell. You hold {q.held}.</div>
              <div class="row">
                <input
                  type="number" min={1} step={1} value={units[q.good]} aria-label={`${GOOD_LABEL[q.good]} units`}
                  onInput={(e) => setUnits({ ...units, [q.good]: Number(e.currentTarget.value) })}
                />
                <button class="secondary" onClick={() => setUnits({ ...units, [q.good]: Math.max(1, maxBuy(q, me)) })}>Max buy</button>
                <button class="secondary" onClick={() => setUnits({ ...units, [q.good]: Math.max(1, q.held) })}>All</button>
              </div>
              <div class="row">
                <button disabled={!open || busy} onClick={() => void act({ action: "buy", good: q.good, units: n })}>
                  Buy {n} for {buyCost(q, n)}
                </button>
                <button
                  disabled={!open || busy || q.held === 0}
                  onClick={() => void act({ action: "sell", good: q.good, units: Math.min(n, q.held) })}
                >
                  Sell {Math.min(n, q.held)} for {sellRevenue(q, Math.min(n, q.held))}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h3>Repairs</h3>
      <p>
        Hull {ship.hullPoints.toFixed(1)} of {repair.max.toFixed(1)}.
        {repair.missing < 0.05 && " Nothing to repair."}
      </p>
      {repair.missing >= 0.05 && (
        <button disabled={!open || busy || repair.points <= 0} onClick={() => void act({ action: "repair" })}>
          Repair {repair.points.toFixed(1)} points for {repair.cost}
        </button>
      )}

      <h3>Upgrades</h3>
      <div class="cards">
        {upgrades(me).map((u) => {
          const info = STATS.find((s) => s.id === u.stat)!;
          return (
            <div class="card" key={u.stat}>
              <strong>{info.label}</strong> <span class="tag">level {u.level} of {MAX_LEVEL}</span>
              <div class="dim small">{info.help}</div>
              <button
                disabled={!open || busy || !u.affordable}
                onClick={() => void act({ action: "upgrade", stat: u.stat })}
              >
                {u.cost === null ? "Top level" : `Upgrade for ${u.cost}`}
              </button>
            </div>
          );
        })}
      </div>

      <h3>Shipwright</h3>
      {wright ? (
        <div class="card">
          <p>
            Building a <strong>{wright.target}</strong>: {Math.round(wright.progress)} of {wright.cost} doubloons paid.
            Levels carry over and the new hull arrives fully repaired.
          </p>
          <div class="row">
            <input
              type="number" min={1} step={1} value={instalment || ""} placeholder="Doubloons" aria-label="Shipwright instalment"
              onInput={(e) => setInstalment(Number(e.currentTarget.value))}
            />
            <button class="secondary" onClick={() => setInstalment(Math.floor(Math.min(captain.chestGold, wright.owed)))}>Most I can</button>
            <button
              disabled={!open || busy || !Number.isInteger(instalment) || instalment < 1}
              onClick={() => void act({ action: "shipwright", amount: instalment })}
            >
              Pay
            </button>
          </div>
        </div>
      ) : (
        <p class="dim">There is no bigger hull to build this season.</p>
      )}
    </div>
  );
}
