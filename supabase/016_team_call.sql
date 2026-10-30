-- ProLight Season Board - update 17: daily team video call (everyone except ShipShape), call reminders and missed calls.
-- Run update-16 first. Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- the team call room: everyone except ShipShape crew
create or replace function public.chat_can_read(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when ch = 'ann' then true
      when ch = 'meet:prolight' then s.can_manage or s.can_edit or s.can_money or not (s.partner = 'shipshape' or s.crew = any(public._ss_crews()))
      when ch like 'crew:%' then s.all_crews or s.can_edit or s.can_manage or s.crew = substr(ch, 6)
        or (s.partner = 'shipshape' and substr(ch, 6) = any(public._ss_crews()))
      when ch like 'dm:%' then auth.uid()::text = any(string_to_array(substr(ch, 4), ':'))
      else false end
    from public.staff s where s.id = auth.uid() and s.active), false);
$$;
create or replace function public.chat_can_post(ch text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when ch = 'ann' then public.perm('edit') or public.perm('manage') else public.chat_can_read(ch) end;
$$;

-- a once-a-minute heartbeat (6am-10pm Eastern) that sends reminders, starts the team call and catches missed calls
do $$ begin
  if exists (select 1 from cron.job where jobname = 'prolight-tick') then perform cron.unschedule('prolight-tick'); end if;
end $$;
select cron.schedule('prolight-tick', '* 0-2,10-23 * * *',
  $$ select net.http_post(url := 'https://prolight-boardv1.vercel.app/api/tick', body := '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 8000) $$);
