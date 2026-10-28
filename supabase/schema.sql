-- ProLight Season Board — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what is missing.

create extension if not exists pgcrypto with schema extensions;

-- ---------- People who can sign in ----------
create table if not exists public.staff (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  crew        text not null default '',      -- crew id from Settings (pl1, pl2, shipshape, …)
  can_edit    boolean not null default false, -- add/edit jobs, clients, schedule, crews
  can_money   boolean not null default false, -- see prices, payouts, money tab
  can_manage  boolean not null default false, -- add people, change PINs and permissions
  can_log     boolean not null default true,  -- check off stops, post notes, photos, video
  all_crews   boolean not null default true,  -- false = only sees jobs for their own crew
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.staff enable row level security;

-- ---------- Board data (clients, jobs, log, fin, settings) ----------
create table if not exists public.docs (
  coll        text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (coll, id)
);
alter table public.docs enable row level security;
alter table public.docs replica identity full;

-- ---------- Permission helpers ----------
create or replace function public.perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p
      when 'edit'   then s.can_edit
      when 'money'  then s.can_money
      when 'manage' then s.can_manage
      when 'log'    then s.can_log
      when 'any'    then true
      else false end
    from public.staff s where s.id = auth.uid() and s.active), false);
$$;

create or replace function public.job_visible(d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.id = auth.uid() and s.active and (
      s.all_crews or s.can_edit or
      (s.crew <> '' and (
        coalesce(d->>'crew','') = s.crew or
        (s.crew = 'pl1' and coalesce(d->>'crew','') = 'prolight') or
        exists (select 1 from jsonb_array_elements(coalesce(d->'visits','[]'::jsonb)) v where v->>'crew' = s.crew)))));
$$;

-- ---------- Row rules ----------
drop policy if exists docs_read   on public.docs;
drop policy if exists docs_insert on public.docs;
drop policy if exists docs_update on public.docs;
drop policy if exists docs_delete on public.docs;

create policy docs_read on public.docs for select to authenticated using (
  public.perm('any') and (
    case coll
      when 'fin'  then public.perm('money')
      when 'jobs' then public.job_visible(data)
      else true end));

create policy docs_insert on public.docs for insert to authenticated with check (
  case coll
    when 'log'      then public.perm('log') and data->>'by' = auth.uid()::text
    when 'fin'      then public.perm('money') and public.perm('edit')
    when 'settings' then public.perm('edit')
    else public.perm('edit') end);

create policy docs_update on public.docs for update to authenticated
  using (
    case coll
      when 'log' then public.perm('edit') or data->>'by' = auth.uid()::text
      when 'fin' then public.perm('money') and public.perm('edit')
      else public.perm('edit') end)
  with check (
    case coll
      when 'log' then public.perm('edit') or data->>'by' = auth.uid()::text
      when 'fin' then public.perm('money') and public.perm('edit')
      else public.perm('edit') end);

create policy docs_delete on public.docs for delete to authenticated using (
  case coll
    when 'log' then public.perm('edit') or data->>'by' = auth.uid()::text
    when 'fin' then public.perm('money') and public.perm('edit')
    else public.perm('edit') end);

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (public.perm('any'));

-- Merge fields into a document (one round trip, no lost fields)
create or replace function public.doc_merge(p_coll text, p_id text, p_patch jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.docs set data = data || p_patch, updated_at = now(), updated_by = auth.uid()
  where coll = p_coll and id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Not allowed, or that record no longer exists' using errcode = '42501'; end if;
end $$;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;

-- ---------- Sign-in by name + PIN ----------
-- Each person is a normal Supabase user with a hidden email; their PIN is their password.
create or replace function public._staff_email(p_id uuid) returns text
language sql immutable as $$ select p_id::text || '@pin.example.com' $$;

create or replace function public._make_user(p_name text, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); em text := public._staff_email(uid);
begin
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be exactly 6 digits'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  return uid;
end $$;
revoke all on function public._make_user(text, text) from public, anon, authenticated;

-- Names shown on the sign-in screen
create or replace function public.login_names() returns table (id uuid, name text, email text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, public._staff_email(s.id) from public.staff s where s.active order by s.name;
$$;
grant execute on function public.login_names() to anon, authenticated;

-- First run only: creates the owner account when nobody exists yet
create or replace function public.bootstrap_owner(p_name text, p_pin text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if exists (select 1 from public.staff) then raise exception 'The board already has an owner'; end if;
  uid := public._make_user(p_name, p_pin);
  insert into public.staff (id, name, crew, can_edit, can_money, can_manage, can_log, all_crews)
  values (uid, p_name, '', true, true, true, true, true);
  return uid;
end $$;
grant execute on function public.bootstrap_owner(text, text) to anon, authenticated;

create or replace function public.needs_owner() returns boolean
language sql stable security definer set search_path = public as $$ select not exists (select 1 from public.staff) $$;
grant execute on function public.needs_owner() to anon, authenticated;

-- Add a person (managers only)
create or replace function public.staff_add(p_name text, p_pin text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.perm('manage') then raise exception 'Only managers can add people'; end if;
  uid := public._make_user(p_name, p_pin);
  insert into public.staff (id, name, crew, can_edit, can_money, can_manage, can_log, all_crews)
  values (uid, p_name, coalesce(p_crew,''), p_edit, p_money, p_manage, p_log, p_all);
  return uid;
end $$;
grant execute on function public.staff_add(text, text, text, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Change someone's name, crew, permissions or active status (managers only)
create or replace function public.staff_update(p_id uuid, p_name text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can change people'; end if;
  if (not p_manage or not p_active) and not exists (
      select 1 from public.staff where can_manage and active and id <> p_id) then
    raise exception 'Keep at least one active manager';
  end if;
  update public.staff set name = p_name, crew = coalesce(p_crew,''), can_edit = p_edit, can_money = p_money,
    can_manage = p_manage, can_log = p_log, all_crews = p_all, active = p_active where id = p_id;
end $$;
grant execute on function public.staff_update(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- Change a PIN (managers for anyone, everyone for themselves)
create or replace function public.staff_set_pin(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.perm('manage') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be exactly 6 digits'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
end $$;
grant execute on function public.staff_set_pin(uuid, text) to authenticated;

-- ---------- Live updates ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'staff') then
    alter publication supabase_realtime add table public.staff;
  end if;
end $$;

-- ---------- Photos, videos and mockups ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;

drop policy if exists media_upload on storage.objects;
drop policy if exists media_delete on storage.objects;
create policy media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.perm('log'));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (public.perm('edit') or owner = auth.uid()));
