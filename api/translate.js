// Translates crew notes, job notes and chat messages to Spanish for people who picked Español.
//   POST /api/translate { texts: ["..."], to: "es" }   (signed-in board user) -> { out: ["..."] }
// Uses GEMINI_API_KEY (the same key as the mockup AI). GEMINI_TEXT_MODEL is optional.
const SB_URL = process.env.SUPABASE_URL || "https://xjjwhmrkeqrmkttombxx.supabase.co";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEY = process.env.GEMINI_API_KEY || "";
const MODELS = [process.env.GEMINI_TEXT_MODEL, "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean);
let good = null;

// Free fallback (no key needed): Google Translate's public web endpoint, one item at a time.
async function freeOne(text) {
  if (!text.trim()) return text;
  const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(text), { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("free translator " + r.status);
  const j = await r.json();
  return (j[0] || []).map((x) => x[0] || "").join("");
}
async function freeLong(text) {
  if (text.length <= 1500) return freeOne(text);
  const parts = text.split(/(\n+)/), out = []; let buf = "";
  for (const p of parts) { if ((buf + p).length > 1500 && buf) { out.push(await freeOne(buf)); buf = ""; } buf += p; }
  if (buf) out.push(await freeOne(buf));
  return out.join("");
}
async function free(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 6) out.push(...(await Promise.all(texts.slice(i, i + 6).map((t) => freeLong(t).catch(() => null)))));
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const ur = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + tok } });
    if (!tok || !ur.ok) return res.status(401).json({ error: "Sign in again." });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const texts = (Array.isArray(b.texts) ? b.texts : []).slice(0, 40).map((t) => String(t || "").slice(0, 4000));
    if (!texts.length) return res.status(200).json({ out: [] });
    if (!KEY) return res.status(200).json({ out: await free(texts), via: "free" });
    const prompt = `Translate each item in this JSON array from English to simple, clear Mexican Spanish for a Christmas light installation crew.
Keep names of people, streets, cities, product codes (C9, C7, LED), measurements, numbers, prices, times and dates exactly as they are.
Keep line breaks. Use everyday trade words: roofline = línea del techo, gutter = canaleta, gable/peak = pico / hastial, ridge = cumbrera, eave = alero, wrap = envolver, minis = luces mini, clips = clips, wreath = corona, garland = guirnalda, stakes = estacas, timer = temporizador, outlet = toma de corriente, warm white = blanco cálido, pure/cool white = blanco puro.
If an item is already in Spanish, return it unchanged.
Answer with ONLY a JSON array of strings, same length and order.

${JSON.stringify(texts)}`;
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } };
    let last = "";
    for (const m of good ? [good] : MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 || (j.error && /not found|not supported/i.test(j.error.message || ""))) { last = m; continue; }
      if (!r.ok) return res.status(200).json({ out: await free(texts), via: "free" });
      const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || "").join("");
      let out; try { out = JSON.parse(txt); } catch (e) { out = null; }
      if (!Array.isArray(out) || out.length !== texts.length) return res.status(200).json({ out: await free(texts), via: "free" });
      good = m;
      return res.status(200).json({ out: out.map((x) => String(x)) });
    }
    return res.status(200).json({ out: await free(texts), via: "free" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
