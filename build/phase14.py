# Activity log. Applied after phase13.py.
P14C = open(pathlib.Path(__file__).with_name('phase14.css')).read()
P14 = open(pathlib.Path(__file__).with_name('phase14.js')).read()
rep('.gate-lang{', P14C + '.gate-lang{')
rep('\n/* ---------- render ---------- */\n', P14 + '\n/* ---------- render ---------- */\n')
rep('function renderMain(){\n  homeView();', 'function renderMain(){\n  const __t0=performance.now();\n  homeView();')
rep('  if(fid){ const el=document.getElementById(fid); if(el){ el.focus(); try{el.setSelectionRange(pos,pos);}catch(e){} } }\n}', '  if(fid){ const el=document.getElementById(fid); if(el){ el.focus(); try{el.setSelectionRange(pos,pos);}catch(e){} } }\n  lagCheck("screen: "+S.view, performance.now()-__t0); noteLoad();\n}')
rep('function fail(e,what){\n', 'function fail(e,what){\n  track("save-failed",{what,code:(e&&e.code)||"",msg:String((e&&e.message)||"").slice(0,200),offline:!navigator.onLine});\n')
rep('  const set=[S.me.owner&&["settings","Settings"],S.me.owner&&["texts","Night texts"]].filter(Boolean);', '  const set=[S.me.owner&&["settings","Settings"],S.me.owner&&["texts","Night texts"],S.me.manage&&["activity","Activity log"]].filter(Boolean);')
rep('o==="payroll"?vPayroll(): vSettings())', 'o==="payroll"?vPayroll(): o==="activity"?vActivity(): vSettings())')
rep('    case "pins": await openPins(); break;', '''    case "pins": await openPins(); break;
    case "act-filter": ACT.filter=v; ACT.rows=null; ACT.open.clear(); renderMain(); break;
    case "act-refresh": ACT.rows=null; ACT.health=null; renderMain(); break;
    case "act-more": loadActivity(false); renderMain(); break;
    case "act-open": { const n=Number(v); ACT.open.has(n)?ACT.open.delete(n):ACT.open.add(n); renderMain(); break; }''')
rep('  if(t.dataset&&t.dataset.otFor){', '  if(t.id==="act-who"){ ACT.who=t.value; ACT.rows=null; renderMain(); return; }\n  if(t.dataset&&t.dataset.otFor){')
rep('lagCheck("screen: "+S.view, performance.now()-__t0); noteLoad();', 'lagCheck("screen: "+S.view, performance.now()-__t0); noteLoad(); seasonalLookCheck();')
rep('${L.photoError?`<br><b>Photos:</b> ${esc(L.photoError)}`:""}', '${L.photoError?`<br><b>Photos:</b> ${esc(L.photoError)}`:""}${L.assignNote?`<br><b>Crews:</b> ${esc(L.assignNote)}`:""}')
