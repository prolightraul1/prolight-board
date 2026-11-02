# Manager home, office groups, week drag-and-drop, route map, job panel order. Applied after phase10.py.
P11C = open(pathlib.Path(__file__).with_name('phase11.css')).read()
P11 = open(pathlib.Path(__file__).with_name('phase11.js')).read()
rep('.wk-nav{display:inline-flex;gap:8px;flex:none}\n</style>', '.wk-nav{display:inline-flex;gap:8px;flex:none}\n' + P11C + '</style>')
rep('\n/* ---------- render ---------- */\n', P11 + '\n/* ---------- render ---------- */\n')
# views + nav
rep('$("#view").innerHTML = S.view==="route"?vRoute():', '$("#view").innerHTML = S.view==="today"?vToday(): S.view==="route"?vRoute():')
rep('function renderMain(){\n  renderNav();', 'function renderMain(){\n  homeView();\n  renderNav();')
rep('  if(S.view==="map") mountMap();\n', '  if(S.view==="map") mountMap();\n  if(S.view==="route") mountRouteMap();\n')
rep('function navItems(){ const v=[["route","Route"],["jobs","Jobs"],["map","Map"],["week","Week"],["chat","Chat"],["clients","Clients"]];',
    'function navItems(){ const v=isMgr()&&wide()?[["today","Today"],["jobs","Jobs"],["week","Week"],["map","Map"],["route","Route"],["chat","Chat"],["clients","Clients"]]:[["route","Route"],["jobs","Jobs"],["map","Map"],["week","Week"],["chat","Chat"],["clients","Clients"]];')
rep('    case "view": S.view=v; closeDrawer(); renderMain(); window.scrollTo(0,0); break;', '''    case "view": S._home=1; S.view=v; closeDrawer(); renderMain(); window.scrollTo(0,0); break;
    case "today-crew": S.team=v; ls("team",v); S.day=todayISO(); S.view="route"; renderMain(); window.scrollTo(0,0); break;
    case "today-jf": S.jf=v; S.view="jobs"; renderMain(); window.scrollTo(0,0); break;
    case "today-go": S.view="office"; setOffice(v==="money"?"money:overview":(S.me.money?"payroll":"hours")); renderMain(); window.scrollTo(0,0); break;
    case "ogroup": { const g=officeGroups().find(x=>x[0]===v); if(g) setOffice(g[2][0][0]); renderMain(); break; }
    case "tray": S.tray=v; renderMain(); break;''')
rep('    case "office": S.office=v; renderMain(); break;', '    case "office": setOffice(v); renderMain(); break;')
rep('    case "go-day": S.day=v; S.view="route"; renderMain(); window.scrollTo(0,0); break;', '    case "go-day": S._home=1; S.day=v; S.view="route"; renderMain(); window.scrollTo(0,0); break;')
rep('  else if(t.id==="q-clients"){ S.q.clients=t.value; renderMain(); }', '  else if(t.id==="q-clients"){ S.q.clients=t.value; renderMain(); }\n  else if(t.id==="q-tray"){ S.q.tray=t.value; renderMain(); }')
# week: draggable stops, droppable days, tray of unscheduled jobs
rep('<section class="wday ${d===t?"today":""}">', '<section class="wday ${d===t?"today":""}" data-day="${d}">')
rep('return `<button type="button" class="wstop" data-act="go-day" data-v="${d}">', 'return `<button type="button" class="wstop" data-act="go-day" data-v="${d}" ${S.me.owner&&!dn?`draggable="true" data-dj="${esc(s.j.id)}" data-dv="${esc(s.v.id)}"`:""}>')
rep('  h+=`<div class="week">${days.map(d=>{', '  h+=wkTray();\n  h+=`<div class="week">${days.map(d=>{')
rep('  if(needInstall.length) h+=`<h2 class="h-sec">Booked, no install date', '  h+=`<div class="wk-lists">`;\n  if(needInstall.length) h+=`<h2 class="h-sec">Booked, no install date')
rep('''  if(needDown.length) h+=`<h2 class="h-sec">Lit, no takedown date · ${needDown.length}</h2><div class="rows">${needDown.map(jobRow).join("")}</div>`;\n  return h;''',
    '''  if(needDown.length) h+=`<h2 class="h-sec">Lit, no takedown date · ${needDown.length}</h2><div class="rows">${needDown.map(jobRow).join("")}</div>`;\n  h+=`</div>`;\n  return h;''')
