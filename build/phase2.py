# Money ledger, ShipShape owner view, trucks, lunch, maps app choice. Applied by build.py after features.py.
P2 = open(pathlib.Path(__file__).with_name('phase2.js')).read()
rep('\n/* ---------- render ---------- */\n', P2 + '\n/* ---------- render ---------- */\n')

# maps: per-stop directions open in the person's chosen app
rep('const mapsUrl = a => "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(a);', 'const mapsUrl = a => dirUrl(a);')

# money: new screen replaces the old one; payments ride in the fin collection
rep_between('function vMoney(){', 'function briefText(', '')
rep('db.collection("fin").onSnapshot(s=>{ const m=new Map(); for(const d of s.docs){ if(d.id==="settings") S.finSet=d.data(); else m.set(d.id,d.data()); } S.fin=m; refresh(); }',
    'db.collection("fin").onSnapshot(s=>{ const m=new Map(), pays=new Map(); for(const d of s.docs){ if(d.id==="settings") S.finSet=d.data(); else if(d.id.startsWith("pay-")) pays.set(d.id,d.data()); else m.set(d.id,d.data()); } S.fin=m; S.pays=pays; S.stmt=null; refresh(); }')
rep('db.doc("settings/board").onSnapshot(s=>{ S.settings=s.exists?s.data():{}; refresh(); }, e=>{});',
    'db.doc("settings/board").onSnapshot(s=>{ S.settings=s.exists?s.data():{}; refresh(); }, e=>{});\n  db.collection("settings").onSnapshot(s=>{ S.dayCfg=new Map(s.docs.filter(d=>d.id.startsWith("day-")).map(d=>[d.id.slice(4),d.data()])); refresh(); }, e=>{});')

# partner (ShipShape owner) access
rep('if(S.me.owner||S.me.money||S.me.manage) v.push(["office","Office"]);', 'if(S.me.owner||S.me.money||S.me.manage||S.me.partner) v.push(["office",S.me.partner&&!S.me.money&&!S.me.owner?"Payouts":"Office"]);')
rep('if(!(S.me.owner||S.me.money||S.me.manage)) return', 'if(!(S.me.owner||S.me.money||S.me.manage||S.me.partner)) return')
rep('S.me.owner&&["settings","Settings"]].filter(Boolean);', 'S.me.owner&&["settings","Settings"],(S.me.partner||S.me.money)&&["statement",S.me.money?"ShipShape view":"My payouts"]].filter(Boolean);')
rep('else if(S.office==="hours") h+=vHours();', 'else if(S.office==="hours") h+=vHours(); else if(S.office==="statement") h+=vStatement();')
rep('S.me.canLog=!!P.can_log; S.me.name=P.name||""; }', 'S.me.canLog=!!P.can_log; S.me.name=P.name||""; S.me.partner=P.partner||""; }')
rep('const PRESETS={ member:{can_log:true,all_crews:false,can_edit:false,can_money:false,can_manage:false},',
    'const PRESETS={ ssowner:{can_log:true,all_crews:false,can_edit:false,can_money:false,can_manage:false,partner:"shipshape"}, member:{can_log:true,all_crews:false,can_edit:false,can_money:false,can_manage:false,partner:""},')
rep('lead:{can_log:true,all_crews:true,can_edit:false,can_money:false,can_manage:false},', 'lead:{can_log:true,all_crews:true,can_edit:false,can_money:false,can_manage:false,partner:""},')
rep('office:{can_log:true,all_crews:true,can_edit:true,can_money:false,can_manage:false},', 'office:{can_log:true,all_crews:true,can_edit:true,can_money:false,can_manage:false,partner:""},')
rep('manager:{can_log:true,all_crews:true,can_edit:true,can_money:true,can_manage:true} };', 'manager:{can_log:true,all_crews:true,can_edit:true,can_money:true,can_manage:true,partner:""} };')
rep('[["member","Crew member"],["lead","Crew lead"],["office","Office"],["manager","Manager"]]', '[["member","Crew member"],["lead","Crew lead"],["office","Office"],["manager","Manager"],["ssowner","ShipShape owner"]]')
rep('</span></label>`).join("")}</div>\n    </fieldset>',
    '</span></label>`).join("")}<label><input type="checkbox" id="pp-partner" ${p.partner==="shipshape"?"checked":""}><span>ShipShape owner statement<small>Sees ShipShape\'s payout on each ShipShape job and the payments made to ShipShape. Never sees job prices or ProLight\'s numbers.</small></span></label></div>\n    </fieldset>')
rep('  for(const [k] of PERMS) out[k]=g("pp-"+k).checked;\n', '  for(const [k] of PERMS) out[k]=g("pp-"+k).checked;\n  out.partner=g("pp-partner").checked?"shipshape":"";\n')
rep('p.can_log&&"Checks off",', 'p.partner&&"ShipShape statement",p.can_log&&"Checks off",')
rep('Quick presets when adding someone:', 'Quick presets when adding someone: <b>ShipShape owner</b> sees ShipShape\'s jobs and only ShipShape\'s payouts.')

# route list: lunch break between stops
rep('list=`<div class="stops">${stops.map((s,i)=>stopCard(s,i,stops.length)).join("")}</div>`;',
    'list=`<div class="stops">${stops.map((s,i)=>stopCard(s,i,stops.length)+(S._eta&&S._eta.lunch&&S._eta.lunch.after===i?lunchCard(S._eta.lunch,d):"")).join("")}</div>`;')
