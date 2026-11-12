/* ---------- TCL jobs we never did: released back to TCL, kept as history ---------- */
/* Released jobs carry stage "cancelled" (so every list, the calendar, map, planner, money totals and exports skip them)
   plus releasedToTcl:true. They only show under Jobs → "Released to TCL". */
const stLabel = (st, j) => j && j.releasedToTcl ? "Released to TCL" : STATUS[st];