# route: map beside the stops on the computer
rep('  h+= side ? `<div class="route-cols"><div>${list}</div>${side}</div>` : list;', '  h+= (wide()&&stops.length) ? `<div class="route-cols rc-map"><div>${list}</div><div class="route-side">${routeSide()}${side||""}</div></div>` : side ? `<div class="route-cols"><div>${list}</div>${side}</div>` : list;')
rep('<article class="stop ${d?"is-done":""}">', '<article class="stop ${d?"is-done":""}" data-sj="${esc(j.id)}">')
# job panel sections get names so they can be ordered
rep('<section class="blk"><h3 class="h-sec">Visits</h3>', '<section class="blk blk-visits"><h3 class="h-sec">Visits</h3>')
rep('<section class="blk"><h3 class="h-sec">Mockups</h3>', '<section class="blk blk-mock"><h3 class="h-sec">Mockups</h3>')
rep('b+=`<section class="blk"><h3 class="h-sec">Money</h3>', 'b+=`<section class="blk blk-money"><h3 class="h-sec">Money</h3>')
rep('${S.me.owner?`<div class="f"><label>Who\'s doing this job</label>', '${S.me.owner?`<div class="f f-who"><label>Who\'s doing this job</label>')
rep('<dl class="kv">${a?`<dt>Address</dt><dd>${esc(a)}</dd>`:""}${c.phone?', '<dl class="kv kv-job">${a?`<dt>Address</dt><dd>${esc(a)}</dd>`:""}${c.phone?')
# overtime per person
rep('  if(t.dataset&&t.dataset.rateFor){', '  if(t.dataset&&t.dataset.otFor){ await saveOt(t.dataset.otFor,t.value==="1"); return; }\n  if(t.dataset&&t.dataset.rateFor){')
# clients: ProLight / TCL tabs
rep('''  list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const jobsBy=new Map(); for(const j of jobsArr()){ if(!jobsBy.has(j.clientId)) jobsBy.set(j.clientId,[]); jobsBy.get(j.clientId).push(j); }''',
'''  list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const jobsBy=new Map(); for(const j of jobsArr()){ if(!jobsBy.has(j.clientId)) jobsBy.set(j.clientId,[]); jobsBy.get(j.clientId).push(j); }
  const isT=c=>{ const js=jobsBy.get(c.id)||[]; return js.length?js.some(j=>j.source==="tcl"):c.source==="tcl"; }, isP=c=>{ const js=jobsBy.get(c.id)||[]; return js.length?js.some(j=>j.source!=="tcl"):c.source!=="tcl"; };
  const ct=S.ctab||"all", nP=list.filter(isP).length, nT=list.filter(isT).length;
  if(ct==="pl") list=list.filter(isP); else if(ct==="tcl") list=list.filter(isT);
  const ctabs=`<div class="seg" role="group" aria-label="Whose clients" style="justify-self:start">${[["all","All",0],["pl","ProLight",nP],["tcl","TCL",nT]].map(([k,l,n])=>`<button type="button" data-act="ctab" data-v="${k}" aria-pressed="${ct===k}">${l}${k==="all"?"":` · ${n}`}</button>`).join("")}</div>`;''')
rep('''    <input class="search" id="q-clients" type="search" placeholder="Search name, address, phone" value="${esc(S.q.clients)}" aria-label="Search clients">`;''',
    '''    <input class="search" id="q-clients" type="search" placeholder="Search name, address, phone" value="${esc(S.q.clients)}" aria-label="Search clients">${ctabs}`;''')
rep('    case "tray": S.tray=v; renderMain(); break;', '    case "tray": S.tray=v; renderMain(); break;\n    case "ctab": S.ctab=v; renderMain(); break;')
