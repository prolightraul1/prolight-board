/* ---------- TCL jobs released back to TCL from Nov 11, 2026 ---------- */
/* From this date our crews don't install TCL jobs: Plan a day only suggests ProLight jobs, and TCL installs on/after it
   don't count as "not marked done". TCL money, history and fixes stay on the board. */
const TCL_RELEASED = "2026-11-11";
const tclReleased = (j, day) => j && j.source === "tcl" && String(day||"") >= TCL_RELEASED;
