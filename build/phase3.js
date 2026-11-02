
/* ---------- several crews / trucks on one visit ---------- */
const visitCrews = (j,v) => [...new Set([crewOf(j,v), ...(((v&&v.crews)||[]).map(normCrew))].filter(Boolean))];
const ordOf = (v,team) => team&&team!=="all"&&v.orders&&v.orders[team]!=null ? v.orders[team] : (v.order??999);
const visitTrucks = v => [...((v&&v.trucks)||[]), ...((v&&v.trailers)||[]).map(t=>t+" (trailer)")];
function crewTags(j,v){
  const cs=visitCrews(j,v), out=[];
  if(v.returnOf) out.push(`<span class="vt returntag">Return</span>`);
  if(S.team==="all") out.push(`<span class="crewtag">${esc(cs.map(teamName).join(" + ")||"Unassigned")}</span>`);
  else if(cs.length>1) out.push(`<span class="crewtag">With ${esc(cs.filter(c=>c!==S.team).map(teamName).join(" + "))}</span>`);
  return out.join("");
}
function visitExtrasLine(v){
  const t=visitTrucks(v); return t.length?`<div class="t-facts"><span><b>Trucks</b>${esc(t.join(", "))}</span></div>`:"";
}
function dCrewTruck(key){
  const [jid,vid]=key.split("|"), j=S.jobs.get(jid), v=(j&&j.visits||[]).find(x=>x.id===vid); if(!v) return drawerShell("Visit","Not found","");
  const cs=visitCrews({...j,id:jid},v), F=fleet(), tr=v.trucks||[], tl=v.trailers||[];
  const b=`<form class="form" id="ctForm" data-key="${esc(key)}"><fieldset><legend>Crews on this ${esc(VTYPE[v.type].toLowerCase())}</legend>
    <p class="count" style="font-size:13px">The job shows on every checked crew's route. The first one checked leads.</p>
    <div class="checks">${crews().map(c=>`<label><input type="checkbox" class="ct-crew" value="${esc(c.id)}" ${cs.includes(c.id)?"checked":""}><span>${esc(c.name)}${cs[0]===c.id?"<small>Lead crew</small>":""}</span></label>`).join("")}</div></fieldset>
    <fieldset><legend>Trucks on this job</legend>${F.trucks.length?`<div class="checks">${F.trucks.map(t=>`<label><input type="checkbox" class="ct-truck" value="${esc(t)}" ${tr.includes(t)?"checked":""}><span>${esc(t)}</span></label>`).join("")}</div>`:`<p class="count">Add trucks in Office → Settings first.</p>`}
      ${F.trailers.length?`<div class="checks">${F.trailers.map(t=>`<label><input type="checkbox" class="ct-trailer" value="${esc(t)}" ${tl.includes(t)?"checked":""}><span>${esc(t)}<small>Trailer</small></span></label>`).join("")}</div>`:""}</fieldset>
    <div class="actions"><span></span><button type="submit" class="btn amber">Save</button></div></form>`;
  return drawerShell(fmtDay(v.date||"")||"No date", (clientOf(j).name||"Job")+" · crews & trucks", b);
}
async function saveCrewTruck(form){
  const [jid,vid]=form.dataset.key.split("|"), j=S.jobs.get(jid);
  const picked=[...form.querySelectorAll(".ct-crew:checked")].map(x=>x.value);
  const trucks=[...form.querySelectorAll(".ct-truck:checked")].map(x=>x.value), trailers=[...form.querySelectorAll(".ct-trailer:checked")].map(x=>x.value);
  const visits=(j.visits||[]).map(x=>({...x}));
  const v=visits.find(x=>x.id===vid); const lead=picked.includes(normCrew(v.crew||j.crew))?normCrew(v.crew||j.crew):(picked[0]||"");
  v.crew=lead; v.crews=picked.filter(c=>c!==lead); v.trucks=trucks; v.trailers=trailers;
  try{ await S.db.doc("jobs/"+jid).update({visits,updatedAt:new Date().toISOString()}); toast("Saved"); closeDrawer(); }catch(e){ fail(e,"save crews and trucks"); }
}

