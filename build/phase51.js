/* ---------- Plan a day: every crew sees every job; optionally pull jobs booked for later days ---------- */
planPool = function(){
  const later=planLS("later",false), out=[];
  for(const j of jobsArr()){
    if(j.stage==="cancelled"||j.stage==="quoted"||["lit","down"].includes(status(j))||!hasLL(j)||PLAN.skip.has(j.id)||tclReleased(j,PLAN.day)) continue;
    const v=(j.visits||[]).find(x=>x.type==="install"&&!x.returnOf&&!isDone(j.id,x.id)&&(!x.date||(later&&x.date>PLAN.day))); if(!v) continue;
    if(v.date&&(j.visits||[]).some(x=>x.type==="install"&&x.date===PLAN.day)) continue;
    const p=planPrice(j); if(p<=0) continue;
    const w=String(j.tclWhen||""), pr=j.priority||"";
    const urg=(/this week|asap|urgent/i.test(w)?3:/next week/i.test(w)?1.5:0)+(pr==="HIGH"?2:pr==="MED"?0.7:0)-(v.date?0.5:0);
    out.push({j,v,p,urg});
  }
  return out;
};
planAll = function(){
  const day=PLAN.day, pool=planPool(), taken=new Set(), res=[], cs=crews().filter(planCrewOn);
  // only an option you held keeps its jobs away from the other crews
  for(const c of cs){ if(PLAN.pick[c.id]==null) continue; const have=stopsFor(day,c.id).filter(s=>s.v.type==="install"); const r=planOptions(c,pool,have); const o=r.opts[PLAN.pick[c.id]]; if(o) o.stops.forEach(s=>taken.add(s.j.id)); }
  for(const c of cs){
    const have=stopsFor(day,c.id).filter(s=>s.v.type==="install"), mine=new Set();
    if(PLAN.pick[c.id]!=null){ const r0=planOptions(c,pool,have), o=r0.opts[PLAN.pick[c.id]]; if(o) o.stops.forEach(s=>mine.add(s.j.id)); }
    res.push({c,have,...planOptions(c, pool.filter(x=>!taken.has(x.j.id)||mine.has(x.j.id)), have)});
  }
  const seen=new Map(); res.forEach(r=>r.opts.forEach(o=>o.stops.forEach(s=>{ if(!seen.has(s.j.id)) seen.set(s.j.id,new Set()); seen.get(s.j.id).add(r.c.id); })));
  return {res,seen,pool:pool.length};
};
