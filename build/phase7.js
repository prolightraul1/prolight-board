
/* ---------- commission on jobs you sell ---------- */
S.payroll = S.payroll || {};
const LEADS = [["inbound","Inbound lead"],["outbound","Outbound lead"],["custom","Custom"]];
const commRate = t => t==="inbound" ? (+S.finSet.commIn||10) : t==="outbound" ? (+S.finSet.commOut||14) : null;
const commWhen = () => S.finSet.commWhen||"installed";
const leadLabel = t => t==="referral" ? "Referral" : (LEADS.find(l=>l[0]===t)||[,""])[1];
/* only Raul, Jarrod and Brayden sell jobs; anyone can get referral pay, added by a manager */
const sellers = () => PL.staff().filter(p=>p.active && (p.can_manage || /^(raul|jarrod|brayden)\b/i.test(p.name||"")));
function saleOf(j){ const f=S.fin.get(j.id)||{}, s=f.sale; if(!s||!s.by) return null;
  const base = j.source==="tcl" ? split(j,f).incoming : (+f.price||0);
  const pct = s.type==="custom" ? (+s.pct||0) : commRate(s.type);
  const inst = installedOn(j), earnedOn = commWhen()==="sold" ? isoOf(s.at||new Date().toISOString()) : inst;
  return {...s, key:"sale", pct, base, comm: Math.round(base*pct)/100, installed: inst, earnedOn, job:j}; }
function refOf(j){ const f=S.fin.get(j.id)||{}, s=f.referral; if(!s||!s.by) return null;
  const base = j.source==="tcl" ? split(j,f).incoming : (+f.price||0), pct=+s.pct||0;
  const inst = installedOn(j), earnedOn = commWhen()==="sold" ? isoOf(s.at||new Date().toISOString()) : inst;
  return {...s, key:"referral", type:"referral", pct, base, comm: Math.round(base*pct)/100, installed: inst, earnedOn, job:j}; }
