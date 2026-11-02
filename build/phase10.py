# Polish pass: type, surfaces, phone fit, desktop layout. Applied after phase9.py.
P10C = open(pathlib.Path(__file__).with_name('phase10.css')).read()
P10 = open(pathlib.Path(__file__).with_name('phase10.js')).read()
rep('@keyframes slide{from{transform:translateY(16px);opacity:.6}}\n}\n</style>', '@keyframes slide{from{transform:translateY(16px);opacity:.6}}\n}\n' + P10C + '</style>')
rep('\n/* ---------- render ---------- */\n', P10 + '\n/* ---------- render ---------- */\n')
# reorder arrows stay together
rep('''${S.me.owner&&n>1?`<button type="button" class="btn icon small" data-act="move"''', '''${S.me.owner&&n>1?`<span class="mv"><button type="button" class="btn icon small" data-act="move"''')
rep('''${i===n-1?"disabled":""} aria-label="Move down">↓</button>`:""}</div>''', '''${i===n-1?"disabled":""} aria-label="Move down">↓</button></span>`:""}</div>''')
# job list header on the computer
rep('h+= list.length ? `<div class="rows">${list.map(jobRow).join("")}</div>`', 'h+= list.length ? jobHead()+`<div class="rows">${list.map(jobRow).join("")}</div>`')
# job drawer: actions in an even grid
rep('''  <div class="bar">${a?`<a class="btn" href="${esc(mapsUrl(a))}" target="_blank" rel="noopener">Directions ↗</a>`:""}''', '''  <div class="d-acts">${a?`<a class="btn" href="${esc(mapsUrl(a))}" target="_blank" rel="noopener">Directions ↗</a>`:""}''')
# loading placeholders
rep('`<p class="lede">Loading the board…</p>`', 'skel(5)')
rep('return h+`<p class="lede">Loading…</p>`;', 'return h+skel(5);', 3)
rep('''    <button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button><button type="button" class="btn small" data-act="week" data-v="0">This week</button><button type="button" class="btn icon" data-act="week" data-v="7" aria-label="Next week">›</button></div>''',
    '''    <span class="wk-nav"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button><button type="button" class="btn" data-act="week" data-v="0" style="min-height:40px">This week</button><button type="button" class="btn icon" data-act="week" data-v="7" aria-label="Next week">›</button></span></div>''')
