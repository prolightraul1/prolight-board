-- ProLight Season Board — update 4: ShipShape can take ProLight's own jobs (default 30% of the job price)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- ShipShape's statement: only ShipShape's payout per job and the payments made to ShipShape.
-- Never returns job prices, TCL's share or ProLight's share.
create or replace function public.partner_statement() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.staff; ss_ids text[]; rate numeric; own_rate numeric; jobs jsonb; pays jsonb;
begin
  select * into me from public.staff where id = auth.uid() and active;
  if me.id is null or not (me.partner = 'shipshape' or me.can_money) then raise exception 'Not allowed'; end if;

  select array_agg(c->>'id') into ss_ids
  from public.docs d, jsonb_array_elements(coalesce(d.data->'crews','[]'::jsonb)) c
  where d.coll = 'settings' and d.id = 'board' and c->>'co' = 'shipshape';
  if ss_ids is null then ss_ids := array['shipshape']; end if;

  select (data->>'ssRate')::numeric into rate from public.docs where coll = 'fin' and id = 'settings';
  rate := coalesce(rate, 30);
  select (data->>'ssOwnRate')::numeric into own_rate from public.docs where coll = 'fin' and id = 'settings';
  own_rate := coalesce(own_rate, 30);

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
        when (case when j.data->>'crew' = 'prolight' then 'pl1' else coalesce(j.data->>'crew','') end) = any(ss_ids)
          then case when j.data->>'source' = 'tcl' then rate else own_rate end
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
