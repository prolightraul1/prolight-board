# Time fix requests + ShipShape out of payroll hours. Applied after phase7.py.
P8 = open(pathlib.Path(__file__).with_name('phase8.js')).read()
rep('\n/* ---------- render ---------- */\n', P8 + '\n/* ---------- render ---------- */\n')

# clock-ins made with no signal are marked, so the server accepts them when they arrive late
rep('await S.db.collection("log").add({kind:"clock",jobId:jid,visitId:vid,by:S.me.id,in:now,out:null,auto:!!auto,at:now});',
    'await S.db.collection("log").add({kind:"clock",jobId:jid,visitId:vid,by:S.me.id,in:now,out:null,auto:!!auto,at:now,...(navigator.onLine?{}:{offline:true})});')
rep('await S.db.collection("log").add({kind:"clock",general:true,where,jobId:"",visitId:"",by:S.me.id,in:now,out:null,auto:!!auto,at:now});',
    'await S.db.collection("log").add({kind:"clock",general:true,where,jobId:"",visitId:"",by:S.me.id,in:now,out:null,auto:!!auto,at:now,...(navigator.onLine?{}:{offline:true})});')

# pending (not yet approved) time never counts
rep('function myToday(){ const t=todayISO(), out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&e.by===S.me.id&&e.in&&isoOf(e.in)===t) out.push({id,...e}); return out; }',
    'function myToday(){ const t=todayISO(), out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&!e.pending&&e.by===S.me.id&&e.in&&isoOf(e.in)===t) out.push({id,...e}); return out; }')
rep('function clocks(jid,vid){ const out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&e.jobId===jid', 'function clocks(jid,vid){ const out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&!e.pending&&e.jobId===jid')
rep('''  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.in&&days.includes(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));''',
    '''  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&!e.pending&&e.in&&days.includes(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));''')
rep('''  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.in&&set.has(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));''',
    '''  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&!e.pending&&e.in&&set.has(isoOf(e.in))&&!isSS(e.by)).sort((a,b)=>a.in.localeCompare(b.in));''')

# ShipShape: no day clock (shop/driving), not in payroll or pay rates
rep('async function startGeneral(where,auto){\n  if(myOpenGeneral()||myOpenClock()||dayEnded()) return;', 'async function startGeneral(where,auto){\n  if(isSS(S.me.id)||myOpenGeneral()||myOpenClock()||dayEnded()) return;')
rep('function dayBtn(){\n  if(!S.me.canLog) return "";', 'function dayBtn(){\n  if(!S.me.canLog||isSS(S.me.id)) return "";')
rep('  for(const id of Object.keys(S.payroll.rates||{})) if(payRate(id)>0 && (PL.staff().find(x=>x.id===id)||{}).active) touch(id);',
    '  for(const id of Object.keys(S.payroll.rates||{})) if(payRate(id)>0 && !isSS(id) && (PL.staff().find(x=>x.id===id)||{}).active) touch(id);')
rep('  const ppl=PL.staff().filter(p=>p.active);\n  return `<h2 class="h-sec" style="margin-top:18px">Pay rates</h2>',
    '  const ppl=PL.staff().filter(p=>p.active&&!isSS(p.id));\n  return `<h2 class="h-sec" style="margin-top:18px">Pay rates</h2>')
rep('<p class="count" style="font-size:13px">Only people with money access can see pay rates.</p>`;', '<p class="count" style="font-size:13px">Only people with money access can see pay rates. ShipShape crews aren\'t on ProLight payroll, so their time is tracked per job only.</p>`;')
rep('''<td>${esc(who(r.by))}</td><td>${r.general?''', '''<td>${esc(who(r.by))}${isSS(r.by)?' <small class="count">(ShipShape · job tracking)</small>':""}</td><td>${r.general?''')

# request queue for managers: on Hours and Payroll, plus an Office badge
rep('''function vPayroll(){
  const W=payWeek()''', '''function vPayroll(){
  if(pendingReqs().length) return reqBlockWrap()+vPayroll2();
  return vPayroll2();
}
const reqBlockWrap = () => reqBlock()+`<p class="count" style="font-size:13px">Approve or deny time fixes before you send payroll.</p>`;
function vPayroll2(){
  const W=payWeek()''')
rep('function vHours(){\n', 'function vHours(){\n  return reqBlock()+vHours2();\n}\nfunction vHours2(){\n')
rep("  { const sc=svcCount();", "  { const rc=reqCount(); if(rc) document.querySelectorAll('#railNav [data-v=\"office\"],#tabNav [data-v=\"office\"]').forEach(b=>b.insertAdjacentHTML(\"beforeend\",`<i class=\"nbadge\">${rc>9?\"9+\":rc}</i>`)); }\n  { const sc=svcCount();")

# employees: My time in the account drawer
rep('  <div class="f"><label>My headshot</label>', '  ${myTime()}\n  <div class="f"><label>My headshot</label>')

rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="treq"?dTimeReq(D.id):')
rep('  if(ev.target.id==="saleForm") return saveSale(ev.target);', '  if(ev.target.id==="treqForm") return saveTimeReq(ev.target);\n  if(ev.target.id==="saleForm") return saveSale(ev.target);')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "treq-fix": openDrawer("treq","fix|"+v); break;
    case "treq-add": openDrawer("treq","add|"); break;
    case "treq-cancel": try{ await S.db.doc("log/"+v).update({status:"canceled"}); const r=S.log.get(v); if(r&&r.isNew&&r.target) await S.db.doc("log/"+r.target).delete().catch(()=>{}); toast("Request canceled"); renderDrawer(); }catch(e){ fail(e,"cancel it"); } break;
    case "treq-ok": await decideReq(v,true); break;
    case "treq-no": await decideReq(v,false); break;
''')
