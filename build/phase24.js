/* ---------- Today: how much work is scheduled, done and left; and (Raul only) what he makes today ---------- */
const isRaul = () => { const me=PL.me&&PL.me(); return !!(me&&S.me&&me.id===S.me.id&&/^raul\b/i.test(String(me.name||"").trim())); };
function todayWork(d){
  const st=stopsFor(d,"all"), price=s=>(+((S.fin.get(s.j.id)||{}).price)||0)*dayShare(s.j,s.v);
  const done=st.filter(s=>isDone(s.j.id,s.v.id)), left=st.filter(s=>!isDone(s.j.id,s.v.id)), sum=a=>a.reduce((t,s)=>t+price(s),0);
  const pct=st.length?Math.round(done.length/st.length*100):0, m=S.me.money;
  const tile=(lbl,list,cls)=>`<div class="tw-tile ${cls}"><small>${lbl}</small><b class="mono">${list.length}</b><span>${list.length===1?"stop":"stops"}${m&&sum(list)?` · ${money2(sum(list))}`:""}</span></div>`;
  let h=`<section class="dcard dc-wide tw"><header><span class="eyebrow">Today's work</span><span class="count">${st.length?`${pct}% done`:""}</span></header>
    ${st.length?`<div class="tw-tiles">${tile("Scheduled",st,"")}${tile("Done",done,"ok")}${tile("Left to do",left,"left")}</div>
    <div class="tw-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <div class="tw-crews">${crews().map(c=>{ const cs=stopsFor(d,c.id); if(!cs.length) return ""; const cd=cs.filter(s=>isDone(s.j.id,s.v.id)).length; return `<span><span class="dot" style="background:${crewColor(c.id)||"var(--ink-2)"}"></span>${esc(c.name)} <b class="mono">${cd}/${cs.length}</b></span>`; }).join("")}</div>`
    :`<p class="lede">Nothing is scheduled today.</p>`}</section>`;
  if(isRaul()) h+=myPayToday(d,st);
  return h;
}
function myPayToday(d,st){
  const id=S.me.id, pl=planFor(id,d), price=j=>+((S.fin.get(j.id)||{}).price)||0;
  // hours today
  let ms=0; for(const e of S.log.values()) if(e.kind==="clock"&&e.by===id&&e.in&&isoOf(e.in)===d) ms+=clockMs(e);
  const hourly=(ms/36e5)*pl.rate;
  // installs whose first check-off is today
  const first=finishedInstalls();
  const doneToday=[...first.values()].filter(x=>x.day===d);
  const mgmt=doneToday.reduce((t,x)=>t+price(x.j)*feePct(pl,x.j)/100,0), selfN=doneToday.filter(x=>feePct(pl,x.j)!==pl.mgmtPct).length;
  const jobPay=pl.jobPct?doneToday.reduce((t,x)=>t+price(x.j)*techPct(id,x.j,x.v,d)/100,0):0;
  const sales=allSales().filter(s=>s.by===id&&s.earnedOn===d);
  const comm=sales.reduce((t,s)=>t+s.comm,0);
  const earned=hourly+mgmt+jobPay+comm;
  // still possible today: installs on today's schedule that haven't been checked off before
  const open=st.filter(s=>s.v.type==="install"&&!s.v.returnOf&&!isDone(s.j.id,s.v.id)&&!first.has(s.j.id));
  const moreMgmt=open.reduce((t,s)=>t+price(s.j)*payShare(s.j,s.v)*feePct(pl,{id:s.j.id})/100,0);
  const moreComm=open.map(s=>saleOf({id:s.j.id,...s.j})).filter(s=>s&&s.by===id&&commWhen()!=="sold").reduce((t,s)=>t+s.comm,0);
  const line=(l,v)=>v?`<div><small>${l}</small><b class="mono">${money2(v)}</b></div>`:"";
  return `<section class="dcard dc-wide tw-me"><header><span class="eyebrow">Your pay today · only you see this</span><button type="button" class="linkbtn" data-act="today-go" data-v="payroll">Payroll</button></header>
    <div class="tw-pay"><div class="tw-big"><small>Earned so far</small><b>${money2(earned)}</b></div><div class="tw-big"><small>If everything left today gets done</small><b>${money2(earned+moreMgmt+moreComm)}</b></div></div>
    <div class="dmoney">${line(`Management &amp; install fee · ${doneToday.length} install${doneToday.length===1?"":"s"} done${selfN?` (${selfN} you were on: 13%, or 3% + your share of 10%)`:` at ${pl.mgmtPct}%`}`,mgmt)}${line(`Job % · ${pl.jobPct}%`,jobPay)}${line(`Hours · ${h1(ms/36e5)} hrs at $${pl.rate}/hr`,hourly)}${line(`Sales commission · ${sales.length} sale${sales.length===1?"":"s"}`,comm)}
      ${line(`Still to earn on ${open.length} install${open.length===1?"":"s"} left`,moreMgmt)}${line("Commission on your sales still to install",moreComm)}</div>
    ${!pl.rate&&!pl.mgmtPct&&!pl.jobPct?`<p class="count">Set your pay in Office → Payroll → Pay plans.</p>`:""}</section>`;
}
