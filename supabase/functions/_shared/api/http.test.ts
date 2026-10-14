import { describe, expect, it, vi } from "vitest";
import { respond } from "./http.ts";
import { ApiError } from "./store.ts";

const post = (body: string) => new Request("https://x.test/f", { method: "POST", body });

describe("respond", () => {
  it("answers the browser's preflight request", async () => {
    const res = await respond(new Request("https://x.test/f", { method: "OPTIONS" }), async () => ({}));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("accepts POST only", async () => {
    expect((await respond(new Request("https://x.test/f"), async () => ({}))).status).toBe(405);
  });

  it("passes the JSON body to the handler and returns its result", async () => {
    const res = await respond(post('{"a":1}'), async (body) => ({ got: body }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: { a: 1 } });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("rejects a body that is not JSON with a 400", async () => {
    const res = await respond(post("not json"), async () => ({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON/);
  });

  it("sends an ApiError's status and message", async () => {
    const res = await respond(post("{}"), async () => { throw new ApiError("Your ship changed.", 409); });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Your ship changed." });
  });

  it("hides the details of a bug", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await respond(post("{}"), async () => { throw new Error("password=hunter2 at db.internal"); });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
