
/* ---------- looks: bulb colors, day/night, intro, celebrations, season ---------- */
const PALETTE = {
  warm:  {n:"Warm white", c:"#FFB23E"}, white:{n:"Pure white", c:"#EEF3FF"}, red:{n:"Red", c:"#E8352B"},
  green: {n:"Green", c:"#22B04F"},      blue: {n:"Blue", c:"#2F6BFF"},       purple:{n:"Purple", c:"#8E4DFF"},
  orange:{n:"Orange", c:"#FF7A1A"},     yellow:{n:"Yellow", c:"#FFD21F"},    teal:{n:"Teal", c:"#14B8A6"} };
const COMBOS = [
  ["Warm white",["warm"]], ["Pure white",["white"]], ["Warm + pure white",["warm","white"]],
  ["Classic multicolor",["red","green","blue","orange","yellow"]], ["Red & green",["red","green"]],
  ["Candy cane",["red","white"]], ["Red, white & green",["red","white","green"]], ["Blue & white",["blue","white"]],
  ["Icy",["white","blue","teal"]], ["Red, white & blue",["red","white","blue"]], ["Green & gold",["green","yellow"]],
  ["Purple & teal",["purple","teal"]], ["Halloween",["orange","purple"]], ["Rainbow",["red","orange","yellow","green","teal","blue","purple","white","warm"]] ];
const LOOK_DEF = {colors:["warm"], mode:"auto", intro:"daily", snow:true, buzz:true};
function look(){ try{ const o={...LOOK_DEF,...JSON.parse(ls("look")||"{}")}; o.colors=(o.colors||[]).filter(k=>PALETTE[k]); if(!o.colors.length) o.colors=["warm"]; return o; }catch(e){ return {...LOOK_DEF}; } }
function setLook(p){ ls("look",JSON.stringify({...look(),...p})); applyLook(); }
const bulbColors = () => look().colors.map(k=>PALETTE[k].c);
const lum = h => { const n=parseInt(h.slice(1),16), f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255); };

/* day / night */
function sunriseFor(dateISO){ const ss=sunsetFor(dateISO); if(!ss) return null; const d=parseISO(dateISO); const noon=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),17,37)); return new Date(noon.getTime()-(ss-noon)); }
function nightNow(){ const t=todayISO(), now=new Date(), ss=sunsetFor(t), sr=sunriseFor(t); return ss&&sr ? (now>=ss||now<sr) : (now.getHours()>=18||now.getHours()<7); }
function effectiveDark(){ const m=look().mode; return m==="dark" || (m==="auto"&&nightNow()) || (m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches); }
function applyLook(){
  const L=look(), root=document.documentElement, dark=effectiveDark();
  if(L.mode==="system") delete root.dataset.theme; else root.dataset.theme = dark?"dark":"light";
  let a=PALETTE[L.colors[0]].c;
  // keep the main button color readable on the background
  if(!dark && lum(a)>.6) a=`color-mix(in srgb, ${a} 62%, #6b5a2a)`;
  const ink = lum(PALETTE[L.colors[0]].c)>.35 ? "#1a1406" : "#ffffff";
  root.style.setProperty("--amber", a);
  root.style.setProperty("--amber-ink", ink);
  root.style.setProperty("--amber-soft", `color-mix(in srgb, ${PALETTE[L.colors[0]].c} ${dark?18:22}%, ${dark?"#161e1a":"#ffffff"})`);
  root.style.setProperty("--amber-text", `color-mix(in srgb, ${PALETTE[L.colors[0]].c} ${dark?85:60}%, ${dark?"#ffffff":"#141916"})`);
  root.classList.toggle("night-map", dark);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=dark?"#080c0a":"#111916";
  paintBulbs(true);
}
setInterval(()=>{ if(look().mode==="auto") { const d=effectiveDark(); if((document.documentElement.dataset.theme==="dark")!==d) { applyLook(); if(S.view==="map"&&typeof drawMap==="function") drawMap(); } } }, 60e3);

/* every lit bulb on the page takes the next color in your set */
let paintQ=0;
function paintBulbs(force){
  const C=bulbColors(); let i=0;
  document.querySelectorAll(".bulb").forEach(b=>{ if(b.closest("#intro,#routelit,.look-swatch")) return; const c=C[i++%C.length]; if(force||b.dataset.bc!==c){ b.dataset.bc=c; b.style.setProperty("--bc",c); } });
}
new MutationObserver(()=>{ if(paintQ) return; paintQ=requestAnimationFrame(()=>{ paintQ=0; paintBulbs(); }); }).observe(document.documentElement,{childList:true,subtree:true});

/* phone buzz */
const buzz = p => { if(look().buzz && navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} };

