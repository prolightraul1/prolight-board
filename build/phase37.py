# "Not marked done" list + chip for owners; the 8 PM push opens it. Applied after phase36.py.
P35 = open(pathlib.Path(__file__).with_name('phase37.js')).read()
rep('\n/* ---------- render ---------- */\n', P35 + '\n/* ---------- render ---------- */\n')
rep('  root.innerHTML = D.kind==="job"?dJob(D.id):', '  root.innerHTML = D.kind==="notdone"?dNotDone(): D.kind==="job"?dJob(D.id):')
rep('    else if(k==="account"){ openDrawer("account"); }', '    else if(k==="account"){ openDrawer("account"); }\n    else if(k==="notdone"){ openDrawer("notdone"); }')
rep('    case "pins": await openPins(); break;', '    case "pins": await openPins(); break;\n    case "notdone": openDrawer("notdone"); break;')
rep('  h+=todayWork(d)+`<div class="dgrid">', '  h+=notDoneChip()+todayWork(d)+`<div class="dgrid">')
rep('''  let h=annBanner()+(S.ready?seasonBar():"")+`<div class="dayhead">''', '''  let h=annBanner()+(S.ready?seasonBar():"")+notDoneChip()+`<div class="dayhead">''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.nd-chip{display:block;width:100%;text-align:left;margin:0 0 12px;padding:10px 14px;border-radius:12px;border:1px solid var(--amber,#f5b83d);background:color-mix(in srgb,var(--amber,#f5b83d) 14%,transparent);color:var(--ink);font:inherit;font-weight:700;cursor:pointer}
.nd-day{margin:14px 0}.nd-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;padding:10px 12px;margin-top:6px;border:1px solid var(--line);border-radius:12px;background:none;color:var(--ink);font:inherit;cursor:pointer}
.nd-row span{color:var(--ink-2);font-size:14px}.nd-row em{color:var(--amber,#f5b83d);font-style:normal;font-weight:700}''')
rep('const NOTE_KINDS = () => [', 'const NOTE_KINDS = () => [...(typeof isRaul==="function"&&isRaul()?[["notdone",LANG_ES?"Paradas sin marcar (8 PM)":"Stops not marked done (8 PM)"]]:[]),')
