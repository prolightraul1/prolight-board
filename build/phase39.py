# TCL change history in the job drawer; push toggle for TCL updates. Applied after phase38.py.
P39 = open(pathlib.Path(__file__).with_name('phase39.js')).read()
rep('\n/* ---------- render ---------- */\n', P39 + '\n/* ---------- render ---------- */\n')
rep('<h3 class="h-sec">Money</h3>${myFeeBlock(j)}', '<h3 class="h-sec">Money</h3>${myFeeBlock(j)}${tclHistory(j)}${jbSyncLine(j)}')
rep('const NOTE_KINDS = () => [', 'const NOTE_KINDS = () => [...(typeof isRaul==="function"&&isRaul()?[["tcl",LANG_ES?"Cambios de TCL (colores, precios, trabajos nuevos)":"TCL changes (colors, prices, new jobs)"]]:[]),')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.tcl-hist{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0;display:grid;gap:6px}
.th-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:baseline;font-size:14px}.th-row span{color:var(--ink-2);overflow-wrap:anywhere}.th-row small{color:var(--ink-2)}''')
