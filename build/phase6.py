# Day clock (shop + driving), wired into auto clock-in. Applied after phase5.py.
P6 = open(pathlib.Path(__file__).with_name('phase6.js')).read()
rep('\n/* ---------- render ---------- */\n', P6 + '\n/* ---------- render ---------- */\n')

# job clock ignores the day clock
rep('function myOpenClock(){ for(const [id,e] of S.log) if(e.kind==="clock"&&e.by===S.me.id&&!e.out) return {id,...e}; return null; }',
    'function myOpenClock(){ for(const [id,e] of S.log) if(e.kind==="clock"&&!e.general&&e.by===S.me.id&&!e.out) return {id,...e}; return null; }')
# clocking in at a job pauses the day clock; clocking out of a job resumes it
rep('  if(open){ if(open.jobId===jid&&open.visitId===vid) return; await clockOut(open.id,auto,true); }\n  const now=new Date().toISOString();',
    '  if(open){ if(open.jobId===jid&&open.visitId===vid) return; await clockOut(open.id,auto,true,true); }\n  { const g=myOpenGeneral(); if(g) await S.db.doc("log/"+g.id).update({out:new Date().toISOString(),autoOut:!!auto}).catch(()=>{}); }\n  const now=new Date().toISOString();')
rep('async function clockOut(id,auto,quiet){\n  try{ await S.db.doc("log/"+id).update({out:new Date().toISOString(),autoOut:!!auto}); if(!quiet) toast(auto?"Clocked out. You left the stop.":"Clocked out"); }',
    'async function clockOut(id,auto,quiet,noResume){\n  try{ await S.db.doc("log/"+id).update({out:new Date().toISOString(),autoOut:!!auto}); if(!quiet) toast(auto?"Clocked out. Driving time is on.":"Clocked out"); if(!noResume) setTimeout(()=>resumeGeneral(auto),300); }')

# auto mode: shop arrival starts the day, leaving the shop after the last stop ends it
rep('''      else if(best && bd<=120) await clockIn(best.j.id,best.v.id,true);
    }''','''      else if(best && bd<=120) await clockIn(best.j.id,best.v.id,true);
      const sh=shop(), dShop=hasLL(sh)?miles(me,sh)*1609:Infinity;
      if(dShop<=150){
        if(!dayStarted()) await startGeneral("shop",true);
        else if(!dayEnded() && myToday().some(c=>!c.general)) AUTO.backAtShop=true;
        AUTO.shopFar=0;
      } else if(!AUTO.backAtShop && dShop>300 && (myOpenGeneral()||{}).where==="shop"){
        if(++AUTO.shopFar>=2){ AUTO.shopFar=0; const g=myOpenGeneral(); await S.db.doc("log/"+g.id).update({out:new Date().toISOString(),autoOut:true}); await startGeneral("travel",true); }
      } else if(AUTO.backAtShop && !myOpenClock() && dShop>400 && !list.length){
        if(++AUTO.shopFar>=2){ AUTO.backAtShop=false; AUTO.shopFar=0; await stopGeneral(true,true); }
      }
    }''')
rep('''function autoStatus(){
  if(!AUTO.last) return "Waiting for your location…";''','''function autoStatus(){
  if(!AUTO.last) return "Waiting for your location…";
  if(dayEnded()) return "Your day is done.";
  if(!dayStarted()) return "You'll clock in when you get to the shop, or at your first stop.";''')
rep('''  return AUTO.near ? `Nearest stop: ${AUTO.near}. You'll clock in when you get there.` : "No open stops left today.";''',
    '''  const g=myOpenGeneral(), lead=g?(g.where==="shop"?"At the shop, clocked in. ":"Driving time is on. "):"";
  return lead+(AUTO.near ? `Next: ${AUTO.near}. You'll switch to that job when you get there.` : "No stops left. You'll clock out for the day when you leave the shop.");''')
# remember auto clock-in on this phone
rep('    AUTO.on=true; toast("Auto clock-in is on. Keep the board open on screen.");', '    AUTO.on=true; ls("autoClock","1"); toast("Auto clock-in is on. Keep the board open on screen.");')
rep('    Object.assign(AUTO,{on:false,watch:null,lock:null,far:0,last:null,near:""});', '    Object.assign(AUTO,{on:false,watch:null,lock:null,far:0,last:null,near:""}); ls("autoClock","0");')
rep('S.ready=true; setTimeout(fillPins,4000);', 'S.ready=true; setTimeout(fillPins,4000); if(ls("autoClock")==="1"&&S.me.canLog&&!AUTO.on) setTimeout(()=>setAuto(true),1200);')

# route tools: Start my day / End day
rep('      ${S.me.canLog&&d===todayISO()?`<button type="button" class="chip" data-act="auto-clock"', '      ${d===todayISO()?dayBtn():""}${S.me.canLog&&d===todayISO()?`<button type="button" class="chip" data-act="auto-clock"')
rep('    case "auto-clock": await setAuto(!AUTO.on); break;', '''    case "auto-clock": await setAuto(!AUTO.on); break;
    case "day-start": await startGeneral("shop",false); renderMain(); break;
    case "day-end": { const j=myOpenClock(); if(j) await clockOut(j.id,false,true,true); await stopGeneral(true,false); AUTO.backAtShop=false; renderMain(); break; }''')

# hours: split job time from shop/driving time
rep('''  const per=new Map(); for(const r of rows){ const p=per.get(r.by)||{ms:0,stops:new Set()}; p.ms+=clockMs(r); p.stops.add(r.jobId+"|"+r.visitId); per.set(r.by,p); }''',
    '''  const per=new Map(); for(const r of rows){ const p=per.get(r.by)||{ms:0,job:0,gen:0,stops:new Set()}; const m=clockMs(r); p.ms+=m; if(r.general) p.gen+=m; else { p.job+=m; p.stops.add(r.jobId+"|"+r.visitId); } per.set(r.by,p); }''')
rep('''<span class="count" style="font-size:13px">${p.stops.size} stop${p.stops.size>1?"s":""}</span></div>''',
    '''<span class="count" style="font-size:13px">On jobs ${fmtDur(p.job)} · ${p.stops.size} stop${p.stops.size===1?"":"s"}<br>Shop & driving ${fmtDur(p.gen)}</span></div>''')
rep('''<td>${esc(clientOf(S.jobs.get(r.jobId)||{}).name||"Job")}</td>''', '''<td>${r.general?`<i>${r.where==="shop"?"Shop":"Driving"}${r.endDay?" · end of day":""}</i>`:esc(clientOf(S.jobs.get(r.jobId)||{}).name||"Job")}</td>''')
rep('Hours show up here when crews clock in and out at stops, by hand or with auto clock-in.', 'Hours show up here when crews start their day at the shop and clock in at stops, by hand or with auto clock-in.')
