# Change visit dates from the job panel and the Not marked done list. Applied after phase51.py.
P52 = open(pathlib.Path(__file__).with_name('phase52.js')).read()
rep('\n/* ---------- render ---------- */\n', P52 + '\n/* ---------- render ---------- */\n')
rep('  if(t.id==="act-who"){', '  if(t.dataset&&t.dataset.vdate){ if(t.value) await setVisitDate(t.dataset.j,t.dataset.v,t.value); return; }\n  if(t.id==="act-who"){')
rep('    case "pins": await openPins(); break;', '    case "pins": await openPins(); break;\n    case "vdate-clear": await setVisitDate(t.dataset.j,t.dataset.v,""); break;')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.vdate{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:6px}.vdate input{min-height:36px;padding:4px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg-2,transparent);color:var(--ink);font:inherit}
.nd-item{margin-top:6px}.nd-item .nd-row{margin-top:0}.nd-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:6px 2px 0}.nd-acts input{min-height:34px;padding:2px 6px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);font:inherit}''')
