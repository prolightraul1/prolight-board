# Spanish. Applied after phase12.py.
n_loc = s.count('"en-US"')
s = s.replace('"en-US"', 'LOC()')
P13 = open(pathlib.Path(__file__).with_name('phase13.js')).read()
rep('\n/* ---------- render ---------- */\n', P13 + '\n/* ---------- render ---------- */\n')
rep('  ${myTime()}\n  <div class="f"><label>My headshot</label>', '''  <div class="f" data-no-i18n><label>Language · Idioma</label><div class="seg" role="group" aria-label="Language"><button type="button" data-act="lang" data-v="en" aria-pressed="${!LANG_ES}">English</button><button type="button" data-act="lang" data-v="es" aria-pressed="${LANG_ES}">Español</button></div></div>
  ${myTime()}\n  <div class="f"><label>My headshot</label>''')
rep('    case "pins": await openPins(); break;', '    case "lang": if((v==="es")!==LANG_ES) setLang(v); break;\n    case "pins": await openPins(); break;')
