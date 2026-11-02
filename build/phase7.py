# Commission on sales + weekly payroll. Applied after phase6.py.
P7 = open(pathlib.Path(__file__).with_name('phase7.js')).read()
rep('\n/* ---------- render ---------- */\n', P7 + '\n/* ---------- render ---------- */\n')

# payroll settings live in the money-only fin collection
rep('if(d.id==="settings") S.finSet=d.data(); else if(d.id.startsWith("pay-"))', 'if(d.id==="settings") S.finSet=d.data(); else if(d.id==="payroll") S.payroll=d.data()||{}; else if(d.id.startsWith("pay-"))')

# Office tabs
rep('S.me.owner&&["hours","Hours"],', 'S.me.owner&&["hours","Hours"],S.me.money&&["sales","Commission"],S.me.money&&["payroll","Payroll"],')
rep('else if(S.office==="statement") h+=vStatement();', 'else if(S.office==="statement") h+=vStatement(); else if(S.office==="sales") h+=vSales(); else if(S.office==="payroll") h+=vPayroll();')

# job drawer money section: record the sale
rep('${j.source==="tcl"||extrasOf(f).length?extrasHTML(j,f):""}</section>`; }', '${j.source==="tcl"||extrasOf(f).length?extrasHTML(j,f):""}${saleLine(j)}</section>`; }')

# commission rates in Settings
rep('<small>When you give one of ProLight\'s own jobs to ShipShape. Percent of the job price.</small></div>',
    '''<small>When you give one of ProLight\'s own jobs to ShipShape. Percent of the job price.</small></div>
      <div class="f"><label for="s-cin">Commission: inbound lead (%)</label><input id="s-cin" inputmode="decimal" value="${esc(S.finSet.commIn??10)}"></div>
      <div class="f"><label for="s-cout">Commission: outbound lead (%)</label><input id="s-cout" inputmode="decimal" value="${esc(S.finSet.commOut??14)}"></div>
      <div class="f"><label for="s-cwhen">Commission counts when</label><select id="s-cwhen"><option value="installed" ${commWhen()==="installed"?"selected":""}>The job is installed</option><option value="sold" ${commWhen()==="sold"?"selected":""}>The job is sold</option></select></div>''')
rep('ssOwnRate:Number(g("s-ssown"))||30})', 'ssOwnRate:Number(g("s-ssown"))||30,commIn:Number(g("s-cin"))||10,commOut:Number(g("s-cout"))||14,commWhen:g("s-cwhen")?g("s-cwhen").value:"installed"})')

# hours table: managers tap a row to fix a time
rep('''${rows.map(r=>`<tr><td>${fmtDay(isoOf(r.in),{weekday:"short",month:"short",day:"numeric"})}</td>''',
    '''${rows.map(r=>`<tr ${S.me.owner?`data-act="clock-edit" data-id="${esc(r.id)}" style="cursor:pointer"`:""}><td>${fmtDay(isoOf(r.in),{weekday:"short",month:"short",day:"numeric"})}${r.edited?" ✎":""}</td>''')

# drawers, forms, actions
rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="sale"?dSale(D.id): D.kind==="salepick"?dSalePick(): D.kind==="clockedit"?dClockEdit(D.id):')
rep('  if(ev.target.id==="svcForm") return saveSvc(ev.target);', '  if(ev.target.id==="saleForm") return saveSale(ev.target);\n  if(ev.target.id==="clockForm") return saveClockEdit(ev.target);\n  if(ev.target.id==="svcForm") return saveSvc(ev.target);')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "sales-by": S.salesBy=v; renderMain(); break;
    case "sale-pick": S.form={saleq:""}; openDrawer("salepick"); break;
    case "sale-edit": S.form=null; openDrawer("sale",v); break;
    case "sale-type": readSale(); if(S.form&&S.form.sale){ S.form.sale.type=v; renderDrawer(); } break;
    case "sale-remove": { const f=S.fin.get(v)||{}, {sale,...rest}=f; if(S.me.manage) delete rest.referral; try{ await S.db.doc("fin/"+v).set(rest); toast("Sale removed"); S.form=null; closeDrawer(); }catch(e){ fail(e,"remove it"); } break; }
    case "sales-csv": { const L=allSales().filter(s=>v==="all"||s.by===v); download(`ProLight-commission-${todayISO()}.csv`,[["Sold","Sold by","Customer","Address","Lead","Job amount","%","Commission","Installed","Status"],...L.map(s=>[isoOf(s.at||new Date().toISOString()),staffName(s.by),clientOf(s.job).name||"",addrOf(s.job),leadLabel(s.type),s.base.toFixed(2),s.pct,s.comm.toFixed(2),s.installed||"",s.paidAt?"Paid":s.earnedOn?"Earned":"Booked"])]); break; }
    case "pay-csv": payCsv(); break;
    case "pay-detail": payDetailCsv(); break;
    case "pay-print": payPrint(); break;
    case "pay-commpaid": await markCommPaid(); break;
    case "clock-edit": openDrawer("clockedit",id); break;
    case "clock-del": try{ await S.db.doc("log/"+id).delete(); toast("Deleted"); closeDrawer(); }catch(e){ fail(e,"delete it"); } break;
''')
rep('  if(t.dataset&&t.dataset.photoFor){', '  if(t.dataset&&t.dataset.rateFor){ await saveRate(t.dataset.rateFor,t.value); return; }\n  if(t.dataset&&t.dataset.photoFor){')
