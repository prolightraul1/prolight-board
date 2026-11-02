# Multiple crews on one job, right where you assign the crew. Applied after phase28.py.
P29 = open(pathlib.Path(__file__).with_name('phase29.js')).read()
rep('\n/* ---------- render ---------- */\n', P29 + '\n/* ---------- render ---------- */\n')
rep('''${S.me.owner?`<div class="f f-who"><label>Who's doing this job</label>${assignUI(j.crew,"assign",`data-id="${esc(id)}"`)}${membersOf(j.crew).length?`<small>${esc(membersOf(j.crew).join(", "))}</small>`:""}</div>`:""}''',
    '''${S.me.owner?`<div class="f f-who"><label>Who's doing this job</label>${assignUI(j.crew,"assign",`data-id="${esc(id)}"`)}${membersOf(j.crew).length?`<small>${esc(membersOf(j.crew).join(", "))}</small>`:""}${extraCrewsUI(j,id)}</div>`:""}''')
rep('    case "pins": await openPins(); break;', '    case "extra-crew": t.disabled=true; await toggleExtraCrew(id,v); break;\n    case "pins": await openPins(); break;')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.xcrews{margin-top:10px}.xcrews>small{display:block;margin-bottom:6px;color:var(--ink-2);font-weight:600}.xcrews .chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}')
import time as _t
rep('<meta name="theme-color" content="#111916">', '<meta name="theme-color" content="#111916">\n<meta name="build" content="%d">' % int(_t.time()))
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n#upd-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:2700;border:0;border-radius:999px;padding:10px 18px;background:var(--amber,#f5b83d);color:#1a1405;font:700 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);cursor:pointer}')
