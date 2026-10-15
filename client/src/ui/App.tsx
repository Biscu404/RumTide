import { useCallback, useEffect, useState } from "preact/hooks";
import type { Session } from "@supabase/supabase-js";
import { sound } from "../audio/sound.ts";
import { loadMe, type Me } from "../net/captain.ts";
import { NO_FLEETS, loadFleets, type FleetsState } from "../net/fleets.ts";
import { supabase } from "../net/supabase.ts";
import { loadWorld, type World } from "../net/world.ts";
import { DEFAULT_MAP_ID, mapById } from "../scenes/maps.ts";
import { Admin } from "./Admin.tsx";
import { Login } from "./Login.tsx";
import { FleetPanel } from "./FleetPanel.tsx";
import { GazettePanel } from "./GazettePanel.tsx";
import { LegendPanel } from "./LegendPanel.tsx";
import { MapView } from "./MapView.tsx";
import { OrdersPanel } from "./OrdersPanel.tsx";
import { withFleetColours } from "./fleetModel.ts";
import { PortPanel } from "./PortPanel.tsx";
import { SoundToggle } from "./SoundToggle.tsx";
import { checkTideNews } from "./tideNews.ts";
import { hold } from "./portModel.ts";
import { omenNames } from "./exploreModel.ts";
import { shipSpeed } from "./ordersModel.ts";

const NO_WORLD: World = { season: null, ships: [] };

// Made up ships for the no server preview, so the map can be seen with ships on it.
const PREVIEW_SHIPS = [
  { captainId: "a", shipName: "Your Sloop", nodeId: "rumhaven", docked: true, hull: "sloop", hullPoints: 1, isMine: true },
  { captainId: "b", shipName: "Black Gull", nodeId: "rumhaven", docked: true, hull: "sloop", hullPoints: 1, isMine: false },
  { captainId: "c", shipName: "Salt Widow", nodeId: "sea03", docked: false, hull: "sloop", hullPoints: 1, isMine: false },
];

export function App() {
  // Without a Supabase project the map still draws, so the client can be tried on its own.
  if (!supabase) {
    return (
      <div class="screen">
        <header class="bar">
          <strong>Rumtide</strong>
          <span class="dim">Preview: no server configured, see client/.env.example</span>
          <span class="spacer" />
          <SoundToggle />
        </header>
        <MapView map={mapById(DEFAULT_MAP_ID)} ships={PREVIEW_SHIPS} />
      </div>
    );
  }
  return <Online client={supabase} />;
}

function Online({ client }: { client: NonNullable<typeof supabase> }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (session === undefined) return <p class="center dim">Loading</p>;
  if (!session) return <Login client={client} />;
  return <Game client={client} session={session} />;
}

