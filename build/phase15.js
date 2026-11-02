
/* ---------- ShipShape crew view: nothing ProLight, ShipShape logo ---------- */
function ssOnly(){
  const me=window.PL&&PL.me(); if(!me||me.can_edit||me.can_money||me.can_manage) return false;
  if(me.partner==="shipshape") return true;
  const c=crewsAll().find(x=>x.id===normCrew(me.crew)); return !!c&&c.co==="shipshape";
}
function applyBrand(){
  const ss=ssOnly(); if(applyBrand.last===ss) return; applyBrand.last=ss;
  document.body.classList.toggle("ss-view",ss);
  document.querySelectorAll(".rail .logo,.topbar .logo").forEach(img=>{ img.src=ss?"/brand/shipshape.png":"/brand/prolight.png"; img.alt=ss?"ShipShape Exteriors":"ProLight Tallahassee"; });
  document.title=ss?"ShipShape · Season Board":"ProLight Season Board";
  if(ss){ const ids=crews().map(c=>c.id); if(!ids.includes(S.team)) S.team=ids.length===1?ids[0]:"all"; S.ctab="all"; }
}
function myChannels(){
  const me=PL.me()||{}, wide=me.all_crews||me.can_edit||me.can_manage, ss=ssOnly();
  const list=[{id:"ann",name:"Announcements",kind:"ann"}];
  for(const c of crews()) if(wide||me.crew===c.id||(ss&&c.co==="shipshape")) list.push({id:"crew:"+c.id,name:c.name,kind:"crew"});
  for(const p of PL.staff()) if(p.active&&p.id!==me.id){
    if(ss){ if(isSS(p.id)||p.partner==="shipshape") list.push({id:dmId(me.id,p.id),name:p.name,kind:"dm",who:p.id}); else if(p.can_manage) list.push({id:dmId(me.id,p.id),name:p.name,kind:"office",who:p.id}); }
    else list.push({id:dmId(me.id,p.id),name:p.name,kind:"dm",who:p.id}); }
  return list;
}
