-- Shore Leave, Fair Winds and standing orders (docs/DECISIONS.md, "Income bonuses").
--
--   * `shore_leave_used_tide` is the Tide in which a stored Tide of Shore Leave was last spent (0 for
--     never). A stored Tide is spent on the first Tide it pays out in, and every income of that Tide
--     gets the bonus, so the engine needs to know whether it was already spent in this Tide.
--   * `fair_winds` is set by the resolver as each Tide opens: the captain is below 70% of the median
--     Legend. It holds for the whole Tide.
--   * `save_standing_orders` is the write path for the standing plan and parley (section 12.4), called
--     by the `standing_orders` Edge Function.
--
-- Additive: two columns with defaults, `private.write_captain` replaced by the same function with the
-- two columns added, and one new function. Nothing is dropped.

alter table captains add column shore_leave_used_tide int     not null default 0;
alter table captains add column fair_winds            boolean not null default false;

create or replace function private.write_captain(p_season uuid, x jsonb) returns void
language sql as $$
  insert into captains (
    id, season_id, user_id, ship_name, flag, parting_shot, legend, chest_gold, bounty, shield_until_tide,
    fleet_id, standing_plan, standing_parley, shore_leave_tides, shore_leave_used_tide, fair_winds,
    last_orders_tide, status
  ) values (
    (x->>'id')::uuid, p_season, (x->>'userId')::uuid, x->>'shipName', x->>'flag', x->>'partingShot',
    (x->>'legend')::double precision, (x->>'chestGold')::double precision, (x->>'bounty')::double precision,
    (x->>'shieldUntilTide')::int, (x->>'fleetId')::uuid, x->'standingPlan', x->'standingParley',
    (x->>'shoreLeaveTides')::int, coalesce((x->>'shoreLeaveUsedTide')::int, 0),
    coalesce((x->>'fairWinds')::boolean, false), (x->>'lastOrdersTide')::int, x->>'status'
  )
  on conflict (id) do update set
    ship_name = excluded.ship_name, flag = excluded.flag, parting_shot = excluded.parting_shot,
    legend = excluded.legend, chest_gold = excluded.chest_gold, bounty = excluded.bounty,
    shield_until_tide = excluded.shield_until_tide, fleet_id = excluded.fleet_id,
    standing_plan = excluded.standing_plan, standing_parley = excluded.standing_parley,
    shore_leave_tides = excluded.shore_leave_tides, shore_leave_used_tide = excluded.shore_leave_used_tide,
    fair_winds = excluded.fair_winds, last_orders_tide = excluded.last_orders_tide,
    status = excluded.status;
$$;

-- p_args: { seasonId, tide, captainId, plan, parley }
-- Locks the open Tide row "for share", like orders and port actions, so a change can never slip in
-- half way through resolving. It bumps `version`: a port action worked out from an older reading
-- then fails with a 409 instead of writing the old standing orders back over the new ones.
create function public.save_standing_orders(p_args jsonb) returns void
language plpgsql as $$
declare
  v_season uuid := (p_args->>'seasonId')::uuid;
begin
  perform 1 from tides
   where season_id = v_season and number = (p_args->>'tide')::int and status = 'open' for share;
  if not found then
    raise exception 'That Tide is not open' using errcode = 'RT409';
  end if;

  update captains
     set standing_plan = p_args->'plan', standing_parley = p_args->'parley', version = version + 1
   where id = (p_args->>'captainId')::uuid and season_id = v_season;
  if not found then
    raise exception 'Unknown captain' using errcode = 'RT409';
  end if;
end;
$$;

revoke execute on function public.save_standing_orders(jsonb) from public, anon, authenticated;
grant execute on function public.save_standing_orders(jsonb) to service_role;
