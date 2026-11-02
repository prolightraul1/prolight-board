/* ---------- crews: delete (moving their jobs) and reorder ---------- */
function crewUses(id){ let n=0; for(const j of jobsArr()){ if(j.crew===id||(j.visits||[]).some(v=>normCrew(v.crew)===id||(v.crews||[]).includes(id))) n++; } return n; }
function crewCtl(c,ci,C){
  const up=ci>0?`<button type="button" class="btn small" data-act="crew-move" data-v="${esc(c.id)}|-1" aria-label="Move ${esc(c.name)} up">↑</button>`:"";
  const dn=ci<C.length-1?`<button type="button" class="btn small" data-act="crew-move" data-v="${esc(c.id)}|1" aria-label="Move ${esc(c.name)} down">↓</button>`:"";
  let h=`<span class="crew-ctl">${up}${dn}${C.length>1?`<button type="button" class="btn small danger" data-act="rm-crew" data-v="${esc(c.id)}">Delete crew</button>`:""}</span>`;
  if(S.crewDel===c.id){
    const n=crewUses(c.id), people=PL.staff().filter(p=>normCrew(p.crew)===c.id&&p.active).map(p=>p.name);
    h+=`<div class="note crew-del" style="grid-column:1/-1;margin-top:8px"><b>Delete ${esc(c.name)}?</b>
      ${n?`<div style="margin:6px 0">${n} job${n>1?"s are":" is"} on this crew. Move ${n>1?"them":"it"} to <select id="crew-moveto"><option value="">No crew (unassigned)</option>${C.filter(x=>x.id!==c.id).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select></div>`:`<div style="margin:6px 0">No jobs are on this crew.</div>`}
      ${people.length?`<div class="count" style="margin-bottom:6px">${esc(people.join(", "))} ${people.length>1?"are":"is"} on this crew. Pick a new crew for ${people.length>1?"them":"them"} in Office → People after.</div>`:""}
      <div class="bar"><button type="button" class="btn small danger" data-act="rm-crew-yes" data-v="${esc(c.id)}">Delete crew</button><button type="button" class="btn small" data-act="rm-crew-no">Cancel</button></div></div>`;
  }
  return h;
}
async function moveCrew(id,dir){ const C=collectCrews(), i=C.findIndex(c=>c.id===id), k=i+dir; if(i<0||k<0||k>=C.length) return; [C[i],C[k]]=[C[k],C[i]]; await writeCrews(C,"Crew order saved"); }
async function deleteCrew(id){
  const to=(document.getElementById("crew-moveto")||{}).value||"", C=collectCrews().filter(c=>c.id!==id), name=(crewsAll().find(c=>c.id===id)||{}).name||"Crew";
  try{
    let moved=0;
    for(const j of jobsArr()){
      const hit=j.crew===id||(j.visits||[]).some(v=>normCrew(v.crew)===id||(v.crews||[]).includes(id)); if(!hit) continue;
      const visits=(j.visits||[]).map(v=>{ const x={...v}; if(normCrew(x.crew)===id) x.crew=to; if(Array.isArray(x.crews)) x.crews=[...new Set(x.crews.map(c=>c===id?to:c).filter(Boolean))]; return x; });
      await S.db.doc("jobs/"+j.id).update({crew:j.crew===id?to:j.crew,visits,updatedAt:new Date().toISOString()}); moved++;
    }
    S.crewDel=null; await writeCrews(C,`${name} deleted${moved?` · ${moved} job${moved>1?"s":""} moved`:""}`);
  }catch(e){ fail(e,"delete that crew"); }
}
