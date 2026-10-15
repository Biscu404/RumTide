-- Fleets (section 8.1 and 15.4). Additive: nothing is dropped or renamed.
--
--   * `fleet_invites`: an open invitation to join a fleet.
--   * `seasons.fleet_rev`: bumped by every change to a season's fleets. `apply_fleet_change` is a
--     compare and swap on it, so two changes worked out from the same reading cannot both land.
--   * `fleet_members` gets "one fleet per captain" as a unique index.
--   * `apply_fleet_change`: the one writer of fleets, called by the fleet_action Edge Function.
--   * `apply_tide_result` now also takes captains out of their fleet as the new Tide opens when they
--     gave notice to leave (`leaving_at_tide`), and drops fleets nobody is left in.
--
-- Fleets, their members and the leaving date are public to any signed in player (see
-- 20261014000003_security.sql), which is how "leaving is announced" shows in the app.

alter table seasons add column fleet_rev int not null default 0;

create unique index fleet_members_one_fleet on fleet_members (captain_id);
create unique index fleets_name_per_season on fleets (season_id, lower(name));

create table fleet_invites (
  season_id   uuid not null references seasons (id) on delete cascade,
  fleet_id    uuid not null references fleets (id) on delete cascade,
  captain_id  uuid not null references captains (id) on delete cascade,
  invited_by  uuid not null references captains (id) on delete cascade,
  tide        int  not null,
  primary key (fleet_id, captain_id)
);
create index fleet_invites_captain on fleet_invites (captain_id);

alter table fleet_invites enable row level security;
revoke all on fleet_invites from anon, authenticated;
grant all on fleet_invites to service_role;

-- An invitation is read by the captain it is for and by the fleet that sent it.
grant select on fleet_invites to authenticated;
create policy fleet_invites_read on fleet_invites for select to authenticated using (
  captain_id in (select rls.my_captain_ids())
  or invited_by in (select rls.fleet_mate_ids())
);

-- ---- apply_fleet_change ----
-- p_args: { seasonId, tide, expectedRev, book: { fleets, members, invites } }, the engine's own JSON.
-- The book is the season's whole fleet state as it should be after the change.

create function public.apply_fleet_change(p_args jsonb) returns void
language plpgsql as $$
declare
  v_season uuid := (p_args->>'seasonId')::uuid;
  b jsonb := p_args->'book';
begin
  -- Like orders and port actions: only while the Tide is open, and never half way through resolving.
  perform 1 from tides
   where season_id = v_season and number = (p_args->>'tide')::int and status = 'open' for share;
  if not found then
    raise exception 'That Tide is not open' using errcode = 'RT409';
  end if;

  -- Compare and swap on the revision. The update also makes two changes in one season take turns.
  update seasons set fleet_rev = fleet_rev + 1
   where id = v_season and fleet_rev = (p_args->>'expectedRev')::int;
  if not found then
    raise exception 'The fleets changed. Please try again.' using errcode = 'RT409';
  end if;

  insert into fleets (id, season_id, name, flag, colour, created_tide)
  select (f->>'id')::uuid, v_season, f->>'name', f->>'flag', f->>'colour', (f->>'createdTide')::int
    from jsonb_array_elements(b->'fleets') f
  on conflict (id) do update set name = excluded.name, flag = excluded.flag, colour = excluded.colour
   where fleets.season_id = v_season;

  delete from fleet_members fm using fleets f
   where fm.fleet_id = f.id and f.season_id = v_season
     and not exists (
       select 1 from jsonb_array_elements(b->'members') m
        where (m->>'fleetId')::uuid = fm.fleet_id and (m->>'captainId')::uuid = fm.captain_id
     );

  insert into fleet_members (fleet_id, captain_id, joined_tide, leaving_at_tide)
  select (m->>'fleetId')::uuid, (m->>'captainId')::uuid, (m->>'joinedTide')::int, (m->>'leavingAtTide')::int
    from jsonb_array_elements(b->'members') m
  on conflict (fleet_id, captain_id) do update set leaving_at_tide = excluded.leaving_at_tide;

  -- Each captain's fleet follows from the members. A captain whose fleet changed gets a new version,
  -- so a port action worked out before the change cannot write the old fleet back.
  update captains c
     set fleet_id = (select fm.fleet_id from fleet_members fm where fm.captain_id = c.id),
         version = c.version + 1
   where c.season_id = v_season
     and c.fleet_id is distinct from (select fm.fleet_id from fleet_members fm where fm.captain_id = c.id);

  delete from fleets f
   where f.season_id = v_season
     and not exists (select 1 from jsonb_array_elements(b->'fleets') x where (x->>'id')::uuid = f.id);

  delete from fleet_invites where season_id = v_season;
  insert into fleet_invites (season_id, fleet_id, captain_id, invited_by, tide)
  select v_season, (i->>'fleetId')::uuid, (i->>'captainId')::uuid, (i->>'invitedBy')::uuid, (i->>'tide')::int
    from jsonb_array_elements(b->'invites') i;
