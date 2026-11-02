
/* ---------- activity log: the app reports crashes, slow screens, load time and failed saves ---------- */
const DEVICE = (()=>{ const ua=navigator.userAgent; const d=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?"iPad":/iPhone/.test(ua)?"iPhone":/Android/.test(ua)?"Android":/Mac/.test(ua)?"Mac":/Windows/.test(ua)?"Windows":"Other";
  const b=/Edg\//.test(ua)?"Edge":/CriOS|Chrome\//.test(ua)?"Chrome":/FxiOS|Firefox\//.test(ua)?"Firefox":/Safari\//.test(ua)?"Safari":""; return d+(b?" · "+b:"")+(matchMedia("(display-mode: standalone)").matches||navigator.standalone?" · app":""); })();
const EVQ=[], EVSEEN=new Map();
function track(type, info){
  try{ const key=type+"|"+(info&&(info.msg||info.where||info.what)||""), now=Date.now(); if(EVSEEN.has(key)&&now-EVSEEN.get(key)<60000) return; EVSEEN.set(key,now);
    EVQ.push({type, device:DEVICE, view:(window.S&&S.view)||"", build:((document.querySelector('meta[name="build"]')||{}).content||""), ...(info||{})}); if(EVQ.length>60) EVQ.splice(0,EVQ.length-60); }catch(e){}
}
async function flushEvents(){ if(!EVQ.length||!window.PL||!PL.me()||!navigator.onLine) return; const batch=EVQ.splice(0,25); try{ await PL.logEvents(batch); }catch(e){ if(!/function|exist/i.test(e.message||"")) EVQ.unshift(...batch); } }
setInterval(flushEvents, 15000);
document.addEventListener("visibilitychange",()=>{ if(document.hidden) flushEvents(); });
window.addEventListener("error",e=>{ if(!e.message||/ResizeObserver|Script error/i.test(e.message)) return; track("crash",{msg:String(e.message).slice(0,300),src:`${String(e.filename||"").split("/").pop()}:${e.lineno||""}`,stack:String((e.error&&e.error.stack)||"").slice(0,700)}); });
window.addEventListener("unhandledrejection",e=>{ const r=e.reason, m=String((r&&r.message)||r||""); if(!m||/Failed to fetch|NetworkError|Load failed|AbortError/i.test(m)) return; track("crash",{msg:m.slice(0,300),stack:String((r&&r.stack)||"").slice(0,700),async:true}); });
const LAGT=new Map();
function lagCheck(where, ms){ if(ms<300) return; const now=Date.now(); if(LAGT.has(where)&&now-LAGT.get(where)<120000) return; LAGT.set(where,now); track("lag",{where,ms:Math.round(ms)}); }
try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(e.duration>700) lagCheck("busy page",e.duration); }).observe({type:"longtask",buffered:false}); }catch(e){}
let LOADED_AT=0;
function noteLoad(){ if(LOADED_AT||!S.ready) return; LOADED_AT=performance.now(); const ms=Math.round(LOADED_AT); track(ms>6000?"slow-load":"load",{ms,online:navigator.onLine}); }

