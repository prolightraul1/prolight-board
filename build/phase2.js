
/* ---------- maps app preference (Apple or Google) ---------- */
const MAPS_APP = () => ls("mapsApp") || (/iPhone|iPad|Macintosh/.test(navigator.userAgent) ? "apple" : "google");
const appleDir = (dest, waypoints=[], source) => "https://maps.apple.com/directions?" + [source?"source="+encodeURIComponent(source):"", "destination="+encodeURIComponent(dest), ...waypoints.map(w=>"waypoint="+encodeURIComponent(w)), "mode=driving"].filter(Boolean).join("&");
const googleDir = (dest, waypoints=[], source) => "https://www.google.com/maps/dir/?api=1" + (source?"&origin="+encodeURIComponent(source):"") + "&destination="+encodeURIComponent(dest) + (waypoints.length?"&waypoints="+encodeURIComponent(waypoints.join("|")):"") + "&travelmode=driving";
const dirUrl = (dest, waypoints, source) => MAPS_APP()==="apple" ? appleDir(dest, waypoints, source) : googleDir(dest, waypoints, source);
function routeUrls(stops){
  const a=stops.map(s=>addrOf(s.j)).filter(Boolean); if(!a.length) return null; const sh=shop().address;
  return { apple: appleDir(sh, a.slice(0,14), sh), google: googleDir(sh, a.slice(0,9), sh), capped: a.length>9 };
}

