
/* ---------- ProLight crew view: only their crew, small TCL chip, ProLight people ---------- */
function plOnly(){
  const me=window.PL&&PL.me(); if(!me||me.can_edit||me.can_money||me.can_manage||ssOnly()) return false; return true;
}
const crewView = () => ssOnly()||plOnly();
function applyCrewView(){
  const pl=plOnly(); document.body.classList.toggle("pl-view",pl);
  if(pl){ const ids=crews().map(c=>c.id); if(!ids.includes(S.team)) S.team=ids.length===1?ids[0]:(ids.includes(normCrew((PL.me()||{}).crew))?normCrew(PL.me().crew):"all"); S.ctab="all";
    if(!["day","sched"].includes(MAP.mode)){ MAP.mode="day"; MAP.day=todayISO(); } }
}
