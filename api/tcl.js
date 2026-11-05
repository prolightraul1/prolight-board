// Keeps TCL jobs on the board in step with the TCL reinstall board (tcl-reinstalls.vercel.app).
//   POST /api/tcl { key, jobs:[...], media:[{name,url}], dry }   from a script running on the TCL board page
//   GET  /api/tcl?action=feed                                   (CRON_SECRET) pull TCL_FEED_URL if TCL gives us one
// A board field is only overwritten when TCL itself changed it since the last sync (we keep a snapshot),
// so edits made on our board stick. Every change is written to the job's TCL history, and Raul gets one push.
const crypto = require("crypto");
const { sb, firstTime, pushTo, lang } = require("./_lib/notify");
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY_HASH = "bd115d01e3ddd902260cc5735bb209cb4af59c2d895dd6000a807ec32eb14d1b";
const ORIGIN = "https://tcl-reinstalls.vercel.app";
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (v) => String(v || "").replace(/\n?Open in Drive ↗/g, "").replace(/\r/g, "").trim();
const blank = (v) => !v || /^(Not added|None yet|Not written yet|Nothing listed yet|—|-)$/i.test(String(v).trim()) || /^(Not added|None yet|Not written yet|Nothing listed yet)/.test(String(v).trim());
const money = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (s, n = 60) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

