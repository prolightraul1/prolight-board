# Plan a day: no automatic reservations between crews; "Include jobs scheduled later" switch. Applied after phase50.py.
P51 = open(pathlib.Path(__file__).with_name('phase51.js')).read()
rep('\n/* ---------- render ---------- */\n', P51 + '\n/* ---------- render ---------- */\n')
rep('''    <div class="chips plan-crews">''', '''    <div class="chips plan-crews"><button type="button" class="chip" data-act="plan-later" aria-pressed="${planLS("later",false)}" title="Also suggest jobs already booked for a later day; scheduling one moves it up">Include jobs scheduled later</button>''')
rep('''${money0(s.p)}${s.j.source==="tcl"?" · TCL":""}''', '''${money0(s.p)}${s.j.source==="tcl"?" · TCL":""}${s.v.date&&s.v.date!==PLAN.day?` · <b style="color:var(--amber-text,#ffcf78)">moves up from ${esc(fmtDay(s.v.date,{weekday:"short",month:"short",day:"numeric"}))}</b>`:""}''')
rep('    case "pins": await openPins(); break;', '''    case "pins": await openPins(); break;
    case "plan-later": planSet("later",!planLS("later",false)); PLAN.pick={}; renderMain(); break;''')
rep('''<button type="button" class="btn small" data-act="plan-pick" data-id="${esc(c.id)}" data-v="${i}">Hold for this crew</button>''', '''<button type="button" class="btn small" data-act="plan-pick" data-id="${esc(c.id)}" data-v="${i}">Hold for this crew</button>''')
rep('''<div class="plan-opt ${(PLAN.pick[c.id]||0)===i?"on":""}">''', '''<div class="plan-opt ${PLAN.pick[c.id]===i?"on":""}">''')
rep('''${(PLAN.pick[c.id]||0)!==i?`<button type="button" class="btn small" data-act="plan-pick"''', '''${PLAN.pick[c.id]!==i?`<button type="button" class="btn small" data-act="plan-pick"''')
