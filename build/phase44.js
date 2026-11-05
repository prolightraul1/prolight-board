/* ---------- My pay statement (Raul): per-job breakdown to send with payroll ---------- */
function myStatementData(){
  const W=payWeek(), id=S.me.id, p=W.people.find(x=>x.id===id)||{mgmtJobs:[],sales:[],mgmt:0,comm:0,jobPay:0,regPay:0,otPay:0,hrs:0,jobs:[]};
  const pl=planFor(id,W.days[0]);
  const why=x=>{ const cs=jobCrews(x.j).map(teamName), f=S.fin.get(x.j.id)||{};
    if(!x.self) return "Management fee"+(cs.length?` (installed by ${cs.join(" + ")})`:"");
    if(f.selfInstall===true) return "Installed it myself (marked on the job)";
    return cs.length>1?`Installed with ${cs.filter(c=>!/^raul\b/i.test(c)).join(" + ")}: ${pl.mgmtPct||3}% + 10% ÷ ${cs.length} crews`:"Installed it myself (Raul crew only)"; };
  const fees=p.mgmtJobs.slice().sort((a,b)=>String(a.day).localeCompare(String(b.day))).map(x=>({day:x.day,client:clientOf(x.j).name||"",kind:x.j.source==="tcl"?"TCL":"ProLight",price:x.base,pct:x.pct,why:why(x),amt:x.amt}));
  const sales=p.sales.slice().sort((a,b)=>String(a.earnedOn).localeCompare(String(b.earnedOn))).map(s=>({day:s.earnedOn,client:clientOf(s.job).name||"",lead:leadLabel(s.type),base:s.base,pct:s.pct,amt:s.comm}));
  const hourly=(p.regPay||0)+(p.otPay||0);
  return {W,name:staffName(id),plan:planText(pl),fees,sales,feeTot:p.mgmt||0,commTot:p.comm||0,jobPay:p.jobPay||0,hourly,hrs:p.hrs||0,total:(p.mgmt||0)+(p.comm||0)+(p.jobPay||0)+hourly};
}
function myStatementPrint(){
  const D=myStatementData(), w=window.open("","_blank"); if(!w){ toast("Allow pop-ups to print"); return; }
  const wk=`${fmtDay(D.W.days[0],{month:"long",day:"numeric"})} – ${fmtDay(D.W.days[6],{month:"long",day:"numeric",year:"numeric"})}`;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Pay statement ${esc(D.name)} ${esc(D.W.days[0])}</title><style>body{font:13px system-ui,sans-serif;margin:32px;color:#111}h1{margin:0 0 2px;font-size:22px}h2{margin:24px 0 0;font-size:15px}table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#555}td.r,th.r{text-align:right}tfoot td{font-weight:700;border-top:2px solid #111}.sum{display:grid;grid-template-columns:repeat(4,auto);gap:4px 24px;justify-content:start;margin-top:14px}.sum b{font-size:18px}small{color:#555}</style>
    <h1>Pay statement · ${esc(D.name)}</h1><div>ProLight Tallahassee · pay week ${esc(wk)}</div><div><small>Pay plan: ${esc(D.plan)} · +10% on top (13%) on jobs I install alone; with other crews 3% + 10% split by crew · sales commission 10% inbound / 14% outbound</small></div>
    <div class="sum"><span>Management &amp; install<br><b>${money2(D.feeTot)}</b></span><span>Sales commission<br><b>${money2(D.commTot)}</b></span>${D.hourly||D.jobPay?`<span>Other<br><b>${money2(D.hourly+D.jobPay)}</b></span>`:""}<span>Total owed<br><b>${money2(D.total)}</b></span></div>
    <h2>Management &amp; install fees · installs finished this week</h2>
    ${D.fees.length?`<table><thead><tr><th>Finished</th><th>Customer</th><th>Job</th><th class="r">Job price</th><th class="r">%</th><th>How it's figured</th><th class="r">Pay</th></tr></thead><tbody>${D.fees.map(f=>`<tr><td>${esc(fmtDay(f.day,{month:"short",day:"numeric"}))}</td><td>${esc(f.client)}</td><td>${f.kind}</td><td class="r">${money2(f.price)}</td><td class="r">${f.pct}%</td><td>${esc(f.why)}</td><td class="r">${money2(f.amt)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="6">Total</td><td class="r">${money2(D.feeTot)}</td></tr></tfoot></table>`:`<p><small>No installs finished this week.</small></p>`}
    <h2>Sales commission · earned this week</h2>
    ${D.sales.length?`<table><thead><tr><th>Earned</th><th>Customer</th><th>Lead</th><th class="r">Job amount</th><th class="r">%</th><th class="r">Commission</th></tr></thead><tbody>${D.sales.map(s=>`<tr><td>${esc(fmtDay(s.day,{month:"short",day:"numeric"}))}</td><td>${esc(s.client)}</td><td>${esc(s.lead)}</td><td class="r">${money2(s.base)}</td><td class="r">${s.pct}%</td><td class="r">${money2(s.amt)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="5">Total</td><td class="r">${money2(D.commTot)}</td></tr></tfoot></table>`:`<p><small>No commission earned this week. A sale counts when it's recorded on the job with me as the seller and the install is checked off.</small></p>`}
    ${D.hourly||D.jobPay?`<h2>Other</h2><p>${D.hourly?`Hourly: ${h1(D.hrs)} h · ${money2(D.hourly)}<br>`:""}${D.jobPay?`Job %: ${money2(D.jobPay)}`:""}</p>`:""}
    <p><small>Percentages are figured on the full job price (TCL jobs included). A job counts in the week its last install day was checked off on the ProLight board. Prepared ${esc(new Date().toLocaleString("en-US"))}.</small></p><script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
}
function myStatementCsv(){
  const D=myStatementData(), f=n=>(+n||0).toFixed(2);
  const rows=[["Pay statement",D.name],["Pay week",`${D.W.days[0]} to ${D.W.days[6]}`],["Pay plan",D.plan],[],
    ["Management & install fees"],["Finished","Customer","Job","Job price","%","How it's figured","Pay"],...D.fees.map(x=>[x.day,x.client,x.kind,f(x.price),x.pct,x.why,f(x.amt)]),["Total","","","","","",f(D.feeTot)],[],
    ["Sales commission"],["Earned","Customer","Lead","Job amount","%","Commission"],...D.sales.map(s=>[s.day,s.client,s.lead,f(s.base),s.pct,f(s.amt)]),["Total","","","","",f(D.commTot)],[],
    ...(D.hourly||D.jobPay?[["Hourly",f(D.hourly)],["Job %",f(D.jobPay)]]:[]),["Total owed",f(D.total)]];
  download(`Pay-statement-${D.name.split(" ")[0]}-${D.W.days[0]}.csv`, rows);
}
