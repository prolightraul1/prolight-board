-- ProLight Season Board - update 17: sign-in hardening and owner-only admin actions.
-- Run update-16 first. Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
--
-- BEFORE YOU RUN: this makes the account that set up the board (the oldest login) the one "owner".
-- Check it's you first by running just this line:
--     select name, created_at from public.staff order by created_at limit 1;
-- If that isn't you, stop and tell Claude which person should be the owner.
--
-- What changes:
--   1. pin_login no longer tells anyone whether a PIN is real. A wrong PIN gets back a made-up
--      login that looks exactly like a real one (same shape, same answer every time), so the only
--      way to test a PIN is a real sign-in, which Supabase rate-limits and (once turned on) guards
--      with a captcha.
--   2. pin_login counts every attempt (per network address and overall) and stops answering past
--      a limit, with a message containing "many" so the app shows "Too many tries".
--   3. A new owner flag. Adding, changing, deleting people, titles, other people's photos and PINs,
--      the PIN report and "everyone pick a new PIN" are owner-only. Everyone can still change
--      their own PIN and photo.
--   4. Changing your own PIN is limited to 6 tries an hour, so "That PIN is already taken" can't be
--      used to hunt for other people's PINs.
-- Row-level security policies are not touched.

-- ---------- 1. Owner flag ----------
alter table public.staff add column if not exists is_owner boolean not null default false;

do $$
declare v_id uuid; v_name text;
begin
  if not exists (select 1 from public.staff where is_owner) then
    select id, name into v_id, v_name from public.staff where can_manage and active order by created_at limit 1;
    if v_id is null then raise exception 'No active manager to make owner'; end if;
    update public.staff set is_owner = true where id = v_id;
    raise notice 'Owner is now: %', v_name;
  end if;
end $$;

-- At most one owner.
create unique index if not exists staff_one_owner on public.staff ((true)) where is_owner;

-- perm('owner') = the active owner. Everything else is exactly as before.
create or replace function public.perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p
      when 'edit'   then s.can_edit
      when 'money'  then s.can_money
      when 'manage' then s.can_manage
      when 'owner'  then s.is_owner and s.can_manage
      when 'log'    then s.can_log
      when 'any'    then true
      else false end
    from public.staff s where s.id = auth.uid() and s.active), false);
$$;

-- ---------- 2. Attempt log and a private secret ----------
-- Every pin_login call (hit or miss). Nobody but the database can read it.
create table if not exists public.pin_tries (
  k    text not null,
  miss boolean not null default true,
  at   timestamptz not null default now()
);
create index if not exists pin_tries_k_at on public.pin_tries (k, at);
create index if not exists pin_tries_at on public.pin_tries (at);
alter table public.pin_tries enable row level security;
revoke all on public.pin_tries from public, anon, authenticated;

-- The old misses-only table becomes a view over the new log, so the health card's
-- "wrong PINs" count (audit_health) keeps working unchanged.
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'pin_attempts') then
    insert into public.pin_tries (k, miss, at) select k, true, at from public.pin_attempts;
    drop table public.pin_attempts;
  end if;
end $$;
create or replace view public.pin_attempts as select k, at from public.pin_tries where miss;
revoke all on public.pin_attempts from public, anon, authenticated;

