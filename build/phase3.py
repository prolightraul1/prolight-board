# Several crews/trucks per visit, partly done + return visits, TCL extra charges, chat. Applied by build.py after phase2.py.
P3 = open(pathlib.Path(__file__).with_name('phase3.js')).read()
rep('\n/* ---------- render ---------- */\n', P3 + '\n/* ---------- render ---------- */\n')

# --- several crews on one visit, per-crew route order
rep('for(const v of (j.visits||[])) if(v.date===date && (team==="all"||crewOf(j,v)===team)) out.push({j,v}); }\n  return out.sort((a,b)=>(a.v.order??999)-(b.v.order??999) ||',
    'for(const v of (j.visits||[])) if(v.date===date && (team==="all"||visitCrews(j,v).includes(team))) out.push({j,v}); }\n  return out.sort((a,b)=>ordOf(a.v,team)-ordOf(b.v,team) ||')
rep('const t=base.find(x=>x.id===s.v.id); if(t&&t.order!==idx+1){ t.order=idx+1; changes.set(s.j.id,base); } });',
    'const t=base.find(x=>x.id===s.v.id); if(t&&ordOf(t,crewId)!==idx+1){ setOrd(s.j,t,crewId,idx+1); changes.set(s.j.id,base); } });')
rep('const j=S.jobs.get(jobId), v=(j.visits||[]).find(x=>x.id===visitId); const crew=crewOf(j,v);',
    'const j=S.jobs.get(jobId), v=(j.visits||[]).find(x=>x.id===visitId); const crew=S.team!=="all"&&visitCrews(j,v).includes(S.team)?S.team:crewOf(j,v);')
rep('list.forEach((s,idx)=>{ if(s.v.order!==idx+1){ const base=changes.get(s.j.id)||(S.jobs.get(s.j.id).visits||[]).map(x=>({...x})); const t=base.find(x=>x.id===s.v.id); t.order=idx+1; changes.set(s.j.id,base); } });',
    'list.forEach((s,idx)=>{ if(ordOf(s.v,crew)!==idx+1){ const base=changes.get(s.j.id)||(S.jobs.get(s.j.id).visits||[]).map(x=>({...x})); const t=base.find(x=>x.id===s.v.id); setOrd(s.j,t,crew,idx+1); changes.set(s.j.id,base); } });')

# stop card: all crews, trucks, partly done
rep('${S.team==="all"?`<span class="crewtag">${esc(teamName(crew))}</span>`:""}', '${crewTags(j,v)}')
rep('      ${a?`<div class="t-addr">${esc(a)}</div>`:""}\n      ${(j.scope||j.rooflineFt)?', '      ${a?`<div class="t-addr">${esc(a)}</div>`:""}\n      ${visitExtrasLine(v)}\n      ${(j.scope||j.rooflineFt)?')
rep('<div class="t-actions">${doneBtn}${clockBtn(j,v)}', '<div class="t-actions">${doneBtn}${d?"":partialBtn(j,v)}${clockBtn(j,v)}')
rep('const notes=[c.gate?`Access: ${c.gate}`:"", j.notes||"", v.note||""].filter(Boolean).join("\\n");',
    'const pp=isPartial(j.id,v.id); const notes=[c.gate?`Access: ${c.gate}`:"", j.notes||"", v.note||"", pp&&!d?`Left to do: ${pp.left}`:""].filter(Boolean).join("\\n");')

# job drawer visit rows
rep('<small>${esc(teamName(crewOf(j,v)))}${d?', '<small>${esc(visitCrews(j,v).map(teamName).join(" + ")||"Unassigned")}${d?')
rep('${onSite(j.id,v.id)}</small></div>${act}</div>', '${onSite(j.id,v.id)}</small>${visitMore(j,v)}</div>${act}</div>')

# night text
rep('    if(team==="all") L.push("   Crew: "+teamName(crewOf(s.j,s.v)));\n    L.push("");\n    if(eta.lunch',
    '''    { const cs=visitCrews(s.j,s.v); if(team==="all") L.push("   Crew: "+(cs.map(teamName).join(" + ")||"Unassigned")); else if(cs.length>1) L.push("   Also on this job: "+cs.filter(c=>c!==team).map(teamName).join(", "));
      const tk=visitTrucks(s.v); if(tk.length) L.push("   Trucks on this job: "+tk.join(", "));
      if(s.v.returnOf) L.push("   RETURN VISIT, finish what was left"); }
    L.push("");
    if(eta.lunch''')

