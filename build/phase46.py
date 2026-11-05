# Custom pay split per job. Applied after phase45.py.
P46 = open(pathlib.Path(__file__).with_name('phase46.js')).read()
rep('\n/* ---------- render ---------- */\n', P46 + '\n/* ---------- render ---------- */\n')
rep('<h3 class="h-sec">Money</h3>${myFeeBlock(j)}${tclHistory(j)}${jbSyncLine(j)}', '<h3 class="h-sec">Money</h3>${myFeeBlock(j)}${customPayBlock(j)}${tclHistory(j)}${jbSyncLine(j)}')
rep('    case "pins": await openPins(); break;', '''    case "pins": await openPins(); break;
    case "cpay-open": S.form=S.form||{}; S.form.cpay=id; renderDrawer(); break;
    case "cpay-close": if(S.form) S.form.cpay=null; renderDrawer(); break;
    case "cpay-save": await customPaySave(id,false); break;
    case "cpay-clear": await customPaySave(id,true); break;''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.cpay{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0}.cpay>.bar{gap:6px 10px}
.cp-row{display:grid;grid-template-columns:minmax(0,1fr) auto 90px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line)}.cp-row small{display:block;color:var(--ink-2);font-size:12px}.cp-row b{text-align:right}''')
