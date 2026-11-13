/* ---------- Deleting a Jobber job on the board sticks: the sync won't bring it back ---------- */
deleteJob = async function(){
  const id=S.form.id, j=S.jobs.get(id)||{}, wid=(String(j.jobberUrl||"").match(/work_orders\/(\d+)/)||[])[1], alts=j.jobberAlt||[];
  try{
    if(wid||alts.length){ let ids=[]; try{ const snap=await S.db.doc("settings/jobber-ignore").get(); ids=((snap&&snap.data&&snap.data())||{}).ids||[]; }catch(e){}
      await S.db.doc("settings/jobber-ignore").set({ids:[...new Set([...ids, ...(wid?[wid]:[]), ...alts])], updatedAt:new Date().toISOString()}); }
    await S.db.doc("jobs/"+id).delete(); try{ await S.db.doc("fin/"+id).delete(); }catch(e){}
    toast(wid?"Job deleted · it won't come back from Jobber":"Job deleted"); closeDrawer();
  }catch(e){ fail(e,"delete this job"); }
};
