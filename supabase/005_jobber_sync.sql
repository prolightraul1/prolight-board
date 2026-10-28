-- ProLight Season Board — update 5: automatic Jobber sync
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Holds the Jobber connection. Only the server (service role) can read or write it; no login can see it.
create table if not exists public.integrations (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
revoke all on public.integrations from anon, authenticated;
