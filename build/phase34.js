/* ---------- iPhone home-screen app: keyboard leaves the screen shrunk, bottom bar floats mid-screen ---------- */
/* iOS WebKit bug in standalone web apps: after the keyboard closes, innerHeight / visualViewport stay short until
   the app is force-quit. Heal it by forcing a re-layout; if WebKit still reports short, pin the bar to the real bottom. */
(function(){
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if(!standalone || !/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) || navigator.maxTouchPoints<1) return;
  const maxH = {p:0,l:0}, key=()=>innerWidth>innerHeight?"l":"p";
  const typing = () => { const a=document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable); };
  const note = () => { if(!typing()) maxH[key()]=Math.max(maxH[key()], innerHeight); };
  const short = () => maxH[key()] - innerHeight;
  function pin(){ const t=document.querySelector(".tabs"); if(!t) return; const gap=typing()?0:Math.max(0,short()); t.style.transform = gap>4 ? `translateY(${gap}px)` : ""; }
  function heal(){
    if(typing() || short()<=4) return pin();
    const y=scrollY, b=document.body, d=b.style.display;
    b.style.display="none"; void b.offsetHeight; b.style.display=d; window.scrollTo(0,y);
    setTimeout(()=>{ note(); pin(); if(short()>4) track("lag",{where:"iOS keyboard shrink "+Math.round(short())+"px",ms:0}); }, 60);
  }
  note();
  addEventListener("resize", ()=>{ note(); pin(); });
  addEventListener("orientationchange", ()=>setTimeout(()=>{ note(); pin(); },300));
  document.addEventListener("focusout", ()=>setTimeout(heal,150));
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) setTimeout(heal,150); });
  addEventListener("pageshow", ()=>setTimeout(heal,150));
  if(window.visualViewport) visualViewport.addEventListener("resize", ()=>{ if(!typing()) setTimeout(heal,150); });
})();
