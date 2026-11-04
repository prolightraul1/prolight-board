// TCL board extractor — paste into the console (or a JS runner) on https://tcl-reinstalls.vercel.app
// while signed in. READ ONLY: it only clicks the "All" filter and each job card (data-a="open"),
// which opens the read-only detail sheet. It never touches priority/stage/week/upload controls.
// Result goes to window.__tcl = { jobs, media, meta }. See scripts/TCL.md for the POST step.
// The key is NOT stored here; pass it in at run time.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (e) => (e ? e.innerText.replace(/\n?Open in Drive ↗/g, "").trim() : "");
  const none = (s) => !s || /^(Not added|None yet|Not written yet|Nothing listed yet|—)$/i.test(s.trim());
  const num = (s) => +String(s || "").replace(/[^0-9.]/g, "") || 0;
  const fmtWeek = (v) => { if (!v) return "Needs a date"; const [, m, d] = v.split("-"); return `Week of ${+m}/${+d}`; };
  const weekish = /^(Last week|This week|Next week|Week of .+|Needs a date)$/;

  // 1. list view, "All" filter
  const nav = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "All jobs");
  if (nav) { nav.click(); await sleep(600); }
  const allBtn = document.querySelector('button[data-a="filter"][data-v="all"]');
  if (allBtn && allBtn.getAttribute("aria-pressed") !== "true") { allBtn.click(); await sleep(600); }
  const cards = [...document.querySelectorAll('button[data-a="open"]')].map((b) => ({
    id: b.dataset.id, done: !!b.innerText.trim().startsWith("✓"),
    sub: [...b.querySelectorAll(".mid > span:not(.nm)")].map(txt).join(" · "),
  }));

  const jobs = [], media = [], titles = new Set(), labels = new Set(), problems = [];
  for (const c of cards) {
    const btn = document.querySelector(`button[data-a="open"][data-id="${CSS.escape(c.id)}"]`);
    const before = document.querySelector("#sheet .detail h1");
    const prevName = before ? before.innerText : null;
    btn.click();
    let d;
    for (let i = 0; i < 30; i++) { await sleep(120); d = document.querySelector("#sheet .detail"); const h = d && d.querySelector("h1"); if (h && (h.innerText !== prevName || i > 8)) break; }
    if (!d) { problems.push(c.id + ": no detail"); continue; }
    await sleep(80);
    const hero = d.querySelector(".card.hero");
    const name = txt(hero.querySelector("h1"));
    const pills = [...hero.querySelectorAll(".pills .pill")].map(txt);
    const secs = {};
    d.querySelectorAll(".card.sec").forEach((s) => { const h = s.querySelector("h3"); const t = h ? (h.childNodes[0]?.textContent || h.innerText).trim() : ""; titles.add(t); secs[t] = s; });
    const kv = {};
    d.querySelectorAll(".card.sec dl.kv > div").forEach((r) => { const k = txt(r.querySelector("dt")); labels.add(k); kv[k] = txt(r.querySelector("dd")); });
    const money = {};
    (secs.Money ? secs.Money.querySelectorAll(".moneyrow") : []).forEach((r) => { const [a, b] = r.querySelectorAll("span"); money[txt(a)] = txt(b); });

    const j = { name };
    if (!none(kv.Address)) j.addr = kv.Address;
    const cols = [...hero.querySelectorAll(".cols .col")].map(txt).filter((v) => v && !/^Color not set$/i.test(v));
    if (cols.length) j.color = cols.join(", ");
    j.price = num(txt(hero.querySelector(".amt")));
    const sel = hero.querySelector("#quickWeek"), day = hero.querySelector("#quickDay");
    const wk = sel ? fmtWeek(sel.value) : ""; // installed jobs have no week picker
    const subParts = c.sub.split(" · ").map((s) => s.trim()).filter(Boolean);
    const hint = subParts.filter((p, i) => !(i === 0 && weekish.test(p))).filter((p) => !/^\d+\/5$/.test(p)).join(" · ");
    j.when = hint || wk || (c.done ? "Installed" : "");
    j.whenFull = [wk, day && day.value ? "Day " + day.value : "", hint].filter(Boolean).join(" · ");
    const rd = secs["Ready to install"] || secs["Spec not complete"];
    if (rd) { const m = txt(rd).match(/(\d+\/\d+)/); if (m) j.ready = m[1]; }
    const pr = hero.querySelector('button[data-a="prio"][aria-pressed="true"]');
    if (pr) j.prio = pr.dataset.v;
    j.st = pills[0] || (c.done ? "Installed" : "");
    if (money.Deposit) j.dep = money.Deposit;
    if (money.Balance) j.bal = money.Balance;
    if (secs.Layout) { const p = txt(secs.Layout.querySelector(".prose")); if (!none(p)) j.layout = p; }
    if (secs["What goes where"]) {
      const lines = [...secs["What goes where"].querySelectorAll(".wi")].map((w) => [txt(w.querySelector(".wa")), txt(w.querySelector(".wd")), txt(w.querySelector(".wn"))].filter(Boolean).join(" — "));
      if (lines.length) j.where = lines.join("\n");
    }
    if (secs.Power) {
      const p = [...secs.Power.querySelectorAll("dl.kv > div")].map((r) => [txt(r.querySelector("dt")), txt(r.querySelector("dd"))]).filter(([, v]) => !none(v)).map(([k, v]) => `${k}: ${v}`);
      if (p.length) j.outlets = p.join(" · ");
    }
    const crew = [];
    for (const [k, v] of Object.entries(kv)) {
      if (none(v)) continue;
      if (/watch/i.test(k)) j.watch = v;
      else if (/^crew$/i.test(k)) crew.unshift(v);
      else if (/^(client wants|bin \/ tote|notes)$/i.test(k)) crew.push(`${k}: ${v}`);
      else if (/office/i.test(k)) j.office = v;
      else if (/last season|last year/i.test(k)) j.last = v;
    }
    if (crew.length) j.crew = crew.join("\n");
    jobs.push(j);

    // media: mockups + job photos, TCL storage or Drive only
    const urls = new Set();
    d.querySelectorAll("[data-u], img[src], video[src], video source[src], a[href]").forEach((e) => {
      const u = e.getAttribute("data-u") || e.getAttribute("src") || e.getAttribute("href") || "";
      if (/supabase\.co\/storage\/v1\/object\/sign\/job-media\//.test(u)) urls.add(u);
      else { const m = u.match(/drive\.google\.com\/thumbnail\?id=([\w-]{10,})/); if (m) urls.add("https://drive.google.com/thumbnail?id=" + m[1]); }
    });
    const seenKey = new Set();
    for (const u of urls) { const key = /drive\.google/.test(u) ? u : u.split("?")[0]; if (seenKey.has(key)) continue; seenKey.add(key); media.push({ name, url: u }); }
  }
  window.__tcl = { jobs, media, meta: { cards: cards.length, titles: [...titles], labels: [...labels], problems } };
  return { jobs: jobs.length, media: media.length, ...window.__tcl.meta };
})();
