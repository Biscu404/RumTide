-- Row level security and public views (section 15.4, "Reading data").
--
--   * Clients write nothing. Every table has row level security on and no write policy, and the
--     write privileges are revoked as well, so a mistake in one place does not open a hole.
--   * Another captain's Chest, plunder, cargo and orders are never visible. Clients read other
--     captains through the public_* views, which leave those columns out.
--   * Each captain reads their own private rows. Fleet mates read each other's orders for the open
--     Tide, and orders become public once their Tide has resolved (so replays can show them).
--   * Tide seeds are never visible: knowing the seed would let someone predict a battle's luck.

create schema if not exists rls;
grant usage on schema rls to authenticated;

-- These run as their owner, so a policy on one table can look at another table's rows
-- without that table's own policy getting in the way.

create function rls.my_captain_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select id from public.captains where user_id = (select auth.uid());
$$;

-- Captains in the same fleet as me, me included.
create function rls.fleet_mate_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select them.id
    from public.captains me
    join public.captains them on them.fleet_id = me.fleet_id and them.season_id = me.season_id
   where me.user_id = (select auth.uid()) and me.fleet_id is not null
  union
  select id from public.captains where user_id = (select auth.uid());
$$;

create function rls.tide_is_resolved(p_season uuid, p_tide int) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tides where season_id = p_season and number = p_tide and status = 'resolved'
  );
$$;

grant execute on all functions in schema rls to authenticated;

-- ---- Start from nothing, then grant reads one table at a time ----

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

alter table seasons       enable row level security;
alter table tides         enable row level security;
alter table fleets        enable row level security;
alter table captains      enable row level security;
alter table fleet_members enable row level security;
alter table ships         enable row level security;
alter table orders        enable row level security;
alter table npcs          enable row level security;
alter table market        enable row level security;
alter table battles       enable row level security;
alter table log_events    enable row level security;
alter table transactions  enable row level security;

-- Public to any signed in player.
grant select on seasons, fleets, fleet_members, market, battles to authenticated;
create policy seasons_read       on seasons       for select to authenticated using (true);
create policy fleets_read        on fleets        for select to authenticated using (true);
create policy fleet_members_read on fleet_members for select to authenticated using (true);
create policy market_read        on market        for select to authenticated using (true);
create policy battles_read       on battles       for select to authenticated using (true);

-- My own rows, in full.
grant select on captains, ships, transactions to authenticated;
create policy captains_own on captains for select to authenticated using (user_id = (select auth.uid()));
create policy ships_own    on ships    for select to authenticated using (captain_id in (select rls.my_captain_ids()));
create policy transactions_own on transactions for select to authenticated
  using (captain_id in (select rls.my_captain_ids()));

-- Orders: mine, my fleet mates' (so a fleet can plan together), and everyone's once the Tide has resolved.
grant select on orders to authenticated;
create policy orders_read on orders for select to authenticated using (
  captain_id in (select rls.fleet_mate_ids())
  or rls.tide_is_resolved(season_id, tide)
);

-- The log: public lines to everyone, fleet lines to the fleet, private lines to their captain.
grant select on log_events to authenticated;
create policy log_events_read on log_events for select to authenticated using (
  visibility = 'public'
  or (visibility = 'private' and captain_id in (select rls.my_captain_ids()))
  or (visibility = 'fleet' and captain_id in (select rls.fleet_mate_ids()))
);

-- ---- Public views ----
-- These run with their owner's rights on purpose: that is how they show a column subset of every
-- captain's row. They list only what anyone may know.

create view public_captains with (security_invoker = false) as
  select id, season_id, ship_name, flag, parting_shot, legend, bounty, shield_until_tide, fleet_id, status
    from captains;

-- Where a ship is and how strong it looks. Plunder, cargo and the Hold level stay private.
create view public_ships with (security_invoker = false) as
  select captain_id, hull, node_id, docked, hull_points, levels - 'hold' as levels
    from ships;

-- The Tide without its seed or error text.
create view public_tides with (security_invoker = false) as
  select season_id, number, status, due_at, resolved_at, boom_port_id, gazette
    from tides;

-- Only the Treasure Galleon's habit is printed on the map; other merchants keep theirs to themselves.
create view public_npcs with (security_invoker = false) as
  select season_id, id, kind, node_id, pr, cargo_units, spawned_tide, status,
         case when kind = 'galleon' then habit end as habit
    from npcs;

grant select on public_captains, public_ships, public_tides, public_npcs to authenticated;
