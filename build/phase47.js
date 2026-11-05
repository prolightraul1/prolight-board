/* ---------- Who can drive; Plan a day plans drop-offs, moves and pickups for crews without a driver ---------- */
/* settings/board.noDrive = staff ids who can't drive. Everyone else can. */
const TRUCK_SVG=`<svg class="truck-ic" viewBox="0 0 24 14" width="22" height="13" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M1 10V6.6c0-.6.4-1.1 1-1.1h9.2V2.6c0-.6.5-1.1 1.1-1.1h3.6c.4 0 .7.2.9.5l2.3 3.5h2.6c1 0 1.8.8 1.8 1.8V10c0 .6-.4 1-1 1h-.7a2.6 2.6 0 0 0-5.2 0H8.4a2.6 2.6 0 0 0-5.2 0H2c-.6 0-1-.4-1-1zM12.8 3.1v2.4h4.6l-1.5-2.4z"/><circle cx="5.7" cy="11.2" r="1.9"/><circle cx="18.7" cy="11.2" r="1.9"/></svg>`;
const noDrive = () => new Set(S.settings.noDrive||[]);
const canDrive = p => !!p && !noDrive().has(p.id);
const crewPeople = c => PL.staff().filter(p=>p.active&&normCrew(p.crew)===c.id&&p.partner!=="shipshape");
const firstName = p => String(p.name||"").split(" ")[0];
/* a crew needs a ride when everyone on it is someone who can't drive (crews with nobody on the board are assumed fine) */
const crewNeedsRide = c => { const P=crewPeople(c); return P.length>0 && !P.some(canDrive); };
const riderNames = c => { const n=crewPeople(c).filter(p=>!canDrive(p)).map(firstName); return n.length<=2?n.join(" & "):n.slice(0,-1).join(", ")+" & "+n[n.length-1]; };
function crewRoster(c){
  const P=crewPeople(c); if(!P.length) return "";
  return `<span class="roster">${P.map(p=>`<span class="rp${canDrive(p)?"":" nd"}" title="${canDrive(p)?"Can drive":"Can't drive"}">${canDrive(p)?TRUCK_SVG:""}${esc(firstName(p))}</span>`).join("")}</span>`;
}

