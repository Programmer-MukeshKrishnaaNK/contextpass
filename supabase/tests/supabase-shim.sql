-- Test-only: the slice of Supabase the migrations rely on, so they can run
-- against a plain Postgres (PGlite) for isolation tests. Never applied to a
-- real Supabase project — it already provides all of this.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase exposes the request JWT claims as a setting; tests set it per role switch.
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on function auth.jwt() to anon, authenticated, service_role;

-- Mirrors Supabase's default: new public tables are fully granted, RLS decides.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
