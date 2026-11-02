
/* ---------- waiting-for-signal pill ---------- */
function outPill(){ const n=window.PL&&PL.outbox?PL.outbox():0; return n?`<button type="button" class="outpill" data-act="outbox" title="Saved on this phone. Sends when you have signal.">${n} waiting for signal</button>`:""; }
window.addEventListener("prolight:outbox",()=>renderNav());
window.addEventListener("prolight:outboxSent",e=>{ const {sent,dropped}=e.detail; if(dropped) toast(`${dropped} change${dropped>1?"s":""} couldn't be saved (not allowed). The rest went through.`); else if(sent) toast(`Signal's back. Sent ${sent} change${sent>1?"s":""}.`); });

/* ---------- service calls ---------- */
const SVC_REASONS=["Section out","Bulbs out","Won't turn on / timer","Hanging or loose","Damage","Wants a change","Other"];
const svcText = v => { const s=v.svc||{}; return [s.reason,s.details].filter(Boolean).join(": ") || v.note || "Service call"; };
function svcOpen(){
  const out=[];
  for(const j of jobsArr()){ if(j.stage==="cancelled") continue; for(const v of (j.visits||[])) if(v.type==="service" && !isDone(j.id,v.id)) out.push({j,v}); }
  return out.sort((a,b)=>(!!(b.v.svc&&b.v.svc.urgent))-(!!(a.v.svc&&a.v.svc.urgent)) || (!!a.v.date)-(!!b.v.date) || String(a.v.date).localeCompare(String(b.v.date)));
}
function svcIssues(){
  const used=new Set(); for(const j of jobsArr()) for(const v of (j.visits||[])) if(v.fromIssue) used.add(v.fromIssue);
  return [...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="issue"&&!e.closed&&!used.has(e.id)&&S.jobs.has(e.jobId)).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
const svcCount = () => S.me.owner ? svcOpen().filter(s=>!s.v.date).length + svcIssues().length : 0;

/* where it fits best: the crew route over the next 5 days that it adds the fewest miles to */
function bestFit(j, skipVid){
  if(!hasLL(j)) return null;
  let best=null;
  for(let d=0; d<5; d++){ const day=addDays(todayISO(),d);
    for(const c of crews()){
      const st=stopsFor(day,c.id).filter(s=>!(s.j.id===j.id&&s.v.id===skipVid));
      if(!st.length) continue;
      const pts=[shop(),...st.map(s=>hasLL(s.j)?s.j:null),shop()];
      for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1]; if(!a||!b) continue;
        const add=legMiles(a,j)+legMiles(j,b)-legMiles(a,b), score=add+d*1.5;
        if(!best||score<best.score) best={day,crew:c.id,idx:i,add,score}; }
    }
  }
  return best;
}
async function placeSvc(jid, vid, day, crew, idx){
  const j=S.jobs.get(jid), visits=(j.visits||[]).map(x=>({...x})), v=visits.find(x=>x.id===vid);
  v.date=day; v.crew=crew; v.crews=[]; v.order=null; if(v.orders) delete v.orders;
  await S.db.doc("jobs/"+jid).update({visits,updatedAt:new Date().toISOString()});
  if(idx==null) return;
  const list=stopsFor(day,crew), me=list.findIndex(s=>s.j.id===jid&&s.v.id===vid);
  if(me<0) return; const [it]=list.splice(me,1); list.splice(Math.min(idx,list.length),0,it);
  const changes=new Map();
  list.forEach((s,i)=>{ const base=changes.get(s.j.id)||(S.jobs.get(s.j.id).visits||[]).map(x=>({...x})); const t=base.find(x=>x.id===s.v.id); if(ordOf(t,crew)!==i+1){ setOrd(s.j,t,crew,i+1); changes.set(s.j.id,base); } });
  for(const [id,vs] of changes) await S.db.doc("jobs/"+id).update({visits:vs});
}
const fitText = f => `${teamName(f.crew)} · ${rel(f.day)||fmtDay(f.day,{weekday:"short",month:"short",day:"numeric"})} · +${f.add<.1?"0.1":f.add.toFixed(1)} mi`;

