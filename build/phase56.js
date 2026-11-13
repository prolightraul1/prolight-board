/* ---------- Undoing a check-off that came from Jobber sticks ---------- */
/* A Jobber-made check-off (log id jbv-… / jbdone-…) that you undo is remembered, so the Jobber sync won't add it back
   even though Jobber still shows the visit complete. */
delEntry = async function(id){
  try{
    if(/^jb(v|done)-/.test(String(id))){ let ids=[]; try{ const s=await S.db.doc("settings/jobber-undone").get(); ids=((s&&s.data&&s.data())||{}).ids||[]; }catch(e){}
      await S.db.doc("settings/jobber-undone").set({ids:[...new Set([...ids,id])],updatedAt:new Date().toISOString()}); }
    const e=S.log.get(id), j=e&&S.jobs.get(e.jobId);
    await S.db.doc("log/"+id).delete();
    // undoing a check-off on a Jobber job reopens the visit in Jobber too
    if(e&&e.kind==="done"&&j&&(j.jobberUrl||(j.jobberAlt||[]).length)){ await S.db.doc("log/jbu-"+id).set({kind:"jbundo",jobId:e.jobId,visitId:e.visitId,logId:id,by:S.me.id,at:new Date().toISOString()}).catch(()=>{}); toast("Undone · reopening it in Jobber too"); }
    else if(/^jb(v|done)-/.test(String(id))) toast("Undone");
  }catch(e){ fail(e,"change that"); }
};
