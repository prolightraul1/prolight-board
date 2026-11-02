
/* ---------- shop, best route order, arrival estimates ---------- */
const SHOP_DEFAULT={address:"2821 Industrial Plaza Dr, Tallahassee, FL 32301",lat:30.45029,lng:-84.22834,leave:"08:00"};
const shop=()=>({...SHOP_DEFAULT,...(S.settings.shop||{})});
const ROAD=1.3, MPH=30, ON_SITE={install:90,takedown:45,service:45};
const legMiles=(a,b)=>miles(a,b)*ROAD;
function routeMiles(pts){ const s=shop(); let t=0, prev=s; for(const p of pts){ t+=legMiles(prev,p); prev=p; } return pts.length? t+legMiles(prev,s) : 0; }
function bestOrder(stops){
  const geo=stops.filter(s=>hasLL(s.j)), rest=stops.filter(s=>!hasLL(s.j));
  if(geo.length<2) return [...geo,...rest];
  const s=shop(); let left=geo.slice(), path=[], cur=s;
  while(left.length){ let bi=0,bd=Infinity; left.forEach((x,i)=>{ const d=miles(cur,x.j); if(d<bd){bd=d;bi=i;} }); cur=left[bi].j; path.push(left.splice(bi,1)[0]); }
  let improved=true, guard=0;
  while(improved && guard++<300){ improved=false;
    for(let i=0;i<path.length-1;i++) for(let k=i+1;k<path.length;k++){
      const a=i===0?s:path[i-1].j, b=path[i].j, c=path[k].j, d=k===path.length-1?s:path[k+1].j;
      if(miles(a,c)+miles(b,d) < miles(a,b)+miles(c,d)-1e-9){ path=[...path.slice(0,i),...path.slice(i,k+1).reverse(),...path.slice(k+1)]; improved=true; } } }
  return [...path,...rest];
}
async function applyOrder(date, crewId){
  const stops=stopsFor(date,crewId); if(stops.length<2) return null;
  const before=routeMiles(stops.filter(s=>hasLL(s.j)).map(s=>s.j));
  const ord=bestOrder(stops), changes=new Map();
  ord.forEach((s,idx)=>{ const base=changes.get(s.j.id)||(S.jobs.get(s.j.id).visits||[]).map(x=>({...x})); const t=base.find(x=>x.id===s.v.id); if(t&&t.order!==idx+1){ t.order=idx+1; changes.set(s.j.id,base); } });
  for(const [id,visits] of changes) await S.db.doc("jobs/"+id).update({visits,updatedAt:new Date().toISOString()});
  return {before, after:routeMiles(ord.filter(s=>hasLL(s.j)).map(s=>s.j)), unplaced:ord.filter(s=>!hasLL(s.j)).length};
}
function dayRouteUrl(stops){
  const a=stops.map(s=>addrOf(s.j)).filter(Boolean).slice(0,8); if(!a.length) return "";
  return "https://www.google.com/maps/dir/"+[shop().address,...a,shop().address].map(encodeURIComponent).join("/");
}
function estTimes(stops){
  const m=new Map(), lv=(shop().leave||"08:00").split(":").map(Number); let t=lv[0]*60+(lv[1]||0), prev=shop();
  let lunch=null;
  stops.forEach((s,i)=>{
    if(hasLL(s.j)){ t+=Math.round(legMiles(prev,s.j)/MPH*60); prev=s.j; } else t+=15;
    const key=s.j.id+"|"+s.v.id;
    if(s.v.time){ const [h,mi]=s.v.time.split(":").map(Number); t=h*60+mi; m.set(key,{min:t,fixed:true}); } else m.set(key,{min:t,fixed:false});
    t+=ON_SITE[s.v.type]||60;
    if(!lunch && t>=LUNCH_AT && i<stops.length-1){ const nx=stops[i+1]; lunch={after:i,min:t,a:hasLL(s.j)?s.j:null,b:hasLL(nx.j)?nx.j:null,aName:clientOf(s.j).name,bName:clientOf(nx.j).name}; t+=LUNCH_MIN; }
  });
  m.lunch=lunch;
  return m;
}
const minTxt=min=>{ const h=Math.floor(min/60)%24, mm=min%60; return `${((h+11)%12)+1}:${pad(mm)} ${h<12?"AM":"PM"}`; };
function etaInfo(e,date){ const w=wxAt(date,Math.floor(e.min/60)); return {time:(e.fixed?"":"~")+minTxt(e.min), temp:w?w.temperature+"°":""}; }
function stopTimeTag(s){
  const e=S._eta&&S._eta.get(s.j.id+"|"+s.v.id); if(!e) return "";
  const i=etaInfo(e,s.v.date);
  return `<span class="mono" style="font-size:13px" title="${e.fixed?"Set time":"Estimated arrival, leaving the shop at "+minTxt(((shop().leave||"08:00").split(":").map(Number).reduce((h,m)=>h*60+m)))}">${i.time}${i.temp?` · ${i.temp}`:""}</span>`;
}

