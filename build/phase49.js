/* ---------- Week: revenue total for each day ---------- */
function wkDayRev(d){
  if(!S.me.money) return null;
  const cs=(S.team==="all"?crews():crews().filter(c=>c.id===S.team)).map(c=>crewDay(d,c.id)).filter(x=>x.n);
  return cs.length?{rev:cs.reduce((t,x)=>t+x.rev,0), done:cs.reduce((t,x)=>t+x.done,0), crews:cs.length}:null;
}
const wkDayTotal = d => { const r=wkDayRev(d); return r?`<b class="wk-total mono" title="Install revenue scheduled this day${r.done?` · ${money0(r.done)} done`:""}">${money0(r.rev)}</b>`:""; };
const _wkMoney0 = wkMoney;
wkMoney = function(d){
  const h=_wkMoney0(d), r=wkDayRev(d); if(!h||!r||r.crews<2) return h;
  return h.replace(/<\/div>$/, `<div class="wk-daytot">Day total <b class="mono">${money0(r.rev)}</b></div></div>`);
};
