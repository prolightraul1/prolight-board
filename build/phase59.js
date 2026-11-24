/* ---------- CSP violations -> activity log (update 17) ---------- */
document.addEventListener("securitypolicyviolation",e=>{
  try{ track("csp",{what:String(e.effectiveDirective||e.violatedDirective||""),msg:String(e.blockedURI||"inline").slice(0,200),src:`${String(e.sourceFile||"").split("/").pop()}:${e.lineNumber||""}`}); }catch(_){}
});
