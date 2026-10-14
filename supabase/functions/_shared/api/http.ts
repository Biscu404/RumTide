// The HTTP shell around a handler: CORS, POST and JSON only, and errors turned into answers a
// client can read. Standard Request and Response only, so it needs nothing from Deno.

import { ApiError } from "./store.ts";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

/**
 * Run `run` with the request's JSON body. An ApiError becomes its status and message; anything else
 * is a bug, so it is logged and the player sees a plain 500 and no internals.
 */
export async function respond(req: Request, run: (body: unknown) => Promise<unknown>): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError("The request body must be JSON");
    }
    return json(await run(body));
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "Something went wrong on the server" }, 500);
  }
}