/* ---------- payments + money totals ---------- */
S.pays = S.pays || new Map();
const money2 = n => "$" + (Math.round((n||0)*100)/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const firstDate = j => (j.visits||[]).map(v=>v.date).filter(Boolean).sort()[0] || "";
const installedOn = j => { const d=[...S.log.values()].filter(e=>e.kind==="done"&&e.jobId===j.id).map(e=>e.at).sort()[0]; return d?isoOf(d):""; };
function ledger(party){ return [...S.pays.entries()].map(([id,p])=>({id,...p})).filter(p=>p.party===party).sort((a,b)=>String(b.date).localeCompare(String(a.date))); }
function paidSet(party){ const s=new Set(); for(const p of ledger(party)) (p.jobs||[]).forEach(x=>s.add(x)); return s; }
function moneyRows(){
  return jobsArr().filter(j=>j.stage!=="cancelled").map(j=>{ const f=S.fin.get(j.id)||{}, s=split(j,f), st=status(j);
    return {j,f,s,st,done:st==="lit"||st==="down",client:clientOf(j).name||"Customer",date:firstDate(j)}; });
}
function moneyTotals(){
  const R=moneyRows(), sum=(a,fn)=>a.reduce((t,x)=>t+(fn(x)||0),0);
  const tcl=R.filter(r=>r.j.source==="tcl"&&r.s.price), own=R.filter(r=>r.j.source!=="tcl"&&r.s.price), ss=R.filter(r=>r.s.ss>0);
  const tPaid=paidSet("tcl"), sPaid=paidSet("shipshape");
  const T={ R,
    tcl:{rows:tcl, booked:sum(tcl,r=>r.s.incoming), earned:sum(tcl.filter(r=>r.done),r=>r.s.incoming), paid:sum(ledger("tcl"),p=>+p.amount), paidSet:tPaid},
    ss:{rows:ss, booked:sum(ss,r=>r.s.ss), earned:sum(ss.filter(r=>r.done),r=>r.s.ss), paid:sum(ledger("shipshape"),p=>+p.amount), paidSet:sPaid},
    own:{rows:own, booked:sum(own,r=>r.s.price), earned:sum(own.filter(r=>r.done),r=>r.s.price), paid:sum(own.filter(r=>r.f.collected),r=>r.s.price)},
    noPrice:R.filter(r=>!r.s.price).length };
  T.tcl.due=T.tcl.earned-T.tcl.paid; T.ss.due=T.ss.earned-T.ss.paid; T.own.due=T.own.earned-T.own.paid;
  T.net={booked:T.tcl.booked-T.ss.booked+T.own.booked, earned:T.tcl.earned-T.ss.earned+T.own.earned};
  T.legacyT=tcl.filter(r=>r.f.collected&&!tPaid.has(r.j.id)).length; T.legacyS=ss.filter(r=>r.f.ssPaid&&!sPaid.has(r.j.id)).length;
  return T;
}
const isPaid = (party, r, T) => party==="tcl" ? (T.tcl.paidSet.has(r.j.id)||!!r.f.collected) : (T.ss.paidSet.has(r.j.id)||!!r.f.ssPaid);
const pctBar = (a,b) => `<div class="pbar"><span style="width:${b>0?Math.min(100,Math.max(0,a/b*100)):0}%"></span></div>`;

function vMoney(){
  const T=moneyTotals(), tab=S.mtab||"overview";
  const tabs=[["overview","Overview"],["tcl","TCL"],["ss","ShipShape"],["own","ProLight jobs"],["pays","Payments"]];
  let h=`<div class="chips" role="group" aria-label="Money">${tabs.map(([k,l])=>`<button type="button" class="chip" data-act="mtab" data-v="${k}" aria-pressed="${tab===k}">${l}</button>`).join("")}</div>`;
  if(tab==="overview") h+=mOverview(T); else if(tab==="tcl") h+=mStatement("tcl",T); else if(tab==="ss") h+=mStatement("shipshape",T); else if(tab==="own") h+=mOwn(T); else h+=mPayments(T);
  return h;
}
function mOverview(T){
  const R=rates();
  const card=(title,logo,big,bigLbl,lines,party,paid,earned)=>`<section class="mcard"><header><div><span class="eyebrow">${title}</span><div class="mbig">${money2(big)}</div><span class="count" style="font-size:13px">${bigLbl}</span></div>${logo}</header>
    ${pctBar(paid,earned)}<dl class="kv">${lines.map(([k,v])=>`<dt>${k}</dt><dd class="mono">${v}</dd>`).join("")}</dl>
    ${party?`<div class="bar"><button type="button" class="btn small amber" data-act="pay-new" data-v="${party}">Record ${party==="tcl"?"payment from TCL":"payment to ShipShape"}</button><button type="button" class="btn small" data-act="mtab" data-v="${party==="tcl"?"tcl":"ss"}">Statement</button></div>`:""}</section>`;
  return `<div class="mhero"><div><span class="eyebrow">ProLight keeps this season</span><div class="mhero-v">${money2(T.net.booked)}</div><span>${money2(T.net.earned)} earned on installed jobs · ${money2(T.net.booked-T.net.earned)} still to install</span></div></div>
  <div class="mgrid">
    ${card("TCL owes ProLight",`<img src="/brand/tcl.png" alt="" class="mlogo">`,T.tcl.due,"balance due on installed jobs",[["Earned (installed)",money2(T.tcl.earned)],["Paid to us",money2(T.tcl.paid)],["Still to install",money2(T.tcl.booked-T.tcl.earned)],["Whole season",money2(T.tcl.booked)]],"tcl",T.tcl.paid,T.tcl.earned)}
    ${card("ProLight owes ShipShape",`<img src="/brand/shipshape.png" alt="" class="mlogo ss">`,T.ss.due,"balance on installed jobs",[["Earned (installed)",money2(T.ss.earned)],["Paid to them",money2(T.ss.paid)],["Still to install",money2(T.ss.booked-T.ss.earned)],["Whole season",money2(T.ss.booked)]],"shipshape",T.ss.paid,T.ss.earned)}
    ${card("ProLight's own jobs","",T.own.due,"to collect on installed jobs",[["Installed",money2(T.own.earned)],["Collected",money2(T.own.paid)],["Still to install",money2(T.own.booked-T.own.earned)],["Whole season",money2(T.own.booked)]],"",T.own.paid,T.own.earned)}
  </div>
  <p class="lede" style="font-size:14px">TCL pays ProLight ${R.tcl*100}% of each TCL job. ShipShape gets ${R.ss*100}% of the TCL price on jobs they do, unless a job has its own split. Balances count installed jobs only, minus recorded payments.</p>
  ${T.noPrice?`<div class="note">${T.noPrice} job${T.noPrice>1?"s have":" has"} no price and ${T.noPrice>1?"aren't":"isn't"} counted.</div>`:""}
  ${T.legacyT||T.legacyS?`<div class="note">${[T.legacyT&&`${T.legacyT} TCL job${T.legacyT>1?"s are":" is"} marked paid`,T.legacyS&&`${T.legacyS} ShipShape job${T.legacyS>1?"s are":" is"} marked paid`].filter(Boolean).join(" and ")} without a payment record, so ${T.legacyT+T.legacyS>1?"they don't":"it doesn't"} count toward "Paid". Record the payment to fix the balance.</div>`:""}`;
}
function mStatement(party,T){
  const P=party==="tcl"?T.tcl:T.ss, f=S.mfilter||"open";
  let rows=P.rows.slice().sort((a,b)=>String(a.date||"9").localeCompare(String(b.date||"9"))||a.client.localeCompare(b.client));
  if(f==="open") rows=rows.filter(r=>r.done&&!isPaid(party,r,T)); else if(f==="installed") rows=rows.filter(r=>r.done); else if(f==="upcoming") rows=rows.filter(r=>!r.done);
  const amt=r=>party==="tcl"?r.s.incoming:r.s.ss, tot=rows.reduce((t,r)=>t+amt(r),0);
  const chips=[["open","Installed, unpaid"],["installed","Installed"],["upcoming","Not installed yet"],["all","All"]];
  return `<div class="mstat-head"><div><span class="eyebrow">${party==="tcl"?"TCL owes ProLight":"ProLight owes ShipShape"}</span><div class="mbig">${money2(P.due)}</div><span class="count">${money2(P.earned)} earned · ${money2(P.paid)} paid</span></div>
    <div class="bar"><button type="button" class="btn amber small" data-act="pay-new" data-v="${party}">Record payment</button><button type="button" class="btn small" data-act="stmt-copy" data-v="${party}">Copy statement</button><button type="button" class="btn small" data-act="stmt-csv" data-v="${party}">Download CSV</button>${party==="shipshape"?`<button type="button" class="btn small" data-act="office" data-v="statement">See ShipShape's view</button>`:""}</div></div>
  <div class="chips">${chips.map(([k,l])=>`<button type="button" class="chip" data-act="mfilter" data-v="${k}" aria-pressed="${f===k}">${l}</button>`).join("")}</div>
  <div class="tbl"><table><thead><tr><th>Client</th><th>Install</th>${party==="tcl"?`<th class="r">Job price</th><th class="r">ProLight ${rates().tcl*100}%</th>`:`<th>Crew</th><th class="r">Split</th><th class="r">Payout</th>`}<th>Status</th></tr></thead>
  <tbody>${rows.map(r=>{ const paid=isPaid(party,r,T); return `<tr><td><button type="button" class="tog" style="border:0;padding:0;background:none;color:var(--ink)" data-act="job" data-id="${esc(r.j.id)}"><b>${esc(r.client)}</b></button></td><td class="mono">${r.done?esc(fmtDay(installedOn(r.j)||r.date)):r.date?"Sched. "+esc(fmtDay(r.date)):"—"}</td>
    ${party==="tcl"?`<td class="r">${money2(r.s.price)}</td><td class="r"><b>${money2(r.s.incoming)}</b></td>`:`<td>${esc(teamName(r.j.crew))}</td><td class="r">${pctTxt(r.s.ssPct)}${r.s.custom?"*":""}</td><td class="r"><b>${money2(r.s.ss)}</b></td>`}
    <td>${!r.done?`<span class="st scheduled">Not installed</span>`:paid?`<span class="st down">Paid</span>`:`<span class="st lit">Owed</span>`}</td></tr>`; }).join("")||`<tr><td colspan="6" class="count">Nothing here.</td></tr>`}</tbody>
  <tfoot><tr><td colspan="${party==="tcl"?3:4}"><b>${rows.length} job${rows.length===1?"":"s"}</b></td><td class="r"><b>${money2(tot)}</b></td><td></td></tr></tfoot></table></div>
  ${party==="shipshape"?`<p class="count" style="font-size:13px">* custom split set on that job.</p>`:""}
  <h2 class="h-sec">Payments</h2>${payList(ledger(party))}`;
}
function mOwn(T){
  const rows=T.own.rows.slice().sort((a,b)=>a.client.localeCompare(b.client));
  return `<div class="mstat-head"><div><span class="eyebrow">ProLight's own jobs</span><div class="mbig">${money2(T.own.due)}</div><span class="count">to collect · ${money2(T.own.paid)} collected of ${money2(T.own.booked)}</span></div></div>
  <div class="tbl"><table><thead><tr><th>Client</th><th>Install</th><th class="r">Price</th><th>Customer paid</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.client)}</b></td><td class="mono">${r.done?esc(fmtDay(installedOn(r.j)||r.date)):"—"}</td><td class="r">${money2(r.s.price)}</td><td><button type="button" class="tog" data-act="fin-tog" data-k="collected" data-id="${esc(r.j.id)}" aria-pressed="${!!r.f.collected}">${r.f.collected?"Collected":"Open"}</button></td></tr>`).join("")||`<tr><td colspan="4" class="count">No ProLight jobs with a price yet.</td></tr>`}</tbody></table></div>`;
}
function payList(list){
  if(!list.length) return `<p class="lede" style="font-size:14px">No payments recorded yet.</p>`;
  return `<div class="rows">${list.map(p=>`<div class="row" style="cursor:default"><span class="lbl ${p.party==="tcl"?"tcl":"pl"}">${p.party==="tcl"?"From TCL":p.party==="shipshape"?"To ShipShape":"Other"}</span>
    <span class="m"><span class="n mono">${money2(p.amount)}</span><span class="s">${esc(fmtDay(p.date,{month:"short",day:"numeric",year:"numeric"}))}${p.method?" · "+esc(p.method):""}${(p.jobs||[]).length?` · ${p.jobs.length} job${p.jobs.length>1?"s":""}`:""}${p.memo?" · "+esc(p.memo):""}</span></span>
    <span class="r">${S.me.owner?(S.delPay===p.id?`<button type="button" class="btn small danger" data-act="pay-del" data-id="${esc(p.id)}">Tap to delete</button>`:`<button type="button" class="btn small" data-act="pay-del-ask" data-id="${esc(p.id)}">Delete</button>`):""}</span></div>`).join("")}</div>`;
}
function mPayments(T){
  const all=[...ledger("tcl"),...ledger("shipshape")].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return `<div class="bar"><button type="button" class="btn amber small" data-act="pay-new" data-v="tcl">Payment from TCL</button><button type="button" class="btn amber small" data-act="pay-new" data-v="shipshape">Payment to ShipShape</button></div>
  <div class="tiles"><div class="tile"><span class="l">Received from TCL</span><span class="v">${money2(T.tcl.paid)}</span></div><div class="tile"><span class="l">Paid to ShipShape</span><span class="v">${money2(T.ss.paid)}</span></div><div class="tile"><span class="l">Net cash so far</span><span class="v">${money2(T.tcl.paid-T.ss.paid+T.own.paid)}</span></div></div>
  ${payList(all)}`;
}
function dPay(){
  const F=S.form.pay, T=moneyTotals(), party=F.party, P=party==="tcl"?T.tcl:T.ss;
  const open=P.rows.filter(r=>!isPaid(party,r,T)).sort((a,b)=>(b.done-a.done)||String(a.date).localeCompare(String(b.date)));
  const amt=r=>party==="tcl"?r.s.incoming:r.s.ss;
  const b=`<form class="form" id="payForm" autocomplete="off">
    <fieldset><legend>${party==="tcl"?"Money in from TCL":"Money out to ShipShape"}</legend>
      <div class="two"><div class="f"><label for="py-amount">Amount</label><input id="py-amount" inputmode="decimal" value="${esc(F.amount)}" placeholder="0.00"></div>
      <div class="f"><label for="py-date">Date</label><input id="py-date" type="date" value="${esc(F.date)}"></div></div>
      <div class="two"><div class="f"><label for="py-method">Method</label><select id="py-method">${["Check","Zelle","ACH / bank transfer","Cash","Venmo","Other"].map(m=>`<option ${F.method===m?"selected":""}>${m}</option>`).join("")}</select></div>
      <div class="f"><label for="py-memo">Memo / check #</label><input id="py-memo" value="${esc(F.memo)}"></div></div>
    </fieldset>
    <fieldset><legend>Which jobs does it cover?</legend>
      <p class="count" style="font-size:13px">Tick the jobs and the amount fills in. You can still type a different amount.</p>
      <div class="checks">${open.map(r=>`<label><input type="checkbox" id="pj-${esc(r.j.id)}" data-jamt="${amt(r).toFixed(2)}" ${F.jobs.has(r.j.id)?"checked":""}><span><b>${esc(r.client)}</b> · <span class="mono">${money2(amt(r))}</span><small>${r.done?"Installed "+esc(fmtDay(installedOn(r.j)||r.date)):"Not installed yet"}</small></span></label>`).join("")||`<p class="count">Every job is already paid.</p>`}</div>
    </fieldset>
    <div class="actions"><span class="count" id="py-err" style="color:var(--red)"></span><button type="submit" class="btn amber">Save payment</button></div></form>`;
  return drawerShell("Record payment", party==="tcl"?"From TCL":"To ShipShape", b);
}
async function savePay(){
  const F=S.form.pay, amount=parseFloat(String($("#py-amount").value).replace(/[$,]/g,""));
  if(!(amount>0)){ $("#py-err").textContent="Enter the amount."; return; }
  const jobs=[...F.jobs], id="pay-"+uid()+uid().slice(0,4);
  const doc={party:F.party,amount:Math.round(amount*100)/100,date:$("#py-date").value||todayISO(),method:$("#py-method").value,memo:$("#py-memo").value.trim(),jobs,at:new Date().toISOString(),by:S.me.id};
  try{
    await S.db.doc("fin/"+id).set(doc);
    const flag=F.party==="tcl"?"collected":"ssPaid";
    for(const jid of jobs){ const f=S.fin.get(jid)||{}; if(!f[flag]) await S.db.doc("fin/"+jid).set({...f,[flag]:true}); }
    toast(`Saved ${money2(doc.amount)} ${F.party==="tcl"?"from TCL":"to ShipShape"}`); closeDrawer();
  }catch(e){ fail(e,"save the payment"); }
}
async function delPay(id){
  const p=S.pays.get(id); if(!p) return;
  try{
    await S.db.doc("fin/"+id).delete();
    const still=new Set(); for(const [pid,q] of S.pays) if(pid!==id&&q.party===p.party) (q.jobs||[]).forEach(x=>still.add(x));
    const flag=p.party==="tcl"?"collected":"ssPaid";
    for(const jid of (p.jobs||[])) if(!still.has(jid)){ const f=S.fin.get(jid)||{}; if(f[flag]) await S.db.doc("fin/"+jid).set({...f,[flag]:false}); }
    S.delPay=null; toast("Payment deleted");
  }catch(e){ fail(e,"delete the payment"); }
}
function stmtRows(party){
  const T=moneyTotals(), P=party==="tcl"?T.tcl:T.ss;
  return P.rows.filter(r=>r.done).sort((a,b)=>String(installedOn(a.j)).localeCompare(String(installedOn(b.j)))).map(r=>({client:r.client,address:addrOf(r.j),installed:installedOn(r.j)||r.date,price:r.s.price,amount:party==="tcl"?r.s.incoming:r.s.ss,pct:party==="tcl"?rates().tcl*100:r.s.ssPct*100,paid:isPaid(party,r,T)}));
}
function stmtText(party){
  const T=moneyTotals(), P=party==="tcl"?T.tcl:T.ss, rows=stmtRows(party), L=[];
  L.push(party==="tcl"?"ProLight Tallahassee · Statement for Tallahassee Christmas Lights":"ProLight Tallahassee · ShipShape Exteriors payout statement", "As of "+fmtDay(todayISO(),{month:"long",day:"numeric",year:"numeric"}), "");
  rows.forEach(r=>L.push(`${fmtDay(r.installed)}  ${r.client}  ${money2(r.amount)}${party==="shipshape"?` (${Math.round(r.pct*10)/10}%)`:""}  ${r.paid?"PAID":"OWED"}`));
  L.push("", `Installed jobs: ${rows.length}`, `Total ${party==="tcl"?"due to ProLight":"earned by ShipShape"}: ${money2(P.earned)}`, `Paid so far: ${money2(P.paid)}`, `Balance: ${money2(P.due)}`);
  return L.join("\n");
}
function stmtCsv(party){
  const rows=stmtRows(party), q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const head=party==="tcl"?["Installed","Client","Address","Job price","ProLight share","Status"]:["Installed","Client","Address","Split %","Payout","Status"];
  const body=rows.map(r=>party==="tcl"?[r.installed,r.client,r.address,r.price.toFixed(2),r.amount.toFixed(2),r.paid?"Paid":"Owed"]:[r.installed,r.client,r.address,(Math.round(r.pct*10)/10),r.amount.toFixed(2),r.paid?"Paid":"Owed"]);
  const blob=new Blob([[head,...body].map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${party==="tcl"?"TCL":"ShipShape"}-statement-${todayISO()}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}

/* ---------- ShipShape owner's statement ---------- */
S.stmt = S.stmt || null;
function vStatement(){
  if(!S.stmt){ PL.statement().then(d=>{ S.stmt=d||{jobs:[],payments:[]}; renderMain(); }).catch(e=>{ S.stmt={error:e.message}; renderMain(); }); return `<p class="lede">Loading ShipShape's statement…</p>`; }
  if(S.stmt.error) return `<div class="note">Couldn't load the statement: ${esc(S.stmt.error)}</div>`;
  const J=S.stmt.jobs||[], Pm=S.stmt.payments||[], sum=(a,f)=>a.reduce((t,x)=>t+(+f(x)||0),0);
  const earned=sum(J.filter(j=>j.installed),j=>j.payout), paid=sum(Pm,p=>p.amount), upcoming=sum(J.filter(j=>!j.installed),j=>j.payout);
  return `${S.me.money?`<div class="note">This is exactly what the ShipShape owner's login shows. No job prices, TCL or ProLight numbers.</div>`:""}
  <div class="mhero ss"><div><img src="/brand/shipshape.png" alt="ShipShape Exteriors" class="mlogo ss" style="height:40px"><span class="eyebrow" style="display:block;margin-top:6px">Balance owed to ShipShape</span><div class="mhero-v">${money2(earned-paid)}</div><span>${money2(earned)} earned on installed jobs · ${money2(paid)} paid · ${money2(upcoming)} on jobs not installed yet</span></div></div>
  <div class="rows">${J.map(j=>`<div class="row" style="cursor:default"><span class="bulb ${j.installed?"on":""}"></span><span class="m"><span class="n">${esc(j.client||"Customer")}</span><span class="s">${esc(j.address||"")}</span><span class="s">${j.date?esc(fmtDay(j.date)):"No date"} · ${Math.round(j.pct*10)/10}% split</span></span>
    <span class="r"><span class="mono" style="font-weight:600">${money2(j.payout)}</span>${!j.installed?`<span class="st scheduled">Not installed</span>`:j.paid?`<span class="st down">Paid</span>`:`<span class="st lit">Owed</span>`}</span></div>`).join("")||`<p class="lede">No ShipShape jobs yet.</p>`}</div>
  <h2 class="h-sec">Payments from ProLight</h2>
  ${Pm.length?`<div class="rows">${Pm.slice().reverse().map(p=>`<div class="row" style="cursor:default"><span class="lbl">Paid</span><span class="m"><span class="n mono">${money2(p.amount)}</span><span class="s">${esc(fmtDay(p.date,{month:"short",day:"numeric",year:"numeric"}))}${p.method?" · "+esc(p.method):""}${p.memo?" · "+esc(p.memo):""}</span></span><span></span></div>`).join("")}</div>`:`<p class="lede" style="font-size:14px">No payments recorded yet.</p>`}
  <div><button type="button" class="btn small" data-act="stmt-reload">Refresh</button></div>`;
}

/* ---------- trucks + trailers ---------- */
S.dayCfg = S.dayCfg || new Map();
const fleet = () => ({ trucks:S.settings.trucks||[], trailers:S.settings.trailers||[] });
const assignOf = (d,c) => (((S.dayCfg.get(d)||{}).assign)||{})[c] || null;
function truckLine(d,c){
  const a=assignOf(d,c), F=fleet();
  if(!a && !S.me.owner) return "";
  const clash = a&&a.truck ? crews().filter(x=>x.id!==c && (assignOf(d,x.id)||{}).truck===a.truck).map(x=>x.name) : [];
  return `<div class="truckline">${a?`<span><b>Truck</b>${esc(a.truck||"Not set")}</span><span><b>Trailer</b>${esc(a.trailer||"None")}</span>${a.note?`<span>${esc(a.note)}</span>`:""}`:`<span class="count">No truck assigned</span>`}
    ${clash.length?`<span class="st cancelled">Also on ${esc(clash.join(", "))}</span>`:""}
    ${S.me.owner?`<button type="button" class="btn small" data-act="assign-truck" data-v="${esc(d)}|${esc(c)}">${a?"Change":"Assign truck"}</button>`:""}
    ${S.me.owner&&!F.trucks.length?`<span class="count" style="font-size:12px">Add your trucks in Office → Settings</span>`:""}</div>`;
}
function truckAllLines(d){
  const rows=crews().filter(c=>stopsFor(d,c.id).length).map(c=>{ const a=assignOf(d,c.id); return `<span><b>${esc(c.name)}</b>${a?esc(a.truck||"—")+(a.trailer?" + "+esc(a.trailer):""):"No truck"}</span>`; });
  return rows.length?`<div class="truckline">${rows.join("")}</div>`:"";
}
function dAssign(key){
  const [d,c]=key.split("|"), a=assignOf(d,c)||{}, F=fleet(), prev=assignOf(addDays(d,-1),c);
  const opt=(list,cur,none)=>`${none?`<option value="">${none}</option>`:""}${list.map(x=>`<option ${x===cur?"selected":""}>${esc(x)}</option>`).join("")}${cur&&!list.includes(cur)?`<option selected>${esc(cur)}</option>`:""}`;
  const b=`<form class="form" id="assignForm" data-key="${esc(key)}"><fieldset><legend>${esc(teamName(c))} · ${esc(fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))}</legend>
    <div class="f"><label for="as-truck">Truck</label><select id="as-truck">${opt(F.trucks,a.truck,"Choose a truck…")}</select>${F.trucks.length?"":`<small>No trucks yet. Add them in Office → Settings.</small>`}</div>
    <div class="f"><label for="as-trailer">Trailer</label><select id="as-trailer">${opt(F.trailers,a.trailer,"No trailer")}</select></div>
    <div class="f"><label for="as-note">Note</label><input id="as-note" value="${esc(a.note||"")}" placeholder="e.g. grab the 32 ft ladder, fuel up"></div>
    ${prev?`<button type="button" class="btn small" data-act="assign-copy" data-v="${esc(key)}">Same as yesterday: ${esc(prev.truck||"")}${prev.trailer?" + "+esc(prev.trailer):""}</button>`:""}
  </fieldset><div class="actions"><span></span><button type="submit" class="btn amber">Save</button></div></form>`;
  return drawerShell("Truck assignment", teamName(c), b);
}
async function saveAssign(key, vals){
  const [d,c]=key.split("|"), cur=S.dayCfg.get(d)||{}, assign={...(cur.assign||{})};
  assign[c]=vals;
  try{ await S.db.doc("settings/day-"+d).set({...cur,assign}); toast("Truck saved"); closeDrawer(); }catch(e){ fail(e,"save the truck"); }
}
const linesOf = id => { const el=document.getElementById(id); return el ? el.value.split("\n").map(s=>s.trim()).filter(Boolean) : undefined; };

/* ---------- lunch ---------- */
const LUNCH_AT = 11*60+30, LUNCH_MIN = 30;
function lunchCard(L,d){
  const a=L.a, b=L.b, mid = a&&b ? {lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2} : (a||b||shop());
  return `<article class="stop lunch"><div class="rail-c"><span class="lunch-dot" aria-hidden="true"></span></div>
    <div class="ticket lunch-t"><div class="t-top"><span class="vt lunchtag">Lunch</span><span class="mono" style="font-size:13px">~${minTxt(L.min)} · ${LUNCH_MIN} min</span></div>
    <div class="t-addr">${L.aName&&L.bName?`Between ${esc(L.aName)} and ${esc(L.bName)}`:"Midday break"}</div>
    <div class="t-actions"><button type="button" class="btn amber" data-act="hungry" data-v="${d}|${L.after}">Quick food on the way</button>
      <a class="btn" href="https://maps.apple.com/search?query=lunch&center=${mid.lat},${mid.lng}" target="_blank" rel="noopener">Apple Maps ↗</a>
      <a class="btn" href="https://www.google.com/maps/search/lunch/@${mid.lat},${mid.lng},14z" target="_blank" rel="noopener">Google ↗</a></div></div></article>`;
}
const FOOD = { cache:new Map() };
const QUICK = /burger|sandwich|chicken|mexican|tex-mex|pizza|bbq|barbecue|sub|deli|taco|wings|asian|chinese|bagel|coffee|donut|breakfast|hot ?dog|seafood|cajun/i;
async function findFood(c){
  const key=c.lat.toFixed(3)+","+c.lng.toFixed(3); if(FOOD.cache.has(key)) return FOOD.cache.get(key);
  const q=`[out:json][timeout:20];nwr["amenity"~"^(fast_food|cafe|restaurant)$"](around:4000,${c.lat},${c.lng});out center tags 200;`;
  const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q)});
  if(!r.ok) throw new Error("lookup failed");
  const d=await r.json();
  const list=d.elements.map(e=>{ const t=e.tags||{}; return {name:t.name||t.brand, brand:t.brand||"", amenity:t.amenity, cuisine:(t.cuisine||"").split(";")[0].replace(/_/g," "), drive:t.drive_through==="yes", hours:t.opening_hours||"", lat:e.lat??(e.center&&e.center.lat), lng:e.lon??(e.center&&e.center.lon), street:[t["addr:housenumber"],t["addr:street"]].filter(Boolean).join(" ")}; }).filter(p=>p.name&&p.lat);
  FOOD.cache.set(key,list); return list;
}
function rankFood(list, from, to){
  return list.map(p=>{ const det = to ? legMiles(from,p)+legMiles(p,to)-legMiles(from,to) : legMiles(from,p)*2;
    const tier = p.amenity==="fast_food" ? 0 : (p.amenity==="cafe"||QUICK.test(p.cuisine)) ? 1 : 2;
    return {...p, mins:Math.max(1,Math.round(det/MPH*60)), tier, dist:legMiles(from,p)}; })
    .sort((a,b)=>(a.mins+a.tier*6)-(b.mins+b.tier*6)).slice(0,30);
}
function dFood(key){
  const F=S.food||{};
  const kinds=[["quick","Quick"],["drive","Drive-thru"],["all","Everything"]];
  let b=`<p class="lede" style="font-size:14px">${esc(F.where||"Finding where you are…")}</p>
    <div class="chips">${kinds.map(([k,l])=>`<button type="button" class="chip" data-act="food-kind" data-v="${k}" aria-pressed="${(F.kind||"quick")===k}">${l}</button>`).join("")}</div>`;
  if(F.err) b+=`<div class="note">${esc(F.err)}</div>`;
  if(!F.list && !F.err) b+=`<p class="lede">Looking up places…</p>`;
  if(F.list){
    let L=F.list; if((F.kind||"quick")==="quick") L=L.filter(p=>p.tier<2); if(F.kind==="drive") L=L.filter(p=>p.drive);
    b+= L.length ? `<div class="rows">${L.slice(0,12).map(p=>{ const via=F.to&&F.toAddr;
      const apple = via ? appleDir(F.toAddr,[`${p.lat},${p.lng}`]) : appleDir(`${p.lat},${p.lng}`);
      const google = via ? googleDir(F.toAddr,[`${p.lat},${p.lng}`]) : googleDir(`${p.lat},${p.lng}`);
      return `<div class="row food" style="cursor:default"><span class="lbl">${p.mins<=3?"+"+p.mins+" min":"+"+p.mins+" min"}</span>
      <span class="m"><span class="n">${esc(p.name)}</span><span class="s">${esc([p.amenity==="fast_food"?"Fast food":p.amenity==="cafe"?"Café":"Restaurant", p.cuisine, p.drive?"drive-thru":""].filter(Boolean).join(" · "))} · ${p.dist.toFixed(1)} mi${p.hours?` · ${esc(p.hours.length>40?p.hours.slice(0,40)+"…":p.hours)}`:""}</span></span>
      <span class="r" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><a class="btn small" href="${esc(apple)}" target="_blank" rel="noopener">Apple</a><a class="btn small" href="${esc(google)}" target="_blank" rel="noopener">Google</a></span></div>`; }).join("")}</div>
      <p class="count" style="font-size:12px">"+ min" is the extra drive time on the way${F.toName?` to ${esc(F.toName)}`:""}. Place list from OpenStreetMap, so hours can be out of date.</p>`
      : `<p class="lede">Nothing like that nearby. Try "Everything".</p>`;
  }
  return drawerShell("Lunch","I'm hungry",b);
}
async function openFood(key){
  S.food={kind:"quick"}; openDrawer("food",key);
  const [d,after]=String(key||"").split("|");
  let from=null, to=null, where="";
  const stops=stopsFor(d||todayISO(),S.team!=="all"?S.team:((PL.me()||{}).crew||"all")).filter(s=>hasLL(s.j));
  if(after!==undefined && after!=="live"){ const i=Number(after), A=stops[i], B=stops[i+1];
    from=A?A.j:shop(); to=B?B.j:null; where=A?`After ${clientOf(A.j).name||"this stop"}${B?`, on the way to ${clientOf(B.j).name||"the next stop"}`:""}`:"Near the shop";
    S.food.to=to; S.food.toAddr=B?addrOf(B.j):""; S.food.toName=B?clientOf(B.j).name:"";
  } else {
    try{ const p=await new Promise((res,rej)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:8000,maximumAge:120000}):rej(new Error("no gps")));
      from={lat:p.coords.latitude,lng:p.coords.longitude}; where="Near you"; }
    catch(e){ const nxt=stops.find(s=>!isDone(s.j.id,s.v.id)); from=nxt?nxt.j:shop(); where=nxt?`Near ${clientOf(nxt.j).name} (couldn't get your location)`:"Near the shop (couldn't get your location)"; }
    const nxt=stops.find(s=>!isDone(s.j.id,s.v.id) && (!from.id || s.j.id!==from.id));
    if(nxt){ to=nxt.j; S.food.to=to; S.food.toAddr=addrOf(nxt.j); S.food.toName=clientOf(nxt.j).name; where+=`, on the way to ${clientOf(nxt.j).name||"the next stop"}`; }
  }
  S.food.where=where; renderDrawer();
  try{ const raw=await findFood(from); S.food.list=rankFood(raw,from,to); }
  catch(e){ S.food.err="Couldn't load nearby places right now. Use the Apple Maps or Google search buttons on the lunch stop instead."; }
  if(S.drawer&&S.drawer.kind==="food") renderDrawer();
}
