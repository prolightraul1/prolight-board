
/* ---------- daily team call (everyone except ShipShape) ---------- */
const TEAM_ROOM = "meet:prolight";
const meetCfg = () => ({ on:true, time:"08:00", days:[1,2,3,4,5], ...((S.settings&&S.settings.meeting)||{}) });
const inTeamCall = () => !ssOnly();
function meetWhen(){ const c=meetCfg(); if(!c.on) return LANG_ES?"Apagada":"Off"; const [h,m]=c.time.split(":").map(Number), d=new Date(); d.setHours(h,m,0,0);
  const t=d.toLocaleTimeString(LOC(),{hour:"numeric",minute:"2-digit"}), wk=c.days.length===5&&[1,2,3,4,5].every(x=>c.days.includes(x));
  return (wk?(LANG_ES?"Lunes a viernes":"Weekdays"):c.days.map(x=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][x]).join(", "))+" · "+t; }
function teamCallHead(){
  const c=meetCfg(), mgr=S.me.manage||S.me.owner;
  return `<div class="note team-call" style="margin:0;border-radius:0">📹 <b>${LANG_ES?"Llamada diaria del equipo":"Daily team call"}</b> · ${esc(meetWhen())}<br><small>${LANG_ES?"Todos menos ShipShape. Llega un aviso 10 minutos antes y la llamada suena a la hora.":"Everyone except ShipShape. A reminder goes out 10 minutes before and the call rings at start time."}</small>
    ${mgr?`<div class="bar" style="margin-top:8px"><label class="tog-l"><input type="checkbox" id="meet-on" ${c.on?"checked":""}> ${LANG_ES?"Activa":"On"}</label><input type="time" id="meet-time" class="search" value="${esc(c.time)}" style="width:auto;min-height:36px">
      ${[1,2,3,4,5,6,0].map(d=>`<label class="tog-l"><input type="checkbox" data-meet-day="${d}" ${c.days.includes(d)?"checked":""}> ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]}</label>`).join("")}</div>`:""}</div>`;
}
async function saveMeet(patch){ const m={...meetCfg(),...patch}; try{ await S.db.doc("settings/board").set({...S.settings,meeting:m}); S.settings.meeting=m; toast(LANG_ES?"Guardado":"Saved"); }catch(e){ fail(e,"save the call schedule"); } }
function clearBadges(){ try{ if(navigator.clearAppBadge) navigator.clearAppBadge(); }catch(e){} try{ if(PUSH.reg&&PUSH.reg.getNotifications) PUSH.reg.getNotifications().then(ns=>ns.forEach(n=>n.close())); }catch(e){} }
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) clearBadges(); });
window.addEventListener("focus",clearBadges);
setTimeout(clearBadges,1500);
