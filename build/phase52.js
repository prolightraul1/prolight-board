/* ---------- Change a visit's date right from the job panel and the Not marked done list (owners) ---------- */
async function setVisitDate(jid, vid, date){
  const j=S.jobs.get(jid); if(!j) return; const now=new Date().toISOString();
  const vs=(j.visits||[]).map(x=>x.id!==vid?x:(date?{...x,date,order:x.date===date?x.order:null,unscheduledAt:undefined}:{...x,date:"",time:"",order:null,unscheduledAt:now}));
  try{ await S.db.doc("jobs/"+jid).update({visits:vs,updatedAt:now}); toast(date?`Moved to ${fmtDay(date,{weekday:"short",month:"short",day:"numeric"})}${j.jobberUrl?" · Jobber updates in a minute":""}`:"Date cleared · it's back in Plan a day"); }
  catch(e){ fail(e,"change that date"); }
}
function vDateCtl(j,v){
  if(!S.me.owner||isDone(j.id,v.id)) return "";
  return `<div class="vdate"><input type="date" aria-label="Change date" data-vdate="1" data-j="${esc(j.id)}" data-v="${esc(v.id)}" value="${esc(v.date||"")}">${v.date?`<button type="button" class="linkbtn" data-act="vdate-clear" data-j="${esc(j.id)}" data-v="${esc(v.id)}">No date</button>`:""}${v.date&&v.date<todayISO()?`<span class="count">missed</span>`:""}</div>`;
}
const _visitMore52 = visitMore;
visitMore = function(j,v){ return vDateCtl(j,v)+_visitMore52(j,v); };
dNotDone = function(){
  const list=notDoneStops(), byDay=new Map(); for(const s of list){ if(!byDay.has(s.v.date)) byDay.set(s.v.date,[]); byDay.get(s.v.date).push(s); }
  const body=list.length?[...byDay].map(([d,a])=>`<div class="nd-day"><span class="eyebrow">${esc(rel(d)||fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))} · ${a.length}</span>
    ${a.map(s=>`<div class="nd-item"><button type="button" class="nd-row" data-act="job" data-id="${esc(s.j.id)}"><b>${esc(clientOf(s.j).name||"Job")}</b><span>${esc(ND_VTYPE[s.v.type]||s.v.type)}${s.v.time?" · "+esc(fmtTime(s.v.time)):""} · ${esc(visitCrews(s.j,s.v).map(teamName).join(" + ")||"No crew")}${s.partial?` · <em>partly done</em>`:""}</span></button>
      <div class="nd-acts">${S.me.canLog?`<button type="button" class="btn amber small" data-act="done" data-j="${esc(s.j.id)}" data-v="${esc(s.v.id)}">Mark done</button>`:""}<label class="count">Move to <input type="date" data-vdate="1" data-j="${esc(s.j.id)}" data-v="${esc(s.v.id)}" min="${esc(todayISO())}"></label><button type="button" class="linkbtn" data-act="vdate-clear" data-j="${esc(s.j.id)}" data-v="${esc(s.v.id)}">No date</button></div></div>`).join("")}</div>`).join("")
    :`<p class="lede">Every stop from the last two weeks is checked off. ✓</p>`;
  return drawerShell("Last 14 days","Not marked done",`<p class="count">Stops on the schedule that nobody checked off. Mark them done, move them to a new day, or clear the date so they show up in Plan a day again.</p>${body}`);
};
