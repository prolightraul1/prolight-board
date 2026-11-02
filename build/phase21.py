# Delete and reorder crews. Applied after phase20.py.
P21 = open(pathlib.Path(__file__).with_name('phase21.js')).read()
rep('\n/* ---------- render ---------- */\n', P21 + '\n/* ---------- render ---------- */\n')
rep('${C.map(c=>`<div class="vedit"><div class="full"><span class="lbl ${c.co==="shipshape"?"":"pl"}">${c.co==="shipshape"?"ShipShape":"ProLight"}</span>${C.filter(x=>x.co===c.co).length>1&&!used(c.id)?`<button type="button" class="btn small danger" data-act="rm-crew" data-v="${esc(c.id)}">Remove crew</button>`:""}</div>',
    '${C.map((c,ci)=>`<div class="vedit"><div class="full crew-head"><span class="lbl ${c.co==="shipshape"?"":"pl"}">${c.co==="shipshape"?"ShipShape":"ProLight"}</span>${crewCtl(c,ci,C)}</div>')
rep('    case "rm-crew": await writeCrews(collectCrews().filter(c=>c.id!==v),"Crew removed"); break;',
    '    case "rm-crew": S.crewDel=v; renderMain(); break;\n    case "rm-crew-no": S.crewDel=null; renderMain(); break;\n    case "rm-crew-yes": t.disabled=true; await deleteCrew(v); break;\n    case "crew-move": { const [cid,d]=v.split("|"); await moveCrew(cid,+d); break; }')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.crew-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.crew-ctl{display:inline-flex;gap:6px;margin-left:auto}')
