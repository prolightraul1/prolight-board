// Who gets which push notification, in their language. Used by /api/notify and the Jobber sync.
const { send } = require("./webpush");
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + path, { ...opts, headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
// returns true the first time a key is seen
async function firstTime(key) {
  const r = await fetch(SB_URL + "/rest/v1/push_log", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ key }) });
  return r.ok;
}
const wants = (p, kind) => !p.notify || p.notify[kind] !== false;
const lang = (p) => (p.look && p.look.lang === "es" ? "es" : "en");

// people: staff rows. msg(p) -> {title, body, url, tag} or null
async function pushTo(people, kind, msg) {
  const ids = people.filter((p) => p.active && wants(p, kind)).map((p) => p.id);
  if (!ids.length) return 0;
  const subs = await sb(`/rest/v1/push_subs?user_id=in.(${ids.join(",")})&select=endpoint,user_id,sub`);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    const p = people.find((x) => x.id === s.user_id), m = p && msg(p);
    if (!m) return;
    try {
      const st = await send(s.sub, { title: m.title, body: m.body, url: m.url || "/", tag: m.tag || kind }, { topic: (m.tag || kind).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) });
      if (st === 404 || st === 410) await sb(`/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
      else if (st < 300) sent++;
    } catch (e) { /* one phone failing shouldn't stop the rest */ }
  }));
  return sent;
}
async function staffAll() { return sb("/rest/v1/staff?select=id,name,crew,partner,active,can_manage,can_edit,all_crews,notify,look"); }
async function crewsAll() { const d = await sb("/rest/v1/docs?coll=eq.settings&id=eq.board&select=data"); return ((d[0] || {}).data || {}).crews || []; }
module.exports = { sb, firstTime, pushTo, staffAll, crewsAll, lang };
