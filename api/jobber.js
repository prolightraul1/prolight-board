// Keeps ProLight's Jobber jobs flowing onto the board.
//   POST /api/jobber?action=connect  (manager)  -> { url } to approve the connection in Jobber
//   GET  /api/jobber-callback         (Jobber)   -> saves the connection, back to the board
//   POST /api/jobber?action=sync     (manager)  -> pulls new ProLight jobs now
//   GET  /api/jobber?action=status   (manager)  -> connected? last sync?
//   GET  /api/jobber?action=hours&from=ISO&to=ISO (manager) -> Jobber timesheet entries in that range
//   GET  /api/jobber?action=cron     (Vercel)   -> nightly sync
// Only ProLight jobs come over. ProWash jobs and TCL jobs are never touched.
// Needs these Vercel environment variables: JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET,
// SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (optional: SUPABASE_URL, JOBBER_API_VERSION, SITE_URL).
const crypto = require("crypto");

const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const JB_ID = process.env.JOBBER_CLIENT_ID || "";
const JB_SECRET = process.env.JOBBER_CLIENT_SECRET || "";
const JB_VER = process.env.JOBBER_API_VERSION || "2025-04-16";
const TZ = "America/New_York";
const SINCE_DEFAULT = "2026-09-01T00:00:00Z";

const siteUrl = (req) => process.env.SITE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
const callbackUrl = (req) => siteUrl(req) + "/api/jobber-callback";

