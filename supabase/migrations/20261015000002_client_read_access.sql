-- Let signed in players reach the `public` schema at all, so the reads granted in
-- 20261014000003_security.sql can work.
--
-- Table grants and policies already exist for everything the client reads (seasons, captains,
-- public_captains, public_ships, ...). But a project created with "Automatically expose new
-- tables" turned off may also have no USAGE on the schema for the `authenticated` role, and
-- without it every one of those reads fails with "permission denied for schema public".
-- USAGE on a schema opens no table: each table still needs its own grant and row policy.
--
-- Safe to run twice. Nothing is granted to anon.

grant usage on schema public to authenticated;