const WALK_MI = 0.3;           // straight-line miles that count as "walk over"
const MOVE_MAX_MI = 4;         // a driver will move a rider to a second site at most this far (road miles)
const pathLen = pts => { let t=0; for(let i=1;i<pts.length;i++) t+=legMiles(pts[i-1],pts[i]); return t; };
/* driver's day as points: shop → its stops → shop. Drop at the first site, move between sites at the cheapest gap, pick up at the last site. */
function rideCost(dStops, sites){
  const S0=shop(), base=[S0,...dStops,S0], baseLen=pathLen(base);
  const first=sites[0][0], last=sites[sites.length-1].slice(-1)[0];
  let pts=[S0,first,...dStops,last,S0];
  for(let k=0;k+1<sites.length;k++){
    const a=sites[k].slice(-1)[0], b=sites[k+1][0]; let best=null, bl=1e9;
    for(let g=1; g<pts.length-1; g++){ const t=[...pts.slice(0,g+1),a,b,...pts.slice(g+1)]; const l=pathLen(t); if(l<bl){bl=l;best=t;} }
    if(best) pts=best;
  }
  const extra=Math.max(0,pathLen(pts)-baseLen);
  return { miles:extra, min:Math.round(extra/MPH*60) };
}
function walkCluster(seed, pool, used, room){
  const site=[seed]; let tot=seed.p;
  for(;;){
    let best=null, bd=1e9;
    for(const x of pool){ if(used.has(x.j.id)||site.includes(x)||tot+x.p>room) continue;
      const d=Math.min(...site.map(s=>miles(s.j,x.j))); if(d<=WALK_MI&&d<bd){bd=d;best=x;} }
    if(!best) break; site.push(best); tot+=best.p;
  }
  // order the site by walking from the seed
  const out=[site.shift()]; while(site.length){ let bi=0,bd=1e9; site.forEach((s,i)=>{ const d=miles(out[out.length-1].j,s.j); if(d<bd){bd=d;bi=i;} }); out.push(site.splice(bi,1)[0]); }
  return out;
}
/* route options for a crew with no driver: one big job, or jobs within walking distance of each other; one move to a second site only when the first can't fill the day */
function rideOptions(c, pool, have, drivers){
  const n=planTechs(c), T=planTarget(), min=T.min*n, max=T.max*n, goal=(min+max)/2;
  const haveRev=have.reduce((t,s)=>t+planPrice(s.j)*dayShare(s.j,s.v),0), need=goal-haveRev;
  const base={n,min,max,haveRev,ride:true};
  if(!drivers.length) return {...base,opts:[],noDriver:true};
  if(need<=min*0.15&&have.length){ const r=bestRide([have.map(s=>s.j)],drivers); return {...base,opts:[],full:true,fullRide:r}; }
  const room=max*1.08-haveRev, seeds=have.length?[]:pool, cands=[];
  const build=(site1, used)=>{
    const sites=[site1]; let tot=site1.reduce((t,x)=>t+x.p,0);
    if(haveRev+tot<need*0.85+haveRev){ // try one move to a second site
      const last=site1[site1.length-1].j; let best=null,bs=1e9;
      for(const x of pool){ if(used.has(x.j.id)||site1.includes(x)||tot+x.p>room) continue; const d=legMiles(last,x.j); if(d>MOVE_MAX_MI) continue; const sc=d-x.urg*0.8-(x.p/(need||1))*3; if(sc<bs){bs=sc;best=x;} }
      if(best){ const u2=new Set([...used,...site1.map(s=>s.j.id)]); const s2=walkCluster(best,pool,u2,room-tot); sites.push(s2); tot+=s2.reduce((t,x)=>t+x.p,0); }
    }
    return {sites,tot};
  };
  if(have.length){
    // already has work that day: only add jobs they can walk to from it
    const used=new Set(have.map(s=>s.j.id)), extra=[]; let tot=0;
    for(const x of [...pool].sort((a,b)=>Math.min(...have.map(s=>miles(s.j,a.j)))-Math.min(...have.map(s=>miles(s.j,b.j))))){
      if(tot+x.p>room) continue; if(Math.min(...have.map(s=>miles(s.j,x.j)),...extra.map(s=>miles(s.j,x.j)))<=WALK_MI){ extra.push(x); tot+=x.p; } }
    if(!extra.length) return {...base,opts:[],stuck:true,fullRide:bestRide([have.map(s=>s.j)],drivers)};
    const sites=[[...have.map(s=>s.j),...extra.map(x=>x.j)]], r=bestRide(sites,drivers), rev=haveRev+tot;
    return {...base,opts:[{stops:extra,sites:[[...have,...extra]],rev,tot,drive:r.min,miles:r.miles,ride:r,moves:0,big:false,days:1}]};
  }
  for(const sd of seeds){
    const used=new Set(), site1=walkCluster(sd,pool,used,room), {sites,tot}=build(site1,used);
    const rev=haveRev+tot, r=bestRide(sites.map(s=>s.map(x=>x.j)),drivers);
    const big=sites.length===1&&site1.length===1&&sd.p>max*1.15, moves=sites.length-1;
    if(rev<min*0.5&&!big) continue;
    if(r.min>60) continue; // too far out of the driver's way
    const urg=sites.flat().reduce((t,x)=>t+x.urg,0);
    const score=Math.abs(Math.min(rev,max)-goal)/goal*60+r.min*0.6+moves*18-urg*3+(rev<min?25:0)+(rev>max*1.08?15:0)-(big?10:0);
    cands.push({stops:sites.flat(),sites,rev,tot,drive:r.min,miles:r.miles,ride:r,moves,big,days:big?Math.ceil(sd.p/goal):1,score});
  }
  cands.sort((a,b)=>a.score-b.score);
  const opts=[]; for(const cd of cands){ const ids=new Set(cd.stops.map(s=>s.j.id));
    if(opts.some(o=>o.stops.some(x=>ids.has(x.j.id)))) continue;
    opts.push(cd); if(opts.length===3) break; }
  return {...base,opts};
}
/* drivers: [{c, stops:[job…]}] — pick the one whose day bends least to drop off, move and pick up */
function bestRide(sites, drivers){
  let best=null;
  for(const d of drivers){ const k=rideCost(d.stops,sites); if(!best||k.miles<best.miles) best={...k,by:d.c.id}; }
  return best||{miles:0,min:0,by:""};
}

