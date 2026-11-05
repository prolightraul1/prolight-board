# Who can drive (pickup-truck badge); Plan a day plans drop-offs, moves and pickups for crews with no driver. Applied after phase46.py.
P47 = open(pathlib.Path(__file__).with_name('phase47.js')).read()
rep('\n/* ---------- render ---------- */\n', P47 + '\n/* ---------- render ---------- */\n')
# person form: Can drive checkbox
rep('''      <div class="f"><label for="pp-crew">Crew</label><select id="pp-crew">${crewOpts}</select></div>''', '''      <div class="f"><label for="pp-crew">Crew</label><select id="pp-crew">${crewOpts}</select></div>
      <div class="checks"><label><input type="checkbox" id="pp-drive" ${p.id&&!canDrive(p)?"":"checked"}><span>Can drive<small>Off: someone has to drop them off and pick them up. Plan a day works that into the routes.</small></span></label></div>''')
rep('''    { const pid=p.id||(PL.staff().find(x=>x.name===out.name)||{}).id; if(pay0&&pid) await writePlan(pid,pay0); }''', '''    { const pid=p.id||(PL.staff().find(x=>x.name===out.name)||{}).id; if(pay0&&pid) await writePlan(pid,pay0); }
    { const pid=p.id||(PL.staff().find(x=>x.name===out.name)||{}).id, cd=g("pp-drive"); if(cd&&pid) try{ await saveCanDrive(pid,cd.checked); }catch(e){ toast("Couldn't save Can drive"); } }''')
# team list: pickup truck for drivers, "Needs a ride" for the rest
rep('''${esc(p.name)}${p.id===S.me.id?" (you)":""}</span>''', '''${esc(p.name)}${p.id===S.me.id?" (you)":""}${p.partner==="shipshape"?"":canDrive(p)?`<span class="drv" title="Can drive">${TRUCK_SVG}</span>`:`<span class="drv nd">Needs a ride</span>`}</span>''')
# plan a day cards
rep('''      <span class="count">target ${money0(r.min)}–${money0(r.max)}</span></header>''', '''      <span class="count">target ${money0(r.min)}–${money0(r.max)}</span>${crewRoster(c)}</header>${planCrewExtras(r)}''')
rep('''· ${o.drive} min driving${o.big?''', '''· ${o.ride?`${o.moves?o.moves+" move · ":"one spot · "}+${o.drive} min for ${esc(teamName(o.ride.by))}`:`${o.drive} min driving`}${o.big?''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.truck-ic{display:inline-block;vertical-align:-1px;flex:none}
.drv{display:inline-flex;align-items:center;margin-left:8px;color:var(--ink-2)}.drv.nd{font-size:12px;font-weight:600;color:var(--amber,#f5b83d)}
.roster{display:flex;flex-wrap:wrap;gap:4px 10px;flex-basis:100%;font-size:13px;color:var(--ink-2)}.roster .rp{display:inline-flex;align-items:center;gap:4px}.roster .rp.nd{color:var(--amber,#f5b83d)}.roster .rp.nd::after{content:"· needs a ride";font-size:12px}
.ride-note{display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-left:3px solid var(--amber,#f5b83d);border-radius:10px;padding:8px 10px;margin:6px 0;font-size:14px}
.ride-note.warn{border-left-color:var(--red,#d64545)}.ride-note.carry{border-left-color:var(--ok,#1f8a4c)}.ride-note .truck-ic{margin-top:3px}
.ride-note ol{margin:4px 0 0;padding-left:20px;display:grid;gap:2px}''')