/* ---------- partly done ---------- */
const isPartial = (jid,vid) => partialMap.get(jid+"|"+vid);
const REASONS = ["Weather","Ran out of material","Ran out of time","Couldn't get access","Customer asked to stop","Equipment problem","Other"];
function partialBtn(j,v){
  const p=isPartial(j.id,v.id);
  if(p) return `<span class="btn partial" title="${esc(p.left||"")}">Partly done · ${esc(p.reason)}</span>`;
  return S.me.canLog ? `<button type="button" class="btn" data-act="partial" data-v="${esc(j.id)}|${esc(v.id)}">Partly done</button>` : "";
}
const hasReturn = (j,vid) => (j.visits||[]).some(x=>x.returnOf===vid);
function needsReturn(){
  const out=[]; for(const j of jobsArr()) for(const v of (j.visits||[])){ const p=isPartial(j.id,v.id); if(p && !isDone(j.id,v.id) && !hasReturn(j,v.id)) out.push({j,v,p}); }
  return out;
}
function dPartial(key){
  const [jid,vid]=key.split("|"), j=S.jobs.get(jid), v=(j&&j.visits||[]).find(x=>x.id===vid);
  const F=S.form&&S.form.partial||{reason:""};
  const b=`<form class="form" id="partialForm" data-key="${esc(key)}"><fieldset><legend>Why couldn't you finish?</legend>
    <div class="chips" style="flex-wrap:wrap">${REASONS.map(r=>`<button type="button" class="chip" data-act="partial-reason" data-v="${esc(r)}" aria-pressed="${F.reason===r}">${esc(r)}</button>`).join("")}</div>
    <div class="f"><label for="pt-left">What's left to do</label><textarea id="pt-left" placeholder="e.g. Right garage gable and the 2 porch columns. Need 2 more C9 strands.">${esc(F.left||"")}</textarea></div>
    <div class="f"><label for="pt-why">Anything else? (optional)</label><input id="pt-why" value="${esc(F.why||"")}" placeholder="e.g. lightning at 3:40, called it"></div></fieldset>
    ${S.me.owner?`<fieldset><legend>Return visit</legend><div class="two"><div class="f"><label for="pt-date">Date</label><input id="pt-date" type="date"><small>Leave blank to schedule later.</small></div>
      <div class="f"><label for="pt-time">Time (optional)</label><input id="pt-time" type="time"></div></div></fieldset>`:`<p class="count">The office gets this right away and schedules the return visit.</p>`}
    <div class="actions"><span class="count" id="pt-err" style="color:var(--red)"></span><button type="submit" class="btn amber">Save</button></div></form>`;
  return drawerShell(VTYPE[(v||{}).type||"install"]+" · partly done", clientOf(j||{}).name||"Job", b);
}
async function savePartial(form){
  const [jid,vid]=form.dataset.key.split("|"), F=S.form.partial, left=$("#pt-left").value.trim();
  if(!F.reason){ $("#pt-err").textContent="Pick a reason."; return; }
  if(!left){ $("#pt-err").textContent="Say what's left to do."; return; }
  const now=new Date().toISOString();
  try{
    await S.db.collection("log").add({kind:"partial",jobId:jid,visitId:vid,by:S.me.id,at:now,reason:F.reason,left,why:$("#pt-why").value.trim()});
    const oc=myOpenClock(); if(oc&&oc.jobId===jid&&oc.visitId===vid) await clockOut(oc.id,false,true);
    if(S.me.owner){ const d=$("#pt-date")?$("#pt-date").value:""; await addReturn(jid,vid,d,$("#pt-time")?$("#pt-time").value:"",left,true); }
    toast(S.me.owner?"Saved. Return visit added.":"Saved. The office will schedule the return."); S.form=null; closeDrawer();
  }catch(e){ fail(e,"save that"); }
}
async function addReturn(jid,vid,date,time,left,quiet){
  const j=S.jobs.get(jid), visits=(j.visits||[]).map(x=>({...x})), v=visits.find(x=>x.id===vid); if(!v) return;
  if(visits.some(x=>x.returnOf===vid)) return;
  const p=isPartial(jid,vid);
  visits.push({id:uid(),type:v.type,date:date||"",time:time||"",crew:v.crew||"",crews:v.crews||[],trucks:v.trucks||[],trailers:v.trailers||[],note:"Finish: "+(left||(p&&p.left)||"see last visit"),returnOf:vid,order:null});
  await S.db.doc("jobs/"+jid).update({visits,updatedAt:new Date().toISOString()});
  if(!quiet) toast(date?"Return visit scheduled":"Return visit added. Set its date.");
}
function partialEntry(e){
  return `<div class="entry partial-e"><div class="meta"><span><b>${esc(who(e.by))}</b> marked it partly done · ${esc(e.reason)}</span><span>${esc(ago(e.at))}</span></div>
    <div class="txt"><b>Left to do:</b> ${esc(e.left)}${e.why?`<br>${esc(e.why)}`:""}</div></div>`;
}
function returnBlock(){
  const L=needsReturn(); if(!L.length||!S.me.owner) return "";
  return `<h2 class="h-sec">Partly done, needs a return visit · ${L.length}</h2><div class="rows">${L.map(({j,v,p})=>`<div class="row" style="cursor:default"><span class="bulb dim"></span>
    <span class="m"><span class="n">${esc(clientOf(j).name||"Customer")}</span><span class="s">${esc(p.reason)} · ${esc(p.left)}</span></span>
    <span class="r"><button type="button" class="btn small amber" data-act="add-return" data-v="${esc(j.id)}|${esc(v.id)}">Schedule return</button></span></div>`).join("")}</div>`;
}

