
/* ---------- day clock: shop + driving time between jobs ----------
   General clock runs from arriving at the shop, pauses while you're clocked in at a job,
   and picks back up when you leave the job. It ends when you leave the shop after the day's stops. */
function myOpenGeneral(){ for(const [id,e] of S.log) if(e.kind==="clock"&&e.general&&e.by===S.me.id&&!e.out) return {id,...e}; return null; }
function myToday(){ const t=todayISO(), out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&e.by===S.me.id&&e.in&&isoOf(e.in)===t) out.push({id,...e}); return out; }
const dayStarted = () => myToday().length>0;
const dayEnded = () => myToday().some(e=>e.endDay);
async function startGeneral(where,auto){
  if(myOpenGeneral()||myOpenClock()||dayEnded()) return;
  const now=new Date().toISOString();
  try{ await S.db.collection("log").add({kind:"clock",general:true,where,jobId:"",visitId:"",by:S.me.id,in:now,out:null,auto:!!auto,at:now}); if(where==="shop") toast(auto?"Clocked in at the shop. Have a good day!":"Day started"); }
  catch(e){ fail(e,"start your day"); }
}
async function stopGeneral(endDay,auto){
  const g=myOpenGeneral(); if(!g){ if(endDay&&dayStarted()&&!dayEnded()){ const last=myToday().sort((a,b)=>String(b.in).localeCompare(String(a.in)))[0]; if(last) await S.db.doc("log/"+last.id).update({endDay:true}); toast("Day ended"); } return; }
  try{ await S.db.doc("log/"+g.id).update({out:new Date().toISOString(),autoOut:!!auto,...(endDay?{endDay:true}:{})}); if(endDay) toast(auto?"Clocked out for the day. Get home safe!":"Day ended"); }
  catch(e){ fail(e,"clock out"); }
}
const resumeGeneral = auto => { if(dayStarted()&&!dayEnded()&&!myOpenClock()) return startGeneral("travel",auto); };
function dayBtn(){
  if(!S.me.canLog) return "";
  const g=myOpenGeneral(), j=myOpenClock(), ms=myToday().reduce((t,c)=>t+clockMs(c),0);
  if(dayEnded()) return `<span class="chip" style="cursor:default">Day done · ${fmtDur(ms)}</span>`;
  if(!dayStarted()) return `<button type="button" class="chip" data-act="day-start">Start my day</button>`;
  return `<button type="button" class="chip" data-act="day-end" title="${g?(g.where==="shop"?"At the shop":"Driving"):j?"On a job":""}">${g?(g.where==="shop"?"At shop":"Driving"):j?"On a job":"Clocked in"} · ${fmtDur(ms)} · End day</button>`;
}
