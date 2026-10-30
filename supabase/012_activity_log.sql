-- ProLight Season Board - update 13: activity log. Every change on the board, sign-ins, crashes and slow screens.
-- Only managers can read it. Money changes show only to people with money access.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create table if not exists public.audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  who uuid,
  kind text not null,
  coll text,
  doc_id text,
  info jsonb not null default '{}'::jsonb
);
create index if not exists audit_at on public.audit (at desc);
create index if not exists audit_who on public.audit (who, at desc);
alter table public.audit enable row level security;
revoke all on public.audit from public, anon, authenticated;

-- keep each stored value short
create or replace function public._audit_short(v jsonb) returns jsonb language sql immutable as $$
  select case when v is null then null when length(v::text) > 240 then to_jsonb(left(v::text, 237) || '...') else v end
$$;

create or replace function public._audit_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op <> 'INSERT' then old.data end; n jsonb := case when tg_op <> 'DELETE' then new.data end;
  k text; ch text[] := '{}'; b jsonb := '{}'; a jsonb := '{}'; src jsonb := coalesce(n, o); ref jsonb;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(coalesce(o,'{}') || coalesce(n,'{}')) loop
      if (o->k) is distinct from (n->k) and k not in ('updatedAt') then
        ch := ch || k; b := b || jsonb_build_object(k, public._audit_short(o->k)); a := a || jsonb_build_object(k, public._audit_short(n->k));
      end if;
    end loop;
    if array_length(ch, 1) is null then return null; end if;
  elsif tg_op = 'INSERT' then
    for k in select jsonb_object_keys(coalesce(n,'{}')) loop a := a || jsonb_build_object(k, public._audit_short(n->k)); end loop;
  end if;
  ref := jsonb_strip_nulls(jsonb_build_object('jobId', src->>'jobId', 'clientId', src->>'clientId', 'kind', src->>'kind', 'name', src->>'name', 'by', src->>'by', 'visitId', src->>'visitId'));
  insert into public.audit (who, kind, coll, doc_id, info)
  values (auth.uid(), lower(tg_op), coalesce(new.coll, old.coll), coalesce(new.id, old.id),
          jsonb_build_object('fields', to_jsonb(ch), 'before', b, 'after', a, 'ref', ref));
  return null;
end $$;
drop trigger if exists audit_docs on public.docs;
create trigger audit_docs after insert or update or delete on public.docs for each row execute function public._audit_docs();

create or replace function public._audit_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end; n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  k text; ch text[] := '{}'; b jsonb := '{}'; a jsonb := '{}';
begin
  for k in select jsonb_object_keys(coalesce(o,'{}') || coalesce(n,'{}')) loop
    if (o->k) is distinct from (n->k) then ch := ch || k; b := b || jsonb_build_object(k, public._audit_short(o->k)); a := a || jsonb_build_object(k, public._audit_short(n->k)); end if;
  end loop;
  if tg_op = 'UPDATE' and array_length(ch, 1) is null then return null; end if;
  insert into public.audit (who, kind, coll, doc_id, info)
  values (auth.uid(), lower(tg_op), 'staff', coalesce(new.id, old.id)::text,
          jsonb_build_object('fields', to_jsonb(ch), 'before', b, 'after', a, 'ref', jsonb_build_object('name', coalesce(n->>'name', o->>'name'))));
  return null;
end $$;
drop trigger if exists audit_staff on public.staff;
create trigger audit_staff after insert or update or delete on public.staff for each row execute function public._audit_staff();

-- chat: who sent or deleted a message, and where. Never the message text.
create or replace function public._audit_msgs() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit (who, kind, coll, doc_id, info)
  values (auth.uid(), lower(tg_op), 'messages', r->>'id', jsonb_build_object('ref', jsonb_strip_nulls(jsonb_build_object('channel', coalesce(r->>'channel', r->>'ch', r->>'room')))));
  return null;
end $$;
drop trigger if exists audit_msgs on public.messages;
create trigger audit_msgs after insert or delete on public.messages for each row execute function public._audit_msgs();

-- things the app reports: sign-ins, crashes, slow screens, load times, failed saves
create or replace function public.log_events(p_events jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if auth.uid() is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  if (select count(*) from public.audit where who = auth.uid() and kind = 'event' and at > now() - interval '10 minutes') > 120 then return; end if;
  for e in select * from jsonb_array_elements(p_events) limit 25 loop
    if length(e::text) <= 2500 and (e->>'type') ~ '^[a-z-]{2,20}$' then
      insert into public.audit (who, kind, coll, doc_id, info) values (auth.uid(), 'event', null, e->>'type', e);
    end if;
  end loop;
end $$;
revoke all on function public.log_events(jsonb) from public, anon;
grant execute on function public.log_events(jsonb) to authenticated;

create or replace function public.audit_list(p_before timestamptz default null, p_filter text default 'all', p_who uuid default null, p_limit int default 150)
returns table (id bigint, at timestamptz, who uuid, kind text, coll text, doc_id text, info jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can see the activity log'; end if;
  return query select a.id, a.at, a.who, a.kind, a.coll, a.doc_id, a.info from public.audit a
   where (p_before is null or a.at < p_before)
     and (p_who is null or a.who = p_who)
     and (a.coll is distinct from 'fin' or public.perm('money'))
     and (p_filter = 'all'
       or (p_filter = 'changes' and a.kind <> 'event')
       or (p_filter = 'problems' and a.kind = 'event' and a.doc_id in ('crash','lag','slow-load','save-failed'))
       or (p_filter = 'signins' and a.kind = 'event' and a.doc_id in ('signin','signout')))
   order by a.at desc, a.id desc limit least(greatest(coalesce(p_limit,150),1),500);
end $$;
revoke all on function public.audit_list(timestamptz, text, uuid, int) from public, anon;
grant execute on function public.audit_list(timestamptz, text, uuid, int) to authenticated;

create or replace function public.audit_health() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can see this'; end if;
  delete from public.audit where at < now() - interval '400 days';
  return jsonb_build_object(
    'crashes', (select count(*) from public.audit where kind='event' and doc_id='crash' and at > now() - interval '7 days'),
    'lag', (select count(*) from public.audit where kind='event' and doc_id='lag' and at > now() - interval '7 days'),
    'failed', (select count(*) from public.audit where kind='event' and doc_id='save-failed' and at > now() - interval '7 days'),
    'loadMs', (select round(avg((info->>'ms')::numeric)) from public.audit where kind='event' and doc_id in ('load','slow-load') and at > now() - interval '7 days' and (info->>'ms') ~ '^[0-9.]+$'),
    'loads', (select count(*) from public.audit where kind='event' and doc_id in ('load','slow-load') and at > now() - interval '7 days'),
    'changes', (select count(*) from public.audit where kind <> 'event' and at > now() - interval '7 days'),
    'wrongPins', (select count(*) from public.pin_attempts where at > now() - interval '1 day'));
end $$;
revoke all on function public.audit_health() from public, anon;
grant execute on function public.audit_health() to authenticated;
