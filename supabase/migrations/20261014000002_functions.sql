-- The write side (section 15.4 and 15.5). Edge Functions call these with the service role, passing
-- the engine's own JSON (camelCase) so the TypeScript types and the tables never drift apart in
-- two places. Each function is one transaction: a Tide's result lands whole or not at all.
--
-- Rule breaks raise with SQLSTATE RT409 (conflict). The Edge Functions turn that into HTTP 409.

create schema if not exists private;

-- ---- Row writers, shared by create_season, apply_tide_result and apply_port_change ----

create function private.write_captain(p_season uuid, x jsonb) returns void
language sql as $$
  insert into captains (
    id, season_id, user_id, ship_name, flag, parting_shot, legend, chest_gold, bounty, shield_until_tide,
    fleet_id, standing_plan, standing_parley, shore_leave_tides, last_orders_tide, status
  ) values (
    (x->>'id')::uuid, p_season, (x->>'userId')::uuid, x->>'shipName', x->>'flag', x->>'partingShot',
    (x->>'legend')::double precision, (x->>'chestGold')::double precision, (x->>'bounty')::double precision,
    (x->>'shieldUntilTide')::int, (x->>'fleetId')::uuid, x->'standingPlan', x->'standingParley',
    (x->>'shoreLeaveTides')::int, (x->>'lastOrdersTide')::int, x->>'status'
  )
  on conflict (id) do update set
    ship_name = excluded.ship_name, flag = excluded.flag, parting_shot = excluded.parting_shot,
    legend = excluded.legend, chest_gold = excluded.chest_gold, bounty = excluded.bounty,
    shield_until_tide = excluded.shield_until_tide, fleet_id = excluded.fleet_id,
    standing_plan = excluded.standing_plan, standing_parley = excluded.standing_parley,
    shore_leave_tides = excluded.shore_leave_tides, last_orders_tide = excluded.last_orders_tide,
    status = excluded.status;
$$;

create function private.write_ship(x jsonb) returns void
language sql as $$
  insert into ships (
    captain_id, hull, node_id, docked, hull_points, levels, plunder_gold, cargo, cargo_cost_basis, shipwright_progress
  ) values (
    (x->>'captainId')::uuid, x->>'hull', x->>'nodeId', (x->>'docked')::boolean, (x->>'hullPoints')::double precision,
    x->'levels', (x->>'plunderGold')::double precision, x->'cargo', x->'cargoCostBasis',
    (x->>'shipwrightProgress')::double precision
  )
  on conflict (captain_id) do update set
    hull = excluded.hull, node_id = excluded.node_id, docked = excluded.docked, hull_points = excluded.hull_points,
    levels = excluded.levels, plunder_gold = excluded.plunder_gold, cargo = excluded.cargo,
    cargo_cost_basis = excluded.cargo_cost_basis, shipwright_progress = excluded.shipwright_progress;
$$;

-- A TideSnapshot: captains, ships, the NPCs of the open Tide and the whole market.
create function private.write_snapshot(p_season uuid, p_snapshot jsonb) returns void
language plpgsql as $$
declare
  x jsonb;
begin
  for x in select * from jsonb_array_elements(p_snapshot->'captains') loop
    perform private.write_captain(p_season, x);
  end loop;
  for x in select * from jsonb_array_elements(p_snapshot->'ships') loop
    perform private.write_ship(x);
  end loop;

  insert into market (season_id, port_id, good, drift, sold_this_tide)
  select p_season, m->>'portId', m->>'good', (m->>'drift')::double precision, (m->>'soldThisTide')::int
    from jsonb_array_elements(p_snapshot->'market') m
  on conflict (season_id, port_id, good) do update
    set drift = excluded.drift, sold_this_tide = excluded.sold_this_tide;

  insert into npcs (season_id, id, kind, node_id, pr, habit, cargo_units, spawned_tide, status)
  select p_season, n->>'id', n->>'kind', n->>'nodeId', (n->>'pr')::double precision, n->'habit',
         (n->>'cargoUnits')::int, (n->>'spawnedTide')::int, n->>'status'
    from jsonb_array_elements(p_snapshot->'npcs') n
  on conflict (season_id, id) do update
    set node_id = excluded.node_id, status = excluded.status;
end;
$$;

-- ---- create_season ----

create function public.create_season(p_args jsonb) returns void
language plpgsql as $$
declare
  s jsonb := p_args->'season';
  v_season uuid := (s->>'id')::uuid;
  v_snapshot jsonb := p_args->'snapshot';
begin
  -- A new season, or a draft one (made earlier so that fleets could be set up) being started.
  insert into seasons (id, name, status, map_id, timezone, tide_time_local, length_tides, current_tide, settings)
  values (v_season, s->>'name', 'active', s->>'mapId', s->>'timezone', s->>'tideTimeLocal',
          (s->>'lengthTides')::int, (v_snapshot->>'tide')::int, s->'settings')
  on conflict (id) do update set
    name = excluded.name, status = 'active', map_id = excluded.map_id, timezone = excluded.timezone,
    tide_time_local = excluded.tide_time_local, length_tides = excluded.length_tides,
    current_tide = excluded.current_tide, settings = excluded.settings
  where seasons.status = 'draft';
  if not found then
    raise exception 'That season already exists' using errcode = 'RT409';
  end if;
  insert into tides (season_id, number, status, due_at, seed, boom_port_id)
  values (v_season, (v_snapshot->>'tide')::int, 'open', (p_args->>'dueAt')::timestamptz,
          (p_args->>'seed')::bigint, v_snapshot->>'boomPortId');
  perform private.write_snapshot(v_season, v_snapshot);