/* ---------- charges to bill TCL ---------- */
const EXTRA_PRESETS=["C9 bulbs, warm white","C9 bulbs, cool white","C9 bulbs, multicolor","C9 bulbs, red","Mini light strands","Net lights","Lit garland","Lit wreath","Gutter clips","Shingle tabs","Zip ties","Extension cord","Outdoor timer","Spritzer cone","Labor (hours)"];
const extrasOf = f => (f&&f.extras)||[];
const extraTotal = f => extrasOf(f).reduce((t,x)=>t+(x.price!=null&&x.price!==""?Number(x.qty||0)*Number(x.price):0),0);
const extraNeed = f => extrasOf(f).filter(x=>x.price==null||x.price==="").length;
function extrasHTML(j,f){
  const X=extrasOf(f), canW=S.me.money&&S.me.owner;
  return `<div class="extras"><div class="bar"><b class="eyebrow grow">Extra charges to bill TCL</b><span class="mono">${money2(extraTotal(f))}</span></div>
    ${X.length?`<div class="rows">${X.map(x=>{ const priced=x.price!=null&&x.price!=="";
      return `<div class="row" style="cursor:default"><span class="mono" style="font-weight:600">${esc(x.qty)}×</span><span class="m"><span class="n">${esc(x.desc)}</span><span class="s">${priced?`${money2(x.price)} each`:"Needs a price"}${x.note?" · "+esc(x.note):""}</span></span>
      <span class="r">${priced?`<span class="mono">${money2(Number(x.qty)*Number(x.price))}</span>`:(canW?`<span style="display:flex;gap:6px"><input class="search" style="width:96px;min-height:34px" id="xp-${esc(x.id)}" inputmode="decimal" placeholder="$ each"><button type="button" class="btn small amber" data-act="x-price" data-v="${esc(j.id)}|${esc(x.id)}">Add</button></span>`:`<span class="st lit">No price</span>`)}
      ${canW?`<button type="button" class="btn small" data-act="x-del" data-v="${esc(j.id)}|${esc(x.id)}" aria-label="Remove">×</button>`:""}</span></div>`; }).join("")}</div>`:`<p class="count" style="font-size:13px">Use this when you supply your own product or extra labor on a TCL job.</p>`}
    ${canW?`<div class="xadd"><input class="search" id="x-qty" inputmode="decimal" placeholder="Qty" style="width:72px"><input class="search" id="x-desc" list="x-presets" placeholder="e.g. C9 bulbs, warm white" style="flex:1 1 180px;min-width:0"><input class="search" id="x-price" inputmode="decimal" placeholder="$ each (optional)" style="width:130px"><button type="button" class="btn amber small" data-act="x-add" data-v="${esc(j.id)}">Add charge</button>
      <datalist id="x-presets">${EXTRA_PRESETS.map(p=>`<option value="${esc(p)}">`).join("")}</datalist></div>`:""}</div>`;
}
async function saveExtras(jid,list){
  const f=S.fin.get(jid)||{};
  try{ await S.db.doc("fin/"+jid).set({...f,extras:list}); }catch(e){ fail(e,"save the charge"); }
}

