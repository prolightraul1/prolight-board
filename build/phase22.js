/* ---------- pay plans: hourly + % of jobs completed + management fee, with start dates ---------- */
// fin/payroll.rates[id] = { rate, ot, plans:[{from:"YYYY-MM-DD", rate, jobPct, mgmtPct}] }
function planFor(id, day){
  const r=(S.payroll.rates||{})[id]||{}, base={from:"", rate:+r.rate||0, jobPct:0, mgmtPct:0};
  const ps=(r.plans||[]).filter(p=>p.from&&p.from<=day).sort((a,b)=>a.from.localeCompare(b.from));
  return ps.length?{...base,...ps[ps.length-1]}:base;
}
const nextPlan = id => ((S.payroll.rates||{})[id]?.plans||[]).filter(p=>p.from>monday(isoOf(new Date().toISOString()))).sort((a,b)=>a.from.localeCompare(b.from))[0]||null;
// your % on a job: the management fee, or the self-install rate when you put it in yourself
const SELF_PCT = 10;
// on the "Raul" crew counts as installed yourself, unless you switched it off on that job
const onRaulCrew = j => { const jj={id:j.id,...(S.jobs.get(j.id)||j)}, ins=(jj.visits||[]).filter(v=>v.type==="install"), ids=[normCrew(jj.crew),...ins.flatMap(v=>visitCrews(jj,v))].filter(Boolean); return ids.some(id=>/\braul\b/i.test((crewsAll().find(c=>c.id===id)||{}).name||"")); };
const isSelf = j => { const f=S.fin.get(j.id)||{}; return f.selfInstall===true || (f.selfInstall!==false && onRaulCrew(j)); };
/* Raul: 3% management on every job. Installing it himself: 10%. Sharing the install with other crews: the 3% stays,
   the extra 7% for the labor is split by the number of crews on the job (2 crews → 6.5%, 3 crews → 5.33%). */
const jobCrews = j => { const jj={id:j.id,...(S.jobs.get(j.id)||j)}, ins=(jj.visits||[]).filter(v=>v.type==="install"); return [...new Set((ins.length?ins.flatMap(v=>visitCrews(jj,v)):[normCrew(jj.crew)]).filter(Boolean))]; };
const feePct = (pl, j) => { if(!(pl.mgmtPct>0)) return 0; const f=S.fin.get(j.id)||{}, self=pl.selfPct||SELF_PCT;
  if(f.selfInstall===true) return self; if(!isSelf(j)) return pl.mgmtPct;
  const n=Math.max(1,jobCrews(j).length); return n===1 ? self : Math.round((pl.mgmtPct+(self-pl.mgmtPct)/n)*100)/100; };
