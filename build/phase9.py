# Who sold it (in the job form), managers edit their own time, Jobber timesheet pull. Applied after phase8.py.
P9 = open(pathlib.Path(__file__).with_name('phase9.js')).read()
rep('\n/* ---------- render ---------- */\n', P9 + '\n/* ---------- render ---------- */\n')

# job form: who sold it, lead type, custom %
rep('placeholder="Deposit, discount, payment terms">${esc(fin.privateNote)}</textarea></div>', 'placeholder="Deposit, discount, payment terms">${esc(fin.privateNote)}</textarea></div>\n      ${soldUI(F)}')
rep('const sp=g("m-ss"); if(sp!==undefined) F.fin.ssPct=sp.trim();\n}', 'const sp=g("m-ss"); if(sp!==undefined) F.fin.ssPct=sp.trim();\n  readSold();\n}')
# keep everything already on the money record (sale, extras, payments) when the job is saved
rep('await S.db.doc("fin/"+ref.id).set({price,invoiceNo:F.fin.invoiceNo||"",privateNote:F.fin.privateNote||"",collected:!!old.collected,ssPaid:!!old.ssPaid,ssPct:hasPct(F.fin.ssPct)?Number(F.fin.ssPct):null}); }',
    'await S.db.doc("fin/"+ref.id).set(soldApply(F,{...old,price,invoiceNo:F.fin.invoiceNo||"",privateNote:F.fin.privateNote||"",collected:!!old.collected,ssPaid:!!old.ssPaid,ssPct:hasPct(F.fin.ssPct)?Number(F.fin.ssPct):null},old)); }')
rep('<p class="count" style="font-size:13px">New customer? Add the job first with <b>+ New job</b> on Jobs, then record the sale from its Money section.</p>',
    '<div class="bar" style="margin:8px 0"><button type="button" class="btn amber" data-act="new-job-sale">+ New job I sold</button><span class="count" style="font-size:13px">Adds the customer and job with you as the seller.</span></div>')

rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="jbhours"?dJbHours():')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "sold-type": readJobForm(); if(S.form&&S.form.sold){ S.form.sold.type=v; renderDrawer(); } break;
    case "new-job-sale": startJobForm(null,""); if(S.form){ S.form.job.source="prolight"; S.form.sold={by:sellers().some(p=>p.id===S.me.id)?S.me.id:"",type:"inbound",pct:"",ref:"",refPct:""}; renderDrawer(); } break;
    case "mt-wk": S.myWk=v==="0"?0:Math.min(0,(S.myWk||0)+Number(v)); renderDrawer(); break;
    case "jbh-open": { const ws=myWeekStart(); S.jbh={from:ws,to:addDays(ws,6)>todayISO()?todayISO():addDays(ws,6),who:S.me.id,entries:null,sel:new Set(),error:""}; openDrawer("jbhours"); break; }
    case "jbh-pull": await jbhPull(); break;
    case "jbh-add": await jbhAdd(); break;
''')
rep('  if(t.dataset&&t.dataset.rateFor){', '  if(t.dataset&&t.dataset.jbh&&S.jbh){ t.checked?S.jbh.sel.add(t.dataset.jbh):S.jbh.sel.delete(t.dataset.jbh); const c=document.querySelector("[data-act=jbh-add]"); if(c) c.disabled=!S.jbh.sel.size; const k=c&&c.previousElementSibling; if(k) k.textContent=S.jbh.sel.size+" picked"; return; }\n  if(t.dataset&&t.dataset.rateFor){')
# re-render the commission line when the seller changes
rep('  if(t.dataset&&t.dataset.jbh&&S.jbh){', '  if(["sl-by","sl-ref"].includes(t.id)&&S.form&&S.form.sale){ readSale(); renderDrawer(); return; }\n  if(["m-soldby","m-ref"].includes(t.id)&&S.form&&S.form.sold){ readJobForm(); renderDrawer(); return; }\n  if(t.dataset&&t.dataset.jbh&&S.jbh){')
