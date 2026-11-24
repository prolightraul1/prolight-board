# Security headers support (update 17).
# 1) The one inline event handler (the "new version" bar) becomes a normal listener, so the
#    Content-Security-Policy can forbid inline handlers.
# 2) Anything the CSP blocks after sign-in is logged to the activity log as a "csp" event,
#    so the health watch sees it. The CSP itself is added at the very end of build.py.
rep('''<button type="button" id="upd-bar" onclick="location.reload()">New version of the board — tap to update</button>`);''',
    '''<button type="button" id="upd-bar">New version of the board — tap to update</button>`); { const ub=document.getElementById("upd-bar"); if(ub) ub.addEventListener("click",()=>location.reload()); }''')
rep('\n/* ---------- render ---------- */\n', '\n' + open(pathlib.Path(__file__).with_name('phase59.js')).read() + '\n/* ---------- render ---------- */\n')
