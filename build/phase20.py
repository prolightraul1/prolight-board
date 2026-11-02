# Light mockup studio (only people who sell jobs). Applied after phase19.py.
P20 = open(pathlib.Path(__file__).with_name('phase20.js')).read()
rep('\n/* ---------- render ---------- */\n', P20 + '\n/* ---------- render ---------- */\n')
# job panel: make one, and edit the ones made here
rep('    ${S.me.owner&&S.assets?`<div><label class="btn file-btn">+ Add mockup', '    ${canMock()?`<div class="bar mk-cta"><button type="button" class="btn amber" data-act="mockup" data-id="${esc(id)}">✨ Light mockup</button><small>Draw lights on a photo of the house</small></div>`:""}${S.me.owner&&S.assets?`<div><label class="btn file-btn">+ Add mockup')
rep('<div class="gal-item">${mediaTag(m)}', '<div class="gal-item">${mediaTag(m)}${m.studio&&canMock()?`<button type="button" class="mk-edit" data-act="mockup" data-id="${esc(id)}" data-v="${esc(m.id)}">✎ Edit</button>`:""}')
# Jobs and Today headers
rep('+ New job</button>`:""}</div>', '+ New job</button>`:""}${canMock()?`<button type="button" class="btn" data-act="mockup">✨ Mockup</button>`:""}</div>', 2)
rep('    case "pins": await openPins(); break;', '    case "mockup": await openMockup(id||"",v); break;\n    case "pins": await openPins(); break;')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
#mockRoot{position:fixed;inset:0;z-index:2400;background:#0b0f0d;color:#eaf0eb;display:flex;flex-direction:column;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);font-size:14px}
#mockRoot[hidden]{display:none}
body.in-mock .toast{z-index:2600!important;top:calc(64px + env(safe-area-inset-top,0px));bottom:auto}
#mockRoot .seg{background:transparent;border:0;box-shadow:none;padding:0;gap:0}
body.in-mock{overflow:hidden}
#mockRoot .btn{background:#1d2622;color:#eaf0eb;border-color:#33403a}
#mockRoot .btn.amber{background:var(--amber,#f5b83d);color:#1a1405;border-color:transparent}
#mockRoot .btn.danger{color:#ff8a80}
#mockRoot .btn[aria-pressed=true]{background:#eaf0eb;color:#111916}
#mockRoot .btn:disabled{opacity:.45}
#mockRoot input:not([type]),#mockRoot input[type=number],#mockRoot select{background:#141b18;color:#eaf0eb;border:1px solid #33403a;border-radius:10px;padding:8px 10px;font:inherit;width:100%;box-sizing:border-box}
.mk-top{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#111916;border-bottom:1px solid #222c28;flex:none}
.mk-top .grow{flex:1;min-width:0}
.mk-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-body{flex:1;min-height:0;display:flex;flex-direction:column}
.mk-stage{position:relative;flex:1;min-height:0;touch-action:none;overflow:hidden}
.mk-stage canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}
.mk-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px}
.mk-zoom button{width:38px;height:38px;border-radius:10px;border:1px solid #33403a;background:rgba(17,25,22,.85);color:#fff;font-size:18px;font-weight:700}
.mk-panel{flex:none;max-height:44vh;overflow:auto;padding:12px 14px 16px;background:#111916;border-top:1px solid #222c28;-webkit-overflow-scrolling:touch}
@media (min-width:900px){.mk-body{flex-direction:row}.mk-panel{width:340px;max-height:none;border-top:0;border-left:1px solid #222c28}}
@media (max-width:520px){.mk-hide-sm{display:none}}
.mk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;font-size:15px}
.mk-f{display:block;margin:0 0 14px}
.mk-lbl{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#9fb0a7;margin:0 0 6px}
.mk-lbl b{color:#eaf0eb;text-transform:none;letter-spacing:0;float:right}
.mk-f input[type=range]{width:100%;accent-color:#f5b83d}
.mk-note{color:#b7c4bd;font-size:13px;margin:0 0 8px}
.mk-kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px}
.mk-kind{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;border:1px solid #2b3632;background:#18211d;color:#eaf0eb;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer}
.mk-kind:hover{border-color:#f5b83d}
.mk-kind i{font-style:normal;width:20px;text-align:center;color:#f5b83d}
.mk-sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-bottom:10px}
.mk-set{display:flex;align-items:center;gap:7px;padding:7px 8px;border-radius:9px;border:1px solid #2b3632;background:#18211d;color:#eaf0eb;font:inherit;font-size:12px;cursor:pointer;text-align:left}
.mk-set[aria-pressed=true]{border-color:#f5b83d;box-shadow:0 0 0 1px #f5b83d inset}
.mk-set i,.mk-li i{display:inline-flex;gap:2px;flex:none}
.mk-set b,.mk-li b{width:9px;height:9px;border-radius:50%;box-shadow:0 0 6px currentColor}
.mk-seq{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:30px}
.mk-dot{width:30px;height:30px;border-radius:50%;border:2px solid #0b0f0d;outline:1px solid #445049;color:transparent;font-weight:900;cursor:pointer}
.mk-dot:hover{color:#111}
.mk-pal{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}
.mk-sw{width:28px;height:28px;border-radius:8px;border:1px solid #445049;cursor:pointer;position:relative;display:inline-grid;place-items:center}
.mk-cust{background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);color:#fff;font-weight:900;text-shadow:0 0 3px #000}
.mk-cust input{position:absolute;inset:0;opacity:0;cursor:pointer}
.mk-chk{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:13px}
.mk-seg{display:flex;flex-wrap:wrap}
#mockRoot .seg button{background:#18211d;color:#eaf0eb;border:1px solid #2b3632;padding:7px 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
#mockRoot .seg button:first-child{border-radius:9px 0 0 9px}#mockRoot .seg button:last-child{border-radius:0 9px 9px 0}
#mockRoot .seg button[aria-pressed=true]{background:#f5b83d;color:#1a1405;border-color:#f5b83d}
.mk-list{display:flex;flex-direction:column;gap:4px}
.mk-li{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;border:1px solid #2b3632;background:#18211d;color:#eaf0eb;font:inherit;font-size:13px;text-align:left;cursor:pointer}
.mk-tab{width:100%;border-collapse:collapse;font-size:13px}.mk-tab td{padding:5px 0;border-bottom:1px solid #222c28}.mk-tab td:last-child{text-align:right}
.mk-acts{flex-wrap:wrap;gap:6px}
.mk-start{flex:1;display:grid;place-items:center;padding:20px;overflow:auto}
.mk-start-in{max-width:520px}.mk-start h2{margin:0 0 8px;font-size:22px}.mk-start .lede{color:#b7c4bd}
.mk-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.mk-pics button{padding:0;border:1px solid #33403a;border-radius:10px;overflow:hidden;background:none;cursor:pointer;aspect-ratio:4/3}
.mk-pics img{width:100%;height:100%;object-fit:cover;display:block}
.mk-cta{align-items:center;gap:10px;margin:8px 0}.mk-cta small{color:var(--ink-2)}
.gal-item{position:relative}
.mk-edit{position:absolute;left:6px;bottom:6px;border:0;border-radius:8px;padding:5px 9px;background:rgba(17,25,22,.85);color:#fff;font-weight:700;font-size:12px;cursor:pointer}''')