const allSales = () => jobsArr().filter(j=>j.stage!=="cancelled").flatMap(j=>[saleOf(j),refOf(j)]).filter(Boolean);
const q = v => `"${String(v??"").replace(/"/g,'""')}"`;
function download(name, rows){ const blob=new Blob(["﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }
const staffName = id => (PL.staff().find(p=>p.id===id)||{}).name || who(id);

function vSales(){
  const S2=allSales(), sellers=[...new Set(S2.map(s=>s.by))], cur=S.salesBy && (S.salesBy==="all"||sellers.includes(S.salesBy)) ? S.salesBy : (sellers.includes(S.me.id)?S.me.id:"all");
  const list=S2.filter(s=>cur==="all"||s.by===cur).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const sum=(a,f)=>a.reduce((t,x)=>t+f(x),0), earned=list.filter(s=>s.earnedOn), paid=list.filter(s=>s.paidAt);
  let h=`<div class="bar" style="margin-top:12px"><div class="chips grow">${[["all","Everyone"],...sellers.map(id=>[id,staffName(id)])].map(([k,l])=>`<button type="button" class="chip" data-act="sales-by" data-v="${esc(k)}" aria-pressed="${cur===k}">${esc(l)}</button>`).join("")}</div>
    <button type="button" class="btn amber" data-act="sale-pick">+ Record a sale</button></div>
  <div class="mgrid" style="margin-top:12px">
    <section class="mcard"><span class="eyebrow">Sold</span><div class="mbig">${money2(sum(list,s=>s.base))}</div><span class="count">${list.length} job${list.length===1?"":"s"}</span></section>
    <section class="mcard"><span class="eyebrow">Commission earned</span><div class="mbig">${money2(sum(earned,s=>s.comm))}</div><span class="count">${money2(sum(list,s=>s.comm))} booked · counts when ${commWhen()==="sold"?"sold":"installed"}</span></section>
    <section class="mcard"><span class="eyebrow">Commission owed</span><div class="mbig">${money2(sum(earned,s=>s.comm)-sum(paid.filter(s=>s.earnedOn),s=>s.comm))}</div><span class="count">${money2(sum(paid,s=>s.comm))} paid out</span></section></div>`;
  if(!list.length) return h+`<div class="empty"><h3>No sales recorded yet</h3><p>Tap <b>Record a sale</b>, pick the job, and choose inbound (${commRate("inbound")}%), outbound (${commRate("outbound")}%) or a custom rate. You can also do it from any job's Money section.</p></div>`;
  h+=`<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Sold</th><th>Customer</th>${cur==="all"?"<th>By</th>":""}<th>Lead</th><th class="r">Price</th><th class="r">%</th><th class="r">Commission</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(s=>`<tr><td>${esc(fmtDay(isoOf(s.at||s.job.createdAt||new Date().toISOString())))}</td><td><button type="button" class="linkbtn" data-act="job" data-id="${esc(s.job.id)}">${esc(clientOf(s.job).name||"Customer")}</button></td>${cur==="all"?`<td>${esc(staffName(s.by))}</td>`:""}
      <td>${esc(leadLabel(s.type))}</td><td class="r">${money2(s.base)}</td><td class="r">${s.pct}%</td><td class="r"><b>${money2(s.comm)}</b></td>
      <td>${s.paidAt?`<span class="st down">Paid ${esc(fmtDay(isoOf(s.paidAt)))}</span>`:s.earnedOn?`<span class="st lit">Earned ${esc(fmtDay(s.earnedOn))}</span>`:`<span class="st booked">Not installed yet</span>`}</td>
      <td><button type="button" class="btn small" data-act="sale-edit" data-v="${esc(s.job.id)}">Edit</button></td></tr>`).join("")}</tbody></table></div>
    <div class="bar" style="margin-top:10px"><button type="button" class="btn" data-act="sales-csv" data-v="${esc(cur)}">Download CSV</button></div>`;
  return h;
}
function dSalePick(){
  const ql=((S.form&&S.form.saleq)||"").toLowerCase();
  const list=jobsArr().filter(j=>j.stage!=="cancelled"&&!((S.fin.get(j.id)||{}).sale||{}).by).filter(j=>!ql||[clientOf(j).name,addrOf(j)].join(" ").toLowerCase().includes(ql))
    .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,40);
  return drawerShell("Record a sale","Which job did you sell?",`<input class="search" id="sale-q" placeholder="Search customer or address" value="${esc((S.form&&S.form.saleq)||"")}" autocomplete="off" style="width:100%">
    <p class="count" style="font-size:13px">New customer? Add the job first with <b>+ New job</b> on Jobs, then record the sale from its Money section.</p>
    <div class="rows">${list.map(j=>`<button type="button" class="row" data-act="sale-edit" data-v="${esc(j.id)}"><span class="bulb ${BULB[status(j)]}"></span><span class="m"><span class="n">${esc(clientOf(j).name||"Customer")}</span><span class="s">${esc(addrOf(j))}</span></span><span class="r mono">${money2((S.fin.get(j.id)||{}).price||0)}</span></button>`).join("")||`<p class="count">No match.</p>`}</div>`);
}
function dSale(jid){
  const j={id:jid,...(S.jobs.get(jid)||{})}, f=S.fin.get(jid)||{}, s=f.sale||{}, rf=f.referral||{}, F=(S.form&&S.form.sale)||(S.form={sale:{by:s.by||(sellers().some(p=>p.id===S.me.id)?S.me.id:""),type:s.type||"inbound",pct:s.pct??"",ref:rf.by||"",refPct:rf.pct??""}}).sale;
  const pct=F.type==="custom"?(+F.pct||0):commRate(F.type), base=j.source==="tcl"?split(j,f).incoming:(+f.price||0);
  const b=`<form class="form" id="saleForm" data-key="${esc(jid)}"><fieldset><legend>Who sold it</legend>
    <select id="sl-by"><option value="">Nobody</option>${sellers().map(p=>`<option value="${esc(p.id)}" ${F.by===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select><small>Only Raul, Jarrod and Brayden sell jobs.</small></fieldset>
    <fieldset><legend>Lead</legend><div class="seg" role="group">${LEADS.map(([k,l])=>`<button type="button" data-act="sale-type" data-v="${k}" aria-pressed="${F.type===k}">${l}${k!=="custom"?` · ${commRate(k)}%`:""}</button>`).join("")}</div>
    ${F.type==="custom"?`<div class="f" style="margin-top:8px"><label for="sl-pct">Commission %</label><input id="sl-pct" inputmode="decimal" value="${esc(F.pct)}" placeholder="e.g. 12"></div>`:""}</fieldset>
    ${S.me.manage?`<fieldset><legend>Referral pay (optional)</legend><div class="two"><div class="f"><label for="sl-ref">Referred by</label><select id="sl-ref"><option value="">No referral</option>${PL.staff().filter(p=>p.active).map(p=>`<option value="${esc(p.id)}" ${F.ref===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="f"><label for="sl-rpct">Referral %</label><input id="sl-rpct" inputmode="decimal" value="${esc(F.refPct)}" placeholder="e.g. 5"></div></div><small>Anyone can get referral pay. Only managers add it.</small></fieldset>`:rf.by?`<p class="count">Referral: ${esc(staffName(rf.by))} · ${+rf.pct||0}%</p>`:""}
    <div class="calc"><div class="ln"><span>${j.source==="tcl"?"ProLight's share of the job":"Job price"}</span><span class="mono">${money2(base)}</span></div>${F.by?`<div class="ln"><span>Commission ${pct}%</span><span class="mono">${money2(base*pct/100)}</span></div>`:""}${F.ref&&+F.refPct?`<div class="ln"><span>Referral ${+F.refPct}%</span><span class="mono">${money2(base*F.refPct/100)}</span></div>`:""}</div>
    ${!base?`<p class="count" style="color:var(--red)">This job has no price yet, so the commission shows $0 until you add one.</p>`:""}
    <div class="actions">${s.by||rf.by?`<button type="button" class="btn danger" data-act="sale-remove" data-v="${esc(jid)}">Remove sale</button>`:"<span></span>"}<button type="submit" class="btn amber">Save</button></div></form>`;
  return drawerShell("Sale & commission", clientOf(j).name||"Customer", b);
}
function readSale(){ if(!S.form||!S.form.sale) return; const by=$("#sl-by"), p=$("#sl-pct"), r=$("#sl-ref"), rp=$("#sl-rpct"); if(by) S.form.sale.by=by.value; if(p) S.form.sale.pct=p.value; if(r) S.form.sale.ref=r.value; if(rp) S.form.sale.refPct=rp.value; }
async function saveSale(form){
  readSale(); const jid=form.dataset.key, F=S.form.sale, f=S.fin.get(jid)||{};
  if(F.by&&F.type==="custom"&&!(+F.pct>0)){ toast("Type the commission %"); return; }
  if(S.me.manage&&F.ref&&!(+F.refPct>0)){ toast("Type the referral %"); return; }
  const old=f.sale||{}, ro=f.referral||{}, nf={...f};
  if(F.by) nf.sale={by:F.by,type:F.type,pct:F.type==="custom"?+F.pct:null,at:old.at||new Date().toISOString(),paidAt:old.paidAt||null}; else delete nf.sale;
  if(S.me.manage){ if(F.ref) nf.referral={by:F.ref,pct:+F.refPct,at:ro.at||new Date().toISOString(),paidAt:ro.paidAt||null,addedBy:ro.addedBy||S.me.id}; else delete nf.referral; }
  try{ await S.db.doc("fin/"+jid).set(nf); toast("Saved"); S.form=null; closeDrawer(); }
  catch(e){ fail(e,"save the sale"); }
}
function saleLine(j){
  const s=saleOf(j), r=refOf(j);
  return `<div class="bar" style="margin-top:8px">${s?`<span class="count" style="font-size:14px">Sold by <b>${esc(staffName(s.by))}</b> · ${esc(leadLabel(s.type))} · ${s.pct}% = <b>${money2(s.comm)}</b>${s.paidAt?" · paid":""}</span>`:""}
    ${r?`<span class="count" style="font-size:14px">Referral: <b>${esc(staffName(r.by))}</b> · ${r.pct}% = <b>${money2(r.comm)}</b>${r.paidAt?" · paid":""}</span>`:""}
    <button type="button" class="btn small" data-act="sale-edit" data-v="${esc(j.id)}">${s||r?"Edit sale":"Record sale & commission"}</button></div>`;
}

/* ---------- payroll ---------- */
const OT_AFTER = 40;
const payRate = id => +(((S.payroll.rates||{})[id]||{}).rate)||0;
const otOff = id => ((S.payroll.rates||{})[id]||{}).ot===false;
function payWeek(){
  const days=[...Array(7)].map((_,i)=>addDays(S.week,i)), set=new Set(days);
  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.in&&set.has(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));
  const ppl=new Map(), touch=id=>{ if(!ppl.has(id)) ppl.set(id,{id,ms:0,job:0,gen:0,open:0,days:new Set(),comm:0,sales:[]}); return ppl.get(id); };
  for(const r of rows){ const p=touch(r.by), m=clockMs(r); p.ms+=m; r.general?p.gen+=m:p.job+=m; if(!r.out) p.open++; p.days.add(isoOf(r.in)); }
  for(const s of allSales()) if(s.earnedOn&&set.has(s.earnedOn)&&!s.paidAt){ const p=touch(s.by); p.comm+=s.comm; p.sales.push(s); }
  for(const id of Object.keys(S.payroll.rates||{})) if(payRate(id)>0 && (PL.staff().find(x=>x.id===id)||{}).active) touch(id);
  const out=[...ppl.values()].map(p=>{ const hrs=Math.round(p.ms/36e4)/10, noOt=otOff(p.id), reg=noOt?hrs:Math.min(hrs,OT_AFTER), ot=noOt?0:Math.max(0,Math.round((hrs-OT_AFTER)*10)/10), rate=payRate(p.id);
    return {...p, hrs, reg, ot, rate, regPay:reg*rate, otPay:ot*rate*1.5, total:reg*rate+ot*rate*1.5+p.comm, name:staffName(p.id), title:(PL.staff().find(x=>x.id===p.id)||{}).title||""}; })
    .sort((a,b)=>a.name.localeCompare(b.name));
  return {days, rows, people:out};
}
const h1 = n => (Math.round(n*10)/10).toFixed(1);
function vPayroll(){
  const W=payWeek(), P=W.people, end=W.days[6], tot=P.reduce((t,p)=>t+p.total,0);
  const warn=[...P.filter(p=>p.open).map(p=>`${p.name} has ${p.open} open clock-in${p.open>1?"s":""} (never clocked out)`), ...P.filter(p=>!p.rate&&p.hrs).map(p=>`${p.name} has no pay rate`)];
  let h=`<div class="bar" style="margin-top:12px"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button><b class="sign grow" style="font-size:22px">Pay week ${fmtDay(S.week)} – ${fmtDay(end)}</b><button type="button" class="btn icon" data-act="week" data-v="7" aria-label="Next week">›</button></div>
    ${warn.length?`<div class="note">${warn.map(esc).join("<br>")}<br><small>Fix times in Office → Hours (tap a row) before sending.</small></div>`:""}
    <div class="mhero" style="margin-top:12px"><span class="eyebrow">Payroll this week</span><div class="mhero-v">${money2(tot)}</div><span>${h1(P.reduce((t,p)=>t+p.hrs,0))} hours · ${P.length} people${P.some(p=>p.ot)?` · overtime over ${OT_AFTER} hrs at 1.5×`:""}</span></div>`;
  if(!P.length) return h+`<div class="empty"><h3>No hours this week</h3><p>Hours come from clock-ins (shop, driving and jobs). Set each person's hourly rate below once and it's used every week.</p></div>`+rateList();
  h+=`<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Person</th><th class="r">Rate</th><th class="r">Jobs</th><th class="r">Shop & drive</th><th class="r">Hours</th><th class="r">OT</th><th class="r">Hourly pay</th><th class="r">Commission</th><th class="r">Total</th></tr></thead><tbody>
    ${P.map(p=>`<tr><td><b>${esc(p.name)}</b>${p.title?`<br><small class="count">${esc(p.title)}</small>`:""}</td>
      <td class="r"><input class="search rate-in" data-rate-for="${esc(p.id)}" inputmode="decimal" value="${p.rate||""}" placeholder="$/hr" style="width:76px;min-height:32px;text-align:right"></td>
      <td class="r">${h1(p.job/36e5)}</td><td class="r">${h1(p.gen/36e5)}</td><td class="r"><b>${h1(p.hrs)}</b></td><td class="r">${p.ot?h1(p.ot):"–"}</td>
      <td class="r">${money2(p.regPay+p.otPay)}</td><td class="r">${p.comm?money2(p.comm):"–"}</td><td class="r"><b>${money2(p.total)}</b></td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="4">Total</td><td class="r"><b>${h1(P.reduce((t,p)=>t+p.hrs,0))}</b></td><td class="r">${h1(P.reduce((t,p)=>t+p.ot,0))}</td><td class="r">${money2(P.reduce((t,p)=>t+p.regPay+p.otPay,0))}</td><td class="r">${money2(P.reduce((t,p)=>t+p.comm,0))}</td><td class="r"><b>${money2(tot)}</b></td></tr></tfoot></table></div>
    <div class="bar" style="margin-top:10px"><button type="button" class="btn amber" data-act="pay-csv">Download payroll (CSV)</button><button type="button" class="btn" data-act="pay-detail">Time detail (CSV)</button><button type="button" class="btn" data-act="pay-print">Print / save PDF</button>
      ${P.some(p=>p.comm)?`<button type="button" class="btn" data-act="pay-commpaid">Mark this week's commissions paid</button>`:""}</div>
    <p class="count" style="font-size:13px">Commission shows in the week the job was ${commWhen()==="sold"?"sold":"installed"}, until you mark it paid. Overtime is anything over ${OT_AFTER} hours in the week at 1.5×, except people set to straight hourly (1099) under Pay rates.</p>`;
  return h+rateList();
}
function rateList(){
  const ppl=PL.staff().filter(p=>p.active);
  return `<h2 class="h-sec" style="margin-top:18px">Pay rates</h2><div class="rows">${ppl.map(p=>`<div class="row" style="cursor:default">${avatar(p.id)}<span class="m"><span class="n">${esc(p.name)}</span><span class="s">${esc(p.title||permSummary(p))}</span></span><span class="r" style="display:flex;gap:8px;align-items:center"><select class="search ot-in" data-ot-for="${esc(p.id)}" aria-label="Overtime for ${esc(p.name)}" style="width:auto;min-height:34px;font-size:13px"><option value="1" ${otOff(p.id)?"":"selected"}>OT after ${OT_AFTER} hrs</option><option value="0" ${otOff(p.id)?"selected":""}>Straight hourly (1099)</option></select><input class="search rate-in" data-rate-for="${esc(p.id)}" inputmode="decimal" value="${payRate(p.id)||""}" placeholder="$/hr" style="width:90px;min-height:34px;text-align:right"></span></div>`).join("")}</div>
    <p class="count" style="font-size:13px">Only people with money access can see pay rates.</p>`;
}
async function saveOt(id,on){
  const rates={...(S.payroll.rates||{})}; rates[id]={...(rates[id]||{}),ot:!!on};
  try{ await S.db.doc("fin/payroll").set({...S.payroll,rates}); toast(`${staffName(id)}: ${on?"overtime after "+OT_AFTER+" hrs":"straight hourly, no overtime"}`); }catch(e){ fail(e,"save that"); }
}
async function saveRate(id,val){
  const n=Number(String(val).replace(/[^0-9.]/g,""))||0, rates={...(S.payroll.rates||{})};
  if(n) rates[id]={...(rates[id]||{}),rate:n,type:"hourly"}; else delete rates[id];
  try{ await S.db.doc("fin/payroll").set({...S.payroll,rates}); toast(n?`${staffName(id)}: $${n}/hr`:"Rate cleared"); }catch(e){ fail(e,"save the rate"); }
}
function payCsv(){
  const W=payWeek(), end=W.days[6];
  const rows=[["ProLight Tallahassee payroll"],["Pay week",`${S.week} to ${end}`],[],
    ["Employee","Title","Hourly rate","Job hours","Shop & driving hours","Total hours","Regular hours","Overtime hours","Regular pay","Overtime pay (1.5x)","Commission","Total pay"],
    ...W.people.map(p=>[p.name,p.title,p.rate.toFixed(2),h1(p.job/36e5),h1(p.gen/36e5),h1(p.hrs),h1(p.reg),h1(p.ot),p.regPay.toFixed(2),p.otPay.toFixed(2),p.comm.toFixed(2),p.total.toFixed(2)]),
    [],["Total","","",h1(W.people.reduce((t,p)=>t+p.job/36e5,0)),h1(W.people.reduce((t,p)=>t+p.gen/36e5,0)),h1(W.people.reduce((t,p)=>t+p.hrs,0)),"","","","",W.people.reduce((t,p)=>t+p.comm,0).toFixed(2),W.people.reduce((t,p)=>t+p.total,0).toFixed(2)]];
  const cs=W.people.flatMap(p=>p.sales.map(s=>[p.name,clientOf(s.job).name||"",leadLabel(s.type),s.base.toFixed(2),s.pct,s.comm.toFixed(2)]));
  if(cs.length) rows.push([],["Commissions included"],["Employee","Customer","Lead","Job amount","%","Commission"],...cs);
  download(`ProLight-payroll-${S.week}.csv`, rows);
}
function payDetailCsv(){
  const W=payWeek(), t=x=>x?new Date(x).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  download(`ProLight-time-detail-${S.week}.csv`, [["Date","Employee","Type","Customer","Clock in","Clock out","Hours","How"],
    ...W.rows.map(r=>[isoOf(r.in),staffName(r.by),r.general?(r.where==="shop"?"Shop":"Driving"):"Job",r.general?"":(clientOf(S.jobs.get(r.jobId)||{}).name||""),t(r.in),r.out?t(r.out):"OPEN",h1(clockMs(r)/36e5),(r.auto?"auto":"manual")+(r.edited?" (edited)":"")])]);
}
function payPrint(){
  const W=payWeek(), P=W.people, w=window.open("","_blank"); if(!w){ toast("Allow pop-ups to print"); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>ProLight payroll ${esc(S.week)}</title><style>body{font:14px system-ui,sans-serif;margin:32px;color:#111}h1{margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border-bottom:1px solid #ccc;padding:6px 8px;text-align:right}th:first-child,td:first-child{text-align:left}tfoot td{font-weight:700;border-top:2px solid #111}small{color:#666}</style>
    <h1>ProLight Tallahassee payroll</h1><div>Pay week ${esc(fmtDay(S.week,{month:"long",day:"numeric"}))} – ${esc(fmtDay(W.days[6],{month:"long",day:"numeric",year:"numeric"}))}</div>
    <table><thead><tr><th>Employee</th><th>Rate</th><th>Hours</th><th>OT hrs</th><th>Hourly pay</th><th>Commission</th><th>Total</th></tr></thead><tbody>
    ${P.map(p=>`<tr><td>${esc(p.name)}<br><small>${esc(p.title)}</small></td><td>$${p.rate.toFixed(2)}</td><td>${h1(p.hrs)}</td><td>${p.ot?h1(p.ot):"–"}</td><td>${money2(p.regPay+p.otPay)}</td><td>${p.comm?money2(p.comm):"–"}</td><td><b>${money2(p.total)}</b></td></tr>`).join("")}</tbody>
    <tfoot><tr><td>Total</td><td></td><td>${h1(P.reduce((t,p)=>t+p.hrs,0))}</td><td></td><td>${money2(P.reduce((t,p)=>t+p.regPay+p.otPay,0))}</td><td>${money2(P.reduce((t,p)=>t+p.comm,0))}</td><td>${money2(P.reduce((t,p)=>t+p.total,0))}</td></tr></tfoot></table>
    <p><small>Hours from the ProLight board clock-ins (shop, driving and jobs). Overtime over ${OT_AFTER} hrs/week at 1.5×. Prepared ${esc(new Date().toLocaleString("en-US"))}.</small></p><script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
}
async function markCommPaid(){
  const W=payWeek(), now=new Date().toISOString(); let n=0;
  try{ for(const p of W.people) for(const s of p.sales){ const f=S.fin.get(s.job.id)||{}; await S.db.doc("fin/"+s.job.id).set({...f,[s.key]:{...f[s.key],paidAt:now}}); n++; } toast(`${n} commission${n===1?"":"s"} marked paid`); }
  catch(e){ fail(e,"mark them paid"); }
}

/* fix a clock-in or clock-out time (managers) */
function dClockEdit(id){
  const e=S.log.get(id); if(!e) return drawerShell("Time","Not found","");
  const loc=x=>{ if(!x) return ""; const d=new Date(x); return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  return drawerShell("Fix time", `${staffName(e.by)} · ${e.general?(e.where==="shop"?"Shop":"Driving"):(clientOf(S.jobs.get(e.jobId)||{}).name||"Job")}`,
    `<form class="form" id="clockForm" data-key="${esc(id)}"><div class="two"><div class="f"><label for="ck-in">Clock in</label><input id="ck-in" type="datetime-local" value="${loc(e.in)}" required></div>
    <div class="f"><label for="ck-out">Clock out</label><input id="ck-out" type="datetime-local" value="${loc(e.out)}"></div></div>
    <div class="actions"><button type="button" class="btn danger" data-act="clock-del" data-id="${esc(id)}">Delete this time</button><button type="submit" class="btn amber">Save</button></div></form>`);
}
async function saveClockEdit(form){
  const id=form.dataset.key, i=$("#ck-in").value, o=$("#ck-out").value;
  if(o && new Date(o)<=new Date(i)){ toast("Clock out has to be after clock in"); return; }
  try{ await S.db.doc("log/"+id).update({in:new Date(i).toISOString(),out:o?new Date(o).toISOString():null,edited:S.me.id}); toast("Time fixed"); closeDrawer(); }catch(e){ fail(e,"fix that time"); }
}
