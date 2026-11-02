/* ---------- light mockup studio (people who sell jobs) ---------- */
const canMock = () => !!(S.me && S.assets && sellers().some(p => p.id === S.me.id));

const MK_COLORS = { ww: ["Warm white", "#ffb75e"], cw: ["Pure white", "#e9f1ff"], red: ["Red", "#ff1a12"], green: ["Green", "#12e04c"], blue: ["Blue", "#2a5cff"], gold: ["Gold", "#ffb21a"], orange: ["Orange", "#ff7a12"], purple: ["Purple", "#a64dff"], pink: ["Pink", "#ff4fb0"], teal: ["Teal", "#17e0cf"] };
const MK_SETS = [
  ["Warm white", ["ww"]], ["Pure white", ["cw"]], ["Multicolor", ["red", "green", "blue", "gold", "orange"]], ["Red / green / white", ["red", "green", "cw"]],
  ["Candy cane", ["cw", "cw", "red", "red"]], ["Red & white", ["red", "cw"]], ["Warm white & red", ["ww", "red"]], ["Red & green", ["red", "green"]],
  ["Blue & white", ["blue", "cw"]], ["Red", ["red"]], ["Green", ["green"]], ["Blue", ["blue"]], ["Purple & orange", ["purple", "orange"]], ["Gold", ["gold"]]
];
const MK_BULBS = { c9: ["C9", 0.095, 6.5], c7: ["C7", 0.075, 6], g40: ["Globe", 0.13, 5.5], mini: ["Mini", 0.04, 8], fairy: ["Fairy", 0.025, 9] };
// shape: line (tap points), area (outline), wrap/cone/beam (top→bottom or base→aim), circle (center→edge)
const MK_KINDS = [
  { k: "roof", n: "Roofline / gutter", i: "⌂", s: "line", b: "c9", sp: 12, g: "Roofline" },
  { k: "peak", n: "Peak / gable", i: "▲", s: "line", b: "c9", sp: 12, g: "Roofline" },
  { k: "ridge", n: "Ridge line", i: "⎺", s: "line", b: "c9", sp: 12, g: "Roofline" },
  { k: "outline", n: "Window / door outline", i: "▢", s: "line", b: "mini", sp: 3, closed: true, g: "Roofline" },
  { k: "icicle", n: "Icicle lights", i: "⋮", s: "line", b: "mini", sp: 3, g: "Roofline" },
  { k: "garland", n: "Lit garland", i: "〰", s: "line", b: "mini", sp: 3, g: "Roofline" },
  { k: "column", n: "Column wrap", i: "∥", s: "wrap", b: "mini", sp: 2, w: 1.1, gap: 3, g: "Wraps" },
  { k: "trunk", n: "Tree trunk wrap", i: "⌇", s: "wrap", b: "mini", sp: 2, w: 0.9, gap: 3, taper: 0.25, g: "Wraps" },
  { k: "palm", n: "Palm wrap", i: "🌴", s: "wrap", b: "mini", sp: 2, w: 1.1, gap: 2, taper: 0.15, g: "Wraps" },
  { k: "branch", n: "Branch / limb wrap", i: "⟋", s: "line", b: "mini", sp: 2, zig: true, g: "Wraps" },
  { k: "canopy", n: "Tree canopy", i: "♣", s: "area", b: "mini", sp: 5, fill: "random", g: "Trees & bushes" },
  { k: "bush", n: "Bush / hedge (nets)", i: "☁", s: "area", b: "mini", sp: 4, fill: "net", g: "Trees & bushes" },
  { k: "spritzer", n: "Spritzer / cone tree", i: "△", s: "cone", b: "mini", sp: 3, w: 0.55, g: "Trees & bushes" },
  { k: "wreath", n: "Lit wreath", i: "◯", s: "circle", b: "mini", r: 2, bow: true, g: "Decor" },
  { k: "star", n: "Star", i: "★", s: "circle", b: "mini", sp: 2, r: 1.5, g: "Decor" },
  { k: "winglow", n: "Lit window (inside glow)", i: "▣", s: "area", nob: true, g: "Decor" },
  { k: "stakes", n: "Pathway / ground stakes", i: "⋯", s: "line", b: "c9", sp: 24, ground: true, g: "Ground" },
  { k: "bed", n: "Landscape bed edge", i: "⌒", s: "line", b: "c9", sp: 12, ground: true, g: "Ground" },
  { k: "flood", n: "Spotlight / uplight", i: "◢", s: "beam", spread: 26, g: "Ground" },
  { k: "line", n: "Custom line", i: "／", s: "line", b: "mini", sp: 4, g: "Other" },
  { k: "area", n: "Custom area", i: "⬠", s: "area", b: "mini", sp: 4, fill: "net", g: "Other" }
];
const mkKind = (k) => MK_KINDS.find((x) => x.k === k) || MK_KINDS[0];
const MK = { open: false };

/* small helpers */
function mkRng(seed) { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mkHex = (c) => (MK_COLORS[c] || [0, c])[1];
const mkRgb = (h) => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const mkDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function mkPolyLen(p, closed) { let L = 0; for (let i = 1; i < p.length; i++) L += mkDist(p[i - 1], p[i]); if (closed && p.length > 2) L += mkDist(p[p.length - 1], p[0]); return L; }
function mkWalk(p, closed, step, cb) {
  const P = closed && p.length > 2 ? [...p, p[0]] : p; if (P.length < 2 || step <= 0) { if (P[0]) cb(P[0][0], P[0][1], 0, 0); return; }
  let carry = 0, n = 0;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    let d = carry; while (d <= L) { cb(x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L, a, n++); d += step; } carry = d - L;
  }
  if (!closed) { const e = P[P.length - 1]; cb(e[0], e[1], 0, n++); }
}
function mkInPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function mkPolyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); }
function mkSegDist(q, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1; let t = ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); }