/* ---------- sunset + weather ---------- */
function sunsetFor(dateISO,lat=30.44,lng=-84.28){
  const d=parseISO(dateISO), rad=Math.PI/180;
  const N=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(d.getFullYear(),0,0))/864e5);
  const lngHour=lng/15, t=N+((18-lngHour)/24), M=(0.9856*t)-3.289;
  let L=(M+(1.916*Math.sin(M*rad))+(0.020*Math.sin(2*M*rad))+282.634+360)%360;
  let RA=(Math.atan(0.91764*Math.tan(L*rad))/rad+360)%360; RA+=(Math.floor(L/90)*90-Math.floor(RA/90)*90); RA/=15;
  const sinDec=0.39782*Math.sin(L*rad), cosDec=Math.cos(Math.asin(sinDec));
  const cosH=(Math.cos(90.833*rad)-(sinDec*Math.sin(lat*rad)))/(cosDec*Math.cos(lat*rad)); if(cosH<-1||cosH>1) return null;
  const H=Math.acos(cosH)/rad/15, T=H+RA-(0.06571*t)-6.622; let UT=(T-lngHour)%24; if(UT<0) UT+=24;
  return new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())+UT*3600e3);
}
const clockTxt=dt=>dt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"});
const WX={hourly:null,daily:null,at:0,loading:false};
async function loadWx(){
  if(WX.loading||Date.now()-WX.at<30*60e3) return; WX.loading=true;
  try{
    const p=await fetch("https://api.weather.gov/points/30.45,-84.23").then(r=>r.json());
    const [h,d]=await Promise.all([fetch(p.properties.forecastHourly).then(r=>r.json()),fetch(p.properties.forecast).then(r=>r.json())]);
    WX.hourly=h.properties.periods; WX.daily=d.properties.periods; WX.at=Date.now(); WX.loading=false; refresh(); return;
  }catch(e){ WX.at=Date.now()-25*60e3; }
  WX.loading=false;
}
function wxAt(dateISO,hour){ if(!WX.hourly||!dateISO) return null; const t=new Date(`${dateISO}T${pad(hour)}:00:00`); return WX.hourly.find(p=>new Date(p.startTime)<=t&&new Date(p.endTime)>t)||null; }
function wxDay(dateISO){ return WX.daily ? WX.daily.find(p=>p.isDaytime&&p.startTime.slice(0,10)===dateISO)||null : null; }
function wxLine(d){
  const ss=sunsetFor(d), wd=wxDay(d), parts=[];
  if(ss) parts.push(`<span><b>Sunset</b>${clockTxt(ss)}</span>`);
  if(wd){ parts.push(`<span><b>High</b>${wd.temperature}°</span>`, `<span>${esc(wd.shortForecast)}</span>`); const pop=wd.probabilityOfPrecipitation&&wd.probabilityOfPrecipitation.value; if(pop) parts.push(`<span><b>Rain</b>${pop}%</span>`); }
  return parts.join("");
}
function wxText(d){
  const ss=sunsetFor(d), wd=wxDay(d), p=[];
  if(ss) p.push("Sunset "+clockTxt(ss));
  if(wd){ p.push(`High ${wd.temperature}°F, ${wd.shortForecast}`); const pop=wd.probabilityOfPrecipitation&&wd.probabilityOfPrecipitation.value; if(pop) p.push(`${pop}% chance of rain`); }
  return p.join(" · ");
}

