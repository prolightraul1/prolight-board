/* ---------- open time: leave out time the app spent in the background ---------- */
// A board that starts loading while the phone is locked, the app is switched away or Safari restores a
// background tab only finishes "opening" once someone looks at it. That wait is not load time.
const OPENBG = { ms:0, t:document.visibilityState==="hidden" ? 0 : null };
document.addEventListener("visibilitychange",()=>{ if(LOADED_AT) return; const now=performance.now();
  if(document.hidden){ if(OPENBG.t==null) OPENBG.t=now; } else if(OPENBG.t!=null){ OPENBG.ms+=now-OPENBG.t; OPENBG.t=null; } });
function openHiddenMs(at){ return Math.round(OPENBG.ms + (OPENBG.t!=null ? at-OPENBG.t : 0)); }
