/* ---------- Not marked done: past stops nobody checked off (owners) ---------- */
function notDoneStops(days){
  const t=todayISO(), from=isoOf(new Date(Date.now()-(days||14)*864e5).toISOString()), out=[];
  for(const j of jobsArr()){ if(j.stage==="cancelled") continue;
    for(const v of (j.visits||[])) if(v.date&&v.date<=t&&v.date>=from&&!isDone(j.id,v.id)) out.push({j,v,partial:partialMap.get(j.id+"|"+v.id)}); }
  return out.sort((a,b)=>b.v.date.localeCompare(a.v.date)||String(teamName(crewOf(a.j,a.v))).localeCompare(String(teamName(crewOf(b.j,b.v)))));
}
const ND_VTYPE={install:"Install",takedown:"Takedown",service:"Service"};
function notDoneChip(){
  if(!S.me.owner||!S.ready) return ""; const n=notDoneStops().length; if(!n) return "";
  return `<button type="button" class="nd-chip" data-act="notdone">⚠ ${n} stop${n===1?"":"s"} not marked done</button>`;
}
function dNotDone(){
  const list=notDoneStops(), byDay=new Map(); for(const s of list){ if(!byDay.has(s.v.date)) byDay.set(s.v.date,[]); byDay.get(s.v.date).push(s); }
  const body=list.length?[...byDay].map(([d,a])=>`<div class="nd-day"><span class="eyebrow">${esc(rel(d)||fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))} · ${a.length}</span>
    ${a.map(s=>`<button type="button" class="nd-row" data-act="job" data-id="${esc(s.j.id)}"><b>${esc(clientOf(s.j).name||"Job")}</b><span>${esc(ND_VTYPE[s.v.type]||s.v.type)}${s.v.time?" · "+esc(fmtTime(s.v.time)):""} · ${esc(visitCrews(s.j,s.v).map(teamName).join(" + ")||"No crew")}${s.partial?` · <em>partly done</em>`:""}</span></button>`).join("")}</div>`).join("")
    :`<p class="lede">Every stop from the last two weeks is checked off. ✓</p>`;
  return drawerShell("Last 14 days","Not marked done",`<p class="count">Stops on the schedule that nobody checked off. Tap one to open it, then check it off or move it to a new day.</p>${body}`);
}
