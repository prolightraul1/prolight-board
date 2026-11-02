# Video calls. Applied after phase16.py.
P17 = open(pathlib.Path(__file__).with_name('phase17.js')).read()
rep('\n/* ---------- render ---------- */\n', P17 + '\n/* ---------- render ---------- */\n')
rep('<b>${esc(c.name)}</b>${c.kind==="ann"', '<b>${esc(c.name)}</b>${c.kind!=="ann"?`<button type="button" class="btn small call-btn" data-act="call-start" data-v="${esc(cur)}">📹 ${LANG_ES?"Videollamada":"Video call"}</button>`:(S.me.manage||S.me.owner)?`<button type="button" class="btn small amber call-btn" data-act="call-start" data-v="ann">📹 ${LANG_ES?"Iniciar reunión con todos":"Start crew meeting"}</button>`:""}${c.kind==="ann"')
rep('<div class="txt">${esc(m.body)}</div>', '${m.body===CALL_MSG?callBubble(m):`<div class="txt">${esc(m.body)}</div>`}')
rep('    case "pins": await openPins(); break;', '    case "call-start": await startCall(v,true); break;\n    case "call-join": await startCall(v,false); break;\n    case "call-leave": leaveCall(); break;\n    case "pins": await openPins(); break;')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
#callRoot{position:fixed;inset:0;z-index:2500;background:#080c0a;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top,0px)}
#callRoot[hidden]{display:none}
.call-bar{display:flex;align-items:center;gap:10px;padding:10px max(14px,env(safe-area-inset-right,0px)) 10px max(14px,env(safe-area-inset-left,0px));color:#eaf0eb;background:#111916}
.call-bar .grow{flex:1}
.call-dot{width:10px;height:10px;border-radius:50%;background:#e8352b;box-shadow:0 0 10px #e8352b}
.call-body{flex:1;display:grid;place-items:center;padding-bottom:env(safe-area-inset-bottom,0px)}
.call-body iframe{width:100%;height:100%;border:0;background:#000}
.call-btn{margin-left:auto}
.call-msg{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
body.in-call{overflow:hidden}''')

# all-crew meeting: live banner on every screen while it's on
rep('function annBanner(){\n  const M=chanMsgs("ann"), m=M[M.length-1];', 'function annBanner(){\n  { const live=meetingLive(); if(live) return live; }\n  const M=chanMsgs("ann"), m=M[M.length-1];')
