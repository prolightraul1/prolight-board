# Delete people + iPad layout. Applied after phase11.py.
P12C = open(pathlib.Path(__file__).with_name('phase12.css')).read()
P12 = open(pathlib.Path(__file__).with_name('phase12.js')).read()
rep('.d-body>.kv-job{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px}\n</style>', '.d-body>.kv-job{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px}\n' + P12C + '</style>')
rep('\n/* ---------- render ---------- */\n', P12 + '\n/* ---------- render ---------- */\n')
# delete button in Edit person
rep('''    <div class="actions"><span class="count" id="pp-err" style="color:var(--red)"></span><button type="submit" class="btn amber" ${S.busy?"disabled":""}>${isNew?"Add person":"Save changes"}</button></div>
  </form>`;''', '''    <div class="actions"><span class="count" id="pp-err" style="color:var(--red)"></span><button type="submit" class="btn amber" ${S.busy?"disabled":""}>${isNew?"Add person":"Save changes"}</button></div>
    ${!isNew&&S.me.manage&&p.id!==S.me.id?`<fieldset style="margin-top:8px"><legend>Delete</legend>${S.form.confirmDel?`<div class="note">Delete <b>${esc(p.name)}</b> for good? Their login and PIN stop working right away and their chat messages are removed. Their check-offs, notes and hours stay on the jobs and payroll under their name. This can't be undone.</div>
      <div class="bar"><button type="button" class="btn danger" data-act="person-del-yes" data-v="${esc(p.id)}" ${S.busy?"disabled":""}>Yes, delete ${esc(p.name.split(" ")[0])}</button><button type="button" class="btn" data-act="person-del-no">Keep</button></div>`
      :`<div class="bar"><button type="button" class="btn danger" data-act="person-del">Delete this person</button><small class="count">To just stop them signing in for now, turn off "Can sign in" instead.</small></div>`}</fieldset>`:""}
  </form>`;''')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "person-del": S.form.confirmDel=true; renderDrawer(); break;
    case "person-del-no": S.form.confirmDel=false; renderDrawer(); break;
    case "person-del-yes": await deletePerson(v); break;
''')
# names of deleted people stay on their history
rep('db.collection("settings").onSnapshot(s=>{ S.dayCfg=', 'db.collection("settings").onSnapshot(s=>{ { const fm=s.docs.find(d=>d.id==="former"); S.former=fm?fm.data()||{}:{}; } S.dayCfg=')
rep('return S.names.get(id) || "Crew member"; }', 'return S.names.get(id) || (S.former&&S.former[id]) || "Crew member"; }')
# Today, nav order and week tray from tablet width up
rep('const wide = () => matchMedia("(min-width:960px)").matches;', 'const wide = () => matchMedia("(min-width:960px)").matches;\nconst tab = () => matchMedia("(min-width:700px)").matches;')
rep('function homeView(){ if(S._home||!S.ready||!isMgr()) return; S._home=1; if(wide()&&S.view==="route") S.view="today"; }', 'function homeView(){ if(S._home||!S.ready||!isMgr()) return; S._home=1; if(tab()&&S.view==="route") S.view="today"; }')
rep('matchMedia("(min-width:960px)").addEventListener("change",()=>{ if(S.view==="today"&&!wide()) S.view="route"; renderMain(); });', 'matchMedia("(min-width:960px)").addEventListener("change",()=>renderMain());\nmatchMedia("(min-width:700px)").addEventListener("change",()=>{ if(S.view==="today"&&!tab()) S.view="route"; renderMain(); });')
rep('function navItems(){ const v=isMgr()&&wide()?', 'function navItems(){ const v=isMgr()&&tab()?')
rep('  if(!S.me.owner||!wide()) return "";\n  const all=jobsArr()', '  if(!S.me.owner||!tab()) return "";\n  const all=jobsArr()')
# light colors follow the person to every device
rep('function setLook(p){ ls("look",JSON.stringify({...look(),...p})); applyLook(); }', 'function setLook(p){ ls("look",JSON.stringify({...look(),...p})); applyLook(); if(p&&p.colors&&window.PL&&PL.setLook) PL.setLook(p.colors).catch(()=>{}); }')
# PIN report
rep('''${S.me.manage?`<button type="button" class="btn amber" data-act="person-new">+ Add person</button>`:""}</div>''', '''${S.me.manage?`<button type="button" class="btn" data-act="pins">PIN report</button><button type="button" class="btn amber" data-act="person-new">+ Add person</button>`:""}</div>''')
rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="pins"?dPins():')
rep('    case "person-del": S.form.confirmDel=true; renderDrawer(); break;', '    case "pins": await openPins(); break;\n    case "pins-show": S.pinsShow=!S.pinsShow; renderDrawer(); break;\n    case "person-del": S.form.confirmDel=true; renderDrawer(); break;')
# sign everyone out and require new PINs
rep('{ const fm=s.docs.find(d=>d.id==="former"); S.former=fm?fm.data()||{}:{}; }', '{ const fm=s.docs.find(d=>d.id==="former"); S.former=fm?fm.data()||{}:{}; const si=s.docs.find(d=>d.id==="signin"); if(si) setTimeout(()=>checkForcedSignIn(si.data()),0); }')
rep('''${S.me.manage?`<button type="button" class="btn" data-act="pins">PIN report</button>''', '''${S.me.manage?`<button type="button" class="btn" data-act="new-pins">Everyone picks a new PIN</button><button type="button" class="btn" data-act="pins">PIN report</button>''')
rep('''  return `<div class="bar"><p class="lede grow">Everyone who can sign in.''', '''  return `${S.newPinsAsk?`<div class="note"><b>Sign everyone out and have them pick a new PIN?</b> Everyone except you is signed out right away on every device. When they sign back in with their current PIN, they have to choose a new one, so the PIN report has everyone's PIN. You keep yours.<div class="bar" style="margin-top:8px"><button type="button" class="btn amber" data-act="new-pins-yes">Yes, do it now</button><button type="button" class="btn" data-act="new-pins-no">Not now</button></div></div>`:""}<div class="bar"><p class="lede grow">Everyone who can sign in.''')
rep('    case "pins": await openPins(); break;', '    case "pins": await openPins(); break;\n    case "new-pins": S.newPinsAsk=true; renderMain(); window.scrollTo(0,0); break;\n    case "new-pins-no": S.newPinsAsk=false; renderMain(); break;\n    case "new-pins-yes": t.disabled=true; await requireNewPins(); break;')
rep('COMBOS.map(([n,k],i)=>`<button type="button" class="look-combo"', 'COMBOS.map(([n,k],i)=>!comboOk(n)?"":`<button type="button" class="look-combo"')
