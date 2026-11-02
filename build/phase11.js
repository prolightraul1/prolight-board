
/* ---------- manager home (Today), office groups, week drag-and-drop, route map ---------- */
const isMgr = () => !!(S.me.manage||S.me.owner);
const wide = () => matchMedia("(min-width:960px)").matches;
ICON.today='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>';
function homeView(){ if(S._home||!S.ready||!isMgr()) return; S._home=1; if(wide()&&S.view==="route") S.view="today"; }
matchMedia("(min-width:960px)").addEventListener("change",()=>{ if(S.view==="today"&&!wide()) S.view="route"; renderMain(); });
function openClocksNow(){ const out=[], t=todayISO(); for(const [id,e] of S.log) if(e.kind==="clock"&&!e.pending&&e.in&&!e.out&&isoOf(e.in)===t) out.push({id,...e}); return out.sort((a,b)=>staffName(a.by).localeCompare(staffName(b.by))); }
function vToday(){
  const d=todayISO();
  let h=annBanner()+(S.ready?seasonBar():"")+`<div class="bar"><div class="grow"><span class="eyebrow">${esc(fmtDay(d,{weekday:"long",month:"long",day:"numeric"}))}</span><h1 class="h-view">Today</h1></div>
    ${S.me.owner?`<button type="button" class="btn" data-act="view" data-v="week">Schedule the week</button><button type="button" class="btn amber" data-act="new-job">+ New job</button>`:""}</div>`;
  if(!S.ready) return h+skel(6);
  const cs=crews().map(c=>{ const st=stopsFor(d,c.id), dn=st.filter(s=>isDone(s.j.id,s.v.id)).length, nx=st.find(s=>!isDone(s.j.id,s.v.id)); return {c,st,dn,nx}; });
  const on=openClocksNow(), all=jobsArr().filter(j=>j.stage!=="cancelled");
  const noCrew=all.filter(j=>!j.crew&&status(j)!=="down").length;
  const noDate=all.filter(j=>["lead","quoted","booked"].includes(status(j))&&j.stage==="booked").length;
  const noDown=all.filter(j=>status(j)==="lit"&&!(j.visits||[]).some(v=>v.type==="takedown"&&v.date)).length;
  const rq=reqCount(), sv=svcCount(), pl=(n,a,b)=>n===1?a:b;
  const items=[[rq,pl(rq,"time fix to approve","time fixes to approve"),"today-go","people"],[sv,pl(sv,"service call to schedule","service calls to schedule"),"view","week"],
    [noCrew,pl(noCrew,"job with no crew","jobs with no crew"),"today-jf","unassigned"],[noDate,pl(noDate,"booked job with no install date","booked jobs with no install date"),"today-jf","unsched"],
    [noDown,pl(noDown,"lit job with no takedown date","lit jobs with no takedown date"),"today-jf","unsched"]].filter(x=>x[0]);
  h+=`<div class="dgrid">
    <section class="dcard dc-crews"><header><span class="eyebrow">Crews today</span><button type="button" class="linkbtn" data-act="go-day" data-v="${d}">Open route</button></header>
      ${cs.length?cs.map(({c,st,dn,nx})=>`<button type="button" class="dcrew" data-act="today-crew" data-v="${esc(c.id)}"><span class="dot" style="background:${crewColor(c.id)||"var(--ink-2)"}"></span><span class="m"><b>${esc(c.name)}</b><small>${st.length?(nx?`Next: ${esc(clientOf(nx.j).name||"Customer")}`:"All done for today"):"No stops"}</small></span><span class="r"><span class="mono">${dn}/${st.length}</span><span class="track"><span style="width:${st.length?dn/st.length*100:0}%"></span></span></span></button>`).join(""):`<p class="count">No crews set up yet.</p>`}
    </section>
    <section class="dcard"><header><span class="eyebrow">Needs attention</span></header>${items.length?`<div class="dlist">${items.map(([n,l,a,v])=>`<button type="button" class="ditem" data-act="${a}" data-v="${v}"><b class="mono">${n}</b><span>${l}</span><span class="go" aria-hidden="true">›</span></button>`).join("")}</div>`:`<p class="count">All caught up.</p>`}</section>
    <section class="dcard"><header><span class="eyebrow">On the clock now · ${on.length}</span></header>${on.length?`<div class="dlist">${on.map(e=>`<div class="ditem static">${avatar(e.by,"sm")}<span><b>${esc(staffName(e.by))}</b></span><span class="count">${e.general?(e.where==="shop"?"At the shop":"Driving"):esc(clientOf(S.jobs.get(e.jobId)||{}).name||"On a job")} · since ${tfmt(e.in)}</span></div>`).join("")}</div>`:`<p class="count">Nobody is clocked in right now.</p>`}</section>`;
  if(S.me.money){ const T=moneyTotals(), sw=S.week; S.week=monday(d); const W=payWeek(); S.week=sw;
    const comm=allSales().filter(s=>s.earnedOn&&!s.paidAt).reduce((t,s)=>t+s.comm,0);
    h+=`<section class="dcard"><header><span class="eyebrow">Money</span><button type="button" class="linkbtn" data-act="today-go" data-v="money">Office</button></header><div class="dmoney">
      <div><small>TCL owes ProLight</small><b>${money2(T.tcl.due)}</b></div><div><small>ProLight owes ShipShape</small><b>${money2(T.ss.due)}</b></div>
      <div><small>Payroll this week so far</small><b>${money2(W.people.reduce((t,p)=>t+p.total,0))}</b></div><div><small>Commission owed</small><b>${money2(comm)}</b></div></div></section>`; }
  const days=[...Array(7)].map((_,i)=>addDays(d,i));
  h+=`<section class="dcard dc-wide"><header><span class="eyebrow">Next 7 days</span><button type="button" class="linkbtn" data-act="view" data-v="week">Week view</button></header><div class="d7">${days.map(x=>{ const st=stopsFor(x,"all"), by=crews().map(c=>[c,stopsFor(x,c.id).length]).filter(z=>z[1]);
    return `<button type="button" class="d7d ${x===d?"today":""}" data-act="go-day" data-v="${x}"><span class="eyebrow">${fmtDay(x,{weekday:"short"})}</span><b>${parseISO(x).getDate()}</b><span class="mono">${st.length} stop${st.length===1?"":"s"}</span>${by.map(([c,n])=>`<span class="d7c"><i style="background:${crewColor(c.id)||"var(--ink-2)"}"></i>${esc(c.name)} · ${n}</span>`).join("")}</button>`; }).join("")}</div></section></div>`;
  const st=stopsFor(d,"all");
  if(st.length) h+=`<h2 class="h-sec">Today's stops · ${st.length}</h2>${jobHead()}<div class="rows">${st.map(s=>jobRow(s.j)).join("")}</div>`;
  return h;
}

