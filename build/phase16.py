# ProLight crew view. Applied after phase15.py.
P16 = open(pathlib.Path(__file__).with_name('phase16.js')).read()
rep('\n/* ---------- render ---------- */\n', P16 + '\n/* ---------- render ---------- */\n')
rep('function crews(){ const a=crewsAll(); return ssOnly()?a.filter(c=>c.co==="shipshape"):a; }',
    'function crews(){ const a=crewsAll(); if(ssOnly()) return a.filter(c=>c.co==="shipshape"); if(plOnly()){ const me=PL.me()||{}; return me.all_crews?a.filter(c=>c.co==="prolight"):a.filter(c=>c.id===normCrew(me.crew)); } return a; }')
rep('  if(ssOnly()&&crews().length<2) return "";', '  if(crewView()&&crews().length<2) return "";')
rep('["co-shipshape","ShipShape crew"],["all","All"]].filter(([k])=>!ssOnly()||', '["co-shipshape","ShipShape crew"],["all","All"]].filter(([k])=>!crewView()||')
rep('if(!id) return ssOnly()?"Office":"TCL import";', 'if(!id) return crewView()?"Office":"TCL import";')
rep('${j.tclWhen&&!ssOnly()?`<dt>TCL target</dt>', '${j.tclWhen&&!crewView()?`<dt>TCL target</dt>', 2)
rep('${j.ready&&!ssOnly()?`<dt>Ready</dt>', '${j.ready&&!crewView()?`<dt>Ready</dt>')
rep('${j.tclRef&&!ssOnly()?`<span class="mono count">TCL #', '${j.tclRef&&!crewView()?`<span class="mono count">TCL #')
rep('function label(j){\n', 'function label(j){\n  if(plOnly()) return j.source==="tcl"?"TCL":"";\n  if(ssOnly()) return j.source==="tcl"?"TCL":"ProLight";\n')
rep('function renderMain(){\n  const __t0=performance.now();\n  applyBrand();', 'function renderMain(){\n  const __t0=performance.now();\n  applyBrand(); applyCrewView();')
# map: today's route and scheduled only; how-to text
rep('  const modes=[["unsched","Needs a date"],["sched","Scheduled"],["day","One day\'s route"],["active","All active"]];',
    '  const modes=plOnly()?[["day","Today\'s route"],["sched","Scheduled"]]:[["unsched","Needs a date"],["sched","Scheduled"],["day","One day\'s route"],["active","All active"]];')
rep('<span class="eyebrow">Plan by area</span><p class="lede" style="font-size:14px">Tap a pin to see the job, the closest jobs around it, and to assign a crew and date. Bulbs show the crew color. Hollow pins have no crew yet',
    '<span class="eyebrow">${plOnly()?"Your stops":"Plan by area"}</span><p class="lede" style="font-size:14px">${plOnly()?"Tap a pin to see the job and get directions. Use the arrows to look at another day.":"Tap a pin to see the job, the closest jobs around it, and to assign a crew and date. Bulbs show the crew color. Hollow pins have no crew yet"}')
# chat: ProLight people, managers under Office
rep('    if(ss){ if(isSS(p.id)||p.partner==="shipshape")', '    if(plOnly()){ if(p.can_manage) list.push({id:dmId(me.id,p.id),name:p.name,kind:"office",who:p.id}); else if(!isSS(p.id)&&p.partner!=="shipshape") list.push({id:dmId(me.id,p.id),name:p.name,kind:"dm",who:p.id}); }\n    else if(ss){ if(isSS(p.id)||p.partner==="shipshape")')
rep('["dm","Direct messages"],["office","Office"]].filter(', '["office","Office"],["dm","Direct messages"]].filter(')
rep('.wday h4{flex-wrap:wrap;gap:0 6px}', '''.wday h4{flex-wrap:wrap;gap:0 6px}
.lbl:empty{display:none}
.map-box,.rmap-box{position:relative;isolation:isolate;z-index:0}
.scrim{z-index:1500!important}.drawer{z-index:1501!important}.toast{z-index:1600!important}.lightbox{z-index:1700!important}
#gate{z-index:3000!important}#intro,#routelit{z-index:3100!important}#welcome{z-index:3200!important}
.pl-view [aria-label="Whose clients"]{display:none!important}
.pl-view .c-crew,.pl-view .jhead span:nth-child(2),.pl-view .jhead span:nth-child(3){visibility:hidden}''')

# lunch search: ask our server first (it tries several map servers), then the map servers directly
rep('''  const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q)});
  if(!r.ok) throw new Error("lookup failed");
  const d=await r.json();''', '''  let d=null;
  try{ const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),15000); const r=await fetch(`/api/places?lat=${c.lat.toFixed(2)}&lng=${c.lng.toFixed(2)}`,{signal:ctl.signal}); clearTimeout(t); if(r.ok) d=await r.json(); }catch(e){}
  if(!d||!Array.isArray(d.elements)) throw new Error("lookup failed");''')

rep('  const key=c.lat.toFixed(3)+","+c.lng.toFixed(3); if(FOOD.cache.has(key)) return FOOD.cache.get(key);', '  const key=c.lat.toFixed(2)+","+c.lng.toFixed(2); if(FOOD.cache.has(key)) return FOOD.cache.get(key); if(FOOD.pending&&FOOD.pending.has(key)) return FOOD.pending.get(key);\n  const job=findFood2(c); (FOOD.pending=FOOD.pending||new Map()).set(key,job); try{ return await job; } finally{ FOOD.pending.delete(key); }\n}\nasync function findFood2(c){\n  const key=c.lat.toFixed(2)+","+c.lng.toFixed(2);')
rep('function lunchCard(L,d){\n  const a=L.a, b=L.b, mid = a&&b ? {lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2} : (a||b||shop());', 'function lunchCard(L,d){\n  const a=L.a, b=L.b, mid = a&&b ? {lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2} : (a||b||shop());\n  { const A=a||shop(); if(A&&isFinite(A.lat)) setTimeout(()=>findFood({lat:A.lat,lng:A.lng}).catch(()=>{}),800); }')
