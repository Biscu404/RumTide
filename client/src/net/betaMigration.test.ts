// The Tide table rule, checked on every `npm run check` without a database (D253). The real behaviour is played as a
// player and as an admin by supabase/tests/beta_tide.sql against a live database; these tests make sure the pieces
// that rule stands on cannot be edited away without a red test.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../../supabase/migrations/20261117000001_beta_tide.sql", import.meta.url), "utf8");
const dbTest = readFileSync(new URL("../../../supabase/tests/beta_tide.sql", import.meta.url), "utf8");

/** The one statement that starts with `needle`: a function runs to its closing `$$;`, anything else to its `;`. */
function statement(needle: string): string {
  const at = sql.indexOf(needle);
  if (at < 0) throw new Error(`no statement starts with ${needle}`);
  const end = needle.startsWith("create function") ? sql.indexOf("\n$$;", at) : sql.indexOf(";", at);
  return sql.slice(at, end);
}

describe("the Tide table", () => {
  it("has row level security on, for the Tide, its log and the plans", () => {
    for (const table of ["beta_state", "beta_tide_log", "beta_plans"]) expect(sql).toContain(`alter table public.${table}`.replace(/\s+/g, " "));
    expect(sql).toMatch(/alter table public\.beta_state\s+enable row level security/);
    expect(sql).toMatch(/alter table public\.beta_plans enable row level security/);
  });

  it("can only ever hold one row", () => {
    expect(statement("create table public.beta_state")).toContain("check (id)");
  });

  it("lets a signed in player read the Tide and nobody who is not signed in", () => {
    expect(statement("grant select on public.beta_state to authenticated")).not.toContain("anon");
    expect(statement("create policy beta_state_read")).toMatch(/for select to authenticated/);
    expect(sql).toMatch(/revoke all on public\.beta_state, public\.beta_tide_log from anon, authenticated/);
  });

  it("lets only an admin change the Tide", () => {
    const update = statement("create policy beta_state_admin_update");
    expect(update).toMatch(/for update to authenticated/);
    expect(update).toMatch(/using \(public\.is_admin\(\)\)/);
    expect(update).toMatch(/with check \(public\.is_admin\(\)\)/);
    // No other policy on the table may allow an update, insert or delete.
    const policies = sql.split(";").filter((s) => s.includes("create policy") && s.includes("on public.beta_state"));
    expect(policies.filter((p) => !/for select/.test(p)).map((p) => /create policy (\w+)/.exec(p)?.[1])).toEqual(["beta_state_admin_update"]);
  });

  it("gives a player no write privilege on the Tide table beyond the one column an admin policy guards", () => {
    expect(sql).toContain("grant update (tide) on public.beta_state to authenticated");
    expect(sql).not.toMatch(/grant [^;]*(insert|delete|all)[^;]* on public\.beta_state to authenticated/);
  });

  it("moves the Tide one step at a time and logs each move", () => {
    const guard = statement("create function public.beta_state_guard");
    expect(guard).toContain("abs(new.tide - old.tide) <> 1");
    expect(guard).toContain("insert into public.beta_tide_log");
    expect(sql).toMatch(/create trigger beta_state_guard before update on public\.beta_state/);
  });

  it("decides who is an admin from the admins table, which clients cannot read", () => {
    expect(statement("create function public.is_admin")).toContain("from public.admins");
    expect(sql).not.toMatch(/grant [^;]* on public\.admins/);
  });
});

describe("saved plans", () => {
  it("are read and written only by their owner, for the open Tide", () => {
    for (const name of ["beta_plans_insert", "beta_plans_update"]) {
      const policy = statement(`create policy ${name}`);
      expect(policy).toContain("user_id = (select auth.uid())");
      expect(policy).toContain("tide = (select tide from public.beta_state)");
    }
    expect(statement("create policy beta_plans_read")).toContain("or public.is_admin()");
  });

  it("cannot be deleted by a player", () => {
    expect(statement("grant select, insert, update on public.beta_plans to authenticated")).not.toContain("delete");
  });

  it("are small", () => {
    expect(statement("create table public.beta_plans")).toContain("pg_column_size(plan) < 8192");
  });

  it("are listed to admins only", () => {
    expect(statement("create function public.beta_submissions")).toContain("if not public.is_admin()");
  });
});

describe("the database test", () => {
  it("plays a player who cannot advance the Tide and an admin who can", () => {
    expect(dbTest).toContain("a player advanced the Tide");
    expect(dbTest).toContain("the admin could not advance the Tide");
    expect(dbTest).toContain("RT_TEST_OK");
  });
});