# partly done in the log
rep('let doneMap = new Map(), logByJob = new Map();', 'let doneMap = new Map(), logByJob = new Map(), partialMap = new Map();')
rep('doneMap=new Map(); logByJob=new Map();', 'doneMap=new Map(); logByJob=new Map(); partialMap=new Map();')
rep('if(e.kind==="done") doneMap.set(e.jobId+"|"+e.visitId, x); }',
    'if(e.kind==="done") doneMap.set(e.jobId+"|"+e.visitId, x); else if(e.kind==="partial"){ const k=e.jobId+"|"+e.visitId, o=partialMap.get(k); if(!o||String(o.at)<String(e.at)) partialMap.set(k,x); } }')
rep('  if(vs.some(v=>v.type==="install"&&isDone(j.id,v.id))) return "lit";',
    '  if(vs.some(v=>isPartial(j.id,v.id)&&!isDone(j.id,v.id)&&!vs.some(x=>x.returnOf===v.id&&isDone(j.id,x.id)))) return "partial";\n  if(vs.some(v=>v.type==="install"&&isDone(j.id,v.id))) return "lit";')
rep('lit:"Installed",', 'partial:"Partly done",lit:"Installed",')
rep('scheduled:"dim",', 'scheduled:"dim",partial:"dim",')
rep('.st.lit{color:var(--amber-text)}', '.st.lit,.st.partial{color:var(--amber-text)}')
rep('  if(e.kind==="clock") return clockEntry(e);', '  if(e.kind==="partial") return partialEntry(e); if(e.kind==="clock") return clockEntry(e);')
rep('  if(needInstall.length) h+=`<h2 class="h-sec">Booked, no install date', '  h+=returnBlock();\n  if(needInstall.length) h+=`<h2 class="h-sec">Booked, no install date')

# extra charges billed to TCL
rep('  const inc = j.source==="tcl" ? p*R.tcl : p, ss=p*sp;\n  return {price:p,incoming:inc,ss,net:inc-ss,ssPct:sp,custom};',
    '  const ex = j.source==="tcl" ? extraTotal(f) : 0, inc = (j.source==="tcl" ? p*R.tcl : p) + ex, ss=p*sp;\n  return {price:p,incoming:inc,ss,net:inc-ss,ssPct:sp,custom,extras:ex};')
rep('const tcl=R.filter(r=>r.j.source==="tcl"&&r.s.price),', 'const tcl=R.filter(r=>r.j.source==="tcl"&&(r.s.price||r.s.extras)),')
rep('<td class="r"><b>${money2(r.s.incoming)}</b></td>`', '<td class="r"><b>${money2(r.s.incoming)}</b>${r.s.extras?`<small class="count" style="display:block">incl. ${money2(r.s.extras)} extras</small>`:""}</td>`')
rep("${T.noPrice?`<div class=\"note\">${T.noPrice} job${T.noPrice>1?\"s have\":\" has\"} no price and ${T.noPrice>1?\"aren't\":\"isn't\"} counted.</div>`:\"\"}",
    "${T.noPrice?`<div class=\"note\">${T.noPrice} job${T.noPrice>1?\"s have\":\" has\"} no price and ${T.noPrice>1?\"aren't\":\"isn't\"} counted.</div>`:\"\"}${extraNeedNote()}")
rep('      ${f.privateNote?`<div class="note">${esc(f.privateNote)}</div>`:""}</section>`; }',
    '      ${f.privateNote?`<div class="note">${esc(f.privateNote)}</div>`:""}${j.source==="tcl"||extrasOf(f).length?extrasHTML(j,f):""}</section>`; }')

# chat: nav, banner, loading
rep('const v=[["route","Route"],["jobs","Jobs"],["map","Map"],["week","Week"],["clients","Clients"]];', 'const v=[["route","Route"],["jobs","Jobs"],["map","Map"],["week","Week"],["chat","Chat"],["clients","Clients"]];')
rep('''  office:'<svg''', '''  chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
  office:'<svg''')
