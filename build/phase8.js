
/* ---------- ShipShape crews: job tracking only, no payroll hours ---------- */
const isSS = id => { const p=(window.PL&&PL.staff().find(x=>x.id===id))||null; return !!p && (p.partner==="shipshape" || coOf(p.crew)==="shipshape"); };

/* ---------- time fix requests ---------- */
const isClock = e => e.kind==="clock" && !e.pending;
function timeReqs(){ return [...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="timereq").sort((a,b)=>String(b.at).localeCompare(String(a.at))); }
const pendingReqs = () => timeReqs().filter(r=>r.status==="pending");
const managers = () => PL.staff().filter(p=>p.active&&p.can_manage);
const canApprove = r => !!S.me.manage;
const tfmt = x => x ? new Date(x).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) : "–";
const clockLabel = e => e.general ? (e.where==="shop"?"Shop":"Driving") : (clientOf(S.jobs.get(e.jobId)||{}).name||"Job");
const reqCount = () => S.me.manage ? pendingReqs().filter(canApprove).length : 0;

const myWeekStart = () => addDays(monday(todayISO()), 7*(S.myWk||0));
function myTime(){
  if(!S.me.canLog || isSS(S.me.id)) return "";
  const ws=myWeekStart(), days=new Set([...Array(7)].map((_,i)=>addDays(ws,i))), own=!!S.me.owner;
  const mine=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.by===S.me.id&&e.in&&days.has(isoOf(e.in))).sort((a,b)=>b.in.localeCompare(a.in));
  const reqs=timeReqs().filter(r=>r.by===S.me.id).slice(0,6), pend=new Set(reqs.filter(r=>r.status==="pending").map(r=>r.target));
  const tot=mine.filter(e=>!e.pending).reduce((t,e)=>t+clockMs(e),0);
  return `<fieldset><legend>My time · ${(S.myWk||0)===0?"this week":"week of "+esc(fmtDay(ws))} · ${fmtDur(tot)}</legend>
    <div class="bar" style="margin-bottom:8px"><button type="button" class="btn small" data-act="mt-wk" data-v="-1" aria-label="Previous week">‹ Prev</button>${(S.myWk||0)<0?`<button type="button" class="btn small" data-act="mt-wk" data-v="1" aria-label="Next week">Next ›</button><button type="button" class="btn small" data-act="mt-wk" data-v="0">This week</button>`:""}</div>
    ${mine.length?`<div class="rows">${mine.map(e=>`<div class="row" style="cursor:default"><span class="m"><span class="n">${esc(fmtDay(isoOf(e.in),{weekday:"short",month:"short",day:"numeric"}))} · ${esc(clockLabel(e))}</span>
      <span class="s mono">${tfmt(e.in)} – ${e.out?tfmt(e.out):"now"} · ${fmtDur(clockMs(e))}${e.pending?" · waiting for approval":""}${e.source==="jobber"?" · from Jobber":e.edited?" · fixed":""}</span></span>
      <span class="r">${pend.has(e.id)||e.pending?`<span class="st booked">Requested</span>`:own?`<button type="button" class="btn small" data-act="clock-edit" data-id="${esc(e.id)}">Edit</button>`:`<button type="button" class="btn small" data-act="treq-fix" data-v="${esc(e.id)}">Request fix</button>`}</span></div>`).join("")}</div>`:`<p class="count">No time yet this week.</p>`}
    <div class="bar" style="margin-top:8px"><button type="button" class="btn small" data-act="treq-add">+ ${own?"Add time":"Add missing time"}</button>${own?`<button type="button" class="btn small" data-act="jbh-open">Pull hours from Jobber</button>`:""}</div>
    ${reqs.length?`<p class="eyebrow" style="margin:10px 0 4px">My requests</p>${reqs.map(r=>`<div class="count" style="font-size:13px">${esc(fmtDay(isoOf(r.at)))}: ${esc(r.summary||"")} · <b>${r.status==="pending"?"Waiting":r.status==="approved"?"Approved":r.status==="denied"?"Denied":"Canceled"}</b>${r.note?` (${esc(r.note)})`:""}${r.status==="pending"?` · <button type="button" class="linkbtn" data-act="treq-cancel" data-v="${esc(r.id)}">Cancel</button>`:""}</div>`).join("")}`:""}
    <small>${own?"You can edit your own time directly. Every change is marked on the payroll detail.":"Location missed something, or you forgot to clock in or out? Send a fix and a manager approves it."}</small></fieldset>`;
}
function dTimeReq(key){
  const [mode,cid]=key.split("|"), e=mode==="fix"?S.log.get(cid):null;
  const loc=x=>{ if(!x) return ""; const d=new Date(x); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const ws=myWeekStart(), day=e?isoOf(e.in):((S.myWk||0)===0?todayISO():ws), own=!!S.me.owner&&!e;
  const stops=[...new Map([...Array(9)].flatMap((_,i)=>stopsFor(addDays(ws,i-1),"all")).map(s=>[s.j.id+"|"+s.v.id,s])).values()].sort((a,b)=>String(a.v.date).localeCompare(String(b.v.date)));
  const b=`<form class="form" id="treqForm" data-key="${esc(key)}">
    ${e?`<div class="note" style="margin:0">Now: ${esc(clockLabel(e))} · ${tfmt(e.in)} – ${e.out?tfmt(e.out):"still clocked in"}</div>`:""}
    <div class="two"><div class="f"><label for="tq-day">Day</label><input id="tq-day" type="date" value="${esc(day)}" ${e?"disabled":""}></div>
      ${e?"":`<div class="f"><label for="tq-type">What</label><select id="tq-type"><option value="job">At a job</option><option value="shop">At the shop</option><option value="travel">Driving</option></select></div>`}</div>
    ${e?"":`<div class="f" id="tq-jobf"><label for="tq-job">Which job</label><select id="tq-job"><option value="">Pick the job</option>${stops.map(s=>`<option value="${esc(s.j.id+"|"+s.v.id)}">${esc(clientOf(s.j).name||"Customer")} · ${esc(fmtDay(s.v.date))}</option>`).join("")}</select><small>Stops from that week are listed.</small></div>`}
    <div class="two"><div class="f"><label for="tq-in">Start</label><input id="tq-in" type="time" value="${loc(e&&e.in)}" required></div>
      <div class="f"><label for="tq-out">End</label><input id="tq-out" type="time" value="${loc(e&&e.out)}" required></div></div>
    <div class="f"><label for="tq-why">What happened</label><textarea id="tq-why" ${own?"":"required"} placeholder="e.g. Phone died at the Klees job, I left at 3:40"></textarea></div>
    <div class="actions"><span class="count" id="tq-err" style="color:var(--red)"></span><button type="submit" class="btn amber">${own?"Add to my time card":"Send to a manager"}</button></div></form>`;
  return drawerShell(e?"Fix my time":own?"Add time":"Add missing time", (PL.me()||{}).name||"", b);
}
async function saveTimeReq(form){
  const [mode,cid]=form.dataset.key.split("|"), e=mode==="fix"?S.log.get(cid):null;
  const day=e?isoOf(e.in):$("#tq-day").value, i=$("#tq-in").value, o=$("#tq-out").value, why=$("#tq-why").value.trim();
  const at=(t)=>new Date(day+"T"+t+":00").toISOString();
  if(!day||!i||!o){ $("#tq-err").textContent="Fill in the day, start and end."; return; }
  let pin=at(i), pout=at(o); if(new Date(pout)<=new Date(pin)) pout=new Date(new Date(pout).getTime()+864e5).toISOString();
  const own=!!S.me.owner&&!e;
  if(!why&&!own){ $("#tq-err").textContent="Say what happened."; return; }
  const now=new Date().toISOString();
  try{
    if(e){
      await S.db.collection("log").add({kind:"timereq",status:"pending",target:cid,propIn:pin,propOut:pout,reason:why,by:S.me.id,at:now,
        summary:`${clockLabel(e)} ${tfmt(e.in)}–${e.out?tfmt(e.out):"open"} → ${tfmt(pin)}–${tfmt(pout)}`});
    } else {
      const type=$("#tq-type").value, jv=$("#tq-job").value;
      if(type==="job"&&!jv){ $("#tq-err").textContent="Pick the job."; return; }
      const [jid,vid]=jv?jv.split("|"):["",""];
      if(own){ await S.db.collection("log").add({kind:"clock",general:type!=="job",where:type==="job"?"":type,jobId:type==="job"?jid:"",visitId:type==="job"?vid:"",by:S.me.id,in:pin,out:pout,auto:false,at:now,edited:S.me.id,manual:true,...(why?{note:why}:{})});
        toast("Added to your time card"); closeDrawer(); return; }
      const ref=await S.db.collection("log").add({kind:"clock",pending:true,general:type!=="job",where:type==="job"?undefined:type,jobId:type==="job"?jid:"",visitId:type==="job"?vid:"",by:S.me.id,in:pin,out:pout,auto:false,at:now});
      const label=type==="job"?(clientOf(S.jobs.get(jid)||{}).name||"Job"):type==="shop"?"Shop":"Driving";
      await S.db.collection("log").add({kind:"timereq",status:"pending",target:ref.id,isNew:true,propIn:pin,propOut:pout,reason:why,by:S.me.id,at:now,
        summary:`Add ${label} ${fmtDay(day)} ${tfmt(pin)}–${tfmt(pout)}`});
    }
    toast("Sent. A manager will approve it."); closeDrawer();
  }catch(x){ fail(x,"send the request"); }
}
function reqBlock(){
  if(!S.me.manage) return "";
  const P=pendingReqs(); if(!P.length) return "";
  return `<h2 class="h-sec" style="margin-top:14px">Time fix requests · ${P.length}</h2><div class="rows">${P.map(r=>{ const t=S.log.get(r.target);
    return `<div class="row svc" style="cursor:default">${avatar(r.by)}<span class="m"><span class="n">${esc(staffName(r.by))}${r.by===S.me.id?" (you)":""}</span>
      <span class="s"><b>${esc(r.summary||"")}</b><br>“${esc(r.reason||"")}” · ${esc(ago(r.at))}${!t?" · the original time was deleted":""}</span></span>
      <span class="r">${canApprove(r)?`<button type="button" class="btn small amber" data-act="treq-ok" data-v="${esc(r.id)}" ${t?"":"disabled"}>Approve</button><button type="button" class="btn small" data-act="treq-no" data-v="${esc(r.id)}">Deny</button>`:""}</span></div>`; }).join("")}</div>`;
}
async function decideReq(id, ok){
  const r=S.log.get(id); if(!r) return; const t=S.log.get(r.target), now=new Date().toISOString();
  let note="";
  if(!ok){ note=(prompt("Why? (optional, they'll see this)")||"").trim(); }
  try{
    if(ok){
      if(!t){ toast("The original time is gone"); return; }
      if(r.isNew) await S.db.doc("log/"+r.target).update({pending:false,approvedBy:S.me.id,edited:S.me.id,...(r.by===S.me.id?{selfApproved:true}:{})});
      else await S.db.doc("log/"+r.target).update({in:r.propIn,out:r.propOut,edited:S.me.id,fixReq:id});
    } else if(r.isNew && t) await S.db.doc("log/"+r.target).delete();
    await S.db.doc("log/"+id).update({status:ok?"approved":"denied",decidedBy:S.me.id,decidedAt:now,note});
    toast(ok?"Approved. Hours updated.":"Denied");
  }catch(x){ fail(x,ok?"approve it":"deny it"); }
}
