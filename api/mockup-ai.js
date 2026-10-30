// "Make it look real": turns a drawn light mockup into a realistic night photo with Google's image AI.
//   POST /api/mockup-ai  { photo: base64 jpeg (daytime), mockup: base64 jpeg (drawn lights) }   (signed-in seller)
// Needs GEMINI_API_KEY in Vercel. GEMINI_IMAGE_MODEL is optional.
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY = process.env.GEMINI_API_KEY || "";
const MODELS = [process.env.GEMINI_IMAGE_MODEL, "gemini-3.1-flash-image", "gemini-nano-banana-2.1", "gemini-2.5-flash-image"].filter(Boolean);

const PROMPT = `You get two pictures of the same house.
Picture 1 is the real daytime photo.
Picture 2 is a rough sketch where we darkened it to night and drew Christmas lights on it as glowing dots.

Make a realistic, professional night photograph of this exact house with real, professionally installed Christmas lights, as if shot on a good phone camera at dusk.

Rules:
- Keep the house, roof, windows, doors, trees, bushes, driveway, camera angle and framing exactly the same as picture 1. Same size, same crop.
- Put real lights ONLY where lights are drawn in picture 2. Follow the same lines, the same colors and color order, the same bulb type (big C9 bulbs vs small mini lights) and roughly the same spacing.
- Do not add any lights, decorations, inflatables, people, cars, snow or text that are not in picture 2. Do not leave out any drawn lights.
- C9 bulbs sit evenly on the gutter and roof edges. Wraps spiral evenly around columns and trunks. Net lights cover bushes evenly. Lit wreaths are full green wreaths with lights.
- The lights should softly light up the nearby shingles, siding, columns, plants and ground the way real bulbs do. Deep blue twilight sky. Windows can have a soft warm glow.
- Remove the small caption text in the corner.`;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!KEY) return res.status(501).json({ error: "The AI step isn't set up yet. Add GEMINI_API_KEY in Vercel." });
  if (!SB_KEY) return res.status(500).json({ error: "The board's server key is missing." });
  try {
    const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const ur = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
    if (!tok || !ur.ok) return res.status(401).json({ error: "Sign in again." });
    const u = await ur.json();
    const sr = await fetch(SB_URL + `/rest/v1/staff?id=eq.${u.id}&select=name,can_manage,active`, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    const me = ((await sr.json()) || [])[0];
    if (!me || !me.active || !(me.can_manage || /^(raul|jarrod|brayden)\b/i.test(me.name || ""))) return res.status(403).json({ error: "Only people who sell jobs can use this." });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const ok = (x) => typeof x === "string" && x.length > 1000 && x.length < 3.2e6 && /^[A-Za-z0-9+/=]+$/.test(x);
    if (!ok(b.photo) || !ok(b.mockup)) return res.status(400).json({ error: "Send the photo and the mockup." });
    const body = { contents: [{ role: "user", parts: [{ text: "Picture 1:" }, { inline_data: { mime_type: "image/jpeg", data: b.photo } }, { text: "Picture 2:" }, { inline_data: { mime_type: "image/jpeg", data: b.mockup } }, { text: PROMPT + (b.extra ? "\nAlso: " + String(b.extra).slice(0, 300) : "") }] }], generationConfig: { responseModalities: ["IMAGE"] } };
    let last = "";
    for (const m of MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 || (j.error && /not found|not supported/i.test(j.error.message || ""))) { last = m + ": " + ((j.error || {}).message || r.status); continue; }
      if (!r.ok) return res.status(502).json({ error: "The AI said: " + String((j.error || {}).message || r.status).slice(0, 200) });
      const parts = ((((j.candidates || [])[0] || {}).content || {}).parts) || [];
      const img = parts.find((p) => (p.inlineData || p.inline_data));
      if (!img) return res.status(502).json({ error: "The AI didn't send a picture back. Try again." });
      const d = img.inlineData || img.inline_data;
      return res.status(200).json({ image: d.data, mime: d.mimeType || d.mime_type || "image/png", model: m });
    }
    return res.status(502).json({ error: "No image model available. " + last.slice(0, 160) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
module.exports.config = { maxDuration: 60 };
