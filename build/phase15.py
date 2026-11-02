# ShipShape crew view. Applied after phase14.py.
P15 = open(pathlib.Path(__file__).with_name('phase15.js')).read()
rep('\n/* ---------- render ---------- */\n', P15 + '\n/* ---------- render ---------- */\n')
rep('function crews(){\n  const c=S.settings.crews;', 'function crews(){ const a=crewsAll(); return ssOnly()?a.filter(c=>c.co==="shipshape"):a; }\nfunction crewsAll(){\n  const c=S.settings.crews;')
rep('function teamSeg(){\n', 'function teamSeg(){\n  if(ssOnly()&&crews().length<2) return "";\n')
rep('["co-shipshape","ShipShape crew"],["all","All"]];', '["co-shipshape","ShipShape crew"],["all","All"]].filter(([k])=>!ssOnly()||["active","unsched","scheduled","lit","down","all"].includes(k));')
rep('const groups=[["ann","Announcements"],["crew","Crew channels"],["dm","Direct messages"]];', 'const groups=[["ann","Announcements"],["crew","Crew channels"],["dm","Direct messages"],["office","Office"]].filter(([k])=>k==="ann"||k==="crew"||chans.some(c=>c.kind===k));')
rep('function renderMain(){\n  const __t0=performance.now();', 'function renderMain(){\n  const __t0=performance.now();\n  applyBrand();')
rep('.gate-lang{', '''.ss-view .d-marks,.ss-view [aria-label="Whose clients"]{display:none!important}
.ss-view .c-crew,.ss-view .jhead span:nth-child(2),.ss-view .jhead span:nth-child(3){visibility:hidden}
.wday h4{flex-wrap:wrap;gap:0 6px}
.ss-view .rail .logo{width:170px} .ss-view .topbar .logo{height:34px}
.gate-lang{''')
rep('if(!id) return "TCL import";', 'if(!id) return ssOnly()?"Office":"TCL import";')
rep('${j.tclWhen?`<dt>TCL target</dt>', '${j.tclWhen&&!ssOnly()?`<dt>TCL target</dt>', 2)
rep('${j.ready?`<dt>Ready</dt>', '${j.ready&&!ssOnly()?`<dt>Ready</dt>')
rep('${j.tclRef?`<span class="mono count">TCL #', '${j.tclRef&&!ssOnly()?`<span class="mono count">TCL #')
