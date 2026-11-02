# Route order from the shop, truck list, clock in/out, sunset + weather. Applied by build.py.
FEAT = open(pathlib.Path(__file__).with_name('features.js')).read()
rep('\n/* ---------- render ---------- */\n', FEAT + '\n/* ---------- render ---------- */\n')

# route view
rep('function vRoute(){\n  const d=S.day, stops=stopsFor(d,S.team), done=stops.filter(s=>isDone(s.j.id,s.v.id)).length, r=rel(d);',
    'function vRoute(){\n  const d=S.day, stops=stopsFor(d,S.team), done=stops.filter(s=>isDone(s.j.id,s.v.id)).length, r=rel(d);\n  S._eta=estTimes(stops);')
rep('  </div>`;\n  if(!S.ready){ h+= S.err?', '    ${S.ready?routeTools(d,stops):""}\n  </div>`;\n  if(!S.ready){ h+= S.err?')
rep('${v.time?`<span class="mono" style="font-size:13px">${fmtTime(v.time)}</span>`:""}${S.team==="all"?`<span class="crewtag">',
    '${stopTimeTag(s)}${S.team==="all"?`<span class="crewtag">')
rep('<div class="t-actions">${doneBtn}', '<div class="t-actions">${doneBtn}${clockBtn(j,v)}')

# job drawer
rep('if(e.kind==="done"){', 'if(e.kind==="clock") return clockEntry(e); if(e.kind==="done"){')
rep('${v.note?` · ${esc(v.note)}`:""}</small></div>${act}</div>', '${v.note?` · ${esc(v.note)}`:""}${onSite(j.id,v.id)}</small></div>${act}</div>')
rep('await S.db.collection("log").add({jobId,visitId,kind:"done",by:S.me.id||"",at:new Date().toISOString()}); toast("Marked done");',
    'await S.db.collection("log").add({jobId,visitId,kind:"done",by:S.me.id||"",at:new Date().toISOString()}); { const oc=myOpenClock(); if(oc&&oc.jobId===jobId&&oc.visitId===visitId) await clockOut(oc.id,false,true); } toast("Marked done");')
rep('D.kind==="account"?dAccount():', 'D.kind==="truck"?dTruck(D.id): D.kind==="account"?dAccount():')

# night-before text
rep('  if(!stops.length){ L.push("No stops scheduled."); return L.join("\\n"); }\n  L.push(`${stops.length} stop${stops.length>1?"s":""}, in this order:`,"");',
    '  if(!stops.length){ L.push("No stops scheduled."); return L.join("\\n"); }\n  const eta=estTimes(stops), wx=wxText(date);\n  if(wx) L.push(wx);\n  L.push(`Leave from the shop: ${shop().address}`);\n  if(team!=="all"){ const U=routeUrls(stops); if(U) L.push("Route in Apple Maps: "+U.apple, "Route in Google Maps: "+U.google); const ta=assignOf(date,team); if(ta) L.push(`Truck: ${ta.truck||"not set"}${ta.trailer?" + trailer "+ta.trailer:" · no trailer"}${ta.note?" · "+ta.note:""}`); }\n  L.push("",`${stops.length} stop${stops.length>1?"s":""}, in this order:`,"");')
rep('    if(a) L.push("   "+a, "   Map: "+mapsUrl(a));',
    '    if(a) L.push("   "+a, "   Map: "+mapsUrl(a));\n    { const e=eta.get(s.j.id+"|"+s.v.id); if(e){ const i=etaInfo(e,date); if(!e.fixed||i.temp) L.push(`   ${e.fixed?"Temp":"Est. arrival"}: ${e.fixed?"":i.time.replace("~","")}${i.temp?(e.fixed?"":", ")+i.temp+"F":""}`); } }')
rep('  L.push("Mockups, photos and check-off:", BOARD_URL);',
    '  if(team!=="all"){ const tt=truckText(truckList(stops)); if(tt) L.push("TRUCK LIST", tt, ""); }\n  L.push("Mockups, photos and check-off:", BOARD_URL);')
