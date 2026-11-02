# Week: work + Raul's pay for the week. Applied after phase30.py.
P31 = open(pathlib.Path(__file__).with_name('phase31.js')).read()
rep('\n/* ---------- render ---------- */\n', P31 + '\n/* ---------- render ---------- */\n')
rep('  h+=wkTray();', '  h+=`<div class="wk-top">${weekWork(days)}</div>`+wkTray();')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.wk-top{display:grid;gap:12px;margin:10px 0 14px}@media (min-width:960px){.wk-top{grid-template-columns:1fr 1fr}.wk-top .tw,.wk-top .tw-me{margin:0}}
.wk-pay{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:4px 0 10px}
.wkp{display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;padding:4px 0;cursor:pointer;color:inherit;font:inherit}
.wkp .bars{display:flex;flex-direction:column-reverse;justify-content:flex-start;width:70%;height:56px;border-radius:6px;background:var(--line);overflow:hidden}
.wkp .bars i{display:block;width:100%}.wkp .bars .done{background:var(--ok,#1f8a4c)}.wkp .bars .left{background:var(--amber,#f5b83d);opacity:.7}
.wkp small{color:var(--ink-2);font-size:11px}.wkp b{font-size:12px}''')
