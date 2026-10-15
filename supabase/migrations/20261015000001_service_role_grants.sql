-- Table privileges for the service role (the Edge Functions).
--
-- This project was created with "Automatically expose new tables" turned off, so the service role
-- got no privileges on the tables in `public`, and every Edge Function failed with
-- "permission denied for table seasons". This migration records the fix that was first made by
-- hand in the SQL editor, so a fresh project built from these migrations works the same way.
--
-- Safe to run twice: a grant that already exists changes nothing.
-- Nothing is granted to anon or authenticated here, on purpose. Clients get reads only through
-- the grants and policies in 20261014000003_security.sql.

grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Tables, sequences and functions created later in `public` (by the postgres role, which is who
-- runs migrations) get the same privileges without another grant.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