/* ---------- chat ---------- */
S.msgs = S.msgs || new Map(); S.chat = S.chat || {ch:null, draft:{}};
const dmId = (a,b) => "dm:"+[a,b].sort().join(":");
function myChannels(){
  const me=PL.me()||{}, wide=me.all_crews||me.can_edit||me.can_manage;
  const list=[{id:"ann",name:"Announcements",kind:"ann"}];
  for(const c of crews()) if(wide||me.crew===c.id) list.push({id:"crew:"+c.id,name:c.name,kind:"crew"});
  for(const p of PL.staff()) if(p.active&&p.id!==me.id) list.push({id:dmId(me.id,p.id),name:p.name,kind:"dm",who:p.id});
  return list;
}
const chanMsgs = ch => [...S.msgs.values()].filter(m=>m.channel===ch).sort((a,b)=>a.at.localeCompare(b.at));
const lastRead = ch => ls("read:"+S.me.id+":"+ch) || "";
const unreadIn = ch => chanMsgs(ch).filter(m=>m.by!==S.me.id && m.at>lastRead(ch)).length;
function unreadTotal(){ return myChannels().reduce((t,c)=>t+unreadIn(c.id),0); }
const canPost = ch => ch!=="ann" || S.me.owner || S.me.manage;
function vChat(){
  const chans=myChannels(), cur=S.chat.ch&&chans.find(c=>c.id===S.chat.ch)?S.chat.ch:null;
  const last=ch=>{ const m=chanMsgs(ch); return m[m.length-1]; };
  const groups=[["ann","Announcements"],["crew","Crew channels"],["dm","Direct messages"]];
  const listHTML=`<div class="chat-list">${groups.map(([k,l])=>{ let cs=chans.filter(c=>c.kind===k); if(k==="dm") cs.sort((a,b)=>String((last(b.id)||{}).at||"").localeCompare(String((last(a.id)||{}).at||""))||a.name.localeCompare(b.name));
    return `<span class="eyebrow">${l}</span>${cs.map(c=>{ const m=last(c.id), u=unreadIn(c.id); return `<button type="button" class="chat-ch ${cur===c.id?"on":""}" data-act="chat-open" data-v="${esc(c.id)}"><span class="m"><b>${esc(c.name)}</b><small>${m?esc((m.by===S.me.id?"You: ":"")+m.body.slice(0,60)):k==="dm"?"Send a message":"No messages yet"}</small></span>${u?`<i class="badge">${u}</i>`:""}</button>`; }).join("")}`; }).join("")}</div>`;
  let thread="";
  if(cur){
    const c=chans.find(x=>x.id===cur), M=chanMsgs(cur); let day="";
    thread=`<div class="chat-thread"><div class="chat-head"><button type="button" class="btn small chat-back" data-act="chat-open" data-v="">‹</button><b>${esc(c.name)}</b>${c.kind==="ann"?`<span class="count">Only the office posts here</span>`:c.kind==="crew"?`<span class="count">${esc(membersOf(cur.slice(5)).join(", ")||"Crew + office")}</span>`:`<span class="count">Private</span>`}</div>
      <div class="chat-msgs" id="chat-msgs">${M.map(m=>{ const d=isoOf(m.at), sep=d!==day?`<div class="chat-day">${esc(rel(d)||fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))}</div>`:""; day=d; const mine=m.by===S.me.id;
        return `${sep}<div class="bub ${mine?"me":""}">${mine?"":`<b>${esc(who(m.by))}</b>`}<div class="txt">${esc(m.body)}</div><small>${new Date(m.at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}${(mine||S.me.manage)?` · <button type="button" class="linkbtn" data-act="chat-del" data-id="${esc(m.id)}">Delete</button>`:""}</small></div>`; }).join("")||`<p class="count" style="text-align:center;margin:24px 0">No messages yet.</p>`}</div>
      ${canPost(cur)?`<form class="chat-compose" id="chatForm"><textarea id="chat-text" rows="1" placeholder="${c.kind==="ann"?"Post an announcement to everyone":"Message "+esc(c.name)}">${esc(S.chat.draft[cur]||"")}</textarea><button type="submit" class="btn amber">Send</button></form>`:`<div class="note" style="margin:0">Only the office can post announcements.</div>`}</div>`;
    const M2=chanMsgs(cur); if(M2.length) ls("read:"+S.me.id+":"+cur, M2[M2.length-1].at);
  }
  if(S.chatOff) return `<h1 class="h-view">Chat</h1><div class="note">Chat isn't switched on yet. ${S.me.manage?"Run update 3 in Supabase (SQL Editor), then reload.":"Ask the office to switch it on."}</div>`;
  return `<div class="bar"><h1 class="h-view grow">Chat</h1></div><div class="chat ${cur?"open":""}">${listHTML}${thread||`<div class="chat-thread empty-t"><p class="lede">Pick a channel or a person.</p></div>`}</div>`;
}
function annBanner(){
  const M=chanMsgs("ann"), m=M[M.length-1]; if(!m||m.by===S.me.id||m.at<=lastRead("ann")) return "";
  return `<div class="ann"><div><span class="eyebrow">Announcement · ${esc(who(m.by))}</span><div>${esc(m.body)}</div></div><button type="button" class="btn small" data-act="ann-seen">Got it</button></div>`;
}
window.addEventListener("prolight:msg",e=>{
  const p=e.detail; if(p.eventType==="DELETE"){ S.msgs.delete(p.old.id); } else { S.msgs.set(p.new.id,p.new); }
  if(S.view==="chat"){ const t=$("#chat-text"); if(t) S.chat.draft[S.chat.ch]=t.value; renderMain(); scrollChat(); } else renderNav();
  if(S.view==="route") renderMain();
});
function scrollChat(){ const el=$("#chat-msgs"); if(el) el.scrollTop=el.scrollHeight; const t=$("#chat-text"); if(t&&document.activeElement!==t&&window.innerWidth>=960) t.focus(); }
async function sendChat(){
  const t=$("#chat-text"), body=t.value.trim(), ch=S.chat.ch; if(!body||!ch) return;
  t.value=""; S.chat.draft[ch]="";
  try{ await PL.chatSend(ch,body); }catch(e){ t.value=body; toast(/security|policy/i.test(e.message)?"You can't post here.":"Couldn't send. Check your signal."); }
}

