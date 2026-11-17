-- The closed beta (D249 to D258). Three small tables and two functions, nothing the game tables depend on:
--   * `beta_state`: ONE row, the shared Tide number. Every signed in player reads it, only an admin changes it.
--   * `beta_tide_log`: every change of that number, for the admin page.
--   * `beta_plans`: each player's saved voyage plan for each Tide, so it survives a refresh.
-- Admins are the rows of `admins` (migration 5), the same game master list as before.

-- Is the caller a game master? Security definer, because clients cannot read `admins` themselves.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------- The shared Tide ----------

create table public.beta_state (
  id         boolean primary key default true check (id),   -- always true: the table can hold one row only
  tide       int not null default 1 check (tide between 1 and 999),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.beta_state (id) values (true);

create table public.beta_tide_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  admin_id  uuid references auth.users (id) on delete set null,
  from_tide int not null,
  to_tide   int not null
);

-- The Tide moves one step at a time (forward or back), and every move is stamped and logged. This runs for
-- admins only in practice, because the policy below refuses everyone else before the trigger is reached.
create function public.beta_state_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tide = old.tide then return old; end if;
  if abs(new.tide - old.tide) <> 1 then
    raise exception 'The Tide moves one step at a time' using errcode = 'RT409';
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  insert into public.beta_tide_log (admin_id, from_tide, to_tide) values ((select auth.uid()), old.tide, new.tide);
  return new;
end;
$$;
revoke execute on function public.beta_state_guard() from public, anon, authenticated;
create trigger beta_state_guard before update on public.beta_state for each row execute function public.beta_state_guard();

alter table public.beta_state    enable row level security;
alter table public.beta_tide_log enable row level security;
revoke all on public.beta_state, public.beta_tide_log from anon, authenticated;
grant select on public.beta_state to authenticated;
grant update (tide) on public.beta_state to authenticated;       -- the only column anyone may change
grant select on public.beta_tide_log to authenticated;
grant all on public.beta_state, public.beta_tide_log to service_role;
grant usage on sequence public.beta_tide_log_id_seq to service_role;

create policy beta_state_read on public.beta_state for select to authenticated using (true);
create policy beta_state_admin_update on public.beta_state for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy beta_tide_log_admin_read on public.beta_tide_log for select to authenticated using (public.is_admin());

-- Players hear about a new Tide at once through Realtime (the client also polls, so this is a speed up, not a need).
alter publication supabase_realtime add table public.beta_state;

-- ---------- Saved plans ----------

create table public.beta_plans (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tide       int not null check (tide between 1 and 999),
  plan       jsonb not null check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 8192),
  updated_at timestamptz not null default now(),
  primary key (user_id, tide)
);

create function public.beta_plans_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.beta_plans_stamp() from public, anon, authenticated;
create trigger beta_plans_stamp before insert or update on public.beta_plans for each row execute function public.beta_plans_stamp();

alter table public.beta_plans enable row level security;
revoke all on public.beta_plans from anon, authenticated;
grant select, insert, update on public.beta_plans to authenticated;
grant all on public.beta_plans to service_role;

-- A player reads and writes only their own plan, and only for the Tide that is open now. An admin can read all.
create policy beta_plans_read on public.beta_plans for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy beta_plans_insert on public.beta_plans for insert to authenticated
  with check (user_id = (select auth.uid()) and tide = (select tide from public.beta_state));
create policy beta_plans_update on public.beta_plans for update to authenticated
  using (user_id = (select auth.uid()) and tide = (select tide from public.beta_state))
  with check (user_id = (select auth.uid()) and tide = (select tide from public.beta_state));

-- The admin page: every account, and whether it has a plan saved for the open Tide.
create function public.beta_submissions()
returns table (user_id uuid, email text, submitted_at timestamptz, style text, steps int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only a game master can see this' using errcode = 'RT403';
  end if;
  return query
    select u.id, u.email::text, p.updated_at, p.plan ->> 'style',
           case when jsonb_typeof(p.plan -> 'steps') = 'array' then jsonb_array_length(p.plan -> 'steps') else 0 end
      from auth.users u
      left join public.beta_plans p on p.user_id = u.id and p.tide = (select tide from public.beta_state)
     order by (p.updated_at is null), u.email;
end;
$$;
revoke execute on function public.beta_submissions() from public, anon, authenticated;
grant execute on function public.beta_submissions() to authenticated, service_role;
