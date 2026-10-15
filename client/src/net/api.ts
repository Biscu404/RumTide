import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase puts the server's message (for example "The Tide is turning") on the error's response. */
export async function explain(error: unknown): Promise<string> {
  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === "function") {
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // Not JSON, so fall through to the plain message.
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

/** Calls an Edge Function. Server rule breaks come back as `{ ok: false, error }` with a message safe to show. */
export async function callFunction<T>(client: SupabaseClient, name: string, body: unknown): Promise<Reply<T>> {
  const { data, error } = await client.functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) return { ok: false, error: await explain(error) };
  return { ok: true, data: data as T };
}
