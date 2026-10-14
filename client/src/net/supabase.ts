import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Set these in client/.env.local (see client/.env.example). The anon key is public by design: what a
// player may read is decided by row level security, and the client never writes game tables.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** `null` when the project is not configured, so the app can still show the map without a server. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
