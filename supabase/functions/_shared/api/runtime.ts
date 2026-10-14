// Wires the handlers to the real world inside an Edge Function: the Supabase client, the map, the
// clock, a random seed source and the Discord webhook. The only file besides the function entry
// points that knows it is running on Deno.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import brineJson from "../maps/brine.json" with { type: "json" };
import { loadMap, type GameMap } from "../engine/map.ts";
import { postToDiscord } from "./discord.ts";
import type { Deps } from "./handlers.ts";
import { ApiError } from "./store.ts";
import { SupabaseStore } from "./supabase_store.ts";

declare const Deno: { env: { get(name: string): string | undefined } };

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const maps: Record<string, GameMap> = {};
const brine = loadMap(brineJson);
maps[brine.id] = brine;

/** The service role client. It bypasses row level security, which is why only Edge Functions hold it. */
export const serviceClient = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export function makeDeps(db: SupabaseClient): Deps {
  const webhook = Deno.env.get("DISCORD_WEBHOOK_URL");
  return {
    store: new SupabaseStore(db),
    getMap: (id) => {
      const map = maps[id];
      if (!map) throw new Error(`Unknown map ${id}`);
      return map;
    },
    now: () => new Date(),
    newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0]!,
    notify: webhook ? (text) => postToDiscord(webhook, text) : undefined,
    siteUrl: Deno.env.get("SITE_URL"),
  };
}

/** Who is calling: the user behind the request's bearer token. */
export async function userIdFrom(db: SupabaseClient, req: Request): Promise<string> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new ApiError("Please sign in", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError("Please sign in again", 401);
  return data.user.id;
}

/** Does this request carry the pg_cron secret? Compared in constant time. */
export function isCron(req: Request): boolean {
  const expected = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret");
  if (!expected || !given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
