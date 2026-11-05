/* ---------- Pay plan picker on Add / Edit person (money people) ---------- */
const PAY_KINDS=[["tech","Tech: hourly + % of installs (split with other techs)"],["hourly","Hourly only"],["pct","% of installs they do (split by crew when shared)"],["mgmt","Management: % of every job + extra on own installs"],["none","Not paid through the board"]];
function payKindOf(pl){ if(pl.mgmtPct>0) return "mgmt"; if(pl.jobPct>0&&pl.pctSplit==="crew") return "pct"; if(pl.jobPct>0) return "tech"; if(pl.rate>0) return "hourly"; return "none"; }
function payPickUI(p){
  if(!S.me.money) return "";
  const cur=p.id?planFor(p.id,todayISO()):{rate:0,jobPct:0,mgmtPct:0}, F=S.form.pay||(S.form.pay={kind:p.id?payKindOf(cur):"tech",rate:cur.rate||20,jobPct:cur.jobPct||4,mgmtPct:cur.mgmtPct||3,selfLabor:cur.selfLabor!=null?cur.selfLabor:SELF_LABOR,from:monday(todayISO())});
  const num=(k,v,suf,pre)=>`<label class="pp-num">${pre||""}<input id="pay-${k}" inputmode="decimal" value="${esc(String(v))}">${suf}</label>`;
  const body=F.kind==="tech"?`${num("rate",F.rate,"/hr","$")} + ${num("jobPct",F.jobPct,"% of each job they install")}<small>Techs on the same job split the % evenly.</small>`
    :F.kind==="hourly"?`${num("rate",F.rate,"/hr","$")}<small>Paid for every clocked hour, no job %.</small>`
    :F.kind==="pct"?`${num("jobPct",F.jobPct,"% of each job they install")}<small>Full % when their crew does the job alone; split by the number of crews when shared. No hourly.</small>`
    :F.kind==="mgmt"?`${num("mgmtPct",F.mgmtPct,"% of every job")} + ${num("selfLabor",F.selfLabor,"% more on jobs they install themselves")}<small>The extra is split by crew when other crews help.</small>`
    :`<small>Their hours and jobs still show on the board, but payroll shows $0.</small>`;
  return `<fieldset id="payPick"><legend>Pay plan</legend><div class="seg seg-wrap" role="group">${PAY_KINDS.map(([k,l])=>`<button type="button" data-act="pay-kind" data-v="${k}" aria-pressed="${F.kind===k}">${esc(l.split(":")[0].split(" (")[0])}</button>`).join("")}</div>
    <p class="count" style="margin:6px 0">${esc((PAY_KINDS.find(x=>x[0]===F.kind)||[])[1]||"")}</p><div class="pp-row">${body}</div>
    <div class="f" style="margin-top:8px"><label for="pay-from">Starts</label><input id="pay-from" type="date" value="${esc(F.from)}"><small>Pay weeks start on Monday. Earlier weeks keep the old plan.</small></div></fieldset>`;
}
function readPayPick(){
  if(!S.me.money||!S.form.pay) return null; const F=S.form.pay, g=k=>{ const el=document.getElementById("pay-"+k); return el?Number(String(el.value).replace(/[^0-9.]/g,""))||0:null; };
  for(const k of ["rate","jobPct","mgmtPct","selfLabor"]){ const v=g(k); if(v!=null) F[k]=v; } const fr=document.getElementById("pay-from"); if(fr&&fr.value) F.from=fr.value;
  const plan={from:F.from||monday(todayISO()), rate:0, jobPct:0, mgmtPct:0};
  if(F.kind==="tech"){ plan.rate=F.rate; plan.jobPct=F.jobPct; }
  else if(F.kind==="hourly") plan.rate=F.rate;
  else if(F.kind==="pct"){ plan.jobPct=F.jobPct; plan.pctSplit="crew"; }
  else if(F.kind==="mgmt"){ plan.mgmtPct=F.mgmtPct; plan.selfLabor=F.selfLabor; }
  return plan;
}
async function writePlan(id, plan){
  const rates={...(S.payroll.rates||{})}, r={...(rates[id]||{})}; r.plans=[...(r.plans||[]).filter(p=>p.from!==plan.from), plan].sort((a,b)=>a.from.localeCompare(b.from)); rates[id]=r;
  await S.db.doc("fin/payroll").set({...S.payroll,rates});
}
/* the Payroll → Pay plans editor keeps a plan's split rule and extra % when you change the numbers there */
savePlan = async function(id){
  const g=k=>{ const el=document.querySelector(`[data-plan="${id}"][data-k="${k}"]`); return el?el.value:""; }, n=v=>Number(String(v).replace(/[^0-9.]/g,""))||0;
  const from=g("from")||monday(isoOf(new Date().toISOString())), prev=planFor(id,from);
  const plan={from, rate:n(g("rate")), jobPct:n(g("jobPct")), mgmtPct:n(g("mgmtPct")), ...(prev.pctSplit?{pctSplit:prev.pctSplit}:{}), ...(prev.selfLabor!=null?{selfLabor:prev.selfLabor}:{})};
  try{ await writePlan(id,plan); toast(`${staffName(id)}: ${planText(plan)} from ${fmtDay(plan.from)}`); }catch(e){ fail(e,"save that pay plan"); }
};
