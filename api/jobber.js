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
  for (const c of boardClients) {
    if (c.data.source === "tcl") continue;
    if (c.data.jobberClientId) clientByJobber.set(c.data.jobberClientId, c);
    if (!clientByName.has(norm(c.data.name))) clientByName.set(norm(c.data.name), c);
  }
  const settings = await allDocs("settings"), crews = ((settings.find((d) => d.id === "board") || {}).data || {}).crews || [];
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
      if (v && !v.date && date) { v.date = date; ch = true; }
      if (!d.crew) { const c = autoCrew(j); if (c) { d.crew = c; ch = true; res.assigned++; } }
      if (ch) { d.updatedAt = now; rows.push({ coll: "jobs", id: existing.id, data: d }); }
      const f = fin.get(existing.id);
      if ((!f || !f.price) && price > 0) { rows.push({ coll: "fin", id: existing.id, data: { ...(f || { invoiceNo: "", collected: false, ssPaid: false }), price, privateNote: (f && f.privateNote) || "From Jobber #" + j.jobNumber } }); ch = true; }
      if (j.completedAt && !done.has(existing.id)) { rows.push({ coll: "log", id: "jbdone-" + wid, data: { jobId: existing.id, visitId: (v && v.id) || "inst", kind: "done", by: "jobber", at: j.completedAt } }); ch = true; }
      if (ch) res.updated++;
      if (!(d.mockups || []).length && d.jobberMediaV !== 4) media.push([j, wid, existing.id, d]);
      continue;
    }
    const cname = (j.client && j.client.name) || "Customer", jcid = j.client && j.client.id;
    let client = clientByJobber.get(jcid) || clientByName.get(norm(cname));
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
      importedFrom: "Jobber", jobberNo: String(j.jobNumber || ""), jobberUrl: j.jobberWebUri || "", createdAt: now, updatedAt: now,
      visits: [{ id: "inst", type: "install", date, time: "", crew: "", note: "", order: null }] } });
    rows.push({ coll: "fin", id, data: { price, invoiceNo: "", privateNote: "From Jobber #" + j.jobNumber, collected: false, ssPaid: false } });
    if (j.completedAt) rows.push({ coll: "log", id: "jbdone-" + wid, data: { jobId: id, visitId: "inst", kind: "done", by: "jobber", at: j.completedAt } });
    byWeb.set(wid, { id, data: {} });
    media.push([j, wid, id, rows.find((r) => r.coll === "jobs" && r.id === id).data]);
    res.added++; res.names.push(cname);
  }
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
  if (NO_USERS) res.assignNote = "Jobber isn't sharing who jobs are assigned to, so Kilmar's jobs can't go to his crew yet. In the Jobber Developer Center, give the app read access to Users (team members), save, then tap Reconnect on the board.";
  const out = { at: now, trigger, seen: jobs.length, ...res, names: res.names.slice(0, 30) };
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
module.exports._test = { classify, scopeOf, localDate, addr, webId, assigneesOf, crewFinder, AUTO_CREW };
