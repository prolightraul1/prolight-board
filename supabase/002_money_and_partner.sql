-- ProLight Season Board — update 2: ShipShape owner login + payment records
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- A partner login sees only that partner's own payouts (today: 'shipshape').
alter table public.staff add column if not exists partner text not null default '';

drop function if exists public.staff_add(text, text, text, boolean, boolean, boolean, boolean, boolean);
create or replace function public.staff_add(p_name text, p_pin text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean, p_partner text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.perm('manage') then raise exception 'Only managers can add people'; end if;
  if coalesce(p_partner,'') not in ('', 'shipshape') then raise exception 'Unknown partner'; end if;
  uid := public._make_user(p_name, p_pin);
  insert into public.staff (id, name, crew, can_edit, can_money, can_manage, can_log, all_crews, partner)
  values (uid, p_name, coalesce(p_crew,''), p_edit, p_money, p_manage, p_log, p_all, coalesce(p_partner,''));
  return uid;
end $$;
grant execute on function public.staff_add(text, text, text, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

drop function if exists public.staff_update(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean);
create or replace function public.staff_update(p_id uuid, p_name text, p_crew text,
  p_edit boolean, p_money boolean, p_manage boolean, p_log boolean, p_all boolean, p_active boolean, p_partner text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.perm('manage') then raise exception 'Only managers can change people'; end if;
  if coalesce(p_partner,'') not in ('', 'shipshape') then raise exception 'Unknown partner'; end if;
  if (not p_manage or not p_active) and not exists (
      select 1 from public.staff where can_manage and active and id <> p_id) then
    raise exception 'Keep at least one active manager';
  end if;
  update public.staff set name = p_name, crew = coalesce(p_crew,''), can_edit = p_edit, can_money = p_money,
    can_manage = p_manage, can_log = p_log, all_crews = p_all, active = p_active, partner = coalesce(p_partner,'') where id = p_id;
end $$;
grant execute on function public.staff_update(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean, text) to authenticated;

-- ShipShape's statement: only ShipShape's payout per job and the payments made to ShipShape.
-- Never returns job prices, TCL's share or ProLight's share.
create or replace function public.partner_statement() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.staff; ss_ids text[]; rate numeric; jobs jsonb; pays jsonb;
begin
  select * into me from public.staff where id = auth.uid() and active;
  if me.id is null or not (me.partner = 'shipshape' or me.can_money) then raise exception 'Not allowed'; end if;

  select array_agg(c->>'id') into ss_ids
  from public.docs d, jsonb_array_elements(coalesce(d.data->'crews','[]'::jsonb)) c
  where d.coll = 'settings' and d.id = 'board' and c->>'co' = 'shipshape';
  if ss_ids is null then ss_ids := array['shipshape']; end if;

  select (data->>'ssRate')::numeric into rate from public.docs where coll = 'fin' and id = 'settings';
  rate := coalesce(rate, 30);

  select coalesce(jsonb_agg(r order by r->>'date' nulls last, r->>'client'), '[]'::jsonb) into jobs from (
    select jsonb_build_object(
      'id', j.id,
      'client', c.data->>'name',
      'address', coalesce(nullif(j.data->>'address',''), c.data->>'address'),
      'date', (select min(v->>'date') from jsonb_array_elements(coalesce(j.data->'visits','[]'::jsonb)) v where coalesce(v->>'date','') <> ''),
      'installed', exists (select 1 from public.docs l where l.coll = 'log' and l.data->>'jobId' = j.id and l.data->>'kind' = 'done'),
      'pct', x.pct,
      'payout', round(coalesce((f.data->>'price')::numeric, 0) * x.pct / 100, 2),
      'paid', coalesce((f.data->>'ssPaid')::boolean, false)) as r
    from public.docs j
    left join public.docs f on f.coll = 'fin' and f.id = j.id
    left join public.docs c on c.coll = 'clients' and c.id = j.data->>'clientId'
    cross join lateral (select case
        when f.data ? 'ssPct' and jsonb_typeof(f.data->'ssPct') = 'number' then (f.data->>'ssPct')::numeric
        when j.data->>'source' = 'tcl' and (case when j.data->>'crew' = 'prolight' then 'pl1' else coalesce(j.data->>'crew','') end) = any(ss_ids) then rate
        else 0 end as pct) x
    where j.coll = 'jobs' and coalesce(j.data->>'stage','') <> 'cancelled' and x.pct > 0) t;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'date', p.data->>'date', 'amount', (p.data->>'amount')::numeric,
      'method', p.data->>'method', 'memo', p.data->>'memo', 'jobs', coalesce(p.data->'jobs','[]'::jsonb))
    order by p.data->>'date'), '[]'::jsonb) into pays
  from public.docs p where p.coll = 'fin' and p.id like 'pay-%' and p.data->>'party' = 'shipshape';

  return jsonb_build_object('jobs', jobs, 'payments', pays);
end $$;
grant execute on function public.partner_statement() to authenticated;

-- Crew-only logins (like ShipShape's) see only the clients of jobs they can see.
create or replace function public.client_visible(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.id = auth.uid() and s.active and (s.all_crews or s.can_edit))
      or exists (select 1 from public.docs j where j.coll = 'jobs' and j.data->>'clientId' = p_id and public.job_visible(j.data));
$$;
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (
  public.perm('any') and (
    case coll
      when 'fin'     then public.perm('money')
      when 'jobs'    then public.job_visible(data)
      when 'clients' then public.client_visible(id)
      else true end));