rep('''  $("#tabNav").innerHTML=items.map(([k,l])=>`<button type="button" data-act="view" data-v="${k}" aria-current="${S.view===k?"page":"false"}">${ICON[k]}${l}</button>`).join("");\n''',
    '''  $("#tabNav").innerHTML=items.map(([k,l])=>`<button type="button" data-act="view" data-v="${k}" aria-current="${S.view===k?"page":"false"}">${ICON[k]}${l}</button>`).join("");
  { const un=S.chatOff?0:unreadTotal(); if(un) document.querySelectorAll('#railNav [data-v="chat"],#tabNav [data-v="chat"]').forEach(b=>b.insertAdjacentHTML("beforeend",`<i class="nbadge">${un>9?"9+":un}</i>`)); }\n''')
rep('S.view==="week"?vWeek(): vOffice();', 'S.view==="week"?vWeek(): S.view==="chat"?vChat(): vOffice();\n  if(S.view==="chat") scrollChat();')
rep('  let h=`<div class="dayhead">', '  let h=annBanner()+`<div class="dayhead">')
rep('<div class="bar"><h1 class="h-view grow">Jobs</h1>', '<div class="bar"><h1 class="h-view grow">Jobs</h1><button type="button" class="btn phone-only" data-act="view" data-v="clients">Clients</button>')
rep('  db.collection("settings").onSnapshot(s=>{ S.dayCfg=', '  loadChat();\n  db.collection("settings").onSnapshot(s=>{ S.dayCfg=')

# drawers, forms, actions
rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="crewtruck"?dCrewTruck(D.id): D.kind==="partial"?dPartial(D.id): D.kind==="return"?dReturn(D.id):')
rep('  if(ev.target.id==="payForm") return savePay();', '''  if(ev.target.id==="ctForm") return saveCrewTruck(ev.target);
  if(ev.target.id==="partialForm"){ readPartialForm(); return savePartial(ev.target); }
  if(ev.target.id==="returnForm"){ const [a,b]=ev.target.dataset.key.split("|"); return addReturn(a,b,$("#rt-date").value,$("#rt-time").value,null,false).then(()=>openDrawer("job",a)).catch(e=>fail(e,"add the return visit")); }
  if(ev.target.id==="chatForm") return sendChat();
  if(ev.target.id==="payForm") return savePay();''')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "crewtruck": openDrawer("crewtruck",v); break;
    case "partial": S.form={partial:{reason:"",left:"",why:""}}; openDrawer("partial",v); S.form={partial:{reason:"",left:"",why:""}}; break;
    case "partial-reason": readPartialForm(); if(S.form&&S.form.partial){ S.form.partial.reason=v; renderDrawer(); } break;
    case "add-return": openDrawer("return",v); break;
    case "x-add": { const qty=Number(($("#x-qty").value||"1").replace(/[^0-9.]/g,""))||1, desc=$("#x-desc").value.trim(), pr=$("#x-price").value.replace(/[^0-9.]/g,"");
      if(!desc){ toast("Say what it was, like C9 bulbs, warm white"); $("#x-desc").focus(); break; }
      const f=S.fin.get(v)||{}; await saveExtras(v,[...extrasOf(f),{id:uid(),qty,desc,price:pr===""?null:Number(pr),at:new Date().toISOString(),by:S.me.id}]); toast(pr===""?"Added. Add the price when you have it.":"Charge added"); break; }
    case "x-price": { const [jid,xid]=v.split("|"), el=document.getElementById("xp-"+xid), pr=(el&&el.value||"").replace(/[^0-9.]/g,""); if(pr===""){ toast("Type the price for one"); break; }
      const f=S.fin.get(jid)||{}; await saveExtras(jid,extrasOf(f).map(x=>x.id===xid?{...x,price:Number(pr)}:x)); toast("Price added"); break; }
    case "x-del": { const [jid,xid]=v.split("|"), f=S.fin.get(jid)||{}; await saveExtras(jid,extrasOf(f).filter(x=>x.id!==xid)); toast("Removed"); break; }
    case "chat-open": { const tx=$("#chat-text"); if(tx&&S.chat.ch) S.chat.draft[S.chat.ch]=tx.value; S.chat.ch=v||null; renderMain(); break; }
    case "chat-del": try{ await PL.chatDelete(id); }catch(e){ toast("Couldn't delete that"); } break;
    case "ann-seen": { const M=chanMsgs("ann"); if(M.length) ls("read:"+S.me.id+":ann",M[M.length-1].at); renderMain(); break; }
