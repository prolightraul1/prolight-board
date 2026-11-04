// Smoke test with made-up data: opens every screen as a manager, a crew member and in Spanish, opens a job drawer,
// checks off a stop, and fails on any page error. Usage: node scripts/smoke/smoke.js   (needs playwright)
const {chromium}=require('playwright'); const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..');
const t=new Date(), iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, today=iso(t), tom=iso(new Date(t.getTime()+864e5));
const seed=[
  {coll:'clients',id:'c1',data:{name:'Test Client One',address:'1 Test St',city:'Tallahassee',lat:30.44,lng:-84.28}},
  {coll:'clients',id:'c2',data:{name:'Test Client Two',address:'2 Test St',city:'Tallahassee',lat:30.45,lng:-84.27}},
  {coll:'jobs',id:'j1',data:{clientId:'c1',stage:'scheduled',crew:'pl1',scope:'Roofline warm white',visits:[{id:'v1',type:'install',date:today,crew:'pl1',order:1}]}},
  {coll:'jobs',id:'j2',data:{clientId:'c2',stage:'scheduled',crew:'pl1',scope:'Two-day install',source:'tcl',tclSeenAt:new Date().toISOString(),tclLog:[{at:new Date().toISOString(),k:'scope',from:'Red',to:'Red + white'}],visits:[{id:'v1',type:'install',date:today,crew:'pl1',order:2},{id:'v2',type:'install',date:tom,crew:'pl1'}]}},
  {coll:'jobs',id:'j3',data:{clientId:'c1',stage:'scheduled',crew:'pl1',scope:'Missed yesterday',visits:[{id:'v1',type:'install',date:iso(new Date(t.getTime()-864e5)),crew:'pl1',time:'10:00'}]}},
  {coll:'fin',id:'j1',data:{price:1200}},{coll:'fin',id:'j2',data:{price:9000,tclLog:[{at:new Date().toISOString(),k:'price',from:8800,to:9000}]}},
  {coll:'fin',id:'hq-export',data:{live:true,liveAt:new Date().toISOString(),sent:{},log:[{at:new Date().toISOString(),mode:'changes',sent:3,inserted:3,updated:0,errors:[]},{at:new Date().toISOString(),mode:'test',ok:true,status:200}]}},
  {coll:'fin',id:'payroll',data:{rates:{'u-raul':{plans:[{from:'2026-01-01',rate:0,jobPct:0,mgmtPct:3}]},'u-mike':{plans:[{from:'2026-01-01',rate:20,jobPct:4,mgmtPct:0}]}}}},
];
const users=[{id:'u-raul',name:'Raul',pin:'111111',crew:'pl1',can_edit:true,can_money:true,can_manage:true,can_log:true,all_crews:true,active:true},{id:'u-mike',name:'Mike',pin:'222222',crew:'pl1',can_log:true,active:true}];
const VIEWS=['today','route','week','plan','jobs','clients','map','chat','office'], OFFICE=['money','payroll','hours','team','activity','sales','settings'];
const srv=http.createServer((q,s)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/') p='/index.html'; const f=path.join(ROOT,p); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); return s.end(); } s.writeHead(200,{'content-type':{'.html':'text/html','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s); }).listen(8799);
(async()=>{
  const b=await chromium.launch(); let bad=0;
  for(const who of [{uid:'u-raul',w:1280,h:900},{uid:'u-raul',w:820,h:1180,es:true},{uid:'u-mike',w:390,h:844,ios:true}]){
    const ctx=await b.newContext({viewport:{width:who.w,height:who.h},hasTouch:who.w<900,...(who.ios?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'}:{})});
    if(who.ios) await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'standalone',{get:()=>true}); window.__ZOOM=1; window.__IH=null; const ih=Object.getOwnPropertyDescriptor(window,'innerHeight'); Object.defineProperty(window,'innerHeight',{configurable:true,get(){ return window.__IH??ih.get.call(window); }}); if(window.visualViewport) Object.defineProperty(visualViewport,'scale',{get:()=>window.__ZOOM}); });
    await ctx.addInitScript(({seed,users,who})=>{ window.__SEED=seed; window.__USERS=users; window.__CALLS=[]; localStorage.setItem('look',JSON.stringify({intro:'off'})); if(who.es) localStorage.setItem('lang','es'); sessionStorage.setItem('mock-session',JSON.stringify({uid:who.uid})); },{seed,users,who});
    await ctx.route(/unpkg|cdnjs|jsdelivr|googleapis|gstatic|tile/, r=>r.abort());
    await ctx.route(/supabase-js/, r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(__dirname+'/mock-supabase.js','utf8')}));
    await ctx.route(/config\.js$/, r=>r.fulfill({contentType:'text/javascript',body:'window.PROLIGHT_CONFIG={supabaseUrl:"https://mock.supabase.co",supabaseAnonKey:"k"}'}));
    await ctx.route(/\/api\//, r=>r.fulfill({contentType:'application/json',body:'{}'}));
    const p=await ctx.newPage(), errs=[]; p.on('pageerror',e=>errs.push(e.message+' '+String(e.stack||'').split('\n').slice(1,3).join(' ')));
    await p.goto('http://localhost:8799/'); await p.waitForSelector('#gate',{state:'hidden',timeout:20000}); await p.waitForFunction(()=>typeof S!=='undefined'&&S.ready,null,{timeout:20000}); await p.waitForTimeout(400);
    for(const v of VIEWS){ await p.evaluate(v=>{ S.view=v; renderMain(); },v).catch(e=>errs.push(v+': '+e.message)); await p.waitForTimeout(150); }
    if(who.uid==='u-raul') for(const o of OFFICE){ await p.evaluate(o=>{ S.view='office'; S.office=o; renderMain(); },o).catch(e=>errs.push('office '+o+': '+e.message)); await p.waitForTimeout(150); }
    await p.evaluate(()=>{ S.view='jobs'; renderMain(); openDrawer('job','j2'); }).catch(e=>errs.push('drawer: '+e.message)); await p.waitForTimeout(200);
    if(who.uid==='u-raul'&&!who.es){ const th=await p.evaluate(()=>(document.querySelector('.tcl-hist')||{}).innerText||''); if(!/Colors[\s\S]*Red \+ white/.test(th)||!/\$9,000/.test(th)) errs.push('TCL history missing: '+th.slice(0,120)); }
    if(who.uid==='u-raul'){ const nd=await p.evaluate(()=>{ openDrawer('notdone'); return document.querySelectorAll('.nd-row').length; }).catch(e=>{ errs.push('notdone: '+e.message); return -1; }); if(nd<1) errs.push('not-done list empty'); await p.waitForTimeout(150); }
    await p.evaluate(()=>{ closeDrawer(); S.view='route'; renderMain(); }); await p.waitForTimeout(200);
    if(who.ios){ // pinch-zoom on the iPhone home-screen app must not push the bottom bar down or log keyboard shrink
      const z=await p.evaluate(async()=>{ for(const [s,h] of [[1.5,560],[2,420],[3,280]]){ window.__ZOOM=s; window.__IH=h; visualViewport.dispatchEvent(new Event('resize')); dispatchEvent(new Event('resize')); await new Promise(r=>setTimeout(r,300)); }
        const out={tf:(document.querySelector('.tabs')||{style:{}}).style.transform||'', lag:EVQ.filter(e=>/keyboard shrink/.test(e.where||'')).length}; window.__ZOOM=1; window.__IH=null; dispatchEvent(new Event('resize')); return out; });
      if(z.tf||z.lag) errs.push('zoom: bar moved or lag logged '+JSON.stringify(z));
    }
    { // time the app spends in the background while opening must not count as a slow open
      const o=await p.evaluate(async()=>{ LOADED_AT=0; OPENBG.ms=0; OPENBG.t=null; EVQ.length=0; EVSEEN.clear(); let hid=true;
        const dh=Object.getOwnPropertyDescriptor(Document.prototype,'hidden'), dv=Object.getOwnPropertyDescriptor(Document.prototype,'visibilityState');
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>hid}); Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>hid?'hidden':'visible'});
        document.dispatchEvent(new Event('visibilitychange')); OPENBG.t-=90000; await new Promise(r=>setTimeout(r,50)); hid=false; document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden; delete document.visibilityState; noteLoad(); const e=EVQ.find(x=>x.type==='load'||x.type==='slow-load'); return e?{type:e.type,hiddenMs:e.hiddenMs}:null; });
      if(!o||o.type!=='load'||!(o.hiddenMs>=90000)) errs.push('open time counted background time '+JSON.stringify(o));
    }
    console.log(`${who.uid}${who.es?' es':''} ${who.w}px: ${errs.length?'ERRORS '+JSON.stringify(errs):'ok'}`); bad+=errs.length; await ctx.close();
  }
  await b.close(); srv.close(); process.exit(bad?1:0);
})();
