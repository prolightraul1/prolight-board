# Spanish: remaining screens + translated notes/chat. Applied after phase22.py.
P23 = open(pathlib.Path(__file__).with_name('phase23.js')).read()
rep('\n/* ---------- render ---------- */\n', P23 + '\n/* ---------- render ---------- */\n')
rep('${j.scope?`<span><b>Lights</b>${esc(j.scope)}</span>`:""}', '${j.scope?`<span><b>Lights</b><span data-tr>${esc(j.scope)}</span></span>`:""}')
rep('${j.tclWhen?" · "+esc(j.tclWhen):""}</small>', '${j.tclWhen?` · <span data-tr>${esc(j.tclWhen)}</span>`:""}</small>')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.tr-tog{display:inline-block;margin:4px 0 2px;padding:2px 8px;border:1px solid var(--line,#ccd);border-radius:999px;background:none;color:var(--ink-2,#566);font:600 12px/1.4 inherit;cursor:pointer}')
