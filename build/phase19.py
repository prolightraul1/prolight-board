# Daily team call + badge clearing. Applied after phase18.py.
P19 = open(pathlib.Path(__file__).with_name('phase19.js')).read()
rep('\n/* ---------- render ---------- */\n', P19 + '\n/* ---------- render ---------- */\n')
# channel in the chat list
rep('  const list=[{id:"ann",name:"Announcements",kind:"ann"}];\n  for(const c of crews()) if(wide||me.crew===c.id||(ss&&c.co==="shipshape"))', '  const list=[{id:"ann",name:"Announcements",kind:"ann"}];\n  if(!ss) list.push({id:TEAM_ROOM,name:LANG_ES?"Llamada diaria del equipo":"Daily team call",kind:"team"});\n  for(const c of crews()) if(wide||me.crew===c.id||(ss&&c.co==="shipshape"))')
rep('const groups=[["ann","Announcements"],["crew","Crew channels"],', 'const groups=[["ann","Announcements"],["team",LANG_ES?"Llamada del equipo":"Team call"],["crew","Crew channels"],')
# header: join button + schedule
rep('<b>${esc(c.name)}</b>${c.kind!=="ann"?`<button type="button" class="btn small call-btn" data-act="call-start" data-v="${esc(cur)}">', '<b>${esc(c.name)}</b>${c.kind==="team"?`<button type="button" class="btn small amber call-btn" data-act="call-join" data-v="${TEAM_ROOM}">📹 ${LANG_ES?"Unirme ahora":"Join now"}</button></div>${teamCallHead()}<div style="display:none">`:c.kind!=="ann"?`<button type="button" class="btn small call-btn" data-act="call-start" data-v="${esc(cur)}">')
# live banner for the team call too
rep('''  const m=chanMsgs("ann").filter(x=>x.body===CALL_MSG).pop(); if(!m||Date.now()-Date.parse(m.at)>90*60e3||$("#callRoot:not([hidden]) iframe")) return "";''', '''  const tm=inTeamCall()?chanMsgs(TEAM_ROOM).filter(x=>x.body===CALL_MSG).pop():null;
  if(tm&&Date.now()-Date.parse(tm.at)<60*60e3&&!$("#callRoot:not([hidden]) iframe")) return `<div class="ann meet"><div><span class="eyebrow">📹 ${LANG_ES?"Llamada del equipo en vivo":"Daily team call is live"}</span><div>${LANG_ES?"Empezó a las":"Started at"} ${new Date(tm.at).toLocaleTimeString(LOC(),{hour:"numeric",minute:"2-digit"})}</div></div><button type="button" class="btn" data-act="call-join" data-v="${TEAM_ROOM}">${LANG_ES?"Unirme":"Join"}</button></div>`;
  const m=chanMsgs("ann").filter(x=>x.body===CALL_MSG).pop(); if(!m||Date.now()-Date.parse(m.at)>90*60e3||$("#callRoot:not([hidden]) iframe")) return "";''')
rep('''  const c=ch==="ann"?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):''', '''  const c=ch==="ann"?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):ch===TEAM_ROOM?(LANG_ES?"Llamada diaria del equipo":"Daily team call"):''')
rep('function callBubble(m){ const mine=m.by===S.me.id, meet=m.channel==="ann";', 'function callBubble(m){ const mine=m.by===S.me.id&&m.channel!==TEAM_ROOM, meet=m.channel==="ann"||m.channel===TEAM_ROOM;')
# manager schedule controls
rep('  if(t.id==="act-who"){', '  if(t.id==="meet-on"){ await saveMeet({on:t.checked}); return; }\n  if(t.id==="meet-time"&&t.value){ await saveMeet({time:t.value}); return; }\n  if(t.dataset&&t.dataset.meetDay!=null){ const d=+t.dataset.meetDay, c=meetCfg(); await saveMeet({days:t.checked?[...new Set([...c.days,d])].sort():c.days.filter(x=>x!==d)}); return; }\n  if(t.id==="act-who"){')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.tog-l{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700}\n.team-call small{color:var(--ink-2)}')
rep('${meet?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):', '${m.channel===TEAM_ROOM?(LANG_ES?"Llamada diaria del equipo":"Daily team call"):meet?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):')
