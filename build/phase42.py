# Removing a crew from a job also clears it when it is a visit's own crew. Applied after phase41.py.
P42 = open(pathlib.Path(__file__).with_name('phase42.js')).read()
rep('\n/* ---------- render ---------- */\n', P42 + '\n/* ---------- render ---------- */\n')
