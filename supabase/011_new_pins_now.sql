-- ProLight Season Board - update 12: a manager can sign everyone out and have them pick a new PIN.
-- Run update-11 first. Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create or replace function public.staff_require_new_pins() returns text
language plpgsql security definer set search_path = public as $$
declare t text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not public.perm('manage') then raise exception 'Only managers can do that'; end if;
  update public.staff set pin_ok = false where id <> auth.uid();
  update public.staff set pin_ok = true where id = auth.uid();
  insert into public.docs (coll, id, data) values ('settings', 'signin', jsonb_build_object('after', t, 'by', auth.uid()))
  on conflict (coll, id) do update set data = excluded.data;
  return t;
end $$;
revoke all on function public.staff_require_new_pins() from public, anon;
grant execute on function public.staff_require_new_pins() to authenticated;
