# Undoing a Jobber-made check-off is remembered so the sync won't re-add it. Applied after phase55.py.
P56 = open(pathlib.Path(__file__).with_name('phase56.js')).read()
rep('\n/* ---------- render ---------- */\n', P56 + '\n/* ---------- render ---------- */\n')