/* glow sprites, one per color */
const mkSprites = new Map();
function mkSprite(hex, core) {
  const key = hex + (core === "s" ? "s" : core ? "c" : "g"); if (mkSprites.has(key)) return mkSprites.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), [r, g, b] = mkRgb(hex);
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (core === "s") { gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},.6)`); gr.addColorStop(0.55, `rgba(${r},${g},${b},.18)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); }
  else if (core) { gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)},1)`); gr.addColorStop(0.75, `rgba(${r},${g},${b},.9)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); }
  else { gr.addColorStop(0, `rgba(${r},${g},${b},.75)`); gr.addColorStop(0.18, `rgba(${r},${g},${b},.42)`); gr.addColorStop(0.5, `rgba(${r},${g},${b},.11)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); }
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); mkSprites.set(key, c); return c;
}

/* ---------- turning each piece into bulbs ---------- */
function mkNew(k, pts) {
  const K = mkKind(k), el = { id: uid(), k, pts, b: K.b || "c9", colors: k === "wreath" || k === "garland" ? ["ww"] : ["ww"], mix: false, sp: K.sp || 12, size: 1, glow: 1, label: "" };
  if (K.w) el.w = K.w; if (K.gap) el.gap = K.gap; if (K.taper != null) el.taper = K.taper; if (K.fill) el.fill = K.fill; if (K.closed) el.closed = true;
  if (K.bow) el.bow = true; if (K.spread) el.spread = K.spread; if (k === "icicle") el.drop = 1.5; if (k === "spritzer") el.strands = 12;
  return el;
}
function mkBulbs(el) {
  const ft = MK.pxft, K = mkKind(el.k), B = MK_BULBS[el.b] || MK_BULBS.mini, out = [], rnd = mkRng(el.id), cols = (el.colors && el.colors.length ? el.colors : ["ww"]).map(mkHex);
  const r = Math.max(el.b === "c9" || el.b === "c7" || el.b === "g40" ? 1.2 : 0.75, B[1] * ft * (el.size || 1) * 1.25), sp = Math.max(r * 1.6, (el.sp || 12) / 12 * ft);
  let n = 0; const col = () => el.mix ? cols[Math.floor(rnd() * cols.length)] : cols[n++ % cols.length];
  const add = (x, y, dim = 0.8 + rnd() * 0.2, rr = r * (0.92 + rnd() * 0.16)) => out.push([x, y, col(), rr, dim]);
  const p = el.pts;
  if (K.nob) return out;
  if (K.s === "line" && p.length) {
    if (el.k === "icicle") { const drop = (el.drop || 1.5) * ft; mkWalk(p, false, 3 / 12 * ft * 2, (x, y) => { add(x, y); const L = drop * (0.35 + rnd() * 0.65); for (let d = sp; d <= L; d += sp) add(x, y + d); }); }
    else if (el.k === "garland") mkWalk(p, el.closed, sp, (x, y) => add(x + (rnd() - 0.5) * ft * 0.35, y + (rnd() - 0.5) * ft * 0.35));
    else if (K.zig) mkWalk(p, false, sp, (x, y, a, i) => { const o = Math.sin(i * 1.3) * ft * 0.18; add(x - Math.sin(a) * o, y + Math.cos(a) * o, Math.cos(i * 1.3) > -0.2 ? 1 : 0.35); });
    else mkWalk(p, el.closed, sp, (x, y) => add(x, y));
  } else if ((K.s === "wrap" || K.s === "cone") && p.length > 1) {
    const [t, b] = p, L = mkDist(t, b), ux = (b[0] - t[0]) / L, uy = (b[1] - t[1]) / L, nx = -uy, ny = ux;
    if (K.s === "cone") {
      const W = (el.w || 0.55) * L, S = el.strands || 12;
      for (let s = 0; s < S; s++) { const th = (s / S) * Math.PI * 2, z = Math.cos(th), xo = Math.sin(th); if (z < -0.35) continue;
        for (let d = sp * 0.6; d <= L; d += sp) { const f = d / L; add(t[0] + ux * d + nx * xo * W / 2 * f, t[1] + uy * d + ny * xo * W / 2 * f, z > 0 ? 1 : 0.3); } }
      add(t[0], t[1], 1, r * 1.6);
    } else {
      const W = (el.w || 1) * ft, gap = Math.max(0.6, el.gap || 3) / 12 * ft, turns = L / gap, tp = el.taper || 0;
      const steps = Math.ceil(turns * Math.hypot(Math.PI * W, gap) / sp);
      for (let i = 0; i <= steps; i++) { const f = i / steps, th = f * turns * Math.PI * 2, z = Math.cos(th), w = W * (1 - tp * (1 - f)) / 2;
        if (z < -0.2) continue; add(t[0] + ux * f * L + nx * Math.sin(th) * w, t[1] + uy * f * L + ny * Math.sin(th) * w, z > 0.15 ? 1 : 0.32); }
    }
  } else if (K.s === "area" && p.length > 2) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    if (el.fill === "random") { const N = Math.min(6000, Math.round(mkPolyArea(p) / (sp * sp))); let k = 0, tries = 0; while (k < N && tries++ < N * 6) { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (mkInPoly(x, y, p)) { add(x, y, 0.55 + rnd() * 0.45); k++; } } }
    else { for (let y = y0 + sp / 2, row = 0; y < y1; y += sp * 0.87, row++) for (let x = x0 + (row % 2 ? sp / 2 : 0); x < x1; x += sp) { const jx = x + (rnd() - 0.5) * sp * 0.25, jy = y + (rnd() - 0.5) * sp * 0.25; if (mkInPoly(jx, jy, p)) add(jx, jy, 0.35 + rnd() * 0.65); } }
  } else if (K.s === "circle" && p.length > 1) {
    const [c, e] = p, R = mkDist(c, e);
    if (el.k === "star") { const S = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.42 : R; S.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]); } mkWalk(S, true, sp, (x, y) => add(x, y)); }
    else { const band = R * 0.3, N = Math.round((2 * Math.PI * R) / (r * 2.6)); for (let i = 0; i < N * 2; i++) { const a = rnd() * Math.PI * 2, rr = R - band / 2 + (rnd() - 0.5) * band; add(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, 0.6 + rnd() * 0.4); } }
  }
  return out;
}
const mkCache = new Map();
function mkGet(el) { const key = JSON.stringify(el) + "|" + MK.pxft; const c = mkCache.get(el.id); if (c && c.key === key) return c.b; const b = mkBulbs(el); mkCache.set(el.id, { key, b }); return b; }

/* ---------- drawing ---------- */
function mkLayer(name, w, h) {
  const L = MK.L || (MK.L = {}); let c = L[name]; if (!c) c = L[name] = document.createElement("canvas");
  w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; return [c, x];
}
// cheap blur: shrink a few times, the smooth scaling does the softening
function mkSoften(src, tag, steps) { let cur = src; for (let i = 0; i < steps; i++) { const [c, x] = mkLayer(tag + i, cur.width / 2, cur.height / 2); x.drawImage(cur, 0, 0, c.width, c.height); cur = c; } return cur; }
function mkNightBase(n) {
  const key = Math.round(n * 50) / 50;
  if (MK.nb && MK.nb.img === MK.img && MK.nb.key === key) return MK.nb.c;
  const m = Math.min(1, n * 1.12), W = MK.W, H = MK.H, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(MK.img, 0, 0, W, H);
  let d; try { d = x.getImageData(0, 0, W, H); } catch (e) { x.globalCompositeOperation = "multiply"; x.fillStyle = `rgb(${Math.round(255 - 225 * n)},${Math.round(255 - 213 * n)},${Math.round(255 - 171 * n)})`; x.fillRect(0, 0, W, H); MK.nb = { img: MK.img, key, c }; return c; }
  const a = d.data, sm = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let y = 0, i = 0; y < H; y++) {
    const fy = y / H, top = 1 - sm(0.15, 0.7, fy), skyR = 10 + 26 * fy, skyG = 20 + 40 * fy, skyB = 52 + 62 * fy;
    for (let xx = 0; xx < W; xx++, i += 4) {
      const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, l = 0.299 * r + 0.587 * g + 0.114 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      // bright, blue-ish or washed-out pixels up high are sky
      const sky = top * sm(0.42, 0.8, l);
      const k = Math.pow(l, 1.7) / (l || 1), ds = 0.6;
      let nr = (r * (1 - ds) + l * ds) * k * 0.2, ng = (g * (1 - ds) + l * ds) * k * 0.25, nb = (b * (1 - ds) + l * ds) * k * 0.42;
      nr = nr * 255 * (1 - sky) + (skyR + l * 30) * sky; ng = ng * 255 * (1 - sky) + (skyG + l * 36) * sky; nb = nb * 255 * (1 - sky) + (skyB + l * 46) * sky;
      a[i] = r * 255 * (1 - m) + nr * m; a[i + 1] = g * 255 * (1 - m) + ng * m; a[i + 2] = b * 255 * (1 - m) + nb * m;
    }
  }
  x.putImageData(d, 0, 0); MK.nb = { img: MK.img, key, c }; return c;
}
const MK_SPILL = { c9: [2.6, 0.75], c7: [2.2, 0.62], g40: [2.8, 0.8], mini: [1.1, 0.4], fairy: [0.8, 0.3] };
// how tightly packed a piece's bulbs are, so a hedge net doesn't add up to a solid block of light
function mkDens(el, K, R) {
  const ft = MK.pxft, s1 = (el.sp || 12) / 12 * ft;
  if (K.s === "line") return Math.min(1, s1 / R);
  const s2 = K.s === "wrap" ? Math.sqrt(s1 * Math.max(0.6, el.gap || 3) / 12 * ft) * 0.8 : s1;
  return Math.min(1, (s2 / R) * (s2 / R) * 0.9);
}
function mkScene(ctx, o = {}) {
  const W = MK.W, H = MK.H, n = o.before ? 0 : MK.night, ft = MK.pxft, q = o.hi ? 3 : 5;
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  if (o.before) { ctx.drawImage(MK.img, 0, 0, W, H); return; }
  // 1. night: a real per-pixel conversion (deep blue sky, darker house), cached per slider value
  ctx.drawImage(n > 0 ? mkNightBase(n) : MK.img, 0, 0, W, H);
  if (n > 0) { const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.4, W / 2, H * 0.55, Math.max(W, H) * 0.8); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,6,${0.3 * n})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
  const G = MK.els.map((el) => ({ el, K: mkKind(el.k), B: MK_BULBS[el.b] || MK_BULBS.mini, bulbs: mkGet(el), g: MK.glow * (el.glow ?? 1) }));
  const lit = 0.4 + 0.6 * n;
  // 2. light map: where light lands on the house, yard and roof
  const [lm, lx] = mkLayer("lm", W / q, H / q); lx.fillStyle = "#000"; lx.fillRect(0, 0, lm.width, lm.height); lx.scale(1 / q, 1 / q); lx.globalCompositeOperation = "lighter";
  for (const { el, K, bulbs, g } of G) {
    const p = el.pts;
    if (K.s === "beam" && p.length > 1) { mkBeamPath(lx, el, 1.3 * g); continue; }
    if (el.k === "winglow" && p.length > 2) { const [r, gg, b] = mkRgb(mkHex((el.colors || ["ww"])[0])); lx.fillStyle = `rgba(${r},${gg},${b},${Math.min(1, 0.28 * g)})`; lx.beginPath(); p.forEach(([x, y], i) => i ? lx.lineTo(x, y) : lx.moveTo(x, y)); lx.closePath(); lx.fill(); continue; }
    const [R0, A0] = MK_SPILL[el.b] || MK_SPILL.mini, R = R0 * ft * Math.sqrt(g) * (K.ground ? 1.4 : 1), every = Math.max(1, Math.round(bulbs.length / 900)), A = A0 * mkDens(el, K, R);
    for (let i = 0; i < bulbs.length; i += every) { const [x, y, c, , dim] = bulbs[i]; lx.globalAlpha = Math.min(1, A * g * dim * every); lx.drawImage(mkSprite(c, "s"), x - R, y - R * (K.ground ? 0.7 : 1), R * 2, R * (K.ground ? 1.4 : 2)); }
    lx.globalAlpha = 1;
  }
  const soft = mkSoften(lm, "lb", 2);
  // 3. relight: the real photo, lit by that light (keeps shingles, siding and plants looking real)
  const [rl, rx] = mkLayer("rl", W / 2, H / 2); rx.drawImage(soft, 0, 0, rl.width, rl.height); rx.globalCompositeOperation = "multiply"; rx.drawImage(MK.img, 0, 0, rl.width, rl.height);
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, 1.15 * lit); ctx.drawImage(rl, 0, 0, W, H); ctx.globalAlpha = 0.5 * lit; ctx.drawImage(rl, 0, 0, W, H);
  ctx.globalAlpha = 0.16 * lit; ctx.drawImage(soft, 0, 0, W, H); ctx.globalAlpha = 1;
  // inside-window glow and spotlight haze
  for (const { el, K, g } of G) {
    const p = el.pts;
    if (el.k === "winglow" && p.length > 2) { const [r, gg, b] = mkRgb(mkHex((el.colors || ["ww"])[0])); let cx = 0, cy = 0, top = Infinity, bot = -Infinity; p.forEach(([x, y]) => { cx += x / p.length; cy += y / p.length; top = Math.min(top, y); bot = Math.max(bot, y); });
      const gr = ctx.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, `rgba(${r},${gg},${b},${0.06 * g})`); gr.addColorStop(0.6, `rgba(${r},${gg},${b},${0.2 * g})`); gr.addColorStop(1, `rgba(${r},${gg},${b},${0.3 * g})`);
      ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }
    if (K.s === "beam" && p.length > 1) { ctx.globalCompositeOperation = "lighter"; mkBeamPath(ctx, el, 0.18 * g * lit); ctx.globalCompositeOperation = "source-over"; const hex = mkHex((el.colors || ["ww"])[0]); ctx.drawImage(mkSprite(hex, true), p[0][0] - ft * 0.22, p[0][1] - ft * 0.22, ft * 0.44, ft * 0.44); }
  }
  // 4. things the lights are on: wreath, garland, wire
  ctx.globalCompositeOperation = "source-over";
  for (const { el, K, B } of G) {
    const p = el.pts;
    if (el.k === "wreath" && p.length > 1) { const R = mkDist(p[0], p[1]), rnd = mkRng(el.id + "w"); ctx.lineWidth = R * 0.34; ctx.strokeStyle = "#0d2a17"; ctx.beginPath(); ctx.arc(p[0][0], p[0][1], R, 0, 7); ctx.stroke();
      for (let i = 0; i < 160; i++) { const a = rnd() * 7, rr = R + (rnd() - 0.5) * R * 0.34; ctx.fillStyle = rnd() > 0.5 ? "#173f22" : "#0a2212"; ctx.beginPath(); ctx.arc(p[0][0] + Math.cos(a) * rr, p[0][1] + Math.sin(a) * rr, R * 0.05, 0, 7); ctx.fill(); }
      if (el.bow) { const x = p[0][0], y = p[0][1] + R, s2 = R * 0.3; ctx.fillStyle = "#9d0f18"; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - s2 * 2, y - s2 * 1.4, x - s2 * 2, y + s2 * 1.2, x, y); ctx.moveTo(x, y); ctx.bezierCurveTo(x + s2 * 2, y - s2 * 1.4, x + s2 * 2, y + s2 * 1.2, x, y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s2 * 0.15, y); ctx.lineTo(x - s2 * 0.8, y + s2 * 2.2); ctx.lineTo(x - s2 * 0.35, y + s2 * 2); ctx.lineTo(x + s2 * 0.35, y + s2 * 2); ctx.lineTo(x + s2 * 0.8, y + s2 * 2.2); ctx.lineTo(x + s2 * 0.15, y); ctx.fill(); ctx.fillStyle = "#c0151f"; ctx.beginPath(); ctx.arc(x, y, s2 * 0.32, 0, 7); ctx.fill(); } }
    if (el.k === "garland" && p.length > 1) { ctx.strokeStyle = "#0d2a17"; ctx.lineWidth = ft * 0.5; ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (el.closed) ctx.closePath(); ctx.stroke(); }
    if (K.s === "line" && p.length > 1 && !K.ground && el.k !== "garland" && el.k !== "icicle") { ctx.strokeStyle = "rgba(14,32,20,.85)"; ctx.lineWidth = Math.max(0.6, B[1] * ft * 0.22); ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath(); p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (el.closed) ctx.closePath(); ctx.stroke(); }
  }
  // 5. bloom: soft halo the way a camera sees bright bulbs
  const [bl, bx] = mkLayer("bl", W / q, H / q); bx.fillStyle = "#000"; bx.fillRect(0, 0, bl.width, bl.height); bx.scale(1 / q, 1 / q); bx.globalCompositeOperation = "lighter";
  for (const { el, K, B, bulbs, g } of G) { const S0 = (bulbs[0] || [0, 0, 0, 1])[3] * B[2] * 1.1 * Math.sqrt(g), d = K.s === "line" ? Math.min(1, 1.6 * mkDens(el, K, S0)) : Math.min(1, 0.7 * mkDens(el, K, S0));
    for (const [x, y, c, r, dim] of bulbs) { const S = r * B[2] * 1.1 * Math.sqrt(g); bx.globalAlpha = Math.min(1, 0.6 * dim * g * d); bx.drawImage(mkSprite(c), x - S, y - S, S * 2, S * 2); } }
  const bsoft = mkSoften(bl, "bb", 1);
  ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, 0.9 * lit); ctx.drawImage(bsoft, 0, 0, W, H); ctx.globalAlpha = Math.min(1, 0.55 * lit); ctx.drawImage(bl, 0, 0, W, H);
  // 6. tight halo + the bulbs themselves
  const flat = (el, K, r) => K.s === "line" ? 1 : Math.min(1, 0.6 * mkDens(el, K, r * 2.6));
  for (const { el, K, bulbs, g } of G) { const f = flat(el, K, (bulbs[0] || [0, 0, 0, 1])[3]); for (const [x, y, c, r, dim] of bulbs) { const S = r * 2.4 * Math.sqrt(g); ctx.globalAlpha = Math.min(1, 0.75 * dim * dim * g * lit * f); ctx.drawImage(mkSprite(c), x - S, y - S, S * 2, S * 2); } }
  ctx.globalCompositeOperation = "source-over";
  for (const { el, K, bulbs } of G) {
    const tall = el.b === "c9" || el.b === "c7", f = flat(el, K, (bulbs[0] || [0, 0, 0, 1])[3]);
    for (const [x, y, c, r, dim] of bulbs) { ctx.globalAlpha = Math.min(1, (0.25 + dim * 0.75) * (0.4 + 0.6 * f)); if (tall) ctx.drawImage(mkSprite(c, true), x - r * 1.05, y - r * 1.55, r * 2.1, r * 3.1); else ctx.drawImage(mkSprite(c, true), x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4); }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}
function mkBeamPath(ctx, el, k) {
  const [a, b] = el.pts, L = mkDist(a, b), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), sp = (el.spread || 26) * Math.PI / 180, [r, g, bl] = mkRgb(mkHex((el.colors || ["ww"])[0])), T = Math.tan(sp / 2) * L * 1.15;
  ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(ang);
  const gr = ctx.createLinearGradient(0, 0, L * 1.15, 0); gr.addColorStop(0, `rgba(${r},${g},${bl},${Math.min(1, 0.9 * k)})`); gr.addColorStop(0.65, `rgba(${r},${g},${bl},${Math.min(1, 0.45 * k)})`); gr.addColorStop(1, `rgba(${r},${g},${bl},0)`);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 1.15, -T); ctx.lineTo(L * 1.15, T); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = Math.min(1, 0.8 * k); ctx.drawImage(mkSprite(mkHex((el.colors || ["ww"])[0]), "s"), L - T, -T, T * 2, T * 2); ctx.restore();
}
function mkHandles(ctx, s) {
  const el = MK.els.find((e) => e.id === MK.sel) || MK.adding; const hr = 9 / s;
  if (MK.scaleLine) { ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3 / s; ctx.setLineDash([8 / s, 6 / s]); ctx.beginPath(); MK.scaleLine.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.setLineDash([]); MK.scaleLine.forEach(([x, y]) => { ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(x, y, hr, 0, 7); ctx.fill(); }); }
  if (!el) return; const K = mkKind(el.k), p = el.pts;
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2 / s; ctx.setLineDash([7 / s, 5 / s]); ctx.beginPath();
  if (K.s === "circle" && p.length > 1) ctx.arc(p[0][0], p[0][1], mkDist(p[0], p[1]), 0, 7);
  else { p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if ((K.s === "area" || el.closed) && p.length > 2) ctx.closePath(); }
  ctx.stroke(); ctx.setLineDash([]);
  p.forEach(([x, y], i) => { ctx.fillStyle = i === p.length - 1 && MK.adding ? "#ffd23f" : "#fff"; ctx.strokeStyle = "#111916"; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.arc(x, y, hr, 0, 7); ctx.fill(); ctx.stroke(); });
}
function mkDraw() {
  if (!MK.open || !MK.cv) return; cancelAnimationFrame(MK.raf);
  MK.raf = requestAnimationFrame(() => {
    const cv = MK.cv, box = cv.parentElement, dpr = Math.min(2, window.devicePixelRatio || 1), cw = box.clientWidth, ch = box.clientHeight;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const ctx = cv.getContext("2d"); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#0b0f0d"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!MK.img) return;
    const v = mkView(); ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.x, dpr * v.y);
    if (MK.showAI && MK.ai && MK.ai.im && !MK.before) { const im = MK.ai.im, sc = Math.min(MK.W / im.width, MK.H / im.height); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, MK.W, MK.H); ctx.drawImage(im, (MK.W - im.width * sc) / 2, (MK.H - im.height * sc) / 2, im.width * sc, im.height * sc); return; }
    mkScene(ctx, { before: MK.before }); if (!MK.before) mkHandles(ctx, v.s);
  });
}
function mkView() { const cv = MK.cv, cw = cv.parentElement.clientWidth, ch = cv.parentElement.clientHeight, f = Math.min(cw / MK.W, ch / MK.H) * 0.96, s = f * MK.z; return { s, x: (cw - MK.W * s) / 2 + MK.px, y: (ch - MK.H * s) / 2 + MK.py }; }
function mkToImg(ev) { const r = MK.cv.getBoundingClientRect(), v = mkView(); return [(ev.clientX - r.left - v.x) / v.s, (ev.clientY - r.top - v.y) / v.s]; }

/* ---------- footage ---------- */
function mkFootage() {
  const rows = {}, ft = MK.pxft;
  for (const el of MK.els) {
    const K = mkKind(el.k), p = el.pts, key = el.label || K.n; let q = 0, u = "ft";
    if (K.s === "line") q = mkPolyLen(p, el.closed) / ft;
    else if (K.s === "wrap") { const L = mkDist(p[0], p[1]) / ft, W = el.w || 1; q = L / ((el.gap || 3) / 12) * Math.hypot(Math.PI * W, (el.gap || 3) / 12); u = "ft of strand"; }
    else if (K.nob) { q = 1; u = "light"; }
    else if (K.s === "area") { q = mkPolyArea(p) / (ft * ft); u = "sq ft"; }
    else if (K.s === "cone") { q = mkDist(p[0], p[1]) / ft; u = "ft tall"; }
    else if (K.s === "circle") { q = mkDist(p[0], p[1]) * 2 / ft * 12; u = "in across"; }
    else { q = 1; u = "light"; }
    const k = key + "|" + u; rows[k] = rows[k] || { name: key, u, q: 0, n: 0, g: K.g }; rows[k].q += q; rows[k].n++;
  }
  return Object.values(rows);
}
const mkRoofFt = () => Math.round(MK.els.filter((e) => mkKind(e.k).g === "Roofline" && mkKind(e.k).s === "line" && !["outline", "icicle", "garland"].includes(e.k)).reduce((a, e) => a + mkPolyLen(e.pts, e.closed), 0) / MK.pxft);

/* ---------- open / close ---------- */
async function openMockup(jobId, editId) {
  if (!canMock()) { toast("Only people who sell jobs can make mockups."); return; }
  Object.assign(MK, { open: true, jobId: jobId || "", editId: editId || "", img: null, W: 0, H: 0, els: [], sel: "", adding: null, night: 0.88, glow: 1, pxft: 0, scaled: false, z: 1, px: 0, py: 0, undo: [], redo: [], dirty: false, photoId: "", before: false, panel: "add", scaleLine: null, confirmClose: false, saving: false });
  let root = $("#mockRoot"); if (!root) { root = document.createElement("div"); root.id = "mockRoot"; document.body.appendChild(root); mkBind(root); }
  root.hidden = false; document.body.classList.add("in-mock");
  const j = jobId && S.jobs.get(jobId), m = editId && j && (j.mockups || []).find((x) => x.id === editId);
  mkRender();
  if (m && m.studio) {
    const st = m.studio; Object.assign(MK, { els: JSON.parse(JSON.stringify(st.els || [])), night: st.night ?? 0.72, glow: st.glow ?? 1, photoId: st.photo, scaled: !!st.scaled });
    try { await mkLoadSrc(mediaUrl(st.photo)); MK.pxft = st.pxft || MK.W / 55; MK.panel = "add"; } catch (e) { toast("Couldn't load the original photo for that mockup."); }
    mkRender();
  }
}
function closeMockup(force) {
  if (!force && MK.dirty && MK.els.length) { MK.confirmClose = true; mkRender(); return; }
  MK.open = false; const r = $("#mockRoot"); if (r) { r.hidden = true; r.innerHTML = ""; } document.body.classList.remove("in-mock"); mkCache.clear();
}
function mkLoadSrc(src) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => { mkSetImg(im); res(); }; im.onerror = rej; im.src = src; });
}
function mkSetImg(src) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, sc = Math.min(1, 2400 / Math.max(w, h));
  const c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  Object.assign(MK, { img: c, W: c.width, H: c.height, z: 1, px: 0, py: 0 }); if (!MK.pxft) MK.pxft = c.width / 55;
}
async function mkPickFile(f) {
  if (!f) return; try { const bmp = await createImageBitmap(f); mkSetImg(bmp); MK.photoId = ""; MK.photoFile = f; MK.pxft = MK.W / 55; MK.scaled = false; MK.els = []; MK.dirty = true; mkRender(); }
  catch (e) { toast("Couldn't read that photo. Try a JPG or PNG."); }
}

/* ---------- edits ---------- */
const mkSel = () => MK.els.find((e) => e.id === MK.sel);
function mkSnap() { if (MK.ai) { MK.ai.stale = true; MK.useAI = false; MK.showAI = false; } MK.undo.push(JSON.stringify(MK.els)); if (MK.undo.length > 80) MK.undo.shift(); MK.redo = []; MK.dirty = true; MK.snapKey = ""; }
function mkSnapOnce(key) { if (MK.snapKey === key) return; mkSnap(); MK.snapKey = key; }
function mkUndo() { if (MK.adding) { MK.adding.pts.pop(); if (!MK.adding.pts.length) MK.adding = null; mkRender(); return; } if (!MK.undo.length) return; MK.redo.push(JSON.stringify(MK.els)); MK.els = JSON.parse(MK.undo.pop()); if (!mkSel()) MK.sel = ""; MK.snapKey = ""; mkRender(); }
function mkRedo() { if (!MK.redo.length) return; MK.undo.push(JSON.stringify(MK.els)); MK.els = JSON.parse(MK.redo.pop()); MK.snapKey = ""; mkRender(); }
function mkStartAdd(k) { MK.sel = ""; MK.adding = mkNew(k, []); const cur = MK.lastColors; if (cur && k !== "flood") MK.adding.colors = [...cur]; MK.panel = "adding"; mkRender(); }
function mkFinish() {
  const a = MK.adding; if (!a) return; const tol = 6 / mkView().s;
  a.pts = a.pts.filter((p, i) => !i || mkDist(p, a.pts[i - 1]) > tol); delete a._just;
  const K = mkKind(a.k), need = K.s === "area" ? 3 : 2;
  if (a.pts.length < need) { toast(K.s === "area" ? "Tap at least 3 points around it." : "Tap at least 2 points."); return; }
  mkSnap(); MK.els.push(a); MK.adding = null; MK.sel = a.id; MK.panel = "edit"; mkRender();
}
function mkDefaultEnd(k, p) {
  const ft = MK.pxft, K = mkKind(k);
  if (K.s === "wrap") return [p[0], p[1] + ft * (k === "column" ? 9 : 8)];
  if (K.s === "cone") return [p[0], p[1] + ft * 5];
  if (K.s === "circle") return [p[0] + ft * (K.r || 2), p[1]];
  if (K.s === "beam") return [p[0] + ft * 1.5, p[1] - ft * 10];
  return null;
}
function mkHit(q) {
  const s = mkView().s, tol = 14 / s;
  for (let i = MK.els.length - 1; i >= 0; i--) {
    const el = MK.els[i], K = mkKind(el.k), p = el.pts;
    if (K.s === "area" && p.length > 2 && mkInPoly(q[0], q[1], p)) return el;
    if (K.s === "circle" && p.length > 1 && mkDist(q, p[0]) < mkDist(p[0], p[1]) * 1.2 + tol) return el;
    if (["wrap", "cone", "beam"].includes(K.s) && p.length > 1 && mkSegDist(q, p[0], p[1]) < Math.max(tol, (el.w || 0.5) * MK.pxft / 2 + tol / 2)) return el;
    if (K.s === "line") { const P = el.closed && p.length > 2 ? [...p, p[0]] : p; for (let j = 1; j < P.length; j++) if (mkSegDist(q, P[j - 1], P[j]) < tol) return el; if (p.length === 1 && mkDist(q, p[0]) < tol) return el; }
  }
  return null;
}

/* ---------- pointer: draw, drag, pan, pinch ---------- */
function mkPointer(cv) {
  const P = new Map(); let drag = null;
  cv.addEventListener("pointerdown", (ev) => {
    if (!MK.img) return; cv.setPointerCapture(ev.pointerId); P.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (P.size === 2) { const [a, b] = [...P.values()]; drag = { pinch: true, d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: MK.z, px: MK.px, py: MK.py, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; if (MK.adding && MK.adding._just) { MK.adding.pts.pop(); MK.adding._just = false; } return; }
    const q = mkToImg(ev), s = mkView().s, tol = 16 / s;
    if (MK.scaleMode) { MK.scaleLine = MK.scaleLine && MK.scaleLine.length === 1 ? [MK.scaleLine[0], q] : [q]; drag = { scale: true }; if (MK.scaleLine.length === 2) MK.panel = "scale2"; mkRender(); return; }
    if (MK.adding) {
      const a = MK.adding, K = mkKind(a.k);
      if (["wrap", "cone", "circle", "beam"].includes(K.s)) { a.pts = [q, q]; drag = { two: true, start: q, moved: false }; }
      else { const h = a.pts.findIndex((p) => mkDist(p, q) < tol); if (h >= 0) drag = { pt: h, el: a }; else { a.pts.push(q); a._just = true; drag = { pt: a.pts.length - 1, el: a, add: true }; } }
      mkDraw(); return;
    }
    const sel = mkSel();
    if (sel) { const h = sel.pts.findIndex((p) => mkDist(p, q) < tol); if (h >= 0) { mkSnap(); drag = { pt: h, el: sel }; return; } }
    const hit = mkHit(q);
    if (hit) { const was = MK.sel === hit.id; MK.sel = hit.id; MK.panel = "edit"; drag = { move: true, el: hit, last: q, snapped: false }; if (!was) mkRender(); else mkDraw(); return; }
    if (MK.sel) { MK.sel = ""; MK.panel = "add"; mkRender(); }
    drag = { pan: true, x: ev.clientX, y: ev.clientY, px: MK.px, py: MK.py };
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!P.has(ev.pointerId)) return; P.set(ev.pointerId, [ev.clientX, ev.clientY]); if (!drag) return;
    if (drag.pinch && P.size >= 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); MK.z = Math.max(0.5, Math.min(8, drag.z * d / drag.d)); MK.px = drag.px + ((a[0] + b[0]) / 2 - drag.cx); MK.py = drag.py + ((a[1] + b[1]) / 2 - drag.cy); mkDraw(); return; }
    const q = mkToImg(ev);
    if (drag.scale) { MK.scaleLine[MK.scaleLine.length - 1] = q; mkDraw(); return; }
    if (drag.two) { MK.adding.pts[1] = q; drag.moved = drag.moved || mkDist(q, drag.start) > 8 / mkView().s; mkDraw(); return; }
    if (drag.pt != null) { drag.el.pts[drag.pt] = q; if (drag.el !== MK.adding) MK.dirty = true; mkDraw(); return; }
    if (drag.move) { const dx = q[0] - drag.last[0], dy = q[1] - drag.last[1]; if (!drag.snapped) { if (Math.hypot(dx, dy) < 4 / mkView().s) return; mkSnap(); drag.snapped = true; } drag.el.pts = drag.el.pts.map(([x, y]) => [x + dx, y + dy]); drag.last = q; mkDraw(); return; }
    if (drag.pan) { MK.px = drag.px + ev.clientX - drag.x; MK.py = drag.py + ev.clientY - drag.y; mkDraw(); }
  });
  const up = (ev) => {
    P.delete(ev.pointerId); if (!drag) return; const d = drag; if (P.size) { if (d.pinch) drag = null; return; } drag = null;
    if (d.two) { const a = MK.adding; if (!d.moved) a.pts[1] = mkDefaultEnd(a.k, a.pts[0]); mkFinish(); return; }
    if (d.add && MK.adding) MK.adding._just = false;
    if (d.pt != null || d.move) mkRender(); else if (d.scale) mkRender();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("dblclick", (ev) => { if (MK.adding && mkKind(MK.adding.k).s !== "beam") { ev.preventDefault(); mkFinish(); } });
  cv.addEventListener("wheel", (ev) => { if (!MK.img) return; ev.preventDefault(); const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, v = mkView(), ix = (mx - v.x) / v.s, iy = (my - v.y) / v.s;
    MK.z = Math.max(0.5, Math.min(8, MK.z * Math.exp(-ev.deltaY * 0.0015))); const v2 = mkView(); MK.px += mx - (ix * v2.s + v2.x); MK.py += my - (iy * v2.s + v2.y); mkDraw(); }, { passive: false });
}

/* ---------- panel UI ---------- */
function mkColorsUI(el) {
  const cur = (el.colors || []).join(",");
  return `<div class="mk-f"><span class="mk-lbl">Colors</span><div class="mk-sets">${MK_SETS.map(([n, c]) => `<button type="button" class="mk-set" data-mk="set" data-v="${c.join(",")}" aria-pressed="${cur === c.join(",")}" title="${esc(n)}"><i>${c.map((x) => `<b style="background:${mkHex(x)}"></b>`).join("")}</i>${esc(n)}</button>`).join("")}</div>
    <span class="mk-lbl">Or build the order on the strand</span>
    <div class="mk-seq">${(el.colors || []).map((c, i) => `<button type="button" class="mk-dot" style="background:${mkHex(c)}" data-mk="col-rm" data-v="${i}" title="Remove ${esc((MK_COLORS[c] || [c])[0])}">×</button>`).join("")}</div>
    <div class="mk-pal">${Object.entries(MK_COLORS).map(([k, [n, h]]) => `<button type="button" class="mk-sw" style="background:${h}" data-mk="col-add" data-v="${k}" title="Add ${esc(n)}" aria-label="Add ${esc(n)}"></button>`).join("")}<label class="mk-sw mk-cust" title="Any color">+<input type="color" id="mk-cc" value="#ffc469"></label></div>
    ${(el.colors || []).length > 1 ? `<label class="mk-chk"><input type="checkbox" id="mk-mix" ${el.mix ? "checked" : ""}> Random mix (not in order)</label>` : ""}</div>`;
}
const mkRange = (id, label, v, min, max, step, unit) => `<label class="mk-f"><span class="mk-lbl">${label} <b id="${id}-v">${v}${unit || ""}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
function mkEditUI(el) {
  const K = mkKind(el.k);
  let h = `<div class="mk-head"><b>${K.i} ${esc(el.label || K.n)}</b><button type="button" class="btn small" data-mk="desel">Done</button></div>
    <label class="mk-f"><span class="mk-lbl">Name on the list (optional)</span><input id="mk-label" value="${esc(el.label || "")}" placeholder="${esc(K.n)}"></label>
    <label class="mk-f"><span class="mk-lbl">Type</span><select id="mk-kind">${MK_KINDS.filter((x) => x.s === K.s || (["line"].includes(x.s) && K.s === "line")).map((x) => `<option value="${x.k}" ${x.k === el.k ? "selected" : ""}>${esc(x.n)}</option>`).join("")}</select></label>`;
  if (K.s !== "beam" && !K.nob) h += `<div class="mk-f"><span class="mk-lbl">Bulb</span><div class="seg mk-seg">${Object.entries(MK_BULBS).map(([k, [n]]) => `<button type="button" data-mk="bulb" data-v="${k}" aria-pressed="${el.b === k}">${n}</button>`).join("")}</div></div>`;
  h += mkColorsUI(el);
  if (["line", "area", "wrap", "cone", "circle"].includes(K.s) && el.k !== "wreath" && !K.nob) h += mkRange("mk-sp", K.s === "area" ? "Spacing in the net" : "Bulb spacing", el.sp, 1, 36, 1, '"');
  if (K.s === "wrap") h += mkRange("mk-gap", "Wrap spacing (tighter = more lights)", el.gap, 1, 12, 0.5, '"') + mkRange("mk-w", "How wide it is", el.w, 0.3, 4, 0.1, " ft") + mkRange("mk-taper", "Thinner at the bottom", Math.round((el.taper || 0) * 100), 0, 60, 5, "%");
  if (K.s === "cone") h += mkRange("mk-w", "Base width", Math.round((el.w || 0.55) * 100), 20, 120, 5, "%") + mkRange("mk-str", "Light strands", el.strands || 12, 6, 30, 1, "");
  if (el.k === "icicle") h += mkRange("mk-drop", "Longest icicle", el.drop || 1.5, 0.5, 4, 0.25, " ft");
  if (K.s === "area" && !K.nob) h += `<div class="mk-f"><span class="mk-lbl">Fill</span><div class="seg mk-seg"><button type="button" data-mk="fill" data-v="net" aria-pressed="${el.fill !== "random"}">Net (even)</button><button type="button" data-mk="fill" data-v="random" aria-pressed="${el.fill === "random"}">Scattered</button></div></div>`;
  if (K.s === "beam") h += mkRange("mk-spread", "Beam width", el.spread || 26, 8, 70, 1, "°");
  if (el.k === "wreath") h += `<label class="mk-chk"><input type="checkbox" id="mk-bow" ${el.bow ? "checked" : ""}> Red bow</label>`;
  if (K.s === "line" && !K.ground && el.k !== "icicle") h += `<label class="mk-chk"><input type="checkbox" id="mk-closed" ${el.closed ? "checked" : ""}> Close the loop (connect the ends)</label>`;
  if (K.s !== "beam" && !K.nob) h += mkRange("mk-size", "Bulb size", el.size || 1, 0.5, 3, 0.1, "×");
  h += mkRange("mk-glow", "Brightness", el.glow ?? 1, 0.2, 2.5, 0.1, "×");
  h += `<div class="bar mk-acts"><button type="button" class="btn small" data-mk="dup">Duplicate</button><button type="button" class="btn small" data-mk="front">Bring to front</button><button type="button" class="btn small danger" data-mk="del">Delete</button></div>`;
  return h;
}
function mkSceneUI() {
  const F = mkFootage(), est = !MK.scaled;
  return `<div class="mk-f">${mkRange("mk-night", "Nighttime", Math.round(MK.night * 100), 0, 100, 1, "%")}${mkRange("mk-gl", "Glow (all lights)", MK.glow, 0.3, 2.5, 0.1, "×")}</div>
    <div class="mk-f"><span class="mk-lbl">Measurements</span>${MK.scaled ? `<p class="mk-note">Scale set: ${(MK.pxft).toFixed(1)} px per ft.</p>` : `<p class="mk-note">Draw a line on something you know (a garage door is 16 ft, a single door 3 ft) to get real spacing and footage.</p>`}<button type="button" class="btn small" data-mk="scale">${MK.scaled ? "Reset scale" : "Set scale"}</button></div>
    ${F.length ? `<div class="mk-f"><span class="mk-lbl">What's on it${est ? " (rough until you set scale)" : ""}</span><table class="mk-tab">${F.map((r) => `<tr><td>${esc(r.name)}${r.n > 1 ? ` <small>×${r.n}</small>` : ""}</td><td class="mono">${est ? "≈" : ""}${r.u === "light" ? r.n : Math.round(r.q)} ${r.u === "light" ? (r.n > 1 ? "lights" : "light") : r.u}</td></tr>`).join("")}</table>${mkRoofFt() ? `<p class="mk-note"><b>${est ? "≈" : ""}${mkRoofFt()} ft</b> of roofline C9 runs.</p>` : ""}</div>` : ""}`;
}
function mkPanel() {
  if (MK.confirmClose) return `<div class="mk-head"><b>Close without saving?</b></div><p class="mk-note">Your mockup hasn't been saved.</p><div class="bar"><button type="button" class="btn" data-mk="close-no">Keep working</button><button type="button" class="btn danger" data-mk="close-yes">Close it</button></div>`;
  if (!MK.img) return "";
  if (MK.panel === "save") return mkSaveUI();
  if (MK.scaleMode) return `<div class="mk-head"><b>Set scale</b><button type="button" class="btn small" data-mk="scale-x">Cancel</button></div>${MK.scaleLine && MK.scaleLine.length === 2 ? `<label class="mk-f"><span class="mk-lbl">How long is that line?</span><div class="bar"><input id="mk-ft" type="number" inputmode="decimal" min="0.5" step="0.5" placeholder="16" style="max-width:110px"> <span>ft</span><button type="button" class="btn small amber" data-mk="scale-ok">Use it</button></div></label>` : `<p class="mk-note">Tap one end of something you know the size of (like a garage door), then the other end.</p>`}`;
  if (MK.adding) { const K = mkKind(MK.adding.k), two = ["wrap", "cone", "circle", "beam"].includes(K.s);
    const tip = { wrap: "Press at the top and drag down to the bottom.", cone: "Press at the tip and drag down to the base.", circle: "Press in the middle and drag out to the edge.", beam: "Press where the light sits and drag toward what it lights up.", area: "Tap around the outside of it. Double-tap or hit Done to finish.", line: "Tap along where the lights go. Drag a dot to fix it. Double-tap or hit Done." }[K.s];
    return `<div class="mk-head"><b>${K.i} ${esc(K.n)}</b></div><p class="mk-note">${tip}</p><div class="bar">${two ? "" : `<button type="button" class="btn amber" data-mk="finish">Done</button><button type="button" class="btn small" data-mk="undo-pt">Undo point</button>`}<button type="button" class="btn small" data-mk="cancel-add">Cancel</button></div>${two ? "" : mkColorsUI(MK.adding)}`; }
  const el = mkSel(); if (el) return mkEditUI(el);
  const groups = [...new Set(MK_KINDS.map((x) => x.g))];
  return `${groups.map((g) => `<div class="mk-f"><span class="mk-lbl">${esc(g)}</span><div class="mk-kinds">${MK_KINDS.filter((x) => x.g === g).map((x) => `<button type="button" class="mk-kind" data-mk="add" data-v="${x.k}"><i>${x.i}</i>${esc(x.n)}</button>`).join("")}</div></div>`).join("")}
    ${MK.els.length ? `<div class="mk-f"><span class="mk-lbl">On this mockup · tap to edit</span><div class="mk-list">${MK.els.map((e) => `<button type="button" class="mk-li" data-mk="pick" data-v="${esc(e.id)}"><i>${(e.colors || []).slice(0, 5).map((c) => `<b style="background:${mkHex(c)}"></b>`).join("")}</i>${esc(e.label || mkKind(e.k).n)}</button>`).join("")}</div></div>` : ""}
    ${mkAIUI()}${mkSceneUI()}`;
}
function mkAIUI() {
  if (!MK.els.length) return "";
  const a = MK.ai;
  if (a && a.busy) return `<div class="mk-f mk-ai"><span class="mk-lbl">Make it look real</span><p class="mk-note">Working on it… this takes about 15–30 seconds.</p></div>`;
  if (a && a.im && !a.stale) return `<div class="mk-f mk-ai"><span class="mk-lbl">AI version</span><div class="seg mk-seg"><button type="button" data-mk="ai-show" data-v="0" aria-pressed="${!MK.showAI}">Drawn</button><button type="button" data-mk="ai-show" data-v="1" aria-pressed="${!!MK.showAI}">AI</button></div>
    <label class="mk-chk" style="margin-top:8px"><input type="checkbox" id="mk-useai" ${MK.useAI ? "checked" : ""}> Save and send the AI version</label>
    <p class="mk-note">AI can get details wrong. Check that the lights match what you'll actually install before you send it.</p><button type="button" class="btn small" data-mk="ai">Try again</button></div>`;
  return `<div class="mk-f mk-ai"><span class="mk-lbl">Make it look real</span><p class="mk-note">${a && a.stale ? "You changed the drawing. Run it again to update the AI version." : "Turns your drawing into a realistic night photo with AI. Lights stay where you drew them."}</p><button type="button" class="btn amber" data-mk="ai">✨ Make it look real</button></div>`;
}
async function mkAI() {
  MK.ai = { busy: true }; mkRender();
  try {
    const sc = Math.min(1, 1536 / Math.max(MK.W, MK.H)), w = Math.round(MK.W * sc), h = Math.round(MK.H * sc);
    const enc = async (draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")); const b = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86)); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); }); };
    const full = document.createElement("canvas"); full.width = MK.W; full.height = MK.H; mkScene(full.getContext("2d"), { hi: true });
    const photo = await enc((x) => x.drawImage(MK.img, 0, 0, w, h)), mock = await enc((x) => x.drawImage(full, 0, 0, w, h));
    const r = await fetch("/api/mockup-ai", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await PL.authToken()) }, body: JSON.stringify({ photo, mockup: mock }) });
    const j = await r.json().catch(() => ({ error: "No answer from the server." }));
    if (!r.ok) throw new Error(j.error || "The AI step failed.");
    const url = "data:" + (j.mime || "image/png") + ";base64," + j.image, im = new Image(); im.src = url; await im.decode();
    const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0);
    { const fs = Math.max(14, im.width / 70); cx.font = `700 ${fs}px system-ui,sans-serif`; cx.textAlign = "right"; cx.fillStyle = "rgba(255,255,255,.75)"; cx.fillText("ProLight Tallahassee · sample mockup", im.width - fs, im.height - fs); }
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9));
    MK.ai = { im, blob }; MK.showAI = true; MK.useAI = true; MK.dirty = true; try { track && track("mockup-ai", { ok: true }); } catch (e) {}
  } catch (e) { MK.ai = null; toast(String(e.message || e)); }
  mkRender();
}
function mkSaveUI() {
  const jobs = jobsArr().slice().sort((a, b) => String(clientOf(a).name).localeCompare(String(clientOf(b).name)));
  const ft = mkRoofFt(), j = MK.jobId && S.jobs.get(MK.jobId);
  return `<div class="mk-head"><b>Save mockup</b><button type="button" class="btn small" data-mk="back">Back</button></div>
    <label class="mk-f"><span class="mk-lbl">Save it to this job</span><select id="mk-job"><option value="">Don't save to a job</option>${jobs.map((x) => `<option value="${esc(x.id)}" ${x.id === MK.jobId ? "selected" : ""}>${esc(clientOf(x).name || "No name")}${x.stage === "quoted" ? " · quote" : x.stage === "lead" ? " · lead" : ""}</option>`).join("")}</select></label>
    ${MK.scaled && ft ? `<label class="mk-chk"><input type="checkbox" id="mk-setft" ${j && !j.rooflineFt ? "checked" : ""}> Put ${ft} ft roofline on the job</label>` : ""}
    <div class="bar mk-acts"><button type="button" class="btn amber" data-mk="save-go" ${MK.saving ? "disabled" : ""}>${MK.saving ? "Saving…" : "Save"}</button><button type="button" class="btn" data-mk="share">Send to customer</button><button type="button" class="btn small" data-mk="download">Download</button></div>
    <p class="mk-note">Saved mockups show on the job for the crew, and you can open them again to make changes.</p>${mkAIUI()}`;
}
function mkRender() {
  const root = $("#mockRoot"); if (!root || !MK.open) return;
  const j = MK.jobId && S.jobs.get(MK.jobId), who = j ? clientOf(j).name : "";
  const focus = document.activeElement && document.activeElement.id, scroll = root.querySelector(".mk-panel") ? root.querySelector(".mk-panel").scrollTop : 0;
  if (!MK.img) {
    MK.cv = null;
    const pics = j ? [...(j.mockups || []).filter((m) => m.type === "image" && !m.studio), ...jobsLog(j.id).flatMap((l) => (l.media || []).filter((m) => m.type === "image"))].slice(0, 12) : [];
    root.innerHTML = `<div class="mk-top"><button type="button" class="btn small" data-mk="close">✕ Close</button><b class="grow">Light mockup${who ? " · " + esc(who) : ""}</b></div>
      <div class="mk-start"><div class="mk-start-in"><h2>Start with a photo of the house</h2><p class="lede">Stand at the street and get the whole front in. Daytime photos work best. The app turns it to night for you.</p>
      <div class="bar"><label class="btn amber file-btn">📷 Take photo<input type="file" id="mk-cam" accept="image/*" capture="environment"></label><label class="btn file-btn">Choose photo<input type="file" id="mk-file" accept="image/*"></label></div>
      ${pics.length ? `<span class="mk-lbl">Or use a photo from this job</span><div class="mk-pics">${pics.map((m) => `<button type="button" data-mk="usepic" data-v="${esc(m.id)}"><img src="${esc(mediaUrl(m.id))}" alt="" loading="lazy" crossorigin="anonymous"></button>`).join("")}</div>` : ""}</div></div>`;
    return;
  }
  if (!root.querySelector("#mk-cv")) {
    root.innerHTML = `<div class="mk-top"></div><div class="mk-body"><div class="mk-stage"><canvas id="mk-cv"></canvas><div class="mk-zoom"><button type="button" data-mk="zin" aria-label="Zoom in">+</button><button type="button" data-mk="zout" aria-label="Zoom out">−</button><button type="button" data-mk="zfit" aria-label="Fit">⤢</button></div></div>
    <aside class="mk-panel"></aside></div><input type="file" id="mk-file2" accept="image/*" hidden>`;
    MK.cv = $("#mk-cv"); mkPointer(MK.cv);
  }
  root.querySelector(".mk-top").innerHTML = `<button type="button" class="btn small" data-mk="close" aria-label="Close">✕</button><b class="grow mk-title">Light mockup${who ? " · " + esc(who) : ""}</b>
      <button type="button" class="btn small" data-mk="undo" ${MK.undo.length || MK.adding ? "" : "disabled"} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button><button type="button" class="btn small" data-mk="redo" ${MK.redo.length ? "" : "disabled"} title="Redo" aria-label="Redo">↷</button>
      <button type="button" class="btn small" data-mk="before" aria-pressed="${MK.before}" title="See the house without lights">Before</button>
      <button type="button" class="btn small mk-hide-sm" data-mk="photo" title="Use a different photo">Photo</button>
      <button type="button" class="btn small amber" data-mk="save" ${MK.els.length ? "" : "disabled"}>Save</button>`;
  const p = root.querySelector(".mk-panel"); p.innerHTML = mkPanel(); p.scrollTop = scroll;
  if (focus && /^mk-/.test(focus)) { const f = document.getElementById(focus); if (f && !/range|checkbox|file/.test(f.type)) f.focus(); }
  mkDraw();
}
function jobsLog(jobId) { try { return (S.log ? [...S.log.values()] : []).filter((l) => l.jobId === jobId); } catch (e) { return []; } }

