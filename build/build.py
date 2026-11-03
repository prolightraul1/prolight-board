"""Builds the standalone site (index.html) from the claude.ai board source.
Each change is an exact find/replace and fails loudly if the source moved."""
import re, sys, pathlib

SRC = pathlib.Path(__file__).with_name("base.html")
OUT = pathlib.Path(__file__).resolve().parent.parent / "index.html"
s = SRC.read_text()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f"expected {count} of:\n{old[:160]}\nfound {n}")
    s = s.replace(old, new)

def rep_between(start, end, new):
    """Replace from `start` (inclusive) up to `end` (exclusive)."""
    global s
    i = s.index(start); j = s.index(end, i)
    s = s[:i] + new + s[j:]

# ---------- page shell ----------
rep('<title>ProLight Season Board</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', '')
s = re.sub(r'<script>window\.BASEMAP=\(function.*?</script>\n', '', s, flags=re.S)

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ProLight Season Board</title>
<meta name="theme-color" content="#111916">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ProLight">
<link rel="manifest" href="/manifest.webmanifest?v=2">
<link rel="icon" href="/icon.svg?v=2" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png?v=2">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font-size:14px;-webkit-text-size-adjust:100%}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
'''
TAIL_SCRIPTS = '''<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="/config.js"></script>
<script src="/platform.js"></script>
'''
s = HEAD + s
first_script = s.index('<script>\nconst BOARD_URL')
s = s[:first_script] + TAIL_SCRIPTS + s[first_script:] + '\n</body>\n</html>\n'

# ---------- extra styles: sign-in, account, map ----------
GATE_CSS = '''
/* sign-in */
#gate{position:fixed;inset:0;z-index:100;background:var(--night);color:var(--night-ink);display:grid;place-items:center;overflow:auto;padding:calc(24px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
#gate::before{content:"";position:absolute;left:0;right:0;top:env(safe-area-inset-top,0px);height:34px;background:radial-gradient(circle,#e2443a 0 3px,transparent 4px) 0 14px/120px 30px repeat-x,radial-gradient(circle,#2fae62 0 3px,transparent 4px) 30px 14px/120px 30px repeat-x,radial-gradient(circle,#f2b632 0 3px,transparent 4px) 60px 14px/120px 30px repeat-x,radial-gradient(circle,#3c7de0 0 3px,transparent 4px) 90px 14px/120px 30px repeat-x;opacity:.9}
.gate-card{width:min(380px,100%);display:grid;gap:14px;justify-items:center;text-align:center}
.gate-brand{display:grid;gap:2px;margin-bottom:6px}
.gate-brand b{font-family:var(--f-sign);font-weight:900;font-size:40px;letter-spacing:.03em;line-height:1}
.gate-brand b i{font-style:normal;color:var(--amber)}
.gate-brand span{font-family:var(--f-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--night-dim)}
.gate-card h2{margin:0;font-family:var(--f-sign);font-weight:800;font-size:28px;text-transform:uppercase}
.gate-card p{margin:0;color:var(--night-dim)}
.gate-names{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
.gate-names button{min-height:56px;border-radius:var(--r);border:1px solid #2a3832;background:var(--night-2);color:var(--night-ink);font-weight:700;font-size:16px}
.gate-dots{display:flex;gap:12px;margin:6px 0}
.gate-dots i{width:14px;height:14px;border-radius:50%;border:2px solid var(--night-dim)}
.gate-dots i.on{background:var(--amber);border-color:var(--amber);box-shadow:0 0 10px var(--amber)}
.gate-dots.shake{animation:shake .4s}
@keyframes shake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.gate-pad{display:grid;grid-template-columns:repeat(3,72px);gap:12px}
.gate-pad button{width:72px;height:72px;border-radius:50%;border:0;background:var(--night-2);color:var(--night-ink);font-size:26px;font-weight:600}
.gate-pad button:active{background:#2a3832}
.gate-err{color:#f28b80!important;min-height:1.2em}
.gate-back{justify-self:start;background:none;border:0;color:var(--night-dim);font-weight:700;font-size:15px;padding:4px 0}
.gate-form{display:grid;gap:12px;width:100%;text-align:left}
.gate-form label{display:grid;gap:4px;font-weight:700;font-size:14px}
.gate-form input{min-height:46px;border-radius:var(--r);border:1px solid #2a3832;background:var(--night-2);color:var(--night-ink);padding:0 12px;font-size:16px}
.gate-go{min-height:48px;border:0;border-radius:var(--r);background:var(--amber);color:var(--amber-ink);font-weight:800;font-size:16px;padding:0 18px}
.who-btn{background:none;border:1px solid #2a3832;border-radius:999px;color:var(--night-ink);font-size:12px;font-weight:700;padding:5px 10px;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.checks{display:grid;gap:8px}
.checks label{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;font-size:15px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 12px}
.checks input{width:20px;height:20px;margin-top:2px;accent-color:var(--cord)}
.checks small{display:block;color:var(--ink-2);font-size:13px}
/* street map */
.map-box #map{width:100%;height:100%}
.map-box .lmap{width:100%;height:100%;background:var(--sunk)}
.map-ctl,.map-legend,.map-hint{z-index:500}
.leaflet-container{font-family:var(--f-body)}
.pin-tip{font-weight:700;font-size:12px;padding:2px 6px;border-radius:3px}
.pin-lit{filter:drop-shadow(0 0 5px #f2a516)}
@media (prefers-color-scheme: dark){ .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.92) saturate(.6)} }
'''
rep('.map-box canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}\n', GATE_CSS)

# ---------- links & media ----------
rep('const BOARD_URL = "https://claude.ai/artifact/NGRHDJkqFARtLxtHpkcfvy";', 'const BOARD_URL = location.origin;')
rep('const src="/_blob/"+m.id;', 'const src=mediaUrl(m.id);')
rep('if(blob.size>20*1024*1024) throw {code:"too_large"};', 'if(blob.size>50*1024*1024) throw {code:"too_large"};')
rep('Videos up to 20 MB, about 15 seconds.', 'Videos up to 50 MB, about 30 seconds.')
rep('"That file is over 20 MB. Trim videos to about 15 seconds."', '"That file is over 50 MB. Trim videos to about 30 seconds."')

# ---------- permissions ----------
rep('if(S.me.owner) v.push(["office","Office"]);', 'if(S.me.owner||S.me.money||S.me.manage) v.push(["office","Office"]);')
rep('''  $("#whoTop").textContent = S.me.owner ? "Office" : (S.team==="all"?"":teamName(S.team));''',
    '''  $("#whoTop").innerHTML = `<button type="button" class="who-btn" data-act="account">${esc(S.me.name||"Me")}</button>`;
  const wb=$("#whoRailBtn"); if(wb) wb.textContent=(S.me.name||"Me")+" · Account";''')
rep('<span id="whoRail"></span></div>', '<span id="whoRail"></span><button type="button" class="who-btn" id="whoRailBtn" data-act="account" style="justify-self:start">Account</button></div>')
rep('''  if(!S.me.owner) return `<h1 class="h-view">Office</h1><p class="lede">Only the board owner can see this.</p>`;''',
    '''  if(!(S.me.owner||S.me.money||S.me.manage)) return `<h1 class="h-view">Office</h1><p class="lede">You don't have access to the office tools.</p>`;''')
rep('''  const subs=[["money","Money"],["texts","Night texts"],["settings","Settings"]];''',
    '''  const subs=[S.me.money&&["money","Money"],S.me.owner&&["texts","Night texts"],S.me.manage&&["team","Team"],S.me.owner&&["settings","Settings"]].filter(Boolean);
  if(!subs.some(x=>x[0]===S.office)) S.office=subs[0][0];''')
rep('''  if(S.office==="money") h+=vMoney(); else if(S.office==="texts") h+=vTexts(); else h+=vSettings();''',
    '''  if(S.office==="money") h+=vMoney(); else if(S.office==="texts") h+=vTexts(); else if(S.office==="team") h+=vTeam(); else h+=vSettings();''')
rep('  if(S.me.owner){ const s=split(j,f);', '  if(S.me.money){ const s=split(j,f);')
rep('<fieldset><legend>Money · only you see this</legend>', '<fieldset ${S.me.money?"":"hidden"}><legend>Money · only people with money access see this</legend>')
rep('<fieldset><legend>Split</legend>', '<fieldset ${S.me.money?"":"hidden"}><legend>Split</legend>')
rep('    const price=parseFloat(String(F.fin.price||"").replace(/[$,]/g,""))||0, old=S.fin.get(ref.id)||{};',
    '    if(S.me.money){ const price=parseFloat(String(F.fin.price||"").replace(/[$,]/g,""))||0, old=S.fin.get(ref.id)||{};')
rep('ssPct:hasPct(F.fin.ssPct)?Number(F.fin.ssPct):null});\n    S.busy=false; S.form=null; toast(F.id?"Job saved":"Job added");',
    'ssPct:hasPct(F.fin.ssPct)?Number(F.fin.ssPct):null}); }\n    autoGeo(ref.id);\n    S.busy=false; S.form=null; toast(F.id?"Job saved":"Job added");')
rep('await S.db.doc("fin/settings").set({tclRate:', 'if(S.me.money) await S.db.doc("fin/settings").set({tclRate:')
rep('toast(F.id?"Client saved":"Client added"); S.form=null;',
    'toast(F.id?"Client saved":"Client added"); jobsArr().filter(x=>x.clientId===ref.id&&!x.address).forEach(x=>autoGeo(x.id)); S.form=null;')
rep('''  if(user){ const me=await user.me(); S.me.id=me.id; S.me.owner=!!me.isOwner; S.me.canLog=!!(me.isOwner||me.canEdit); }''',
    '''  if(user){ const me=await user.me(); S.me.id=me.id; applyPerms(me.perms); }''')
rep('''  if(S.me.owner){
    db.collection("fin")''', '''  if(S.me.money){
    db.collection("fin")''')

rep('''  if(!ls("team")) S.team="all"; else if(S.team!=="all") S.team=normCrew(S.team);''',
    '''  if(!ls("team")) S.team="all"; else if(S.team!=="all") S.team=normCrew(S.team);
  { const P0=PL.me(); if(P0&&!P0.all_crews&&P0.crew) S.team=P0.crew; }''')

# ---------- drawers: account + person ----------
rep('''  root.innerHTML = D.kind==="job"?dJob(D.id): D.kind==="client"?dClient(D.id): D.kind==="jobEdit"?dJobEdit(): dClientEdit();''',
    '''  root.innerHTML = D.kind==="job"?dJob(D.id): D.kind==="client"?dClient(D.id): D.kind==="jobEdit"?dJobEdit(): D.kind==="account"?dAccount(): D.kind==="person"?dPerson(): dClientEdit();''')
rep('''  if(ev.target.id==="jobForm") saveJob();''',
    '''  if(ev.target.id==="pinForm") return saveMyPin(); if(ev.target.id==="personForm") return savePerson();
  if(ev.target.id==="jobForm") saveJob();''')

TEAM = r'''
/* ---------- people & sign-in ---------- */
function applyPerms(P){ P=P||{}; S.me.owner=!!P.can_edit; S.me.money=!!P.can_money; S.me.manage=!!P.can_manage; S.me.canLog=!!P.can_log; S.me.name=P.name||""; }
window.addEventListener("prolight:staff",()=>{ applyPerms(PL.me()); for(const p of PL.staff()) S.names.set(p.id,p.name); refresh(); if(S.drawer&&S.drawer.kind==="person"){} });
const PRESETS={ member:{can_log:true,all_crews:false,can_edit:false,can_money:false,can_manage:false}, lead:{can_log:true,all_crews:true,can_edit:false,can_money:false,can_manage:false}, office:{can_log:true,all_crews:true,can_edit:true,can_money:false,can_manage:false}, manager:{can_log:true,all_crews:true,can_edit:true,can_money:true,can_manage:true} };
const PERMS=[["can_log","Check off stops and post notes, photos and video",""],["all_crews","See every crew's jobs","Off: only jobs assigned to their own crew"],["can_edit","Edit jobs, clients, crews and the schedule",""],["can_money","See prices, payouts and the Money tab",""],["can_manage","Add people, change PINs and permissions",""]];
function permSummary(p){ return [p.can_manage&&"Manager",!p.can_manage&&p.can_edit&&"Office",p.can_money&&"Money",p.can_log&&"Checks off",!p.all_crews&&"Own crew only"].filter(Boolean).join(" · ")||"Can only view"; }
function vTeam(){
  const P=PL.staff();
  return `<div class="bar"><p class="lede grow">Everyone who can sign in. Each person picks their name and types their own 6-digit PIN.</p>${S.me.manage?`<button type="button" class="btn amber" data-act="person-new">+ Add person</button>`:""}</div>
  <div class="rows">${P.map(p=>`<button type="button" class="row" data-act="person" data-id="${esc(p.id)}"><span class="bulb ${p.active?"on":"red"}"></span>
    <span class="m"><span class="n">${esc(p.name)}${p.id===S.me.id?" (you)":""}</span><span class="s">${esc(permSummary(p))}</span></span>
    <span class="r"><span class="count" style="font-size:13px">${esc(p.crew?teamName(p.crew):"No crew")}</span>${p.active?"":`<span class="st cancelled">Turned off</span>`}</span></button>`).join("")}</div>
  <div class="note">Quick presets when adding someone: <b>Crew member</b> checks off their crew's stops. <b>Crew lead</b> also sees every crew. <b>Office</b> edits jobs and the schedule. <b>Manager</b> does everything, including money and people.</div>`;
}
function dPerson(){
  const p=S.form.person, isNew=!p.id;
  const crewOpts=`<option value="">No crew</option>${crews().map(c=>`<option value="${esc(c.id)}" ${p.crew===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}`;
  const b=`<form class="form" id="personForm" autocomplete="off">
    <fieldset><legend>Person</legend>
      <div class="f"><label for="pp-name">Name on the sign-in screen</label><input id="pp-name" value="${esc(p.name)}" required placeholder="e.g. Mike R."></div>
      <div class="f"><label for="pp-crew">Crew</label><select id="pp-crew">${crewOpts}</select></div>
      <div class="f"><label for="pp-pin">${isNew?"6-digit PIN":"New PIN (leave blank to keep theirs)"}</label><input id="pp-pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" ${isNew?"required":""} placeholder="${isNew?"":"••••••"}"><small>Give them this PIN in person or by text. They can change it from Account.</small></div>
    </fieldset>
    <fieldset><legend>What they can do</legend>
      <div class="bar">${[["member","Crew member"],["lead","Crew lead"],["office","Office"],["manager","Manager"]].map(([k,l])=>`<button type="button" class="chip" data-act="preset" data-v="${k}">${l}</button>`).join("")}</div>
      <div class="checks">${PERMS.map(([k,l,h])=>`<label><input type="checkbox" id="pp-${k}" ${p[k]?"checked":""}><span>${l}${h?`<small>${h}</small>`:""}</span></label>`).join("")}</div>
    </fieldset>
    ${isNew?"":`<fieldset><legend>Access</legend><div class="checks"><label><input type="checkbox" id="pp-active" ${p.active?"checked":""}><span>Can sign in<small>Turn off when someone leaves. Their check-offs and notes stay on the board.</small></span></label></div></fieldset>`}
    <div class="actions"><span class="count" id="pp-err" style="color:var(--red)"></span><button type="submit" class="btn amber" ${S.busy?"disabled":""}>${isNew?"Add person":"Save changes"}</button></div>
  </form>`;
  return drawerShell(isNew?"Team":"Edit person", isNew?"Add person":p.name, b);
}
async function savePerson(){
  const p=S.form.person, g=id=>document.getElementById(id);
  const out={ id:p.id, name:g("pp-name").value.trim(), crew:g("pp-crew").value, active:p.id?g("pp-active").checked:true };
  for(const [k] of PERMS) out[k]=g("pp-"+k).checked;
  const pin=g("pp-pin").value.trim();
  if(!out.name){ g("pp-err").textContent="Add their name."; return; }
  if((!p.id||pin) && !/^[0-9]{6}$/.test(pin)){ g("pp-err").textContent="The PIN needs exactly 6 digits."; return; }
  S.busy=true;
  try{
    if(!p.id) await PL.add({...out,pin}); else { await PL.update(out); if(pin) await PL.setPin(p.id,pin); }
    S.busy=false; toast(p.id?"Saved":"Added "+out.name); closeDrawer();
  }catch(e){ S.busy=false; g("pp-err").textContent=e.message.replace(/^.*?: /,""); }
}
function dAccount(){
  const me=PL.me()||{};
  return drawerShell("Signed in", me.name||"You", `<p class="lede">${esc(permSummary(me))}${me.crew?" · "+esc(teamName(me.crew)):""}</p>
  <form class="form" id="pinForm" autocomplete="off"><fieldset><legend>Change my PIN</legend><div class="two">
    <div class="f"><label for="np1">New 6-digit PIN</label><input id="np1" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></div>
    <div class="f"><label for="np2">Type it again</label><input id="np2" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required></div></div></fieldset>
    <div class="actions"><button type="button" class="btn danger" data-act="signout">Sign out</button><button type="submit" class="btn amber">Save new PIN</button></div></form>`);
}
async function saveMyPin(){
  const a=$("#np1").value.trim(), b=$("#np2").value.trim();
  if(!/^[0-9]{6}$/.test(a)){ toast("Use exactly 6 digits"); return; }
  if(a!==b){ toast("The two PINs don't match"); return; }
  try{ await PL.setPin(S.me.id,a); toast("PIN changed"); closeDrawer(); }catch(e){ toast("Couldn't change the PIN. Try again."); }
}
function autoGeo(id){
  const j=S.jobs.get(id); if(!j) return; const a=addrOf({...j,id});
  if(!a || (typeof j.lat==="number" && j.geoAddr===a)) return;
  PL.geocode(a).then(r=>{ if(r) S.db.doc("jobs/"+id).update({lat:+(+r.lat).toFixed(5),lng:+(+r.lng).toFixed(5),geo:r.source,geoAddr:a}); }).catch(()=>{});
}
'''
rep('\n/* ---------- render ---------- */\n', TEAM + '\n/* ---------- render ---------- */\n')

ACTIONS = '''    case "account": openDrawer("account"); break;
    case "signout": PL.signOut(); break;
    case "person-new": S.form={person:{name:"",crew:"",active:true,...PRESETS.member}}; openDrawer("person"); break;
    case "person": S.form={person:{...PL.staff().find(p=>p.id===id)}}; openDrawer("person",id); break;
    case "preset": for(const [k,val] of Object.entries(PRESETS[v])){ const el=document.getElementById("pp-"+k); if(el) el.checked=val; } break;
    case "map-find": { const j=S.jobs.get(id); const a=j&&addrOf({...j,id}); if(!a){ toast("This job has no address"); break; } t.disabled=true; const r=await PL.geocode(a).catch(()=>null); if(r){ await S.db.doc("jobs/"+id).update({lat:+(+r.lat).toFixed(5),lng:+(+r.lng).toFixed(5),geo:r.source,geoAddr:a}); toast("Found it"); } else { t.disabled=false; toast("Couldn't find that address. Tap Place to pin it by hand."); } break; }
'''
rep('    case "map-mode": MAP.mode=v; renderMain(); break;\n', ACTIONS + '    case "map-mode": MAP.mode=v; renderMain(); break;\n')

# ---------- street map (Leaflet) ----------
rep('<canvas id="map" aria-label="Map of jobs"></canvas>', '<div id="map" aria-label="Map of jobs"></div>')
rep('''${S.me.owner?`<button type="button" class="btn small" data-act="map-place" data-id="${esc(j.id)}">Place</button>`:""}</div>`).join("")}</div></div>`:""}''',
    '''${S.me.owner?`<span style="display:flex;gap:6px">${addrOf(j)?`<button type="button" class="btn small" data-act="map-find" data-id="${esc(j.id)}">Find</button>`:""}<button type="button" class="btn small" data-act="map-place" data-id="${esc(j.id)}">Place</button></span>`:""}</div>`).join("")}</div></div>`:""}''')
rep('    case "map-zoom": MAP.k*=Number(v)>0?1.6:1/1.6; drawMap(); break;', '    case "map-zoom": if(LMAP) LMAP.setZoom(LMAP.getZoom()+(Number(v)>0?1:-1)); break;')
rep('    case "map-fit": mapFit(); drawMap(); break;', '    case "map-fit": mapFit(); break;')
rep('if(j&&hasLL(j)){ MAP.cx=j.lng; MAP.cy=j.lat; }', 'if(j&&hasLL(j)){ MAP.center=[j.lat,j.lng]; }')
rep('window.addEventListener("resize",()=>{ if(S.view==="map") drawMap(); });', 'window.addEventListener("resize",()=>{ if(S.view==="map"&&LMAP) LMAP.invalidateSize(); });')

LEAFLET = r'''let LMAP=null, LHOLD=null, LAYER=null, LFIT=false;
function mapFit(){
  if(!LMAP) return;
  const pts=mapJobs().filter(hasLL), all=pts.length?pts:jobsArr().filter(hasLL);
  if(!all.length) return;
  const lats=all.map(j=>j.lat).sort((a,b)=>a-b), lngs=all.map(j=>j.lng).sort((a,b)=>a-b);
  const mLat=lats[lats.length>>1], mLng=lngs[lngs.length>>1];
  const core=all.filter(j=>Math.abs(j.lat-mLat)<0.3 && Math.abs(j.lng-mLng)<0.35);
  LMAP.fitBounds(L.latLngBounds((core.length?core:all).map(j=>[j.lat,j.lng])).pad(0.08),{maxZoom:15});
}
function drawMap(){
  if(!LMAP) return;
  LAYER.clearLayers();
  const cs=getComputedStyle(document.documentElement), tok=n=>cs.getPropertyValue(n).trim();
  const list=mapJobs().filter(hasLL), z=LMAP.getZoom();
  if(MAP.mode==="day"){
    for(const c of crews()){ const st=stopsFor(MAP.day,c.id).filter(s=>hasLL(s.j)); if(st.length>1) L.polyline(st.map(s=>[s.j.lat,s.j.lng]),{color:crewColor(c.id),weight:3,dashArray:"6 6",opacity:.9,interactive:false}).addTo(LAYER); }
  }
  const order = MAP.mode==="day" ? new Map(crews().flatMap(c=>stopsFor(MAP.day,c.id).map((s,i)=>[s.j.id,i+1]))) : null;
  for(const j of [...list].sort((a,b)=>(a.id===MAP.sel)-(b.id===MAP.sel))){
    const col=crewColor(j.crew), sel=j.id===MAP.sel, st=status(j);
    const m=L.circleMarker([j.lat,j.lng],{radius:sel?11:8,weight:sel?3:2,color:sel?tok("--ink"):(col?"#ffffff":tok("--ink-2")),fillColor:col||tok("--card"),fillOpacity:1,className:(st==="lit"||st==="down")?"pin-lit":""}).addTo(LAYER);
    m.on("click",e=>{ L.DomEvent.stopPropagation(e); if(MAP.placing) return; MAP.sel=j.id; renderMain(); });
    const lbl=(order&&order.get(j.id)?order.get(j.id)+". ":"")+(clientOf(j).name||"Customer");
    m.bindTooltip(esc(lbl),{permanent:!!(sel||z>=15||order),direction:"right",offset:[10,0],className:"pin-tip"});
  }
  if(MAP.center){ LMAP.panTo(MAP.center); MAP.center=null; }
}
function mountMap(){
  const box=$("#map"); if(!box||!window.L) return;
  if(!LMAP){
    LHOLD=document.createElement("div"); LHOLD.className="lmap";
    LMAP=L.map(LHOLD,{zoomControl:false}).setView([30.46,-84.27],11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(LMAP);
    LAYER=L.layerGroup().addTo(LMAP);
    LMAP.on("click",e=>{
      if(!MAP.placing){ if(MAP.sel){ MAP.sel=null; renderMain(); } return; }
      const id=MAP.placing; MAP.placing=null; MAP.sel=id;
      S.db.doc("jobs/"+id).update({lat:+e.latlng.lat.toFixed(5),lng:+e.latlng.lng.toFixed(5),geo:"manual",geoAddr:addrOf({...(S.jobs.get(id)||{}),id})}).then(()=>toast("Pin placed")).catch(err=>fail(err,"place the pin"));
      renderMain();
    });
    LMAP.on("zoomend",drawMap);
  }
  box.appendChild(LHOLD);
  LHOLD.style.cursor=MAP.placing?"crosshair":"";
  requestAnimationFrame(()=>{ LMAP.invalidateSize(); if(!LFIT && jobsArr().some(hasLL)){ mapFit(); LFIT=true; } drawMap(); });
}
'''
rep_between('function mapFit(){', 'async function mapSchedule(id){', LEAFLET)

exec(open(pathlib.Path(__file__).with_name('logos.py')).read())
exec(open(pathlib.Path(__file__).with_name('features.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase2.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase3.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase4.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase5.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase6.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase7.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase8.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase9.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase10.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase11.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase12.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase13.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase14.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase15.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase16.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase17.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase18.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase19.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase20.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase21.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase22.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase23.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase24.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase25.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase26.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase27.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase28.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase29.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase30.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase31.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase32.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase33.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase34.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase35.py')).read())
exec(open(pathlib.Path(__file__).with_name('phase36.py')).read())
OUT.write_text(s)
print("wrote", OUT, len(s), "bytes")