end;
$$;

-- ---- Orders and port actions ----

-- Both lock the open Tide row "for share". The resolver claims a Tide with an update, which has to
-- wait for these to finish, so an order or a purchase can never slip in half way through resolving.

create function public.save_orders(p_season uuid, p_orders jsonb) returns void
language plpgsql as $$
declare
  o jsonb := p_orders;
begin
  perform 1 from tides
   where season_id = p_season and number = (o->>'tide')::int and status = 'open' for share;
  if not found then
    raise exception 'That Tide is not open' using errcode = 'RT409';
  end if;

  insert into orders (
    season_id, tide, captain_id, course, intent, hunt_filter, escort_captain_id, plan, parley, no_quarter, ready
  ) values (
    p_season, (o->>'tide')::int, (o->>'captainId')::uuid, o->'course', o->>'intent',
    o->'huntFilter', (o->>'escortCaptainId')::uuid, o->'plan', o->'parley', (o->>'noQuarter')::boolean,
    (o->>'ready')::boolean
  )
  on conflict (season_id, tide, captain_id) do update set
    course = excluded.course, intent = excluded.intent, hunt_filter = excluded.hunt_filter,
    escort_captain_id = excluded.escort_captain_id, plan = excluded.plan, parley = excluded.parley,
    no_quarter = excluded.no_quarter, ready = excluded.ready, updated_at = now();
end;
$$;

create function public.apply_port_change(p_args jsonb) returns void
language plpgsql as $$
declare
  v_season uuid := (p_args->>'seasonId')::uuid;
  v_captain uuid := (p_args->'captain'->>'id')::uuid;
  m jsonb := p_args->'market';
  t jsonb := p_args->'transaction';
begin
  perform 1 from tides
   where season_id = v_season and number = (p_args->>'tide')::int and status = 'open' for share;
  if not found then
    raise exception 'That Tide is not open' using errcode = 'RT409';
  end if;

  -- Compare and swap: only the caller who saw the current version may write.
  update captains set version = version + 1
   where id = v_captain and season_id = v_season and version = (p_args->>'expectedVersion')::int;
  if not found then
    raise exception 'Your ship changed. Please try again.' using errcode = 'RT409';
  end if;
  perform private.write_captain(v_season, p_args->'captain');
  perform private.write_ship(p_args->'ship');

  if m is not null and jsonb_typeof(m) = 'object' then
    update market set drift = (m->'after'->>'drift')::double precision,
                      sold_this_tide = (m->'after'->>'soldThisTide')::int
     where season_id = v_season and port_id = m->'before'->>'portId' and good = m->'before'->>'good'
       and drift = (m->'before'->>'drift')::double precision
       and sold_this_tide = (m->'before'->>'soldThisTide')::int;
    if not found then
      raise exception 'The market moved. Please try again.' using errcode = 'RT409';
    end if;
  end if;

  insert into transactions (season_id, captain_id, tide, kind, amount, balance_after, data)
  values (v_season, v_captain, (t->>'tide')::int, t->>'kind', (t->>'amount')::double precision,
          (t->>'balanceAfter')::double precision, t->'data');
end;
$$;

-- ---- Resolving a Tide (section 15.5) ----

-- Step 2: a single update from open to resolving. Returns true for exactly one caller.
create function public.claim_tide(p_season uuid, p_tide int) returns boolean
language plpgsql as $$
begin
  update tides set status = 'resolving'
   where season_id = p_season and number = p_tide and status = 'open';
  return found;
end;
$$;

create function public.fail_tide(p_season uuid, p_tide int, p_error text) returns void
language sql as $$
  update tides set status = 'failed', error = p_error
   where season_id = p_season and number = p_tide and status = 'resolving';
$$;

-- Step 4: write everything in one transaction and open the next Tide.
-- p_args: { seasonId, resolvedAt, next: { dueAt, seed } | null, result: TideResult }
create function public.apply_tide_result(p_args jsonb) returns void
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

-- Only the service role (the Edge Functions) may call any of these.
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
revoke execute on function
  public.create_season(jsonb), public.save_orders(uuid, jsonb), public.apply_port_change(jsonb),
  public.claim_tide(uuid, int), public.fail_tide(uuid, int, text), public.apply_tide_result(jsonb)
  from public, anon, authenticated;
grant execute on function
  public.create_season(jsonb), public.save_orders(uuid, jsonb), public.apply_port_change(jsonb),
  public.claim_tide(uuid, int), public.fail_tide(uuid, int, text), public.apply_tide_result(jsonb)
  to service_role;
