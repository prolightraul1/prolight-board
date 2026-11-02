# ProLight + ProWash combo jobs get their own tab on Jobs. Applied after phase29.py.
rep('["tcl","TCL"],["pl","ProLight"],', '["tcl","TCL"],["pl","ProLight"],["combo","ProLight + ProWash"],')
rep('if(f==="tcl") list=list.filter(j=>j.source==="tcl"); if(f==="pl") list=list.filter(j=>j.source!=="tcl");',
    'if(f==="tcl") list=list.filter(j=>j.source==="tcl"); if(f==="pl") list=list.filter(j=>j.source!=="tcl"); if(f==="combo") list=list.filter(isCombo);')
rep('const tag=`<span class="lbl ${j.source==="tcl"?"tcl":"pl"}">${esc(label(j))}</span>`;',
    'const tag=`<span class="lbl ${j.source==="tcl"?"tcl":"pl"}">${esc(label(j))}</span>${isCombo(j)&&!crewView()?`<span class="lbl wash">+ ProWash</span>`:""}`;')
rep('\n/* ---------- render ---------- */\n', '''
const isCombo = j => (+j.washTotal||0)>0 || /ProWash work/i.test(j.notes||"");
''' + '\n/* ---------- render ---------- */\n')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.lbl.wash{background:#e3f1fb;color:#0c5a8a;margin-left:4px}')
