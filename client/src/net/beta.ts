// The closed beta's server calls (D249 to D258). Plain table reads and writes: row level security and the
// triggers of migration 20261117000001 decide who may do what, so nothing here is trusted by the database.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readStoredPlan, readSubmissions, readTide, type StoredPlan, type Submission } from "../ui/betaModel.ts";

export async function loadTide(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.from("beta_state").select("tide").eq("id", true).single();
  if (error) throw new Error(error.message);
  const tide = readTide(data);
  if (tide === null) throw new Error("The server sent a Tide number that makes no sense");
  return tide;
}

/** Only a game master gets this through: for anyone else the database changes no row and this says so. */
export async function setTide(client: SupabaseClient, tide: number): Promise<number> {
  const { data, error } = await client.from("beta_state").update({ tide }).eq("id", true).select("tide");
  if (error) throw new Error(error.message);
  const next = readTide(data?.[0]);
  if (next === null) throw new Error("The Tide did not change: only a game master can move it");
  return next;
}

export async function isAdmin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("is_admin");
  return !error && data === true;
}

/** Calls `onTide` when the number changes, by Realtime (fast) and by polling (the safety net), and again when
 *  the tab comes back to the front. Returns the function that stops all three. */
export function watchTide(client: SupabaseClient, onTide: (tide: number) => void, onError: (message: string) => void, pollMs = 10_000): () => void {
  let stopped = false;
  const check = () => {
    loadTide(client).then((t) => { if (!stopped) onTide(t); }, (e) => { if (!stopped) onError(e instanceof Error ? e.message : String(e)); });
  };
  const timer = setInterval(check, pollMs);
  const visible = () => { if (document.visibilityState === "visible") check(); };
  document.addEventListener("visibilitychange", visible);
  const channel = client.channel("beta-tide")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "beta_state" }, (payload) => {
      const t = readTide(payload.new);
      if (t !== null && !stopped) onTide(t);
    })
    .subscribe();
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visible);
    void client.removeChannel(channel);
  };
}

export async function loadPlan(client: SupabaseClient, userId: string, tide: number): Promise<StoredPlan | null> {
  const { data, error } = await client.from("beta_plans").select("plan").eq("user_id", userId).eq("tide", tide).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? readStoredPlan((data as { plan: unknown }).plan) : null;
}

/** Saves this player's plan for a Tide. The database refuses any Tide but the open one. */
export async function savePlan(client: SupabaseClient, userId: string, tide: number, plan: StoredPlan): Promise<void> {
  const { error } = await client.from("beta_plans").upsert({ user_id: userId, tide, plan }, { onConflict: "user_id,tide" });
  if (error) throw new Error(error.message);
}

export async function loadSubmissions(client: SupabaseClient): Promise<Submission[]> {
  const { data, error } = await client.rpc("beta_submissions");
  if (error) throw new Error(error.message);
  return readSubmissions(data);
}

export interface TideMove { at: string; from: number; to: number }

export async function loadTideLog(client: SupabaseClient, limit = 8): Promise<TideMove[]> {
  const { data, error } = await client.from("beta_tide_log").select("at, from_tide, to_tide").order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ at: String(r.at), from: Number(r.from_tide), to: Number(r.to_tide) }));
}
