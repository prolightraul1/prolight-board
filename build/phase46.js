/* ---------- Custom pay split on one job (money people) ---------- */
const parseShare = s => { s=String(s||"").trim(); if(!s) return 0; let m=s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/); if(m) return +m[1]/+m[2]; m=s.match(/^(\d+(?:\.\d+)?)\s*%$/); if(m) return +m[1]/100; const n=+s; return isFinite(n)?(n>1?n/100:n):0; };
const shareText = f => { if(!f) return ""; for(const d of [2,3,4,6,8,9,12]){ const n=Math.round(f*d); if(Math.abs(n/d-f)<1e-6) return `${n}/${d}`; } return Math.round(f*1000)/10+"%"; };
function customPayBlock(j){
  if(!S.me.money) return "";
  const f=S.fin.get(j.id)||{}, cs=(f.custom&&f.custom.shares)||{}, on=Object.keys(cs).length>0, open=S.form&&S.form.cpay===j.id;
  const price=+f.price||0, day=installedOn(j)||todayISO();
  const ppl=PL.staff().filter(p=>p.active).filter(p=>{ const pl=planFor(p.id,day); return pl.jobPct>0||pl.mgmtPct>0||cs[p.id]!=null; });
  const payOf=(p,sh)=>{ const pl=planFor(p.id,day); return pl.mgmtPct>0 ? price*(pl.mgmtPct+(selfTotal(pl)-pl.mgmtPct)*sh)/100 : price*pl.jobPct*sh/100; };
  const tot=Object.values(cs).reduce((t,v)=>t+(+v||0),0);
  if(!open) return `<div class="cpay"><div class="bar"><b>${on?"Custom pay split":"Pay split"}</b><span class="count">${on?Object.entries(cs).map(([id,v])=>`${esc(staffName(id).split(" ")[0])} ${shareText(+v)}`).join(" · "):"automatic (by crew and techs on the job)"}</span><button type="button" class="linkbtn" data-act="cpay-open" data-id="${esc(j.id)}">${on?"Edit":"Set a custom split"}</button></div></div>`;
  return `<div class="cpay"><b>Custom pay split</b><p class="count" style="margin:2px 0 8px">How much of this job's work each person did: 1/3, 5/9, 25%. Their pay plan applies to their part only. Anyone left blank gets no job % on this job (hourly still counts). Management fees aren't affected.</p>
    ${ppl.map(p=>{ const pl=planFor(p.id,day), sh=+cs[p.id]||0; return `<div class="cp-row"><span>${esc(p.name)}<small>${esc(planText(pl))}</small></span><input class="search" data-cpay="${esc(p.id)}" value="${esc(shareText(sh))}" placeholder="—" style="width:72px;min-height:36px;text-align:right"><b class="mono">${sh?money2(payOf(p,sh)):"–"}</b></div>`; }).join("")}
    <p class="count">${tot?`Work assigned: ${shareText(tot)}${tot<0.999?` · ${shareText(1-tot)} not assigned to anyone on a % plan`:tot>1.001?" · more than the whole job!":""}`:""}</p>
    <div class="bar"><button type="button" class="btn amber small" data-act="cpay-save" data-id="${esc(j.id)}">Save split</button>${on?`<button type="button" class="btn small" data-act="cpay-clear" data-id="${esc(j.id)}">Back to automatic</button>`:""}<button type="button" class="btn small" data-act="cpay-close">Cancel</button></div></div>`;
}
async function customPaySave(jid, clear){
  const f=S.fin.get(jid)||{}, shares={};
  if(!clear) document.querySelectorAll("[data-cpay]").forEach(el=>{ const v=parseShare(el.value); if(v>0) shares[el.dataset.cpay]=Math.round(v*1e6)/1e6; });
  try{ await S.db.doc("fin/"+jid).set({...f, custom: Object.keys(shares).length?{shares,at:new Date().toISOString(),by:S.me.id}:null}); S.form.cpay=null; toast(clear||!Object.keys(shares).length?"Back to the automatic split":"Custom split saved"); renderDrawer(); }catch(e){ fail(e,"save the split"); }
}
