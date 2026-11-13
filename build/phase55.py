# Deleting a Jobber-linked job records it so the Jobber sync won't re-import it. Applied after phase54.py.
P55 = open(pathlib.Path(__file__).with_name('phase55.js')).read()
rep('\n/* ---------- render ---------- */\n', P55 + '\n/* ---------- render ---------- */\n')
