// Nightly backup of the whole board into a PRIVATE Supabase storage bucket ("backups"). Keeps 45 days.
//   POST /api/backup?action=run              (CRON_SECRET)  -> makes today's backup
//   GET  /api/backup?action=list             (manager)      -> recent backups
//   GET  /api/backup?action=get&name=...     (manager)      -> short-lived download link
// Not included on purpose: sign-in secrets (PIN vault, Jobber tokens, push keys). Photos and videos stay
// where they are in storage; the backup keeps the list of them.
const zlib = require("zlib");
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "backups", KEEP_DAYS = 45;

async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + path, { ...opts, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, ...(opts.body && !opts.raw ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`); e.status = r.status; throw e; }
  try { return t ? JSON.parse(t) : null; } catch (e) { return t; }
}
async function all(table, select = "*", extra = "") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`/rest/v1/${table}?select=${select}${extra}`, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
async function ensureBucket() {
  try { await sb(`/storage/v1/bucket/${BUCKET}`); }
  catch (e) { await sb("/storage/v1/bucket", { method: "POST", body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) }); }
}
async function listMedia() {
  const out = [];
  const walk = async (prefix, depth) => {
    for (let off = 0; ; off += 1000) {
      const items = await sb(`/storage/v1/object/list/media`, { method: "POST", body: JSON.stringify({ prefix, limit: 1000, offset: off }) });
      for (const it of items) { if (it.id) out.push({ name: prefix + it.name, size: (it.metadata || {}).size || 0 }); else if (depth < 3) await walk(prefix + it.name + "/", depth + 1); }
      if (items.length < 1000) break;
    }
  };
  await walk("", 0).catch(() => {});
  return out;
}
async function isManager(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
  if (!u.ok) return false;
  const me = (await sb(`/rest/v1/staff?id=eq.${(await u.json()).id}&select=can_manage,active`))[0];
  return !!(me && me.active && me.can_manage);
}
const nyDate = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!SB_KEY) return res.status(500).json({ error: "The board's server key is missing." });
  const action = String((req.query && req.query.action) || "");
  try {
    if (action === "run") {
      if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
      const since = new Date(Date.now() - 60 * 864e5).toISOString();
      const [docs, staff, messages, audit, media] = await Promise.all([
        all("docs", "coll,id,data,updated_at"),
        all("staff"),
        all("messages").catch(() => []),
        all("audit", "*", `&at=gte.${encodeURIComponent(since)}`).catch(() => []),
        listMedia(),
      ]);
      const counts = { docs: docs.length, staff: staff.length, messages: messages.length, audit: audit.length, media: media.length };
      for (const d of docs) counts[d.coll] = (counts[d.coll] || 0) + 1;
      const snap = { app: "ProLight Season Board", madeAt: new Date().toISOString(), counts, tables: { docs, staff, messages, audit }, mediaFiles: media };
      const gz = zlib.gzipSync(Buffer.from(JSON.stringify(snap)));
      await ensureBucket();
      const name = `board-${nyDate()}.json.gz`;
      await sb(`/storage/v1/object/${BUCKET}/${name}`, { method: "POST", raw: true, body: gz, headers: { "Content-Type": "application/gzip", "x-upsert": "true" } });
      // keep the last KEEP_DAYS days
      const files = await sb(`/storage/v1/object/list/${BUCKET}`, { method: "POST", body: JSON.stringify({ prefix: "", limit: 1000, sortBy: { column: "name", order: "asc" } }) });
      const cut = nyDate(new Date(Date.now() - KEEP_DAYS * 864e5)), old = files.filter((f) => /^board-\d{4}-\d{2}-\d{2}/.test(f.name) && f.name.slice(6, 16) < cut).map((f) => f.name);
      if (old.length) await sb(`/storage/v1/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: old }) }).catch(() => {});
      return res.status(200).json({ ok: true, name, kb: Math.round(gz.length / 1024), counts, removed: old.length });
    }
    if (action === "list" || action === "get") {
      if (!(await isManager(req))) return res.status(401).json({ error: "Only managers can see backups." });
      if (action === "list") {
        const files = await sb(`/storage/v1/object/list/${BUCKET}`, { method: "POST", body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "name", order: "desc" } }) }).catch(() => []);
        return res.status(200).json({ files: files.filter((f) => f.id).map((f) => ({ name: f.name, kb: Math.round(((f.metadata || {}).size || 0) / 1024), at: f.created_at })) });
      }
      const name = String(req.query.name || "");
      if (!/^board-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(name)) return res.status(400).json({ error: "Pick a backup." });
      const s = await sb(`/storage/v1/object/sign/${BUCKET}/${name}`, { method: "POST", body: JSON.stringify({ expiresIn: 120 }) });
      return res.status(200).json({ url: SB_URL + "/storage/v1" + (s.signedURL || s.signedUrl) + "&download=" + encodeURIComponent(name) });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
module.exports.config = { maxDuration: 60 };
