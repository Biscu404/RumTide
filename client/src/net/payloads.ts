import type {
  FleetActionPayload, PortActionPayload, StandingOrdersPayload, SubmitOrdersPayload,
} from "../../../supabase/functions/_shared/api/schemas.ts";

// The bodies the client sends to submit_orders, port_action, fleet_action and standing_orders. They are
// the server's own Zod types, so a change to a schema shows up here as a type error. Type only: no Zod
// code reaches the browser.
export type SubmitPayload = SubmitOrdersPayload;
export type PortPayload = PortActionPayload;
export type FleetPayload = FleetActionPayload;
export type StandingPayload = StandingOrdersPayload;
