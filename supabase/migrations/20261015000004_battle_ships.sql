-- The replay needs each ship's hull when a battle began (section 15.3: a Battle holds "everything the
-- replay needs"). `battles.ships` holds `{ shipId: { hullBefore, maxHull } }` from the engine's own
-- Battle record. It is null on battles saved before this migration, and the client copes with that.
--
-- Additive: one nullable column. `apply_tide_result` is replaced by the same function as in
-- 20261015000003_fleets.sql with `ships` added to the battles insert.

alter table battles add column ships jsonb;

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

  -- Captains who gave notice to leave their fleet are out as the new Tide opens (section 8.1).
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

  insert into battles (season_id, id, tide, node_id, sides, rounds, ships, outcome, winner, loot, bounties_added)
  select v_season, b->>'id', (b->>'tide')::int, b->>'nodeId', b->'sides', b->'rounds', b->'ships', b->>'outcome',
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
