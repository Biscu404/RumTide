# Supabase setup

The database and the Edge Functions of Rumtide. The rules live in `functions/_shared/engine`, the
logic of each function in `functions/_shared/api`. See `docs/DECISIONS.md` (Day 6) for the choices.

## First time

1. Install the Supabase CLI and Docker, then from the repo root:
   ```bash
   supabase start
   supabase db reset
   ```
   `db reset` runs everything in `migrations/`. The cron migration only warns locally until the Vault secrets below exist.
2. Serve the functions locally with your own secrets in `supabase/.env` (never committed):
   ```bash
   supabase functions serve --env-file supabase/.env
   ```
   `supabase/.env` holds `CRON_SECRET`, `DISCORD_WEBHOOK_URL` (optional) and `SITE_URL` (optional). The Supabase URL and service role key are provided to functions automatically.

## Deploying

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy submit_orders port_action fleet_action resolve_tide admin
supabase secrets set CRON_SECRET=<long random string> DISCORD_WEBHOOK_URL=<webhook> SITE_URL=<game url>
```

Then store the same two values in Vault so pg_cron can call `resolve_tide` every 5 minutes (SQL editor):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<the same CRON_SECRET>', 'cron_secret');
```

## The game master

Make yourself an admin once, after you have signed up in the app (SQL editor, replace the email):

```sql
insert into admins (user_id) select id from auth.users where email = 'you@example.com';
```

Then the game header has a Game master button. From there you can see the running season, resolve the
open Tide now, and retry a Tide that failed. Every resolve or retry is written to `admin_log` and shown
on the page. The admin function refuses everyone else with a 403.

## Starting a season

There is no admin page button for this yet. A season is started by calling `startNewSeason`
(`functions/_shared/api/handlers.ts`) with the captains' user ids.
