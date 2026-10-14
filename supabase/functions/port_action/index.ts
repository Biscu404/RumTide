// POST /functions/v1/port_action  (section 15.4). Body: buy, sell, upgrade, repair or shipwright.
import { respond } from "../_shared/api/http.ts";
import { portAction } from "../_shared/api/handlers.ts";
import { makeDeps, serviceClient, userIdFrom } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async (body) => {
    const db = serviceClient();
    return await portAction(makeDeps(db), await userIdFrom(db, req), body);
  })
);