function serviceBlock(){
  if(!S.me.owner) return "";
  const I=svcIssues(), O=svcOpen();
  let h=`<div class="bar" style="margin-top:4px"><h2 class="h-sec grow" style="margin:0">Service calls${O.length+I.length?` · ${O.length+I.length}`:""}</h2><button type="button" class="btn small amber" data-act="svc-pick">+ Service call</button></div>`;
  if(!O.length&&!I.length) return h+`<p class="count" style="font-size:14px">No open service calls. When a customer calls with lights out, log it here and the board finds the crew that's closest that week.</p>`;
  h+=`<div class="rows">`;
  for(const e of I){ const j={id:e.jobId,...S.jobs.get(e.jobId)};
    h+=`<div class="row svc" style="cursor:default"><span class="bulb red"></span><span class="m"><span class="n">${esc(clientOf(j).name||"Customer")}${e.urgent?` <span class="vt urgent">Urgent</span>`:""}</span>
      <span class="s">Reported by ${esc(who(e.by))} · ${esc(ago(e.at))}<br>${esc([e.reason,e.text].filter(Boolean).join(": "))}</span></span>
      <span class="r"><button type="button" class="btn small amber" data-act="svc-from-issue" data-v="${esc(e.id)}">Schedule it</button><button type="button" class="btn small" data-act="svc-dismiss" data-v="${esc(e.id)}">Dismiss</button></span></div>`; }
  for(const {j,v} of O){ const f=!v.date&&bestFit(j,v.id);
    h+=`<div class="row svc" style="cursor:default"><span class="bulb ${v.date?"dim":"red"}"></span><span class="m"><span class="n"><button type="button" class="linkbtn" style="text-decoration:none;font-weight:inherit" data-act="job" data-id="${esc(j.id)}">${esc(clientOf(j).name||"Customer")}</button>${v.svc&&v.svc.urgent?` <span class="vt urgent">Urgent</span>`:""}</span>
      <span class="s">${esc(svcText(v))}<br>${v.date?`${esc(fmtDay(v.date,{weekday:"short",month:"short",day:"numeric"}))} · ${esc(teamName(crewOf(j,v)))}`:f?`Best fit: ${esc(fitText(f))}`:hasLL(j)?"No routes in the next 5 days":"No map pin, pick a day"}</span></span>
      <span class="r">${f?`<button type="button" class="btn small amber" data-act="svc-fit" data-v="${esc(j.id)}|${esc(v.id)}">Add to that route</button>`:""}<button type="button" class="btn small" data-act="svc-edit" data-v="${esc(j.id)}|${esc(v.id)}">${v.date?"Change":"Pick a day"}</button></span></div>`; }
  return h+`</div>`;
}

