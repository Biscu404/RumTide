// POST /functions/v1/resolve_tide  (section 15.5). Called by pg_cron every 5 minutes with the
// x-cron-secret header. Resolves the open Tide if it is due or everyone is Ready, and posts the
// Gazette to Discord. The admin page forces a Tide through the `admin` function instead.
import { ApiError } from "../_shared/api/store.ts";
import { respond } from "../_shared/api/http.ts";
import { resolveDueTide } from "../_shared/api/handlers.ts";
import { isCron, makeDeps, serviceClient } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async () => {
    if (!isCron(req)) throw new ApiError("Not allowed", 403);
    return await resolveDueTide(makeDeps(serviceClient()));
  })
);