/* ---------- route header tools ---------- */
function routeTools(d,stops){
  loadWx();
  const team=S.team, multi=team==="all" ? crews().filter(c=>stopsFor(d,c.id).length>1) : (stops.length>1?[crewObj(team)].filter(Boolean):[]);
  const geo=stops.filter(s=>hasLL(s.j)), mi=team!=="all"&&geo.length ? routeMiles(geo.map(s=>s.j)) : 0;
  const wx=wxLine(d);
  return `<div class="route-tools">
    ${wx||mi?`<div class="wxline">${wx}${mi?`<span><b>Drive</b>≈${Math.round(mi)} mi, shop and back</span>`:""}</div>`:""}
    ${stops.length?`<div class="bar">
      ${S.me.owner&&multi.length?`<button type="button" class="btn small amber" data-act="best-order" data-v="${d}">Best order from shop</button>`:""}
      ${team!=="all"&&routeUrls(stops)?`<a class="btn small" href="${esc(routeUrls(stops).apple)}" target="_blank" rel="noopener">Apple Maps route ↗</a><a class="btn small" href="${esc(routeUrls(stops).google)}" target="_blank" rel="noopener">Google Maps route ↗</a>`:""}
      <button type="button" class="btn small" data-act="truck" data-v="${d}">Truck list</button>
      ${d===todayISO()?`<button type="button" class="btn small" data-act="hungry" data-v="live">I'm hungry</button>`:""}
      ${S.me.canLog&&d===todayISO()?`<button type="button" class="chip" data-act="auto-clock" aria-pressed="${AUTO.on}">Auto clock-in${AUTO.on?" · on":""}</button>`:""}
    </div>`:""}
    ${stops.length?(team!=="all"?truckLine(d,team):truckAllLines(d)):""}
    ${AUTO.on&&d===todayISO()?`<div class="count" style="font-size:13px">${esc(autoStatus())}</div>`:""}
  </div>`;
}

