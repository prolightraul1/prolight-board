// Turns an address into map coordinates for the board.
// Tries the US Census geocoder first (best for house numbers), then OpenStreetMap.
// Signed-in board users only (Authorization: Bearer <session token>), 60 lookups a minute each.
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function signedInUser(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || tok.length > 4096) return null;
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  if (!u || !u.id) return null;
  // must be an active person on the board, not just any Supabase login
  const s = await fetch(SB_URL + `/rest/v1/staff?id=eq.${encodeURIComponent(u.id)}&select=active`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  const row = s.ok ? ((await s.json().catch(() => [])) || [])[0] : null;
  return row && row.active ? u : null;
}

async function underLimit(key, max, seconds) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/rate_ok", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_key: key, p_max: max, p_seconds: seconds }) });
  if (!r.ok) return true; // limiter unavailable (e.g. update 17 not run yet): don't block the crews
  return (await r.json().catch(() => true)) !== false;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!SB_KEY) return res.status(500).json({ error: "The board's server key is missing." });
  const q = String((req.query && req.query.q) || "").trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: "Add an address with ?q=" });
  try {
    const u = await signedInUser(req);
    if (!u) return res.status(401).json({ error: "Sign in again." });
    if (!(await underLimit("geo:" + u.id, 60, 60))) return res.status(429).json({ error: "Too many address lookups. Wait a minute." });
  } catch (e) {
    return res.status(502).json({ error: "Couldn't check your sign-in" });
  }
  const withCity = /,/.test(q) ? q : q + ", Tallahassee, FL";
  try {
    const census = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" + encodeURIComponent(withCity);
    const r = await fetch(census);
    if (r.ok) {
      const d = await r.json();
      const m = d && d.result && d.result.addressMatches && d.result.addressMatches[0];
      if (m) return res.status(200).json({ lat: m.coordinates.y, lng: m.coordinates.x, source: "census", matched: m.matchedAddress });
    }
    const osm = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" + encodeURIComponent(withCity);
    const n = await fetch(osm, { headers: { "User-Agent": "ProLight Season Board geocoder" } });
    if (n.ok) {
      const a = await n.json();
      if (a && a[0]) return res.status(200).json({ lat: +a[0].lat, lng: +a[0].lon, source: "osm", matched: a[0].display_name });
    }
    return res.status(404).json({ error: "No match for that address" });
  } catch (e) {
    return res.status(502).json({ error: "Address lookup is unavailable right now" });
  }
};
