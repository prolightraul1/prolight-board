# Offline pill + service calls. Applied by build.py after phase4.py.
P5 = open(pathlib.Path(__file__).with_name('phase5.js')).read()
rep('\n/* ---------- render ---------- */\n', P5 + '\n/* ---------- render ---------- */\n')

# waiting-for-signal pill in the top bar and rail
rep('  $("#whoTop").innerHTML = `<button type="button" class="who-btn" data-act="account">',
    '  $("#whoTop").innerHTML = outPill()+`<button type="button" class="who-btn" data-act="account">')
rep("  { const un=S.chatOff?0:unreadTotal();",
    "  { const sc=svcCount(); if(sc) document.querySelectorAll('#railNav [data-v=\"week\"],#tabNav [data-v=\"week\"]').forEach(b=>b.insertAdjacentHTML(\"beforeend\",`<i class=\"nbadge\">${sc>9?\"9+\":sc}</i>`)); }\n  { const un=S.chatOff?0:unreadTotal();")

# service calls in Week, job drawer, stop cards, the log
rep('  h+=returnBlock();', '  h+=serviceBlock();\n  h+=returnBlock();')
rep('<button type="button" class="btn" data-act="client" data-id="${esc(j.clientId)}">Client</button>',
    '<button type="button" class="btn" data-act="client" data-id="${esc(j.clientId)}">Client</button>${S.me.owner?`<button type="button" class="btn" data-act="svc-new" data-v="${esc(id)}">+ Service call</button>`:S.me.canLog?`<button type="button" class="btn" data-act="svc-report" data-v="${esc(id)}">Report a problem</button>`:""}')
rep('  if(v.returnOf) out.push(`<span class="vt returntag">Return</span>`);',
    '  if(v.returnOf) out.push(`<span class="vt returntag">Return</span>`);\n  if(v.svc&&v.svc.urgent) out.push(`<span class="vt urgent">Urgent</span>`);')
rep('  if(e.kind==="partial") return partialEntry(e);', '  if(e.kind==="issue") return issueEntry(e); if(e.kind==="partial") return partialEntry(e);')

rep('D.kind==="truck"?dTruck(D.id):', 'D.kind==="truck"?dTruck(D.id): D.kind==="svc"?dService(D.id): D.kind==="issue"?dIssue(D.id): D.kind==="svcpick"?dSvcPick():')
rep('  if(ev.target.id==="ctForm") return saveCrewTruck(ev.target);', '  if(ev.target.id==="svcForm") return saveSvc(ev.target);\n  if(ev.target.id==="issueForm") return saveIssue(ev.target);\n  if(ev.target.id==="ctForm") return saveCrewTruck(ev.target);')
rep('    case "account": openDrawer("account"); break;\n', '''    case "account": openDrawer("account"); break;
    case "outbox": toast(navigator.onLine?"Sending now…":"Saved on this phone. It sends when you have signal."); if(PL.flushOutbox) PL.flushOutbox(); break;
    case "svc-pick": S.form={svcq:""}; openDrawer("svcpick"); break;
    case "svc-new": S.form=null; openDrawer("svc","new|"+v); break;
    case "svc-report": S.form=null; openDrawer("issue",v); break;
    case "svc-edit": S.form=null; openDrawer("svc",v); break;
    case "svc-from-issue": { const e=S.log.get(v); if(e){ S.form=null; openDrawer("svc","new|"+e.jobId+"|"+v); } break; }
    case "svc-dismiss": try{ await S.db.doc("log/"+v).update({closed:true}); toast("Dismissed"); }catch(e){ fail(e,"dismiss that"); } break;
    case "svc-reason": readSvc(); if(S.form&&S.form.svc){ S.form.svc.reason=S.form.svc.reason===v?"":v; renderDrawer(); } break;
    case "svc-urgent": readSvc(); if(S.form&&S.form.svc){ S.form.svc.urgent=!S.form.svc.urgent; renderDrawer(); } break;
    case "svc-usefit": { const [d,c]=v.split("|"); $("#sv-date").value=d; $("#sv-crew").value=c; break; }
    case "svc-fit": { const [jid,vid]=v.split("|"), f=bestFit({id:jid,...S.jobs.get(jid)},vid); if(!f){ toast("No route fits. Pick a day."); break; }
      try{ await placeSvc(jid,vid,f.day,f.crew,f.idx); toast(`Added to ${teamName(f.crew)}, ${rel(f.day)||fmtDay(f.day)}`); }catch(e){ fail(e,"add it"); } break; }
    case "svc-cancel": { const [jid,vid]=v.split("|"), j=S.jobs.get(jid); try{ await S.db.doc("jobs/"+jid).update({visits:(j.visits||[]).filter(x=>x.id!==vid)}); toast("Service call canceled"); S.form=null; closeDrawer(); }catch(e){ fail(e,"cancel it"); } break; }
''')

rep('.who-btn{display:inline-flex;align-items:center}', '''.who-btn{display:inline-flex;align-items:center}
.outpill{background:#f2a516;color:#1a1406;border:0;border-radius:999px;padding:4px 10px;font:700 12px var(--f-body);margin-right:8px;white-space:nowrap;animation:outp 2s ease-in-out infinite}
@keyframes outp{50%{opacity:.6}}
.vt.urgent{display:inline-block;width:auto;background:var(--red);color:#fff;vertical-align:middle;font-size:12px;padding:1px 6px}
.row.svc .m{text-align:left}
.row.svc .r{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.row.svc .s{white-space:normal}
@media (max-width:620px){ .row.svc{flex-wrap:wrap} .row.svc .r{flex-basis:100%;justify-content:flex-start;padding-left:26px} }''')
