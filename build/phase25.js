/* ---------- Raul only: his management fee on every job ---------- */
function myFee(j){
  if(!isRaul()) return null;
  const id=S.me.id, price=+((S.fin.get(j.id)||{}).price)||0, inst=installedOn(j);
  const pl=planFor(id, inst||"9999-12-31"), pct=feePct(pl,j), self=isSelf(j), auto=onRaulCrew(j)&&(S.fin.get(j.id)||{}).selfInstall!==false;
  const sale=saleOf(j), comm=sale&&sale.by===id?sale.comm:0;
  return {price, pct, mgmtPct:pl.mgmtPct||0, self, auto, comm, fee:Math.round(price*pct)/100, earned:!!inst&&pct>0, inst, before:!!inst&&!(pl.mgmtPct>0), manage:mgmtOn(j)};
}
const myFeeChip = j => { const f=myFee(j); if(!f||!f.price||(!f.pct&&!f.before)) return ""; return `<span class="fee-chip ${f.earned?"ok":""} ${f.self?"self":""}" title="${f.self?"You installed it":"Your management fee"}">${f.before?"before 3%":`${f.self?"🔧 ":""}${f.pct}% · ${money2(f.fee)}`}</span>`; };
function feeLabel(j,f){
  const n=jobCrews(j).length, shared=f.self&&n>1&&(S.fin.get(j.id)||{}).selfInstall!==true, m=f.manage?"3% + ":"";
  if(f.self) return shared?`Installed with ${n-1} other crew${n>2?"s":""} (${m}your share of 10%)`:`Installed it yourself (${m}10%)`;
  return f.manage?"Management fee":"No management fee on this job · sales only";
}
async function setManage(jid,on){
  const f=S.fin.get(jid)||{};
  try{ await S.db.doc("fin/"+jid).set({...f,manage:!!on}); toast(on?"Managing this job · +3%":"No management fee on this job"); }catch(e){ fail(e,"save that"); }
}
async function setSelfInstall(jid,on){
  const f=S.fin.get(jid)||{};
  try{ await S.db.doc("fin/"+jid).set({...f,selfInstall:!!on}); toast(on?`Marked as installed by you alone · ${SELF_PCT}%`:"Back to the management fee"); }catch(e){ fail(e,"save that"); }
}
function myFeeBlock(j){
  const f=myFee(j); if(!f) return "";
  if(!f.price) return `<section class="blk fee-blk"><span class="eyebrow">Your management fee · only you see this</span><p class="count">No price on this job yet.</p></section>`;
  return `<section class="blk fee-blk"><span class="eyebrow">Your pay on this job · only you see this</span>
    <div class="fee-row"><b>${f.before?"$0.00":money2(f.fee)}</b><span>${f.before?`Installed ${esc(fmtDay(f.inst))}, before your 3% started`:`${feeLabel(j,f)} · ${f.pct}% of ${money2(f.price)} · ${f.earned?`earned ${esc(fmtDay(f.inst))}`:"you get it when the install is checked off"}`}</span></div>
    ${f.comm?`<div class="fee-row" style="margin-top:2px"><b style="font-size:18px">+ ${money2(f.comm)}</b><span>sales commission (you sold it) · total ${money2(f.fee+f.comm)}</span></div>`:""}
    ${f.mgmtPct?`<label class="fee-self"><input type="checkbox" data-manage="${esc(j.id)}" ${f.manage?"checked":""}> I'm managing this job <small>(+${f.mgmtPct}% management fee · from Nov 12 it's off unless you turn it on; earlier jobs keep it)</small></label>`:""}
    ${f.mgmtPct?`<label class="fee-self"><input type="checkbox" data-self-install="${esc(j.id)}" ${f.self?"checked":""}> I installed this job myself <small>(3% + 10% = ${SELF_PCT}% when you're the only crew; with other crews it's 3% + your share of 10%)${f.auto?" · on automatically, it's on the Raul crew":""}</small></label>`:""}</section>`;
}
function myFeeTotals(list){
  if(!isRaul()) return "";
  let earned=0, coming=0; for(const j of list){ if(j.stage==="cancelled") continue; const f=myFee(j); if(!f||!f.pct) continue; f.earned?earned+=f.fee:coming+=f.fee; }
  if(!earned&&!coming) return "";
  return `<div class="fee-sum"><span class="eyebrow">Your management &amp; install pay · only you see this</span><span>Earned <b>${money2(earned)}</b></span><span>Still to come <b>${money2(coming)}</b></span><span class="count">on the jobs below</span></div>`;
}
