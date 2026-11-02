# Today: work progress + Raul's pay today. Applied after phase23.py.
P24 = open(pathlib.Path(__file__).with_name('phase24.js')).read()
rep('\n/* ---------- render ---------- */\n', P24 + '\n/* ---------- render ---------- */\n')
rep('  h+=`<div class="dgrid">', '  h+=todayWork(d)+`<div class="dgrid">')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.tw{margin-bottom:14px}.tw-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 10px}
.tw-tile{border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}.tw-tile b{font-size:32px;line-height:1.1}.tw-tile span{color:var(--ink-2);font-size:13px}
.tw-tile.ok b{color:var(--ok,#1f8a4c)}.tw-tile.left b{color:var(--amber,#f5b83d)}
.tw-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden}.tw-bar i{display:block;height:100%;background:var(--ok,#1f8a4c);border-radius:99px}
.tw-crews{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:14px}.tw-crews .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.tw-me{margin-bottom:14px;border-color:var(--amber,#f5b83d)}.tw-pay{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:6px 0 10px}.tw-big small{display:block;color:var(--ink-2);font-size:13px}.tw-big b{font-size:30px}
@media (max-width:520px){.tw-tile b{font-size:24px}.tw-pay{grid-template-columns:1fr}}''')
# photo viewer: fit the whole photo on screen; tap the photo to see it full size and scroll around
rep('''    case "zoom": $("#lightRoot").innerHTML=`<div class="lightbox" data-act="unzoom"><img src="${esc(t.dataset.src)}" alt=""><button type="button" class="btn small" data-act="unzoom">Close</button></div>`; break;''',
    '''    case "zoom": $("#lightRoot").innerHTML=`<div class="lightbox" data-act="unzoom"><img src="${esc(t.dataset.src)}" alt="" data-act="lb-zoom" title="Tap to zoom"><button type="button" class="btn small" data-act="unzoom">Close</button></div>`; break;
    case "lb-zoom": { const lb=t.closest(".lightbox"); lb.classList.toggle("lb-full"); if(lb.classList.contains("lb-full")){ const r=t.getBoundingClientRect(); lb.scrollTo((t.naturalWidth-innerWidth)/2,0); } break; }''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.lightbox{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.lightbox img{max-width:100%;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);cursor:zoom-in}
.lightbox.lb-full{display:block;padding:0}.lightbox.lb-full img{max-width:none;max-height:none;width:auto;cursor:zoom-out;display:block;margin:0 auto}
.lightbox button{position:fixed!important}''')
