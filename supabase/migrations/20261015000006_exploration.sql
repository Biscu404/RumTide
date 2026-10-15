-- Exploration events (docs/DECISIONS.md, "Exploration events").
--
--   * `omens` holds what an exploration event left behind for the Tides to come: a JSON list of
--     'castaway', 'cursedCoin', 'mermaid' and 'cartographer', sorted, with no repeats. The resolver
--     reads it as a Tide opens and writes the new list as that Tide resolves. A captain can read their
--     own (the `captains_own` policy), and `public_captains` still leaves it out.
--
-- Additive: one column with a default, and `private.write_captain` replaced by the same function with
-- the column added. Nothing is dropped.

alter table captains add column omens jsonb not null default '[]'::jsonb;

create or replace function private.write_captain(p_season uuid, x jsonb) returns void
language sql as $$
  insert into captains (
    id, season_id, user_id, ship_name, flag, parting_shot, legend, chest_gold, bounty, shield_until_tide,
    fleet_id, standing_plan, standing_parley, shore_leave_tides, shore_leave_used_tide, fair_winds, omens,
    last_orders_tide, status
  ) values (
    (x->>'id')::uuid, p_season, (x->>'userId')::uuid, x->>'shipName', x->>'flag', x->>'partingShot',
    (x->>'legend')::double precision, (x->>'chestGold')::double precision, (x->>'bounty')::double precision,
    (x->>'shieldUntilTide')::int, (x->>'fleetId')::uuid, x->'standingPlan', x->'standingParley',
    (x->>'shoreLeaveTides')::int, coalesce((x->>'shoreLeaveUsedTide')::int, 0),
    coalesce((x->>'fairWinds')::boolean, false), coalesce(x->'omens', '[]'::jsonb),
    (x->>'lastOrdersTide')::int, x->>'status'
  )
  on conflict (id) do update set
    ship_name = excluded.ship_name, flag = excluded.flag, parting_shot = excluded.parting_shot,
    legend = excluded.legend, chest_gold = excluded.chest_gold, bounty = excluded.bounty,
    shield_until_tide = excluded.shield_until_tide, fleet_id = excluded.fleet_id,
    standing_plan = excluded.standing_plan, standing_parley = excluded.standing_parley,
    shore_leave_tides = excluded.shore_leave_tides, shore_leave_used_tide = excluded.shore_leave_used_tide,
    fair_winds = excluded.fair_winds, omens = excluded.omens, last_orders_tide = excluded.last_orders_tide,
    status = excluded.status;
$$;
