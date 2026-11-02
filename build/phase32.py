# Multi-day installs: split value across install days, pay once on the last day. Applied after phase31.py.
P32 = open(pathlib.Path(__file__).with_name('phase32.js')).read()
rep('const installedOn = j => {', 'let installedOn = j => {')
rep('\n/* ---------- render ---------- */\n', P32 + '\n/* ---------- render ---------- */\n')
rep('data-act="add-visit" data-v="install">+ Install</button>', 'data-act="add-visit" data-v="install" title="Big job? Add another install day. The price is split across the days and it counts as installed when the last day is checked off.">+ Install day</button>')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.vt.daytag{background:var(--amber,#f5b83d);color:#1a1300;font-weight:700}''')