planAll = function(){
  const day=PLAN.day, pool=planPool(), taken=new Set(), res=[], on=crews().filter(planCrewOn);
  const drv=on.filter(c=>!crewNeedsRide(c)), rid=on.filter(crewNeedsRide), driverDays=[];
  for(const c of drv){
    const have=stopsFor(day,c.id).filter(s=>s.v.type==="install");
    const r=planOptions(c, pool.filter(x=>!taken.has(x.j.id)), have);
    const pick=PLAN.pick[c.id]||0; const ch=r.opts[pick]||r.opts[0]; if(ch) ch.stops.forEach(s=>taken.add(s.j.id));
    res.push({c,have,...r});
    // the driver's day as it would run if you take the held option (in drive order)
    const ord=bestOrder([...stopsFor(day,c.id),...(ch?ch.stops.map(s=>({j:s.j,v:s.v})):[])].filter(s=>hasLL(s.j)));
    driverDays.push({c,stops:(ord.stops||ord).map(s=>s.j||s)});
  }
  for(const c of rid){
    const have=stopsFor(day,c.id).filter(s=>s.v.type==="install");
    const r=rideOptions(c, pool.filter(x=>!taken.has(x.j.id)), have, driverDays);
    const pick=PLAN.pick[c.id]||0; const ch=r.opts[pick]||r.opts[0]; if(ch) ch.stops.forEach(s=>taken.add(s.j.id));
    res.push({c,have,...r});
  }
  // which riders each driver is carrying (for the held option)
  for(const r of res.filter(x=>x.ride)){
    const ch=r.opts[PLAN.pick[r.c.id]||0]||r.opts[0], ride=ch?ch.ride:r.fullRide; if(!ride||!ride.by) continue;
    const d=res.find(x=>x.c.id===ride.by); if(!d) continue;
    (d.carries=d.carries||[]).push({c:r.c, min:ride.min, sites:ch?ch.sites.map(s=>s.map(x=>x.j||x)):[r.have.map(s=>s.j)]});
  }
  res.sort((a,b)=>crews().indexOf(a.c)-crews().indexOf(b.c));
  const seen=new Map(); res.forEach(r=>r.opts.forEach(o=>o.stops.forEach(s=>{ if(!seen.has(s.j.id)) seen.set(s.j.id,new Set()); seen.get(s.j.id).add(r.c.id); })));
  return {res,seen,pool:pool.length};
};
function rideSteps(who, sites){
  const nm=j=>esc(clientOf(j).name||"the job");
  const out=[`Drop off ${esc(who)} at <b>${nm(sites[0][0])}</b> to start the day`];
  for(let k=0;k+1<sites.length;k++) out.push(`Move ${esc(who)} from ${nm(sites[k][sites[k].length-1])} to <b>${nm(sites[k+1][0])}</b> when that job is done`);
  out.push(`Pick up ${esc(who)} at <b>${nm(sites[sites.length-1].slice(-1)[0])}</b> at the end`);
  return out;
}
/* card extras: roster with trucks, ride plan on rider crews, carry list on driver crews */
function planCrewExtras(r){
  const c=r.c; let h="";
  if(r.ride){
    const who=riderNames(c);
    if(r.noDriver) h+=`<div class="ride-note warn"><b>No driver.</b> ${esc(who)} can't drive and no crew with a driver is on this day. Turn on a crew with a driver, or put a driver on ${esc(c.name)}.</div>`;
    else{
      const ch=r.opts[PLAN.pick[c.id]||0]||r.opts[0], ride=ch?ch.ride:r.fullRide;
      h+=`<div class="ride-note"><b>${esc(who)} can't drive.</b> Suggestions keep ${esc(who)} on one big job or jobs close enough to walk between.${ride&&ride.by?` <b>${esc(teamName(ride.by))}</b> does the driving (+${ride.min} min for them).`:""}${r.stuck?` Nothing new is within walking distance of what's already on this day.`:""}</div>`;
    }
  }
  if(r.carries&&r.carries.length) h+=r.carries.map(k=>`<div class="ride-note carry">${TRUCK_SVG}<span><b>Also driving ${esc(riderNames(k.c))}</b> (${esc(k.c.name)}) · +${k.min} min<ol>${rideSteps(riderNames(k.c),k.sites).map(s=>`<li>${s}</li>`).join("")}</ol></span></div>`).join("");
  return h;
}

