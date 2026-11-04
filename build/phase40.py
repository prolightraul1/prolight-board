# ProWash HQ install export card in Office → Settings. Applied after phase39.py.
P40 = open(pathlib.Path(__file__).with_name('phase40.js')).read()
rep('\n/* ---------- render ---------- */\n', P40 + '\n/* ---------- render ---------- */\n')
rep('vSettings()+backupCard()', 'vSettings()+backupCard()+hqCard()')
