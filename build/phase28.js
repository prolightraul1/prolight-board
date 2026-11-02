/* ---------- each crew's money for a day (money people), and your cut (Raul only) ---------- */
function crewDay(d,cid){
  const st=stopsFor(d,cid).filter(s=>s.v.type==="install"), price=j=>+((S.fin.get(j.id)||{}).price)||0;
  const pl=isRaul()?planFor(S.me.id,d):null;
  let rev=0, done=0, mine=0;
  for(const s of st){ const p=price(s.j)*dayShare(s.j,s.v)/Math.max(1,visitCrews(s.j,s.v).length); rev+=p; if(isDone(s.j.id,s.v.id)) done+=p; if(pl) mine+=p*feePct(pl,{id:s.j.id})/100; }
  return {n:st.length, rev, done, mine};
}
function crewMoneyFoot(d,team){
  if(!S.me.money) return "";
  const cs=(team==="all"?crews():crews().filter(c=>c.id===team)).map(c=>({c,...crewDay(d,c.id)})).filter(x=>x.n);
  if(!cs.length) return "";
  const tot=cs.reduce((t,x)=>t+x.rev,0), me=cs.reduce((t,x)=>t+x.mine,0);
  return `<div class="cmoney"><span class="eyebrow">Crew revenue · ${esc(fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))}</span>
    ${cs.map(x=>`<div class="cm-row"><span class="dot" style="background:${crewColor(x.c.id)||"var(--ink-2)"}"></span><b>${esc(x.c.name)}</b><span class="count">${x.n} install${x.n===1?"":"s"}${x.done?` · ${money0(x.done)} done`:""}</span><span class="cm-v mono">${money0(x.rev)}</span>${isRaul()?`<span class="cm-me mono" title="Your pay from this crew today">you ${money2(x.mine)}</span>`:""}</div>`).join("")}
    ${cs.length>1?`<div class="cm-row cm-tot"><b>All crews</b><span class="count"></span><span class="cm-v mono">${money0(tot)}</span>${isRaul()?`<span class="cm-me mono">you ${money2(me)}</span>`:""}</div>`:""}</div>`;
}
function wkMoney(d){
  if(!S.me.money) return "";
  const cs=(S.team==="all"?crews():crews().filter(c=>c.id===S.team)).map(c=>({c,...crewDay(d,c.id)})).filter(x=>x.n);
  if(!cs.length) return "";
  return `<div class="wk-money">${cs.map(x=>`<div><span class="dot" style="background:${crewColor(x.c.id)||"var(--ink-2)"}"></span>${esc(x.c.name)} <b class="mono">${money0(x.rev)}</b>${isRaul()&&x.mine?` <span class="cm-me mono">you ${money0(x.mine)}</span>`:""}</div>`).join("")}</div>`;
}
