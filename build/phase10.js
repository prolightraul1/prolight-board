
/* ---------- polish: job rows, keyboard shortcuts ---------- */
function jobRow(j){
  const c=clientOf(j), st=status(j), nv=nextVisit(j);
  const team=crewObj(j.crew)&&crews().filter(x=>x.co===coOf(j.crew)).length>1?teamName(j.crew):(crewObj(j.crew)?teamName(j.crew):"Unassigned");
  const when=nv?`${VTYPE[nv.type]} ${fmtDay(nv.date)}`:(j.tclWhen&&!["lit","down"].includes(st)?j.tclWhen:"");
  const tag=`<span class="lbl ${j.source==="tcl"?"tcl":"pl"}">${esc(label(j))}</span>`;
  return `<button type="button" class="row jrow" data-act="job" data-id="${esc(j.id)}">
    <span class="bulb ${BULB[st]}"></span>
    <span class="m"><span class="n">${esc(c.name||"Customer")}</span><span class="s">${tag}<span class="a">${esc(addrOf(j)||"No address")}</span></span></span>
    <span class="c-tag">${tag}</span><span class="c-crew">${esc(team)}</span>
    <span class="r"><span class="pill ${st}">${STATUS[st]}</span>${when?`<span class="when">${esc(when)}</span>`:""}</span>
  </button>`;
}
const jobHead = () => `<div class="jhead" aria-hidden="true"><span>Customer</span><span>Whose job</span><span>Crew</span><span>Status · next</span></div>`;
const skel = (n=4) => `<div class="skel" aria-label="Loading">${"<i></i>".repeat(n)}</div>`;
document.addEventListener("keydown", ev=>{
  const t=ev.target, typing=t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if(typing||ev.metaKey||ev.ctrlKey||ev.altKey) return;
  if(ev.key==="/"){ const s=document.querySelector("#view input.search, #view input[type=search]"); if(s){ ev.preventDefault(); s.focus(); } }
  else if((ev.key==="n"||ev.key==="N")&&S.me&&S.me.owner&&!S.drawer){ ev.preventDefault(); startJobForm(null,""); }
});
