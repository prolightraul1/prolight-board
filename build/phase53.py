# Released TCL jobs: hidden everywhere except Jobs → Released to TCL. Applied after phase52.py.
P53 = open(pathlib.Path(__file__).with_name('phase53.js')).read()
rep('\n/* ---------- render ---------- */\n', P53 + '\n/* ---------- render ---------- */\n')
rep('${STATUS[st]}', '${stLabel(st,typeof j==="undefined"?null:j)}', 4)
rep('''["co-shipshape","ShipShape crew"],["all","All"]]''', '''["co-shipshape","ShipShape crew"],["all","All"],["released","Released to TCL"]]''')
rep('''  let list=jobsArr(); const q=S.q.jobs.trim().toLowerCase();''', '''  let list=jobsArr().filter(j=>S.jf==="released"?j.releasedToTcl:!j.releasedToTcl); const q=S.q.jobs.trim().toLowerCase();''')
