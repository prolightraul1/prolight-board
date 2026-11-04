/* ---------- ProWash HQ install export: status + log (money people) ---------- */
function hqCard(){
  if(!S.me.money) return "";
  const st=S.fin.get("hq-export")||null, log=(st&&st.log)||[];
  const head=!st?`Waiting for Brayden's key. Once <span class="mono">INSTALL_INGEST_KEY</span> is added in Vercel, the first completed install of the day is sent as a test.`
    :st.blocked?`<b style="color:var(--red)">Stopped:</b> HQ rejected the key. Brayden needs to check <span class="mono">INSTALL_INGEST_KEY</span>.`
    :st.live?`<b style="color:var(--ok,#1f8a4c)">Live</b> since ${esc(fmtDay(isoOf(st.liveAt),{month:"short",day:"numeric"}))}. New check-offs go out within 2 minutes, and the last 14 days are re-sent every night at 9 PM.`
    :`Key is in. The test runs on the next completed install today.`;
  const line=e=>{ const t=new Date(e.at).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
    const what=e.mode==="test"?(e.ok?"Test passed: sent twice, no double count":`Test failed (HQ answered ${e.status})`)
      :e.status?`${e.note} · ${e.sent} row${e.sent===1?"":"s"}`:e.note&&!e.sent?e.note:`${e.mode==="full"?"Nightly resend":"Sent"} ${e.sent} row${e.sent===1?"":"s"} · ${e.inserted||0} new · ${e.updated||0} updated${(e.errors||[]).length?` · ${(e.errors||[]).length} rejected`:""}`;
    return `<div class="th-row"><small>${esc(t)}</small><span>${esc(what)}</span><span></span></div>`; };
  return `<div class="dcard"><header><span class="eyebrow">ProWash HQ install export</span></header><p class="count" style="margin:0">${head}</p>${log.length?`<div class="tcl-hist" style="margin:0">${log.slice(0,10).map(line).join("")}</div>`:""}</div>`;
}
