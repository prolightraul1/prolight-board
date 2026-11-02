# Raul's management fee on every job (his login only). Applied after phase24.py.
P25 = open(pathlib.Path(__file__).with_name('phase25.js')).read()
rep('\n/* ---------- render ---------- */\n', P25 + '\n/* ---------- render ---------- */\n')
rep('<span class="m"><span class="n">${esc(c.name||"Customer")}</span><span class="s">${tag}', '<span class="m"><span class="n">${esc(c.name||"Customer")}${myFeeChip(j)}</span><span class="s">${tag}')
rep('b+=`<section class="blk blk-money"><h3 class="h-sec">Money</h3>', 'b+=`<section class="blk blk-money"><h3 class="h-sec">Money</h3>${myFeeBlock(j)}')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.fee-chip{display:inline-block;margin-left:8px;padding:1px 7px;border-radius:999px;border:1px solid var(--amber,#f5b83d);color:var(--amber-ink,#9a6200);font:600 12px/1.5 var(--mono,ui-monospace,monospace);vertical-align:middle;white-space:nowrap}
.fee-chip.ok{border-color:var(--ok,#1f8a4c);color:var(--ok,#1f8a4c)}
.fee-blk{border:1px solid var(--amber,#f5b83d);border-radius:14px;padding:10px 14px;margin-bottom:10px}.fee-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:4px}.fee-row b{font-size:24px}.fee-row span{color:var(--ink-2)}
.fee-sum{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;margin:10px 0;padding:10px 14px;border:1px solid var(--amber,#f5b83d);border-radius:14px}.fee-sum b{font-size:18px}''')
rep('  h+=`<span class="count">${list.length} job${list.length===1?"":"s"}</span>`;\n  h+= list.length ? jobHead()', '  h+=`<span class="count">${list.length} job${list.length===1?"":"s"}</span>`+myFeeTotals(list);\n  h+= list.length ? jobHead()')
rep('  if(t.id==="act-who"){', '  if(t.dataset&&t.dataset.selfInstall){ await setSelfInstall(t.dataset.selfInstall,t.checked); return; }\n  if(t.id==="act-who"){')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.fee-self{display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:600}.fee-self small{color:var(--ink-2);font-weight:500}.fee-chip.self{border-color:var(--ok,#1f8a4c)}')