async function all(coll) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`/rest/v1/docs?coll=eq.${coll}&select=id,data`, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...page); if (page.length < 1000) return out;
  }
}
const putDoc = (coll, id, data) => sb("/rest/v1/docs?on_conflict=coll,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ coll, id, data, updated_at: new Date().toISOString() }) });

// what one TCL job means for our board (job fields crews can see, money fields only money people see)
function shape(t) {
  const crewLines = clean(t.crew).split("\n").filter(Boolean);
  const last = crewLines.filter((l) => /^Last season:/.test(l)).map((l) => l.replace(/^Last season:\s*/, ""));
  const extra = crewLines.filter((l) => !/^Last season:/.test(l));
  const parts = [];
  if (!blank(t.layout)) parts.push(clean(t.layout));
  if (!blank(t.where)) parts.push("WHAT GOES WHERE\n" + clean(t.where));
  if (!blank(t.outlets || t.power)) parts.push("POWER: " + clean(t.outlets || t.power));
  if (clean(t.watch)) parts.push("WATCH OUT: " + clean(t.watch));
  if (extra.length) parts.push(extra.join("\n"));
  const st = String(t.st || t.status || "");
  const priv = [`TCL deposit: ${clean(t.dep) || "None yet"} · Balance: ${clean(t.bal) || "—"}`];
  if (last.length || clean(t.last)) priv.push("Last season: " + (last.join(" ") || clean(t.last)));
  if (clean(t.office)) priv.push("Office: " + clean(t.office).replace(/\n/g, " "));
  const price = typeof t.price === "number" ? t.price : +String(t.price || "").replace(/[^0-9.]/g, "") || 0;
  return {
    job: {
      notes: parts.join("\n\n").replace(/\$[\d,.]+/g, ""),
      scope: blank(t.color || t.colors) ? "" : clean(t.color || t.colors),
      tclWhen: clean(t.whenFull != null ? t.whenFull : t.when),
      ready: clean(t.ready || t.rdy),
      priority: { high: "HIGH", medium: "MED", med: "MED", low: "LOW" }[String(t.prio || t.pri || "").toLowerCase()] || "",
      tclStatus: st + (/pause/i.test(t.when || "") ? " (on pause)" : ""),
    },
    fin: { price, privateNote: priv.join("\n") },
    addr: blank(t.addr || t.address) ? "" : clean(t.addr || t.address),
    installed: /^installed/i.test(st) || t.done === true,
  };
}
const LABEL = { notes: "crew notes", scope: "colors", tclWhen: "timing", ready: "checklist", priority: "priority", tclStatus: "status", price: "price", privateNote: "deposit/balance", addr: "address" };
function describe(k, from, to) {
  if (k === "price") return `price ${money(from)} → ${money(to)}`;
  if (k === "scope") return from ? `colors “${short(from, 40)}” → “${short(to, 40)}”` : `colors added: “${short(to, 50)}”`;
  if (k === "tclStatus" || k === "priority" || k === "ready" || k === "tclWhen") return `${LABEL[k]} ${short(from, 20) || "blank"} → ${short(to, 30)}`;
  return `${LABEL[k]} updated`;
}

async function apply(list, opts = {}) {
  const dry = !!opts.dry, now = new Date().toISOString();
  const [clients, jobs, fins, logs] = await Promise.all([all("clients"), all("jobs"), all("fin"), sb("/rest/v1/docs?coll=eq.log&data->>kind=eq.done&select=id,data")]);
  const out = [], seen = new Set(), news = [], markOnTcl = [], unmarkOnTcl = [];
  for (const t of (Array.isArray(list) ? list : []).slice(0, 200)) {
    const name = clean(t.name || t.n); if (!name) continue;
    const r = { name, changes: [] }; const s = shape(t);
    try {
      const cl = clients.filter((c) => norm(c.data.name) === norm(name));
      let job = jobs.find((j) => cl.some((c) => c.id === j.data.clientId) && j.data.source === "tcl") || jobs.find((j) => cl.some((c) => c.id === j.data.clientId));
      if (!job) {
        const slug = norm(name).replace(/ /g, "-").slice(0, 40), cid = "tc-" + slug, jid = "tj-" + slug;
        const cdata = { name, address: s.addr, phone: "", email: "", gate: "", notes: "", source: "tcl", createdAt: now };
        const jdata = { clientId: cid, address: "", source: "tcl", tclRef: "", crew: "", stage: /pause/i.test(t.when || "") ? "quoted" : "booked", season: "2026", rooflineFt: "", visits: [{ id: "inst", type: "install", date: "", time: "", crew: "", note: "", order: null }], mockups: [], links: [], importedFrom: "TCL Reinstall Board", createdAt: now, updatedAt: now, ...s.job, tclSnap: { ...s.job, addr: s.addr } };
        if (!dry) { await putDoc("clients", cid, cdata); await putDoc("jobs", jid, jdata); await putDoc("fin", jid, { invoiceNo: "", collected: false, ssPaid: false, ...s.fin, tclSnap: { ...s.fin } }); }
        r.id = jid; r.added = true; seen.add(jid); news.push(name); out.push(r); continue;
      }
      r.id = job.id; seen.add(job.id);
      const j = JSON.parse(JSON.stringify(job.data)), snap = j.tclSnap || null, hist = [];
      for (const k of Object.keys(s.job)) {
        const v = s.job[k]; if (!v && k !== "tclStatus") continue;
        const tclChanged = snap ? (snap[k] || "") !== v : (j[k] || "") !== v;
        if (tclChanged && (j[k] || "") !== v) {
          if (k === "notes" && j.notes && !j.notesBefore) j.notesBefore = j.notes;
          hist.push({ at: now, k, from: (j[k] || "").slice(0, 300), to: v.slice(0, 300) }); j[k] = v;
          if (snap || k === "scope") r.changes.push(describe(k, hist[hist.length - 1].from, v));
        }
      }
      const f0 = (fins.find((x) => x.id === job.id) || {}).data || {}, f = { ...f0 }, fsnap = f0.tclSnap || null, fh = [];
      if (s.fin.price > 0 && (fsnap ? +fsnap.price !== s.fin.price : +f0.price !== s.fin.price) && +f0.price !== s.fin.price) { fh.push({ at: now, k: "price", from: +f0.price || 0, to: s.fin.price }); r.changes.push(describe("price", +f0.price || 0, s.fin.price)); f.price = s.fin.price; }
      if (s.fin.privateNote !== (fsnap ? fsnap.privateNote : f0.privateNote) && s.fin.privateNote !== f0.privateNote) { fh.push({ at: now, k: "privateNote", from: "", to: "" }); f.privateNote = s.fin.privateNote; if (fsnap) r.changes.push("deposit/balance updated"); }
      const jChanged = hist.length || JSON.stringify(snap) !== JSON.stringify({ ...s.job, addr: s.addr });
      j.tclSnap = { ...s.job, addr: s.addr }; j.tclSeenAt = now;
      if (hist.length) j.tclLog = [...hist.filter((h) => h.k !== "notes" || snap).map(({ at, k, from, to }) => ({ at, k, from: k === "notes" ? "" : from, to: k === "notes" ? "" : to })), ...(j.tclLog || [])].slice(0, 20);
      if (!dry && jChanged) { j.updatedAt = hist.length ? now : j.updatedAt; await putDoc("jobs", job.id, j); }
      if (!dry && (fh.length || JSON.stringify(f0.tclSnap || null) !== JSON.stringify(s.fin))) { f.tclSnap = { ...s.fin }; if (fh.length) f.tclLog = [...fh.filter((h) => h.k === "price"), ...(f0.tclLog || [])].slice(0, 20); await putDoc("fin", job.id, f); }
      // address: fill in or lengthen, never shorten
      const c = cl.find((x) => x.id === j.clientId) || cl[0];
      if (c && s.addr && s.addr !== (c.data.address || "") && (!c.data.address || (snap && snap.addr !== s.addr))) { r.changes.push("address updated"); if (!dry) await putDoc("clients", c.id, { ...c.data, address: s.addr }); }
      // our board is the truth for completion. A check-off "counts" unless the sync itself created it from TCL ("dr…" logs).
      { const base = (j.visits || []).filter((v) => v.type === "install" && !v.returnOf);
        const real = (l) => !String(l.id || "").startsWith("dr");
        const ok = (v) => [v, ...(j.visits || []).filter((x) => x.returnOf === v.id)].some((x) => logs.some((l) => real(l) && l.data.jobId === job.id && l.data.visitId === x.id));
        const complete = base.length > 0 && base.every(ok);
        if (!s.installed && complete) markOnTcl.push({ name, id: t.id || t.slug || "" });
        if (s.installed && !complete) unmarkOnTcl.push({ name, id: t.id || t.slug || "", syntheticDone: logs.some((l) => !real(l) && l.data.jobId === job.id) });
        // when TCL no longer shows it installed and our crew never checked it off, drop the check-off the sync made earlier
        if (!dry && !s.installed && !complete) for (const l of logs.filter((l) => !real(l) && l.data.jobId === job.id)) { await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(l.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); r.changes.push("check-off from TCL removed"); }
      }
    } catch (e) { r.error = String(e.message || e).slice(0, 120); }
    out.push(r);
  }
  const gone = jobs.filter((x) => x.data.source === "tcl" && x.data.stage !== "cancelled" && !seen.has(x.id) && (list || []).length > 20).map((x) => (clients.find((c) => c.id === x.data.clientId) || { data: {} }).data.name || x.id);
  const changed = out.filter((r) => r.changes.length || r.added);
  if (!dry && changed.length) await tellRaul(changed, gone).catch(() => {});
  return { dry, checked: out.length, changed: changed.map((r) => ({ name: r.name, added: !!r.added, changes: r.changes })), errors: out.filter((r) => r.error).map((r) => ({ name: r.name, error: r.error })), notOnTcl: gone, markOnTcl, unmarkOnTcl };
}

async function tellRaul(changed, gone) {
  const staff = await sb("/rest/v1/staff?active=eq.true&select=id,name,active,notify,look");
  const me = staff.filter((p) => /^raul\b/i.test(String(p.name || "").trim()));
  const parts = changed.map((r) => r.added ? `New job: ${r.name}` : `${r.name}: ${r.changes.join(", ")}`);
  const body = parts.join(" · ");
  const n = changed.length;
  return pushTo(me, "tcl", (p) => lang(p) === "es"
    ? { title: `TCL actualizó ${n} trabajo${n === 1 ? "" : "s"}`, body: body.length > 220 ? body.slice(0, 217) + "…" : body, url: "/?go=jobs", tag: "tcl-" + Date.now() }
    : { title: `TCL updated ${n} job${n === 1 ? "" : "s"}`, body: body.length > 220 ? body.slice(0, 217) + "…" : body, url: "/?go=jobs", tag: "tcl-" + Date.now() });
}

// photos and videos from the TCL board → the job's mockups (only TCL storage or Google Drive)
function source(u) {
  let x; try { x = new URL(u); } catch (e) { return null; }
  if (/\.supabase\.co$/.test(x.hostname) && /^\/storage\/v1\/object\/(sign|public)\/job-media\//.test(x.pathname)) {
    const path = decodeURIComponent(x.pathname.replace(/^\/storage\/v1\/object\/(sign|public)\//, ""));
    return { ref: path, fetch: u, file: path.split("/").pop() };
  }
  if (x.hostname === "drive.google.com" && /^[\w-]{10,}$/.test(x.searchParams.get("id") || "")) {
    const id = x.searchParams.get("id"); return { ref: "drive:" + id, fetch: "https://drive.google.com/thumbnail?id=" + id + "&sz=w2400", file: "drive-" + id + ".jpg" };
  }
  return null;
}
const kind = (file, ct) => /^video\//.test(ct) || /\.(mov|mp4|m4v)$/i.test(file) ? "video" : /pdf/.test(ct) || /\.pdf$/i.test(file) ? "pdf" : "image";
async function media(items) {
  const [clients, jobs] = await Promise.all([all("clients"), all("jobs")]), out = [];
  for (const it of (items || []).slice(0, 8)) {
    const r = { name: it.name };
    try {
      const src = source(String(it.url || "")); if (!src) { r.skip = "not a TCL photo"; out.push(r); continue; }
      const ids = clients.filter((c) => norm(c.data.name) === norm(it.name)).map((c) => c.id);
      const job = jobs.find((j) => ids.includes(j.data.clientId) && j.data.source === "tcl"); if (!job) { r.skip = "no job"; out.push(r); continue; }
      const fresh = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(job.id)}&select=data`))[0].data;
      if ((fresh.mockups || []).some((m) => m.src === src.ref)) { r.skip = "already there"; out.push(r); continue; }
      const dl = await fetch(src.fetch); if (!dl.ok) { r.error = "download " + dl.status; out.push(r); continue; }
      const ct = dl.headers.get("content-type") || "application/octet-stream", buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length > 48e6 || /^text\/html/.test(ct)) { r.skip = "too big or not shared"; out.push(r); continue; }
      const path = "tcl/" + job.id + "/" + src.file.replace(/[^\w.\-]+/g, "_").slice(0, 90);
      const up = await fetch(SB_URL + "/storage/v1/object/media/" + path, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": ct, "x-upsert": "true" }, body: buf });
      if (!up.ok) { r.error = "save " + up.status; out.push(r); continue; }
      const k = kind(src.file, ct);
      await putDoc("jobs", job.id, { ...fresh, mockups: [...(fresh.mockups || []), { id: path, type: k, name: k === "video" ? "Install video" : "Mockup", from: "TCL board", src: src.ref }], tclLog: [{ at: new Date().toISOString(), k: "media", from: "", to: k === "video" ? "new video" : "new photo" }, ...(fresh.tclLog || [])].slice(0, 20), updatedAt: new Date().toISOString() });
      r.ok = true; out.push(r);
    } catch (e) { r.error = String(e.message || e).slice(0, 120); out.push(r); }
  }
  return out;
}

async function pollFeed() {
  const url = process.env.TCL_FEED_URL; if (!url) return { skipped: "no feed" };
  const r = await fetch(url, { headers: process.env.TCL_FEED_TOKEN ? { Authorization: "Bearer " + process.env.TCL_FEED_TOKEN } : {} });
  if (!r.ok) throw new Error("TCL feed " + r.status);
  const d = await r.json(), list = Array.isArray(d) ? d : d.jobs || [];
  const res = await apply(list);
  const m = list.flatMap((t) => (t.media || []).map((u) => ({ name: t.name || t.n, url: typeof u === "string" ? u : u.url })));
  if (m.length) res.media = await media(m);
  return res;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!SB_KEY) return res.status(500).json({ error: "server key missing" });
  try {
    if (req.method === "GET") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      if (req.query.action === "feed") return res.status(200).json(await pollFeed());
      return res.status(400).json({ error: "Unknown action" });
    }
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const hash = crypto.createHash("sha256").update(String(b.key || "")).digest("hex");
    if (hash !== (process.env.TCL_KEY_HASH || KEY_HASH)) return res.status(401).json({ error: "Not allowed" });
    const out = {};
    if (Array.isArray(b.jobs)) Object.assign(out, await apply(b.jobs, { dry: !!b.dry }));
    if (Array.isArray(b.media) && !b.dry) out.media = await media(b.media);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
module.exports.pollFeed = pollFeed;
module.exports._apply = apply;
module.exports.config = { maxDuration: 60 };
