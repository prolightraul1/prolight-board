# iPhone home-screen app keyboard shrink fix. Applied after phase33.py.
P34 = open(pathlib.Path(__file__).with_name('phase34.js')).read()
rep('\n/* ---------- render ---------- */\n', P34 + '\n/* ---------- render ---------- */\n')
