# TCL release (Nov 11): planner and not-done list skip TCL jobs from that date. Applied after phase49.py.
P50 = open(pathlib.Path(__file__).with_name('phase50.js')).read()
rep('\n/* ---------- render ---------- */\n', P50 + '\n/* ---------- render ---------- */\n')
rep('''||!hasLL(j)||PLAN.skip.has(j.id)) continue;''', '''||!hasLL(j)||PLAN.skip.has(j.id)||tclReleased(j,PLAN.day)) continue;''')
rep('''&&v.date>=from&&!isDone(j.id,v.id)) out.push({j,v,partial:partialMap.get(j.id+"|"+v.id)}); }''', '''&&v.date>=from&&!isDone(j.id,v.id)&&!(tclReleased(j,v.date)&&v.type!=="service")) out.push({j,v,partial:partialMap.get(j.id+"|"+v.id)}); }''')
rep('''<span class="count">${pool} unscheduled job${pool===1?"":"s"} with a price and a pin</span>''', '''<span class="count">${pool} unscheduled ${PLAN.day>=TCL_RELEASED?"ProLight ":""}job${pool===1?"":"s"} with a price and a pin${PLAN.day>=TCL_RELEASED?" · TCL jobs went back to TCL on Nov 11":""}</span>''')
