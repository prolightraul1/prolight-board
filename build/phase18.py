# Push notifications. Applied after phase17.py.
P18 = open(pathlib.Path(__file__).with_name('phase18.js')).read()
rep('\n/* ---------- render ---------- */\n', P18 + '\n/* ---------- render ---------- */\n')
rep('function annBanner(){\n  { const live=meetingLive(); if(live) return live; }', 'function annBanner(){\n  { const live=meetingLive(); if(live) return live; }\n  { const pb=pushBanner(); if(pb) return pb; }')
rep('  <div class="f" data-no-i18n><label>Language · Idioma</label>', '  ${notifyCard()}\n  <div class="f" data-no-i18n><label>Language · Idioma</label>')
rep('    case "call-start": await startCall(v,true); break;', '''    case "push-on": await pushOn(); break;
    case "push-off": await pushOff(); break;
    case "push-later": try{ ls("push-ask","later"); }catch(e){} renderMain(); break;
    case "call-start": await startCall(v,true); break;''')
rep('  if(t.id==="act-who"){', '  if(t.dataset&&t.dataset.notify){ const N={...((PL.me()||{}).notify||{}),[t.dataset.notify]:t.checked}; try{ await PL.setNotify(N); }catch(e){ toast(/function|exist/i.test(e.message)?"Run update 16 in Supabase first.":e.message); } return; }\n  if(t.id==="act-who"){')
rep('lagCheck("screen: "+S.view, performance.now()-__t0); noteLoad(); seasonalLookCheck();', 'lagCheck("screen: "+S.view, performance.now()-__t0); noteLoad(); seasonalLookCheck(); goFromUrl();')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.ann.push-ask{border-left-color:#7aa8ff}\n.ann.push-ask .eyebrow{color:#9fc0ff}')