rep('Each crew\'s stops in route order, with addresses, map links, gate codes, notes and mockup count.',
    'Each crew\'s stops in route order from the shop, with arrival estimates, sunset and weather, addresses, gate codes, notes, mockups and the truck list.')

# office: hours tab
rep('S.me.manage&&["team","Team"],', 'S.me.owner&&["hours","Hours"],S.me.manage&&["team","Team"],')
rep('else if(S.office==="team") h+=vTeam();', 'else if(S.office==="team") h+=vTeam(); else if(S.office==="hours") h+=vHours();')

# settings: shop address + leave time
rep('    <fieldset><legend>Crews</legend>',
    '''    <fieldset><legend>Shop</legend><div class="two">
      <div class="f"><label for="s-shop">Shop address</label><input id="s-shop" value="${esc(shop().address)}"><small>Routes start and end here.</small></div>
      <div class="f"><label for="s-leave">Crews leave at</label><input id="s-leave" type="time" value="${esc(shop().leave||"08:00")}"><small>Used for arrival estimates.</small></div></div></fieldset>
    <fieldset><legend>Trucks &amp; trailers</legend><div class="two">
      <div class="f"><label for="s-trucks">Trucks, one per line</label><textarea id="s-trucks" placeholder="F-250 #1&#10;F-250 #2&#10;Box truck">${esc((S.settings.trucks||[]).join("\\n"))}</textarea></div>
      <div class="f"><label for="s-trailers">Trailers, one per line</label><textarea id="s-trailers" placeholder="16 ft enclosed&#10;12 ft utility">${esc((S.settings.trailers||[]).join("\\n"))}</textarea></div></div></fieldset>
    <fieldset><legend>Crews</legend>''')
rep('set({...S.settings, crews:collectCrews()})', 'set({...S.settings, crews:collectCrews(), shop: await shopFromForm(), trucks: linesOf("s-trucks")??(S.settings.trucks||[]), trailers: linesOf("s-trailers")??(S.settings.trailers||[])})')

# map: shop pin, routes start and end at the shop
rep('  LAYER.clearLayers();\n', '  LAYER.clearLayers();\n  { const SH=shop(); L.circleMarker([SH.lat,SH.lng],{radius:9,weight:3,color:"#ffffff",fillColor:"#111916",fillOpacity:1,interactive:false}).bindTooltip("Shop",{permanent:true,direction:"right",offset:[10,0],className:"pin-tip"}).addTo(LAYER); }\n')
rep('if(st.length>1) L.polyline(st.map(s=>[s.j.lat,s.j.lng]),',
    'if(st.length) L.polyline([[shop().lat,shop().lng],...st.map(s=>[s.j.lat,s.j.lng]),[shop().lat,shop().lng]],')

# actions
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "clock-in": t.disabled=true; await clockIn(t.dataset.j,v,false); break;
    case "clock-out": t.disabled=true; await clockOut(id,false); break;
    case "auto-clock": await setAuto(!AUTO.on); break;
    case "truck": openDrawer("truck",v); break;
    case "best-order": { t.disabled=true; const ids=S.team==="all"?crews().map(c=>c.id):[S.team]; let b=0,a=0,u=0,n=0;
      try{ for(const c of ids){ const r=await applyOrder(v,c); if(r){ b+=r.before; a+=r.after; u+=r.unplaced; n++; } }
        toast(n? (b-a>0.5?`Reordered. About ${Math.round(b-a)} fewer miles.`:"Already in the best order.")+(u?` ${u} stop${u>1?"s":""} without a pin went last.`:"") : "Nothing to reorder"); }
      catch(e){ fail(e,"reorder the route"); } break; }
''')

rep('.who-btn{', '''.route-tools{display:grid;gap:8px}
.wxline{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:14px;color:var(--ink-2)}
.wxline b{font-family:var(--f-mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-right:6px}
.who-btn{''')