/* ---------- truck list ---------- */
const RUN_KINDS=["C9s","Minis","Nets","Garland","Wreath","Stakes","Other"];
const KIND_LABEL={C9s:"C9 bulbs",Minis:"Mini lights",Nets:"Net lights",Garland:"Lit garland",Wreath:"Wreaths",Stakes:"Stake lights",Other:"Spritzers / other"};
function parseRuns(j){
  const txt=j.notes||"", i=txt.indexOf("WHAT GOES WHERE"), block=i>=0?txt.slice(i+15):txt;
  const lines=block.split("\n").map(x=>x.trim()).filter(Boolean), runs=[], re=new RegExp("^("+RUN_KINDS.join("|")+")\\b\\s*·\\s*(.*)$");
  for(let k=0;k<lines.length;k++){
    const L=lines[k]; if(/^POWER:/.test(L)) break;
    const m=L.match(re); if(!m) continue;
    const parts=m[2].split("·").map(x=>x.trim());
    const color=/not set/i.test(parts[0]||"")?"Color TBD":(parts[0]||"");
    const clip=parts.find(p=>/clip|tabs|zip ties/i.test(p)&&!/wrap only|no clips/i.test(p))||"";
    const q=parts.map(p=>p.match(/^(\d+)(?: strands)?$/)).find(Boolean);
    runs.push({kind:m[1],color,clip,qty:q?+q[1]:null,area:(lines[k-1]&&!re.test(lines[k-1]))?lines[k-1]:""});
  }
  return runs;
}
function truckList(stops){
  const agg=new Map(), clips=new Map(), flags=[], noPlan=[]; let ft=0, ftJobs=0, downs=0;
  for(const s of stops){
    const j=s.j, nm=clientOf(j).name||"Customer";
    if(s.v.type==="takedown"){ downs++; continue; }
    const runs=parseRuns(j); if(!runs.length) noPlan.push(nm);
    for(const r of runs){
      const key=r.kind+"|"+r.color, a=agg.get(key)||{kind:r.kind,color:r.color,runs:0,qty:0,jobs:new Set()};
      a.runs++; if(r.qty) a.qty+=r.qty; a.jobs.add(nm); agg.set(key,a);
      if(r.clip) clips.set(r.clip,(clips.get(r.clip)||0)+1);
    }
    if(Number(j.rooflineFt)){ ft+=Number(j.rooflineFt); ftJobs++; }
    if(/client owns|stored in (his|her|their) garage|has (her|his|their) own/i.test(j.notes||"")) flags.push(`${nm}: uses the client's own lights`);
  }
  const items=[...agg.values()].sort((a,b)=>RUN_KINDS.indexOf(a.kind)-RUN_KINDS.indexOf(b.kind)||b.runs-a.runs);
  return {items, clips:[...clips.entries()].sort((a,b)=>b[1]-a[1]), ft, ftJobs, flags, noPlan, downs, n:stops.length};
}
function truckText(t){
  const L=[];
  for(const it of t.items) L.push(`- ${KIND_LABEL[it.kind]||it.kind}: ${it.color}, ${it.kind==="Wreath"?(it.qty||it.runs)+" wreath"+((it.qty||it.runs)>1?"s":""):it.runs+" run"+(it.runs>1?"s":"")}${it.qty&&it.kind!=="Wreath"?` (${it.qty} listed)`:""} · ${[...it.jobs].length} house${[...it.jobs].length>1?"s":""}`);
  if(t.clips.length) L.push("- Clips: "+t.clips.map(([c,n])=>`${c} (${n})`).join(", "));
  if(t.ftJobs) L.push(`- Roofline footage on file: ${t.ft} ft across ${t.ftJobs} house${t.ftJobs>1?"s":""}`);
  if(t.downs) L.push(`- Takedowns: ${t.downs}. Bring bins, labels and the ladder kit`);
  t.flags.forEach(f=>L.push("- "+f));
  if(t.noPlan.length) L.push("- No light plan yet: "+t.noPlan.join(", "));
  return L.join("\n");
}
function truckHTML(t){
  if(!t.n) return `<p class="lede">No stops.</p>`;
  return `<div class="rows">${t.items.map(it=>`<div class="row" style="cursor:default"><span class="lbl">${esc(KIND_LABEL[it.kind]||it.kind)}</span><span class="m"><span class="n">${esc(it.color)}</span><span class="s">${esc([...it.jobs].join(", "))}</span></span><span class="r mono" style="font-size:14px">${it.kind==="Wreath"?(it.qty||it.runs)+" wreath"+((it.qty||it.runs)>1?"s":""):it.runs+" run"+(it.runs>1?"s":"")}</span></div>`).join("")||`<div class="row" style="cursor:default"><span></span><span class="m"><span class="s">No light plans written for these stops yet.</span></span><span></span></div>`}</div>
  ${t.clips.length?`<dl class="kv"><dt>Clips</dt><dd>${esc(t.clips.map(([c,n])=>`${c} (${n})`).join(", "))}</dd>${t.ftJobs?`<dt>Footage</dt><dd class="mono">${t.ft} ft on ${t.ftJobs} house${t.ftJobs>1?"s":""}</dd>`:""}${t.downs?`<dt>Takedowns</dt><dd>${t.downs} · bins, labels, ladder kit</dd>`:""}</dl>`:""}
  ${t.flags.length?`<div class="note">${t.flags.map(esc).join("<br>")}</div>`:""}
  ${t.noPlan.length?`<p class="count" style="font-size:13px">No light plan yet: ${esc(t.noPlan.join(", "))}</p>`:""}`;
}
function dTruck(d){
  const groups = S.team==="all" ? crews().map(c=>[c,stopsFor(d,c.id)]).filter(([,st])=>st.length) : [[crewObj(S.team)||{id:S.team,name:teamName(S.team)},stopsFor(d,S.team)]];
  const txt=groups.map(([c,st])=>`${c.name.toUpperCase()} TRUCK · ${fmtDay(d,{weekday:"short",month:"short",day:"numeric"})}\n`+(assignOf(d,c.id)?`Truck: ${assignOf(d,c.id).truck||"not set"}${assignOf(d,c.id).trailer?" + trailer "+assignOf(d,c.id).trailer:" · no trailer"}\n`:"")+truckText(truckList(st))).join("\n\n");
  const b=`${groups.length?groups.map(([c,st])=>`<section class="blk"><h3 class="h-sec">${esc(c.name)} · ${st.length} stop${st.length>1?"s":""}</h3>${truckLine(d,c.id)}${truckHTML(truckList(st))}</section>`).join(""):`<p class="lede">No stops this day.</p>`}
    <p class="count" style="font-size:13px">Built from each job's "what goes where" list. Bring extra bulbs and clips. Footage only counts where it's on the job.</p>
    <textarea id="truck-text" class="search" style="min-height:120px;font-family:var(--f-mono);font-size:12px" readonly>${esc(txt)}</textarea>
    <div><button type="button" class="btn amber" data-act="copy" data-v="truck-text">Copy truck list</button></div>`;
  return drawerShell(fmtDay(d,{weekday:"long",month:"short",day:"numeric"}),"Truck list",b);
}

