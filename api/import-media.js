// One-time helper: copy mockup photos and videos from the TCL reinstall board into the matching TCL jobs here.
//   POST /api/import-media { key, items: [{ name, url }] }
// Only accepts photos stored on the TCL board or Google Drive thumbnails, and needs the import key.
const crypto = require("crypto");
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY_HASH = "fa638a7bedd8c64bf0090f2cb48e26ec35ab3cdf96a6981f74a69c440e9da542";
const ORIGIN = "https://tcl-reinstalls.vercel.app";
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + path, { ...opts, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + t.slice(0, 160));
  return t ? JSON.parse(t) : null;
}
function source(u) {
  const x = new URL(u);
  if (x.hostname === "suyuaompppyjgjthqjyl.supabase.co" && x.pathname.startsWith("/storage/v1/object/sign/job-media/")) {
    const path = decodeURIComponent(x.pathname.replace("/storage/v1/object/sign/", ""));
    return { ref: path, fetch: u, file: path.split("/").pop() };
  }
  if (x.hostname === "drive.google.com" && x.pathname === "/thumbnail" && /^[\w-]{10,}$/.test(x.searchParams.get("id") || "")) {
    const id = x.searchParams.get("id");
    return { ref: "drive:" + id, fetch: "https://drive.google.com/thumbnail?id=" + id + "&sz=w2400", file: "drive-" + id + ".jpg" };
  }
  return null;
}
const kind = (file, ct) => /^video\//.test(ct) || /\.(mov|mp4|m4v)$/i.test(file) ? "video" : /pdf/.test(ct) || /\.pdf$/i.test(file) ? "pdf" : "image";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (crypto.createHash("sha256").update(String(b.key || "")).digest("hex") !== KEY_HASH) return res.status(401).json({ error: "Not allowed" });
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 8);
    const clients = await sb("/rest/v1/docs?coll=eq.clients&select=id,data");
    const jobs = await sb("/rest/v1/docs?coll=eq.jobs&select=id,data");
    const out = [];
    for (const it of items) {
      const r = { name: it.name, url: String(it.url || "").slice(0, 60) };
      try {
        const src = source(String(it.url || ""));
        if (!src) { r.skip = "not a TCL photo"; out.push(r); continue; }
        const cl = clients.filter((c) => norm(c.data.name) === norm(it.name)).map((c) => c.id);
        const job = jobs.find((j) => cl.includes(j.data.clientId) && j.data.source === "tcl") || jobs.find((j) => cl.includes(j.data.clientId));
        if (!job) { r.skip = "no matching job"; out.push(r); continue; }
        const fresh = (await sb("/rest/v1/docs?coll=eq.jobs&id=eq." + encodeURIComponent(job.id) + "&select=data"))[0].data;
        if ((fresh.mockups || []).some((m) => m.src === src.ref)) { r.skip = "already there"; out.push(r); continue; }
        const dl = await fetch(src.fetch);
        if (!dl.ok) { r.error = "download " + dl.status; out.push(r); continue; }
        const ct = dl.headers.get("content-type") || "application/octet-stream", buf = Buffer.from(await dl.arrayBuffer());
        if (buf.length > 48e6) { r.skip = "too big"; out.push(r); continue; }
        if (/^text\/html/.test(ct)) { r.error = "not shared publicly"; out.push(r); continue; }
        const path = "tcl/" + job.id + "/" + src.file.replace(/[^\w.\-]+/g, "_").slice(0, 90);
        const up = await fetch(SB_URL + "/storage/v1/object/media/" + path, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": ct, "x-upsert": "true" }, body: buf });
        if (!up.ok) { r.error = "save " + up.status; out.push(r); continue; }
        const mock = { id: path, type: kind(src.file, ct), name: (kind(src.file, ct) === "video" ? "Install video" : "Mockup"), from: "TCL board", src: src.ref };
        await sb("/rest/v1/docs?coll=eq.jobs&id=eq." + encodeURIComponent(job.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...fresh, mockups: [...(fresh.mockups || []), mock], updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() }) });
        r.ok = job.id; r.bytes = buf.length; out.push(r);
      } catch (e) { r.error = String(e.message || e).slice(0, 120); out.push(r); }
    }
    return res.status(200).json({ out });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
module.exports.config = { maxDuration: 60 };
