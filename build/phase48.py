# Plan a day: a map on every route suggestion; rider options also show the driver's day. Applied after phase47.py.
P48 = open(pathlib.Path(__file__).with_name('phase48.js')).read()
rep('\n/* ---------- render ---------- */\n', P48 + '\n/* ---------- render ---------- */\n')
rep('''}).join("")}</ol>
          <div class="bar"><button type="button" class="btn amber small" data-act="plan-use"''', '''}).join("")}</ol>${planMapSlot(r,o,i)}
          <div class="bar"><button type="button" class="btn amber small" data-act="plan-use"''')
rep('''  if(S.view==="route") mountRouteMap();\n''', '''  if(S.view==="route") mountRouteMap();\n  if(S.view==="plan") mountPlanMaps();\n''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.plan-map-wrap{display:grid;gap:4px}.plan-map{height:210px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:var(--sunk)}.plan-map .lmap{width:100%;height:100%}
.pm-dot{display:block;width:14px;height:14px;border-radius:50%;background:var(--c);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)}
.pm-legend{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;color:var(--ink-2)}.pm-legend i{display:inline-block;width:14px;height:4px;border-radius:2px;margin-right:5px;vertical-align:middle}''')
