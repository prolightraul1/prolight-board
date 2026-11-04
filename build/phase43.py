# Readable money chips in dark mode: fee chip used the dark "ink on amber" color, and greens were too dim. Applied after phase42.py.
rep('.lbl:empty{display:none}', '''.lbl:empty{display:none}
:root{--ok:#1f8a4c}
:root[data-theme="dark"]{--ok:#5fd08e}
body .fee-chip{color:var(--amber-text,#ffcf78);border-color:var(--amber,#f5b83d)}
body .fee-chip.ok{color:var(--ok);border-color:var(--ok)}''')
