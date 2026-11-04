/* ---------- Plan a day: route suggestions per crew that hit $3–4k per tech (owners) ---------- */
const PLAN = { day:"", skip:new Set(), pick:{}, seed:0 };
const planLS = (k,d) => { try{ const v=JSON.parse(localStorage.getItem("plan-"+k)); return v==null?d:v; }catch(e){ return d; } };
const planSet = (k,v) => { try{ localStorage.setItem("plan-"+k, JSON.stringify(v)); }catch(e){} };
const planTarget = () => planLS("target",{min:3000,max:4000});
const planPrice = j => +((S.fin.get(j.id)||{}).price)||0;
function planTechs(c){
  const o=planLS("techs",{}); if(o[c.id]) return o[c.id];
  const n=PL.staff().filter(p=>p.active&&normCrew(p.crew)===c.id&&p.partner!=="shipshape").length;
  return Math.max(1,Math.min(n||(c.co==="shipshape"?3:1),8));
}
const planCrewOn = c => planLS("crews",{})[c.id]!==false;
function planPool(){
  const out=[];
  for(const j of jobsArr()){
    if(j.stage==="cancelled"||j.stage==="quoted"||["lit","down"].includes(status(j))||!hasLL(j)||PLAN.skip.has(j.id)) continue;
    const v=(j.visits||[]).find(x=>x.type==="install"&&!x.returnOf&&!x.date&&!isDone(j.id,x.id)); if(!v) continue;
    const p=planPrice(j); if(p<=0) continue;
    const w=String(j.tclWhen||""), pr=j.priority||"";
    const urg=(/this week|asap|urgent/i.test(w)?3:/next week/i.test(w)?1.5:0)+(pr==="HIGH"?2:pr==="MED"?0.7:0);
    out.push({j,v,p,urg});
  }
  return out;
}
function planOrder(stops){ // nearest neighbour from the shop, then 2-opt
  const S0=shop(); let rest=stops.slice(), cur=S0, r=[];
  while(rest.length){ let bi=0,bd=1e9; rest.forEach((s,i)=>{ const d=legMiles(cur,s.j); if(d<bd){bd=d;bi=i;} }); cur=rest[bi].j; r.push(rest.splice(bi,1)[0]); }
  const len=a=>{ let t=0,p=S0; for(const s of a){ t+=legMiles(p,s.j); p=s.j; } return t+legMiles(p,S0); };
  for(let k=0,imp=true;imp&&k<20;k++){ imp=false; for(let i=0;i<r.length-1;i++) for(let m=i+1;m<r.length;m++){ const a=[...r.slice(0,i),...r.slice(i,m+1).reverse(),...r.slice(m+1)]; if(len(a)+0.01<len(r)){ r=a; imp=true; } } }
  return {stops:r, miles:len(r)};
}
function planOptions(c, pool, have){
  const n=planTechs(c), T=planTarget(), min=T.min*n, max=T.max*n, goal=(min+max)/2;
  const haveRev=have.reduce((t,s)=>t+planPrice(s.j)*dayShare(s.j,s.v),0), need=goal-haveRev;
  if(need<=min*0.15) return {n,min,max,haveRev,opts:[],full:true};
  const S0=shop(), from=have.length&&hasLL(have[have.length-1].j)?have[have.length-1].j:S0;
  // seeds: the most urgent jobs, the closest to the shop / last stop, and a spread across town
  const byUrg=[...pool].sort((a,b)=>b.urg-a.urg||b.p-a.p).slice(0,10), byNear=[...pool].sort((a,b)=>legMiles(from,a.j)-legMiles(from,b.j)).slice(0,10);
  const spread=[...pool].sort((a,b)=>((a.j.lat*997+a.j.lng*991+PLAN.seed)%1)-((b.j.lat*997+b.j.lng*991+PLAN.seed)%1)).slice(0,12);
  const seeds=[...new Map([...byUrg,...byNear,...spread].map(x=>[x.j.id,x])).values()];
  const cands=[];
  for(const sd of seeds){
    let route=[sd], tot=sd.p;
    if(tot<need*0.95){
      const used=new Set([sd.j.id]);
      while(tot<need*0.95){
        const last=route[route.length-1].j; let best=null,bs=1e9;
        for(const x of pool){ if(used.has(x.j.id)||haveRev+tot+x.p>max*1.08) continue;
          const d=Math.min(...route.map(r=>legMiles(r.j,x.j))), sc=d-x.urg*1.2-(x.p/(need||1))*2; if(sc<bs){bs=sc;best=x;} }
        if(!best||Math.min(...route.map(r=>legMiles(r.j,best.j)))>14) break;
        route.push(best); used.add(best.j.id); tot+=best.p;
      }
    }
    if(haveRev+tot<min*0.85&&route.length<2) continue;
    const o=planOrder(route), drive=Math.round(o.miles/MPH*60), rev=haveRev+tot;
    const big=sd.p>max*1.15&&route.length===1;
    const score=Math.abs(rev-goal)/goal*60+drive*0.5-route.reduce((t,x)=>t+x.urg,0)*3+(rev<min?25:0)+(rev>max?15:0)-(big?10:0);
    cands.push({stops:o.stops,drive,miles:o.miles,rev,tot,score,big,days:big?Math.ceil(sd.p/goal):1});
  }
  cands.sort((a,b)=>a.score-b.score);
  const opts=[]; for(const cd of cands){ const ids=new Set(cd.stops.map(s=>s.j.id));
    if(opts.some(o=>{ const s=o.stops.filter(x=>ids.has(x.j.id)).length; return s/Math.max(ids.size,o.stops.length)>=0.5; })) continue;
    opts.push(cd); if(opts.length===3) break; }
  return {n,min,max,haveRev,opts};
}
function planAll(){
  const day=PLAN.day, pool=planPool(), taken=new Set(), res=[];
  for(const c of crews().filter(planCrewOn)){
    const have=stopsFor(day,c.id).filter(s=>s.v.type==="install");
    const r=planOptions(c, pool.filter(x=>!taken.has(x.j.id)), have);
    const pick=PLAN.pick[c.id]||0; const ch=r.opts[pick]||r.opts[0]; if(ch) ch.stops.forEach(s=>taken.add(s.j.id));
    res.push({c,have,...r});
  }
  // flag jobs that show up for more than one crew
  const seen=new Map(); res.forEach(r=>r.opts.forEach(o=>o.stops.forEach(s=>{ if(!seen.has(s.j.id)) seen.set(s.j.id,new Set()); seen.get(s.j.id).add(r.c.id); })));
  return {res,seen,pool:pool.length};
}
function vPlan(){
  if(!PLAN.day) PLAN.day=addDays(todayISO(),1);
  const d=PLAN.day, T=planTarget();
  let h=`<div class="bar"><div class="grow"><span class="eyebrow">Route suggestions · you pick</span><h1 class="h-view">Plan ${esc(rel(d)||fmtDay(d,{weekday:"long",month:"short",day:"numeric"}))}</h1></div>
    <span class="wk-nav"><button type="button" class="btn icon" data-act="plan-day" data-v="-1" aria-label="Previous day">‹</button><button type="button" class="btn icon" data-act="plan-day" data-v="1" aria-label="Next day">›</button></span></div>`;
  if(!S.ready) return h+skel(4);
  if(!S.me.owner) return h+`<p class="count">Only owners can plan routes.</p>`;
  const {res,seen,pool}=planAll();
  h+=`<div class="plan-top"><span>Goal <b>${money0(T.min)}–${money0(T.max)}</b> per tech per day</span><span class="count">${pool} unscheduled job${pool===1?"":"s"} with a price and a pin</span>
    <button type="button" class="linkbtn" data-act="plan-shuffle">Different suggestions</button>${PLAN.skip.size?`<button type="button" class="linkbtn" data-act="plan-unskip">Bring back ${PLAN.skip.size} skipped</button>`:""}</div>
    <div class="chips plan-crews">${crews().map(c=>`<button type="button" class="chip" data-act="plan-crew" data-v="${esc(c.id)}" aria-pressed="${planCrewOn(c)}">${esc(c.name)}</button>`).join("")}</div>`;
  for(const r of res){
    const c=r.c;
    h+=`<section class="dcard plan-crew"><header><span class="dot" style="background:${crewColor(c.id)||"var(--ink-2)"}"></span><b>${esc(c.name)}</b>
      <span class="plan-techs"><button type="button" class="btn icon small" data-act="plan-techs" data-id="${esc(c.id)}" data-v="-1" aria-label="Fewer techs">−</button><span>${r.n} tech${r.n===1?"":"s"}</span><button type="button" class="btn icon small" data-act="plan-techs" data-id="${esc(c.id)}" data-v="1" aria-label="More techs">+</button></span>
      <span class="count">target ${money0(r.min)}–${money0(r.max)}</span></header>
      ${r.have.length?`<p class="count" style="margin:0">Already on ${esc(fmtDay(d,{weekday:"short"}))}: ${r.have.length} stop${r.have.length===1?"":"s"} · ${money0(r.haveRev)}</p>`:""}
      ${r.full?`<p class="count" style="margin:0">This crew's day is already full.</p>`:!r.opts.length?`<p class="count" style="margin:0">No good route left for this crew. Try another day, more techs, or bring back skipped jobs.</p>`:
      r.opts.map((o,i)=>{ const per=o.rev/r.n, ok=o.rev>=r.min&&o.rev<=r.max*1.08;
        return `<div class="plan-opt ${(PLAN.pick[c.id]||0)===i?"on":""}"><div class="po-head"><b>Option ${i+1}</b><span class="po-rev ${ok?"ok":"off"}">${money0(o.rev)}</span><span class="count">${money0(per)}/tech · ${o.stops.length} stop${o.stops.length===1?"":"s"} · ${o.drive} min driving${o.big?` · big job, about ${o.days} days`:""}</span></div>
          <ol class="po-stops">${o.stops.map(s=>{ const also=[...(seen.get(s.j.id)||[])].filter(x=>x!==c.id);
            return `<li><button type="button" class="po-name" data-act="job" data-id="${esc(s.j.id)}">${esc(clientOf(s.j).name||"Job")}</button><span class="count">${money0(s.p)}${s.j.source==="tcl"?" · TCL":""}${s.j.tclWhen?" · "+esc(s.j.tclWhen):""}${s.j.priority==="HIGH"?` · <b style="color:var(--amber)">high</b>`:""}${also.length?` · also in ${esc(also.map(teamName).join(", "))}`:""}</span><button type="button" class="po-x" data-act="plan-skip" data-id="${esc(s.j.id)}" title="Leave this job out of suggestions" aria-label="Leave out">×</button></li>`; }).join("")}</ol>
          <div class="bar"><button type="button" class="btn amber small" data-act="plan-use" data-id="${esc(c.id)}" data-v="${i}">Schedule this for ${esc(c.name)}</button>${(PLAN.pick[c.id]||0)!==i?`<button type="button" class="btn small" data-act="plan-pick" data-id="${esc(c.id)}" data-v="${i}">Hold for this crew</button>`:""}</div></div>`; }).join("")}
    </section>`;
  }
  return h+`<p class="count">Routes start and end at the shop. Driving time is a straight-line estimate at ${MPH} mph. Nothing is scheduled until you tap Schedule, and you can still drag stops around on Week afterward.</p>`;
}
async function planUse(cid, i){
  const r=planAll().res.find(x=>x.c.id===cid), o=r&&r.opts[+i]; if(!o) return;
  const day=PLAN.day, start=r.have.length, before=new Map(), now=new Date().toISOString();
  try{
    for(const [k,s] of o.stops.entries()){
      const j0=S.jobs.get(s.j.id); before.set(s.j.id,(j0.visits||[]).map(x=>({...x})));
      const vs=(j0.visits||[]).map(x=>({...x})), v=vs.find(x=>x.id===s.v.id); if(!v) continue;
      v.date=day; v.crew=cid; v.order=start+k+1; v.unscheduledAt=undefined;
      await S.db.doc("jobs/"+s.j.id).update({visits:vs,updatedAt:now});
    }
    PLAN.undo={before,label:`${o.stops.length} stops for ${teamName(cid)}`};
    toast(`Scheduled ${o.stops.length} stop${o.stops.length===1?"":"s"} for ${teamName(cid)} on ${fmtDay(day,{weekday:"short",month:"short",day:"numeric"})}`);
    renderMain(); const t=$("#toast"); if(t&&PLAN.undo){ t.insertAdjacentHTML("beforeend",` <button type="button" class="linkbtn" data-act="plan-undo">Undo</button>`); clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,9000); }
  }catch(e){ fail(e,"schedule that route"); }
}
async function planUndo(){
  const u=PLAN.undo; if(!u) return; PLAN.undo=null; const now=new Date().toISOString();
  try{ for(const [id,vs] of u.before) await S.db.doc("jobs/"+id).update({visits:vs,updatedAt:now}); toast("Undone: "+u.label); renderMain(); }catch(e){ fail(e,"undo that"); }
}
