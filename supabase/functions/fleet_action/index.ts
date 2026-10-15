// POST /functions/v1/fleet_action  (section 15.4). Body: create, invite, accept, decline or leave.
import { respond } from "../_shared/api/http.ts";
import { fleetAction } from "../_shared/api/handlers.ts";
import { makeDeps, serviceClient, userIdFrom } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async (body) => {
    const db = serviceClient();
    return await fleetAction(makeDeps(db), await userIdFrom(db, req), body);
  })
);
