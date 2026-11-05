# Pay plan picker when adding/editing a person; Pay plans editor keeps split rules. Applied after phase44.py.
P45 = open(pathlib.Path(__file__).with_name('phase45.js')).read()
rep('\n/* ---------- render ---------- */\n', P45 + '\n/* ---------- render ---------- */\n')
rep('''    ${isNew?"":`<fieldset><legend>Access</legend>''', '''    ${payPickUI(p)}
    ${isNew?"":`<fieldset><legend>Access</legend>''')
rep('''  const pin=g("pp-pin").value.trim(), title0=(g("pp-title")||{value:""}).value.trim();''', '''  const pin=g("pp-pin").value.trim(), title0=(g("pp-title")||{value:""}).value.trim(), pay0=readPayPick();''')
rep('''    { const t=title0, who2=''', '''    { const pid=p.id||(PL.staff().find(x=>x.name===out.name)||{}).id; if(pay0&&pid) await writePlan(pid,pay0); }
    { const t=title0, who2=''')
rep('    case "pins": await openPins(); break;', '''    case "pins": await openPins(); break;
    case "pay-kind": { readPayPick(); S.form.pay.kind=v; const fs=document.getElementById("payPick"); if(fs) fs.outerHTML=payPickUI(S.form.person); break; }''')
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
.seg-wrap{flex-wrap:wrap}.pp-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.pp-row small{flex-basis:100%;color:var(--ink-2)}
.pp-num{display:inline-flex;align-items:center;gap:4px}.pp-num input{width:64px;min-height:36px;text-align:right}''')
