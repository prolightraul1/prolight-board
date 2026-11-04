# Plan a day: route suggestions per crew toward $3–4k per tech. Applied after phase40.py.
P41 = open(pathlib.Path(__file__).with_name('phase41.js')).read()
rep('\n/* ---------- render ---------- */\n', P41 + '\n/* ---------- render ---------- */\n')
rep('S.view==="week"?vWeek():', 'S.view==="week"?vWeek(): S.view==="plan"?vPlan():')
rep('''<span class="wk-nav"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button>''', '''${S.me.owner?`<button type="button" class="btn amber" data-act="plan-open">✨ Plan a day</button>`:""}<span class="wk-nav"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button>''')
rep('''<button type="button" class="btn" data-act="view" data-v="week">Schedule the week</button>''', '''<button type="button" class="btn" data-act="plan-open">✨ Plan a day</button><button type="button" class="btn" data-act="view" data-v="week">Schedule the week</button>''')
rep('    case "pins": await openPins(); break;', '''    case "pins": await openPins(); break;
    case "plan-open": PLAN.day=PLAN.day||addDays(todayISO(),1); S.view="plan"; closeDrawer(); renderMain(); window.scrollTo(0,0); break;
    case "plan-day": PLAN.day=addDays(PLAN.day||todayISO(),+v); PLAN.pick={}; renderMain(); break;
    case "plan-shuffle": PLAN.seed=(PLAN.seed+0.37)%1; PLAN.pick={}; renderMain(); break;
    case "plan-skip": PLAN.skip.add(id); renderMain(); break;
    case "plan-unskip": PLAN.skip.clear(); renderMain(); break;
    case "plan-crew": { const o=planLS("crews",{}); o[v]=o[v]===false; planSet("crews",o); renderMain(); break; }
    case "plan-techs": { const o=planLS("techs",{}), c=crewObj(id); o[id]=Math.max(1,Math.min(8,(o[id]||planTechs(c))+(+v))); planSet("techs",o); renderMain(); break; }
    case "plan-pick": PLAN.pick[id]=+v; renderMain(); break;
    case "plan-use": t.disabled=true; await planUse(id,v); break;
    case "plan-undo": await planUndo(); break;''')
rep('    else if(k==="account"){ openDrawer("account"); }', '    else if(k==="account"){ openDrawer("account"); }\n    else if(k==="plan"){ S.view="plan"; renderMain(); }')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.plan-top{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline;margin:4px 0 10px}
.plan-crews{margin-bottom:12px}
.plan-crew{margin-bottom:14px}.plan-crew>header{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px 12px}.plan-crew>header .plan-techs{margin-left:auto}.plan-crew .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.plan-techs{display:inline-flex;align-items:center;gap:6px}.plan-techs .btn{min-width:32px;min-height:32px;padding:0}
.plan-opt{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:8px}.plan-opt.on{border-color:var(--amber,#f5b83d)}
.po-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}.po-rev{font-weight:800;font-size:20px}.po-rev.ok{color:var(--ok,#1f8a4c)}.po-rev.off{color:var(--amber,#f5b83d)}
.po-stops{margin:0;padding-left:22px;display:grid;gap:6px}.po-stops li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;align-items:center}
.po-stops .count{grid-column:1;font-size:13px;overflow-wrap:anywhere}.po-name{grid-column:1;background:none;border:0;padding:0;color:var(--ink);font:inherit;font-weight:700;text-align:left;cursor:pointer}
.po-x{grid-column:2;grid-row:1/3;background:none;border:1px solid var(--line);border-radius:8px;color:var(--ink-2);width:32px;height:32px;cursor:pointer;font-size:18px}''')