create table if not exists public.app_secrets (name text primary key, val bytea not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from public, anon, authenticated;
insert into public.app_secrets (name, val) values ('pin_decoy', extensions.gen_random_bytes(32))
on conflict (name) do nothing;

-- The caller's network address as Supabase's gateway reports it.
create or replace function public._client_ip() returns text
language sql stable set search_path = public as $$
  select coalesce(
    nullif(h->>'cf-connecting-ip', ''),
    nullif(h->>'x-real-ip', ''),
    nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x;
$$;
revoke all on function public._client_ip() from public, anon, authenticated;

-- ---------- 3. pin_login: no yes/no answer, every attempt counted ----------
create or replace function public.pin_login(p_pin text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_ip   text := public._client_ip();
  v_pin  text := left(coalesce(p_pin, ''), 64);
  hits   uuid[];
  h      bytea;
  hx     text;
  v_hit  boolean;
begin
  delete from public.pin_tries where at < now() - interval '1 day';

  -- Sliding windows, checked BEFORE looking at the PIN, so a blocked caller gets the same
  -- answer whether the PIN is right or wrong.
  if (select count(*) from public.pin_tries where k = v_ip and at > now() - interval '15 minutes') >= 30
     or (select count(*) from public.pin_tries where k = v_ip and miss and at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many tries. Wait 15 minutes and try again.';
  end if;
  if (select count(*) from public.pin_tries where miss and at > now() - interval '5 minutes') >= 100 then
    raise exception 'Too many tries right now. Try again in a few minutes.';
  end if;

  -- Same work for every PIN, right or wrong: check it against every active login.
  select array_agg(x) into hits from public._pin_owners(v_pin, null) x;
  v_hit := v_pin ~ '^[0-9]{6}$' and hits is not null and array_length(hits, 1) = 1;
  insert into public.pin_tries (k, miss) values (v_ip, not v_hit);

  if v_hit then return public._staff_email(hits[1]); end if;

  -- Wrong PIN: a made-up login that looks like a real one and is the same every time for
  -- this PIN, so asking twice doesn't give it away. Signing in with it just fails.
  h  := extensions.hmac(convert_to(v_pin, 'UTF8'), (select val from public.app_secrets where name = 'pin_decoy'), 'sha256');
  hx := encode(substring(h from 1 for 16), 'hex');
  return substr(hx, 1, 8) || '-' || substr(hx, 9, 4) || '-4' || substr(hx, 14, 3) || '-'
      || substr('89ab', (get_byte(h, 8) & 3) + 1, 1) || substr(hx, 18, 3) || '-' || substr(hx, 21, 12)
      || '@pin.example.com';
end $$;
revoke all on function public.pin_login(text) from public;
grant execute on function public.pin_login(text) to anon, authenticated;

-- ---------- 4. Owner-only admin actions ----------
create or replace function public.staff_add(p_name text, p_pin text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean, p_partner text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.perm('owner') then raise exception 'Only the owner can add people'; end if;
  if coalesce(p_partner,'') not in ('', 'shipshape') then raise exception 'Unknown partner'; end if;
  uid := public._make_user(p_name, p_pin);
  insert into public.staff (id, name, crew, can_edit, can_money, can_manage, can_log, all_crews, partner)
  values (uid, p_name, coalesce(p_crew,''), p_edit, p_money, p_manage, p_log, p_all, coalesce(p_partner,''));
  return uid;
end $$;
revoke all on function public.staff_add(text, text, text, boolean, boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.staff_add(text, text, text, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

create or replace function public.staff_update(p_id uuid, p_name text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean, p_active boolean, p_partner text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('owner') then raise exception 'Only the owner can change people'; end if;
  if coalesce(p_partner,'') not in ('', 'shipshape') then raise exception 'Unknown partner'; end if;
  if p_id = auth.uid() and (not p_manage or not p_active) then raise exception 'The owner can''t remove their own access'; end if;
  if (not p_manage or not p_active) and not exists (
      select 1 from public.staff where can_manage and active and id <> p_id) then
    raise exception 'Keep at least one active manager';
  end if;
  update public.staff set name = p_name, crew = coalesce(p_crew,''), can_edit = p_edit, can_money = p_money,
    can_manage = p_manage, can_log = p_log, all_crews = p_all, active = p_active, partner = coalesce(p_partner,'') where id = p_id;
end $$;
revoke all on function public.staff_update(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.staff_update(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

create or replace function public.staff_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare who public.staff;
begin
  if not public.perm('owner') then raise exception 'Only the owner can delete people'; end if;
  if p_id = auth.uid() then raise exception 'You can''t delete yourself'; end if;
  select * into who from public.staff where id = p_id;
  if who.id is null then raise exception 'That person is already gone'; end if;
  if who.can_manage and not exists (select 1 from public.staff where can_manage and active and id <> p_id) then
    raise exception 'Keep at least one active manager';
  end if;
  insert into public.docs (coll, id, data) values ('settings', 'former', jsonb_build_object(p_id::text, who.name))
  on conflict (coll, id) do update set data = public.docs.data || excluded.data;
  delete from auth.users where id = p_id;
  delete from public.staff where id = p_id;
end $$;
revoke all on function public.staff_delete(uuid) from public, anon;
grant execute on function public.staff_delete(uuid) to authenticated;

create or replace function public.staff_set_title(p_id uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('owner') then raise exception 'Only the owner can change titles'; end if;
  update public.staff set title = left(coalesce(p_title, ''), 80) where id = p_id;
end $$;
revoke all on function public.staff_set_title(uuid, text) from public, anon;
grant execute on function public.staff_set_title(uuid, text) to authenticated;

-- Your own photo, or anyone's if you're the owner. The path must be that person's own file in media/staff/.
create or replace function public.staff_set_photo(p_id uuid, p_photo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.perm('owner') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  if coalesce(p_photo, '') <> '' and (p_photo not like 'staff/' || p_id::text || '%' or p_photo !~ '^staff/[A-Za-z0-9._-]{1,120}$') then
    raise exception 'Bad photo path';
  end if;
  update public.staff set photo = coalesce(p_photo, '') where id = p_id;
end $$;
revoke all on function public.staff_set_photo(uuid, text) from public, anon;
grant execute on function public.staff_set_photo(uuid, text) to authenticated;

-- Your own PIN, or anyone's if you're the owner. Returns null when saved, or a message.
-- (Was "returns void" and raised "taken"; a raised error can't be counted, so it now returns it.)
drop function if exists public.staff_set_pin(uuid, text);
create function public.staff_set_pin(p_id uuid, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_key text := 'set:' || coalesce(auth.uid()::text, '');
begin
  if not (public.perm('owner') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then raise exception 'PIN must be exactly 6 digits'; end if;
  if not public.perm('owner') then
    if (select count(*) from public.pin_tries where k = v_key and at > now() - interval '1 hour') >= 6 then
      raise exception 'Too many PIN changes. Wait an hour and try again.';
    end if;
    insert into public.pin_tries (k, miss) values (v_key, false);
  end if;
  if exists (select 1 from public._pin_owners(p_pin, p_id)) then
    return 'That PIN is already taken. Pick a different one.';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  insert into public.pin_vault (id, pin) values (p_id, p_pin) on conflict (id) do update set pin = excluded.pin, set_at = now();
  update public.staff set pin_ok = (p_id = auth.uid()) where id = p_id;
  return null;
end $$;
revoke all on function public.staff_set_pin(uuid, text) from public, anon;
grant execute on function public.staff_set_pin(uuid, text) to authenticated;

create or replace function public.pin_report() returns table (id uuid, name text, active boolean, pin text, set_at timestamptz, last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.perm('owner') then raise exception 'Only the owner can see PINs'; end if;
  return query select s.id, s.name, s.active, v.pin, v.set_at, u.last_sign_in_at
    from public.staff s left join public.pin_vault v on v.id = s.id left join auth.users u on u.id = s.id
    order by s.active desc, s.name;
end $$;
revoke all on function public.pin_report() from public, anon;
grant execute on function public.pin_report() to authenticated;

create or replace function public.staff_require_new_pins() returns text
language plpgsql security definer set search_path = public as $$
declare t text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not public.perm('owner') then raise exception 'Only the owner can do that'; end if;
  update public.staff set pin_ok = false where id <> auth.uid();
  update public.staff set pin_ok = true where id = auth.uid();
  insert into public.docs (coll, id, data) values ('settings', 'signin', jsonb_build_object('after', t, 'by', auth.uid()))
  on conflict (coll, id) do update set data = excluded.data;
  return t;
end $$;
revoke all on function public.staff_require_new_pins() from public, anon;
grant execute on function public.staff_require_new_pins() to authenticated;

-- First-run setup: refuses once anyone exists, and takes a lock so two setups can't race.
create or replace function public.bootstrap_owner(p_name text, p_pin text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  lock table public.staff in exclusive mode;
  if exists (select 1 from public.staff) then raise exception 'The board already has an owner'; end if;
  uid := public._make_user(p_name, p_pin);
  insert into public.staff (id, name, crew, can_edit, can_money, can_manage, can_log, all_crews, is_owner)
  values (uid, p_name, '', true, true, true, true, true, true);
  return uid;
end $$;
revoke all on function public.bootstrap_owner(text, text) from public;
grant execute on function public.bootstrap_owner(text, text) to anon, authenticated;

-- ---------- 5. Rate limit helper for the board's server endpoints (service key only) ----------
create table if not exists public.rate_hits (k text not null, at timestamptz not null default now());
create index if not exists rate_hits_k_at on public.rate_hits (k, at);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from public, anon, authenticated;

create or replace function public.rate_ok(p_key text, p_max int, p_seconds int) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.rate_hits where at < now() - interval '1 day';
  if (select count(*) from public.rate_hits where k = p_key and at > now() - make_interval(secs => p_seconds)) >= p_max then
    return false;
  end if;
  insert into public.rate_hits (k) values (p_key);
  return true;
end $$;
revoke all on function public.rate_ok(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_ok(text, int, int) to service_role;
