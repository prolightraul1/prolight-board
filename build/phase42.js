/* ---------- Taking a crew off a job really takes it off ---------- */
/* A crew can sit on a visit as that visit's own crew (v.crew, set by Week drag or Plan a day), not just in v.crews.
   Removing used to clear only v.crews, so the chip flipped off but the crew stayed on the job. */
toggleExtraCrew = async function(id,cid){
  const j=S.jobs.get(id); if(!j) return;
  if(!j.crew){ try{ await S.db.doc("jobs/"+id).update({crew:cid,updatedAt:new Date().toISOString()}); toast(`${teamName(cid)} is on this job`); }catch(e){ fail(e,"change the crews"); } return; }
  const jj={...j,id}, open=(j.visits||[]).filter(v=>!isDone(id,v.id)), lead=normCrew(j.crew);
  const add=!open.every(v=>visitCrews(jj,v).includes(cid));
  const visits=(j.visits||[]).map(v=>{
    if(isDone(id,v.id)) return v;
    const x={...v}, own=normCrew(x.crew||j.crew), extra=(x.crews||[]).map(normCrew).filter(c=>c&&c!==own);
    if(add){ if(own!==cid) x.crews=[...new Set([...extra,cid])]; return x; }
    let rest=extra.filter(c=>c!==cid);
    if(own===cid){ const next=rest.find(c=>c!==lead); x.crew=next||(lead!==cid?"":(rest[0]||"")); rest=rest.filter(c=>c!==x.crew); }
    x.crews=rest; if(x.orders&&x.orders[cid]!=null){ x.orders={...x.orders}; delete x.orders[cid]; }
    return x; });
  try{ await S.db.doc("jobs/"+id).update({visits,updatedAt:new Date().toISOString()}); toast(add?`${teamName(cid)} added to this job`:`${teamName(cid)} taken off this job`); }catch(e){ fail(e,"change the crews"); }
};
