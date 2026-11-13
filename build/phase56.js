/* ---------- Undoing a check-off that came from Jobber sticks ---------- */
/* A Jobber-made check-off (log id jbv-… / jbdone-…) that you undo is remembered, so the Jobber sync won't add it back
   even though Jobber still shows the visit complete. */
delEntry = async function(id){
  try{
    if(/^jb(v|done)-/.test(String(id))){ let ids=[]; try{ const s=await S.db.doc("settings/jobber-undone").get(); ids=((s&&s.data&&s.data())||{}).ids||[]; }catch(e){}
      await S.db.doc("settings/jobber-undone").set({ids:[...new Set([...ids,id])],updatedAt:new Date().toISOString()}); }
    await S.db.doc("log/"+id).delete();
    if(/^jb(v|done)-/.test(String(id))) toast("Undone · it stays undone even though Jobber shows it complete");
  }catch(e){ fail(e,"change that"); }
};
