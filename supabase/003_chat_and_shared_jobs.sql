-- ProLight Season Board — update 3: chat + jobs shared by several crews
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- A crew-only login also sees jobs where their crew is one of several crews on a visit.
create or replace function public.job_visible(d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.active and (
      s.all_crews or s.can_edit or
      (s.crew <> '' and (
        coalesce(d->>'crew','') = s.crew or
        (s.crew = 'pl1' and coalesce(d->>'crew','') = 'prolight') or
        exists (select 1 from jsonb_array_elements(coalesce(d->'visits','[]'::jsonb)) v
                where v->>'crew' = s.crew or coalesce(v->'crews','[]'::jsonb) ? s.crew)))));
$$;

-- ---------- Chat ----------
-- Channels: 'ann' (announcements: everyone reads, only office/managers post),
--           'crew:<crew id>' (that crew + office), 'dm:<user id>:<user id>' (just those two people).
create table if not exists public.messages (
  id      uuid primary key default gen_random_uuid(),
  channel text not null,
  body    text not null check (char_length(body) between 1 and 4000),
  by      uuid not null default auth.uid() references public.staff(id) on delete cascade,
  at      timestamptz not null default now()
);
create index if not exists messages_channel_at on public.messages (channel, at desc);
alter table public.messages enable row level security;
alter table public.messages replica identity full;

create or replace function public.chat_can_read(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when ch = 'ann' then true
      when ch like 'crew:%' then s.all_crews or s.can_edit or s.can_manage or s.crew = substr(ch, 6)
      when ch like 'dm:%' then auth.uid()::text = any(string_to_array(substr(ch, 4), ':'))
      else false end
    from public.staff s where s.id = auth.uid() and s.active), false);
$$;

create or replace function public.chat_can_post(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when ch = 'ann' then public.perm('edit') or public.perm('manage') else public.chat_can_read(ch) end;
$$;

drop policy if exists messages_read   on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
create policy messages_read on public.messages for select to authenticated using (public.chat_can_read(channel));
create policy messages_insert on public.messages for insert to authenticated
  with check (by = auth.uid() and public.chat_can_post(channel)
    and (channel not like 'dm:%' or array_length(string_to_array(substr(channel, 4), ':'), 1) = 2));
create policy messages_delete on public.messages for delete to authenticated
  using (by = auth.uid() or public.perm('manage'));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

grant select, insert, delete on public.messages to authenticated;