/* ---------- save / share ---------- */
async function mkBlob() {
  const c = document.createElement("canvas"); c.width = MK.W; c.height = MK.H; const ctx = c.getContext("2d"); mkScene(ctx, { hi: true });
  // small credit mark, bottom right
  const s = Math.max(14, MK.W / 70); ctx.font = `700 ${s}px system-ui,sans-serif`; ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillText("ProLight Tallahassee · sample mockup", MK.W - s, MK.H - s);
  return await new Promise((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error("encode")), "image/jpeg", 0.9));
}
async function mkSave() {
  const jid = ($("#mk-job") || {}).value || ""; if (!jid) { toast("Pick a job, or use Send / Download."); return; }
  const j = S.jobs.get(jid); if (!j) return; MK.saving = true; mkRender();
  try {
    if (!MK.photoId) { const pc = document.createElement("canvas"); pc.width = MK.W; pc.height = MK.H; pc.getContext("2d").drawImage(MK.img, 0, 0); const pb = await new Promise((r) => pc.toBlob(r, "image/jpeg", 0.88)); MK.photoId = (await S.assets.upload(pb, { type: "image/jpeg" })).id; }
    const useAI = MK.useAI && MK.ai && MK.ai.blob && !MK.ai.stale;
    const out = await S.assets.upload(useAI ? MK.ai.blob : await mkBlob(), { type: "image/jpeg" });
    const studio = { ai: !!useAI, photo: MK.photoId, els: MK.els, night: MK.night, glow: MK.glow, pxft: MK.pxft, scaled: MK.scaled, by: S.me.id, at: new Date().toISOString() };
    const item = { id: out.id, type: "image", name: useAI ? "Light mockup (AI)" : "Light mockup", studio };
    let list = [...(j.mockups || [])], old = "";
    if (MK.editId && jid === MK.jobId) { const i = list.findIndex((m) => m.id === MK.editId); if (i >= 0) { old = list[i].id; list[i] = item; } else list.push(item); } else list.push(item);
    const patch = { mockups: list, updatedAt: new Date().toISOString() }; if (($("#mk-setft") || {}).checked) patch.rooflineFt = String(mkRoofFt());
    await S.db.doc("jobs/" + jid).update(patch);
    if (old && S.assets) { try { await S.assets.delete(old); } catch (e) {} }
    try { track && track("mockup", { job: jid, pieces: MK.els.length }); } catch (e) {}
    MK.jobId = jid; MK.editId = out.id; MK.dirty = false; MK.saving = false; MK.panel = "add"; toast("Mockup saved to " + (clientOf(j).name || "the job")); mkRender();
  } catch (e) { MK.saving = false; mkRender(); e && e.code ? upFail(e) : fail(e, "save the mockup"); }
}
async function mkShare(download) {
  try {
    const useAI = MK.useAI && MK.ai && MK.ai.blob && !MK.ai.stale, b = useAI ? MK.ai.blob : await mkBlob(), j = MK.jobId && S.jobs.get(MK.jobId), nm = ((j && clientOf(j).name) || "house").replace(/[^\w]+/g, "-") + "-lights.jpg", f = new File([b], nm, { type: "image/jpeg" });
    if (!download && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: "Your Christmas lights", text: "Here's a mockup of your house with lights from ProLight Tallahassee." }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nm; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    if (!download) toast("Saved the picture. Text it to the customer from your photos.");
  } catch (e) { fail(e, "make the picture"); }
}

