// Keeps ProLight's Jobber jobs flowing onto the board.
//   POST /api/jobber?action=connect  (manager)  -> { url } to approve the connection in Jobber
//   GET  /api/jobber-callback         (Jobber)   -> saves the connection, back to the board
//   POST /api/jobber?action=sync     (manager)  -> pulls new ProLight jobs now
//   GET  /api/jobber?action=status   (manager)  -> connected? last sync?
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
    if (throttled && tries < 4) { await new Promise((ok) => setTimeout(ok, 2500 * (tries + 1))); continue; }
    if (!r.ok || j.errors) throw new Error("Jobber: " + ((j.errors || []).map((e) => e.message).join("; ") || r.status));
    return j.data;
  }
}
const JOB_FIELDS = `id jobNumber title instructions createdAt startAt completedAt total jobberWebUri
  client { id name }
  property { address { street1 street2 city province postalCode } }
  lineItems(first: 20) { nodes { name description totalPrice } }`;
async function fetchJobs(token, since) {
  const out = [];
  const run = async (filtered) => {
    let after = null;
    for (let page = 0; page < 60; page++) {
      const q = filtered
        ? `query($a:String,$s:ISO8601DateTime!){ jobs(first:25, after:$a, filter:{createdAt:{after:$s}}){ nodes{ ${JOB_FIELDS} } pageInfo{ hasNextPage endCursor } } }`
        : `query($a:String){ jobs(first:25, after:$a){ nodes{ ${JOB_FIELDS} } pageInfo{ hasNextPage endCursor } } }`;
      const d = await gql(token, q, filtered ? { a: after, s: since } : { a: after });
      out.push(...d.jobs.nodes);
      if (!d.jobs.pageInfo.hasNextPage) return;
      after = d.jobs.pageInfo.endCursor;
    }
  };
  try { await run(true); }
  catch (e) { if (!/filter|createdAt|argument|ISO8601/i.test(e.message)) throw e; out.length = 0; await run(false); }
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

/* ---------- mockup photos from the job's notes ---------- */
const NOTE_QS = [
  `query($id:EncodedId!){ job(id:$id){ notes(first:30){ nodes{ ... on JobNote { fileAttachments(first:20){ nodes{ fileName contentType url } } } } } } }`,
  `query($id:EncodedId!){ job(id:$id){ notes(first:30){ nodes{ ... on JobNote { fileAttachments{ nodes{ fileName contentType url } } } } } } }`,
];
let noteQ = 0;
async function jobFiles(token, jobId) {
  for (;;) {
    try {
      const d = await gql(token, NOTE_QS[noteQ], { id: jobId });
      const files = [];
      for (const n of ((d.job && d.job.notes && d.job.notes.nodes) || [])) for (const f of ((n && n.fileAttachments && n.fileAttachments.nodes) || [])) if (f && f.url) files.push(f);
      return files;
    } catch (e) {
      if (noteQ < NOTE_QS.length - 1 && /field|argument|fileAttachments|doesn't exist|undefined/i.test(e.message)) { noteQ++; continue; }
      throw e;
    }
  }
}
const kindOf = (f) => /^image\//.test(f.contentType || "") || /\.(jpe?g|png|heic|webp|gif)$/i.test(f.fileName || "") ? "image"
  : /pdf/.test(f.contentType || "") || /\.pdf$/i.test(f.fileName || "") ? "pdf"
  : /^video\//.test(f.contentType || "") || /\.(mov|mp4|m4v)$/i.test(f.fileName || "") ? "video" : null;
async function copyFiles(token, j, wid) {
  const files = (await jobFiles(token, j.id)).filter(kindOf).slice(0, 12), out = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i], r = await fetch(f.url);
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 45e6) continue;
    const path = `jobber/${wid}/${i + 1}-${String(f.fileName || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80)}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/media/${path}`, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": f.contentType || "application/octet-stream", "x-upsert": "true" }, body: buf });
    if (up.ok) out.push({ id: path, type: kindOf(f), name: f.fileName || "Mockup", from: "Jobber" });
  }
  return out;
}

async function sync(trigger) {
  const conn = await getInt("jobber");
  if (!conn || !conn.refresh_token) throw new Error("Jobber isn't connected yet.");
  const token = await accessToken();
  const since = (conn.since || SINCE_DEFAULT);
  const jobs = await fetchJobs(token, since);
  const [boardJobs, boardClients, boardFin, boardLog] = await Promise.all(["jobs", "clients", "fin", "log"].map(allDocs));
  const byWeb = new Map(), clientByName = new Map(), clientByJobber = new Map();
  for (const d of boardJobs) { const m = String(d.data.jobberUrl || "").match(/work_orders\/(\d+)/); if (m) byWeb.set(m[1], d); }
  for (const c of boardClients) {
    if (c.data.source === "tcl") continue;
    if (c.data.jobberClientId) clientByJobber.set(c.data.jobberClientId, c);
    if (!clientByName.has(norm(c.data.name))) clientByName.set(norm(c.data.name), c);
  }
  const fin = new Map(boardFin.map((f) => [f.id, f.data])), done = new Set(boardLog.filter((l) => l.data.kind === "done").map((l) => l.data.jobId));
  const now = new Date().toISOString(), rows = [], res = { added: 0, updated: 0, prowash: 0, tcl: 0, test: 0, photos: 0, names: [] };
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
      if (ch) { d.updatedAt = now; rows.push({ coll: "jobs", id: existing.id, data: d }); }
      const f = fin.get(existing.id);
      if ((!f || !f.price) && price > 0) { rows.push({ coll: "fin", id: existing.id, data: { ...(f || { invoiceNo: "", collected: false, ssPaid: false }), price, privateNote: (f && f.privateNote) || "From Jobber #" + j.jobNumber } }); ch = true; }
      if (j.completedAt && !done.has(existing.id)) { rows.push({ coll: "log", id: "jbdone-" + wid, data: { jobId: existing.id, visitId: (v && v.id) || "inst", kind: "done", by: "jobber", at: j.completedAt } }); ch = true; }
      if (ch) res.updated++;
      if (!(d.mockups || []).length && !d.jobberMediaAt) media.push([j, wid, existing.id, d]);
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
      clientId: client.id, address: a && norm(a) !== norm(client.data.address) ? a : "", source: "prolight", stage: "booked", crew: "",
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
  const started = Date.now();
  for (const [j, wid, id, d] of media) {
    if (Date.now() - started > 35e3) { res.photosLeft = (res.photosLeft || 0) + 1; continue; }
    try {
      const files = await copyFiles(token, j, wid);
      const fresh = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`))[0];
      const cur = (fresh && fresh.data) || d;
      await putDocs([{ coll: "jobs", id, data: { ...cur, mockups: [...(cur.mockups || []), ...files], jobberMediaAt: new Date().toISOString() } }]);
      res.photos += files.length;
    } catch (e) { res.photoError = e.message.slice(0, 200); break; }
  }
  const out = { at: now, trigger, seen: jobs.length, ...res, names: res.names.slice(0, 30) };
  await putInt("jobber", { ...(await getInt("jobber")), last: out, lastError: null });
  return out;
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
      return res.status(200).json(await sync("nightly"));
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
      try { return res.status(200).json(await sync("manual · " + me.name)); }
      catch (e) { await putInt("jobber", { ...((await getInt("jobber")) || {}), lastError: e.message }).catch(() => {}); throw e; }
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
module.exports._test = { classify, scopeOf, localDate, addr, webId };
