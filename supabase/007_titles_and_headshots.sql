-- ProLight Season Board — update 7: job titles and headshots for the welcome screen.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
alter table public.staff add column if not exists title text not null default '';
alter table public.staff add column if not exists photo text not null default '';

-- Your own headshot (anyone signed in), or anyone's (managers).
create or replace function public.staff_set_photo(p_id uuid, p_photo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.perm('manage') or (p_id = auth.uid() and public.perm('any'))) then raise exception 'Not allowed'; end if;
  update public.staff set photo = coalesce(p_photo, '') where id = p_id;
end $$;
grant execute on function public.staff_set_photo(uuid, text) to authenticated;

-- Titles are set by managers.
create or replace function public.staff_set_title(p_id uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can change titles'; end if;
  update public.staff set title = left(coalesce(p_title, ''), 80) where id = p_id;
end $$;
grant execute on function public.staff_set_title(uuid, text) to authenticated;

-- Anyone signed in may upload their own headshot to media/staff/<their id>...
drop policy if exists media_headshot on storage.objects;
create policy media_headshot on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'staff/' || auth.uid()::text || '%' and public.perm('any'));

-- Starting titles (only fills ones that are still blank; change them any time in Office → Team).
update public.staff set title = 'Christmas Light Operations Manager' where title = '' and name ilike 'raul%';
update public.staff set title = 'Owner, Pro Exterior Services LLC'   where title = '' and name ilike 'brayden%';
update public.staff set title = 'Sales/Operations Manager'           where title = '' and name ilike 'jarrod%';
update public.staff set title = 'Owner, ShipShape Exterior'          where title = '' and name ilike 'nolan%';
