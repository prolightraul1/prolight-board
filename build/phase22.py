# Pay plans (hourly + job % + management fee) and the weekly payroll report. Applied after phase21.py.
P22 = open(pathlib.Path(__file__).with_name('phase22.js')).read()
rep('\n/* ---------- render ---------- */\n', P22 + '\n/* ---------- render ---------- */\n')
rep('    case "pins": await openPins(); break;', '    case "plan-save": t.disabled=true; await savePlan(v); break;\n    case "pins": await openPins(); break;')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.pay-ed{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;margin-left:auto}.pay-ed label{display:inline-flex;align-items:center;gap:3px}.pay-row .m{min-width:200px}')
rep('    else if(k==="office"){ S.view="office"; setOffice(v); renderMain(); }', '    else if(k==="office"){ S.view="office"; let o=v; if(o==="payroll-last"){ S.week=addDays(monday(isoOf(new Date().toISOString())),-7); o="payroll"; } setOffice(o); renderMain(); }')