/* office: Money · People · Setup */
function officeGroups(){
  const G=[];
  if(S.me.money) G.push(["money","Money",[["money:overview","Overview"],["money:tcl","TCL"],["money:ss","ShipShape"],["money:own","ProLight jobs"],["money:pays","Payments"],["sales","Commission"],["statement","ShipShape view"]]]);
  const ppl=[S.me.owner&&["hours","Hours"],S.me.money&&["payroll","Payroll"],S.me.manage&&["team","Team"]].filter(Boolean); if(ppl.length) G.push(["people","People",ppl]);
  const set=[S.me.owner&&["settings","Settings"],S.me.owner&&["texts","Night texts"]].filter(Boolean); if(set.length) G.push(["setup","Setup",set]);
  if(!S.me.money&&S.me.partner) G.push(["payouts","My payouts",[["statement","My payouts"]]]);
  return G;
}
const okey = () => S.office==="money" ? "money:"+(S.mtab||"overview") : S.office;
function setOffice(k){ if(String(k).startsWith("money:")){ S.office="money"; S.mtab=k.slice(6); } else S.office=k; }
function vOffice(){
  const G=officeGroups();
  if(!G.length) return `<h1 class="h-view">Office</h1><p class="lede">You don't have access to the office tools.</p>`;
  let cur=G.find(g=>g[2].some(([k])=>k===okey()));
  if(!cur){ cur=G[0]; setOffice(cur[2][0][0]); }
  const rc=reqCount();
  let h=`<h1 class="h-view">Office</h1>${G.length>1?`<div class="seg ogroups" role="group" aria-label="Office">${G.map(([k,l])=>`<button type="button" data-act="ogroup" data-v="${k}" aria-pressed="${cur[0]===k}">${l}${k==="people"&&rc?` <i class="cnt">${rc}</i>`:""}</button>`).join("")}</div>`:""}
    ${cur[2].length>1?`<div class="chips" role="group" aria-label="${esc(cur[1])}">${cur[2].map(([k,l])=>`<button type="button" class="chip" data-act="office" data-v="${k}" aria-pressed="${okey()===k}">${l}</button>`).join("")}</div>`:""}`;
  const o=S.office;
  h+=`<div class="obody">`+(o==="money"?vMoney(): o==="texts"?vTexts(): o==="team"?vTeam(): o==="hours"?vHours(): o==="statement"?vStatement(): o==="sales"?vSales(): o==="payroll"?vPayroll(): vSettings())+`</div>`;
  return h;
}

