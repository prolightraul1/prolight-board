// Video calls inside chat, powered by Daily.co.
//   POST /api/call?channel=crew:pl1   (or ann = the all-crew meeting room)   (signed-in board user) -> { url, token }
// One private room per chat. Only people who can read that chat get a ticket in.
const crypto = require("crypto");
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DAILY = process.env.DAILY_API_KEY || "";

async function daily(path, opts = {}) {
  const r = await fetch("https://api.daily.co/v1" + path, { ...opts, headers: { Authorization: "Bearer " + DAILY, "Content-Type": "application/json", ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!DAILY) return res.status(500).json({ error: "Video calls aren't set up yet. Add DAILY_API_KEY in Vercel." });
  if (!SB_KEY) return res.status(500).json({ error: "The board's server key is missing." });
  try {
    const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const ch = String((req.query && req.query.channel) || "");
    if (!tok || !/^(ann|meet:prolight|crew:[\w-]{1,40}|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$/.test(ch)) return res.status(400).json({ error: "Pick a chat first." });
    const ur = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
    if (!ur.ok) return res.status(401).json({ error: "Sign in again." });
    const u = await ur.json();
    const can = await fetch(SB_URL + "/rest/v1/rpc/chat_can_read", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ ch }) });
    if (!can.ok || (await can.json()) !== true) return res.status(403).json({ error: "You're not in that chat." });
    const sr = await fetch(SB_URL + `/rest/v1/staff?id=eq.${u.id}&select=name,can_manage,active`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    const me = ((await sr.json()) || [])[0];
    if (!me || !me.active) return res.status(403).json({ error: "This login isn't active." });

    const name = "pl-" + crypto.createHash("sha256").update("prolight:" + ch).digest("hex").slice(0, 20);
    let room = await daily("/rooms/" + name);
    if (!room.ok) {
      room = await daily("/rooms", { method: "POST", body: JSON.stringify({ name, privacy: "private", properties: { enable_prejoin_ui: true, enable_chat: false, enable_screenshare: true, start_audio_off: false, start_video_off: false, eject_at_room_exp: false } }) });
      if (!room.ok) return res.status(502).json({ error: "Daily: " + ((room.j && (room.j.info || room.j.error)) || room.status) });
    }
    const exp = Math.floor(Date.now() / 1000) + 4 * 3600;
    const t = await daily("/meeting-tokens", { method: "POST", body: JSON.stringify({ properties: { room_name: name, user_name: me.name, user_id: u.id, exp, is_owner: !!me.can_manage } }) });
    if (!t.ok) return res.status(502).json({ error: "Daily: " + ((t.j && (t.j.info || t.j.error)) || t.status) });
    await fetch(SB_URL + "/rest/v1/push_log", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" }, body: JSON.stringify({ key: `join:${ch}:${u.id}:${Date.now()}` }) }).catch(() => {});
    return res.status(200).json({ url: room.j.url, token: t.j.token });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