/* ---------- Supabase (service role, server side only) ---------- */
async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + path, {
    ...opts,
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const getInt = async (id) => ((await sb(`/rest/v1/integrations?id=eq.${id}&select=data`))[0] || {}).data || null;
const putInt = (id, data) => sb("/rest/v1/integrations", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }) });
const putDocs = (rows) => rows.length ? sb("/rest/v1/docs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) }) : null;
async function allDocs(coll) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`/rest/v1/docs?coll=eq.${coll}&select=id,data`, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/* Only board managers may connect or sync. */
async function manager(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
  if (!r.ok) return null;
  const u = await r.json();
  const s = (await sb(`/rest/v1/staff?id=eq.${u.id}&select=id,name,can_manage,can_edit,active`))[0];
  return s && s.active && (s.can_manage || s.can_edit) ? s : null;
}

/* ---------- Jobber ---------- */
const sign = (v) => crypto.createHmac("sha256", JB_SECRET).update(v).digest("hex").slice(0, 32);
async function tokenCall(params) {
  const r = await fetch("https://api.getjobber.com/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: JB_ID, client_secret: JB_SECRET, ...params }).toString(),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Jobber sign-in ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
const jwtExp = (t) => { try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).exp * 1000; } catch (e) { return Date.now() + 50 * 60e3; } };
async function accessToken() {
  const c = await getInt("jobber");
  if (!c || !c.refresh_token) throw new Error("Jobber isn't connected yet.");
  if (c.access_token && c.expires > Date.now() + 5 * 60e3) return c.access_token;
  const t = await tokenCall({ grant_type: "refresh_token", refresh_token: c.refresh_token });
  await putInt("jobber", { ...c, access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expires: jwtExp(t.access_token) });
  return t.access_token;
}
async function gql(token, query, variables) {
  for (let tries = 0; ; tries++) {
    const r = await fetch("https://api.getjobber.com/api/graphql", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "X-JOBBER-GRAPHQL-VERSION": JB_VER },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    const throttled = r.status === 429 || (j.errors || []).some((e) => /throttl/i.test(e.message || ""));
    if (throttled && tries < 6) {
      // Jobber refills its request budget over time; wait just long enough for this query.
      const c = (j.extensions && j.extensions.cost) || {}, t = c.throttleStatus || {};
      const need = (c.requestedQueryCost || 1000) - (t.currentlyAvailable || 0), rate = t.restoreRate || 500;
      await new Promise((ok) => setTimeout(ok, Math.min(12000, Math.max(1500, (need / rate) * 1000 + 500))));
      continue;
    }
    if (!r.ok || j.errors) throw new Error("Jobber: " + ((j.errors || []).map((e) => e.message).join("; ") || r.status));
    return j.data;
  }
}
const JOB_FIELDS = `id jobNumber title instructions createdAt startAt completedAt total jobberWebUri
  client { id name }
  property { address { street1 street2 city province postalCode } }
  lineItems(first: 12) { nodes { name description totalPrice } }`;
const VISIT_FIELDS = `visits(first: 3) { nodes { assignedUsers(first: 4) { nodes { name { full } } } } }`;
let NO_USERS = false; // the Jobber app can't see who jobs are assigned to

/* Jobs assigned in Jobber to these people go to their crew on the board.
   Anyone else (like Raul) stays unassigned so a manager can place it by hand. */
const AUTO_CREW = ["kilmar bonilla"];
const assigneesOf = (j) => [...new Set(((j.visits && j.visits.nodes) || []).flatMap((v) => ((v.assignedUsers && v.assignedUsers.nodes) || []).map((u) => String((u.name && u.name.full) || "").trim().toLowerCase())).filter(Boolean))];
function crewFinder(staff, crews) {
  return (fullName) => {
    const first = fullName.split(/\s+/)[0];
    const p = staff.find((x) => x.active !== false && x.crew && (String(x.name).toLowerCase() === fullName || String(x.name).toLowerCase().split(/\s+/)[0] === first));
    if (p) return p.crew;
    const c = crews.find((c) => (c.members || []).some((m) => { const n = String(m).toLowerCase().trim(); return n === fullName || n.split(/\s+/)[0] === first; }));
    return c ? c.id : "";
  };
}
async function fetchJobs(token, since) {
  const out = [];
  const run = async (filtered) => {
    let after = null;
    for (let page = 0; page < 60; page++) {
      const q = filtered
        ? `query($a:String,$s:ISO8601DateTime!){ jobs(first:20, after:$a, filter:{createdAt:{after:$s}}){ nodes{ ${JOB_FIELDS} ${NO_USERS ? "" : VISIT_FIELDS} } pageInfo{ hasNextPage endCursor } } }`
        : `query($a:String){ jobs(first:20, after:$a){ nodes{ ${JOB_FIELDS} ${NO_USERS ? "" : VISIT_FIELDS} } pageInfo{ hasNextPage endCursor } } }`;
      const d = await gql(token, q, filtered ? { a: after, s: since } : { a: after });
      out.push(...d.jobs.nodes);
      if (!d.jobs.pageInfo.hasNextPage) return;
      after = d.jobs.pageInfo.endCursor;
    }
  };
  const attempt = async (filtered) => {
    try { await run(filtered); }
    catch (e) { if (!NO_USERS && /User.*hidden|hidden due to permissions/i.test(e.message)) { NO_USERS = true; out.length = 0; await run(filtered); } else throw e; }
  };
  try { await attempt(true); }
  catch (e) { if (!/filter|createdAt|argument|ISO8601/i.test(e.message)) throw e; out.length = 0; await attempt(false); }
  return out.filter((j) => !j.createdAt || j.createdAt >= since);
}

/* ---------- which Jobber jobs are ProLight's ---------- */
const LIGHT = /holiday|christmas|light|wreath|garland|c9|c7|mini|bulb|column wrap|letter wrap|tree install|halloween/i;
const NOT_LIGHT = /wash|concrete|gutter|paver|window|deck|patio|fence|clean|seal|drain|screen|mailbox|swing|shed|car ?port|porch|basin/i;
const BOILER = /^we provide the lights, install them/i;
function classify(j) {
  const title = j.title || "", client = (j.client && j.client.name) || "";
  if (/tallahassee christmas lights/i.test(client) || /^\s*tcl\b/i.test(title)) return { skip: "tcl" };
  if (/\btest\b/i.test(client) || /\btest\b/i.test(title)) return { skip: "test" };
  const lines = (j.lineItems && j.lineItems.nodes) || [];
  const lightLines = lines.filter((l) => LIGHT.test(l.name || "") && !/roof wash|house wash/i.test(l.name || ""));
  const saysLight = /pro\s?light/i.test(title), saysWash = /pro\s?wash|prewash/i.test(title);
  if (!saysLight && !lightLines.length) return { skip: "prowash" };
  if (saysLight && !saysWash && !lightLines.length && lines.some((l) => NOT_LIGHT.test(l.name || ""))) return { skip: "prowash" };
  const mine = saysLight && !saysWash ? lines : lightLines;
  const other = lines.filter((l) => !mine.includes(l)).reduce((t, l) => t + (+l.totalPrice || 0), 0);
  return { lines: mine, washTotal: other };
}
const money = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
function scopeOf(lines) {
  const desc = (l) => { const d = String(l.description || "").replace(/\s+/g, " ").trim(); return d && !BOILER.test(d) ? d : ""; };
  if (lines.length === 1) { const d = desc(lines[0]); return lines[0].name + (d ? ` (${d})` : ""); }
  return lines.map((l) => { const d = desc(l); return `${l.name} ${money(l.totalPrice)}${d ? ` (${d})` : ""}`; }).join(" + ");
}
const localDate = (iso) => iso ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "";
const addr = (p) => { const a = (p && p.address) || {}; return [[a.street1, a.street2].filter(Boolean).join(" "), a.city, [a.province, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "); };
const webId = (j) => { const m = String(j.jobberWebUri || "").match(/work_orders\/(\d+)/); if (m) return m[1]; try { return Buffer.from(j.id, "base64").toString().split("/").pop(); } catch (e) { return j.id; } };
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/* ---------- mockup photos from the job's notes ----------
   Jobber's note/attachment types are discovered from the API itself (introspection),
   so this keeps working whatever the exact type names are. */
const TT = "fragment T on __Type { name kind ofType { name kind ofType { name kind ofType { name kind } } } }";
const unwrap = (t) => { while (t && (t.kind === "NON_NULL" || t.kind === "LIST")) t = t.ofType; return t; };
const isList = (t) => { for (; t; t = t.ofType) if (t.kind === "LIST") return true; return false; };
const typeQ = async (token, name) => (await gql(token, `query($n:String!){ __type(name:$n){ name kind possibleTypes{ name } fields{ name args{ name } type{ ...T } } } } ${TT}`, { n: name })).__type;
let NOTEQ = null;
async function notesSel(token, nf) {
  // returns "notes(first:30){ nodes { ...fragments } }" for a notes field, or "" if it has no attachments
  const conn = await typeQ(token, unwrap(nf.type).name);
  const nodesF = conn && conn.fields && conn.fields.find((f) => f.name === "nodes");
  if (!nodesF) return "";
  const noteT = await typeQ(token, unwrap(nodesF.type).name);
  const members = noteT.kind === "OBJECT" ? [noteT] : await Promise.all((noteT.possibleTypes || []).map((t) => typeQ(token, t.name)));
  const frags = [];
  for (const m of members) {
    const af = (m.fields || []).find((f) => /attachment/i.test(f.name)) || (m.fields || []).find((f) => /^files?$/i.test(f.name));
    if (!af) continue;
    let ft = await typeQ(token, unwrap(af.type).name), viaNodes = false;
    const n2 = !isList(af.type) && ft.fields && ft.fields.find((f) => f.name === "nodes");
    if (n2) { ft = await typeQ(token, unwrap(n2.type).name); viaNodes = true; }
    const has = (n) => ft.fields.some((f) => f.name === n);
    const pick = ["url", "fileName", "contentType", "name", "fileSize"].filter(has);
    if (!pick.includes("url")) { const u = ft.fields.find((f) => /url/i.test(f.name)); if (u) pick.push(u.name); else continue; }
    const args = af.args && af.args.some((x) => x.name === "first") ? "(first:8)" : "";
    const msg = (m.fields || []).some((f) => f.name === "message") ? " message" : "";
    frags.push(`... on ${m.name} { __typename${msg} ${af.name}${args} { ${viaNodes ? `nodes { ${pick.join(" ")} }` : pick.join(" ")} } }`);
  }
  if (!frags.length) return "";
  const nargs = nf.args && nf.args.some((x) => x.name === "first") ? "(first:15)" : "";
  return `notes${nargs} { nodes { ${frags.join(" ")} } }`;
}
async function noteQuery(token) {
  if (NOTEQ) return NOTEQ;
  // Photos can live on the job's notes or on notes from its client, quote, request or property.
  // Each is asked for separately so a missing permission on one doesn't block the others.
  const job = await typeQ(token, "Job");
  const parts = [];
  const nf = job.fields.find((f) => f.name === "notes");
  if (nf) { const sel = await notesSel(token, nf); if (sel) parts.push({ where: "job", q: `query($id:EncodedId!){ job(id:$id){ ${sel} } }` }); }
  for (const rel of ["client", "quote", "request", "property"]) {
    const rf = job.fields.find((f) => f.name === rel);
    if (!rf) continue;
    const rt = await typeQ(token, unwrap(rf.type).name);
    const rn = rt && rt.fields && rt.fields.find((f) => f.name === "notes");
    if (!rn) continue;
    const sel = await notesSel(token, rn).catch(() => "");
    if (sel) parts.push({ where: rel, q: `query($id:EncodedId!){ job(id:$id){ ${rel} { ${sel} } } }` });
  }
  if (!parts.length) throw new Error("Couldn't find photo attachments on Jobber notes");
  NOTEQ = parts;
  return NOTEQ;
}
const NO_ACCESS = new Set();
function filesFrom(list) {
  const out = [], seen = new Set(), by = {};
  for (const [where, notes] of list) {
    by[where] = by[where] || { notes: 0, files: 0, text: [] };
    for (const n of ((notes && notes.nodes) || [])) {
      if (!n) continue;
      by[where].notes++;
      if (n.message) by[where].text.push(String(n.message).replace(/\s+/g, " ").slice(0, 80));
      for (const [k, v] of Object.entries(n)) {
        if (k === "__typename" || k === "message" || !v || typeof v !== "object") continue;
        for (const f of (Array.isArray(v) ? v : v.nodes || [])) {
          const url = f && (f.url || Object.entries(f).find(([kk, vv]) => /url/i.test(kk) && vv)?.[1]);
          if (!url) continue;
          by[where].files++;
          const key = (f.fileName || f.name || "") + "|" + (f.fileSize || url);
          if (seen.has(key)) continue; seen.add(key);
          out.push({ url, fileName: f.fileName || f.name || "", contentType: f.contentType || "" });
        }
      }
    }
  }
  out.by = by;
  return out;
}
async function jobFiles(token, jobId) {
  const got = [];
  for (const p of await noteQuery(token)) {
    if (NO_ACCESS.has(p.where)) continue;
    try {
      const d = await gql(token, p.q, { id: jobId });
      const j = (d && d.job) || {};
      got.push([p.where, p.where === "job" ? j.notes : j[p.where] && j[p.where].notes]);
    } catch (e) {
      if (/permission|hidden|access|unauthori[sz]ed/i.test(e.message)) { NO_ACCESS.add(p.where); continue; }
      throw e;
    }
  }
  const out = filesFrom(got); out.noAccess = [...NO_ACCESS];
  return out;
}
const kindOf = (f) => /^image\//.test(f.contentType || "") || /\.(jpe?g|png|heic|webp|gif)$/i.test(f.fileName || "") ? "image"
  : /pdf/.test(f.contentType || "") || /\.pdf$/i.test(f.fileName || "") ? "pdf"
  : /^video\//.test(f.contentType || "") || /\.(mov|mp4|m4v)$/i.test(f.fileName || "") ? "video" : null;
async function copyFiles(token, j, wid) {
  const files = (await jobFiles(token, j.id)).filter(kindOf).slice(0, 12), out = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], r = await fetch(f.url);
    if (!r.ok) { copyFiles.fail = `couldn't download ${f.fileName || "a file"} (${r.status})`; continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 45e6) continue;
    const path = `jobber/${wid}/${i + 1}-${String(f.fileName || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80)}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/media/${path}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": f.contentType || "application/octet-stream", "x-upsert": "true" }, body: buf });
    if (!up.ok) copyFiles.fail = `couldn't save ${f.fileName || "a file"} to the board (${up.status})`;
    if (up.ok) out.push({ id: path, type: kindOf(f), name: f.fileName || "Mockup", from: "Jobber" });
  }
  return out;
}

/* Completions: read finished VISITS from Jobber (a job can stay open for invoicing long after the crew is done),
   including TCL jobs, and check them off on the board. Covers jobs created any time, not just recent ones. */
const VISIT_DONE = `id title startAt completedAt isLastScheduledVisit job { id jobNumber title jobberWebUri client { name } }`;
async function fetchDoneVisits(token, since) {
  const out = [];
  const tries = [["completedAt", VISIT_DONE], ["completedAt", VISIT_DONE.replace(" isLastScheduledVisit", "")], ["startAt", VISIT_DONE.replace(" isLastScheduledVisit", "")]];
  for (const [mode, fields] of tries) {
    try {
      let after = null;
      for (let page = 0; page < 12; page++) {
        const d = await gql(token, `query($a:String,$s:ISO8601DateTime!){ visits(first:50, after:$a, filter:{${mode}:{after:$s}}){ nodes{ ${fields} } pageInfo{ hasNextPage endCursor } } }`, { a: after, s: since });
        out.push(...d.visits.nodes.filter((v) => v.completedAt));
        if (!d.visits.pageInfo.hasNextPage) break;
        after = d.visits.pageInfo.endCursor;
      }
      return out;
    } catch (e) { if (mode === "startAt") throw e; out.length = 0; }
  }
  return out;
}
const tclName = (t) => String(t || "").replace(/^\s*tcl\s*[-–:]?\s*/i, "").replace(/\s*[-–(].*$/, "").trim();
const NOT_INSTALL = /\b(fix|call ?back|repair|service call|touch ?up|bulbs? out)\b/i;
function completions(visits, boardJobs, boardClients, boardLog, byWeb) {
  const rows = [], names = [], dels = [];
  const doneKey = new Set(boardLog.filter((l) => l.data.kind === "done").map((l) => l.data.jobId + "|" + l.data.visitId));
  const have = new Set(boardLog.map((l) => l.id));
  const tclClients = new Map(); for (const c of boardClients) if (c.data.source === "tcl") tclClients.set(norm(c.data.name), c.id);
  const jobOfClient = new Map(); for (const d of boardJobs) if (d.data.source === "tcl" && d.data.clientId) jobOfClient.set(d.data.clientId, d);
  for (const v of visits) {
    const vid = webId({ id: v.id }), logId = "jbv-" + vid;
    const j = v.job || {}, title = v.title || j.title || "";
    // wash visits, fix-ups and day 1 of a multi-day install don't finish the light job
    const notDone = /pro\s?wash|prewash|house wash|roof wash|pressure/i.test(title) || NOT_INSTALL.test(title) || v.isLastScheduledVisit === false;
    if (have.has(logId)) { if (notDone) dels.push(logId); continue; }
    if (notDone) continue;
    let board = byWeb.get(webId(j));
    if ((!board || !board.data || !board.data.clientId) && /^\s*tcl\b/i.test(title)) { const cid = tclClients.get(norm(tclName(title))) || tclClients.get(norm(tclName(j.title))); board = cid && jobOfClient.get(cid); }
    if (!board || !board.data || !board.data.clientId) continue;
    // TCL jobs went back to TCL (Nov 11): our crews check off their own TCL work on the board; Jobber never does it for them
    if (board.data.source === "tcl") continue;
    const visits = board.data.visits || [], inst = visits.find((x) => x.type === "install") || { id: "inst" }, down = visits.find((x) => x.type === "takedown");
    let target = null;
    if (!doneKey.has(board.id + "|" + inst.id)) target = inst.id;
    else if (down && !doneKey.has(board.id + "|" + down.id) && /-(12|01|02)-/.test(String(v.startAt || ""))) target = down.id;
    if (!target) continue;
    rows.push({ coll: "log", id: logId, data: { jobId: board.id, visitId: target, kind: "done", by: "jobber", at: v.completedAt, note: "Marked complete in Jobber" } });
    doneKey.add(board.id + "|" + target); names.push(/^\s*tcl\b/i.test(title) ? tclName(title) : title.trim());
  }
  return { rows, names, dels };
}
/* ---------- board → Jobber: when a job is checked off on the board, complete the visit in Jobber
   and add the crew's notes, photos and videos to the job's notes. ---------- */
const PUSH_FROM = "2026-11-01T03:30:00Z"; // only check-offs made after this went live
const gidJob = (wid) => Buffer.from("gid://Jobber/Job/" + wid).toString("base64");
const pubUrl = (id) => SB_URL + "/storage/v1/object/public/media/" + String(id).split("/").map(encodeURIComponent).join("/");
async function markLogged(key) { await sb("/rest/v1/push_log", { method: "POST", headers: { Prefer: "return=minimal,resolution=ignore-duplicates" }, body: JSON.stringify({ key }) }).catch(() => {}); }
const errs = (p) => ((p && p.userErrors) || []).map((e) => e.message).join("; ");
async function findTclJob(token, name, date) {
  const since = new Date(Date.parse((date || new Date().toISOString().slice(0, 10)) + "T00:00:00Z") - 21 * 864e5).toISOString();
  let after = null;
  for (let page = 0; page < 8; page++) {
    const d = await gql(token, `query($a:String,$s:ISO8601DateTime!){ visits(first:50, after:$a, filter:{startAt:{after:$s}}){ nodes{ title job{ jobberWebUri title } } pageInfo{ hasNextPage endCursor } } }`, { a: after, s: since });
    const hit = d.visits.nodes.find((v) => /^\s*tcl\b/i.test(v.title || (v.job || {}).title || "") && norm(tclName(v.title || v.job.title)) === norm(name));
    if (hit) return (String(hit.job.jobberWebUri || "").match(/work_orders\/(\d+)/) || [])[1] || "";
    if (!d.visits.pageInfo.hasNextPage) break; after = d.visits.pageInfo.endCursor;
  }
  return "";
}
async function pushToJobber(opts = {}) {
  const res = { completed: [], notes: 0, files: 0, errors: [] };
  const conn = await getInt("jobber"); if (!conn || !conn.refresh_token) return { skipped: "Jobber not connected" };
  const since = new Date(Math.max(Date.parse(PUSH_FROM), Date.now() - 10 * 864e5)).toISOString();
  const logs = await sb(`/rest/v1/docs?coll=eq.log&updated_at=gte.${encodeURIComponent(since)}&select=id,data`);
  const sent = new Set((await sb("/rest/v1/push_log?key=like.jbpush:*&select=key").catch(() => [])).map((r) => r.key));
  const logged = async (k) => sent.has(k);
  const who = (id) => ((staff.find((p) => p.id === id) || {}).name || "Crew");
  const cname = (j) => ((clients.find((c) => c.id === j.data.clientId) || {}).data || {}).name || "";
  const mine = logs.filter((l) => l.data.by && l.data.by !== "jobber" && String(l.data.at || "") >= PUSH_FROM && !l.data.pending);
  const dones = mine.filter((l) => l.data.kind === "done");
  const doneJobs = new Set(logs.filter((l) => l.data.kind === "done").map((l) => l.data.jobId));
  const notes = mine.filter((l) => (l.data.kind === "note" || l.data.kind === "issue") && doneJobs.has(l.data.jobId));
  const work = [...new Set([...dones, ...notes].filter((l) => !sent.has("jbpush:" + l.id)).map((l) => l.data.jobId))];
  if (!work.length) return res;
  const [jobs, clients, staff] = await Promise.all([allDocs("jobs"), allDocs("clients"), sb("/rest/v1/staff?select=id,name").catch(() => [])]);
  let token = null;
  for (const jid of work.slice(0, opts.max || 4)) {
    const job = jobs.find((j) => j.id === jid); if (!job) continue;
    const todoDone = []; for (const l of dones.filter((x) => x.data.jobId === jid)) if (!(await logged("jbpush:" + l.id))) todoDone.push(l);
    const todoNotes = []; for (const l of notes.filter((x) => x.data.jobId === jid)) if (!(await logged("jbpush:" + l.id))) todoNotes.push(l);
    if (!todoDone.length && !todoNotes.length) continue;
    try {
      token = token || await accessToken();
      let wid = (String(job.data.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1];
      if (!wid && job.data.source === "tcl") {
        const v0 = (job.data.visits || []).find((v) => v.type === "install") || {};
        wid = await findTclJob(token, cname(job), v0.date);
        if (wid) { const fresh = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(jid)}&select=data`))[0]; await putDocs([{ coll: "jobs", id: jid, data: { ...((fresh && fresh.data) || job.data), jobberUrl: "https://secure.getjobber.com/work_orders/" + wid } }]); }
      }
      if (!wid) { for (const l of [...todoDone, ...todoNotes]) await markLogged("jbpush:" + l.id); res.errors.push(cname(job) + ": not in Jobber"); continue; }
      const jg = gidJob(wid);
      // 1. complete the matching visit
      for (const l of todoDone) {
        const bv = (job.data.visits || []).find((v) => v.id === l.data.visitId) || {};
        const d = await gql(token, `query($id:EncodedId!){ job(id:$id){ visits(first:30){ nodes{ id startAt completedAt } } } }`, { id: jg });
        const open = ((d.job && d.job.visits.nodes) || []).filter((v) => !v.completedAt).sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
        const pick = open.find((v) => bv.date && localDate(v.startAt) === bv.date) || (bv.type === "takedown" ? open[open.length - 1] : open[0]);
        if (pick) {
          const r = await gql(token, `mutation($v:EncodedId!,$at:ISO8601DateTime){ visitComplete(visitId:$v, input:{completedAt:$at}){ visit{ id } userErrors{ message } } }`, { v: pick.id, at: l.data.at });
          if (errs(r.visitComplete)) throw new Error(errs(r.visitComplete));
          res.completed.push(cname(job));
        }
      }
      // 2. one note with everything the crew posted, photos and videos attached
      const parts = [], files = [];
      for (const l of todoDone) parts.push(`✓ ${(job.data.visits || []).find((v) => v.id === l.data.visitId)?.type === "takedown" ? "Takedown" : "Install"} marked done on the ProLight board by ${who(l.data.by)} · ${new Date(l.data.at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${l.data.note ? "\n" + l.data.note : ""}`);
      for (const l of todoNotes.sort((a, b) => String(a.data.at).localeCompare(String(b.data.at)))) {
        const t = String(l.data.text || l.data.note || "").trim(), kind = l.data.kind === "issue" ? "Problem reported" + (l.data.reason ? " (" + l.data.reason + ")" : "") : "Note";
        if (t || (l.data.media || []).length) parts.push(`${kind} from ${who(l.data.by)}${t ? ": " + t : ""}`);
        for (const m of l.data.media || []) files.push({ url: pubUrl(m.id) });
      }
      for (const l of todoDone) for (const m of l.data.media || []) files.push({ url: pubUrl(m.id) });
      if (parts.length || files.length) {
        const message = ["From the ProLight board", ...parts].join("\n\n");
        const r = await gql(token, `mutation($j:EncodedId!,$in:JobCreateNoteInput!){ jobCreateNote(jobId:$j, input:$in){ jobNote{ id } userErrors{ message } } }`, { j: jg, in: { message, attachments: files.slice(0, 20) } });
        if (errs(r.jobCreateNote)) {
          // try the note on its own, then the files one by one
          const r2 = await gql(token, `mutation($j:EncodedId!,$in:JobCreateNoteInput!){ jobCreateNote(jobId:$j, input:$in){ jobNote{ id } userErrors{ message } } }`, { j: jg, in: { message } });
          if (errs(r2.jobCreateNote)) throw new Error(errs(r2.jobCreateNote));
          const nid = r2.jobCreateNote.jobNote.id;
          for (const f of files.slice(0, 20)) { const a = await gql(token, `mutation($n:EncodedId!,$j:EncodedId!,$f:[NoteAttachmentAttributes!]!){ jobNoteAddAttachment(noteId:$n, jobId:$j, noteAddAttachmentAttributes:$f){ userErrors{ message } } }`, { n: nid, j: jg, f: [f] }).catch((e) => ({ e })); if (!a.e && !errs(a.jobNoteAddAttachment)) res.files++; }
        } else res.files += Math.min(files.length, 20);
        res.notes++;
      }
      for (const l of [...todoDone, ...todoNotes]) await markLogged("jbpush:" + l.id);
    } catch (e) {
      const msg = String(e.message || e).slice(0, 200);
      res.errors.push(cname(job) + ": " + msg);
      if (/scope|permission|access|unauthori|forbidden/i.test(msg)) { res.needsWrite = true; break; }
    }
  }
  if (res.completed.length || res.notes || res.errors.length) await putInt("jobberPush", { at: new Date().toISOString(), ...res }).catch(() => {});
  return res;
}
async function sync(trigger, quick) {
  const t0 = Date.now();
  const conn = await getInt("jobber");
  if (!conn || !conn.refresh_token) throw new Error("Jobber isn't connected yet.");
  const token = await accessToken();
  const since = quick && conn.last ? new Date(Date.parse(conn.last.at) - 3 * 864e5).toISOString() : (conn.since || SINCE_DEFAULT);
  const jobs = await fetchJobs(token, since);
  const [boardJobs, boardClients, boardFin, boardLog] = await Promise.all(["jobs", "clients", "fin", "log"].map(allDocs));
  const byWeb = new Map(), clientByName = new Map(), clientByJobber = new Map();
  for (const d of boardJobs) { const m = String(d.data.jobberUrl || "").match(/work_orders\/(\d+)/); if (m) byWeb.set(m[1], d); }
  // a Jobber job that duplicates one already on the board is linked to it (jobberAlt) instead of becoming a second board job
  for (const d of boardJobs) for (const alt of d.data.jobberAlt || []) if (!byWeb.has(alt)) byWeb.set(alt, d);
  for (const c of boardClients) {
    if (c.data.source === "tcl") continue;
    if (c.data.jobberClientId) clientByJobber.set(c.data.jobberClientId, c);
    if (!clientByName.has(norm(c.data.name))) clientByName.set(norm(c.data.name), c);
  }
  const settings = await allDocs("settings"), crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [];
  const ignored = new Set((((settings.find((d) => d.id === "jobber-ignore") || {}).data || {}).ids) || []);
  const staff = await sb("/rest/v1/staff?select=id,name,crew,active").catch(() => []);
  const crewFor = crewFinder(staff, crews);
  const autoCrew = (j) => { for (const n of assigneesOf(j)) if (AUTO_CREW.includes(n)) { const c = crewFor(n); if (c) return c; } return ""; };
  const fin = new Map(boardFin.map((f) => [f.id, f.data])), done = new Set(boardLog.filter((l) => l.data.kind === "done").map((l) => l.data.jobId));
  const now = new Date().toISOString(), rows = [], res = { added: 0, updated: 0, assigned: 0, prowash: 0, tcl: 0, test: 0, photos: 0, names: [] };
  const media = []; // [jobber job, web id, board doc id, board data]

  for (const j of jobs) {
    const k = classify(j);
    if (k.skip) { res[k.skip]++; continue; }
    const wid = webId(j), price = k.lines.reduce((t, l) => t + (+l.totalPrice || 0), 0), date = localDate(j.startAt);
    const existing = byWeb.get(wid);
    if (existing) {
      // Only fill in what's still blank on the board. Never overwrite your edits.
      const d = JSON.parse(JSON.stringify(existing.data)); let ch = false;
      const v = (d.visits || []).find((x) => x.type === "install");
      // install dates are set on the board, not taken from Jobber
      if (!d.crew) { const c = autoCrew(j); if (c) { d.crew = c; ch = true; res.assigned++; } }
      if (ch) { d.updatedAt = now; rows.push({ coll: "jobs", id: existing.id, data: d }); }
      const f = fin.get(existing.id);
      { const w = Math.round((k.washTotal || 0) * 100) / 100; if ((+d.washTotal || 0) !== w && (w || d.washTotal)) { d.washTotal = w; d.updatedAt = now; if (!rows.some((r) => r.coll === "jobs" && r.id === existing.id)) rows.push({ coll: "jobs", id: existing.id, data: d }); ch = true; } }
      if (f && f.price && k.washTotal && price > 0 && Math.abs(+f.price - (+j.total || 0)) < 0.01 && Math.abs(+f.price - price) >= 0.01) { rows.push({ coll: "fin", id: existing.id, data: { ...f, price } }); ch = true; }
      else if ((!f || !f.price) && price > 0) { rows.push({ coll: "fin", id: existing.id, data: { ...(f || { invoiceNo: "", collected: false, ssPaid: false }), price, privateNote: (f && f.privateNote) || "From Jobber #" + j.jobNumber } }); ch = true; }
      // a job closed in Jobber without a completed visit (e.g. a duplicate closed out) is not an install; completed visits are handled by completions()
      if (ch) res.updated++;
      if (!(d.mockups || []).length && d.jobberMediaV !== 4) media.push([j, wid, existing.id, d]);
      continue;
    }
    // jobs deleted on the board stay deleted
    if (ignored.has(wid)) { res.ignored = (res.ignored || 0) + 1; continue; }
    const cname = (j.client && j.client.name) || "Customer", jcid = j.client && j.client.id;
    let client = clientByJobber.get(jcid) || clientByName.get(norm(cname));
    // same client + same price as a ProLight job already on the board → it's the same job entered twice in Jobber: link, don't copy
    if (client && price > 0) {
      const twin = boardJobs.find((d) => d.data.clientId === client.id && d.data.source !== "tcl" && d.data.stage !== "cancelled" && Math.abs((+((fin.get(d.id) || {}).price) || 0) - price) < 1);
      if (twin) { const d = JSON.parse(JSON.stringify(twin.data)); d.jobberAlt = [...new Set([...(d.jobberAlt || []), wid])]; d.updatedAt = now; twin.data = d; byWeb.set(wid, twin); rows.push({ coll: "jobs", id: twin.id, data: d }); res.dupLinked = (res.dupLinked || 0) + 1; (res.dupNames = res.dupNames || []).push(cname); continue; }
    }
    const a = addr(j.property);
    if (!client) {
      client = { id: "jbc-" + wid, data: { name: cname, address: a, phone: "", email: "", gate: "", notes: "", source: "prolight", importedFrom: "Jobber", jobberClientId: jcid || "", createdAt: now } };
      rows.push({ coll: "clients", id: client.id, data: client.data });
      clientByName.set(norm(cname), client); if (jcid) clientByJobber.set(jcid, client);
    }
    const id = "jb-" + wid;
    const notes = [j.instructions || "", k.washTotal ? `Jobber job also has ${money(k.washTotal)} of ProWash work (not imported).` : ""].filter(Boolean).join(" ");
    rows.push({ coll: "jobs", id, data: {
      clientId: client.id, address: a && norm(a) !== norm(client.data.address) ? a : "", source: "prolight", stage: "booked", crew: autoCrew(j),
      scope: scopeOf(k.lines), notes, season: String(new Date().getFullYear()), rooflineFt: "", links: [], mockups: [], priority: "",
      importedFrom: "Jobber", jobberNo: String(j.jobNumber || ""), jobberUrl: j.jobberWebUri || "", createdAt: now, updatedAt: now, washTotal: Math.round((k.washTotal || 0) * 100) / 100,
      visits: [{ id: "inst", type: "install", date: "", time: "", crew: "", note: "", order: null }], jobberStart: date || "" } });
    rows.push({ coll: "fin", id, data: { price, invoiceNo: "", privateNote: "From Jobber #" + j.jobNumber, collected: false, ssPaid: false } });
    if (j.completedAt) rows.push({ coll: "log", id: "jbdone-" + wid, data: { jobId: id, visitId: "inst", kind: "done", by: "jobber", at: j.completedAt } });
    byWeb.set(wid, { id, data: {} });
    media.push([j, wid, id, rows.find((r) => r.coll === "jobs" && r.id === id).data]);
    res.added++; res.names.push(cname);
  }
  try {
    const doneSince = new Date(Date.now() - (quick ? 35 : 75) * 864e5).toISOString();
    const doneVisits = await fetchDoneVisits(token, doneSince);
    const c = completions(doneVisits, [...boardJobs, ...rows.filter((r) => r.coll === "jobs").map((r) => ({ id: r.id, data: r.data }))], boardClients, [...boardLog, ...rows.filter((r) => r.coll === "log").map((r) => ({ id: r.id, data: r.data }))], byWeb);
    // a check-off you undid on the board stays undone, even if Jobber still shows the visit complete
    const undone = new Set((((settings.find((d) => d.id === "jobber-undone") || {}).data || {}).ids) || []);
    c.rows = c.rows.filter((r) => !undone.has(r.id));
    rows.push(...c.rows); res.completed = c.rows.length; if (c.names.length) res.completedNames = c.names;
    for (const id of c.dels) { await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); }
    if (c.dels.length) res.uncompleted = c.dels.length;
    // a visit reopened in Jobber unchecks the board check-off Jobber had made (only inside the window we fully read)
    if (doneVisits.length < 590) {
      const stillDone = new Set(doneVisits.map((v) => "jbv-" + webId({ id: v.id })));
      const reopened = boardLog.filter((l) => /^jbv-/.test(l.id) && l.data.kind === "done" && String(l.data.at || "") >= doneSince && !stillDone.has(l.id));
      for (const l of reopened) await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(l.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      if (reopened.length) res.reopenedInJobber = reopened.length;
    }
  } catch (e) { res.completedError = String(e.message || e).slice(0, 200); }
  for (let i = 0; i < rows.length; i += 200) await putDocs(rows.slice(i, i + 200));
  // Photos: a few jobs per run so each sync stays quick; the rest come on the next sync.
  for (const [j, wid, id, d] of media) {
    if (Date.now() - t0 > 32e3) { res.photosLeft = (res.photosLeft || 0) + 1; continue; }
    try {
      const files = await copyFiles(token, j, wid);
      const fresh = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`))[0];
      const cur = (fresh && fresh.data) || d;
      await putDocs([{ coll: "jobs", id, data: { ...cur, mockups: [...(cur.mockups || []), ...files], jobberMediaAt: new Date().toISOString(), jobberMediaV: NO_ACCESS.size ? 3 : 4 } }]);
      res.photos += files.length;
      if (copyFiles.fail) { res.photoError = copyFiles.fail; copyFiles.fail = null; }
    } catch (e) { res.photoError = e.message.slice(0, 200); break; }
  }
  if (NO_ACCESS.size && !res.photoError) res.photoError = `Your Jobber app can't read ${[...NO_ACCESS].join(" and ")} notes yet. Add read access for them in the Jobber Developer Center, then tap Reconnect.`;
  if (NO_USERS) { try { const pl = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); res.tokenScopes = pl.scope || pl.scopes || Object.keys(pl).join(","); } catch (e) { res.tokenScopes = "unreadable"; }
    try { await gql(token, `{ users(first: 1) { nodes { id } } }`); res.usersQuery = "ok"; } catch (e) { res.usersQuery = e.message.slice(0, 160); } }
  if (NO_USERS) res.assignNote = "Jobber isn't sharing who jobs are assigned to, so Kilmar's jobs can't go to his crew yet. In the Jobber Developer Center, give the app read access to Users (team members), save, then tap Reconnect on the board.";
  const out = { at: now, trigger, seen: jobs.length, ...res, names: res.names.slice(0, 30) };
  if (res.added && process.env.VAPID_PRIVATE_KEY) {
    try {
      const N = require("./_lib/notify"), staff = await N.staffAll();
      if (await N.firstTime("sync:" + now)) await N.pushTo(staff.filter((p) => p.can_manage), "sync", (p) => N.lang(p) === "es"
        ? { title: `Jobber: ${res.added} trabajo${res.added > 1 ? "s" : ""} nuevo${res.added > 1 ? "s" : ""}`, body: res.names.slice(0, 4).join(", "), url: "/?go=jobs", tag: "sync" }
        : { title: `Jobber: ${res.added} new job${res.added > 1 ? "s" : ""}`, body: res.names.slice(0, 4).join(", "), url: "/?go=jobs", tag: "sync" });
    } catch (e) { /* notifications are best effort */ }
  }
  await putInt("jobber", { ...(await getInt("jobber")), last: out, lastError: null });
  return out;
}

/* ---------- timesheets: hours people clocked in Jobber ---------- */
async function hours(from, to) {
  const token = await accessToken();
  const t = await gql(token, `{ e: __type(name:"TimeSheetEntry"){ fields{ name } } f: __type(name:"TimeSheetEntryFilterAttributes"){ inputFields{ name } } q: __type(name:"Query"){ fields{ name } } }`);
  const qf = ((t.q && t.q.fields) || []).map((x) => x.name);
  if (!qf.includes("timeSheetEntries")) return { entries: [], error: "This Jobber account doesn't share timesheets with the board." };
  const have = new Set(((t.e && t.e.fields) || []).map((x) => x.name)), fil = new Set(((t.f && t.f.inputFields) || []).map((x) => x.name));
  const want = ["id", "startAt", "endAt", "finalDuration", "ticking", "note", "label"].filter((k) => have.has(k)).join(" ");
  const rel = [have.has("user") && "user { id name { full } }", have.has("job") && "job { id jobNumber title }", have.has("visit") && "visit { id title startAt }"].filter(Boolean).join(" ");
  const filter = fil.has("startAt") ? "filter:{ startAt:{ after:$a, before:$b } }," : "";
  const out = [];
  let after = null;
  for (let i = 0; i < 10; i++) {
    let d;
    try {
      d = await gql(token, `query($a:ISO8601DateTime!,$b:ISO8601DateTime!,$c:String){ timeSheetEntries(${filter} first:100, after:$c){ nodes{ ${want} ${rel} } pageInfo{ hasNextPage endCursor } } }`, { a: from, b: to, c: after });
    } catch (e) {
      if (/permission|scope|access|unauthori[sz]ed|hidden/i.test(e.message)) return { entries: [], error: "Jobber didn't share timesheets. In the Jobber developer app, turn on Timesheets (read), save, then tap Disconnect and Connect Jobber again on the board." };
      throw e;
    }
    const c = d.timeSheetEntries;
    out.push(...c.nodes.filter((n) => n.startAt >= from && n.startAt < to));
    if (!c.pageInfo.hasNextPage) break;
    after = c.pageInfo.endCursor;
  }
  return { entries: out.map((n) => ({ id: n.id, start: n.startAt, end: n.endAt || null, ticking: !!n.ticking, note: n.note || n.label || "", user: n.user ? (n.user.name && n.user.name.full) || "" : "", job: n.job ? { number: n.job.jobNumber, title: n.job.title || "" } : null, visit: n.visit ? n.visit.title || "" : "" })) };
}

/* ---------- routes ---------- */
module.exports = async (req, res) => {
  const action = String((req.query && req.query.action) || "");
  res.setHeader("Cache-Control", "no-store");
  if (!SB_KEY || !JB_ID || !JB_SECRET) return res.status(500).json({ error: "Jobber sync isn't set up yet. Add JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY in Vercel." });
  try {
    if (action === "callback") {
      const { code, state = "" } = req.query || {};
      const [ts, sig] = String(state).split(".");
      if (!code || !ts || sig !== sign(ts) || Date.now() - +ts > 20 * 60e3) return res.status(400).send("This Jobber link expired. Go back to the board and tap Connect Jobber again.");
      const t = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: callbackUrl(req) });
      const old = (await getInt("jobber")) || {};
      await putInt("jobber", { ...old, access_token: t.access_token, refresh_token: t.refresh_token, expires: jwtExp(t.access_token), connectedAt: new Date().toISOString() });
      let q = "connected";
      try { await sync("connect"); } catch (e) { q = "error"; await putInt("jobber", { ...(await getInt("jobber")), lastError: e.message }); }
      res.writeHead(302, { Location: "/?jobber=" + q }); return res.end();
    }
    if (action === "push") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      return res.status(200).json(await pushToJobber({ max: 6 }));
    }
    if (action === "payplan") {
      // one-time: new pay plans starting Mon Nov 2 (Raul: 3% management fee only; ProLight techs: $20/hr + 4% of jobs they complete)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const FROM = "2026-11-02", dry = !!req.query.dry;
      const [staff, settings, finRows] = await Promise.all([sb("/rest/v1/staff?select=id,name,crew,active,can_manage,partner"), allDocs("settings"), sb("/rest/v1/docs?coll=eq.fin&id=eq.payroll&select=data")]);
      const crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [], plCrews = crews.filter((c) => c.co === "prolight").map((c) => c.id);
      const pay = (finRows[0] || {}).data || {}, rates = { ...(pay.rates || {}) }, set = (id, plan) => { const r = { ...(rates[id] || {}) }; r.plans = [...(r.plans || []).filter((p) => p.from !== FROM), { from: FROM, ...plan }]; rates[id] = r; };
      const out = { raul: [], techs: [], skipped: [] };
      for (const p of staff.filter((x) => x.active)) {
        const first = String(p.name || "").trim().split(/\s+/)[0].toLowerCase();
        if (first === "raul") { set(p.id, { rate: 0, jobPct: 0, mgmtPct: 3 }); out.raul.push(p.name); continue; }
        if (first === "test") { out.skipped.push(p.name); continue; }
        if (!p.can_manage && p.partner !== "shipshape" && !["jarrod", "brayden"].includes(first) && plCrews.includes(p.crew === "prolight" ? "pl1" : String(p.crew || ""))) { set(p.id, { rate: 20, jobPct: 4, mgmtPct: 0 }); out.techs.push(p.name); }
        else out.skipped.push(p.name);
      }
      if (!dry) await putDocs([{ coll: "fin", id: "payroll", data: { ...pay, rates } }]);
      return res.status(200).json({ dry, from: FROM, ...out });
    }
    if (action === "hqrows") {
      // dry look at the HQ install export: counts and checks only, no names or dollars (logs are public)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const { rows } = await require("./_lib/hq").buildRows(+req.query.q || 14);
      const st = (await sb("/rest/v1/docs?coll=eq.fin&id=eq.hq-export&select=data"))[0];
      const byJob = {}; for (const r of rows) (byJob[r.install_id.split("-20")[0]] = byJob[r.install_id.split("-20")[0]] || []).push(r);
      const dupIds = rows.length - new Set(rows.map((r) => r.install_id)).size;
      return res.status(200).json({ rows: rows.length, statuses: rows.reduce((t, r) => ((t[r.status] = (t[r.status] || 0) + 1), t), {}), days: [...new Set(rows.map((r) => r.date))].sort(), installers: new Set(rows.map((r) => r.installer)).size, withJobberNo: rows.filter((r) => r.jobber_job_number).length, withHours: rows.filter((r) => r.hours).length, duplicateIds: dupIds, keySet: !!process.env.INSTALL_INGEST_KEY, live: !!(st && st.data.live), lastLog: st && (st.data.log || []).slice(0, 3) });
    }
    if (action === "undate") {
      // clear Jobber-imported install dates on the given board jobs (q = id,id); only undone install visits
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const ids = String(req.query.q || "").split(",").filter(Boolean), out = [], rows = [], now = new Date().toISOString();
      const done = new Set((await sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=data")).map((l) => l.data.jobId + "|" + l.data.visitId));
      for (const id of ids) {
        const r = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`))[0]; if (!r) { out.push({ id, error: "not found" }); continue; }
        const d = r.data; let n = 0;
        for (const v of d.visits || []) if (v.type === "install" && v.date && !done.has(id + "|" + v.id)) { v.date = ""; v.time = ""; v.order = null; v.unscheduledAt = now; n++; }
        if (n) { d.updatedAt = now; rows.push({ coll: "jobs", id, data: d }); } out.push({ id, cleared: n });
      }
      await putDocs(rows); return res.status(200).json({ out });
    }
    if (action === "jbscope") {
      // which permissions the Jobber connection has, and what the schema offers for editing visits (no customer data)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const token = await accessToken(); let claims = {}; try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()); } catch (e) {}
      const m = await gql(token, `{ __type(name:"Mutation"){ fields{ name args{ name type{ name ofType{ name } } } } } }`).catch((e) => ({ err: e.message }));
      const fields = ((m.__type || {}).fields || []).filter((f) => /visit/i.test(f.name)).map((f) => f.name + "(" + f.args.map((a) => a.name + ":" + (a.type.name || (a.type.ofType || {}).name)).join(",") + ")");
      const inp = await gql(token, `{ a:__type(name:"VisitEditInput"){ inputFields{ name type{ name kind ofType{ name } } } } b:__type(name:"VisitEditScheduleInput"){ inputFields{ name type{ name ofType{ name } } } } c:__type(name:"LocalDateTimeAttributes"){ inputFields{ name type{ name kind ofType{ name } } } } d:__type(name:"VisitEditSchedulePayload"){ fields{ name } } }`).catch((e) => ({ err: e.message }));
      const ds = ((await sb("/rest/v1/docs?coll=eq.fin&id=eq.jb-dates&select=data"))[0] || {}).data || {};
      return res.status(200).json({ scope: claims.scope || claims.scopes || Object.keys(claims), dateSync: { seeded: !!ds.seeded, seededAt: ds.seededAt, jobs: Object.keys(ds.jobs || {}).length }, ...(req.query.q === "full" ? { visitMutations: fields, visitEditInput: inp } : {}) });
    }
    if (action === "staffplans") {
      // staff names, crews and pay plans (names only; plans are rates/percentages)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [staff, pay, settings] = await Promise.all([sb("/rest/v1/staff?select=id,name,crew,active,partner,can_manage"), sb("/rest/v1/docs?coll=eq.fin&id=eq.payroll&select=data"), allDocs("settings")]);
      const crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [], rates = (((pay[0] || {}).data || {}).rates) || {};
      return res.status(200).json({ crews: crews.map((c) => ({ id: c.id, name: c.name, co: c.co })), staff: staff.filter((p) => p.active).map((p) => ({ id: p.id.slice(0, 8), name: p.name, crew: p.crew, partner: p.partner || "", plans: (rates[p.id] || {}).plans || [], rate: (rates[p.id] || {}).rate })) });
    }
    if (action === "setplans") {
      // pay plans from Nov 2 per Raul's boss (Nov 5): Manuel $27/hr; Samuel (Sam) 10% of installs split by crew; Raul 3% + 10% on own installs
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const FROM = "2026-11-02", dry = !!req.query.dry;
      const [staff, finRows] = await Promise.all([sb("/rest/v1/staff?select=id,name,active"), sb("/rest/v1/docs?coll=eq.fin&id=eq.payroll&select=data")]);
      const pay = (finRows[0] || {}).data || {}, rates = { ...(pay.rates || {}) }, out = [];
      const set = (re, plan) => { const p = staff.find((x) => x.active && re.test(String(x.name || ""))); if (!p) { out.push({ who: String(re), missing: true }); return; } const r = { ...(rates[p.id] || {}) }; r.plans = [...(r.plans || []).filter((q) => q.from !== FROM), { from: FROM, ...plan }].sort((a, b) => a.from.localeCompare(b.from)); rates[p.id] = r; out.push({ name: p.name, plan }); };
      set(/^manuel\b/i, { rate: 27, jobPct: 0, mgmtPct: 0 });
      set(/^sam(uel)?\b/i, { rate: 0, jobPct: 10, mgmtPct: 0, pctSplit: "crew" });
      set(/^raul\b/i, { rate: 0, jobPct: 0, mgmtPct: 3, selfLabor: 10 });
      if (!dry) await putDocs([{ coll: "fin", id: "payroll", data: { ...pay, rates } }]);
      return res.status(200).json({ dry, from: FROM, out });
    }
    if (action === "custompay") {
      // q = jobId~Name:fraction,Name:fraction[~YYYY-MM-DD:CrewName]  → custom pay split on the job, optionally add an install day for a crew
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [jid, sharesTxt, dayTxt] = String(req.query.q || "").split("~");
      const [staff, jr, fr, settings] = await Promise.all([sb("/rest/v1/staff?select=id,name,active"), sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(jid)}&select=data`), sb(`/rest/v1/docs?coll=eq.fin&id=eq.${encodeURIComponent(jid)}&select=data`), allDocs("settings")]);
      if (!jr[0]) return res.status(404).json({ error: "no job" });
      const frac = (s) => { const m = String(s).match(/^(\d+)\/(\d+)$/); return m ? +m[1] / +m[2] : +s; };
      const shares = {}, named = [];
      for (const part of String(sharesTxt || "").split(",").filter(Boolean)) { const [n, f] = part.split(":"); const p = staff.find((x) => x.active && String(x.name || "").toLowerCase().startsWith(n.toLowerCase())); if (!p) return res.status(400).json({ error: "who is " + n }); shares[p.id] = Math.round(frac(f) * 1e6) / 1e6; named.push(p.name + " " + f); }
      const job = jr[0].data, rows = [], now = new Date().toISOString(); let added = null;
      if (dayTxt) { const [d, cn] = dayTxt.split(":"); const crews = ((settings.find((x) => x.id === "board") || {}).data || {}).crews || []; const c = crews.find((x) => String(x.name).toLowerCase() === String(cn || "").toLowerCase());
        if (!(job.visits || []).some((v) => v.type === "install" && v.date === d)) { job.visits = [...(job.visits || []), { id: "d" + Date.now().toString(36), type: "install", date: d, time: "", crew: c ? c.id : "", crews: [], note: "", order: null }]; job.updatedAt = now; rows.push({ coll: "jobs", id: jid, data: job }); added = { date: d, crew: c ? c.name : "" }; } }
      rows.push({ coll: "fin", id: jid, data: { ...((fr[0] || {}).data || {}), custom: { shares, at: now, by: "office" } } });
      await putDocs(rows);
      return res.status(200).json({ job: jid, shares: named, addedDay: added, installDays: (job.visits || []).filter((v) => v.type === "install").map((v) => v.date || "-") });
    }
    if (action === "stats") {
      // job value stats, encrypted to the caller's public key (q = base64url of an RSA public key PEM) so nothing readable lands in public logs
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const pem = Buffer.from(String(req.query.q || ""), "base64url").toString();
      const [jobs, fins] = await Promise.all([allDocs("jobs"), allDocs("fin")]);
      const fin = new Map(fins.map((f) => [f.id, f.data])), rows = [];
      for (const j of jobs) { if (j.data.stage === "cancelled") continue; const p = +((fin.get(j.id) || {}).price) || 0; rows.push({ src: j.data.source === "tcl" ? "tcl" : "prolight", p, stage: j.data.stage || "", combo: +((fin.get(j.id) || {}).washTotal) > 0 }); }
      const sum = (a) => a.reduce((t, r) => t + r.p, 0), med = (a) => { const v = a.map((r) => r.p).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : 0; };
      const grp = (a) => ({ n: a.length, total: Math.round(sum(a) * 100) / 100, avg: a.length ? Math.round(sum(a) / a.length * 100) / 100 : 0, median: med(a), min: a.length ? Math.min(...a.map((r) => r.p)) : 0, max: a.length ? Math.max(...a.map((r) => r.p)) : 0 });
      const priced = rows.filter((r) => r.p > 0);
      const done = new Set((await sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=data")).map((l) => l.data.jobId + "|" + l.data.visitId));
      const pl = jobs.filter((j) => j.data.source !== "tcl" && j.data.stage !== "cancelled"), cl = new Map((await allDocs("clients")).map((c) => [c.id, c.data]));
      const unsched = pl.filter((j) => (j.data.visits || []).some((v) => v.type === "install" && !v.returnOf && !v.date && !done.has(j.id + "|" + v.id)));
      const hasPin = (j) => { const c = cl.get(j.data.clientId) || {}; return (j.data.lat && j.data.lng) || (c.lat && c.lng); };
      const planning = { prolightJobs: pl.length, unscheduled: unsched.length, withPrice: unsched.filter((j) => +((fin.get(j.id) || {}).price) > 0).length, withPin: unsched.filter(hasPin).length, usable: unsched.filter((j) => hasPin(j) && +((fin.get(j.id) || {}).price) > 0 && j.data.stage !== "quoted").length, quoted: unsched.filter((j) => j.data.stage === "quoted").length, noPinNames: unsched.filter((j) => !hasPin(j)).map((j) => (cl.get(j.data.clientId) || {}).name || j.id).slice(0, 40) };
      const data = JSON.stringify({ at: new Date().toISOString(), planning, all: grp(priced), prolight: grp(priced.filter((r) => r.src === "prolight")), tcl: grp(priced.filter((r) => r.src === "tcl")), zeroPriced: rows.filter((r) => !(r.p > 0)).length, jobsTotal: rows.length });
      const key = crypto.randomBytes(32), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv), enc = Buffer.concat([c.update(data, "utf8"), c.final()]);
      const ek = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
      return res.status(200).json({ ek: ek.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), d: enc.toString("base64") });
    }
    if (action === "jobhours") {
      // clocked hours per person on one job, encrypted to the caller (q = jobId~base64url public key)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [jid, k64] = String(req.query.q || "").split("~"), pem = Buffer.from(k64 || "", "base64url").toString();
      const [staff, clocks] = await Promise.all([sb("/rest/v1/staff?select=id,name"), sb(`/rest/v1/docs?coll=eq.log&data->>kind=eq.clock&data->>jobId=eq.${encodeURIComponent(jid)}&select=data`)]);
      const by = {}; for (const { data: e } of clocks) { if (!e.in) continue; const h = Math.max(0, (new Date(e.out || Date.now()) - new Date(e.in)) / 36e5), n = ((staff.find((p) => p.id === e.by) || {}).name) || e.by; by[n] = by[n] || { hours: 0, days: new Set(), open: 0 }; by[n].hours += h; by[n].days.add(String(e.in).slice(0, 10)); if (!e.out) by[n].open++; }
      const data = JSON.stringify(Object.fromEntries(Object.entries(by).map(([n, v]) => [n, { hours: Math.round(v.hours * 100) / 100, days: [...v.days].sort(), open: v.open }])));
      const key = crypto.randomBytes(32), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv), enc = Buffer.concat([c.update(data, "utf8"), c.final()]);
      const ek = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
      return res.status(200).json({ ek: ek.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), d: enc.toString("base64") });
    }
    if (action === "tclmoney") {
      // our board's TCL money per job (what TCL owes us), encrypted to the caller (q = base64url public key)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const pem = Buffer.from(String(req.query.q || ""), "base64url").toString();
      const [jobs, fins, clients, logs] = await Promise.all([allDocs("jobs"), allDocs("fin"), allDocs("clients"), sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=id,data")]);
      const fin = new Map(fins.map((f) => [f.id, f.data])), cl = new Map(clients.map((c) => [c.id, c.data])), set = (fin.get("settings") || {});
      const rate = (+set.tclRate || 40) / 100, done = new Map(); for (const l of logs) { const k = l.data.jobId; if (!done.has(k)) done.set(k, []); done.get(k).push({ v: l.data.visitId, synth: String(l.id).startsWith("dr") }); }
      const pays = fins.filter((f) => f.data && f.data.party === "tcl"), paidJobs = new Set(pays.flatMap((p) => p.data.jobs || []));
      const rows = jobs.filter((j) => j.data.source === "tcl" && j.data.stage !== "cancelled").map((j) => { const f = fin.get(j.id) || {}, price = +f.price || 0, extras = (f.extras || []).reduce((t, x) => t + (x.price != null && x.price !== "" ? (+x.qty || 0) * +x.price : 0), 0), d = done.get(j.id) || [], base = (j.data.visits || []).filter((v) => v.type === "install" && !v.returnOf);
        return { id: j.id, name: (cl.get(j.data.clientId) || {}).name || "", price, extras, incoming: Math.round((price * rate + extras) * 100) / 100, anyInstallDone: base.some((v) => d.some((x) => x.v === v.id)) || d.length > 0, allDone: base.length > 0 && base.every((v) => [v, ...(j.data.visits || []).filter((x) => x.returnOf === v.id)].some((x) => d.some((y) => y.v === x.id))), onlySynth: d.length > 0 && d.every((x) => x.synth), paid: paidJobs.has(j.id) || !!f.collected }; });
      const data = require("zlib").gzipSync(JSON.stringify({ rate, paidTotal: pays.reduce((t, p) => t + (+p.data.amount || 0), 0), rows: rows.map((r) => [r.name, r.price, r.extras, r.incoming, +r.anyInstallDone, +r.allDone, +r.onlySynth, +r.paid]) }));
      const key = crypto.randomBytes(32), iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv), enc = Buffer.concat([c.update(data), c.final()]);
      const ek = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, key);
      return res.status(200).json({ ek: ek.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), d: enc.toString("base64") });
    }
    if (action === "setdone") {
      // q = mark|unmark~Name,Name  → check off (or undo) every install day on those jobs; check-off date = the visit's date if past, else now
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [mode, namesTxt, onDay] = String(req.query.q || "").split("~"), names = String(namesTxt || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      const [jobs, clients, logs, staff] = await Promise.all([allDocs("jobs"), allDocs("clients"), sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=id,data"), sb("/rest/v1/staff?select=id,name,active")]);
      const raul = (staff.find((p) => p.active && /^raul\b/i.test(p.name || "")) || {}).id || "";
      const cl = new Map(clients.map((c) => [c.id, c.data])), out = [], rows = [], today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      for (const n of names) {
        const js = jobs.filter((j) => j.data.stage !== "cancelled" && String((cl.get(j.data.clientId) || {}).name || "").toLowerCase().includes(n));
        if (!js.length) { out.push({ name: n, error: "not found" }); continue; }
        for (const j of js) {
          const base = (j.data.visits || []).filter((v) => v.type === "install" && !v.returnOf), r = { job: j.id, name: (cl.get(j.data.clientId) || {}).name, source: j.data.source || "prolight", changed: [] };
          if (mode === "mark") for (const v of base) {
            if (logs.some((l) => l.data.jobId === j.id && (l.data.visitId === v.id || (j.data.visits || []).some((x) => x.returnOf === v.id && x.id === l.data.visitId)))) continue;
            const day = /^\d{4}-\d{2}-\d{2}$/.test(onDay || "") ? onDay : v.date && v.date <= today ? v.date : today, at = new Date(day + "T17:00:00-05:00").toISOString();
            rows.push({ coll: "log", id: "dm" + j.id + v.id, data: { jobId: j.id, visitId: v.id, kind: "done", by: raul, at, note: "Checked off by the office" } }); r.changed.push("done " + day);
          }
          if (mode === "unmark") for (const l of logs.filter((l) => l.data.jobId === j.id)) { await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(l.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); r.changed.push("undone " + String(l.data.at || "").slice(0, 10)); }
          out.push(r);
        }
      }
      if (rows.length) await putDocs(rows);
      return res.status(200).json({ mode, out });
    }
    if (action === "releasetcl") {
      // TCL jobs our crews never did (no check-off of any kind) → hidden as "Released to TCL", kept for history. q=go to apply.
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [jobs, logs] = await Promise.all([allDocs("jobs"), sb("/rest/v1/docs?coll=eq.log&data->>kind=in.(done,partial)&select=data")]);
      const touched = new Set(logs.map((l) => l.data.jobId)), now = new Date().toISOString();
      const pick = jobs.filter((j) => j.data.source === "tcl" && j.data.stage !== "cancelled" && !j.data.releasedToTcl && !touched.has(j.id));
      if (req.query.q === "go") await putDocs(pick.map((j) => ({ coll: "jobs", id: j.id, data: { ...j.data, stagePrev: j.data.stage || "", stage: "cancelled", releasedToTcl: true, releasedAt: now, updatedAt: now } })));
      return res.status(200).json({ applied: req.query.q === "go", released: pick.length, keptTclJobs: jobs.filter((j) => j.data.source === "tcl" && j.data.stage !== "cancelled").length - pick.length, scheduled: pick.filter((j) => (j.data.visits || []).some((v) => v.date)).length });
    }
    if (action === "dups") {
      // ProLight jobs that look like the same job twice: same client, same price, neither cancelled (names only in output)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [jobs, fins, clients, logs] = await Promise.all([allDocs("jobs"), allDocs("fin"), allDocs("clients"), sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=data")]);
      const fin = new Map(fins.map((f) => [f.id, f.data])), cl = new Map(clients.map((c) => [c.id, c.data])), done = new Set(logs.map((l) => l.data.jobId));
      const norm = (s) => String(s || "").toLowerCase().replace(/^(mr|mrs|ms|dr)\.?\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
      const groups = {};
      for (const j of jobs) { if (j.data.stage === "cancelled" || j.data.source === "tcl") continue; const c = cl.get(j.data.clientId) || {}; const k = norm(c.name) + "|" + Math.round(+((fin.get(j.id) || {}).price) || 0); (groups[k] = groups[k] || []).push({ id: j.id, wo: (String(j.data.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1] || "", created: String(j.data.createdAt || "").slice(0, 10), date: ((j.data.visits || []).find((v) => v.type === "install") || {}).date || "", done: done.has(j.id) }); }
      return res.status(200).json(Object.entries(groups).filter(([k, v]) => v.length > 1 && k.split("|")[1] !== "0").map(([k, v]) => ({ name: k.split("|")[0], jobs: v })));
    }
    if (action === "mergedup") {
      // q = keepId~dropId : hide the duplicate (stage cancelled, duplicateOf) and link its Jobber job to the one we keep
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [keep, drop] = String(req.query.q || "").split("~");
      const [k, d] = await Promise.all([keep, drop].map((id) => sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`).then((r) => r[0]))); if (!k || !d) return res.status(404).json({ error: "job not found" });
      const now = new Date().toISOString(), wid = (String(d.data.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1];
      const kd = { ...k.data, jobberAlt: [...new Set([...(k.data.jobberAlt || []), ...(wid ? [wid] : []), ...(d.data.jobberAlt || [])])], updatedAt: now };
      const dd = { ...d.data, stagePrev: d.data.stage || "", stage: "cancelled", duplicateOf: keep, updatedAt: now };
      await putDocs([{ coll: "jobs", id: keep, data: kd }, { coll: "jobs", id: drop, data: dd }]);
      return res.status(200).json({ kept: keep, hidden: drop, linkedJobber: kd.jobberAlt });
    }
    if (action === "unmerge") {
      // q = keepId~hideId : swap a merge (show keep again, hide the other) and drop check-offs the sync made on the hidden one from a closed Jobber job
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [keep, hide] = String(req.query.q || "").split("~");
      const [k, h] = await Promise.all([keep, hide].map((id) => sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`).then((r) => r[0]))); if (!k || !h) return res.status(404).json({ error: "job not found" });
      const now = new Date().toISOString(), widH = (String(h.data.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1], widK = (String(k.data.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1];
      const kd = { ...k.data, stage: k.data.stagePrev || "booked", duplicateOf: undefined, jobberAlt: [...new Set([...(k.data.jobberAlt || []).filter((x) => x !== widK), ...(widH ? [widH] : [])])], updatedAt: now }; delete kd.stagePrev;
      const hd = { ...h.data, stagePrev: h.data.stage || "", stage: "cancelled", duplicateOf: keep, jobberAlt: (h.data.jobberAlt || []).filter((x) => x !== widK), updatedAt: now };
      const logs = await sb(`/rest/v1/docs?coll=eq.log&data->>jobId=eq.${encodeURIComponent(hide)}&data->>kind=eq.done&select=id,data`);
      for (const l of logs.filter((l) => l.data.by === "jobber")) await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(l.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await putDocs([{ coll: "jobs", id: keep, data: kd }, { coll: "jobs", id: hide, data: hd }]);
      return res.status(200).json({ shown: keep, hidden: hide, removedCheckoffs: logs.filter((l) => l.data.by === "jobber").length, visits: (kd.visits || []).map((v) => v.type + ":" + (v.date || "-")) });
    }
    if (action === "logsfor") {
      // check-off history for one job (q = jobId): who/what created each done/undone entry (no customer data)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const jid = String(req.query.q || "");
      const [logs, audit] = await Promise.all([sb(`/rest/v1/docs?coll=eq.log&data->>jobId=eq.${encodeURIComponent(jid)}&select=id,data,updated_at`), sb(`/rest/v1/audit?select=at,kind,doc_id,info&order=at.desc&limit=400&at=gte.${encodeURIComponent(new Date(Date.now() - 20 * 864e5).toISOString())}`).catch(() => [])]);
      const mine = audit.filter((a) => JSON.stringify(a.info || {}).includes(jid) || String(a.doc_id || "").includes(jid)).slice(0, 30).map((a) => ({ at: a.at, kind: a.kind, doc: a.doc_id, what: JSON.stringify(a.info || {}).slice(0, 160) }));
      return res.status(200).json({ logs: logs.map((l) => ({ id: l.id, kind: l.data.kind, by: String(l.data.by || "").slice(0, 8), at: l.data.at, note: l.data.note || "", visit: l.data.visitId, saved: l.updated_at })), audit: mine });
    }
    if (action === "jbundone") {
      // q = logId[,logId] : remove those Jobber-made check-offs and remember them so the sync won't re-add them
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const ids = String(req.query.q || "").split(",").filter((x) => /^jb(v|done)-/.test(x));
      const cur = ((await sb("/rest/v1/docs?coll=eq.settings&id=eq.jobber-undone&select=data"))[0] || {}).data || {};
      await putDocs([{ coll: "settings", id: "jobber-undone", data: { ids: [...new Set([...(cur.ids || []), ...ids])], updatedAt: new Date().toISOString() } }]);
      for (const id of ids) await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      return res.status(200).json({ remembered: ids });
    }
    if (action === "crewday") {
      // a person's crew stops on a day; do=1 takes them off the schedule (the job stays, sync won't re-date it)
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [who, date, doIt] = String(req.query.q || "").split("~");
      const [staff, jobs, clients, settings] = await Promise.all([sb("/rest/v1/staff?select=id,name,crew,active"), allDocs("jobs"), allDocs("clients"), allDocs("settings")]);
      const nc = (c) => (c === "prolight" ? "pl1" : c || "");
      const p = staff.find((x) => x.active && String(x.name || "").toLowerCase().includes(String(who || "").toLowerCase()));
      if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ error: "who~YYYY-MM-DD", found: !!p });
      const crew = nc(p.crew), crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [];
      const cn = (j) => ((clients.find((c) => c.id === j.data.clientId) || {}).data || {}).name || "";
      const out = [], rows = [], now = new Date().toISOString();
      for (const j of jobs) {
        if (j.data.stage === "cancelled") continue;
        let ch = false; const d = JSON.parse(JSON.stringify(j.data));
        for (const v of d.visits || []) {
          if (v.date !== date) continue;
          const cs = [nc(v.crew || d.crew), ...(v.crews || []).map(nc)];
          if (!cs.includes(crew)) continue;
          out.push({ job: j.id, client: cn(j), type: v.type, time: v.time || "", crews: [...new Set(cs)].map((c) => (crews.find((x) => x.id === c) || {}).name || c) });
          if (doIt === "1") { v.date = ""; v.time = ""; v.order = null; v.unscheduledAt = now; v.unscheduledFrom = date; ch = true; }
        }
        if (ch) { d.updatedAt = now; rows.push({ coll: "jobs", id: j.id, data: d }); }
      }
      if (rows.length) await putDocs(rows);
      const mates = staff.filter((x) => x.active && nc(x.crew) === crew).map((x) => x.name);
      return res.status(200).json({ person: p.name, crew: (crews.find((x) => x.id === crew) || {}).name || crew, crewMembers: mates, date, done: doIt === "1", stops: out });
    }
    if (action === "findjob" || action === "addsvc") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const [jobs, clients] = await Promise.all([allDocs("jobs"), allDocs("clients")]);
      const cn = (j) => ((clients.find((c) => c.id === j.data.clientId) || {}).data || {}).name || "";
      if (action === "findjob") {
        const qs = String(req.query.q || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
        return res.status(200).json(Object.fromEntries(qs.map((q) => [q, jobs.filter((j) => cn(j).toLowerCase().includes(q) || String(j.data.jobberUrl || "").includes(q)).map((j) => ({ id: j.id, name: cn(j), src: j.data.source, stage: j.data.stage, scope: j.data.scope || "", visits: (j.data.visits || []).map((v) => v.type + ":" + (v.date || "-")) }))])));
      }
      // addsvc: body-less, items in q as id~note~scope|id~note~scope
      const items = String(req.query.q || "").split("|").map((x) => x.split("~")).filter((x) => x[0]);
      const out = [], now = new Date().toISOString(), rows = [];
      for (const [id, note, scope] of items) {
        const j = jobs.find((x) => x.id === id); if (!j) { out.push({ id, error: "not found" }); continue; }
        const d = JSON.parse(JSON.stringify(j.data));
        if ((d.visits || []).some((v) => v.type === "service" && v.note === note)) { out.push({ id, skip: "already there" }); continue; }
        d.visits = [...(d.visits || []), { id: "svc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: "service", date: "", time: "", crew: "", note, order: null, svc: { reason: "Bulb change out", details: note, urgent: false, reportedAt: now, by: "office" } }];
        if (scope) { d.scopeBefore = d.scopeBefore || d.scope || ""; d.scope = scope; }
        d.updatedAt = now; rows.push({ coll: "jobs", id, data: d }); out.push({ id, ok: true });
      }
      await putDocs(rows);
      return res.status(200).json({ out });
    }
    if (action === "prices") {
      // ProLight-only price on jobs that also have ProWash work in Jobber. dry=1 to just look.
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const dry = !!req.query.dry, token = await accessToken();
      const [jobs, fins] = await Promise.all([allDocs("jobs"), allDocs("fin")]);
      const fin = new Map(fins.map((f) => [f.id, f.data]));
      const list = jobs.filter((j) => j.data.source !== "tcl" && /work_orders\/(\d+)/.test(String(j.data.jobberUrl || "")));
      const out = [], rows = [], combo = [];
      for (let i = 0; i < list.length; i += 10) {
        const chunk = list.slice(i, i + 10);
        const q = "{" + chunk.map((j, k) => `j${k}: job(id:"${gidJob(String(j.data.jobberUrl).match(/work_orders\/(\d+)/)[1])}"){ title total lineItems(first:20){ nodes{ name totalPrice } } }`).join(" ") + "}";
        const d = await gql(token, q).catch((e) => ({ err: e.message }));
        chunk.forEach((j, k) => {
          const jb = d && d["j" + k]; if (!jb) return;
          const k2 = classify({ ...jb, client: {} }), lines = (jb.lineItems && jb.lineItems.nodes) || [];
          const light = Math.round((k2.lines || []).reduce((t, l) => t + (+l.totalPrice || 0), 0) * 100) / 100, total = +jb.total || lines.reduce((t, l) => t + (+l.totalPrice || 0), 0);
          const f = fin.get(j.id) || {}, cur = +f.price || 0;
          // mark ProLight + ProWash combo jobs so they get their own tab on the board
          const wash = Math.round((k2.washTotal || 0) * 100) / 100;
          if ((+j.data.washTotal || 0) !== wash && (wash || j.data.washTotal)) { combo.push(j.id); rows.push({ coll: "jobs", id: j.id, data: { ...j.data, washTotal: wash, washLines: wash ? lines.filter((l) => !(k2.lines || []).includes(l)).map((l) => l.name).slice(0, 6) : [] } }); }
          if (!k2.washTotal || !light || Math.abs(cur - light) < 0.01) return;
          const r = { id: j.id, no: (j.data.jobberNo || ""), was: cur, light, jobberTotal: total, wash: Math.round(k2.washTotal * 100) / 100 };
          // fix when the board shows the full Jobber total (or nothing); leave hand-typed prices alone
          r.fix = !cur || Math.abs(cur - total) < 0.01;
          out.push(r);
          if (r.fix) rows.push({ coll: "fin", id: j.id, data: { ...f, price: light, privateNote: ((f.privateNote || "").replace(/\s*Jobber job also has .*?work \(not counted\)\./, "") + ` Jobber job also has ${money(k2.washTotal)} of ProWash work (not counted).`).trim() } });
        });
      }
      if (!dry && rows.length) await putDocs(rows);
      return res.status(200).json({ dry, checked: list.length, mixed: out.length, combo: combo.length, writes: rows.length, out });
    }
    if (action === "schema") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const token = await accessToken(); let scopes = "";
      try { const pl = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); scopes = pl.scope || pl.scopes || ""; } catch (e) {}
      const m = await gql(token, `{ __type(name:"Mutation"){ fields{ name args{ name type{ ...T } } } } } ${TT}`);
      const want = new RegExp(String(req.query.q || "visit|note|attach|file|upload|jobClose|complete"), "i");
      const tn = (t) => { let s = ""; for (; t; t = t.ofType) s += t.name ? t.name : t.kind === "LIST" ? "[" : "!"; return s; };
      const muts = m.__type.fields.filter((f) => want.test(f.name)).map((f) => f.name + "(" + f.args.map((a) => a.name + ":" + tn(a.type)).join(",") + ")");
      const types = {};
      for (const n of String(req.query.types || "").split(",").filter(Boolean)) { try { const t = await typeQ(token, n); types[n] = (t.fields || t.inputFields || []).map ? (t.fields || []).map((f) => f.name + ":" + tn(f.type)) : t; } catch (e) { types[n] = e.message; } }
      for (const n of String(req.query.inputs || "").split(",").filter(Boolean)) { try { const t = (await gql(token, `query($n:String!){ __type(name:$n){ inputFields{ name type{ ...T } } enumValues{ name } } } ${TT}`, { n })).__type; types[n] = t ? [...(t.inputFields || []).map((f) => f.name + ":" + tn(f.type)), ...(t.enumValues || []).map((e) => e.name)] : null; } catch (e) { types[n] = e.message; } }
      return res.status(200).json({ scopes, muts, types });
    }
    if (action === "dayreport") {
      // Revenue by crew for one day (no customer names in the reply, just board ids and amounts).
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const day = String(req.query.date || "").match(/^\d{4}-\d{2}-\d{2}$/) ? req.query.date : new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const ex = String(req.query.exclude || "").toLowerCase().split(",").filter(Boolean);
      const [jobs, clients, fins, logs, settings] = await Promise.all(["jobs", "clients", "fin", "log", "settings"].map(allDocs));
      const crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [];
      const cl = new Map(clients.map((c) => [c.id, c.data])), fin = new Map(fins.map((f) => [f.id, f.data]));
      const done = new Set(logs.filter((l) => l.data.kind === "done").map((l) => l.data.jobId + "|" + l.data.visitId));
      const out = {}, skipped = [];
      for (const j of jobs) for (const v of j.data.visits || []) {
        if (v.date !== day) continue;
        const name = String((cl.get(j.data.clientId) || {}).name || "").toLowerCase();
        if (ex.some((e) => name.replace(/\s+/g, "").includes(e))) { skipped.push(j.id); continue; }
        const crew = v.crew || j.data.crew || "unassigned", f = fin.get(j.id) || {}, price = +f.price || 0, tcl = j.data.source === "tcl";
        const pct = typeof f.ssPct === "number" ? null : null;
        (out[crew] = out[crew] || []).push({ id: j.id, src: tcl ? "tcl" : "pl", type: v.type, price, share: Math.round((tcl ? price * 0.4 : price) * 100) / 100, done: done.has(j.id + "|" + v.id) });
      }
      const rep = Object.entries(out).map(([id, list]) => ({ crew: id, name: (crews.find((c) => c.id === id) || {}).name || id, jobs: list, total: Math.round(list.reduce((t, x) => t + x.share, 0) * 100) / 100 }));
      return res.status(200).json({ day, skipped, rep });
    }
    if (action === "cron") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      return res.status(200).json(await sync(req.query.quick ? "every 6 hours" : "nightly", !!req.query.quick));
    }
    const me = await manager(req);
    if (!me) return res.status(401).json({ error: "Only a board manager can do that." });
    if (action === "connect") {
      const ts = String(Date.now());
      const url = "https://api.getjobber.com/api/oauth/authorize?" + new URLSearchParams({ response_type: "code", client_id: JB_ID, redirect_uri: callbackUrl(req), state: ts + "." + sign(ts) });
      return res.status(200).json({ url });
    }
    if (action === "status") {
      const c = (await getInt("jobber")) || {};
      return res.status(200).json({ connected: !!c.refresh_token, connectedAt: c.connectedAt || null, last: c.last || null, lastError: c.lastError || null });
    }
    if (action === "sync") {
      try { return res.status(200).json(await sync((req.query.quick ? "auto · " : "manual · ") + me.name, !!req.query.quick)); }
      catch (e) { await putInt("jobber", { ...((await getInt("jobber")) || {}), lastError: e.message }).catch(() => {}); throw e; }
    }
    if (action === "probe") {
      const token = await accessToken();
      const q = await noteQuery(token).catch((e) => "ERR " + e.message);
      const jobNo = String((req.query && req.query.job) || "");
      let sample = null;
      if (jobNo && !String(q).startsWith("ERR")) {
        const d = await gql(token, `query($s:String!){ jobs(first:5, searchTerm:$s){ nodes{ id jobNumber title } } }`, { s: jobNo }).catch((e) => ({ err: e.message }));
        const hit = d && d.jobs && d.jobs.nodes.find((x) => String(x.jobNumber) === jobNo);
        if (hit) { try { const f = await jobFiles(token, hit.id); sample = { job: hit.jobNumber + " " + (hit.title || ""), notes: f.by, photosFound: f.map((x) => x.fileName || x.contentType), noAccessTo: f.noAccess }; } catch (e) { sample = { err: e.message }; } }
        else sample = d;
      }
      return res.status(200).json({ sample, sources: Array.isArray(q) ? q.map((x) => x.where) : q });
    }
    if (action === "hours") {
      const from = String(req.query.from || ""), to = String(req.query.to || "");
      if (!/^\d{4}-\d\d-\d\dT/.test(from) || !/^\d{4}-\d\d-\d\dT/.test(to)) return res.status(400).json({ error: "Pick the days to pull." });
      return res.status(200).json(await hours(from, to));
    }
    if (action === "disconnect") {
      const c = (await getInt("jobber")) || {};
      await putInt("jobber", { last: c.last || null });
      return res.status(200).json({ connected: false });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
module.exports.config = { maxDuration: 60 };
module.exports.pushToJobber = pushToJobber;

/* Board → Jobber un-complete: undoing a check-off on the board leaves a "jbundo" request; reopen the matching Jobber visit. */
async function pushUndos(opts = {}) {
  const reqs = await sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.jbundo&select=id,data&limit=10"); if (!reqs.length) return { undone: 0 };
  const conn = await getInt("jobber"); if (!conn || !conn.refresh_token) return { skipped: "Jobber not connected" };
  const token = await accessToken(), out = { undone: 0, errors: [] };
  for (const r of reqs.slice(0, opts.max || 5)) {
    const q = r.data;
    try {
      const jr = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(q.jobId)}&select=data`))[0], job = jr && jr.data;
      const wids = job ? [(String(job.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1], ...(job.jobberAlt || [])].filter(Boolean) : [];
      let visitId = null;
      const m = String(q.logId || "").match(/^jbv-(\d+)$/); if (m) visitId = Buffer.from("gid://Jobber/Visit/" + m[1]).toString("base64");
      if (!visitId) for (const wid of wids) {
        const jd = await gql(token, `query($id:EncodedId!){ job(id:$id){ visits(first:30){ nodes{ id completedAt } } } }`, { id: gidJob(wid) });
        const doneV = ((jd.job && jd.job.visits.nodes) || []).filter((v) => v.completedAt).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
        if (doneV.length) { visitId = doneV[0].id; break; }
      }
      if (visitId) {
        const res = await gql(token, `mutation($v:EncodedId!){ visitUncomplete(visitId:$v){ visit{ id } userErrors{ message } } }`, { v: visitId });
        const ue = ((res.visitUncomplete || {}).userErrors || []).map((e) => e.message).join("; ");
        if (ue && !/not complete|already/i.test(ue)) throw new Error(ue);
        out.undone++;
      }
      await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(r.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    } catch (e) { out.errors.push({ job: q.jobId, msg: String(e.message || e).slice(0, 160) }); if ((q.tries || 0) >= 3) await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(r.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); else await putDocs([{ coll: "log", id: r.id, data: { ...q, tries: (q.tries || 0) + 1 } }]); }
  }
  return out;
}
module.exports.pushUndos = pushUndos;

/* Board → Jobber install dates: when an install day is moved on the board, move the matching Jobber visit.
   The first run only records where every job stands (no edits). Clearing a date on the board leaves Jobber alone. */
async function pushDates(opts = {}) {
  const conn = await getInt("jobber"); if (!conn || !conn.refresh_token) return { skipped: "Jobber not connected" };
  const [jobs, logs, stateRows] = await Promise.all([allDocs("jobs"), sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=data"), sb("/rest/v1/docs?coll=eq.fin&id=eq.jb-dates&select=data")]);
  const done = new Set(logs.map((l) => l.data.jobId + "|" + l.data.visitId));
  const st = (stateRows[0] && stateRows[0].data) || { jobs: {} }, seed = !st.seeded, out = { moved: [], errors: [] };
  const dates = (jid, d) => Object.fromEntries((d.visits || []).filter((v) => v.type === "install" && !v.returnOf).map((v) => [v.id, v.date || ""]));
  const work = [];
  for (const { id: jid, data: d } of jobs) {
    const wid = (String(d.jobberUrl || "").match(/work_orders\/(\d+)/) || [])[1]; if (!wid || d.stage === "cancelled") continue;
    const now = dates(jid, d), was = st.jobs[jid];
    if (seed || !was) { st.jobs[jid] = now; continue; }
    const changed = Object.keys(now).filter((vid) => now[vid] && now[vid] !== (was[vid] || "") && !done.has(jid + "|" + vid));
    // a cleared or done date just updates what we remember
    for (const vid of Object.keys(now)) if (!changed.includes(vid)) was[vid] = now[vid];
    if (changed.length) work.push({ jid, d, wid, now, was, changed });
  }
  if (seed) { st.seeded = true; st.seededAt = new Date().toISOString(); await putDocs([{ coll: "fin", id: "jb-dates", data: st }]); return { seeded: Object.keys(st.jobs).length }; }
  if (work.length) {
    const token = await accessToken();
    for (const w of work.slice(0, opts.max || 5)) {
      try {
        const jd = await gql(token, `query($id:EncodedId!){ job(id:$id){ visits(first:30){ nodes{ id startAt endAt completedAt } } } }`, { id: gidJob(w.wid) });
        const open = ((jd.job && jd.job.visits.nodes) || []).filter((v) => !v.completedAt).sort((a, b) => String(a.startAt || "9").localeCompare(String(b.startAt || "9")));
        const mine = (w.d.visits || []).filter((v) => v.type === "install" && !v.returnOf && !done.has(w.jid + "|" + v.id)).sort((a, b) => String(a.date || "9").localeCompare(String(b.date || "9")));
        for (const vid of w.changed) {
          const v = mine.find((x) => x.id === vid), jv = open[mine.indexOf(v)];
          if (!v || !jv) { w.was[vid] = w.now[vid]; out.errors.push({ job: w.jid, msg: "no matching Jobber visit" }); continue; }
          const at = { date: v.date, timezone: TZ, ...(v.time ? { time: v.time + ":00" } : {}) };
          const r = await gql(token, `mutation($id:EncodedId!,$in:VisitEditScheduleInput!){ visitEditSchedule(id:$id, input:$in){ visit{ id startAt } userErrors{ message path } } }`, { id: jv.id, in: { startAt: at, endAt: { date: v.date, timezone: TZ, ...(v.time ? { time: (() => { const [h, m] = v.time.split(":").map(Number), e = Math.min(23 * 60 + 59, h * 60 + m + 180); return String(Math.floor(e / 60)).padStart(2, "0") + ":" + String(e % 60).padStart(2, "0") + ":00"; })() } : {}) } } });
          const ue = (r.visitEditSchedule && r.visitEditSchedule.userErrors) || [];
          if (ue.length) { out.errors.push({ job: w.jid, msg: ue.map((e) => e.message).join("; ").slice(0, 160) }); w.tries = (w.was.__tries || 0) + 1; if (w.tries >= 3) w.was[vid] = w.now[vid]; else w.was.__tries = w.tries; continue; }
          w.was[vid] = w.now[vid]; delete w.was.__tries; out.moved.push({ job: w.jid, date: v.date });
          { const fresh = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(w.jid)}&select=data`))[0]; if (fresh) await putDocs([{ coll: "jobs", id: w.jid, data: { ...fresh.data, jobberDateSync: { at: new Date().toISOString(), date: v.date, ok: true } } }]); }
        }
      } catch (e) { out.errors.push({ job: w.jid, msg: String(e.message || e).slice(0, 160) }); }
      st.jobs[w.jid] = w.was;
    }
  }
  if (work.length || out.errors.length) await putDocs([{ coll: "fin", id: "jb-dates", data: st }]);
  return out;
}
module.exports.pushDates = pushDates;
module.exports._test = { completions, tclName, classify, scopeOf, localDate, addr, webId, assigneesOf, crewFinder, AUTO_CREW };
