// POST /functions/v1/standing_orders  (section 12.4). Body: { plan: [m, m, m], parley }.
import { respond } from "../_shared/api/http.ts";
import { standingOrders } from "../_shared/api/handlers.ts";
import { makeDeps, serviceClient, userIdFrom } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async (body) => {
    const db = serviceClient();
    return await standingOrders(makeDeps(db), await userIdFrom(db, req), body);
  })
);
