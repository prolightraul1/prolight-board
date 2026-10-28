// Turns an address into map coordinates for the board.
// Tries the US Census geocoder first (best for house numbers), then OpenStreetMap.
module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: "Add an address with ?q=" });
  const withCity = /,/.test(q) ? q : q + ", Tallahassee, FL";
  try {
    const census = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" + encodeURIComponent(withCity);
    const r = await fetch(census);
    if (r.ok) {
      const d = await r.json();
      const m = d && d.result && d.result.addressMatches && d.result.addressMatches[0];
      if (m) {
        res.setHeader("Cache-Control", "s-maxage=2592000");
        return res.status(200).json({ lat: m.coordinates.y, lng: m.coordinates.x, source: "census", matched: m.matchedAddress });
      }
    }
    const osm = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=" + encodeURIComponent(withCity);
    const n = await fetch(osm, { headers: { "User-Agent": "ProLight Season Board geocoder" } });
    if (n.ok) {
      const a = await n.json();
      if (a && a[0]) {
        res.setHeader("Cache-Control", "s-maxage=2592000");
        return res.status(200).json({ lat: +a[0].lat, lng: +a[0].lon, source: "osm", matched: a[0].display_name });
      }
    }
    return res.status(404).json({ error: "No match for that address" });
  } catch (e) {
    return res.status(502).json({ error: "Address lookup is unavailable right now" });
  }
};