function dService(key){
  // key: "new|<jobId>[|<issueId>]" or "<jobId>|<visitId>"
  const parts=key.split("|"), isNew=parts[0]==="new", jid=isNew?parts[1]:parts[0], j0=S.jobs.get(jid); if(!j0) return drawerShell("Service call","Job not found","");
  const j={id:jid,...j0}, v=isNew?null:(j.visits||[]).find(x=>x.id===parts[1]), iss=isNew&&parts[2]?S.log.get(parts[2]):null;
  const F=S.form&&S.form.svc||(S.form={svc:{reason:(v&&v.svc&&v.svc.reason)||(iss&&iss.reason)||"",details:(v&&v.svc&&v.svc.details)||(iss&&iss.text)||"",urgent:!!((v&&v.svc&&v.svc.urgent)||(iss&&iss.urgent))}}).svc;
  const fit=bestFit(j,v&&v.id);
  const b=`<form class="form" id="svcForm" data-key="${esc(key)}"><fieldset><legend>What's wrong</legend>
    <div class="chips" style="flex-wrap:wrap">${SVC_REASONS.map(r=>`<button type="button" class="chip" data-act="svc-reason" data-v="${esc(r)}" aria-pressed="${F.reason===r}">${esc(r)}</button>`).join("")}</div>
    <div class="f"><label for="sv-det">Details</label><textarea id="sv-det" placeholder="e.g. Left side of the garage roofline is dark since the storm">${esc(F.details)}</textarea></div>
    <button type="button" class="tog" data-act="svc-urgent" aria-pressed="${F.urgent}">${F.urgent?"Urgent":"Not urgent"}</button></fieldset>
    <fieldset><legend>When</legend>${fit?`<div class="note" style="margin:0 0 8px">Best fit: <b>${esc(fitText(fit))}</b>, the route it adds the fewest miles to. <button type="button" class="btn small amber" data-act="svc-usefit" data-v="${esc(fit.day)}|${esc(fit.crew)}">Use it</button></div>`:""}
      <div class="two"><div class="f"><label for="sv-date">Day</label><input id="sv-date" type="date" value="${esc((v&&v.date)||"")}"><small>Leave blank to schedule later.</small></div>
      <div class="f"><label for="sv-crew">Crew</label><select id="sv-crew"><option value="">Pick later</option>${crews().map(c=>`<option value="${esc(c.id)}" ${v&&crewOf(j,v)===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div></div></fieldset>
    <div class="actions">${v?`<button type="button" class="btn danger" data-act="svc-cancel" data-v="${esc(jid)}|${esc(v.id)}">Cancel this call</button>`:"<span></span>"}<button type="submit" class="btn amber">${v?"Save":"Add service call"}</button></div><p class="count" id="sv-err" style="color:var(--red)"></p></form>`;
  return drawerShell("Service call", clientOf(j).name||"Customer", b);
}
function readSvc(){ if(S.form&&S.form.svc){ const d=$("#sv-det"); if(d) S.form.svc.details=d.value; } }
async function saveSvc(form){
  readSvc(); const F=S.form.svc, parts=form.dataset.key.split("|"), isNew=parts[0]==="new", jid=isNew?parts[1]:parts[0];
  if(!F.reason&&!F.details.trim()){ $("#sv-err").textContent="Pick what's wrong or add details."; return; }
  const day=$("#sv-date").value, crew=$("#sv-crew").value, j=S.jobs.get(jid), visits=(j.visits||[]).map(x=>({...x}));
  const svc={reason:F.reason,details:F.details.trim(),urgent:F.urgent,reportedAt:new Date().toISOString(),by:S.me.id};
  let vid;
  if(isNew){ vid=uid(); visits.push({id:vid,type:"service",date:"",time:"",crew:"",note:[F.reason,F.details.trim()].filter(Boolean).join(": "),order:null,svc,...(parts[2]?{fromIssue:parts[2]}:{})}); }
  else { vid=parts[1]; const v=visits.find(x=>x.id===vid); v.svc={...(v.svc||{}),...svc,reportedAt:(v.svc&&v.svc.reportedAt)||svc.reportedAt}; v.note=[F.reason,F.details.trim()].filter(Boolean).join(": "); }
  try{
    await S.db.doc("jobs/"+jid).update({visits,updatedAt:new Date().toISOString()});
    if(day&&crew){ const f=bestFit({id:jid,...S.jobs.get(jid)},vid); await placeSvc(jid,vid,day,crew,f&&f.day===day&&f.crew===crew?f.idx:null); }
    else if(day||crew){ const vs=(S.jobs.get(jid).visits||[]).map(x=>({...x})), v=vs.find(x=>x.id===vid); v.date=day; v.crew=crew; await S.db.doc("jobs/"+jid).update({visits:vs}); }
    toast(day?"Service call scheduled":"Service call added"); S.form=null; closeDrawer();
  }catch(e){ fail(e,"save the service call"); }
}
function dIssue(jid){
  const j={id:jid,...(S.jobs.get(jid)||{})}, F=S.form&&S.form.svc||(S.form={svc:{reason:"",details:"",urgent:false}}).svc;
  const b=`<form class="form" id="issueForm" data-key="${esc(jid)}"><fieldset><legend>What's wrong</legend>
    <div class="chips" style="flex-wrap:wrap">${SVC_REASONS.map(r=>`<button type="button" class="chip" data-act="svc-reason" data-v="${esc(r)}" aria-pressed="${F.reason===r}">${esc(r)}</button>`).join("")}</div>
    <div class="f"><label for="sv-det">Details</label><textarea id="sv-det" placeholder="What did you see? Which part of the house?">${esc(F.details)}</textarea></div>
    <button type="button" class="tog" data-act="svc-urgent" aria-pressed="${F.urgent}">${F.urgent?"Urgent":"Not urgent"}</button></fieldset>
    <p class="count">The office gets this and schedules the fix. Add photos in Notes & photos.</p>
    <div class="actions"><span class="count" id="sv-err" style="color:var(--red)"></span><button type="submit" class="btn amber">Send to the office</button></div></form>`;
  return drawerShell("Report a problem", clientOf(j).name||"Customer", b);
}
async function saveIssue(form){
  readSvc(); const F=S.form.svc, jid=form.dataset.key;
  if(!F.reason&&!F.details.trim()){ $("#sv-err").textContent="Pick what's wrong or add details."; return; }
  try{ await S.db.collection("log").add({kind:"issue",jobId:jid,reason:F.reason,text:F.details.trim(),urgent:F.urgent,by:S.me.id,at:new Date().toISOString()}); toast("Sent to the office"); S.form=null; closeDrawer(); }
  catch(e){ fail(e,"send that"); }
}
function issueEntry(e){
  return `<div class="entry partial-e"><div class="meta"><span><b>${esc(who(e.by))}</b> reported a problem${e.urgent?" · urgent":""}</span><span>${esc(ago(e.at))}</span></div><div class="txt">${esc([e.reason,e.text].filter(Boolean).join(": "))}${e.closed?" · dismissed":""}</div></div>`;
}
function dSvcPick(){
  const q=(S.form&&S.form.svcq)||"", ql=q.toLowerCase();
  const list=jobsArr().filter(j=>j.stage!=="cancelled").filter(j=>!ql||[clientOf(j).name,addrOf(j)].join(" ").toLowerCase().includes(ql))
    .sort((a,b)=>(["lit","partial"].includes(status(b)))-(["lit","partial"].includes(status(a)))||String(clientOf(a).name).localeCompare(String(clientOf(b).name))).slice(0,40);
  const b=`<input class="search" id="svc-q" placeholder="Search customer or address" value="${esc(q)}" autocomplete="off" style="width:100%">
    <div class="rows" style="margin-top:8px">${list.map(j=>`<button type="button" class="row" data-act="svc-new" data-v="${esc(j.id)}"><span class="bulb ${BULB[status(j)]}"></span><span class="m"><span class="n">${esc(clientOf(j).name||"Customer")}</span><span class="s">${esc(addrOf(j))}</span></span><span class="r"><span class="st ${status(j)}">${STATUS[status(j)]}</span></span></button>`).join("")||`<p class="count">No match.</p>`}</div>`;
  return drawerShell("Service call","Which customer?",b);
}
document.addEventListener("input",e=>{ if(e.target.id==="svc-q"){ S.form={...(S.form||{}),svcq:e.target.value}; const pos=e.target.selectionStart; renderDrawer(); const n=$("#svc-q"); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(x){} } } });