end;
$$;

revoke execute on function public.apply_fleet_change(jsonb) from public, anon, authenticated;
grant execute on function public.apply_fleet_change(jsonb) to service_role;

-- ---- apply_tide_result, with fleet departures ----
-- The same function as in 20261014000002_functions.sql plus one block, marked below.

create or replace function public.apply_tide_result(p_args jsonb) returns void
language plpgsql as $$
declare
  v_season uuid := (p_args->>'seasonId')::uuid;
  r jsonb := p_args->'result';
  v_tide int := (r->>'tide')::int;
  v_next jsonb := p_args->'next';
begin
  update tides set status = 'resolved', resolved_at = (p_args->>'resolvedAt')::timestamptz, gazette = r->'gazette'
   where season_id = v_season and number = v_tide and status = 'resolving';
  if not found then
    raise exception 'That Tide is not being resolved' using errcode = 'RT409';
  end if;

  -- The Tide's NPCs as they ended, then the new Tide's captains, ships, market and NPCs.
  update npcs n set status = x->>'status', node_id = x->>'nodeId'
    from jsonb_array_elements(r->'npcs') x
   where n.season_id = v_season and n.id = x->>'id';
  perform private.write_snapshot(v_season, r->'next');

  -- NEW: captains who gave notice to leave their fleet are out as the new Tide opens (section 8.1).
  -- They were still fleet mates while this Tide resolved. The snapshot above carried their old fleet.
  update captains c set fleet_id = null
   where c.season_id = v_season
     and c.id in (
       select fm.captain_id from fleet_members fm join fleets f on f.id = fm.fleet_id
        where f.season_id = v_season and fm.leaving_at_tide <= v_tide + 1
     );
  delete from fleet_members fm using fleets f
   where fm.fleet_id = f.id and f.season_id = v_season and fm.leaving_at_tide <= v_tide + 1;
  delete from fleets f
   where f.season_id = v_season and not exists (select 1 from fleet_members fm where fm.fleet_id = f.id);
  update seasons set fleet_rev = fleet_rev + 1 where id = v_season;

  update captains set version = version + 1 where season_id = v_season;

  insert into battles (season_id, id, tide, node_id, sides, rounds, outcome, winner, loot, bounties_added)
  select v_season, b->>'id', (b->>'tide')::int, b->>'nodeId', b->'sides', b->'rounds', b->>'outcome',
         (b->>'winner')::int, b->'loot', b->'bountiesAdded'
    from jsonb_array_elements(r->'battles') b;

  insert into log_events (season_id, id, tide, captain_id, visibility, kind, text, data)
  select v_season, e->>'id', (e->>'tide')::int, (e->>'captainId')::uuid, e->>'visibility', e->>'kind', e->>'text', e->'data'
    from jsonb_array_elements(r->'log') e;

  if v_next is not null and jsonb_typeof(v_next) = 'object' then
    insert into tides (season_id, number, status, due_at, seed, boom_port_id)
    values (v_season, v_tide + 1, 'open', (v_next->>'dueAt')::timestamptz, (v_next->>'seed')::bigint,
            r->'next'->>'boomPortId');
    update seasons set current_tide = v_tide + 1 where id = v_season;
  else
    update seasons set status = 'ended' where id = v_season;
  end if;
end;
$$;