/* ---------- glue ---------- */
function setOrd(j,t,crew,val){ if(crew==="all"||crewOf(j,t)===crew) t.order=val; else t.orders={...(t.orders||{}),[crew]:val}; }
function visitMore(j,v){
  const p=isPartial(j.id,v.id), dn=isDone(j.id,v.id), t=visitTrucks(v), out=[], btns=[];
  if(t.length) out.push(`<small>Trucks: ${esc(t.join(", "))}</small>`);
  if(v.returnOf) out.push(`<small><b>Return visit</b> to finish what was left</small>`);
  if(p) out.push(`<small class="pt-line"><b>Partly done</b> · ${esc(p.reason)} · ${esc(who(p.by))}, ${esc(ago(p.at))}<br>Left: ${esc(p.left)}${p.why?` · ${esc(p.why)}`:""}${(S.me.owner||p.by===S.me.id)&&!hasReturn(j,v.id)?` · <button type="button" class="linkbtn" data-act="undone" data-id="${esc(p.id)}">Undo</button>`:""}</small>`);
  if(S.me.owner) btns.push(`<button type="button" class="btn small" data-act="crewtruck" data-v="${esc(j.id)}|${esc(v.id)}">Crews & trucks</button>`);
  if(!dn&&!p&&S.me.canLog&&v.date) btns.push(`<button type="button" class="btn small" data-act="partial" data-v="${esc(j.id)}|${esc(v.id)}">Partly done</button>`);
  if(p&&!dn&&S.me.owner&&!hasReturn(j,v.id)) btns.push(`<button type="button" class="btn small amber" data-act="add-return" data-v="${esc(j.id)}|${esc(v.id)}">Schedule return visit</button>`);
  return out.join("")+(btns.length?`<div class="bar" style="margin-top:6px">${btns.join("")}</div>`:"");
}
function dReturn(key){
  const [jid,vid]=key.split("|"), j=S.jobs.get(jid), p=isPartial(jid,vid);
  const b=`<form class="form" id="returnForm" data-key="${esc(key)}">${p?`<div class="note" style="margin:0"><b>Left to do:</b> ${esc(p.left)}</div>`:""}
    <fieldset><legend>Return visit</legend><div class="two"><div class="f"><label for="rt-date">Date</label><input id="rt-date" type="date" value="${esc(addDays(todayISO(),1))}"></div>
    <div class="f"><label for="rt-time">Time (optional)</label><input id="rt-time" type="time"></div></div>
    <p class="count" style="font-size:13px">Same crews and trucks as the first visit. Change them after with Crews & trucks.</p></fieldset>
    <div class="actions"><span></span><button type="submit" class="btn amber">Add return visit</button></div></form>`;
  return drawerShell("Partly done", (clientOf(j||{}).name||"Job")+" · return visit", b);
}
function extraNeedNote(){
  const L=jobsArr().filter(j=>j.stage!=="cancelled"&&extraNeed(S.fin.get(j.id)));
  if(!L.length) return "";
  return `<div class="note">${L.length} job${L.length>1?"s have":" has"} extra charges with no price yet, so ${L.length>1?"they aren't":"it isn't"} billed to TCL: ${L.map(j=>`<button type="button" class="linkbtn" data-act="job" data-id="${esc(j.id)}">${esc(clientOf(j).name||"Customer")}</button>`).join(", ")}</div>`;
}
async function loadChat(){
  if(!window.PL||!PL.chatLoad) { S.chatOff=true; return; }
  try{ const rows=await PL.chatLoad(); S.msgs=new Map(rows.map(r=>[r.id,r])); S.chatOff=false; }
  catch(e){ S.chatOff=true; }
  if(S.view==="chat"||S.view==="route") { renderMain(); if(S.view==="chat") scrollChat(); } else renderNav();
}
window.addEventListener("prolight:chatreload", ()=>loadChat());
document.addEventListener("input", e=>{ if(e.target.id==="chat-text"){ S.chat.draft[S.chat.ch]=e.target.value; e.target.style.height="auto"; e.target.style.height=Math.min(160,e.target.scrollHeight)+"px"; } });
document.addEventListener("keydown", e=>{ if(e.target.id==="chat-text"&&e.key==="Enter"&&!e.shiftKey&&window.innerWidth>=960){ e.preventDefault(); sendChat(); } });
function readPartialForm(){ if(!S.form||!S.form.partial) return; const l=$("#pt-left"), w=$("#pt-why"); if(l) S.form.partial.left=l.value; if(w) S.form.partial.why=w.value; }

