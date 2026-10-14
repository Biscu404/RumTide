-- pg_cron calls the Tide resolver every 5 minutes (section 15.1 and 15.5). The function decides
-- whether a Tide is due, so this one schedule handles daylight saving and early Tides.
--
-- Before it works, store two secrets in Supabase Vault (Dashboard > Project Settings > Vault, or SQL):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string>', 'cron_secret');
-- and give the Edge Functions the same string:  supabase secrets set CRON_SECRET=<that string>
-- Until both exist the job runs and does nothing.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.call_resolve_tide() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'resolve_tide not called: set the project_url and cron_secret Vault secrets';
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/resolve_tide',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function public.call_resolve_tide() from public, anon, authenticated;

select cron.schedule('resolve-tide', '*/5 * * * *', 'select public.call_resolve_tide()');
