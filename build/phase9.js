
/* ---------- who sold this job: right in the job form ---------- */
function soldUI(F){
  if(!S.me.money) return "";
  const fin=F.fin||{}, s=fin.sale||{}, rf=fin.referral||{};
  const D=F.sold||(F.sold={by:s.by||"",type:s.type||"inbound",pct:s.pct??"",ref:rf.by||"",refPct:rf.pct??""});
  const price=parseFloat(String(fin.price||"").replace(/[$,]/g,""))||0, base=F.job.source==="tcl"?split(F.job,{...fin,price}).incoming:price;
  const pct=D.type==="custom"?(+D.pct||0):commRate(D.type);
  return `<div class="f" style="margin-top:6px"><label for="m-soldby">Who sold this job?</label><select id="m-soldby"><option value="">Nobody / no commission</option>${sellers().map(p=>`<option value="${esc(p.id)}" ${D.by===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
    ${D.by?`<div class="f"><label>Lead</label><div class="seg" role="group">${LEADS.map(([k,l])=>`<button type="button" data-act="sold-type" data-v="${k}" aria-pressed="${D.type===k}">${l}${k!=="custom"?` · ${commRate(k)}%`:""}</button>`).join("")}</div></div>
      ${D.type==="custom"?`<div class="f"><label for="m-spct">Commission %</label><input id="m-spct" inputmode="decimal" value="${esc(D.pct)}" placeholder="e.g. 12"></div>`:""}
      <p class="count" style="font-size:13px">${base?`Commission ${pct}% of ${money2(base)} = <b>${money2(base*pct/100)}</b>${F.job.source==="tcl"?" (on ProLight's share)":""}`:"Add the price to see the commission."}${s.paidAt?" · already paid out":""}</p>`:""}
    ${S.me.manage?`<div class="two"><div class="f"><label for="m-ref">Referral pay to</label><select id="m-ref"><option value="">No referral</option>${PL.staff().filter(p=>p.active).map(p=>`<option value="${esc(p.id)}" ${D.ref===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="f"><label for="m-rpct">Referral %</label><input id="m-rpct" inputmode="decimal" value="${esc(D.refPct)}" placeholder="e.g. 5"></div></div>
      ${D.ref&&+D.refPct&&base?`<p class="count" style="font-size:13px">Referral ${+D.refPct}% = <b>${money2(base*D.refPct/100)}</b></p>`:""}`:rf.by?`<p class="count" style="font-size:13px">Referral: ${esc(staffName(rf.by))} · ${+rf.pct||0}%</p>`:""}`;
}
function readSold(){ const F=S.form; if(!F||!F.sold) return; const by=$("#m-soldby"), p=$("#m-spct"), r=$("#m-ref"), rp=$("#m-rpct"); if(by) F.sold.by=by.value; if(p) F.sold.pct=p.value; if(r) F.sold.ref=r.value; if(rp) F.sold.refPct=rp.value; }
function soldApply(F, nf, old){
  if(!F.sold) return nf;
  const D=F.sold, o=old.sale||{};
  if(!D.by) delete nf.sale;
  else nf.sale={by:D.by,type:D.type,pct:D.type==="custom"?(+D.pct||0):null,at:o.at||new Date().toISOString(),paidAt:o.paidAt||null};
  if(S.me.manage){ const ro=old.referral||{};
    if(D.ref&&+D.refPct>0) nf.referral={by:D.ref,pct:+D.refPct,at:ro.at||new Date().toISOString(),paidAt:ro.paidAt||null,addedBy:ro.addedBy||S.me.id}; else delete nf.referral; }
  return nf;
}

/* ---------- pull hours from Jobber's timesheets (managers) ---------- */
const jbhKey = e => "jbt-"+String(e.id).replace(/[^A-Za-z0-9]/g,"").slice(-24);
function jbhMatch(e, day){
  let j=null;
  if(e.job){ j=S.jobs.get("jb-"+e.job.number)?{id:"jb-"+e.job.number,...S.jobs.get("jb-"+e.job.number)}:null;
    if(!j){ const nm=String(e.job.title||e.visit||"").split(/[-–]/).pop().trim().toLowerCase();
      if(nm.length>2) j=jobsArr().find(x=>{ const c=String(clientOf(x).name||"").toLowerCase(); return c && (c===nm || c.includes(nm) || nm.includes(c)); })||null; } }
  if(!j) return null;
  const vs=(j.visits||[]).filter(v=>v.date).sort((a,b)=>Math.abs(parseISO(a.date)-parseISO(day))-Math.abs(parseISO(b.date)-parseISO(day)));
  return {j, v:vs[0]||null};
}
function jbhMine(H){
  const P=PL.staff().find(p=>p.id===H.who)||{name:""}, nm=String(P.name||"").trim().toLowerCase(), first=nm.split(/\s+/)[0]||"#";
  return (H.entries||[]).filter(e=>{ const u=String(e.user||"").trim().toLowerCase(); return u===nm || u.split(/\s+/)[0]===first; });
}
function dJbHours(){
  const H=S.jbh, ppl=PL.staff().filter(p=>p.active&&!isSS(p.id)), P=ppl.find(p=>p.id===H.who)||{name:""};
  const mine=jbhMine(H);
  const done=new Set([...S.log.values()].filter(e=>e.kind==="clock"&&e.jobberId).map(e=>e.jobberId));
  const rows=mine.map(e=>{ const day=isoOf(e.start), m=jbhMatch(e,day), have=done.has(e.id), open=!e.end;
    return `<label class="row" style="cursor:${have||open?"default":"pointer"}"><input type="checkbox" data-jbh="${esc(e.id)}" ${have||open?"disabled":H.sel.has(e.id)?"checked":""} style="width:20px;height:20px;margin-right:6px">
      <span class="m"><span class="n">${esc(fmtDay(day,{weekday:"short",month:"short",day:"numeric"}))} · ${tfmt(e.start)} – ${e.end?tfmt(e.end):"still running"}</span>
      <span class="s">${m?"Job: "+esc(clientOf(m.j).name||"Customer"):e.job?"Jobber job #"+esc(e.job.number)+" "+esc(e.job.title)+" (not on the board · counts as shop time)":"General time (shop)"}${e.note?" · "+esc(e.note):""}</span></span>
      <span class="r">${have?`<span class="st down">Added</span>`:open?`<span class="st booked">Running</span>`:`<span class="mono">${fmtDur(new Date(e.end)-new Date(e.start))}</span>`}</span></label>`; }).join("");
  const b=`<div class="form"><div class="two"><div class="f"><label for="jbh-from">From</label><input id="jbh-from" type="date" value="${esc(H.from)}"></div><div class="f"><label for="jbh-to">To</label><input id="jbh-to" type="date" value="${esc(H.to)}"></div></div>
    <div class="f"><label for="jbh-who">Whose hours</label><select id="jbh-who">${ppl.map(p=>`<option value="${esc(p.id)}" ${p.id===H.who?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="actions"><span></span><button type="button" class="btn" data-act="jbh-pull" ${H.loading?"disabled":""}>${H.loading?"Pulling…":"Pull from Jobber"}</button></div></div>
    ${H.error?`<div class="note" style="color:var(--red)">${esc(H.error)}</div>`:""}
    ${H.entries?(mine.length?`<div class="rows" style="margin-top:10px">${rows}</div>
      <div class="actions" style="margin-top:10px"><span class="count">${H.sel.size} picked</span><button type="button" class="btn amber" data-act="jbh-add" ${H.sel.size?"":"disabled"}>Add to ${esc(P.name)}'s time card</button></div>`
      :`<p class="count" style="margin-top:10px">Jobber has no timesheet entries for ${esc(P.name)} in those days${(H.entries||[]).length?` (it has ${(H.entries||[]).length} for other people)`:""}. You can still type the hours in with <b>+ Add time</b>.</p>`):""}`;
  return drawerShell("Hours from Jobber","Timesheets", b);
}
async function jbhPull(){
  const H=S.jbh; H.from=$("#jbh-from").value; H.to=$("#jbh-to").value; H.who=$("#jbh-who").value;
  if(!H.from||!H.to||H.to<H.from){ H.error="Pick the days."; renderDrawer(); return; }
  H.loading=true; H.error=""; renderDrawer();
  try{
    const a=new Date(H.from+"T00:00:00").toISOString(), z=new Date(addDays(H.to,1)+"T00:00:00").toISOString();
    const r=await PL.jobber(`hours&from=${encodeURIComponent(a)}&to=${encodeURIComponent(z)}`);
    H.entries=r.entries||[]; H.error=r.error||"";
    const done=new Set([...S.log.values()].filter(e=>e.kind==="clock"&&e.jobberId).map(e=>e.jobberId));
    H.sel=new Set(jbhMine(H).filter(e=>e.end&&!done.has(e.id)).map(e=>e.id));
  }catch(e){ H.error=e.message; H.entries=null; }
  H.loading=false; renderDrawer();
}
async function jbhAdd(){
  const H=S.jbh, now=new Date().toISOString(); let n=0;
  try{
    for(const e of jbhMine(H).filter(e=>H.sel.has(e.id)&&e.end)){
      const m=jbhMatch(e,isoOf(e.start));
      await S.db.doc("log/"+jbhKey(e)+"-"+H.who.slice(0,6)).set({kind:"clock",general:!m,where:m?"":"shop",jobId:m?m.j.id:"",visitId:m&&m.v?m.v.id:"",by:H.who,in:new Date(e.start).toISOString(),out:new Date(e.end).toISOString(),auto:false,at:now,edited:S.me.id,source:"jobber",jobberId:e.id,...(e.note?{note:e.note}:{})});
      n++;
    }
    toast(`${n} time entr${n===1?"y":"ies"} added from Jobber`); H.sel=new Set(); renderDrawer();
  }catch(x){ fail(x,"add the hours"); }
}
