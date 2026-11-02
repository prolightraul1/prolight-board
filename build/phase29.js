/* ---------- more than one crew on a job ---------- */
function extraCrewsUI(j,id){
  const open=(j.visits||[]).filter(v=>!isDone(id,v.id)), lead=normCrew(j.crew||"");
  const others=crews().filter(c=>c.id!==lead); if(!others.length) return "";
  const on=c=>!!(open.length&&open.every(v=>visitCrews({...j,id},v).includes(c.id)));
  return `<div class="xcrews"><small>${lead?"Add more crews to this job":"Crews on this job (the first one you pick leads)"}</small><div class="chips">${others.map(c=>`<button type="button" class="chip" data-act="extra-crew" data-id="${esc(id)}" data-v="${esc(c.id)}" aria-pressed="${on(c)}"><span class="dot" style="background:${crewColor(c.id)||"var(--ink-2)"}"></span>${esc(c.name)}</button>`).join("")}</div></div>`;
}
async function toggleExtraCrew(id,cid){
  const j=S.jobs.get(id); if(!j) return;
  if(!j.crew){ try{ await S.db.doc("jobs/"+id).update({crew:cid,updatedAt:new Date().toISOString()}); toast(`${teamName(cid)} is on this job`); }catch(e){ fail(e,"change the crews"); } return; } const jj={...j,id}, open=(j.visits||[]).filter(v=>!isDone(id,v.id));
  const add=!open.every(v=>visitCrews(jj,v).includes(cid));
  const visits=(j.visits||[]).map(v=>{ if(isDone(id,v.id)) return v; const x={...v}, cur=(x.crews||[]).map(normCrew).filter(c=>c!==normCrew(x.crew||j.crew));
    x.crews=add?[...new Set([...cur,cid])]:cur.filter(c=>c!==cid); return x; });
  try{ await S.db.doc("jobs/"+id).update({visits,updatedAt:new Date().toISOString()}); toast(add?`${teamName(cid)} added to this job`:`${teamName(cid)} taken off this job`); }catch(e){ fail(e,"change the crews"); }
}

/* ---------- pick up new versions of the site without a manual refresh ---------- */
const BUILD = (document.querySelector('meta[name="build"]')||{}).content||"";
let _verAsk=0;
async function checkVersion(){
  if(!BUILD||Date.now()-_verAsk<60e3) return; _verAsk=Date.now();
  try{ const t=await (await fetch("/?v="+Date.now(),{cache:"no-store"})).text(); const m=t.match(/<meta name="build" content="([^"]+)"/);
    if(!m||m[1]===BUILD) return;
    const busy=S.drawer||S.form||document.querySelector("#mockRoot:not([hidden]),#callRoot:not([hidden])")||/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||"");
    if(!busy&&document.visibilityState==="visible"){ location.reload(); return; }
    if(!document.getElementById("upd-bar")) document.body.insertAdjacentHTML("beforeend",`<button type="button" id="upd-bar" onclick="location.reload()">New version of the board — tap to update</button>`);
  }catch(e){}
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") checkVersion(); });
setInterval(checkVersion,5*60e3);
