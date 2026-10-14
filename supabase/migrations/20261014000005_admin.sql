-- The admin page (section 10.4, day 7). Three changes:
--   * `admins`: the game masters. Nothing in the app adds a row; you add yourself once in the SQL editor.
--   * `admin_log`: every admin action, so nobody suspects favouritism (section 10.4).
--   * `claim_tide` takes the status it claims from, so an admin can retry a failed Tide while the
--     cron keeps claiming only open ones.

create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table admin_log (
  id        bigint generated always as identity primary key,
  season_id uuid not null references seasons (id) on delete cascade,
  at        timestamptz not null,
  admin_id  uuid references auth.users (id) on delete set null,
  action    text not null,
  tide      int,
  outcome   text not null,
  detail    text
);
create index admin_log_season on admin_log (season_id, id);

-- Only the service role (the Edge Functions) reads or writes these. Clients get nothing.
alter table admins    enable row level security;
alter table admin_log enable row level security;
revoke all on admins, admin_log from anon, authenticated;
grant all on admins, admin_log to service_role;
grant usage on sequence admin_log_id_seq to service_role;

drop function public.claim_tide(uuid, int);

create function public.claim_tide(p_season uuid, p_tide int, p_from text default 'open') returns boolean
language plpgsql as $$
begin
  if p_from not in ('open', 'failed') then
    raise exception 'claim_tide can only claim an open or failed Tide' using errcode = 'RT409';
  end if;
  update tides set status = 'resolving'
   where season_id = p_season and number = p_tide and status = p_from;
  return found;
end;
$$;

revoke execute on function public.claim_tide(uuid, int, text) from public, anon, authenticated;
grant execute on function public.claim_tide(uuid, int, text) to service_role;
