
/* ---------- delete a person; names of people who left stay on their history ---------- */
async function deletePerson(id){
  const p=PL.staff().find(x=>x.id===id); if(!p) return;
  S.busy=true; renderDrawer();
  try{ await PL.remove(id); S.busy=false; S.form=null; toast(`${p.name} deleted`); closeDrawer(); }
  catch(e){ S.busy=false; S.form.confirmDel=false; renderDrawer(); const el=$("#pp-err"); if(el) el.textContent=e.message.replace(/^.*?: /,""); }
}

/* ---------- PIN report (managers) ---------- */
function dPins(){
  const R=S.pins;
  const fmt=x=>x?new Date(x).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"–";
  let b=`<p class="lede" style="font-size:14px">Every login and its PIN. Keep this screen to yourself. PINs set before this report existed can't be read back (they're stored scrambled), so they show as hidden until you reset them.</p>
    <div class="bar"><button type="button" class="btn small" data-act="pins-show">${S.pinsShow?"Hide PINs":"Show PINs"}</button></div>`;
  if(!R) b+=skel(4);
  else if(R.error) b+=`<div class="note">${esc(R.error)}${/function|does not exist|schema/i.test(R.error)?"<br>Run update 10 in Supabase first.":""}</div>`;
  else b+=`<div class="tbl"><table style="min-width:0"><thead><tr><th>Person</th><th>PIN</th><th>Set</th><th>Last sign-in</th><th></th></tr></thead><tbody>${R.map(r=>`<tr>
      <td><b>${esc(r.name)}</b>${r.active?"":` <small class="count">(turned off)</small>`}</td>
      <td class="mono" style="font-size:16px;letter-spacing:.12em">${r.pin?(S.pinsShow?esc(r.pin):"••••••"):`<small class="count" style="letter-spacing:0">Reset to see it</small>`}</td>
      <td>${fmt(r.set_at)}</td><td>${fmt(r.last_sign_in)}</td>
      <td><button type="button" class="btn small" data-act="person" data-id="${esc(r.id)}">${r.pin?"Change":"Reset PIN"}</button></td></tr>`).join("")}</tbody></table></div>`;
  return drawerShell("Team","PIN report",b);
}
async function openPins(){ S.pins=null; S.pinsShow=false; openDrawer("pins"); try{ S.pins=await PL.pinReport(); }catch(e){ S.pins={error:e.message}; } if(S.drawer&&S.drawer.kind==="pins") renderDrawer(); }

/* ---------- sign everyone out so they pick a new PIN ---------- */
function checkForcedSignIn(d){
  if(!d||!d.after||!window.PL||!PL.me()||d.by===S.me.id||checkForcedSignIn.busy) return;
  checkForcedSignIn.busy=true;
  PL.signedInAt().then(t=>{ if(t && new Date(t)>=new Date(d.after)) { checkForcedSignIn.busy=false; return; } toast(LANG_ES?"La oficina pidió que todos vuelvan a entrar.":"The office asked everyone to sign in again."); setTimeout(()=>PL.signOut(),1500); }).catch(()=>{ checkForcedSignIn.busy=false; });
}
async function requireNewPins(){
  try{ await PL.requireNewPins(); S.newPinsAsk=false; toast("Done. Everyone else is signed out and will pick a new PIN."); renderMain(); }
  catch(e){ S.newPinsAsk=false; renderMain(); toast(/function|exist/i.test(e.message)?"Run update 12 in Supabase first.":e.message); }
}

/* seasonal light themes: Halloween only in October; after that, anyone still on it picks new lights */
const comboOk = n => n!=="Halloween" || new Date().getMonth()===9;
function seasonalLookCheck(){
  if(seasonalLookCheck.done||!S.ready||!window.PL||!PL.pickLook||!PL.me()) return; seasonalLookCheck.done=true;
  const c=[...look().colors].sort().join(",");
  if(!comboOk("Halloween") && c==="orange,purple") setTimeout(()=>PL.pickLook(LANG_ES?"¡Se acabó Halloween! Elige tus luces para la temporada":"Halloween's over! Pick your lights for the season").then(()=>{ applyLook(); renderMain(); }),1200);
}
