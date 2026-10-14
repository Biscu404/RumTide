// POST /functions/v1/submit_orders  (section 15.4). Body: the captain's orders for the open Tide.
import { respond } from "../_shared/api/http.ts";
import { submitOrders } from "../_shared/api/handlers.ts";
import { makeDeps, serviceClient, userIdFrom } from "../_shared/api/runtime.ts";

Deno.serve((req) =>
  respond(req, async (body) => {
    const db = serviceClient();
    return await submitOrders(makeDeps(db), await userIdFrom(db, req), body);
  })
);
