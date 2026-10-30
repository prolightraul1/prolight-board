// Nearby food for the "I'm hungry" lunch search.
//   GET /api/places?lat=30.45&lng=-84.27
// Asks several OpenStreetMap (Overpass) servers in turn, so one busy server doesn't break lunch.
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const cache = new Map(); // key -> { at, list }

async function ask(url, q) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ProLight-Season-Board/1.0" }, body: "data=" + encodeURIComponent(q), signal: ctl.signal });
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
  // only the tags the board uses, so replies are small
  const q = `[out:json][timeout:8];(node["amenity"~"^(fast_food|cafe|restaurant)$"](around:4500,${lat},${lng});way["amenity"~"^(fast_food|cafe|restaurant)$"](around:4500,${lat},${lng}););out center tags 150;`;
  const keep = (t) => { const o = {}; for (const k of ["name", "brand", "amenity", "cuisine", "drive_through", "opening_hours"]) if (t[k]) o[k] = t[k]; return o; };
  try {
    // ask every map server at once and use whichever answers first
    const { elements, m } = await Promise.any(MIRRORS.map(async (m) => ({ elements: await ask(m, q), m })));
    const list = elements.map((e) => ({ tags: keep(e.tags || {}), lat: e.lat ?? (e.center && e.center.lat), lon: e.lon ?? (e.center && e.center.lon) })).filter((e) => e.tags.name || e.tags.brand);
    cache.set(key, { at: Date.now(), list });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return res.status(200).json({ elements: list, from: new URL(m).host });
  } catch (e) {
    return res.status(502).json({ error: "Every map server was busy" });
  }
};
module.exports.config = { maxDuration: 60 };
