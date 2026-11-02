# Logo placements, applied by build.py
rep('<div class="brand"><b>PRO<i>LIGHT</i></b><span>Season Board</span></div><span class="sp"></span>',
    '<div class="brand"><img class="logo" src="/brand/prolight.png" alt="ProLight Tallahassee" width="112" height="46"><span>Season Board</span></div><span class="sp"></span>')
rep('<div class="brand"><b>PRO<i>LIGHT</i></b><span>Season Board · Tallahassee</span></div>',
    '<div class="brand"><img class="logo" src="/brand/prolight.png" alt="ProLight Tallahassee" width="172" height="71"><span>Season Board</span></div>')
rep('function drawerShell(eyebrow,title,body){', 'function drawerShell(eyebrow,title,body,marks){')
rep('<h2>${esc(title)}</h2></div><button type="button" class="btn small" data-act="close">Close</button></div>',
    '<h2>${esc(title)}</h2>${marks?`<div class="d-marks">${marks}</div>`:""}</div><button type="button" class="btn small" data-act="close">Close</button></div>')
rep('return drawerShell(esc(fmtDay(nextVisit(j)?.date||"")||"Job"), c.name||"Customer", b);',
    'return drawerShell(esc(fmtDay(nextVisit(j)?.date||"")||"Job"), c.name||"Customer", b, partnerMarks(j));')
PARTNER = '''
function partnerMarks(j){
  const m=[];
  if(j.source==="tcl") m.push(`<img src="/brand/tcl.png" alt="Tallahassee Christmas Lights" title="TCL job" class="mk-tcl">`);
  if(coOf(j.crew)==="shipshape") m.push(`<img src="/brand/shipshape.png" alt="ShipShape Exteriors" title="ShipShape crew" class="mk-ss">`);
  return m.join("");
}
'''
rep('\n/* ---------- people & sign-in ---------- */\n', PARTNER + '/* ---------- people & sign-in ---------- */\n')
LOGO_CSS = '''.topbar .brand{align-items:center}
.topbar .logo{height:30px;width:auto;display:block}
.rail .logo{width:150px;height:auto;display:block}
.d-marks{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:6px}
.d-marks img{display:block;width:auto}
.d-marks .mk-tcl{height:58px}
.d-marks .mk-ss{height:40px}
.gate-brand img{width:220px;height:auto;margin:0 auto}
'''
rep('.who-btn{', LOGO_CSS + '.who-btn{')
