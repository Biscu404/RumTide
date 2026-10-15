import type { PortActionPayload, SubmitOrdersPayload } from "../../../supabase/functions/_shared/api/schemas.ts";

// The bodies the client sends to submit_orders and port_action. They are the server's own Zod types,
// so a change to a schema shows up here as a type error. Type only: no Zod code reaches the browser.
export type SubmitPayload = SubmitOrdersPayload;
export type PortPayload = PortActionPayload;
