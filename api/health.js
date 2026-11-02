// Problems from the activity log (crashes, slow screens, slow opens, failed saves), grouped and scrubbed of
// customer details so the summary is safe to show in a public workflow log.
//   GET /api/health?action=problems&hours=24   (CRON_SECRET)
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TYPES = ["crash", "lag", "slow-load", "save-failed"];

async function sb(path) {
  const r = await fetch(SB_URL + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t || "[]");
}
// keep the shape of an error, drop anything that could be a person, address, phone, email or note text
const scrub = (s) => String(s || "")
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
  .replace(/https?:\/\/[^\s)"']+/g, (u) => { try { return new URL(u).pathname.split("/").pop() || "<url>"; } catch (e) { return "<url>"; } })
  .replace(/(["'`])(?:(?!\1).){25,}\1/g, "$1…$1")
  .replace(/\b\d{5,}\b/g, "<n>")
  .replace(/\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/g, "<phone>")
  .slice(0, 300);
const frames = (st) => String(st || "").split("\n").map((l) => l.trim()).filter((l) => /:\d+:\d+/.test(l)).slice(0, 4)
  .map((l) => scrub(l.replace(/https?:\/\/[^/]+\//g, "")));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!SB_KEY) return res.status(500).json({ error: "server key missing" });
  if (!process.env.CRON_SECRET || req.headers.authorization !== "Bearer " + process.env.CRON_SECRET) return res.status(401).json({ error: "Not allowed" });
  try {
    const hours = Math.min(24 * 14, Math.max(1, +((req.query || {}).hours) || 24));
    const since = new Date(Date.now() - hours * 36e5).toISOString();
    const rows = [];
    for (let from = 0; from < 5000; from += 1000) {
      const page = await sb(`/rest/v1/audit?select=at,who,doc_id,info&kind=eq.event&doc_id=in.(${TYPES.join(",")},load)&at=gte.${encodeURIComponent(since)}&order=at.desc&limit=1000&offset=${from}`);
      rows.push(...page); if (page.length < 1000) break;
    }
    const groups = new Map(); let loads = 0, loadMs = 0;
    for (const r of rows) {
      const i = r.info || {}, t = r.doc_id;
      if (t === "load" || t === "slow-load") { loads++; loadMs += +i.ms || 0; if (t === "load") continue; }
      const msg = t === "crash" ? scrub(i.msg) : t === "lag" ? scrub(i.where || i.view) : t === "save-failed" ? scrub((i.what || "") + " · " + (i.msg || "")) : "";
      const key = t + "|" + msg;
      if (!groups.has(key)) groups.set(key, { type: t, msg, count: 0, users: new Set(), first: r.at, last: r.at, views: new Set(), devices: new Set(), builds: new Set(), src: scrub(i.src), stack: frames(i.stack), ms: [] });
      const g = groups.get(key);
      g.count++; if (r.who) g.users.add(r.who); if (r.at < g.first) g.first = r.at; if (r.at > g.last) g.last = r.at;
      if (i.view) g.views.add(String(i.view).slice(0, 30)); if (i.device) g.devices.add(String(i.device).slice(0, 40)); if (i.build) g.builds.add(String(i.build).slice(0, 20));
      if (i.ms) g.ms.push(+i.ms); if (i.offline) g.offline = (g.offline || 0) + 1;
    }
    const out = [...groups.values()].map((g) => ({ ...g, users: g.users.size, views: [...g.views], devices: [...g.devices], builds: [...g.builds],
      ms: g.ms.length ? Math.round(g.ms.reduce((a, b) => a + b, 0) / g.ms.length) : undefined }))
      .sort((a, b) => ({ crash: 0, "save-failed": 1, "slow-load": 2, lag: 3 }[a.type] - { crash: 0, "save-failed": 1, "slow-load": 2, lag: 3 }[b.type]) || b.count - a.count);
    return res.status(200).json({ hours, since, loads, avgLoadMs: loads ? Math.round(loadMs / loads) : null, problems: out });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
