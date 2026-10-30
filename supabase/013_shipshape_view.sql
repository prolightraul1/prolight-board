-- ProLight Season Board - update 14: ShipShape crew logins only get ShipShape people (plus managers),
-- and anyone tied to ShipShape can use the ShipShape team chat.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create or replace function public._ss_crews() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select array_agg(c->>'id') from public.docs d, jsonb_array_elements(coalesce(d.data->'crews','[]'::jsonb)) c
    where d.coll = 'settings' and d.id = 'board' and c->>'co' = 'shipshape'), array['shipshape']);
$$;

-- true when the signed-in person is ShipShape crew (not office, money or manager)
create or replace function public._ss_only() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (s.partner = 'shipshape' or s.crew = any(public._ss_crews())) and not (s.can_edit or s.can_money or s.can_manage)
    from public.staff s where s.id = auth.uid()), false);
$$;

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (
  public.perm('any') and (
    not public._ss_only()
    or id = auth.uid() or can_manage or partner = 'shipshape' or crew = any(public._ss_crews())));

create or replace function public.chat_can_read(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when ch = 'ann' then true
      when ch like 'crew:%' then s.all_crews or s.can_edit or s.can_manage or s.crew = substr(ch, 6)
        or (s.partner = 'shipshape' and substr(ch, 6) = any(public._ss_crews()))
      when ch like 'dm:%' then auth.uid()::text = any(string_to_array(substr(ch, 4), ':'))
      else false end
    from public.staff s where s.id = auth.uid() and s.active), false);
$$;