''')

rep('.who-btn{', '''.crewtag+.crewtag{margin-left:-2px}
.vt.returntag{background:var(--ink);color:var(--bg)}
.btn.partial{border-color:var(--amber);color:var(--amber-text);cursor:default}
.pt-line{display:block;margin-top:4px;color:var(--amber-text)}
.entry.partial-e{border-left:3px solid var(--amber)}
.linkbtn{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}
.extras{display:grid;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)}
.xadd{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.nbadge{position:absolute;top:4px;right:calc(50% - 22px);min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--red);color:#fff;font:700 11px/18px var(--f-mono);font-style:normal;letter-spacing:0}
#railNav button,#tabNav button{position:relative}
#railNav .nbadge{position:static;margin-left:auto}
.ann{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;background:var(--night);color:var(--night-ink);border-left:4px solid var(--amber);border-radius:var(--r);padding:12px 14px;margin-bottom:12px;white-space:pre-wrap}
.ann .eyebrow{color:var(--amber)}
.ann .btn{background:var(--amber);border-color:var(--amber);color:#14110b;flex:none}
.chat{display:grid;grid-template-columns:1fr;gap:12px;min-height:0}
.chat-list{display:grid;gap:4px;align-content:start}
.chat-list .eyebrow{margin:10px 0 2px}
.chat-ch{display:flex;align-items:center;gap:10px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 12px;color:inherit;font:inherit;cursor:pointer;min-width:0}
.chat-ch.on{border-color:var(--ink)}
.chat-ch .m{display:grid;min-width:0;flex:1}
.chat-ch small{color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.badge{background:var(--red);color:#fff;border-radius:9px;min-width:20px;padding:0 6px;font:700 12px/20px var(--f-mono);font-style:normal;text-align:center}
.chat-thread{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:var(--r);min-height:60vh;max-height:calc(100dvh - 170px);overflow:hidden}
.chat-thread.empty-t{display:none;align-items:center;justify-content:center}
.chat-head{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.chat-day{align-self:center;font:600 11px var(--f-mono);text-transform:uppercase;letter-spacing:.08em;color:var(--ink-2);margin:6px 0}
.bub{max-width:82%;align-self:flex-start;background:var(--bg);border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:8px 11px;display:grid;gap:2px}
.bub.me{align-self:flex-end;background:var(--night);color:var(--night-ink);border-color:var(--night);border-radius:14px 14px 4px 14px}
.bub b{font-size:12px;color:var(--ink-2)}
.bub .txt{white-space:pre-wrap;word-break:break-word}
.bub small{font-size:11px;opacity:.7}
.chat-compose{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line);align-items:flex-end}
.chat-compose textarea{flex:1;min-height:42px;max-height:160px;resize:none;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:inherit}
.chat-thread .note{border-radius:0}
.chat .chat-thread{display:none}
.chat.open .chat-list{display:none}
.chat.open .chat-thread{display:flex}
.phone-only{display:inline-flex}
#tabNav [data-v="clients"]{display:none}
@media (min-width:960px){
  .phone-only{display:none}
  .chat{grid-template-columns:300px minmax(0,1fr)}
  .chat .chat-list,.chat.open .chat-list{display:grid}
  .chat .chat-thread{display:flex}
  .chat-thread.empty-t{display:flex}
  .chat-back{display:none}
  .chat-thread{max-height:calc(100dvh - 120px)}
}
.who-btn{''')

# Jobber imports: name the source, link back, fill in missing map pins
rep('function who(id){ if(!id) return "TCL import";', 'function who(id){ if(!id) return "TCL import"; if(id==="jobber") return "Jobber";')
rep('<button type="button" class="btn" data-act="client" data-id="${esc(j.clientId)}">Client</button></div>',
    '<button type="button" class="btn" data-act="client" data-id="${esc(j.clientId)}">Client</button>${j.jobberUrl&&S.me.owner?`<a class="btn" href="${esc(j.jobberUrl)}" target="_blank" rel="noopener">Jobber #${esc(j.jobberNo||"")} ↗</a>`:""}</div>')
rep('  const ready=()=>{ if(got.c&&got.j){ S.ready=true; } };', '  const ready=()=>{ if(got.c&&got.j){ S.ready=true; setTimeout(fillPins,4000); } };')

# ShipShape can take ProLight's own jobs too (default 30% of the job price)
rep('ss:(Number(S.finSet.ssRate)||30)/100 });', 'ss:(Number(S.finSet.ssRate)||30)/100, ssOwn:(Number(S.finSet.ssOwnRate)||30)/100 });')
rep('const sp = custom ? Number(f.ssPct)/100 : (j.source==="tcl"&&coOf(j.crew)==="shipshape" ? R.ss : 0);',
    'const sp = custom ? Number(f.ssPct)/100 : (coOf(j.crew)==="shipshape" ? (j.source==="tcl" ? R.ss : R.ssOwn) : 0);')
rep('<small>Percent of the TCL job price.</small></div></div></fieldset>',
    '<small>Percent of the TCL job price.</small></div><div class="f"><label for="s-ssown">ShipShape gets on ProLight jobs (%)</label><input id="s-ssown" inputmode="decimal" value="${esc(S.finSet.ssOwnRate??30)}"><small>When you give one of ProLight\'s own jobs to ShipShape. Percent of the job price.</small></div></div></fieldset>')
rep('ssRate:Number(g("s-ss"))||30})', 'ssRate:Number(g("s-ss"))||30,ssOwnRate:Number(g("s-ssown"))||30})')

# speed: one render per frame, memoized lists, map library only when the Map opens
rep('function refresh(){ renderMain(); if(S.drawer && (S.drawer.kind==="job"||S.drawer.kind==="client")) renderDrawer(); }',
    'function refresh(){ if(refresh.q) return; refresh.q=requestAnimationFrame(()=>{ refresh.q=0; renderMain(); if(S.drawer && (S.drawer.kind==="job"||S.drawer.kind==="client")) renderDrawer(); }); }')
rep('function jobsArr(){ return [...S.jobs.entries()].map(([id,d])=>({id,...d})); }',
    'let _jaSrc=null,_ja=[]; function jobsArr(){ if(_jaSrc!==S.jobs){ _jaSrc=S.jobs; _ja=[...S.jobs.entries()].map(([id,d])=>({id,...d})); STOPS.clear(); } return _ja.slice(); }\nconst STOPS=new Map(); let _stC=null,_stL=null;')
rep('function stopsFor(date, team){\n  const out=[];', 'function stopsFor(date, team){\n  jobsArr(); if(_stC!==S.clients||_stL!==S.log){ _stC=S.clients; _stL=S.log; STOPS.clear(); }\n  const ck=date+"|"+team; if(STOPS.has(ck)) return STOPS.get(ck).slice();\n  const out=[]; STOPS.set(ck,out);')
rep('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>\n', '')
rep('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">', '')
rep('function mountMap(){\n  const box=$("#map"); if(!box||!window.L) return;', '''let LLOAD=null;
function loadLeaflet(){
  if(window.L) return Promise.resolve(); if(LLOAD) return LLOAD;
  LLOAD=new Promise((ok,no)=>{ const c=document.createElement("link"); c.rel="stylesheet"; c.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; c.integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="; c.crossOrigin=""; document.head.appendChild(c);
    const s=document.createElement("script"); s.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="; s.crossOrigin=""; s.onload=ok; s.onerror=()=>{ LLOAD=null; no(); }; document.head.appendChild(s); });
  return LLOAD;
}
function mountMap(){
  const box=$("#map"); if(!box) return; if(!window.L){ loadLeaflet().then(()=>{ if(S.view==="map") mountMap(); }).catch(()=>toast("Couldn't load the map. Check your signal.")); return; }''')
rep('String(clientOf(a.j).name).localeCompare(String(clientOf(b.j).name)));\n}\nfunction recompute', 'String(clientOf(a.j).name).localeCompare(String(clientOf(b.j).name))).slice();\n}\nfunction recompute')

# Jobber sync card + auto sync
rep('    <div><button type="submit" class="btn amber">Save settings</button></div>', '    ${S.me.manage?jobberCard():""}\n    <div><button type="submit" class="btn amber">Save settings</button></div>')
rep('S.ready=true; setTimeout(fillPins,4000);', 'S.ready=true; setTimeout(fillPins,4000); setTimeout(jobberAuto,1500);')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "jb-sync": await jobberSync(false); break;
    case "jb-connect": try{ const r=await PL.jobber("connect"); location.href=r.url; }catch(e){ toast(e.message.slice(0,140)); } break;
''')
rep('    case "jb-sync": await jobberSync(false); break;\n', '    case "jb-sync": await jobberSync(false); break;\n    case "jb-probe": await jobberProbe(); break;\n')
