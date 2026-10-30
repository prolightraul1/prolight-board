-- ProLight Season Board - update 15: ProLight crew logins don't get ShipShape people.
-- Run update-14 first. Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create or replace function public._pl_only() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select not (s.can_edit or s.can_money or s.can_manage) and s.partner <> 'shipshape' and not (s.crew = any(public._ss_crews()))
    from public.staff s where s.id = auth.uid()), false);
$$;

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (
  public.perm('any')
  and (not public._ss_only() or id = auth.uid() or can_manage or partner = 'shipshape' or crew = any(public._ss_crews()))
  and (not public._pl_only() or id = auth.uid() or can_manage or not (partner = 'shipshape' or crew = any(public._ss_crews()))));