/* ---------- activity log screen (managers) ---------- */
const ACT = { filter:"all", who:"", rows:null, health:null, more:true, loading:false, err:"", open:new Set() };
async function loadActivity(reset){
  if(ACT.loading) return; ACT.loading=true; ACT.err="";
  try{ const before=reset?null:(ACT.rows&&ACT.rows.length?ACT.rows[ACT.rows.length-1].at:null);
    const r=await PL.auditList({before,filter:ACT.filter,who:ACT.who||null});
    ACT.rows=reset?r:[...(ACT.rows||[]),...r]; ACT.more=r.length>=150;
    if(reset) ACT.health=await PL.auditHealth().catch(()=>null);
  }catch(e){ ACT.err=e.message; if(!ACT.rows) ACT.rows=[]; }
  ACT.loading=false; if(S.view==="office"&&S.office==="activity") renderMain();
}
const actWho = id => id ? (id===S.me.id?"You":staffName(id)) : "System";
function actShort(v){ if(v==null) return "–"; if(typeof v==="string") return v.length>60?v.slice(0,57)+"…":v; if(typeof v==="boolean") return v?"on":"off"; const t=JSON.stringify(v); return t.length>60?t.slice(0,57)+"…":t; }
function actDesc(r){
  const i=r.info||{}, ref=i.ref||{}, a=i.after||{}, b=i.before||{}, f=i.fields||[];
  const jobName=id=>{ const j=id&&S.jobs.get(id); return j?(clientOf(j).name||"a job"):"a job that's gone"; };
  const verb={insert:"Added",update:"Changed",delete:"Deleted"}[r.kind]||r.kind;
  const nice=k=>({visits:"visits",crew:"crew",stage:"stage",scope:"lights",notes:"crew notes",price:"price",ssPct:"ShipShape %",collected:"collected",ssPaid:"ShipShape paid",sale:"sale",referral:"referral",in:"clock in",out:"clock out",can_manage:"manager",can_money:"money access",can_edit:"office access",can_log:"check-offs",active:"can sign in",pin_ok:"own PIN",look:"colors",photo:"headshot",title:"title",name:"name",mockups:"mockups",address:"address",lat:"map pin",lng:"map pin",status:"status"})[k]||k;
  const changed=[...new Set(f.map(nice))].join(", ");
  if(r.kind==="event"){ const t=r.doc_id, dev=i.device||"";
    if(t==="crash") return ["bad",`Crash: ${i.msg||"unknown error"}`,[i.view&&"on "+i.view,i.src,dev].filter(Boolean).join(" · "),i.stack];
    if(t==="lag") return ["warn",`Slow: ${i.where||i.view||"screen"} took ${(i.ms/1000).toFixed(1)} s`,dev];
    if(t==="slow-load") return ["warn",`Slow to open: ${(i.ms/1000).toFixed(1)} s`,dev];
    if(t==="load") return ["",`Opened the board in ${(i.ms/1000).toFixed(1)} s`,dev];
    if(t==="save-failed") return ["bad",`Couldn't ${i.what||"save a change"}`,[i.msg,i.offline?"no signal":"",dev].filter(Boolean).join(" · ")];
    if(t==="signin") return ["ok","Signed in",dev];
    return ["",t,dev]; }
  if(r.coll==="log"){ const k=ref.kind||a.kind||b.kind, jn=ref.jobId?jobName(ref.jobId):"";
    if(k==="done") return r.kind==="delete"?["warn",`Undid a check-off · ${jn}`,""]:["ok",`Marked done · ${jn}`,""];
    if(k==="clock"){ const where=ref.jobId?jn:(a.where||b.where)==="travel"?"driving":"shop";
      if(r.kind==="insert") return ["",`${a.pending?"Asked to add time":"Clocked in"} · ${where}`, a.in?`${tfmt(a.in)}${a.out?" – "+tfmt(a.out):""}`:""];
      if(r.kind==="delete") return ["warn",`Deleted time · ${where}`,""];
      if(f.length===1&&f[0]==="out"&&!b.out) return ["",`Clocked out · ${where}`,a.out?tfmt(a.out):""];
      return ["warn",`Changed a time card · ${where}`,f.filter(k=>k==="in"||k==="out").map(k=>`${nice(k)} ${b[k]?tfmt(b[k]):"–"} → ${a[k]?tfmt(a[k]):"–"}`).join(", ")||changed]; }
    if(k==="timereq") return r.kind==="insert"?["",`Asked for a time fix`,a.summary||""]:["",`Time fix ${a.status||"changed"}`,""];
    if(k==="note") return ["",`${verb==="Added"?"Posted":verb} a note · ${jn}`,""];
    if(k==="partial") return ["warn",`Marked partly done · ${jn}`,a.why||""];
    if(k==="issue") return ["warn",`Reported a problem · ${jn}`,""];
    return ["",`${verb} ${k||"an entry"}${jn?" · "+jn:""}`,changed]; }
  if(r.coll==="jobs") return ["",`${verb} job · ${jobName(r.doc_id)}`,r.kind==="update"?"Changed "+changed:""];
  if(r.coll==="clients") return ["",`${verb} client · ${(S.clients.get(r.doc_id)||{}).name||ref.name||a.name||b.name||""}`,r.kind==="update"?"Changed "+changed:""];
  if(r.coll==="fin"){ const p=f.includes("price")?`price ${actShort(b.price)} → ${actShort(a.price)}`:""; return ["",`${verb} money · ${jobName(r.doc_id)}`,p||(r.kind==="update"?"Changed "+changed:"")]; }
  if(r.coll==="settings") return ["",`${verb} settings`,r.doc_id+(changed?" · "+changed:"")];
  if(r.coll==="staff") return ["",`${verb} person · ${ref.name||""}`,r.kind==="update"?"Changed "+changed:""];
  if(r.coll==="messages") return ["",r.kind==="delete"?"Deleted a chat message":"Sent a chat message",""];
  return ["",`${verb} ${r.coll||""}`,changed];
}
function vActivity(){
  if(!ACT.rows&&!ACT.loading) loadActivity(true);
  const H=ACT.health, ppl=PL.staff();
  const tile=(l,v,cls)=>`<div class="dmoney-t ${cls||""}"><small>${l}</small><b>${v}</b></div>`;
  let h=`<div class="dcard"><header><span class="eyebrow">Last 7 days</span><button type="button" class="linkbtn" data-act="act-refresh">Refresh</button></header><div class="dmoney act-health">
    ${H?tile("Crashes",H.crashes||0,H.crashes?"bad":"")+tile("Slow screens",H.lag||0,H.lag?"warn":"")+tile("Failed saves",H.failed||0,H.failed?"bad":"")+tile("Avg open time",H.loadMs?(H.loadMs/1000).toFixed(1)+" s":"–",H.loadMs>5000?"warn":"")+tile("Changes",H.changes||0)+tile("Wrong PINs (24 h)",H.wrongPins||0,H.wrongPins>10?"warn":""):`<p class="count">Loading…</p>`}</div></div>
  <div class="bar"><div class="chips">${[["all","Everything"],["changes","Changes"],["problems","Problems"],["signins","Sign-ins"]].map(([k,l])=>`<button type="button" class="chip" data-act="act-filter" data-v="${k}" aria-pressed="${ACT.filter===k}">${l}</button>`).join("")}</div>
    <span class="grow"></span><select class="search" id="act-who" aria-label="Person" style="width:auto;min-width:160px"><option value="">Everyone</option>${ppl.map(p=>`<option value="${esc(p.id)}" ${ACT.who===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>`;
  if(ACT.err) h+=`<div class="note">${esc(ACT.err)}${/function|exist|schema/i.test(ACT.err)?"<br>Run update 13 in Supabase to turn on the activity log.":""}</div>`;
  if(!ACT.rows) return h+skel(6);
  if(!ACT.rows.length) return h+`<p class="count">Nothing here yet. Everything people do on the board from now on shows up here.</p>`;
  let day="";
  h+=`<div class="rows act-rows">`;
  for(const r of ACT.rows){ const d=isoOf(r.at), [cls,txt,det,more]=actDesc(r);
    if(d!==day){ day=d; h+=`<div class="act-day">${esc(fmtDay(d,{weekday:"long",month:"short",day:"numeric"}))}</div>`; }
    const open=ACT.open.has(r.id), i=r.info||{}, hasMore=more||(r.kind==="update"&&(i.fields||[]).length);
    h+=`<div class="act-row ${cls}" ${hasMore?`data-act="act-open" data-v="${r.id}" style="cursor:pointer"`:""}><span class="act-t mono">${tfmt(r.at)}</span>${avatar(r.who,"sm")}<span class="m"><span class="n"><b>${esc(actWho(r.who))}</b> ${esc(txt)}</span>${det?`<span class="s">${esc(det)}</span>`:""}
      ${open?`<pre class="act-more">${esc(more||(i.fields||[]).filter(k=>k!=="photo").map(k=>`${k}: ${actShort((i.before||{})[k])} → ${actShort((i.after||{})[k])}`).join("\n"))}</pre>`:""}</span></div>`; }
  h+=`</div>${ACT.more?`<div class="bar"><button type="button" class="btn" data-act="act-more" ${ACT.loading?"disabled":""}>${ACT.loading?"Loading…":"Show older"}</button></div>`:""}
  <p class="count" style="font-size:12.5px">Every change on the board is recorded by the server, so it can't be skipped or edited. Chat shows that a message was sent, never what it said. Money changes only show to people with money access. Kept for a year.</p>`;
  return h;
}
