// The closed beta inside the live site (D249 to D258): /sandbox, /sandbox/tide and /sandbox/admin, behind the same login
// as the game. The sandbox pages are the real ones from sandbox/src and run the real engine_v3 in the browser. This
// shell adds the one shared Tide number, the saved plan and the game master's tab.
import type { ComponentChildren } from "preact";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { C } from "../palette.ts";
import { isAdmin, loadPlan, loadTide, savePlan, watchTide } from "../net/beta.ts";
import { BETA_PATH, type BetaPage, type StoredPlan } from "./betaModel.ts";
import { BetaAdmin } from "./BetaAdmin.tsx";

interface Props {
  client: SupabaseClient;
  session: Session;
  page: BetaPage;
  go: (path: string) => void;
}

/** Loads a module of the sandbox on first use, so the game's own first screen does not carry the engine. */
function useModule<T>(load: () => Promise<T>): { mod: T | null; error: string | null } {
  const [state, setState] = useState<{ mod: T | null; error: string | null }>({ mod: null, error: null });
  useEffect(() => {
    let live = true;
    load().then((mod) => { if (live) setState({ mod, error: null }); }, (e) => { if (live) setState({ mod: null, error: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, []);
  return state;
}

/** The sandbox pages style bare elements (button, h1, label), which would restyle the whole site. A shadow root keeps
 *  their CSS in and the site's CSS out, so neither side needs rewriting. */
function Shadowed({ css, children }: { css: string; children: ComponentChildren }) {
  const host = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" });
    root.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `:host { display: block; min-height: 100%; background: ${C.ink}; color: ${C.parchment}; font: 16px/1.45 system-ui, sans-serif; }\n${css}`;
    const div = document.createElement("div");
    root.append(style, div);
    mount.current = div;
    return () => { render(null, div); mount.current = null; };
  }, [css]);
  useEffect(() => { if (mount.current) render(<>{children}</>, mount.current); });
  return <div ref={host} />;
}

export function Beta({ client, session, page, go }: Props) {
  const [tide, setTide] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let live = true;
    loadTide(client).then((t) => { if (live) { setTide(t); setError(null); } }, (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    void isAdmin(client).then((a) => { if (live) setAdmin(a); });
    const stop = watchTide(client, (t) => { setTide(t); setError(null); }, (m) => setError(m));
    return () => { live = false; stop(); };
  }, [client]);

  return (
    <div class="screen">
      <header class="bar">
        <strong>Rumtide beta</strong>
        <span role="status" class={error ? "dim" : ""}>{error ? `Cannot reach the server: ${error}` : tide === null ? "Loading" : `Tide ${tide}`}</span>
        <span class="spacer" />
        <button class={page === "battle" ? "" : "secondary"} onClick={() => go(BETA_PATH.battle)}>Battle viewer</button>
        <button class={page === "tide" ? "" : "secondary"} onClick={() => go(BETA_PATH.tide)}>One Tide</button>
        {admin && <button class={page === "admin" ? "" : "secondary"} onClick={() => go(BETA_PATH.admin)}>Admin</button>}
        <button class="secondary" onClick={() => go("/")}>The game</button>
        <button class="secondary" onClick={() => void client.auth.signOut()}>Sign out</button>
      </header>
      <div class="beta-body">
        {page === "battle" && <BattlePage />}
        {page === "tide" && (tide === null ? <p class="center dim">Loading the Tide</p> : <TidePage client={client} userId={session.user.id} tide={tide} />)}
        {page === "admin" && (
          admin
            ? (tide === null ? <p class="center dim">Loading the Tide</p> : <BetaAdmin client={client} tide={tide} onTide={setTide} />)
            : <p class="center dim">Only the game master can open this page.</p>
        )}
      </div>
    </div>
  );
}

function BattlePage() {
  const { mod, error } = useModule(() => import("../../../sandbox/src/main.tsx"));
  if (error) return <p class="center dim" role="alert">The battle viewer did not load: {error}</p>;
  if (!mod) return <p class="center dim">Loading the battle viewer</p>;
  return <Shadowed css={mod.CSS}><mod.App /></Shadowed>;
}

const SAVE_DELAY_MS = 700;

function saveProblem(message: string, tide: number): string {
  return /row-level security|violates/i.test(message)
    ? `Tide ${tide} is no longer open, so this change was not saved. The page will update to the new Tide.`
    : `Could not save: ${message}`;
}

function TidePage({ client, userId, tide }: { client: SupabaseClient; userId: string; tide: number }) {
  const { mod, error } = useModule(() => import("../../../sandbox/src/tide.tsx"));
  const [loaded, setLoaded] = useState<{ tide: number; plan: StoredPlan | null } | null>(null);
  const [note, setNote] = useState("Your plan is saved as you change it.");
  const pending = useRef<{ timer: number; plan: StoredPlan; tide: number } | null>(null);

  useEffect(() => {
    let live = true;
    setLoaded(null);
    setNote("Your plan is saved as you change it.");
    loadPlan(client, userId, tide).then(
      (plan) => { if (live) { setLoaded({ tide, plan }); if (plan) setNote(`Your saved plan for Tide ${tide} is back.`); } },
      (e) => { if (live) { setLoaded({ tide, plan: null }); setNote(`Could not load your saved plan: ${e instanceof Error ? e.message : String(e)}`); } },
    );
    return () => { live = false; };
  }, [client, userId, tide]);

  const write = useCallback((plan: StoredPlan, forTide: number) => {
    savePlan(client, userId, forTide, plan).then(
      () => setNote(`Saved for Tide ${forTide} at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`),
      (e) => setNote(saveProblem(e instanceof Error ? e.message : String(e), forTide)),
    );
  }, [client, userId]);

  const onChange = useCallback((plan: StoredPlan) => {
    if (pending.current) clearTimeout(pending.current.timer);
    setNote("Saving");
    const forTide = tide;
    const timer = window.setTimeout(() => { pending.current = null; write(plan, forTide); }, SAVE_DELAY_MS);
    pending.current = { timer, plan, tide: forTide };
  }, [tide, write]);

  // Leaving the page (or a new Tide arriving) sends a change that is still waiting, rather than losing it.
  useEffect(() => () => {
    const p = pending.current;
    if (p) { clearTimeout(p.timer); pending.current = null; write(p.plan, p.tide); }
  }, [write]);

  if (error) return <p class="center dim" role="alert">The Tide page did not load: {error}</p>;
  if (!mod || !loaded || loaded.tide !== tide) return <p class="center dim">Loading your plan for Tide {tide}</p>;
  return (
    <Shadowed css={mod.CSS}>
      <mod.App key={tide} beta={{ tide, saved: loaded.plan, saveNote: note, onChange: (plan) => onChange({ style: plan.style, steps: plan.steps as unknown as Record<string, unknown>[] }) }} />
    </Shadowed>
  );
}
