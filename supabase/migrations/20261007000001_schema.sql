-- ContextPass — Phase 4 schema
--
-- Off-chain data layer. Authorization lives on Monad; this database holds
-- context, app metadata, request records and the audit ledger.
--
-- Nothing here is on-chain. Nothing on-chain is stored here except public
-- references (permission ids, transaction hashes) for the audit trail.

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ── Shared ──────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The context scopes ContextPass knows. One context item belongs to exactly one.
create domain public.context_scope as text
  check (value in ('about', 'study-preferences', 'coding-preferences', 'projects', 'communication-preferences'));

-- ── Profiles: one per Privy identity ───────────────────────────

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  -- Privy user id (DID). Set only by the server, from a verified access token.
  privy_user_id text not null unique,
  -- The owner's embedded wallet, resolved server-side from Privy. Signs permissions on Monad.
  wallet_address text check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Apps: the registry of AI apps that may ask ─────────────────

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  -- Stable identity. On-chain the app is keccak256("contextpass.app:<slug>").
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  kind text not null,
  description text not null,
  developer text not null,
  -- Two-letter mark drawn in a dashed (guest) frame.
  monogram text not null check (char_length(monogram) between 1 and 3),
  -- The scopes this app is allowed to ask for, and why.
  requested_scopes public.context_scope[] not null check (cardinality(requested_scopes) > 0),
  default_duration text not null check (default_duration in ('15m', '1h', '1d', '30d')),
  reason text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger apps_touch before update on public.apps
  for each row execute function public.touch_updated_at();

-- ── Context items: what the owner chooses to keep ──────────────

create table public.context_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  scope public.context_scope not null,
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 4000),
  -- Added by "Add sample context". Shown as sample; never presented as the owner's own words.
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index context_items_owner_scope_idx on public.context_items (owner_id, scope);

create trigger context_items_touch before update on public.context_items
  for each row execute function public.touch_updated_at();

-- ── Permission requests: an app asking, and the owner's decision ─

create table public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid not null references public.apps (id),
  requested_scopes public.context_scope[] not null check (cardinality(requested_scopes) > 0),
  duration text not null check (duration in ('15m', '1h', '1d', '30d')),
  reason text not null,
  --   pending  → waiting on the owner
  --   approved → granted; confirmed on Monad and verified by the server
  --   denied   → refused by the owner; nothing on-chain
  --   failed   → an approval was attempted and not recorded; retryable
  --   expired  → the request itself lapsed before a decision
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'failed', 'expired')),
  requested_at timestamptz not null default now(),
  -- When the request lapses if undecided (not the permission's expiry).
  expires_at timestamptz not null default (now() + interval '7 days'),
  decision_at timestamptz,
  -- Set on approval only, from verified chain data.
  granted_scopes public.context_scope[],
  permission_id text check (permission_id ~ '^0x[0-9a-f]{64}$'),
  permission_expires_at timestamptz,
  transaction_hash text check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  -- Human-readable reason for the last failed attempt.
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_has_chain_record check (
    status <> 'approved' or (permission_id is not null and transaction_hash is not null and granted_scopes is not null)
  ),
  constraint decided_has_time check (status in ('pending', 'failed', 'expired') or decision_at is not null)
);

create index permission_requests_owner_status_idx on public.permission_requests (owner_id, status, requested_at desc);
create index permission_requests_permission_idx on public.permission_requests (permission_id) where permission_id is not null;
-- One open request per owner and app at a time.
create unique index permission_requests_one_open_idx
  on public.permission_requests (owner_id, app_id) where status in ('pending', 'failed');

create trigger permission_requests_touch before update on public.permission_requests
  for each row execute function public.touch_updated_at();

-- ── Activity: the persistent ledger ────────────────────────────

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  app_id uuid references public.apps (id),
  request_id uuid references public.permission_requests (id) on delete set null,
  type text not null check (type in ('requested', 'allowed', 'denied', 'revoked', 'expired', 'accessed', 'blocked', 'failed')),
  scopes public.context_scope[] not null default '{}',
  -- On-chain references, only when a real transaction or permission exists.
  permission_id text check (permission_id ~ '^0x[0-9a-f]{64}$'),
  transaction_hash text check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  detail text,
  -- When it happened (block time for chain events); created_at is when it was recorded.
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index activity_events_owner_time_idx on public.activity_events (owner_id, occurred_at desc);
-- A transaction is recorded once.
create unique index activity_events_once_per_tx_idx
  on public.activity_events (transaction_hash, type) where transaction_hash is not null;
-- An expiry is recorded once per permission and expiry time (a renewed grant can expire again).
create unique index activity_events_once_per_expiry_idx
  on public.activity_events (permission_id, occurred_at) where type = 'expired';
