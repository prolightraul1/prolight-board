-- ProLight Season Board - update 16: push notifications.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create extension if not exists pg_net;

-- each phone/computer that turned notifications on
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references public.staff(id) on delete cascade,
  sub jsonb not null,
  device text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists push_own_read on public.push_subs;
drop policy if exists push_own_write on public.push_subs;
drop policy if exists push_own_update on public.push_subs;
drop policy if exists push_own_delete on public.push_subs;
create policy push_own_read on public.push_subs for select to authenticated using (user_id = auth.uid());
create policy push_own_write on public.push_subs for insert to authenticated with check (user_id = auth.uid());
create policy push_own_update on public.push_subs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on public.push_subs for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;

-- what each person wants to hear about
alter table public.staff add column if not exists notify jsonb not null default '{}'::jsonb;
create or replace function public.staff_set_notify(p_notify jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or jsonb_typeof(p_notify) <> 'object' or length(p_notify::text) > 1000 then raise exception 'Bad settings'; end if;
  update public.staff set notify = p_notify where id = auth.uid();
end $$;
revoke all on function public.staff_set_notify(jsonb) from public, anon;
grant execute on function public.staff_set_notify(jsonb) to authenticated;

-- so the same thing never buzzes twice
create table if not exists public.push_log (key text primary key, at timestamptz not null default now());
alter table public.push_log enable row level security;
revoke all on public.push_log from public, anon, authenticated;

-- tell the board's server when something worth a notification happens. It re-reads the record itself.
create or replace function public._push_ping(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(url := 'https://prolight-boardv1.vercel.app/api/notify', body := p, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 5000);
exception when others then null; -- never block a save because of a notification
end $$;

create or replace function public._push_msgs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._push_ping(jsonb_build_object('t', 'msg', 'id', new.id));
  return null;
end $$;
drop trigger if exists push_msgs on public.messages;
create trigger push_msgs after insert on public.messages for each row execute function public._push_msgs();

create or replace function public._push_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text := new.data->>'kind';
begin
  if new.coll = 'log' and tg_op = 'INSERT' and k in ('issue', 'partial', 'timereq') then
    perform public._push_ping(jsonb_build_object('t', 'log', 'id', new.id));
  elsif new.coll = 'log' and tg_op = 'UPDATE' and k = 'timereq' and (new.data->>'status') is distinct from (old.data->>'status') then
    perform public._push_ping(jsonb_build_object('t', 'log', 'id', new.id));
  elsif new.coll = 'jobs' and (tg_op = 'INSERT' or (new.data->>'crew') is distinct from (old.data->>'crew') or (new.data->'visits') is distinct from (old.data->'visits')) then
    perform public._push_ping(jsonb_build_object('t', 'job', 'id', new.id, 'oldCrew', case when tg_op = 'UPDATE' then old.data->>'crew' end,
      'oldVisits', case when tg_op = 'UPDATE' then old.data->'visits' end));
  end if;
  return null;
end $$;
drop trigger if exists push_docs on public.docs;
create trigger push_docs after insert or update on public.docs for each row execute function public._push_docs();