/* ---------- clock in / out ---------- */
const AUTO={on:false,watch:null,lock:null,far:0,last:null,near:""};
const fmtDur=ms=>{ const m=Math.max(0,Math.round(ms/60000)); return `${Math.floor(m/60)}h ${pad(m%60)}m`; };
function clocks(jid,vid){ const out=[]; for(const [id,e] of S.log) if(e.kind==="clock"&&e.jobId===jid&&(!vid||e.visitId===vid)) out.push({id,...e}); return out; }
function myOpenClock(){ for(const [id,e] of S.log) if(e.kind==="clock"&&e.by===S.me.id&&!e.out) return {id,...e}; return null; }
function clockMs(c){ return (c.out?Date.parse(c.out):Date.now())-Date.parse(c.in); }
function onSite(jid,vid){ const cs=clocks(jid,vid); if(!cs.length) return ""; const ppl=new Set(cs.map(c=>c.by)).size; return ` · on site ${fmtDur(cs.reduce((t,c)=>t+clockMs(c),0))}${ppl>1?` (${ppl} people)`:""}`; }
function clockBtn(j,v){
  if(!S.me.canLog||isDone(j.id,v.id)) return "";
  const mine=clocks(j.id,v.id).find(c=>c.by===S.me.id&&!c.out);
  return mine ? `<button type="button" class="btn ink" data-act="clock-out" data-id="${esc(mine.id)}">Clock out · ${fmtDur(clockMs(mine))}</button>`
              : `<button type="button" class="btn" data-act="clock-in" data-j="${esc(j.id)}" data-v="${esc(v.id)}">Clock in</button>`;
}
async function clockIn(jid,vid,auto){
  const open=myOpenClock();
  if(open){ if(open.jobId===jid&&open.visitId===vid) return; await clockOut(open.id,auto,true); }
  const now=new Date().toISOString();
  try{ await S.db.collection("log").add({kind:"clock",jobId:jid,visitId:vid,by:S.me.id,in:now,out:null,auto:!!auto,at:now}); toast(auto?`Clocked in at ${clientOf(S.jobs.get(jid)||{}).name||"this stop"}`:"Clocked in"); }
  catch(e){ fail(e,"clock in"); }
}
async function clockOut(id,auto,quiet){
  try{ await S.db.doc("log/"+id).update({out:new Date().toISOString(),autoOut:!!auto}); if(!quiet) toast(auto?"Clocked out. You left the stop.":"Clocked out"); }
  catch(e){ fail(e,"clock out"); }
}
function clockEntry(e){
  const t=x=>new Date(x).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  return `<div class="entry"><div class="meta"><span><b>${esc(who(e.by))}</b> ${e.out?"was on site":"clocked in"}${e.auto?" (auto)":""}</span><span>${esc(fmtDay(isoOf(e.in)))}</span></div>
    <div class="txt mono" style="font-size:13px">${t(e.in)} – ${e.out?t(e.out):"now"} · ${fmtDur(clockMs(e))}</div></div>`;
}
const isoOf=x=>toISO(new Date(x));
function autoStatus(){
  if(!AUTO.last) return "Waiting for your location…";
  const open=myOpenClock(); if(open) return `On site at ${clientOf(S.jobs.get(open.jobId)||{}).name||"a stop"}. You'll clock out when you drive off.`;
  return AUTO.near ? `Nearest stop: ${AUTO.near}. You'll clock in when you get there.` : "No open stops left today.";
}
function autoStops(){
  const me=PL.me()||{}; const team=S.team!=="all"?S.team:(me.crew||"all");
  return stopsFor(todayISO(),team).filter(s=>hasLL(s.j)&&!isDone(s.j.id,s.v.id));
}
let autoBusy=false;
async function onPos(p){
  AUTO.last={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,at:Date.now()};
  if(autoBusy) return; autoBusy=true;
  try{
    const me=AUTO.last, open=myOpenClock(), list=autoStops();
    let best=null,bd=Infinity; for(const s of list){ const d=miles(me,s.j)*1609; if(d<bd){bd=d;best=s;} }
    AUTO.near = best ? `${clientOf(best.j).name||"Customer"}, ${bd<1609?Math.round(bd*3.28)+" ft":(bd/1609).toFixed(1)+" mi"}` : "";
    if(p.coords.accuracy<=150){
      if(open){ const j=S.jobs.get(open.jobId); if(j&&hasLL(j)){ if(miles(me,j)*1609>300){ if(++AUTO.far>=2){ AUTO.far=0; await clockOut(open.id,true); } } else AUTO.far=0; } }
      else if(best && bd<=120) await clockIn(best.j.id,best.v.id,true);
    }
  } finally { autoBusy=false; if(S.view==="route"&&!S.drawer) renderMain(); }
}
async function setAuto(on){
  if(on){
    if(!navigator.geolocation){ toast("This phone can't share its location with the board."); return; }
    AUTO.watch=navigator.geolocation.watchPosition(onPos,err=>{ toast(err.code===1?"Location is blocked. Allow it for this site in your phone's settings.":"Can't get your location right now."); if(err.code===1) setAuto(false); },{enableHighAccuracy:true,maximumAge:15000,timeout:30000});
    try{ AUTO.lock=await navigator.wakeLock.request("screen"); }catch(e){}
    AUTO.on=true; toast("Auto clock-in is on. Keep the board open on screen.");
  } else {
    if(AUTO.watch!=null) navigator.geolocation.clearWatch(AUTO.watch);
    try{ AUTO.lock&&AUTO.lock.release(); }catch(e){}
    Object.assign(AUTO,{on:false,watch:null,lock:null,far:0,last:null,near:""});
  }
  renderMain();
}
document.addEventListener("visibilitychange",async()=>{ if(AUTO.on&&!document.hidden){ try{ AUTO.lock=await navigator.wakeLock.request("screen"); }catch(e){} } });
setInterval(()=>{ if(myOpenClock()&&S.view==="route"&&!S.drawer) renderMain(); },60000);

