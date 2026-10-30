-- ProLight Season Board — update 10: managers can fully delete a person, and everyone picks light colors at setup.
-- Removes their login, PIN, headshot record and chat messages. Their check-offs, notes and
-- time stay on the jobs (payroll history), still shown under their name.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
create or replace function public.staff_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare who public.staff;
begin
  if not public.perm('manage') then raise exception 'Only managers can delete people'; end if;
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

-- Everyone picks their light colors at setup; the choice follows them to every device.
alter table public.staff add column if not exists look jsonb;
create or replace function public.staff_set_look(p_look jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_look) <> 'object' or length(p_look::text) > 2000 then raise exception 'Bad look'; end if;
  update public.staff set look = p_look where id = auth.uid();
end $$;
revoke all on function public.staff_set_look(jsonb) from public, anon;
grant execute on function public.staff_set_look(jsonb) to authenticated;

-- PIN report for managers. PINs are stored scrambled for sign-in and can't be read back,
-- so from now on a copy is kept in a locked table only managers can read through pin_report().
-- PINs set before this update show as "reset to see it".
create table if not exists public.pin_vault (
  id uuid primary key references auth.users(id) on delete cascade,
  pin text not null,
  set_at timestamptz not null default now()
);
alter table public.pin_vault enable row level security;
revoke all on public.pin_vault from public, anon, authenticated;

create or replace function public._make_user(p_name text, p_pin text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid(); em text := public._staff_email(uid);
begin
  perform public._pin_free(p_pin, null);
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
    extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', p_name), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.pin_vault (id, pin) values (uid, p_pin) on conflict (id) do update set pin = excluded.pin, set_at = now();
  return uid;
end $$;
revoke all on function public._make_user(text, text) from public, anon, authenticated;

create or replace function public.staff_set_pin(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.perm('manage') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  perform public._pin_free(p_pin, p_id);
  update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  insert into public.pin_vault (id, pin) values (p_id, p_pin) on conflict (id) do update set pin = excluded.pin, set_at = now();
end $$;
grant execute on function public.staff_set_pin(uuid, text) to authenticated;

create or replace function public.pin_report() returns table (id uuid, name text, active boolean, pin text, set_at timestamptz, last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can see PINs'; end if;
  return query select s.id, s.name, s.active, v.pin, v.set_at, u.last_sign_in_at
    from public.staff s left join public.pin_vault v on v.id = s.id left join auth.users u on u.id = s.id
    order by s.active desc, s.name;
end $$;
revoke all on function public.pin_report() from public, anon;
grant execute on function public.pin_report() to authenticated;