/* techs: the job's 4% is split evenly across every tech who worked it (any crew) */
function techPct(id,j,v,day){ const pl=planFor(id,day); if(!(pl.jobPct>0)) return 0; const w=jobWorkers(j,v,day).filter(x=>planFor(x,day).jobPct>0); return w.includes(id) ? pl.jobPct/w.length : 0; }
/* multi-day installs: the job's value is split across its install days, and it pays once, when the last day is checked off */
const instVisits = j => (j.visits||[]).filter(v=>v.type==="install"&&!v.returnOf);
const dayShare = (j,v) => (v&&v.type==="install"&&!v.returnOf) ? 1/Math.max(1,instVisits(j).length) : 0;
/* pay lands on the last install day, so projections count the whole job there and nothing on earlier days */
const payShare = (j,v) => { const iv=instVisits(j); if(iv.length<=1) return 1; const last=[...iv].sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999"))).pop(); return v.id===last.id?1:0; };
function finishedInstalls(){
  const out=new Map(), firstDone=new Map();
  for(const e of [...S.log.values()].filter(e=>e.kind==="done"&&e.at).sort((a,b)=>a.at.localeCompare(b.at))){ const j0=S.jobs.get(e.jobId); if(!j0) continue; const v=(j0.visits||[]).find(x=>x.id===e.visitId)||{}; if(v.type==="takedown"||firstDone.has(e.jobId)) continue; firstDone.set(e.jobId,{e,v}); }
  for(const [jid,f] of firstDone){
    const j={id:jid,...S.jobs.get(jid)}, iv=instVisits(j);
    if(iv.length<=1){ out.set(jid,{j,v:f.v,day:isoOf(f.e.at)}); continue; }
    let last=null, ok=true;
    for(const v of iv){ const d=doneMap.get(jid+"|"+v.id)||(j.visits||[]).filter(x=>x.returnOf===v.id).map(x=>doneMap.get(jid+"|"+x.id)).find(Boolean); if(!d||!d.at){ ok=false; break; } if(!last||d.at>last.at) last={at:d.at,v}; }
    if(ok&&last) out.set(jid,{j,v:last.v,day:isoOf(last.at)});
  }
  return out;
}
const jobBase = j => +((S.fin.get(j.id)||{}).price)||0; // full job price, TCL jobs included
// who did the install: anyone clocked in on the job; if nobody, the crew on that visit
function jobWorkers(j,v,day){
  const clocked=new Set(); for(const e of S.log.values()) if(e.kind==="clock"&&!e.general&&e.jobId===j.id&&e.by) clocked.add(e.by);
  if(clocked.size) return [...clocked];
  const ins=(j.visits||[]).filter(x=>x.type==="install"), cs=[...new Set((ins.length?ins:[v||{}]).flatMap(x=>visitCrews(j,x)))]; if(!cs.length) return [];
  return PL.staff().filter(p=>p.active&&cs.includes(normCrew(p.crew))).map(p=>p.id);
}
function payWeek(){
  const days=[...Array(7)].map((_,i)=>addDays(S.week,i)), set=new Set(days);
  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.in&&set.has(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));
  const ppl=new Map(), touch=id=>{ if(!ppl.has(id)) ppl.set(id,{id,ms:0,job:0,gen:0,open:0,days:new Set(),dayMs:{},comm:0,sales:[],jobPay:0,jobs:[],mgmt:0,mgmtJobs:[]}); return ppl.get(id); };
  for(const r of rows){ const p=touch(r.by), m=clockMs(r), d=isoOf(r.in); p.ms+=m; p.dayMs[d]=(p.dayMs[d]||0)+m; r.general?p.gen+=m:p.job+=m; if(!r.out) p.open++; p.days.add(d); }
  for(const s of allSales()) if(s.earnedOn&&set.has(s.earnedOn)&&!s.paidAt){ const p=touch(s.by); p.comm+=s.comm; p.sales.push(s); }
  // installs checked off this week (first check-off of the install visit only, so takedowns don't pay twice)
  const done=[...finishedInstalls().values()].filter(x=>set.has(x.day)).map(x=>({...x,base:jobBase(x.j)}));
  const staff=PL.staff().filter(p=>p.active);
  for(const x of done){
    for(const id of jobWorkers(x.j,x.v,x.day)){ const pc=techPct(id,x.j,x.v,x.day); if(pc>0){ const p=touch(id), amt=Math.round(x.base*pc)/100; p.jobPay+=amt; p.jobs.push({...x,pct:Math.round(pc*100)/100,amt}); } }
    for(const s of staff){ const pl=planFor(s.id,x.day), pc=feePct(pl,x.j); if(pc>0){ const p=touch(s.id), amt=Math.round(x.base*pc)/100; p.mgmt+=amt; p.mgmtJobs.push({...x,pct:pc,amt,self:pc!==pl.mgmtPct}); } }
  }
  for(const id of Object.keys(S.payroll.rates||{})) if(planFor(id,days[6]).rate>0 && (PL.staff().find(x=>x.id===id)||{}).active) touch(id);
  const out=[...ppl.values()].map(p=>{
    // hourly pay day by day, so a plan that starts mid-week is applied from its start date
    let hrs=Math.round(p.ms/36e4)/10, regPay=0; const plan=planFor(p.id,days[6]); const rate=plan.rate;
    for(const [d,ms] of Object.entries(p.dayMs)) regPay+=(ms/36e5)*planFor(p.id,d).rate;
    const noOt=otOff(p.id), avg=hrs?regPay/hrs:rate, reg=noOt?hrs:Math.min(hrs,OT_AFTER), ot=noOt?0:Math.max(0,Math.round((hrs-OT_AFTER)*10)/10);
    regPay=noOt?regPay:reg*avg; const otPay=ot*avg*1.5;
    return {...p, hrs, reg, ot, rate, plan, regPay, otPay, total:regPay+otPay+p.comm+p.jobPay+p.mgmt, name:staffName(p.id), title:(PL.staff().find(x=>x.id===p.id)||{}).title||""}; })
    .sort((a,b)=>a.name.localeCompare(b.name));
  return {days, rows, people:out, done};
}
const planText = pl => [pl.rate>0?`$${pl.rate}/hr`:"", pl.jobPct>0?`${pl.jobPct}% of jobs they complete`:"", pl.mgmtPct>0?`${pl.mgmtPct}% management fee`:""].filter(Boolean).join(" + ")||"No pay set";
function vPayroll(){
  const W=payWeek(), P=W.people, end=W.days[6], tot=P.reduce((t,p)=>t+p.total,0), sum=k=>P.reduce((t,p)=>t+p[k],0);
  const warn=[...P.filter(p=>p.open).map(p=>`${p.name} has ${p.open} open clock-in${p.open>1?"s":""} (never clocked out)`), ...P.filter(p=>!p.plan.rate&&!p.plan.jobPct&&!p.plan.mgmtPct&&p.hrs).map(p=>`${p.name} has no pay set`)];
  let h=`<div class="bar" style="margin-top:12px"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button><b class="sign grow" style="font-size:22px">Pay week ${fmtDay(S.week)} – ${fmtDay(end)}</b><button type="button" class="btn icon" data-act="week" data-v="7" aria-label="Next week">›</button></div>
    ${warn.length?`<div class="note">${warn.map(esc).join("<br>")}<br><small>Fix times in Office → Hours (tap a row) before sending.</small></div>`:""}
    <div class="mhero" style="margin-top:12px"><span class="eyebrow">Payroll this week</span><div class="mhero-v">${money2(tot)}</div><span>${h1(sum("hrs"))} hours · ${W.done.length} install${W.done.length===1?"":"s"} finished · ${P.length} people</span></div>`;
  if(!P.length) return h+`<div class="empty"><h3>Nothing to pay this week</h3><p>Hours come from clock-ins. Job pay and management fees come from installs checked off this week.</p></div>`+rateList();
  h+=`<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Person</th><th class="r">Hours</th><th class="r">OT</th><th class="r">Hourly pay</th><th class="r">Job %</th><th class="r">Mgmt fee</th><th class="r">Sales</th><th class="r">Total</th></tr></thead><tbody>
    ${P.map(p=>`<tr><td><b>${esc(p.name)}</b><br><small class="count">${esc(planText(p.plan))}</small></td>
      <td class="r">${h1(p.hrs)}</td><td class="r">${p.ot?h1(p.ot):"–"}</td><td class="r">${p.regPay+p.otPay?money2(p.regPay+p.otPay):"–"}</td>
      <td class="r">${p.jobPay?`${money2(p.jobPay)}<br><small class="count">${p.jobs.length} job${p.jobs.length>1?"s":""}</small>`:"–"}</td><td class="r">${p.mgmt?`${money2(p.mgmt)}<br><small class="count">${p.mgmtJobs.length} job${p.mgmtJobs.length>1?"s":""}</small>`:"–"}</td>
      <td class="r">${p.comm?money2(p.comm):"–"}</td><td class="r"><b>${money2(p.total)}</b></td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td class="r"><b>${h1(sum("hrs"))}</b></td><td class="r">${h1(sum("ot"))}</td><td class="r">${money2(P.reduce((t,p)=>t+p.regPay+p.otPay,0))}</td><td class="r">${money2(sum("jobPay"))}</td><td class="r">${money2(sum("mgmt"))}</td><td class="r">${money2(sum("comm"))}</td><td class="r"><b>${money2(tot)}</b></td></tr></tfoot></table></div>
    ${W.done.length?`<details style="margin-top:10px"><summary class="count" style="cursor:pointer">Installs finished this week (${W.done.length})</summary><div class="tbl"><table><thead><tr><th>Customer</th><th>Done</th><th class="r">Job price</th><th>Paid to</th></tr></thead><tbody>${W.done.map(x=>{ const to=P.filter(p=>p.jobs.some(y=>y.j.id===x.j.id)).map(p=>p.name); return `<tr><td>${esc(clientOf(x.j).name||"")} ${label(x.j)?`<small class="count">${esc(label(x.j))}</small>`:""}</td><td>${esc(fmtDay(x.day))}</td><td class="r">${money2(x.base)}</td><td>${to.length?esc(to.join(", ")):`<small class="count">No technician on it${normCrew(x.v.crew||x.j.crew)?"":" (no crew)"}</small>`}</td></tr>`; }).join("")}</tbody></table></div></details>`:""}
    <div class="bar" style="margin-top:10px"><button type="button" class="btn amber" data-act="pay-csv">Download weekly payroll (CSV)</button><button type="button" class="btn" data-act="pay-print">Print / save PDF</button><button type="button" class="btn" data-act="pay-detail">Time detail (CSV)</button>
      ${P.some(p=>p.comm)?`<button type="button" class="btn" data-act="pay-commpaid">Mark this week's sales commissions paid</button>`:""}</div>
    <p class="count" style="font-size:13px">Job % and management fees count in the week the install is checked off, on the full job price (TCL jobs too, not just ProLight's share). Job % goes to everyone clocked in on the job, or the crew on it if nobody clocked in. Sales commission shows in the week the job was ${commWhen()==="sold"?"sold":"installed"}, until marked paid.</p>`;
  return h+rateList();
}
function rateList(){
  const ppl=PL.staff().filter(p=>p.active), today=isoOf(new Date().toISOString());
  return `<h2 class="h-sec" style="margin-top:18px">Pay plans</h2><div class="rows">${ppl.map(p=>{ const cur=planFor(p.id,today), nx=nextPlan(p.id), r=(S.payroll.rates||{})[p.id]||{};
    return `<div class="row pay-row" style="cursor:default;flex-wrap:wrap">${avatar(p.id)}<span class="m"><span class="n">${esc(p.name)}</span><span class="s">Now: ${esc(planText(cur))}${nx?` · from ${esc(fmtDay(nx.from))}: ${esc(planText(nx))}`:""}</span></span>
      <span class="r pay-ed"><input class="search" type="date" data-plan="${esc(p.id)}" data-k="from" value="${esc((nx||cur).from||monday(isoOf(new Date().toISOString())))}" aria-label="Starts" style="width:140px;min-height:34px">
        <label>$<input class="search" data-plan="${esc(p.id)}" data-k="rate" inputmode="decimal" value="${(nx||cur).rate||""}" placeholder="0" style="width:60px;min-height:34px;text-align:right">/hr</label>
        <label><input class="search" data-plan="${esc(p.id)}" data-k="jobPct" inputmode="decimal" value="${(nx||cur).jobPct||""}" placeholder="0" style="width:50px;min-height:34px;text-align:right">% jobs</label>
        <label><input class="search" data-plan="${esc(p.id)}" data-k="mgmtPct" inputmode="decimal" value="${(nx||cur).mgmtPct||""}" placeholder="0" style="width:50px;min-height:34px;text-align:right">% mgmt</label>
        <select class="search ot-in" data-ot-for="${esc(p.id)}" aria-label="Overtime for ${esc(p.name)}" style="width:auto;min-height:34px;font-size:13px"><option value="1" ${otOff(p.id)?"":"selected"}>OT after ${OT_AFTER}</option><option value="0" ${otOff(p.id)?"selected":""}>No OT (1099)</option></select>
        <button type="button" class="btn small" data-act="plan-save" data-v="${esc(p.id)}">Save</button></span></div>`; }).join("")}</div>
    <p class="count" style="font-size:13px">Set the start date to when the new pay begins. Weeks before that keep the old pay. Sales commission is set on each sale. Only people with money access can see this.</p>`;
}
async function savePlan(id){
  const g=k=>{ const el=document.querySelector(`[data-plan="${id}"][data-k="${k}"]`); return el?el.value:""; }, n=v=>Number(String(v).replace(/[^0-9.]/g,""))||0;
  const plan={from:g("from")||monday(isoOf(new Date().toISOString())), rate:n(g("rate")), jobPct:n(g("jobPct")), mgmtPct:n(g("mgmtPct"))};
  const rates={...(S.payroll.rates||{})}, r={...(rates[id]||{})}; r.plans=[...(r.plans||[]).filter(p=>p.from!==plan.from), plan].sort((a,b)=>a.from.localeCompare(b.from)); rates[id]=r;
  try{ await S.db.doc("fin/payroll").set({...S.payroll,rates}); toast(`${staffName(id)}: ${planText(plan)} from ${fmtDay(plan.from)}`); }catch(e){ fail(e,"save that pay plan"); }
}
function payCsv(){
  const W=payWeek(), end=W.days[6], P=W.people, f=n=>(+n||0).toFixed(2);
  const rows=[["ProLight Tallahassee payroll"],["Pay week",`${S.week} to ${end}`],[],
    ["Employee","Pay plan","Total hours","Overtime hours","Hourly pay","Job % pay","Jobs","Management fee","Sales commission","Total pay"],
    ...P.map(p=>[p.name,planText(p.plan),h1(p.hrs),h1(p.ot),f(p.regPay+p.otPay),f(p.jobPay),p.jobs.length,f(p.mgmt),f(p.comm),f(p.total)]),
    [],["Total","",h1(P.reduce((t,p)=>t+p.hrs,0)),h1(P.reduce((t,p)=>t+p.ot,0)),f(P.reduce((t,p)=>t+p.regPay+p.otPay,0)),f(P.reduce((t,p)=>t+p.jobPay,0)),"",f(P.reduce((t,p)=>t+p.mgmt,0)),f(P.reduce((t,p)=>t+p.comm,0)),f(P.reduce((t,p)=>t+p.total,0))]];
  const jl=P.flatMap(p=>[...p.jobs.map(x=>[p.name,"Job %",clientOf(x.j).name||"",x.j.source==="tcl"?"TCL":"ProLight",x.day,f(x.base),x.pct,f(x.amt)]),...p.mgmtJobs.map(x=>[p.name,x.self?"Installed it myself":"Management fee",clientOf(x.j).name||"",x.j.source==="tcl"?"TCL":"ProLight",x.day,f(x.base),x.pct,f(x.amt)])]);
  if(jl.length) rows.push([],["Job pay detail"],["Employee","Type","Customer","Job","Finished","Job price","%","Pay"],...jl);
  const cs=P.flatMap(p=>p.sales.map(s=>[p.name,clientOf(s.job).name||"",leadLabel(s.type),f(s.base),s.pct,f(s.comm)]));
  if(cs.length) rows.push([],["Sales commissions"],["Employee","Customer","Lead","Job amount","%","Commission"],...cs);
  download(`ProLight-payroll-${S.week}.csv`, rows);
}
function payPrint(){
  const W=payWeek(), P=W.people, w=window.open("","_blank"); if(!w){ toast("Allow pop-ups to print"); return; } const s=k=>P.reduce((t,p)=>t+p[k],0);
  w.document.write(`<!doctype html><meta charset="utf-8"><title>ProLight payroll ${esc(S.week)}</title><style>body{font:13px system-ui,sans-serif;margin:32px;color:#111}h1{margin:0 0 4px}h2{margin:22px 0 0;font-size:15px}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border-bottom:1px solid #ccc;padding:5px 7px;text-align:right}th:first-child,td:first-child{text-align:left}tfoot td{font-weight:700;border-top:2px solid #111}small{color:#666}</style>
    <h1>ProLight Tallahassee payroll</h1><div>Pay week ${esc(fmtDay(S.week,{month:"long",day:"numeric"}))} – ${esc(fmtDay(W.days[6],{month:"long",day:"numeric",year:"numeric"}))}</div>
    <table><thead><tr><th>Employee</th><th>Hours</th><th>OT</th><th>Hourly</th><th>Job %</th><th>Mgmt fee</th><th>Sales</th><th>Total</th></tr></thead><tbody>
    ${P.map(p=>`<tr><td>${esc(p.name)}<br><small>${esc(planText(p.plan))}</small></td><td>${h1(p.hrs)}</td><td>${p.ot?h1(p.ot):"–"}</td><td>${money2(p.regPay+p.otPay)}</td><td>${p.jobPay?money2(p.jobPay):"–"}</td><td>${p.mgmt?money2(p.mgmt):"–"}</td><td>${p.comm?money2(p.comm):"–"}</td><td><b>${money2(p.total)}</b></td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td>${h1(s("hrs"))}</td><td></td><td>${money2(P.reduce((t,p)=>t+p.regPay+p.otPay,0))}</td><td>${money2(s("jobPay"))}</td><td>${money2(s("mgmt"))}</td><td>${money2(s("comm"))}</td><td>${money2(s("total"))}</td></tr></tfoot></table>
    ${W.done.length?`<h2>Installs finished this week</h2><table><thead><tr><th>Customer</th><th>Finished</th><th>Job price</th></tr></thead><tbody>${W.done.map(x=>`<tr><td>${esc(clientOf(x.j).name||"")}${x.j.source==="tcl"?" (TCL)":""}</td><td>${esc(fmtDay(x.day))}</td><td>${money2(x.base)}</td></tr>`).join("")}</tbody></table>`:""}
    <p><small>Hours from board clock-ins. Job % and management fees on installs checked off this week, figured on the full job price. Prepared ${esc(new Date().toLocaleString("en-US"))}.</small></p><script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
}
