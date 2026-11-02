
/* ---------- push notifications ---------- */
const PUSH = { reg:null, sub:null, key:null, err:"" };
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const NOTE_KINDS = () => [["chat",LANG_ES?"Mensajes de chat":"Chat messages"],["meeting",LANG_ES?"Videollamadas y reuniones":"Video calls and crew meetings"],["jobs",LANG_ES?"Trabajos nuevos y cambios de ruta":"New jobs and route changes"],["time",LANG_ES?"Correcciones de tiempo":"Time fixes"],
  ...((S.me.manage)?[["problems",LANG_ES?"Problemas y trabajos parciales":"Problems and partly done jobs"],["sync",LANG_ES?"Trabajos nuevos de Jobber":"New jobs from Jobber"]]:[])];
if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").then(r=>{ PUSH.reg=r; return r.pushManager&&r.pushManager.getSubscription(); }).then(s=>{ PUSH.sub=s||null; }).catch(()=>{});
if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message",e=>{ if(e.data&&e.data.go) goTo(e.data.go); });
function goTo(u){
  try{ const g=new URL(u,location.origin).searchParams.get("go"); if(!g) return; const [k,...rest]=g.split(":"), v=rest.join(":");
    if(k==="chat"){ S.view="chat"; S.chat.ch=v; closeDrawer(); renderMain(); }
    else if(k==="call"){ S.view="chat"; S.chat.ch=v==="ann"?"ann":v; renderMain(); startCall(v,false); }
    else if(k==="job"){ openDrawer("job",v); }
    else if(k==="office"){ S.view="office"; setOffice(v); renderMain(); }
    else if(k==="jobs"){ S.view="jobs"; renderMain(); }
    else if(k==="account"){ openDrawer("account"); }
  }catch(e){}
}
function goFromUrl(){ if(goFromUrl.done||!S.ready) return; goFromUrl.done=true; const q=new URLSearchParams(location.search); if(q.get("go")){ const u=location.href; history.replaceState(null,"",location.pathname); setTimeout(()=>goTo(u),300); } }
const b64ToBytes = s => { const p="=".repeat((4-s.length%4)%4), b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(b,c=>c.charCodeAt(0)); };
async function pushOn(){
  PUSH.err="";
  try{
    if(!pushSupported()) throw new Error(isIOS()&&!isStandalone()?"ios-home":"unsupported");
    const perm=await Notification.requestPermission(); if(perm!=="granted") throw new Error("denied");
    if(!PUSH.key){ const r=await fetch("/api/notify?key=1"); PUSH.key=(await r.json()).key; }
    if(!PUSH.key) throw new Error("not-set-up");
    const reg=PUSH.reg||await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(PUSH.key)});
    await PL.pushSave(sub.toJSON(), DEVICE); PUSH.sub=sub; toast(LANG_ES?"Notificaciones activadas":"Notifications are on");
    try{ ls("push-ask","done"); }catch(e){}
  }catch(e){ PUSH.err=e.message; }
  renderDrawer(); renderMain();
}
async function pushOff(){ try{ if(PUSH.sub){ await PL.pushRemove(PUSH.sub.endpoint).catch(()=>{}); await PUSH.sub.unsubscribe(); } PUSH.sub=null; toast(LANG_ES?"Notificaciones apagadas en este aparato":"Notifications off on this device"); }catch(e){} renderDrawer(); }
function pushErrText(e){ return e==="ios-home"?(LANG_ES?"En iPhone, primero agrega el tablero a tu pantalla de inicio: toca Compartir y luego \"Agregar a inicio\". Ábrelo desde ese ícono y vuelve aquí.":"On iPhone, first add the board to your Home Screen: tap Share, then \"Add to Home Screen\". Open it from that icon and come back here.")
  : e==="denied"?(LANG_ES?"Las notificaciones están bloqueadas. Actívalas en la configuración de tu teléfono o navegador para este sitio.":"Notifications are blocked. Turn them on for this site in your phone or browser settings.")
  : e==="not-set-up"?(LANG_ES?"La oficina todavía no termina de activar las notificaciones.":"The office hasn't finished turning on notifications yet.")
  : e==="unsupported"?(LANG_ES?"Este navegador no puede recibir notificaciones. Usa Chrome, Edge o Safari actualizado.":"This browser can't get notifications. Use an up-to-date Chrome, Edge or Safari.")
  : e; }
function notifyCard(){
  const on=!!PUSH.sub&&("Notification" in window)&&Notification.permission==="granted", N=(PL.me()||{}).notify||{};
  return `<fieldset><legend>${LANG_ES?"Notificaciones":"Notifications"}</legend>
    <div class="bar">${on?`<span class="st down">✓ ${LANG_ES?"Activadas en este aparato":"On for this device"}</span><button type="button" class="btn small" data-act="push-off">${LANG_ES?"Apagar":"Turn off"}</button>`:`<button type="button" class="btn amber" data-act="push-on">${LANG_ES?"Activar notificaciones":"Turn on notifications"}</button>`}</div>
    ${PUSH.err?`<div class="note">${esc(pushErrText(PUSH.err))}</div>`:(!on&&isIOS()&&!isStandalone()?`<small>${esc(pushErrText("ios-home"))}</small>`:"")}
    ${on?`<div class="checks" style="margin-top:6px">${NOTE_KINDS().map(([k,l])=>`<label><input type="checkbox" data-notify="${k}" ${N[k]===false?"":"checked"}><span>${esc(l)}</span></label>`).join("")}</div>`:""}
  </fieldset>`;
}
function pushBanner(){
  if(!S.ready||!pushSupported()&&!(isIOS()&&!isStandalone())) return "";
  if(PUSH.sub||("Notification" in window&&Notification.permission!=="default")) return "";
  try{ if(ls("push-ask")) return ""; }catch(e){}
  return `<div class="ann push-ask"><div><span class="eyebrow">🔔 ${LANG_ES?"Notificaciones":"Notifications"}</span><div>${LANG_ES?"Recibe avisos de mensajes, reuniones y cambios de ruta.":"Get a buzz for messages, crew meetings and route changes."}</div></div><div class="bar" style="flex-wrap:nowrap"><button type="button" class="btn" data-act="push-on">${LANG_ES?"Activar":"Turn on"}</button><button type="button" class="btn small" data-act="push-later" style="background:none;border-color:#ffffff33;color:inherit">${LANG_ES?"Ahora no":"Not now"}</button></div></div>`;
}
