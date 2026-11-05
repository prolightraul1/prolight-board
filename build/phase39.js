/* ---------- TCL change history on a job (owners) ---------- */
const TCL_K={scope:"Colors",price:"Price",tclWhen:"Timing",ready:"Checklist",priority:"Priority",tclStatus:"Status",notes:"Crew notes",privateNote:"Deposit/balance",media:"Photos"};
function tclHistory(j){
  if(j.source!=="tcl"||!S.me.owner) return "";
  const f=S.fin.get(j.id)||{}, rows=[...(j.tclLog||[]),...((f.tclLog||[]))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,8);
  const seen=j.tclSeenAt?`Last checked against TCL ${esc(fmtDay(isoOf(j.tclSeenAt),{month:"short",day:"numeric"}))} ${esc(new Date(j.tclSeenAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}))}`:"Not synced with TCL yet";
  const val=(h,v)=>h.k==="price"?money2(+v||0):esc(String(v||"—").slice(0,80));
  return `<div class="tcl-hist"><span class="eyebrow">Changes from TCL</span>${rows.length?rows.map(h=>`<div class="th-row"><b>${esc(TCL_K[h.k]||h.k)}</b><span>${h.k==="notes"||h.k==="privateNote"||h.k==="media"?esc(h.to||"updated"):`${val(h,h.from)} → ${val(h,h.to)}`}</span><small>${esc(fmtDay(isoOf(h.at),{month:"short",day:"numeric"}))}</small></div>`).join(""):`<p class="count">No changes from TCL yet.</p>`}<small class="count">${seen}</small></div>`;
}

/* Jobber date sync note (owners) */
function jbSyncLine(j){ const x=j.jobberDateSync; if(!S.me.owner||!x||!x.at) return ""; return `<p class="count" style="margin:4px 0">✓ Jobber visit moved to ${esc(fmtDay(x.date,{weekday:"short",month:"short",day:"numeric"}))} · ${esc(new Date(x.at).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}))}</p>`; }
