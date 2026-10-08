-- ContextPass — Phase 4 security
--
-- Model:
--  • The browser never talks to this database. All reads and writes go
--    through the ContextPass server, which verifies the Privy session,
--    resolves the owner, checks Monad, and scopes every query to that owner.
--  • RLS is enabled on every table regardless, with least-privilege grants:
--      anon           → the public app registry only
--      authenticated  → only its own rows (owner = JWT subject), and may
--                       write only its own context items
--  • Requests and activity are written by the server alone.
--
-- `auth.jwt() ->> 'sub'` is the Privy user id when a client presents a JWT.

alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.context_items enable row level security;
alter table public.permission_requests enable row level security;
alter table public.activity_events enable row level security;

-- The profile behind the current request's JWT, or null.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.privy_user_id = (select auth.jwt() ->> 'sub')
$$;

revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;

-- ── Least privilege ────────────────────────────────────────────

revoke all on public.profiles, public.apps, public.context_items, public.permission_requests, public.activity_events
  from anon, authenticated;

grant select on public.apps to anon, authenticated;
grant select on public.profiles, public.permission_requests, public.activity_events to authenticated;
grant select, insert, update, delete on public.context_items to authenticated;

-- ── Policies ───────────────────────────────────────────────────

create policy "apps are public while active"
  on public.apps for select
  to anon, authenticated
  using (status = 'active');

create policy "owners read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select public.current_profile_id()));

create policy "owners read their own context"
  on public.context_items for select
  to authenticated
  using (owner_id = (select public.current_profile_id()));

create policy "owners add their own context"
  on public.context_items for insert
  to authenticated
  with check (owner_id = (select public.current_profile_id()));

create policy "owners edit their own context"
  on public.context_items for update
  to authenticated
  using (owner_id = (select public.current_profile_id()))
  with check (owner_id = (select public.current_profile_id()));

create policy "owners delete their own context"
  on public.context_items for delete
  to authenticated
  using (owner_id = (select public.current_profile_id()));

create policy "owners read their own requests"
  on public.permission_requests for select
  to authenticated
  using (owner_id = (select public.current_profile_id()));

create policy "owners read their own activity"
  on public.activity_events for select
  to authenticated
  using (owner_id = (select public.current_profile_id()));