/* week: drag jobs onto days, between days, and into order */
function wkTray(){
  if(!S.me.owner||!wide()) return "";
  const all=jobsArr().filter(j=>j.stage!=="cancelled");
  const inst=all.filter(j=>["lead","quoted","booked"].includes(status(j))&&j.stage==="booked"), down=all.filter(j=>status(j)==="lit"&&!(j.visits||[]).some(v=>v.type==="takedown"&&v.date));
  const T=S.tray||"install", q=(S.q.tray||"").toLowerCase();
  const list=(T==="install"?inst:down).filter(j=>!q||[clientOf(j).name,addrOf(j)].join(" ").toLowerCase().includes(q));
  return `<section class="tray"><div class="bar"><b class="tray-t">Drag onto a day</b><div class="chips"><button type="button" class="chip" data-act="tray" data-v="install" aria-pressed="${T==="install"}">Needs install date · ${inst.length}</button><button type="button" class="chip" data-act="tray" data-v="takedown" aria-pressed="${T==="takedown"}">Needs takedown date · ${down.length}</button></div>
    <span class="grow"></span><input class="search" id="q-tray" type="search" placeholder="Find a customer" value="${esc(S.q.tray||"")}" aria-label="Find a customer" style="max-width:240px"></div>
    <div class="tray-list">${list.map(j=>`<div class="tcard" draggable="true" data-dj="${esc(j.id)}" data-dt="${T}" title="Drag onto a day"><span class="bulb ${BULB[status(j)]}"></span><span class="x"><b>${esc(clientOf(j).name||"Customer")}</b><small>${esc(crewObj(j.crew)?teamName(j.crew):"No crew yet")}${j.tclWhen?" · "+esc(j.tclWhen):""}</small></span></div>`).join("")||`<p class="count">Nothing waiting${q?" for that search":""}.</p>`}</div>
    <p class="count" style="font-size:12.5px;margin:6px 0 0">Drag a stop onto another day to move it. To change the order within a day, pick a crew above, then drop a stop onto the one it should go before.</p></section>`;
}
let DRAG=null;
const clearDrop = () => document.querySelectorAll(".drop-on,.drop-before").forEach(x=>x.classList.remove("drop-on","drop-before"));
document.addEventListener("dragstart",ev=>{ const el=ev.target.closest&&ev.target.closest("[data-dj]"); if(!el||S.view!=="week") return; DRAG={j:el.dataset.dj,v:el.dataset.dv||"",t:el.dataset.dt||""}; ev.dataTransfer.effectAllowed="move"; try{ ev.dataTransfer.setData("text/plain",DRAG.j); }catch(e){} el.classList.add("dragging"); document.body.classList.add("is-dragging"); });
document.addEventListener("dragend",()=>{ DRAG=null; document.body.classList.remove("is-dragging"); clearDrop(); document.querySelectorAll(".dragging").forEach(x=>x.classList.remove("dragging")); });
document.addEventListener("dragover",ev=>{ if(!DRAG) return; const day=ev.target.closest&&ev.target.closest(".wday[data-day]"); if(!day) return; ev.preventDefault(); ev.dataTransfer.dropEffect="move"; clearDrop(); day.classList.add("drop-on"); const b=ev.target.closest(".wstop[data-dj]"); if(b) b.classList.add("drop-before"); });
document.addEventListener("drop",async ev=>{ if(!DRAG) return; const day=ev.target.closest&&ev.target.closest(".wday[data-day]"); if(!day) return; ev.preventDefault(); const b=ev.target.closest(".wstop[data-dj]"), D=DRAG; DRAG=null; clearDrop(); await dropOn(D, day.dataset.day, b?{j:b.dataset.dj,v:b.dataset.dv}:null); });
async function dropOn(D, day, before){
  const j0=S.jobs.get(D.j); if(!j0) return; const j={id:D.j,...j0};
  const visits=(j0.visits||[]).map(x=>({...x})); let v;
  if(D.v) v=visits.find(x=>x.id===D.v);
  else { const type=D.t==="takedown"?"takedown":"install"; v=visits.find(x=>x.type===type&&!x.date&&!isDone(j.id,x.id)); if(!v){ v={id:uid(),type,date:"",time:"",crew:"",note:"",order:null}; visits.push(v); } }
  if(S.team==="all") before=null;
  if(!v||(before&&before.j===D.j&&before.v===v.id)||(!before&&v.date===day&&D.v)) return;
  v.date=day;
  const crew=S.team!=="all"&&visitCrews(j,v).includes(S.team)?S.team:crewOf(j,v), changes=new Map([[j.id,visits]]);
  if(crewObj(crew)){
    const list=stopsFor(day,crew).filter(s=>!(s.j.id===j.id&&s.v.id===v.id));
    let idx=before?list.findIndex(s=>s.j.id===before.j&&s.v.id===before.v):-1; if(idx<0) idx=list.length;
    [...list.slice(0,idx),{me:true},...list.slice(idx)].forEach((s,i)=>{
      if(s.me){ setOrd(j,v,crew,i+1); return; }
      if(ordOf(s.v,crew)!==i+1){ const base=changes.get(s.j.id)||(S.jobs.get(s.j.id).visits||[]).map(x=>({...x})); const t=base.find(x=>x.id===s.v.id); if(t){ setOrd(s.j,t,crew,i+1); changes.set(s.j.id,base); } } });
  } else v.order=null;
  try{ const now=new Date().toISOString(); for(const [id,vs] of changes) await S.db.doc("jobs/"+id).update({visits:vs,updatedAt:now});
    toast(`${clientOf(j).name||"Job"}: ${VTYPE[v.type].toLowerCase()} ${fmtDay(day,{weekday:"short",month:"short",day:"numeric"})}${crewObj(crew)?"":" · no crew yet"}`); }
  catch(e){ fail(e,"reschedule that"); }
}

