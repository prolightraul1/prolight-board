window.supabase={createClient(){
  const users=window.__USERS; const docs=window.__SEED;
  let session=JSON.parse(sessionStorage.getItem('mock-session')||'null');
  if(session && !sessionStorage.getItem('mock-newday')){ const d=new Date(Date.now()-3*3600e3); localStorage.setItem('prolight-day',d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()); }
  const me=()=>users.find(u=>session&&u.id===session.uid&&u.active);
  const canSee=r=>{ const m=me(); if(!m) return false; if(r.coll==='fin') return m.can_money; if(r.coll==='jobs'&&!m.all_crews&&!m.can_edit){ const d=r.data; return d.crew===m.crew||(d.visits||[]).some(v=>v.crew===m.crew||(v.crews||[]).includes(m.crew));} return true; };
  const canWrite=r=>{ const m=me(); if(!m) return false; if(r.coll==='log') return m.can_log; if(r.coll==='fin') return m.can_money&&m.can_edit; return m.can_edit; };
  const deny={data:null,error:{message:'new row violates row-level security policy',code:'42501'}};
  function q(table){ const st={f:[],op:'select'}; const api={select(){return api},gte(){return api},order(){return api},limit(){return api},single(){st.single=true;return api},insert(row){st.op='insert';st.row=row;return api},eq(k,v){st.f.push([k,v]);return api},range(a,b){st.r=[a,b];return api},upsert(row){st.op='upsert';st.row=row;return api},delete(){st.op='delete';return api},then(res,rej){return Promise.resolve(run()).then(res,rej)}};
    function run(){ window.__CALLS.push(table+':'+st.op+':'+JSON.stringify(st.f));
      if(table==='messages'){ const M=window.__MSGS=window.__MSGS||[]; const m=me(); const ok=ch=>ch==='ann'||(ch.startsWith('crew:')?(m.all_crews||m.can_edit||m.can_manage||m.crew===ch.slice(5)):ch.startsWith('dm:')&&ch.split(':').includes(m.id));
        if(st.op==='select') return {data:M.filter(x=>ok(x.channel)),error:null};
        if(st.op==='insert'){ const r=st.row; if(!ok(r.channel)||(r.channel==='ann'&&!(m.can_edit||m.can_manage))||r.by!==m.id) return deny; const row={id:'m'+Math.random().toString(36).slice(2,9),at:new Date().toISOString(),...r}; M.push(row); return {data:row,error:null}; }
        if(st.op==='delete'){ const id=st.f.find(x=>x[0]==='id')[1]; const k=M.findIndex(x=>x.id===id); if(k>=0) M.splice(k,1); return {data:null,error:null}; } }
      if(table==='staff') return {data:me()?users.map(({pin,...u})=>u):[],error:null};
      if(st.op==='select'){ let rows=docs.filter(r=>st.f.every(([k,v])=>r[k]===v)&&canSee(r)); if(st.r) rows=rows.slice(st.r[0],st.r[1]+1); return {data:rows.map(r=>({id:r.id,data:r.data})),error:null}; }
      if(st.op==='upsert'){ if(!canWrite(st.row)) return deny; const i=docs.findIndex(r=>r.coll===st.row.coll&&r.id===st.row.id); if(i>=0) docs[i]={...st.row}; else docs.push({...st.row}); return {data:null,error:null}; }
      if(st.op==='delete'){ const [c,i]=[st.f.find(x=>x[0]==='coll')[1],st.f.find(x=>x[0]==='id')[1]]; const k=docs.findIndex(r=>r.coll===c&&r.id===i); if(k>=0){ if(!canWrite(docs[k])) return deny; docs.splice(k,1);} return {data:null,error:null}; } } return api; }
  const rpc=async(fn,a)=>{ window.__CALLS.push('rpc:'+fn);
    if(fn==='needs_owner') return {data:!users.length,error:null};
    if(fn==='staff_set_photo'){ users.find(u=>u.id===a.p_id).photo=a.p_photo; return {data:null,error:null}; }
    if(fn==='staff_set_look'){ const me=JSON.parse(sessionStorage.getItem('mock-session')||'{}').uid; const u=users.find(x=>x.id===me); if(u) u.look=a.p_look; return {data:null,error:null}; }
    if(fn==='log_events'){ (window.__EVENTS=window.__EVENTS||[]).push(...a.p_events); return {data:null,error:null}; }
    if(fn==='audit_health'){ return {data:{crashes:1,lag:2,failed:0,loadMs:2300,loads:5,changes:40,wrongPins:3},error:null}; }
    if(fn==='audit_list'){ const t=Date.now(); const j=(window.__SEED.find(r=>r.coll==='jobs')||{}).id; return {data:[{id:5,at:new Date(t).toISOString(),who:'u-mike',kind:'event',doc_id:'crash',info:{type:'crash',msg:'x is not defined',view:'route',device:'iPhone · Safari',stack:'at y (index.html:12)'}},{id:4,at:new Date(t-6e4).toISOString(),who:'u-mike',kind:'insert',coll:'log',doc_id:'l1',info:{fields:[],after:{kind:'done',jobId:j},ref:{kind:'done',jobId:j}}},{id:3,at:new Date(t-12e4).toISOString(),who:'u-raul',kind:'update',coll:'jobs',doc_id:j,info:{fields:['crew','visits'],before:{crew:''},after:{crew:'pl1'},ref:{}}},{id:2,at:new Date(t-9e7).toISOString(),who:'u-mike',kind:'update',coll:'log',doc_id:'c1',info:{fields:['out'],before:{out:null},after:{out:new Date(t-9e7).toISOString()},ref:{kind:'clock',jobId:j}}},{id:1,at:new Date(t-9.1e7).toISOString(),who:null,kind:'event',doc_id:'lag',info:{where:'screen: week',ms:820,device:'Windows · Chrome'}}],error:null}; }
    if(fn==='staff_require_new_pins'){ const me=JSON.parse(sessionStorage.getItem('mock-session')||'{}').uid; users.forEach(u=>u.pin_ok=(u.id===me)); const t=new Date().toISOString(); window.__SIGNIN={after:t,by:me}; return {data:t,error:null}; }
    if(fn==='pin_report'){ return {data:users.map(u=>({id:u.id,name:u.name,active:u.active,pin:u.id==='u-mike'?u.pin:null,set_at:u.id==='u-mike'?new Date().toISOString():null,last_sign_in:null})),error:null}; }
    if(fn==='staff_set_title'){ users.find(u=>u.id===a.p_id).title=a.p_title; return {data:null,error:null}; }
    if(fn==='staff_delete'){ const i=users.findIndex(u=>u.id===a.p_id); if(i>=0) users.splice(i,1); return {data:null,error:null}; }
    if(fn==='pin_login'){ const hit=users.filter(u=>u.active&&u.pin===a.p_pin); if(hit.length>1) return {data:null,error:{message:'That PIN belongs to more than one person. Ask the office to give you a new one.'}}; return {data:hit[0]?hit[0].id+'@pin.example.com':null,error:null}; }
    if(fn==='login_names') return {data:users.filter(u=>u.active).map(u=>({id:u.id,name:u.name,email:u.id+'@pin.example.com'})),error:null};
    if(fn==='doc_merge'){ const r=docs.find(x=>x.coll===a.p_coll&&x.id===a.p_id); if(!r||!canWrite(r)) return {error:{message:'Not allowed',code:'42501'}}; r.data={...r.data,...a.p_patch}; return {data:null,error:null}; }
    if(fn==='staff_add'){ if(!me().can_manage) return {error:{message:'Only managers can add people'}}; if(!/^[0-9]{6}$/.test(a.p_pin)) return {error:{message:'PIN must be exactly 6 digits'}}; users.push({id:'u-'+a.p_name.toLowerCase().replace(/\W/g,''),name:a.p_name,pin:a.p_pin,crew:a.p_crew,can_edit:a.p_edit,can_money:a.p_money,can_manage:a.p_manage,can_log:a.p_log,all_crews:a.p_all,active:true,partner:a.p_partner||''}); return {data:'x',error:null}; }
    if(fn==='staff_update'){ const u=users.find(x=>x.id===a.p_id); Object.assign(u,{name:a.p_name,crew:a.p_crew,can_edit:a.p_edit,can_money:a.p_money,can_manage:a.p_manage,can_log:a.p_log,all_crews:a.p_all,active:a.p_active,partner:a.p_partner||''}); return {error:null}; }
    if(fn==='staff_set_pin'){ { const u=users.find(x=>x.id===a.p_id); u.pin=a.p_pin; const me=JSON.parse(sessionStorage.getItem('mock-session')||'{}').uid; u.pin_ok=(me===a.p_id); } return {error:null}; }
    if(fn==='partner_statement'){ const m=me(); if(!m||!(m.partner==='shipshape'||m.can_money)) return {error:{message:'Not allowed'}};
      const fin=id=>(docs.find(r=>r.coll==='fin'&&r.id===id)||{}).data||{}; const cl=id=>(docs.find(r=>r.coll==='clients'&&r.id===id)||{}).data||{};
      const jobs=docs.filter(r=>r.coll==='jobs').map(r=>{ const f=fin(r.id); const pct=typeof f.ssPct==='number'?f.ssPct:(r.data.source==='tcl'&&r.data.crew==='shipshape'?30:0); return {id:r.id,client:cl(r.data.clientId).name,address:cl(r.data.clientId).address,date:(r.data.visits||[]).map(v=>v.date).filter(Boolean).sort()[0]||null,installed:docs.some(l=>l.coll==='log'&&l.data.jobId===r.id&&l.data.kind==='done'),pct,payout:Math.round((f.price||0)*pct)/100,paid:!!f.ssPaid}; }).filter(j=>j.pct>0);
      const payments=docs.filter(r=>r.coll==='fin'&&r.id.startsWith('pay-')&&r.data.party==='shipshape').map(r=>({id:r.id,...r.data}));
      return {data:{jobs,payments},error:null}; }
    return {error:{message:'unknown rpc '+fn}}; };
  return { from:q, rpc,
    auth:{ getSession:async()=>({data:{session:session?{user:{id:session.uid,last_sign_in_at:session.at||'2026-10-29T10:00:00.000Z'}}:null}}), getUser:async()=>({data:{user:session?{id:session.uid}:null}}),
      signInWithPassword:async({email,password})=>{ const u=users.find(u=>u.id+'@pin.example.com'===email&&u.active); if(!u||u.pin!==password) return {error:{message:'Invalid login credentials'}}; session={uid:u.id}; sessionStorage.setItem('mock-session',JSON.stringify(session)); return {data:{},error:null}; },
      signOut:async()=>{ localStorage.removeItem('prolight-day'); session=null; sessionStorage.removeItem('mock-session'); }, onAuthStateChange(){} },
    channel(){ const c={on(){return c},subscribe(cb){ cb&&cb('SUBSCRIBED'); return c}}; return c; }, removeChannel(){},
    storage:{from(){return {upload:async(path,blob)=>{ if(/^staff\//.test(path)&&blob){ window.__PHOTO=await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(blob); }); } return {error:null}; },getPublicUrl:p=>({data:{publicUrl:(window.__PHOTO&&/^staff\//.test(p))?window.__PHOTO:'data:,'}}),remove:async()=>({})};}} };
}};
