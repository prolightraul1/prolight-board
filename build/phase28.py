# Crew revenue per day at the bottom of each crew's list. Applied after phase27.py.
P28 = open(pathlib.Path(__file__).with_name('phase28.js')).read()
rep('\n/* ---------- render ---------- */\n', P28 + '\n/* ---------- render ---------- */\n')
rep('} else list=`<div class="stops">${stops.map((s,i)=>stopCard(s,i,stops.length)+(S._eta&&S._eta.lunch&&S._eta.lunch.after===i?lunchCard(S._eta.lunch,d):"")).join("")}</div>`;',
    '} else list=`<div class="stops">${stops.map((s,i)=>stopCard(s,i,stops.length)+(S._eta&&S._eta.lunch&&S._eta.lunch.after===i?lunchCard(S._eta.lunch,d):"")).join("")}</div>`+crewMoneyFoot(d,S.team);')
rep('    </section>`; }).join("")}</div>`;', '    ${wkMoney(d)}</section>`; }).join("")}</div>`;')
rep('<span class="m"><b>${esc(c.name)}</b><small>${st.length?(nx?`Next: ${esc(clientOf(nx.j).name||"Customer")}`:"All done for today"):"No stops"}</small></span>',
    '<span class="m"><b>${esc(c.name)}</b><small>${st.length?(nx?`Next: ${esc(clientOf(nx.j).name||"Customer")}`:"All done for today"):"No stops"}</small>${S.me.money&&st.length?(()=>{ const m=crewDay(d,c.id); return m.rev?`<small class="mono">${money0(m.rev)} today${isRaul()?` · you ${money2(m.mine)}`:""}</small>`:""; })():""}</span>')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.cmoney{margin:14px 0 4px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.cm-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)}.cm-row:first-of-type{border-top:0}
.cm-row .dot,.wk-money .dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}.cm-row .count{flex:1}
.cm-v{font-weight:800;font-size:16px}.cm-me{color:var(--ok,#1f8a4c);font-weight:700;font-size:13px}.cm-tot{font-size:15px}
.wk-money{margin-top:6px;padding-top:6px;border-top:1px dashed var(--line);font-size:12px;display:grid;gap:3px}.wk-money .dot{margin-right:5px}''')
