/* ---------- Week: work done/left for the week, and (Raul only) pay for the week ---------- */
function weekWork(days){
  const st=days.flatMap(d=>stopsFor(d,"all").map(s=>({...s,d}))), price=s=>(+((S.fin.get(s.j.id)||{}).price)||0)*dayShare(s.j,s.v);
  const done=st.filter(s=>isDone(s.j.id,s.v.id)), left=st.filter(s=>!isDone(s.j.id,s.v.id)), sum=a=>a.reduce((t,s)=>t+price(s),0), m=S.me.money;
  const pct=st.length?Math.round(done.length/st.length*100):0;
  const tile=(lbl,list,cls)=>`<div class="tw-tile ${cls}"><small>${lbl}</small><b class="mono">${list.length}</b><span>${list.length===1?"stop":"stops"}${m&&sum(list)?` · ${money2(sum(list))}`:""}</span></div>`;
  let h=`<section class="dcard tw"><header><span class="eyebrow">This week's work</span><span class="count">${st.length?`${pct}% done`:""}</span></header>
    ${st.length?`<div class="tw-tiles">${tile("Scheduled",st,"")}${tile("Done",done,"ok")}${tile("Left to do",left,"left")}</div><div class="tw-bar"><i style="width:${pct}%"></i></div>`:`<p class="lede">Nothing is scheduled this week.</p>`}</section>`;
  if(isRaul()) h+=myPayWeek(days,st);
  return h;
}
function myPayWeek(days,st){
  const id=S.me.id, set=new Set(days), price=j=>+((S.fin.get(j.id)||{}).price)||0;
  let ms=0, hourly=0; for(const e of S.log.values()) if(e.kind==="clock"&&e.by===id&&e.in&&set.has(isoOf(e.in))){ const x=clockMs(e); ms+=x; hourly+=(x/36e5)*planFor(id,isoOf(e.in)).rate; }
  const first=finishedInstalls();
  const doneWk=[...first.values()].filter(x=>set.has(x.day));
  let mgmt=0, selfN=0, jobPay=0; for(const x of doneWk){ const pl=planFor(id,x.day), pc=feePct(pl,x.j); mgmt+=price(x.j)*pc/100; if(pc&&pc!==pl.mgmtPct) selfN++; if(pl.jobPct) jobPay+=price(x.j)*techPct(id,x.j,x.v,x.day)/100; }
  const sales=allSales().filter(s=>s.by===id&&set.has(s.earnedOn)), comm=sales.reduce((t,s)=>t+s.comm,0);
  const earned=hourly+mgmt+jobPay+comm;
  const open=st.filter(s=>s.v.type==="install"&&!s.v.returnOf&&!isDone(s.j.id,s.v.id)&&!first.has(s.j.id));
  const moreMgmt=open.reduce((t,s)=>t+price(s.j)*payShare(s.j,s.v)*feePct(planFor(id,s.d),{id:s.j.id})/100,0);
  const moreComm=open.map(s=>saleOf({id:s.j.id,...s.j})).filter(s=>s&&s.by===id&&commWhen()!=="sold").reduce((t,s)=>t+s.comm,0);
  // by day
  const byDay=days.map(d=>{ const dd=doneWk.filter(x=>x.day===d).reduce((t,x)=>t+price(x.j)*feePct(planFor(id,d),x.j)/100,0)+sales.filter(s=>s.earnedOn===d).reduce((t,s)=>t+s.comm,0); const od=open.filter(s=>s.d===d).reduce((t,s)=>t+price(s.j)*payShare(s.j,s.v)*feePct(planFor(id,d),{id:s.j.id})/100,0); return {d,dd,od}; });
  const mx=Math.max(1,...byDay.map(x=>x.dd+x.od));
  const line=(l,v)=>v?`<div><small>${l}</small><b class="mono">${money2(v)}</b></div>`:"";
  return `<section class="dcard tw-me"><header><span class="eyebrow">Your pay this week · only you see this</span><button type="button" class="linkbtn" data-act="today-go" data-v="payroll">Payroll</button></header>
    <div class="tw-pay"><div class="tw-big"><small>Earned so far this week</small><b>${money2(earned)}</b></div><div class="tw-big"><small>If everything left this week gets done</small><b>${money2(earned+moreMgmt+moreComm)}</b></div></div>
    <div class="wk-pay">${byDay.map(x=>`<button type="button" class="wkp" data-act="go-day" data-v="${x.d}"><span class="bars"><i class="done" style="height:${x.dd/mx*100}%"></i><i class="left" style="height:${x.od/mx*100}%"></i></span><small>${esc(fmtDay(x.d,{weekday:"short"}))}</small><b class="mono">${x.dd+x.od?money0(x.dd+x.od):"–"}</b></button>`).join("")}</div>
    <div class="dmoney">${line(`Management &amp; install fee · ${doneWk.length} install${doneWk.length===1?"":"s"} done${selfN?` (${selfN} you were on: 10%, or 3% + your share of 7%)`:""}`,mgmt)}${line("Job %",jobPay)}${line(`Hours · ${h1(ms/36e5)} hrs`,hourly)}${line(`Sales commission · ${sales.length} sale${sales.length===1?"":"s"}`,comm)}${line(`Still to earn · ${open.length} install${open.length===1?"":"s"} left this week`,moreMgmt)}${line("Commission on your sales still to install",moreComm)}</div></section>`;
}