/* ---------- hours report ---------- */
function vHours(){
  const days=[...Array(7)].map((_,i)=>addDays(S.week,i));
  const rows=[...S.log.entries()].map(([id,e])=>({id,...e})).filter(e=>e.kind==="clock"&&e.in&&days.includes(isoOf(e.in))).sort((a,b)=>a.in.localeCompare(b.in));
  const per=new Map(); for(const r of rows){ const p=per.get(r.by)||{ms:0,stops:new Set()}; p.ms+=clockMs(r); p.stops.add(r.jobId+"|"+r.visitId); per.set(r.by,p); }
  const t=x=>new Date(x).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  return `<div class="bar"><button type="button" class="btn icon" data-act="week" data-v="-7" aria-label="Previous week">‹</button><b class="sign grow" style="font-size:22px">Week of ${fmtDay(S.week)}</b><button type="button" class="btn icon" data-act="week" data-v="7" aria-label="Next week">›</button></div>
  ${per.size?`<div class="tiles">${[...per.entries()].map(([id,p])=>`<div class="tile"><span class="l">${esc(who(id))}</span><span class="v">${fmtDur(p.ms)}</span><span class="count" style="font-size:13px">${p.stops.size} stop${p.stops.size>1?"s":""}</span></div>`).join("")}</div>
  <div class="tbl"><table><thead><tr><th>Day</th><th>Person</th><th>Stop</th><th>In</th><th>Out</th><th class="r">Time</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDay(isoOf(r.in),{weekday:"short",month:"short",day:"numeric"})}</td><td>${esc(who(r.by))}</td><td>${esc(clientOf(S.jobs.get(r.jobId)||{}).name||"Job")}</td><td class="mono">${t(r.in)}${r.auto?" ·a":""}</td><td class="mono">${r.out?t(r.out)+(r.autoOut?" ·a":""):"open"}</td><td class="r">${fmtDur(clockMs(r))}</td></tr>`).join("")}</tbody></table></div>
  <p class="count" style="font-size:13px">·a = automatic, from the phone's location.</p>`
  :`<div class="empty"><h3>No hours this week</h3><p>Hours show up here when crews clock in and out at stops, by hand or with auto clock-in.</p></div>`}`;
}
async function shopFromForm(){
  const el=$("#s-shop"), lv=$("#s-leave"); const cur=shop();
  const out={...(S.settings.shop||{}),address:cur.address,lat:cur.lat,lng:cur.lng,leave:(lv&&lv.value)||cur.leave};
  const a=el?el.value.trim():""; if(!a||a===cur.address) return out;
  const r=await PL.geocode(a).catch(()=>null);
  if(!r){ toast("Couldn't find the shop address. Kept the old one."); return out; }
  return {...out,address:a,lat:+(+r.lat).toFixed(5),lng:+(+r.lng).toFixed(5)};
}
