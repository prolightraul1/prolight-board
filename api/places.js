// Nearby food for the "I'm hungry" lunch search.
//   GET /api/places?lat=30.45&lng=-84.27
// Uses OpenStreetMap place search (fast), with the Overpass map database as a backup.
const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const cache = new Map(); // key -> { at, list }

async function ask(url, q) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 22000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "ProLight-Season-Board/1.0 (prolight-boardv1.vercel.app)" }, body: "data=" + encodeURIComponent(q), signal: ctl.signal });
    if (!r.ok) throw new Error(url + " " + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.elements)) throw new Error(url + " bad reply");
    return d.elements;
  } finally { clearTimeout(t); }
}

module.exports = async (req, res) => {
  const lat = Number(req.query && req.query.lat), lng = Number(req.query && req.query.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: "Bad location" });
  const key = lat.toFixed(2) + "," + lng.toFixed(2), hit = cache.get(key);
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  if (hit && Date.now() - hit.at < 864e5) return res.status(200).json({ elements: hit.list, cached: true });
  const keep = (t) => { const o = {}; for (const k of ["name", "brand", "amenity", "cuisine", "drive_through", "opening_hours"]) if (t[k]) o[k] = t[k]; return o; };
  const send = (list, from) => { list = list.filter((e) => e.tags.name || e.tags.brand); cache.set(key, { at: Date.now(), list }); if (cache.size > 500) cache.delete(cache.keys().next().value); return res.status(200).json({ elements: list, from }); };
  // 1) OpenStreetMap's place search: fast (well under a second per type). One request per second, per their rules.
  try {
    const dy = 0.045, dx = 0.052, box = [lng - dx, lat + dy, lng + dx, lat - dy].map((n) => n.toFixed(4)).join(","), out = [], seen = new Set();
    for (const [i, a] of ["fast_food", "restaurant", "cafe"].entries()) {
      if (i) await new Promise((ok) => setTimeout(ok, 1000));
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?amenity=${a}&viewbox=${box}&bounded=1&format=jsonv2&limit=40&extratags=1`, { headers: { "User-Agent": "ProLight-Season-Board/1.0 (prolight-boardv1.vercel.app)", "Accept-Language": "en" }, signal: ctl.signal }).finally(() => clearTimeout(t));
      if (!r.ok) throw new Error("nominatim " + r.status);
      for (const e of await r.json()) { if (seen.has(e.osm_id)) continue; seen.add(e.osm_id); const x = e.extratags || {};
        out.push({ tags: keep({ ...x, name: e.name, amenity: e.type || a }), lat: +e.lat, lon: +e.lon }); }
    }
    if (out.length) return send(out, "nominatim");
  } catch (e) { /* fall through */ }
  // 2) backup: the slower map database
  const q = `[out:json][timeout:20];(node["amenity"~"^(fast_food|cafe|restaurant)$"](around:4500,${lat},${lng});way["amenity"~"^(fast_food|cafe|restaurant)$"](around:4500,${lat},${lng}););out center tags 150;`;
  try {
    const { elements, m } = await Promise.any(MIRRORS.map(async (m) => ({ elements: await ask(m, q), m })));
    return send(elements.map((e) => ({ tags: keep(e.tags || {}), lat: e.lat ?? (e.center && e.center.lat), lon: e.lon ?? (e.center && e.center.lon) })), new URL(m).host);
  } catch (e) {
    return res.status(502).json({ error: "Every map server was busy" });
  }
};
module.exports.config = { maxDuration: 60 };
