// POST /functions/v1/admin (section 10.4). The game master's page: read the season, resolve the open
// Tide now, or retry a failed one. Only users listed in `admins` get past the handler.
import { respond } from "../_shared/api/http.ts";
import { adminRequest } from "../_shared/api/handlers.ts";
import { makeDeps, serviceClient, userIdFrom } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async (body) => {
    const db = serviceClient();
    return await adminRequest(makeDeps(db), await userIdFrom(db, req), body);
  })
);
