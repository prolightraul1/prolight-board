-- ProLight Season Board — update 6: sign in with just your PIN (no names on the sign-in screen),
-- every PIN unique, and a limit on wrong guesses.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- Who (if anyone) has this PIN. Only active logins count.
create or replace function public._pin_owners(p_pin text, p_except uuid default null) returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.id from public.staff s join auth.users u on u.id = s.id
  where s.active and s.id is distinct from p_except
    and u.encrypted_password = extensions.crypt(p_pin, u.encrypted_password);
$$;
revoke all on function public._pin_owners(text, uuid) from public, anon, authenticated;

create or replace function public._pin_free(p_pin text, p_except uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be exactly 6 digits'; end if;
  if exists (select 1 from public._pin_owners(p_pin, p_except)) then
    raise exception 'That PIN is already taken. Pick a different one.';
  end if;
end $$;
revoke all on function public._pin_free(text, uuid) from public, anon, authenticated;

-- New logins (owner setup and Team → Add person) must use a PIN nobody else has.
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
  return uid;
end $$;

-- Changing a PIN: also must be unique.
create or replace function public.staff_set_pin(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.perm('manage') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  perform public._pin_free(p_pin, p_id);
  update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
end $$;
grant execute on function public.staff_set_pin(uuid, text) to authenticated;

-- Wrong-guess limit: 15 misses per device network in 15 minutes, 60 misses overall in 5 minutes.
create table if not exists public.pin_attempts (k text not null, at timestamptz not null default now());
create index if not exists pin_attempts_at on public.pin_attempts (at);
alter table public.pin_attempts enable row level security;
revoke all on public.pin_attempts from anon, authenticated;

-- Sign-in step 1: turn a PIN into that person's hidden login. Step 2 (in the app) signs in with it.
create or replace function public.pin_login(p_pin text) returns text
language plpgsql security definer set search_path = public as $$
declare v_key text; hits uuid[];
begin
  v_key := coalesce(nullif(split_part(coalesce((current_setting('request.headers', true))::json->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  delete from public.pin_attempts where at < now() - interval '1 day';
  if (select count(*) from public.pin_attempts where pin_attempts.k = v_key and at > now() - interval '15 minutes') >= 15 then
    raise exception 'Too many wrong PINs. Wait 15 minutes and try again.';
  end if;
  if (select count(*) from public.pin_attempts where at > now() - interval '5 minutes') >= 60 then
    raise exception 'Too many wrong PINs right now. Try again in a few minutes.';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{6}$' then return null; end if;
  select array_agg(x) into hits from public._pin_owners(p_pin, null) x;
  if hits is null then insert into public.pin_attempts (k) values (v_key); return null; end if;
  if array_length(hits, 1) > 1 then raise exception 'That PIN belongs to more than one person. Ask the office to give you a new one.'; end if;
  return public._staff_email(hits[1]);
end $$;
grant execute on function public.pin_login(text) to anon, authenticated;

-- Names are no longer shown before sign-in.
revoke execute on function public.login_names() from public, anon;