/* snow */
function snowIn(el, density=60){
  if(!el || el.querySelector("canvas.snow") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv=document.createElement("canvas"); cv.className="snow"; el.prepend(cv);
  const ctx=cv.getContext("2d"); let W=0,H=0, flakes=[];
  const size=()=>{ const r=el.getBoundingClientRect(), d=Math.min(2,devicePixelRatio||1); W=r.width; H=r.height; cv.width=W*d; cv.height=H*d; ctx.setTransform(d,0,0,d,0,0);
    flakes=[...Array(Math.round(density*W*H/400000)+8)].map(()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.2+.6,s:Math.random()*.6+.25,w:Math.random()*Math.PI*2})); };
  size(); addEventListener("resize",size);
  (function tick(){ if(!cv.isConnected) return; ctx.clearRect(0,0,W,H); ctx.fillStyle="rgba(255,255,255,.85)";
    for(const f of flakes){ f.y+=f.s; f.w+=.01; f.x+=Math.sin(f.w)*.3; if(f.y>H+4){ f.y=-4; f.x=Math.random()*W; } ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,7); ctx.fill(); }
    requestAnimationFrame(tick); })();
}
const md = () => { const d=new Date(); return (d.getMonth()+1)*100+d.getDate(); };
const snowSeason = () => look().snow && (md()>=1101 || md()<=110);
const christmasWeek = () => md()>=1219 && md()<=1226;

