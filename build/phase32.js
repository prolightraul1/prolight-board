/* ---------- multi-day installs ---------- */
/* A job with 2+ install visits is one install spread over several days: the board shows "Day 1 of 2",
   revenue is split across the days, and the job counts as installed (pay, commission) when the last day is checked off. */
function installDayNo(j,v){
  const iv=instVisits(j); if(iv.length<=1||!v||v.type!=="install") return null;
  const base=v.returnOf?(j.visits||[]).find(x=>x.id===v.returnOf)||v:v;
  const ord=[...iv].sort((a,b)=>String(a.date||"9999").localeCompare(String(b.date||"9999")));
  return {n:ord.findIndex(x=>x.id===base.id)+1, of:iv.length};
}
const _crewTags32 = crewTags;
crewTags = function(j,v){ const d=installDayNo(j,v); return (d?`<span class="vt daytag">Day ${d.n} of ${d.of}</span>`:"")+_crewTags32(j,v); };
installedOn = function(j){
  const iv=instVisits(j);
  if(iv.length<=1){ const d=[...S.log.values()].filter(e=>e.kind==="done"&&e.jobId===j.id).map(e=>e.at).sort()[0]; return d?isoOf(d):""; }
  let last="";
  for(const v of iv){ const d=doneMap.get(j.id+"|"+v.id)||(j.visits||[]).filter(x=>x.returnOf===v.id).map(x=>doneMap.get(j.id+"|"+x.id)).find(Boolean); if(!d||!d.at) return ""; if(d.at>last) last=d.at; }
  return last?isoOf(last):"";
};
ES_RX.push([/^Day (\d+) of (\d+)$/, (_, a, b) => `Día ${a} de ${b}`]);
if(typeof ES==="object"){ ES["+ Install day"]="+ Día de instalación"; }