/* split a crew's stops (in order) into sites you can walk between */
function walkSites(js){ const out=[]; for(const j of js){ const cur=out[out.length-1]; if(cur&&hasLL(j)&&hasLL(cur[cur.length-1])&&miles(cur[cur.length-1],j)<=WALK_MI) cur.push(j); else out.push([j]); } return out; }
/* who drives whom on a scheduled day: the choice saved from Plan a day, otherwise the crew whose day bends least */
function dayRides(d){
  const work=crews().filter(c=>stopsFor(d,c.id).length), out=[];
  const drivers=work.filter(c=>!crewNeedsRide(c)).map(c=>({c,stops:stopsFor(d,c.id).map(s=>s.j).filter(hasLL)}));
  for(const c of work.filter(crewNeedsRide)){
    const sites=walkSites(stopsFor(d,c.id).map(s=>s.j)), saved=(((S.dayCfg.get(d)||{}).rides)||{})[c.id];
    let by=saved&&crews().some(x=>x.id===saved)?saved:"", min=0;
    const geo=sites.every(s=>s.every(hasLL));
    if(geo){ const pick=by?drivers.filter(x=>x.c.id===by):drivers; const r=pick.length?bestRide(sites,pick):(by?{...rideCost([],sites),by}:null); if(r){ by=r.by; min=r.min; } }
    out.push({c,by,min,sites});
  }
  return out;
}
const _truckLine0 = truckLine;
truckLine = function(d,c){ return _truckLine0(d,c)+rideLine(d,c); };
const _truckAll0 = truckAllLines;
truckAllLines = function(d){ return _truckAll0(d)+dayRides(d).map(r=>rideBox(r,true)).join(""); };
function rideBox(r, forDriver){
  const who=riderNames(r.c);
  if(!r.by) return `<div class="ride-note warn"><b>${esc(who)} (${esc(r.c.name)}) needs a ride</b> and no crew with a driver is working this day.</div>`;
  if(!forDriver) return `<div class="ride-note">${TRUCK_SVG}<span><b>${esc(teamName(r.by))}</b> drops ${esc(who)} off and picks ${esc(who)} up.<ol>${rideSteps(who,r.sites).map(s=>`<li>${s}</li>`).join("")}</ol></span></div>`;
  return `<div class="ride-note carry">${TRUCK_SVG}<span><b>${esc(teamName(r.by))}: also driving ${esc(who)}</b> (${esc(r.c.name)})${r.min?` · about +${r.min} min`:""}<ol>${rideSteps(who,r.sites).map(s=>`<li>${s}</li>`).join("")}</ol></span></div>`;
}
function rideLine(d,c){
  const R=dayRides(d); if(!R.length) return "";
  return R.filter(r=>r.by===c).map(r=>rideBox(r,true)).join("")+R.filter(r=>r.c.id===c).map(r=>rideBox(r,false)).join("");
}
/* scheduling a rider crew from Plan a day remembers who drives them that day */
const _planUse0 = planUse;
planUse = async function(cid, i){
  const r=planAll().res.find(x=>x.c.id===cid), o=r&&r.opts[+i], by=r&&r.ride&&o&&o.ride?o.ride.by:"";
  await _planUse0(cid,i);
  if(by){ const d=PLAN.day, cur=S.dayCfg.get(d)||{}; try{ await S.db.doc("settings/day-"+d).set({...cur,rides:{...(cur.rides||{}),[cid]:by}}); toast(`Scheduled for ${teamName(cid)}. ${teamName(by)} drops ${riderNames(crewObj(cid)||{id:cid})} off and picks them up.`); }catch(e){} }
};
/* Team list + person form */
async function saveCanDrive(pid, yes){
  const set=noDrive(); if(yes===!set.has(pid)) return;
  if(yes) set.delete(pid); else set.add(pid);
  await S.db.doc("settings/board").set({...S.settings,noDrive:[...set]});
}
