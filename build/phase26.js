/* ---------- backups card (managers): last nightly backups, download any of them ---------- */
function backupCard(){
  if(!S.me.manage) return "";
  setTimeout(loadBackups,0);
  return `<section class="form" style="max-width:720px;margin-top:16px"><fieldset><legend>Backups</legend>
    <p class="lede" style="font-size:14px">Everything on the board is backed up every night at midnight: jobs, clients, money, hours, notes, chat and people. The last 45 nights are kept in a private storage area only managers can open. Photos and videos stay saved where they are.</p>
    <div id="bk-list" class="count">Loading backups…</div></fieldset></section>`;
}
async function loadBackups(){
  const el=document.getElementById("bk-list"); if(!el) return;
  try{ const r=await fetch("/api/backup?action=list",{headers:{Authorization:"Bearer "+(await PL.authToken())}}); const j=await r.json(); if(!r.ok) throw new Error(j.error||"");
    const f=(j.files||[]).filter(x=>/^board-/.test(x.name));
    el.innerHTML=f.length?`<div class="rows">${f.slice(0,14).map(x=>{ const d=x.name.slice(6,16); return `<div class="row" style="cursor:default"><span class="m"><span class="n">${esc(fmtDay(d,{weekday:"short",month:"short",day:"numeric"}))}</span><span class="s">${x.kb} KB</span></span><span class="r"><button type="button" class="btn small" data-act="bk-get" data-v="${esc(x.name)}">Download</button></span></div>`; }).join("")}</div>${f.length>14?`<p class="count">${f.length} backups kept.</p>`:""}`:`The first backup runs tonight at midnight.`;
  }catch(e){ el.textContent="Couldn't load the backups list."; }
}
async function getBackup(name){
  try{ const r=await fetch("/api/backup?action=get&name="+encodeURIComponent(name),{headers:{Authorization:"Bearer "+(await PL.authToken())}}); const j=await r.json(); if(!r.ok) throw new Error(j.error); location.href=j.url; }
  catch(e){ toast("Couldn't download that backup."); }
}