function Game({ client, session }: { client: NonNullable<typeof supabase>; session: Session }) {
  const [world, setWorld] = useState<World>(NO_WORLD);
  const [me, setMe] = useState<Me | null>(null);
  const [fleets, setFleets] = useState<FleetsState>(NO_FLEETS);
  const [tab, setTab] = useState<"orders" | "port" | "fleet" | "legend" | "gazette" | null>("orders");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inAdmin, setInAdmin] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadWorld(client, session.user.id);
      const mine = next.season ? await loadMe(client, session.user.id, next.season.id, next.season.currentTide) : null;
      const theirs = next.season && mine ? await loadFleets(client, next.season.id, mine.tide.number, mine.captain.id) : NO_FLEETS;
      setWorld(next);
      setMe(mine);
      setFleets(theirs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, session.user.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  // A Tide has turned since this device was last here: the Tide jingle plays at the first tap (section 2.3).
  const seasonId = world.season?.id;
  const currentTide = world.season?.currentTide;
  useEffect(() => {
    if (seasonId === undefined || currentTide === undefined) return;
    let storage: Storage | null = null;
    try { storage = localStorage; } catch { /* blocked */ }
    if (checkTideNews(storage, seasonId, currentTide)) sound.playWhenUnlocked("jingle");
  }, [seasonId, currentTide]);

  let map;
  let mapError: string | null = null;
  try {
    map = mapById(world.season?.mapId ?? DEFAULT_MAP_ID);
  } catch (e) {
    map = mapById(DEFAULT_MAP_ID);
    mapError = e instanceof Error ? e.message : String(e);
  }

  const { season } = world;
  const ships = withFleetColours(world.ships, fleets.fleets);
  const invitations = me && me.captain.fleetId === null ? fleets.invites.filter((i) => i.captainId === me.captain.id).length : 0;
  const hasShip = world.ships.some((s) => s.isMine);
  const status = error ?? mapError
    ?? (loading && !season ? "Loading" : null)
    ?? (!season ? "No season is running yet." : null)
    ?? (!hasShip ? "You are not a captain in this season." : null);

  if (inAdmin) return <Admin client={client} onClose={() => { setInAdmin(false); void refresh(); }} />;

  return (
    <div class="screen">
      <header class="bar">
        <strong>{season ? `${season.name}, Tide ${season.currentTide} of ${season.lengthTides}` : "Rumtide"}</strong>
        {status && <span class="dim" role="status">{status}</span>}
        <span class="spacer" />
        <SoundToggle />
        <button class="secondary" disabled={loading} onClick={() => void refresh()}>Refresh</button>
        <button class="secondary" onClick={() => setInAdmin(true)}>Game master</button>
        <button class="secondary" onClick={() => void client.auth.signOut()}>Sign out</button>
      </header>
      <MapView map={map} ships={ships} />
      {me && (
        <section class="dock" aria-label="Captain's desk">
          <div class="tabs">
            <div class="tablist" role="tablist">
              <button role="tab" aria-selected={tab === "orders"} class={tab === "orders" ? "tab on" : "tab"} onClick={() => setTab(tab === "orders" ? null : "orders")}>
                Orders
              </button>
              <button role="tab" aria-selected={tab === "port"} class={tab === "port" ? "tab on" : "tab"} onClick={() => setTab(tab === "port" ? null : "port")}>
                {me.ship.docked ? "Port" : "Port (at sea)"}
              </button>
              <button role="tab" aria-selected={tab === "fleet"} class={tab === "fleet" ? "tab on" : "tab"} onClick={() => setTab(tab === "fleet" ? null : "fleet")}>
                {invitations > 0 ? `Fleet (${invitations})` : "Fleet"}
              </button>
              <button role="tab" aria-selected={tab === "legend"} class={tab === "legend" ? "tab on" : "tab"} onClick={() => setTab(tab === "legend" ? null : "legend")}>
                Legend
              </button>
              <button role="tab" aria-selected={tab === "gazette"} class={tab === "gazette" ? "tab on" : "tab"} onClick={() => setTab(tab === "gazette" ? null : "gazette")}>
                Gazette
              </button>
            </div>
            <span class="spacer" />
            <span class="dim small stats">
              {Math.round(me.captain.chestGold).toLocaleString()} gold, hull {me.ship.hullPoints.toFixed(0)}, hold {hold(me).used}/{hold(me).capacity}, speed {shipSpeed(me.ship)}
              {me.captain.shoreLeaveTides > 0 && `, Shore Leave ${me.captain.shoreLeaveTides}`}{me.captain.fairWinds && ", Fair Winds"}
              {me.captain.omens.length > 0 && `, ${omenNames(me.captain.omens)}`}
            </span>
          </div>
          {tab === "orders" && <OrdersPanel key={`orders-${me.tide.number}`} client={client} map={map} me={me} onChanged={refresh} />}
          {tab === "port" && <PortPanel client={client} map={map} me={me} ships={ships} onChanged={refresh} />}
          {tab === "fleet" && <FleetPanel client={client} map={map} me={me} state={fleets} ships={ships} onChanged={refresh} />}
          {tab === "legend" && season && (
            <LegendPanel
              client={client} seasonId={season.id} myCaptainId={me.captain.id} tide={season.currentTide}
              lengthTides={season.lengthTides} fogOfLegendTides={me.settings.fogOfLegendTides}
              fleets={fleets.fleets} fairWinds={me.captain.fairWinds}
            />
          )}
          {tab === "gazette" && season && (
            <GazettePanel client={client} map={map} seasonId={season.id} seasonName={season.name} currentTide={season.currentTide} />
          )}
        </section>
      )}
    </div>
  );
}
