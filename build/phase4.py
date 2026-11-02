# Looks: custom bulb colors, day/night, startup lights, done pops, route lit, season header, snow, night map.
P4 = open(pathlib.Path(__file__).with_name('phase4.js')).read()
rep('\n/* ---------- render ---------- */\n', P4 + '\n/* ---------- render ---------- */\n')

rep('toast("Marked done"); }catch', 'toast("Marked done"); celebrate(jobId,visitId); }catch')
rep('<div class="rail-c"><span class="bulb lg ${d?"on":""}"></span></div>', '<div class="rail-c"><span class="bulb lg ${d?"on":""}${popCls(j,v)}"></span></div>')
rep('  let h=annBanner()+`<div class="dayhead">', '  let h=annBanner()+(S.ready?seasonBar():"")+`<div class="dayhead">')
rep('  <div class="f"><label>Directions open in</label>', '  ${lookPanel()}\n  <div class="f"><label>Directions open in</label>')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "look-combo": setLook({colors:[...COMBOS[+v][1]]}); renderDrawer(); renderMain(); break;
    case "look-color": { const c=look().colors.slice(), i=c.indexOf(v); if(i>=0){ if(c.length>1) c.splice(i,1); } else c.push(v); setLook({colors:c}); renderDrawer(); renderMain(); break; }
    case "look-mode": setLook({mode:v}); renderDrawer(); renderMain(); if(S.view==="map"&&typeof drawMap==="function") drawMap(); break;
    case "look-intro": setLook({intro:v}); renderDrawer(); break;
    case "look-play": playIntro(true); break;
    case "look-snow": setLook({snow:!look().snow}); renderDrawer(); break;
    case "look-buzz": setLook({buzz:!look().buzz}); renderDrawer(); buzz(30); break;