/* fill in map pins for jobs that came in without coordinates (imports) */
let pinRun=false;
async function fillPins(){
  if(pinRun||!S.me.owner||!window.PL||!PL.geocode) return; pinRun=true;
  const todo=jobsArr().filter(j=>j.stage!=="cancelled"&&typeof j.lat!=="number"&&addrOf(j)).slice(0,80);
  for(const j of todo){ const a=addrOf(j);
    try{ const r=await PL.geocode(a); if(r) await S.db.doc("jobs/"+j.id).update({lat:+(+r.lat).toFixed(5),lng:+(+r.lng).toFixed(5),geo:r.source,geoAddr:a}); }catch(e){}
    await new Promise(r=>setTimeout(r,1200)); }
}

/* ---------- Jobber sync ---------- */
S.jb = S.jb || { st:null, busy:false };
async function jobberStatus(){ try{ S.jb.st=await PL.jobber("status"); }catch(e){ S.jb.st={error:e.message}; } if(S.view==="office") renderMain(); return S.jb.st; }
function jobberCard(){
  const st=S.jb.st;
  if(!st){ jobberStatus(); return `<fieldset><legend>Jobber</legend><p class="count">Checking the Jobber connection…</p></fieldset>`; }
  if(st.error) return `<fieldset><legend>Jobber</legend><div class="note" style="margin:0">${esc(st.error)}</div></fieldset>`;
  const L=st.last, when=L?ago(L.at):"";
  const sum=L?[`${L.added} new`, L.updated?`${L.updated} filled in`:"", L.photos?`${L.photos} photo${L.photos>1?"s":""}`:"", `${L.prowash} ProWash and ${L.tcl} TCL skipped`].filter(Boolean).join(" · "):"";
  return `<fieldset><legend>Jobber</legend>
    ${st.connected?`<p style="margin:0">Connected. New ProLight jobs from Jobber land here on their own: every night, and whenever you open the board.</p>
      ${L?`<p class="count" style="margin:6px 0 0">Last sync ${esc(when)}: ${esc(sum)}${L.photosLeft?` · ${L.photosLeft} jobs' photos still coming`:""}${L.photoError?`<br><b>Photos:</b> ${esc(L.photoError)}`:""}${L.names&&L.names.length?`<br>Added: ${esc(L.names.join(", "))}`:""}</p>`:""}
      ${st.lastError?`<div class="note" style="margin:8px 0 0">Last try failed: ${esc(st.lastError)}</div>`:""}
      <div class="bar" style="margin-top:10px"><button type="button" class="btn amber" data-act="jb-sync" ${S.jb.busy?"disabled":""}>${S.jb.busy?"Syncing…":"Sync now"}</button><button type="button" class="btn" data-act="jb-connect">Reconnect</button></div>
      <details style="margin-top:10px"><summary class="count">Photos not showing? Check one job</summary><div class="bar" style="margin-top:6px"><input class="search" id="jb-probe" placeholder="Jobber job # (e.g. 752)" style="width:180px"><button type="button" class="btn small" data-act="jb-probe">Check</button></div>${S.jb.probe?`<pre style="white-space:pre-wrap;font-size:11px;max-height:260px;overflow:auto">${esc(S.jb.probe)}</pre>`:""}</details>`
    :`<p style="margin:0">Connect Jobber once and new ProLight jobs (name, address, scope, notes, mockup photos, price) come over on their own. ProWash and TCL jobs are never touched.</p>
      <div class="bar" style="margin-top:10px"><button type="button" class="btn amber" data-act="jb-connect">Connect Jobber</button></div>`}
  </fieldset>`;
}
async function jobberSync(quiet){
  if(S.jb.busy) return; S.jb.busy=true; if(!quiet) renderMain();
  try{ const r=await PL.jobber(quiet?"sync&quick=1":"sync"); ls("jbLast",String(Date.now())); if(!quiet||r.added) toast(r.added?`${r.added} new job${r.added>1?"s":""} from Jobber`:"Up to date with Jobber"); }
  catch(e){ if(!quiet) toast(e.message.slice(0,120)); }
  S.jb.busy=false; S.jb.st=null; if(S.view==="office") renderMain();
}
function jobberAuto(){
  if(!S.me.manage||!window.PL||!PL.jobber) return;
  const q=new URLSearchParams(location.search).get("jobber");
  if(q){ history.replaceState(null,"",location.pathname); toast(q==="connected"?"Jobber connected. Pulling your ProLight jobs…":"Jobber connected, but the first sync hit a problem. See Office → Settings."); S.view="office"; S.office="settings"; renderMain(); return; }
  if(Date.now()-Number(ls("jbLast")||0) < 20*60e3) return;
  PL.jobber("status").then(st=>{ S.jb.st=st; if(st.connected) jobberSync(true); }).catch(()=>{});
}
async function jobberProbe(){
  const n=($("#jb-probe")||{}).value||""; S.jb.probe="Checking…"; renderMain();
  try{ const r=await PL.jobber("probe&job="+encodeURIComponent(n.trim())); S.jb.probe=JSON.stringify(r,null,1).slice(0,3000); }catch(e){ S.jb.probe=e.message; }
  renderMain();
}
