# Week: revenue total in each day's header (and under the crew lines). Applied after phase48.py.
P49 = open(pathlib.Path(__file__).with_name('phase49.js')).read()
rep('\n/* ---------- render ---------- */\n', P49 + '\n/* ---------- render ---------- */\n')
rep('''<span>${st.length?st.length+" stop"+(st.length>1?"s":""):""}</span></h4>''', '''<span>${st.length?st.length+" stop"+(st.length>1?"s":""):""}${wkDayTotal(d)}</span></h4>''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.wday h4 .wk-total{display:block;text-align:right;font-size:14px;font-weight:800;color:var(--ink);letter-spacing:0}
.wk-daytot{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:3px;margin-top:1px;font-weight:600}''')