# night text: lunch line
rep('    if(team==="all") L.push("   Crew: "+teamName(crewOf(s.j,s.v)));\n    L.push(""); });',
    '    if(team==="all") L.push("   Crew: "+teamName(crewOf(s.j,s.v)));\n    L.push("");\n    if(eta.lunch&&eta.lunch.after===i) L.push(`LUNCH ~${minTxt(eta.lunch.min)} (${LUNCH_MIN} min)`, ""); });')

# drawers
rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="pay"?dPay(): D.kind==="assign"?dAssign(D.id): D.kind==="food"?dFood(D.id):')
rep('  <form class="form" id="pinForm" autocomplete="off">',
    '  <div class="f"><label>Directions open in</label><div class="seg" role="group">${[["apple","Apple Maps"],["google","Google Maps"]].map(([k,l])=>`<button type="button" data-act="maps-app" data-v="${k}" aria-pressed="${MAPS_APP()===k}">${l}</button>`).join("")}</div></div>\n  <form class="form" id="pinForm" autocomplete="off">')
rep('  if(ev.target.id==="pinForm") return saveMyPin();',
    '''  if(ev.target.id==="payForm") return savePay();
  if(ev.target.id==="assignForm") return saveAssign(ev.target.dataset.key,{truck:$("#as-truck").value,trailer:$("#as-trailer").value,note:$("#as-note").value.trim()});
  if(ev.target.id==="pinForm") return saveMyPin();''')

# actions
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "maps-app": ls("mapsApp",v); renderDrawer(); renderMain(); toast(v==="apple"?"Directions will open in Apple Maps":"Directions will open in Google Maps"); break;
    case "mtab": S.mtab=v; S.mfilter="open"; renderMain(); break;
    case "mfilter": S.mfilter=v; renderMain(); break;
    case "pay-new": S.form={pay:{party:v,amount:"",date:todayISO(),method:"Check",memo:"",jobs:new Set(),manual:false}}; openDrawer("pay"); break;
    case "pay-del-ask": S.delPay=id; renderMain(); setTimeout(()=>{ if(S.delPay===id){ S.delPay=null; renderMain(); } },5000); break;
    case "pay-del": await delPay(id); break;
    case "stmt-copy": { const txt=stmtText(v); try{ await navigator.clipboard.writeText(txt); toast("Statement copied"); }catch(e){ toast("Couldn't copy. Use Download CSV instead."); } break; }
    case "stmt-csv": stmtCsv(v); break;
    case "stmt-reload": S.stmt=null; renderMain(); break;
    case "assign-truck": openDrawer("assign",v); break;
    case "assign-copy": { const [d,c]=v.split("|"); const pv=assignOf(addDays(d,-1),c)||{}; $("#as-truck").value=pv.truck||""; $("#as-trailer").value=pv.trailer||""; $("#as-note").value=pv.note||""; break; }
    case "hungry": openFood(v); break;
    case "food-kind": S.food.kind=v; renderDrawer(); break;
''')
rep('  if(t.id==="compose-files"){', '''  if(t.id&&t.id.startsWith("pj-")&&S.form&&S.form.pay){ const jid=t.id.slice(3); t.checked?S.form.pay.jobs.add(jid):S.form.pay.jobs.delete(jid);
    if(!S.form.pay.manual){ let tot=0; document.querySelectorAll('#payForm input[id^="pj-"]:checked').forEach(x=>tot+=Number(x.dataset.jamt)); $("#py-amount").value=tot?tot.toFixed(2):""; } return; }
  if(t.id==="compose-files"){''')
rep('  else if(t.id==="compose-text"){ S.compose.text=t.value; }', '  else if(t.id==="compose-text"){ S.compose.text=t.value; }\n  else if(t.id==="py-amount"&&S.form&&S.form.pay){ S.form.pay.manual=true; }')

rep('.who-btn{', '''.mhero{background:var(--night);color:var(--night-ink);border-radius:var(--r);padding:18px 18px 16px;display:grid;gap:4px}
.mhero .eyebrow{color:var(--night-dim)}
.mhero-v{font-family:var(--f-sign);font-weight:900;font-size:52px;line-height:1;color:var(--amber);font-variant-numeric:tabular-nums}
.mhero span:last-child{color:var(--night-dim);font-size:14px}
.mgrid{display:grid;grid-template-columns:1fr;gap:12px}
.mcard{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;display:grid;gap:10px;align-content:start;min-width:0}
.mcard header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.mbig{font-family:var(--f-sign);font-weight:800;font-size:36px;line-height:1.05;font-variant-numeric:tabular-nums}
.mlogo{height:44px;width:auto;flex:none}
.mcard .mlogo.ss{height:30px;background:var(--night);padding:6px 8px;border-radius:4px}
.mhero .mlogo.ss{background:none;padding:0}
.pbar{height:8px;border-radius:4px;background:var(--line);overflow:hidden}
.pbar span{display:block;height:100%;background:var(--cord)}
.mstat-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px}
tfoot td{border-top:2px solid var(--line);border-bottom:0}
.truckline{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;font-size:14px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:8px 12px}
.truckline b{font-family:var(--f-mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-right:6px;color:var(--ink-2)}
.stop.lunch .ticket{background:var(--cord-soft);border-style:dashed}
.lunch-dot{width:16px;height:16px;border-radius:50%;background:var(--cord);margin-top:22px;box-shadow:0 0 0 4px var(--bg)}
.vt.lunchtag{background:var(--cord);color:#fff}
.row.food .m .n{white-space:normal}
@media (min-width:960px){ .mgrid{grid-template-columns:repeat(3,minmax(0,1fr))} }
.who-btn{''')
