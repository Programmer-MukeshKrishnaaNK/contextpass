-- ContextPass — demo app registry
--
-- Stable identities carried over from Phase 3. Apps are identified by slug
-- (on-chain: keccak256("contextpass.app:<slug>")), never by a wallet address.

insert into public.apps (slug, name, kind, description, developer, monogram, requested_scopes, default_duration, reason)
values
  (
    'study-os', 'StudyOS', 'Study assistant',
    'Plans study sessions around how you learn.',
    'StudyOS Labs', 'St',
    array['study-preferences']::public.context_scope[], '1h',
    'To plan your study sessions around how you like to learn.'
  ),
  (
    'code-pilot', 'CodePilot', 'Coding assistant',
    'Suggests code changes that fit your projects and the way you write code.',
    'Pilot Systems', 'Cp',
    array['projects', 'coding-preferences']::public.context_scope[], '1d',
    'To suggest changes that fit your projects and the way you write code.'
  ),
  (
    'margin', 'Margin', 'Writing assistant',
    'Keeps drafts in your voice.',
    'Margin & Co.', 'Mg',
    array['about', 'communication-preferences']::public.context_scope[], '1d',
    'To keep your drafts in your voice.'
  )
on conflict (slug) do update set
  name = excluded.name,
  kind = excluded.kind,
  description = excluded.description,
  developer = excluded.developer,
  monogram = excluded.monogram,
  requested_scopes = excluded.requested_scopes,
  default_duration = excluded.default_duration,
  reason = excluded.reason;
