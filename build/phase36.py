# Health check fix: slow opens. Applied after phase35.py.
# A few opens logged 1-3 minutes while every other open took about a second: the time counted while the
# app was in the background (locked phone, switched apps, restored Safari tab). Subtract hidden time.
P36 = open(pathlib.Path(__file__).with_name('phase36.js')).read()
rep('\n/* ---------- render ---------- */\n', P36 + '\n/* ---------- render ---------- */\n')
rep('const gate=Math.round(window.__gateMs||0), ms=Math.max(0,Math.round(LOADED_AT-gate)); track(ms>6000?"slow-load":"load",{ms,gateMs:gate||undefined,online:navigator.onLine}); }',
    'const gate=Math.round(window.__gateMs||0), hid=openHiddenMs(LOADED_AT), ms=Math.max(0,Math.round(LOADED_AT-gate-hid)); track(ms>6000?"slow-load":"load",{ms,gateMs:gate||undefined,hiddenMs:hid||undefined,online:navigator.onLine}); }')
