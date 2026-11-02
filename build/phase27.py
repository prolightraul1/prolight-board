# Map: show every job's price (money people), toggle. Applied after phase26.py.
rep('<h1 class="h-view grow">Map</h1><span class="count mono">${on.length} on map${off.length?` · ${off.length} not placed`:""}</span></div>',
    '<h1 class="h-view grow">Map</h1><span class="count mono">${on.length} on map${off.length?` · ${off.length} not placed`:""}${S.me.money&&MAP.prices?` · ${money0(on.reduce((t,j)=>t+(+((S.fin.get(j.id)||{}).price)||0),0))}`:""}</span>${S.me.money?`<button type="button" class="btn small ${MAP.prices?"amber":""}" data-act="map-prices">${MAP.prices?"Hide prices":"$ Show prices"}</button>`:""}</div>')
rep('''    const lbl=(order&&order.get(j.id)?order.get(j.id)+". ":"")+(clientOf(j).name||"Customer");
    m.bindTooltip(esc(lbl),{permanent:!!(sel||z>=15||order),direction:"right",offset:[10,0],className:"pin-tip"});''',
'''    const pr=S.me.money&&MAP.prices?(+((S.fin.get(j.id)||{}).price)||0):null;
    const lbl=(order&&order.get(j.id)?order.get(j.id)+". ":"")+(pr!=null&&z<14&&!sel?"":(clientOf(j).name||"Customer"))+(pr!=null?`${z<14&&!sel?"":" · "}${pr?money0(pr):"no price"}`:"");
    m.bindTooltip(esc(lbl),{permanent:!!(sel||z>=15||order||pr!=null),direction:"right",offset:[10,0],className:"pin-tip"+(pr!=null?" pin-price":"")});''')
rep('    case "pins": await openPins(); break;', '    case "map-prices": MAP.prices=!MAP.prices; try{ localStorage.setItem("map-prices",MAP.prices?"1":""); }catch(e){} renderMain(); break;\n    case "pins": await openPins(); break;')
rep('.lbl:empty{display:none}', '.lbl:empty{display:none}\n.pin-tip.pin-price{font-weight:800;font-variant-numeric:tabular-nums}')
rep('const MAP = { cx:null, cy:null, k:null, sel:null, mode:"unsched", day:todayISO(), placing:null, date:addDays(todayISO(),1) };',
    'const MAP = { cx:null, cy:null, k:null, sel:null, mode:"unsched", day:todayISO(), placing:null, date:addDays(todayISO(),1), prices:(()=>{ try{ return !!localStorage.getItem("map-prices"); }catch(e){ return false; } })() };\nconst money0 = n => "$"+Math.round(+n||0).toLocaleString("en-US");')
