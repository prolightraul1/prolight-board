# Fixes found by the health check. Applied after phase32.py.
# savePerson read the title box after the save; a live staff update can redraw the drawer in between -> null.
rep('''  const pin=g("pp-pin").value.trim();
  if(!out.name){ g("pp-err").textContent="Add their name."; return; }''', '''  const pin=g("pp-pin").value.trim(), title0=(g("pp-title")||{value:""}).value.trim();
  if(!out.name){ g("pp-err").textContent="Add their name."; return; }''')
rep('{ const t=g("pp-title").value.trim(), who2=', '{ const t=title0, who2=')
rep('''}catch(e){ S.busy=false; g("pp-err").textContent=e.message.replace(/^.*?: /,""); }''', '''}catch(e){ S.busy=false; const er=g("pp-err"); if(er) er.textContent=e.message.replace(/^.*?: /,""); else toast(e.message.replace(/^.*?: /,"")); }''')