/* the startup "plug-in" */
function strandSVG(n, w, h, cls){
  const C=bulbColors(), pts=[...Array(n)].map((_,i)=>{ const x=(i+.5)*w/n, y=h*.38+Math.sin(i/(n-1)*Math.PI)*h*.22; return [x,y]; });
  const path="M0,"+(h*.3)+" "+pts.map(([x,y])=>`L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")+` L${w},${h*.3}`;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#2a6e4e" stroke-width="3" stroke-linejoin="round"/></svg>`+
    pts.map(([x,y],i)=>`<span class="ib" style="left:${(x/w*100).toFixed(2)}%;top:${(y/h*100).toFixed(2)}%;--bc:${C[i%C.length]};--d:${i}"></span>`).join("");
}
function playIntro(force){
  const L=look();
  // on a fresh sign-in the welcome screen does the lights instead
  if(!force){ const d=new Date(Date.now()-3*3600e3); if(ls("prolight-day")!==d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()) return; }
  if(!force){ if(L.intro==="off") return; if(L.intro==="daily" && ls("introDay")===todayISO()) return; }
  ls("introDay",todayISO());
  const old=$("#intro"); if(old) old.remove();
  const el=document.createElement("div"); el.id="intro"; el.setAttribute("role","presentation");
  el.innerHTML=`<div class="intro-strand">${strandSVG(9,900,160,"intro-cord")}</div>
    <img class="intro-logo" src="/brand/prolight.png" alt="ProLight"><div class="intro-sub">Season board</div>`;
  document.body.appendChild(el);
  if(snowSeason()) snowIn(el, christmasWeek()?120:70);
  const done=()=>{ if(!el.isConnected) return; el.classList.add("out"); setTimeout(()=>el.remove(),450); };
  el.addEventListener("click",done);
  setTimeout(done, matchMedia("(prefers-reduced-motion: reduce)").matches?900:2300);
}

/* bulb pop when a stop is done, and the whole route lighting up */
S.pop = S.pop || null;
const popCls = (j,v) => S.pop && S.pop.k===j.id+"|"+v.id && Date.now()-S.pop.t<1600 ? " pop" : "";
function celebrate(jid,vid){
  S.pop={k:jid+"|"+vid,t:Date.now()}; buzz(35);
  const day=S.day, team=S.team; let tries=0;
  const check=()=>{ const st=stopsFor(day,team); if(!st.length) return;
    if(!isDone(jid,vid)){ if(++tries<12) setTimeout(check,250); return; }
    if(st.every(s=>isDone(s.j.id,s.v.id))) routeLit(st.length, team); };
  setTimeout(check,200);
}
function routeLit(n, team){
  buzz([40,60,40,60,140]);
  const el=document.createElement("div"); el.id="routelit";
  el.innerHTML=`<div class="rl-in"><div class="rl-strand">${strandSVG(Math.max(4,Math.min(14,n)),700,120,"rl-cord")}</div>
    <div class="rl-t">Route lit</div><div class="rl-s">${n} of ${n} stops done${team&&team!=="all"?" · "+esc(teamName(team)):""}</div></div>`;
  document.body.appendChild(el);
  const done=()=>{ if(!el.isConnected) return; el.classList.add("out"); setTimeout(()=>el.remove(),450); };
  el.addEventListener("click",done); setTimeout(done,3200);
}

/* season header: countdown, houses lit, then takedown */
function seasonBar(){
  const all=jobsArr().filter(j=>j.stage!=="cancelled" && (j.visits||[]).some(v=>v.type==="install"));
  if(!all.length) return "";
  const st=all.map(status), lit=st.filter(s=>s==="lit"||s==="partial").length, down=st.filter(s=>s==="down").length, total=all.length;
  const t=parseISO(todayISO()), y=t.getMonth()===0||t.getMonth()===1 ? t.getFullYear()-1 : t.getFullYear();
  const xmas=new Date(y,11,25), days=Math.round((xmas-t)/864e5);
  const after = days<0;
  let txt, on, n=Math.min(24,total);
  if(!after){ txt = days===0 ? `Merry Christmas · ${lit+down} houses lit` : `${days} day${days>1?"s":""} to Christmas · ${lit+down} of ${total} houses lit`; on=Math.round((lit+down)/total*n); }
  else { const up=lit+down; txt = `Takedown · ${down} of ${up} down`; on=up?Math.round((up-down)/up*n):0; }
  return `<div class="season ${after?"after":""} ${christmasWeek()?"xmas":""}"><span class="season-t">${esc(txt)}</span><span class="season-strand">${[...Array(n)].map((_,i)=>`<span class="bulb ${i<on?"on":""}"></span>`).join("")}</span></div>`;
}

/* settings panel in the account drawer */
function lookPanel(){
  const L=look(), sw=keys=>`<span class="look-swatch">${keys.map(k=>`<i style="--c:${PALETTE[k].c}"></i>`).join("")}</span>`;
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  return `<fieldset class="look"><legend>Look</legend>
    <div class="f"><label>Bulb colors</label><div class="look-combos">${COMBOS.map(([n,k],i)=>`<button type="button" class="look-combo" data-act="look-combo" data-v="${i}" aria-pressed="${same(L.colors,k)}">${sw(k)}<span>${esc(n)}</span></button>`).join("")}</div>
      <small>Or build your own: tap colors in the order you want them on the strand.</small>
      <div class="look-colors">${Object.entries(PALETTE).map(([k,p])=>{ const i=L.colors.indexOf(k); return `<button type="button" class="look-color" data-act="look-color" data-v="${k}" aria-pressed="${i>=0}"><i style="--c:${p.c}"></i>${esc(p.n)}${i>=0&&L.colors.length>1?`<b>${i+1}</b>`:""}</button>`; }).join("")}</div></div>
    <div class="f"><label>Light or dark</label><div class="seg" role="group">${[["auto","Dark after sunset"],["light","Always light"],["dark","Always dark"],["system","Match my phone"]].map(([k,l])=>`<button type="button" data-act="look-mode" data-v="${k}" aria-pressed="${L.mode===k}">${l}</button>`).join("")}</div></div>
    <div class="f"><label>Startup lights</label><div class="seg" role="group">${[["daily","Once a day"],["always","Every open"],["off","Off"]].map(([k,l])=>`<button type="button" data-act="look-intro" data-v="${k}" aria-pressed="${L.intro===k}">${l}</button>`).join("")}</div>
      <div class="bar" style="margin-top:6px"><button type="button" class="btn small" data-act="look-play">Play it now</button>
      <button type="button" class="tog" data-act="look-snow" aria-pressed="${L.snow}">${L.snow?"Snow on":"Snow off"}</button>
      <button type="button" class="tog" data-act="look-buzz" aria-pressed="${L.buzz}">${L.buzz?"Buzz on":"Buzz off"}</button></div></div>
  </fieldset>`;
}
applyLook();
playIntro();
function gateSnow(){ const g=$("#gate"); if(g && !g.hidden && snowSeason()) snowIn(g, christmasWeek()?110:55); }
new MutationObserver(()=>{ if(gateSnow.q) return; gateSnow.q=requestAnimationFrame(()=>{ gateSnow.q=0; gateSnow(); }); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});

/* headshots */
const staffOf = id => (window.PL&&PL.staff().find(p=>p.id===id)) || null;
function avatar(id, cls){ const p=staffOf(id), url=p&&PL.photoUrl(p), n=(p&&p.name)||"?";
  return `<span class="ava ${cls||""}">${url?`<img src="${esc(url)}" alt="" loading="lazy">`:esc(n[0].toUpperCase())}</span>`; }
async function changePhoto(file, id){
  if(!file) return; toast("Saving photo…");
  try{ await PL.setPhoto(id||S.me.id, await PL.squarePhoto(file)); toast("Photo saved"); renderDrawer(); renderNav(); }catch(e){ toast("Couldn't save the photo: "+e.message.slice(0,90)); }
}
