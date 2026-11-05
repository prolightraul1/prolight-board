/* ---------- Plan a day: a small map on every route suggestion (riders also show their driver's day) ---------- */
const PMAPS=new Map(); let PMAP_DATA=new Map(); const PMAP_MAX=14;
const ll = p => [p.lat,p.lng];
function planMapSlot(r, o, i){
  const c=r.c, col=crewColor(c.id)||"#ffb83d", S0=shop(), d={lines:[],pins:[],legend:[]};
  const mine=[...r.have.map(s=>s.j),...o.stops.map(s=>s.j)].filter(hasLL);
  const pin=(j,n,color,kind)=>d.pins.push({lat:j.lat,lng:j.lng,n,color,kind,name:clientOf(j).name||"Job"});
  if(o.ride&&o.ride.by&&o.ride.pts){
    const dc=crewColor(o.ride.by)||"#3c7de0", ids=new Set(mine.map(j=>j.id));
    d.lines.push({pts:o.ride.pts.filter(hasLL).map(ll),color:dc,dash:"6 6",w:3});
    o.sites.forEach(s=>{ const js=s.map(x=>x.j||x).filter(hasLL); if(js.length>1) d.lines.push({pts:js.map(ll),color:col,dash:"",w:4}); });
    let n=0; for(const p of o.ride.pts){ if(!p.id||!hasLL(p)||ids.has(p.id)) continue; pin(p,"",dc,"drv"); }
    mine.forEach(j=>pin(j,++n,col,"me"));
    d.legend=[[col,`${c.name} (${riderNames(c)})`],[dc,`${teamName(o.ride.by)}'s day with drop-off and pickup`]];
  } else {
    const held=(PLAN.pick[c.id]||0)===i, k=held&&r.carries&&r.carries[0];
    const path=k&&k.pts?k.pts:[S0,...mine,S0];
    d.lines.push({pts:path.filter(hasLL).map(ll),color:col,dash:"6 6",w:3});
    let n=0; r.have.forEach(s=>hasLL(s.j)&&pin(s.j,++n,"#9aa3a0","have")); o.stops.forEach(s=>hasLL(s.j)&&pin(s.j,++n,col,"me"));
    if(k){ const rc=crewColor(k.c.id)||"#ffb83d"; k.sites.flat().filter(hasLL).forEach(j=>pin(j,"",rc,"ride")); d.legend=[[col,c.name],[rc,`Drop off / pick up ${riderNames(k.c)}`]]; }
  }
  const key=c.id+"|"+i, sig=JSON.stringify([d.lines.map(l=>[l.pts,l.color]),d.pins.map(p=>[p.lat,p.lng,p.n,p.color])]);
  PMAP_DATA.set(key,{...d,sig});
  return `<div class="plan-map-wrap"><div class="plan-map ${effectiveDark()?"night-map":""}" data-pm="${esc(key)}"></div>${d.legend.length?`<div class="pm-legend">${d.legend.map(([cl,t])=>`<span><i style="background:${cl}"></i>${esc(t)}</span>`).join("")}</div>`:""}</div>`;
}
function mountPlanMaps(){
  const slots=[...document.querySelectorAll(".plan-map[data-pm]")]; if(!slots.length) return;
  if(!window.L){ loadLeaflet().then(()=>{ if(window.L&&S.view==="plan") mountPlanMaps(); }).catch(()=>slots.forEach(s=>s.innerHTML=`<p class="count" style="padding:10px">The map couldn't load.</p>`)); return; }
  for(const slot of slots){
    const key=slot.dataset.pm, d=PMAP_DATA.get(key); if(!d) continue;
    let m=PMAPS.get(key);
    if(!m){ const hold=document.createElement("div"); hold.className="lmap";
      const map=L.map(hold,{zoomControl:false,scrollWheelZoom:false,attributionControl:false,dragging:!L.Browser.mobile,tap:false}).setView([30.46,-84.27],11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
      m={hold,map,layer:L.layerGroup().addTo(map),sig:""}; PMAPS.set(key,m);
      if(PMAPS.size>PMAP_MAX){ const [k0,o0]=PMAPS.entries().next().value; o0.map.remove(); PMAPS.delete(k0); } }
    slot.appendChild(m.hold);
    if(m.sig!==d.sig){ m.sig=d.sig; drawPlanMap(m,d); }
    requestAnimationFrame(()=>{ m.map.invalidateSize(); if(m.bounds) m.map.fitBounds(m.bounds,{maxZoom:15,animate:false}); });
  }
}
function drawPlanMap(m, d){
  const SH=shop(); m.layer.clearLayers(); const pts=[ll(SH)];
  for(const l of d.lines) if(l.pts.length>1){ L.polyline(l.pts,{color:l.color,weight:l.w,opacity:.9,dashArray:l.dash||null,interactive:false}).addTo(m.layer); pts.push(...l.pts); }
  L.circleMarker(ll(SH),{radius:7,weight:3,color:"#fff",fillColor:"#111916",fillOpacity:1}).bindTooltip("Shop",{direction:"right",offset:[8,0],className:"pin-tip"}).addTo(m.layer);
  for(const p of d.pins){
    const small=p.kind==="drv"||p.kind==="ride";
    const html=small?`<span class="pm-dot" style="--c:${p.color}"></span>`:`<span class="rpin" style="--c:${p.color}">${p.n}</span>`, sz=small?14:26;
    L.marker([p.lat,p.lng],{icon:L.divIcon({className:"rpin-wrap",html,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]}),keyboard:false}).bindTooltip(esc(p.name),{direction:"top",offset:[0,-12],className:"pin-tip"}).addTo(m.layer);
    pts.push([p.lat,p.lng]);
  }
  m.bounds=L.latLngBounds(pts).pad(0.12);
}
