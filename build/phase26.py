# Backups card in Office settings. Applied after phase25.py.
P26 = open(pathlib.Path(__file__).with_name('phase26.js')).read()
rep('\n/* ---------- render ---------- */\n', P26 + '\n/* ---------- render ---------- */\n')
rep('o==="activity"?vActivity(): vSettings())', 'o==="activity"?vActivity(): vSettings()+backupCard())')
rep('    case "pins": await openPins(); break;', '    case "bk-get": await getBackup(v); break;\n    case "pins": await openPins(); break;')
