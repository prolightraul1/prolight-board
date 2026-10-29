-- ProLight Season Board — update 8: timecards can't be changed behind the manager's back.
-- Crew can clock in (now) and clock out once. Any other change goes through a fix request
-- that a manager approves. Office and managers can still fix times directly.
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.
create or replace function public.guard_timecard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; win int;
begin
  if auth.uid() is null or public.perm('edit') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.coll = 'log' and old.data->>'kind' = 'clock' then raise exception 'Only a manager can delete time. Send a fix request instead.'; end if;
    return old;
  end if;
  if new.coll <> 'log' then return new; end if;
  n := new.data;
  if tg_op = 'INSERT' and n->>'kind' = 'clock' then
    -- a new clock-in must be "now", unless it's a pending entry waiting for a manager
    -- (a clock-in made with no signal is sent late, so it may be up to 12 hours old; it is marked offline)
    win := 900;
    if coalesce((n->>'offline')::boolean, false) then win := 43200; end if;
    if coalesce((n->>'pending')::boolean, false) is false
       and abs(extract(epoch from (now() - (n->>'in')::timestamptz))) > win then
      raise exception 'Clock-ins are recorded as of now. For a different time, send a fix request.';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.coll = 'log' and old.data->>'kind' = 'clock' then
    o := old.data;
    if (n->>'in') is distinct from (o->>'in')
       or (n->'pending') is distinct from (o->'pending')
       or (n->>'jobId') is distinct from (o->>'jobId')
       or (n->'general') is distinct from (o->'general')
       or ((o->>'out') is not null and (n->>'out') is distinct from (o->>'out')) then
      raise exception 'Only a manager can change a clock time. Send a fix request instead.';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.coll = 'log' and old.data->>'kind' = 'timereq'
     and (new.data->>'status') is distinct from (old.data->>'status') and (new.data->>'status') <> 'canceled' then
    raise exception 'Only a manager can approve or deny a time fix.';
  end if;
  return new;
end $$;
drop trigger if exists guard_timecard on public.docs;
create trigger guard_timecard before insert or update or delete on public.docs
  for each row execute function public.guard_timecard();