/* route on the computer: stops on the left, map on the right */
let RMAP=null, RLAYER=null, RHOLD=null; const RPINS=new Map();
const routeSide = () => `<div class="rmap-box ${effectiveDark()?"night-map":""}"><div id="rmap"></div></div>`;
function mountRouteMap(){
  const box=$("#rmap"); if(!box||!wide()) return;
  if(!window.L){ loadLeaflet().then(()=>{ if(!window.L) throw 0; if(S.view==="route") mountRouteMap(); }).catch(()=>{ box.innerHTML=`<p class="count" style="padding:14px">The map couldn't load. Check your signal.</p>`; }); return; }
  if(!RMAP){ RHOLD=document.createElement("div"); RHOLD.className="lmap"; RMAP=L.map(RHOLD).setView([30.46,-84.27],11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(RMAP); RLAYER=L.layerGroup().addTo(RMAP); }
  box.appendChild(RHOLD);
  requestAnimationFrame(()=>{ RMAP.invalidateSize(); drawRouteMap(); });
}
function drawRouteMap(){
  if(!RMAP) return; RLAYER.clearLayers(); RPINS.clear();
  const d=S.day, SH=shop(), teams=S.team==="all"?crews().map(c=>c.id):[S.team], pts=[[SH.lat,SH.lng]];
  L.circleMarker([SH.lat,SH.lng],{radius:8,weight:3,color:"#fff",fillColor:"#111916",fillOpacity:1}).bindTooltip("Shop",{direction:"right",offset:[10,0],className:"pin-tip"}).addTo(RLAYER);
  for(const t of teams){ const st=stopsFor(d,t).filter(s=>hasLL(s.j)); if(!st.length) continue; const col=crewColor(t)||"#ffb83d";
    L.polyline([[SH.lat,SH.lng],...st.map(s=>[s.j.lat,s.j.lng])],{color:col,weight:3,opacity:.85,dashArray:"6 6",interactive:false}).addTo(RLAYER);
    st.forEach((s,i)=>{ const dn=isDone(s.j.id,s.v.id);
      const m=L.marker([s.j.lat,s.j.lng],{icon:L.divIcon({className:"rpin-wrap",html:`<span class="rpin ${dn?"done":""}" style="--c:${col}">${i+1}</span>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(RLAYER);
      m.bindTooltip(esc(clientOf(s.j).name||"Customer"),{direction:"top",offset:[0,-14],className:"pin-tip"});
      m.on("click",()=>{ const el=document.querySelector(`.stop[data-sj="${CSS.escape(s.j.id)}"]`); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add("hl"); setTimeout(()=>el.classList.remove("hl"),1400); } });
      if(!RPINS.has(s.j.id)) RPINS.set(s.j.id,m); pts.push([s.j.lat,s.j.lng]); }); }
  if(pts.length>1) RMAP.fitBounds(L.latLngBounds(pts).pad(0.15),{maxZoom:15}); else RMAP.setView(pts[0],12);
}
let RHOT=null;
document.addEventListener("mouseover",ev=>{ if(S.view!=="route"||!RMAP) return; const st=ev.target.closest&&ev.target.closest(".stop[data-sj]"), id=st?st.dataset.sj:null; if(id===RHOT) return;
  const o=RHOT&&RPINS.get(RHOT); if(o&&o.getElement()) o.getElement().classList.remove("hot"); RHOT=id;
  const m=id&&RPINS.get(id); if(m&&m.getElement()){ m.getElement().classList.add("hot"); m.openTooltip(); } else if(o) o.closeTooltip(); });
