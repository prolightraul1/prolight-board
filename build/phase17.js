
/* ---------- video calls in chat (Daily.co) ---------- */
const CALL_MSG = "📹 Video call";
function callBubble(m){ const mine=m.by===S.me.id, meet=m.channel==="ann";
  return `<div class="txt call-msg">📹 <b>${meet?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):mine?(LANG_ES?"Iniciaste una videollamada":"You started a video call"):(LANG_ES?"Videollamada":"Video call")}</b> <button type="button" class="btn small amber" data-act="call-join" data-v="${esc(m.channel)}">${LANG_ES?"Unirme":"Join"}</button></div>`; }
async function startCall(ch, announce){
  const c=ch==="ann"?(LANG_ES?"Reunión con todos los equipos":"Crew meeting"):(myChannels().find(x=>x.id===ch)||{}).name||"Chat";
  let root=$("#callRoot"); if(!root){ root=document.createElement("div"); root.id="callRoot"; document.body.appendChild(root); }
  root.innerHTML=`<div class="call-bar"><span class="call-dot"></span><b>${esc(c)}</b><span class="grow"></span><button type="button" class="btn small danger" data-act="call-leave">${LANG_ES?"Salir":"Leave call"}</button></div><div class="call-body"><p class="lede" style="color:#cfd8d3">${LANG_ES?"Conectando…":"Connecting…"}</p></div>`;
  root.hidden=false; document.body.classList.add("in-call");
  try{
    const t=await PL.callTicket(ch);
    if(announce){ const last=chanMsgs(ch).filter(m=>m.body===CALL_MSG).pop(); if(!last||Date.now()-Date.parse(last.at)>15*60e3) PL.chatSend(ch,CALL_MSG).catch(()=>{}); }
    root.querySelector(".call-body").innerHTML=`<iframe title="Video call" src="${esc(t.url)}?t=${encodeURIComponent(t.token)}" allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection"></iframe>`;
    track("call",{where:ch==="ann"?"crew meeting":ch.startsWith("dm:")?"direct":"crew"});
  }catch(e){
    root.querySelector(".call-body").innerHTML=`<div class="note" style="max-width:520px">${esc(e.message)}${/DAILY_API_KEY/.test(e.message)?"<br>Add the Daily key in Vercel to turn on video calls.":""}</div>`;
  }
}
function leaveCall(){ const r=$("#callRoot"); if(r){ r.innerHTML=""; r.hidden=true; } document.body.classList.remove("in-call"); renderMain(); }

/* the all-crew meeting shows as a banner on every screen for 90 minutes after it starts */
function meetingLive(){
  const m=chanMsgs("ann").filter(x=>x.body===CALL_MSG).pop(); if(!m||Date.now()-Date.parse(m.at)>90*60e3||$("#callRoot:not([hidden]) iframe")) return "";
  return `<div class="ann meet"><div><span class="eyebrow">📹 ${LANG_ES?"Reunión en vivo":"Crew meeting is live"} · ${esc(who(m.by))}</span><div>${LANG_ES?"Empezó a las":"Started at"} ${new Date(m.at).toLocaleTimeString(LOC(),{hour:"numeric",minute:"2-digit"})}</div></div><button type="button" class="btn" data-act="call-join" data-v="ann">${LANG_ES?"Unirme":"Join"}</button></div>`;
}
