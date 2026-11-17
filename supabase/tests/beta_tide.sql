-- Database rules of the closed beta (migration 20261117000001). Run it against any database that has the migrations:
--   supabase db query --file supabase/tests/beta_tide.sql        (or paste it into the SQL editor)
-- It changes nothing: it plays as a real admin and a real player inside one block and ends by raising
-- 'RT_TEST_OK' on purpose, which rolls everything back. Any other error message is a failed rule.
-- It needs one account in `admins` and one account that is not, which the live project has.

do $$
declare
  admin_id  uuid := (select user_id from public.admins limit 1);
  player_id uuid := (select id from auth.users where id not in (select user_id from public.admins) limit 1);
  start_tide int := (select tide from public.beta_state);
  n int;
  t int;
begin
  if admin_id is null or player_id is null then raise exception 'RT_TEST_SETUP: needs an admin and a non admin account'; end if;

  -- ===== A player =====
  perform set_config('request.jwt.claims', json_build_object('sub', player_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- reads the Tide
  select tide into t from public.beta_state;
  if t is distinct from start_tide then raise exception 'RT_TEST_FAIL: a player could not read the Tide'; end if;

  -- cannot advance it (RLS hides the row from the update, so nothing changes)
  update public.beta_state set tide = start_tide + 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RT_TEST_FAIL: a player advanced the Tide'; end if;
  update public.beta_state set tide = start_tide - 1 where start_tide > 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'RT_TEST_FAIL: a player set the Tide back'; end if;

  -- cannot touch the other columns, insert a second row or delete the row
  begin
    update public.beta_state set updated_by = player_id;
    raise exception 'RT_TEST_FAIL: a player could write updated_by';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.beta_state (id, tide) values (false, 5);
    raise exception 'RT_TEST_FAIL: a player inserted a Tide row';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.beta_state;
    raise exception 'RT_TEST_FAIL: a player deleted the Tide row';
  exception when insufficient_privilege then null; end;

  -- cannot read the log or the admin list, and is not an admin
  select count(*) into n from public.beta_tide_log;
  if n <> 0 then raise exception 'RT_TEST_FAIL: a player read the Tide log'; end if;
  if public.is_admin() then raise exception 'RT_TEST_FAIL: a player is an admin'; end if;
  begin
    perform * from public.beta_submissions();
    raise exception 'RT_TEST_FAIL: a player read the submissions';
  exception when sqlstate 'RT403' then null; end;

  -- saves a plan for the open Tide, and again (an update), but not for another Tide or for someone else
  insert into public.beta_plans (tide, plan) values (start_tide, '{"style":"gunline","steps":[]}');
  update public.beta_plans set plan = '{"style":"rammer","steps":[]}' where tide = start_tide;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RT_TEST_FAIL: a player could not update their own plan'; end if;
  begin
    insert into public.beta_plans (tide, plan) values (start_tide + 1, '{}');
    raise exception 'RT_TEST_FAIL: a player saved a plan for a Tide that is not open';
  exception when sqlstate '42501' then null; end;
  begin
    insert into public.beta_plans (user_id, tide, plan) values (admin_id, start_tide, '{}');
    raise exception 'RT_TEST_FAIL: a player saved a plan for someone else';
  exception when sqlstate '42501' then null; end;

  reset role;

  -- ===== An admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if not public.is_admin() then raise exception 'RT_TEST_FAIL: the admin is not an admin'; end if;

  update public.beta_state set tide = start_tide + 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'RT_TEST_FAIL: the admin could not advance the Tide'; end if;
  select tide into t from public.beta_state;
  if t <> start_tide + 1 then raise exception 'RT_TEST_FAIL: the Tide did not move'; end if;

  begin
    update public.beta_state set tide = start_tide + 5;
    raise exception 'RT_TEST_FAIL: the Tide jumped by more than one';
  exception when sqlstate 'RT409' then null; end;

  update public.beta_state set tide = start_tide;      -- back by one, the mistake button
  select tide into t from public.beta_state;
  if t <> start_tide then raise exception 'RT_TEST_FAIL: the Tide did not go back'; end if;

  select count(*) into n from public.beta_tide_log;
  if n < 2 then raise exception 'RT_TEST_FAIL: the Tide log is missing moves'; end if;

  -- sees the player's plan in the submissions list
  select count(*) into n from public.beta_submissions() where user_id = player_id and submitted_at is not null;
  if n <> 1 then raise exception 'RT_TEST_FAIL: the admin list does not show the saved plan'; end if;

  reset role;
  raise exception 'RT_TEST_OK';
end;
$$;