''')
# night map: lit houses glow in your bulb colors
rep('fillColor:col||tok("--card"),fillOpacity:1,className:(st==="lit"||st==="down")?"pin-lit":""}',
    'fillColor:(st==="lit"&&effectiveDark())?bulbColors()[list.indexOf(j)%bulbColors().length]:(col||tok("--card")),fillOpacity:1,className:st==="lit"?"pin-lit":(st==="down"?"pin-down":"")}')
rep('.pin-lit{filter:drop-shadow(0 0 5px #f2a516)}', '.pin-lit{filter:drop-shadow(0 0 5px var(--amber))} .night-map .pin-lit{filter:drop-shadow(0 0 7px currentColor) drop-shadow(0 0 14px var(--amber))} .night-map .pin-down{opacity:.55}')

rep('.bulb.on{--b:var(--amber);--glow:0 0 10px 2px color-mix(in srgb,var(--amber) 60%,transparent),0 0 24px 6px color-mix(in srgb,var(--amber) 22%,transparent)}',
    '.bulb.on{--b:var(--bc,var(--amber));--glow:0 0 10px 2px color-mix(in srgb,var(--bc,var(--amber)) 60%,transparent),0 0 24px 6px color-mix(in srgb,var(--bc,var(--amber)) 22%,transparent)}')

rep('.who-btn{', '''/* looks */
.bulb.pop::after{animation:pop 1.1s cubic-bezier(.2,.9,.3,1.3)}
@keyframes pop{0%{transform:scale(.6);filter:brightness(.6)}35%{transform:scale(1.45);filter:brightness(1.8);box-shadow:0 0 18px 8px var(--bc,var(--amber)),0 0 46px 18px color-mix(in srgb,var(--bc,var(--amber)) 40%,transparent)}100%{transform:scale(1);filter:none}}
#intro,#routelit{position:fixed;inset:0;z-index:300;display:grid;place-items:center;align-content:center;gap:10px;background:radial-gradient(ellipse at 50% 45%,#16241d 0,#080c0a 70%);color:#eaf0eb;transition:opacity .45s;cursor:pointer;overflow:hidden}
#routelit{background:color-mix(in srgb,#080c0a 82%,transparent);backdrop-filter:blur(3px)}
#intro.out,#routelit.out{opacity:0;pointer-events:none}
.intro-strand,.rl-strand{position:relative;width:min(92vw,900px);aspect-ratio:900/160}
.rl-strand{width:min(88vw,700px);aspect-ratio:700/120}
.intro-cord,.rl-cord{position:absolute;inset:0;width:100%;height:100%}
.intro-cord path,.rl-cord path{stroke-dasharray:1400;stroke-dashoffset:1400;animation:cord .5s ease-out forwards}
@keyframes cord{to{stroke-dashoffset:0}}
.ib{position:absolute;width:22px;height:32px;margin:-4px 0 0 -11px;transform-origin:50% 0}
.ib::before{content:"";position:absolute;left:6px;top:0;width:10px;height:9px;border-radius:2px 2px 0 0;background:#2a6e4e}
.ib::after{content:"";position:absolute;left:0;top:8px;width:22px;height:24px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:#34413b;animation:on .35s ease-out forwards;animation-delay:calc(.45s + var(--d)*.09s)}
@keyframes on{0%{background:#34413b}60%{background:#fff;box-shadow:0 0 30px 12px var(--bc)}100%{background:radial-gradient(circle at 35% 30%,#fff8 0 18%,transparent 19%),var(--bc);box-shadow:0 0 14px 4px color-mix(in srgb,var(--bc) 70%,transparent),0 0 40px 14px color-mix(in srgb,var(--bc) 30%,transparent)}}
.intro-logo{width:min(64vw,300px);height:auto;opacity:0;animation:fadein .5s ease-out 1.25s forwards;filter:drop-shadow(0 0 18px color-mix(in srgb,var(--amber) 40%,transparent))}
.intro-sub,.rl-s{font-family:var(--f-mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a9b93;opacity:0;animation:fadein .4s ease-out 1.45s forwards}
.rl-t{font-family:var(--f-sign);font-weight:900;font-size:clamp(44px,12vw,84px);line-height:1;color:var(--amber);text-transform:uppercase;letter-spacing:.02em;text-shadow:0 0 24px color-mix(in srgb,var(--amber) 55%,transparent);opacity:0;animation:fadein .4s ease-out 1.2s forwards}
.rl-s{animation-delay:1.35s}
@keyframes fadein{to{opacity:1}}
@media (prefers-reduced-motion: reduce){ .ib::after,.intro-cord path,.rl-cord path,.intro-logo,.intro-sub,.rl-t,.rl-s{animation-duration:.01s!important;animation-delay:0s!important} .bulb.pop::after{animation:none} }
canvas.snow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}
#gate .gate-card{position:relative;z-index:1}
.season{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 14px;background:var(--night);color:var(--night-ink);border-radius:var(--r);padding:10px 14px;margin-bottom:12px}
.season-t{position:relative;z-index:1;font-family:var(--f-sign);font-weight:800;font-size:19px;letter-spacing:.03em;text-transform:uppercase}
.season-strand{position:relative;z-index:1;display:flex;gap:5px;align-items:flex-start;flex-wrap:wrap}
.season-strand .bulb{width:10px;height:15px}
.season-strand .bulb::before{left:3px;width:4px;height:4px}
.season-strand .bulb::after{top:4px;width:10px;height:11px}
.season.after .season-t{color:var(--night-dim)}
.look-combos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.look-combo{display:flex;align-items:center;gap:8px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:8px 10px;font-size:14px}
.look-combo[aria-pressed="true"],.look-color[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.look-swatch{display:inline-flex;gap:3px;flex:none}
.look-swatch i,.look-color i{display:inline-block;width:11px;height:16px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:var(--c);box-shadow:0 0 6px 1px color-mix(in srgb,var(--c) 55%,transparent);font-style:normal}
.look-colors{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.look-color{display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 11px;font-size:14px}
.look-color b{font-family:var(--f-mono);font-size:11px;background:var(--ink);color:var(--bg);border-radius:9px;min-width:16px;text-align:center;padding:0 4px}
.look .seg{display:flex;flex-wrap:wrap} .look .seg button{flex:1 1 auto}
.night-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.82) contrast(.92) saturate(.6)}
.night-map .leaflet-container{background:#0b100e}
.who-btn{''')
rep('try{ await PL.setPin(S.me.id,a); toast("PIN changed"); closeDrawer(); }catch(e){ toast("Couldn\'t change the PIN. Try again."); }',
    'try{ await PL.setPin(S.me.id,a); toast("PIN changed"); closeDrawer(); }catch(e){ toast(/taken/i.test(e.message)?"That PIN is already taken. Pick a different one.":"Couldn\'t change the PIN. Try again."); }')

# headshots and titles
rep('  $("#whoTop").innerHTML = `<button type="button" class="who-btn" data-act="account">${esc(S.me.name||"Me")}</button>`;',
    '  $("#whoTop").innerHTML = `<button type="button" class="who-btn" data-act="account">${avatar(S.me.id,"sm")}${esc((S.me.name||"Me").split(" ")[0])}</button>`;')
rep('<div class="bub ${mine?"me":""}">${mine?"":`<b>${esc(who(m.by))}</b>`}', '<div class="bub ${mine?"me":""}">${mine?"":`<b>${avatar(m.by,"xs")}${esc(who(m.by))}</b>`}')
rep('<button type="button" class="row" data-act="person" data-id="${esc(p.id)}"><span class="bulb ${p.active?"on":"red"}"></span>\n    <span class="m"><span class="n">${esc(p.name)}${p.id===S.me.id?" (you)":""}</span><span class="s">${esc(permSummary(p))}</span></span>',
    '<button type="button" class="row" data-act="person" data-id="${esc(p.id)}">${avatar(p.id)}\n    <span class="m"><span class="n">${esc(p.name)}${p.id===S.me.id?" (you)":""}</span><span class="s">${esc([p.title,permSummary(p)].filter(Boolean).join(" · "))}</span></span>')
rep('Each person picks their name and types their own 6-digit PIN.', 'Each person signs in with their own 6-digit PIN. No two people can have the same one.')
rep('      <div class="f"><label for="pp-name">Name on the sign-in screen</label><input id="pp-name" value="${esc(p.name)}" required placeholder="e.g. Mike R."></div>',
    '''      <div class="f"><label for="pp-name">Name</label><input id="pp-name" value="${esc(p.name)}" required placeholder="e.g. Mike R."><small>Their first name shows on the welcome screen.</small></div>
      <div class="f"><label for="pp-title">Title</label><input id="pp-title" value="${esc(p.title||"")}" placeholder="e.g. Crew Lead"></div>
      ${p.id?`<div class="f"><label>Headshot</label><div class="bar">${avatar(p.id,"lg")}<label class="btn small file-btn">${p.photo?"Change photo":"Add photo"}<input type="file" accept="image/*" data-photo-for="${esc(p.id)}" hidden></label></div></div>`:""}''')
rep('    if(!p.id) await PL.add({...out,pin}); else { await PL.update(out); if(pin) await PL.setPin(p.id,pin); }',
    '''    if(!p.id) await PL.add({...out,pin}); else { await PL.update(out); if(pin) await PL.setPin(p.id,pin); }
    { const t=g("pp-title").value.trim(), who2=p.id||(PL.staff().find(x=>x.name===out.name)||{}).id; if(who2 && t!==((PL.staff().find(x=>x.id===who2)||{}).title||"")) await PL.setTitle(who2,t); }''')
rep('  ${lookPanel()}\n', '''  <div class="f"><label>My headshot</label><div class="bar">${avatar(S.me.id,"lg")}<label class="btn small file-btn">${(staffOf(S.me.id)||{}).photo?"Change photo":"Add photo"}<input type="file" accept="image/*" data-photo-for="${esc(S.me.id)}" hidden></label></div>${(PL.me()||{}).title?`<small>${esc(PL.me().title)}</small>`:""}</div>
  ${lookPanel()}
''')
rep('  if(t.id==="compose-files"){', '  if(t.dataset&&t.dataset.photoFor){ await changePhoto(t.files[0], t.dataset.photoFor); return; }\n  if(t.id==="compose-files"){')

rep('.who-btn{', '''.ava{display:inline-grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden;background:var(--night-2);color:var(--night-ink);font-family:var(--f-sign);font-weight:800;font-size:16px;box-shadow:0 0 0 2px var(--amber)}
.ava img{width:100%;height:100%;object-fit:cover}
.ava.sm{width:24px;height:24px;font-size:12px;margin-right:6px;vertical-align:middle;box-shadow:0 0 0 1.5px var(--amber)}
.ava.xs{width:18px;height:18px;font-size:10px;margin-right:5px;vertical-align:-4px;box-shadow:none}
.ava.lg{width:56px;height:56px;font-size:24px}
.who-btn{display:inline-flex;align-items:center}
#welcome{position:fixed;inset:0;z-index:310;display:grid;place-items:center;align-content:center;gap:14px;background:radial-gradient(ellipse at 50% 42%,#1a2b22 0,#080c0a 72%);color:#eaf0eb;transition:opacity .45s;cursor:pointer;text-align:center;padding:24px}
#welcome.out{opacity:0;pointer-events:none}
.w-ring{position:relative;width:min(62vw,250px);aspect-ratio:1;margin-bottom:10px}
.w-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.w-ring svg circle{stroke-dasharray:320;stroke-dashoffset:320;animation:cord .55s ease-out forwards}
.w-face{position:absolute;inset:13%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#16241d;font-family:var(--f-sign);font-weight:900;font-size:64px;color:var(--amber);box-shadow:0 0 0 3px #0b100e,0 0 40px 6px color-mix(in srgb,var(--amber) 25%,transparent);opacity:0;animation:fadein .5s ease-out .3s forwards}
.w-face img{width:100%;height:100%;object-fit:cover}
.wb{position:absolute;width:20px;height:28px;margin:-6px 0 0 -10px;transform:rotate(var(--r));transform-origin:50% 6px}
.wb::before{content:"";position:absolute;left:5px;top:0;width:10px;height:8px;border-radius:2px 2px 0 0;background:#2a6e4e}
.wb::after{content:"";position:absolute;left:0;top:7px;width:20px;height:21px;border-radius:50% 50% 50% 50%/38% 38% 62% 62%;background:#34413b;animation:on .35s ease-out forwards;animation-delay:calc(.45s + var(--d)*.07s)}
.w-hi{font-family:var(--f-sign);font-weight:900;font-size:clamp(40px,11vw,72px);line-height:1;text-transform:uppercase;letter-spacing:.02em;color:#fff;text-shadow:0 0 22px color-mix(in srgb,var(--amber) 50%,transparent);opacity:0;animation:fadein .45s ease-out 1.25s forwards}
.w-title{font-family:var(--f-mono);font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a9b8b0;opacity:0;animation:fadein .4s ease-out 1.45s forwards}
@media (prefers-reduced-motion: reduce){ .wb::after,.w-face,.w-hi,.w-title,.w-ring svg circle{animation-duration:.01s!important;animation-delay:0s!important} }
.head-prev{width:150px;height:150px;border-radius:50%;overflow:hidden;display:grid;place-items:center;margin:6px auto;background:var(--night-2);font-family:var(--f-sign);font-weight:900;font-size:60px;color:var(--amber);box-shadow:0 0 0 3px var(--amber)}
.head-prev img{width:100%;height:100%;object-fit:cover}
.head-pick{display:grid;place-items:center;text-align:center;cursor:pointer;min-height:48px}
.who-btn{''')