/* ---------- events ---------- */
function mkBind(root) {
  root.addEventListener("click", async (ev) => {
    ev.stopPropagation(); const t = ev.target.closest("[data-mk]"); if (!t || t.disabled) return; const a = t.dataset.mk, v = t.dataset.v, el = mkSel();
    const edit = (fn) => { if (!el) return; mkSnap(); fn(el); mkRender(); };
    switch (a) {
      case "close": closeMockup(); break; case "close-no": MK.confirmClose = false; mkRender(); break; case "close-yes": closeMockup(true); break;
      case "photo": $("#mk-file2").click(); break;
      case "usepic": try { await mkLoadSrc(mediaUrl(v)); MK.photoId = v; MK.dirty = true; mkRender(); } catch (e) { toast("Couldn't open that photo."); } break;
      case "add": mkStartAdd(v); break; case "finish": mkFinish(); break; case "cancel-add": MK.adding = null; MK.panel = "add"; mkRender(); break;
      case "undo-pt": if (MK.adding) { MK.adding.pts.pop(); mkRender(); } break;
      case "undo": mkUndo(); break; case "redo": mkRedo(); break;
      case "before": MK.before = !MK.before; mkRender(); break;
      case "pick": MK.sel = v; MK.panel = "edit"; mkRender(); break; case "desel": MK.sel = ""; MK.panel = "add"; mkRender(); break;
      case "bulb": edit((e) => { e.b = v; }); break; case "fill": edit((e) => { e.fill = v; }); break;
      case "set": { const c = v.split(","); MK.lastColors = c; if (MK.adding) { MK.adding.colors = c; mkRender(); } else edit((e) => { e.colors = c; }); break; }
      case "col-add": { const tgt = MK.adding || el; if (!tgt) break; if (!MK.adding) mkSnap(); tgt.colors = [...(tgt.colors || []), v]; MK.lastColors = tgt.colors; mkRender(); break; }
      case "col-rm": { const tgt = MK.adding || el; if (!tgt || (tgt.colors || []).length < 2) break; if (!MK.adding) mkSnap(); tgt.colors = tgt.colors.filter((_, i) => i !== +v); MK.lastColors = tgt.colors; mkRender(); break; }
      case "dup": if (el) { mkSnap(); const c = JSON.parse(JSON.stringify(el)); c.id = uid(); c.pts = c.pts.map(([x, y]) => [x + MK.pxft * 2, y]); MK.els.push(c); MK.sel = c.id; mkRender(); } break;
      case "front": edit((e) => { MK.els = [...MK.els.filter((x) => x !== e), e]; }); break;
      case "del": if (el) { mkSnap(); MK.els = MK.els.filter((x) => x !== el); MK.sel = ""; MK.panel = "add"; mkRender(); } break;
      case "zin": MK.z = Math.min(8, MK.z * 1.4); mkDraw(); break; case "zout": MK.z = Math.max(0.5, MK.z / 1.4); mkDraw(); break; case "zfit": MK.z = 1; MK.px = MK.py = 0; mkDraw(); break;
      case "scale": MK.scaleMode = true; MK.scaleLine = null; MK.sel = ""; mkRender(); break;
      case "scale-x": MK.scaleMode = false; MK.scaleLine = null; mkRender(); break;
      case "scale-ok": { const f = parseFloat(($("#mk-ft") || {}).value); if (!(f > 0)) { toast("Type how many feet long it is."); break; } const L = mkDist(MK.scaleLine[0], MK.scaleLine[1]); if (L < 10) { toast("Draw a longer line."); break; } MK.pxft = L / f; MK.scaled = true; MK.scaleMode = false; MK.scaleLine = null; MK.dirty = true; mkRender(); toast("Scale set"); break; }
      case "save": MK.panel = "save"; MK.sel = ""; MK.adding = null; mkRender(); break; case "back": MK.panel = "add"; mkRender(); break;
      case "save-go": await mkSave(); break;
      case "ai": await mkAI(); break; case "ai-show": MK.showAI = v === "1"; mkRender(); break; case "share": await mkShare(false); break; case "download": await mkShare(true); break;
    }
  });
  const num = (id, fn) => { const x = document.getElementById(id); if (!x) return; const o = document.getElementById(id + "-v"); if (o) o.textContent = x.value + (o.textContent.replace(/^[\d.\-]+/, "")); fn(parseFloat(x.value)); };
  root.addEventListener("input", (ev) => {
    ev.stopPropagation(); const t = ev.target, el = mkSel(), id = t.id;
    if (id === "mk-night") return num(id, (v) => { MK.night = v / 100; MK.dirty = true; mkDraw(); });
    if (id === "mk-gl") return num(id, (v) => { MK.glow = v; MK.dirty = true; mkDraw(); });
    if (!el) return;
    const map = { "mk-sp": "sp", "mk-gap": "gap", "mk-size": "size", "mk-glow": "glow", "mk-drop": "drop", "mk-spread": "spread", "mk-str": "strands" };
    if (map[id]) return num(id, (v) => { mkSnapOnce(id + el.id); el[map[id]] = v; mkDraw(); });
    if (id === "mk-w") return num(id, (v) => { mkSnapOnce(id + el.id); el.w = mkKind(el.k).s === "cone" ? v / 100 : v; mkDraw(); });
    if (id === "mk-taper") return num(id, (v) => { mkSnapOnce(id + el.id); el.taper = v / 100; mkDraw(); });
    if (id === "mk-label") { mkSnapOnce(id + el.id); el.label = t.value.slice(0, 40); }
  });
  root.addEventListener("change", async (ev) => {
    ev.stopPropagation(); const t = ev.target, el = mkSel();
    if (t.id === "mk-cam" || t.id === "mk-file" || t.id === "mk-file2") { await mkPickFile(t.files && t.files[0]); t.value = ""; return; }
    if (t.id === "mk-useai") { MK.useAI = t.checked; return; }
    if (t.id === "mk-cc") { const tgt = MK.adding || el; if (!tgt) return; if (!MK.adding) mkSnap(); tgt.colors = [...(tgt.colors || []), t.value]; mkRender(); return; }
    if (!el) return;
    if (t.id === "mk-mix") { mkSnap(); el.mix = t.checked; mkDraw(); }
    if (t.id === "mk-bow") { mkSnap(); el.bow = t.checked; mkDraw(); }
    if (t.id === "mk-closed") { mkSnap(); el.closed = t.checked; mkDraw(); }
    if (t.id === "mk-kind") { mkSnap(); const K = mkKind(t.value); el.k = t.value; if (K.b) el.b = K.b; if (K.sp) el.sp = K.sp; mkRender(); }
    if (t.id === "mk-label") mkRender();
  });
}
window.addEventListener("keydown", (ev) => {
  if (!MK.open) return; const t = ev.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== "range" && t.type !== "checkbox";
  ev.stopPropagation();
  if (ev.key === "Escape") { ev.preventDefault(); if (MK.adding) { MK.adding = null; MK.panel = "add"; mkRender(); } else if (MK.scaleMode) { MK.scaleMode = false; mkRender(); } else if (MK.sel) { MK.sel = ""; MK.panel = "add"; mkRender(); } else closeMockup(); return; }
  if (typing) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? mkRedo() : mkUndo(); return; }
  if (ev.key === "Enter" && MK.adding) { ev.preventDefault(); mkFinish(); return; }
  if ((ev.key === "Delete" || ev.key === "Backspace") && mkSel()) { ev.preventDefault(); mkSnap(); MK.els = MK.els.filter((x) => x.id !== MK.sel); MK.sel = ""; MK.panel = "add"; mkRender(); }
}, true);
window.addEventListener("resize", () => { if (MK.open) mkDraw(); });
