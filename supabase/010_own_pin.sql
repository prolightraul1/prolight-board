-- ProLight Season Board - update 11: people change the PIN a manager gave them on their next sign-in.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
alter table public.staff add column if not exists pin_ok boolean not null default false;

create table if not exists public.pin_vault (
  id uuid primary key references auth.users(id) on delete cascade,
  pin text not null,
  set_at timestamptz not null default now()
);
alter table public.pin_vault enable row level security;
revoke all on public.pin_vault from public, anon, authenticated;

-- A PIN someone picks for themselves is theirs; a PIN a manager sets has to be changed at next sign-in.
create or replace function public.staff_set_pin(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.perm('manage') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  perform public._pin_free(p_pin, p_id);
  update auth.users set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  insert into public.pin_vault (id, pin) values (p_id, p_pin) on conflict (id) do update set pin = excluded.pin, set_at = now();
  update public.staff set pin_ok = (p_id = auth.uid()) where id = p_id;
end $$;
grant execute on function public.staff_set_pin(uuid, text) to authenticated;
