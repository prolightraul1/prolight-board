// Install export to ProWash HQ (spec from Brayden). One row = one installer's work on one job on one day.
// Sends changed rows every couple of minutes, re-sends the last 14 days every night at 9 PM Eastern.
// Needs INSTALL_INGEST_KEY in Vercel. Before going live it runs the spec's test (one real completed install, sent twice).
const { sb, pushTo } = require("./notify");
const URL_HQ = "https://prowash-hq.lovable.app/api/public/ingest/installs";
const STATE = { coll: "fin", id: "hq-export" };
const crypto = require("crypto");

const nyDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const nc = (c) => (c === "prolight" ? "pl1" : c || "");
const r2 = (n) => Math.round(n * 100) / 100;
async function docs(coll, extra = "") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`/rest/v1/docs?coll=eq.${coll}${extra}&select=id,data`, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...page); if (page.length < 1000) return out;
  }
}
const put = (data) => sb("/rest/v1/docs", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ ...STATE, data }]) });
async function getState() { const r = await sb(`/rest/v1/docs?coll=eq.fin&id=eq.hq-export&select=data`); return (r[0] && r[0].data) || { sent: {}, log: [] }; }

// Build every row for work dated in the last `days` days.
async function buildRows(days = 14) {
  const [jobs, clients, fins, logs, staff, board] = await Promise.all([docs("jobs"), docs("clients"), docs("fin"), docs("log", "&data->>kind=in.(done,partial,clock)"), sb("/rest/v1/staff?select=id,name,crew,active,partner"), sb("/rest/v1/docs?coll=eq.settings&id=eq.board&select=data")]);
  const crews = ((board[0] || {}).data || {}).crews || [];
  const fin = new Map(fins.map((f) => [f.id, f.data])), cl = new Map(clients.map((c) => [c.id, c.data])), person = new Map(staff.map((p) => [p.id, p]));
  const today = nyDay(new Date().toISOString()), from = nyDay(new Date(Date.now() - days * 864e5).toISOString());
  const done = new Map(), partial = new Map(), clocks = [];
  for (const { data: e } of logs) {
    const k = e.jobId + "|" + e.visitId;
    if (e.kind === "done") { if (!done.has(k) || e.at < done.get(k).at) done.set(k, e); }
    else if (e.kind === "partial") { if (!partial.has(k) || e.at > partial.get(k).at) partial.set(k, e); }
    else if (e.kind === "clock" && !e.general && e.jobId && e.in && e.by) clocks.push(e);
  }
  const rows = [];
  for (const { id: jid, data: j } of jobs) {
    if (j.stage === "cancelled") continue;
    const price = +((fin.get(jid) || {}).price) || 0, visits = j.visits || [];
    const base = visits.filter((v) => v.type === "install" && !v.returnOf);
    if (!base.length && !visits.some((v) => v.type === "service")) continue;
    const c = cl.get(j.clientId) || {}, client = c.name || "", address = c.address || j.address || "";
    // work days on the installs: each base install visit's share, split again over a return trip if it was only partly done
    const workDays = [];
    for (const v of base) {
      const share = price / base.length, chain = [v, ...visits.filter((x) => x.returnOf === v.id)];
      const worked = chain.map((x) => ({ x, d: done.get(jid + "|" + x.id), p: partial.get(jid + "|" + x.id) })).filter((w) => w.d || w.p);
      worked.forEach((w) => workDays.push({ v: w.x, share: share / worked.length, at: (w.d || w.p).at, finished: !!w.d, why: w.p && !w.d ? [w.p.reason, w.p.left].filter(Boolean).join(" · ") : "" }));
    }
    const allDone = base.length && base.every((v) => [v, ...visits.filter((x) => x.returnOf === v.id)].some((x) => done.has(jid + "|" + x.id)));
    const lastAt = workDays.filter((w) => w.finished).map((w) => w.at).sort().pop();
    for (const w of workDays) {
      const date = w.v.date && w.v.date <= nyDay(w.at) ? w.v.date : nyDay(w.at);
      if (date < from || date > today) continue;
      const status = allDone && w.finished && w.at === lastAt ? "completed" : "partial";
      pushRows(rows, { jid, j, v: w.v, date, amount: w.share, status, notes: w.why, client, address });
    }
    // callbacks: service trips on a job (bulb/colour change-outs are customer requests, not complaints)
    for (const v of visits.filter((x) => x.type === "service")) {
      const d = done.get(jid + "|" + v.id); if (!d) continue;
      if (/bulb|change.?out|colou?r change/i.test(((v.svc || {}).reason || "") + " " + (v.note || ""))) continue;
      const date = v.date && v.date <= nyDay(d.at) ? v.date : nyDay(d.at); if (date < from || date > today) continue;
      pushRows(rows, { jid, j, v, date, amount: 0, status: "callback", notes: [((v.svc || {}).reason || ""), ((v.svc || {}).details || v.note || "")].filter(Boolean).join(": ").slice(0, 300), client, address });
    }
  }
  return { rows, from };

  function pushRows(out, o) {
    const dayClocks = clocks.filter((e) => e.jobId === o.jid && nyDay(e.in) === o.date && (e.visitId === o.v.id || !e.visitId));
    let ids = [...new Set(dayClocks.map((e) => e.by))].filter((id) => person.has(id));
    if (!ids.length) { const cs = [nc(o.v.crew || o.j.crew), ...((o.v.crews || []).map(nc))].filter(Boolean); ids = staff.filter((p) => p.active && cs.includes(nc(p.crew))).map((p) => p.id); }
    if (!ids.length) {
      // a crew named after a person (e.g. "Raul") with nobody assigned to it → that person, so the name matches days they clock in
      const cs = [nc(o.v.crew || o.j.crew), ...((o.v.crews || []).map(nc))].filter(Boolean);
      for (const cid of cs) { const cn = String((crews.find((x) => x.id === cid) || {}).name || "").trim().toLowerCase(); const p = cn && staff.filter((x) => x.active && String(x.name || "").trim().toLowerCase().split(/\s+/)[0] === cn); if (p && p.length === 1) ids.push(p[0].id); }
    }
    const crewOnly = [nc(o.v.crew || o.j.crew), ...((o.v.crews || []).map(nc))].filter(Boolean).filter((cid) => !ids.some((id) => nc(person.get(id).crew) === cid || String((crews.find((x) => x.id === cid) || {}).name || "").trim().toLowerCase() === String(person.get(id).name || "").trim().toLowerCase().split(/\s+/)[0]));
    const names = [...ids.map((id) => String(person.get(id).name || "").trim()).filter(Boolean), ...(dayClocks.length ? [] : crewOnly.map((cid) => (crews.find((x) => x.id === cid) || {}).name).filter(Boolean))];
    if (!names.length) return;
    const each = r2(o.amount / names.length);
    names.forEach((name, i) => {
      const id = ids[i], hrs = id ? dayClocks.filter((e) => e.by === id).reduce((t, e) => t + Math.max(0, (new Date(e.out || e.in) - new Date(e.in)) / 36e5), 0) : 0;
      out.push({
        install_id: `${o.jid}-${o.date}-${name}`, date: o.date, installer: name,
        ...(o.j.jobberNo ? { jobber_job_number: String(o.j.jobberNo) } : {}),
        client: o.client, address: o.address,
        amount: i === names.length - 1 ? r2(o.amount - each * (names.length - 1)) : each,
        ...(hrs ? { hours: Math.round(hrs * 100) / 100 } : {}),
        status: o.status, notes: o.notes || "",
      });
    });
  }
}
const hash = (r) => crypto.createHash("sha1").update(JSON.stringify([r.date, r.installer, r.amount, r.status, r.hours || 0, r.jobber_job_number || "", r.notes, r.client, r.address])).digest("hex").slice(0, 12);

async function send(rows) {
  const r = await fetch(URL_HQ, { method: "POST", headers: { "Content-Type": "application/json", "x-prowash-key": process.env.INSTALL_INGEST_KEY }, body: JSON.stringify({ source: "raul_install_app", exported_at: new Date().toISOString(), rows }) });
  let body = {}; try { body = await r.json(); } catch (e) {}
  return { status: r.status, body };
}
async function alert(title, body, who = /^(raul|brayden)\b/i) {
  const staff = await sb("/rest/v1/staff?active=eq.true&select=id,name,active,notify,look");
  return pushTo(staff.filter((p) => who.test(String(p.name || "").trim())), "hq", () => ({ title, body, url: "/?go=office:settings", tag: "hq" }));
}
const logLine = (st, e) => { st.log = [{ at: new Date().toISOString(), ...e }, ...(st.log || [])].slice(0, 40); };

// mode: "changes" (only new/changed/cancelled rows) or "full" (every row in the last 14 days)
async function run(mode = "changes", opts = {}) {
  if (!process.env.INSTALL_INGEST_KEY) return { skipped: "no key" };
  const st = await getState(); st.sent = st.sent || {};
  if (st.blocked && st.blockedKey === keyTag()) return { skipped: "key rejected" };
  if (st.wait && Date.now() < st.wait) return { skipped: "waiting to retry" };
  const { rows, from } = await buildRows(14);
  if (!st.live) return await selfTest(st, rows);
  const cur = new Set(rows.map((r) => r.install_id));
  const out = mode === "full" ? rows.slice() : rows.filter((r) => st.sent[r.install_id] !== hash(r));
  // anything we sent before that no longer exists (undone check-off, job cancelled, crew changed) → cancelled
  for (const [id, h] of Object.entries(st.sent)) {
    const date = (id.match(/-(\d{4}-\d{2}-\d{2})-/) || [])[1];
    if (!date || date < from || cur.has(id) || h === "x") continue;
    out.push({ install_id: id, date, installer: id.split("-" + date + "-")[1], amount: 0, status: "cancelled", notes: "Removed on the ProLight board" });
  }
  if (!out.length) { if (mode === "full") { logLine(st, { mode, sent: 0, note: "nothing to send" }); await put(st); } return { sent: 0 }; }
  let inserted = 0, updated = 0; const errors = [];
  for (let i = 0; i < out.length; i += 500) {
    const batch = out.slice(i, i + 500), res = await send(batch).catch((e) => ({ status: 0, body: { error: String(e.message || e) } }));
    if (res.status === 401) { st.blocked = true; st.blockedKey = keyTag(); logLine(st, { mode, sent: batch.length, status: 401, note: "HQ rejected the key" }); await put(st); await alert("HQ install export stopped", "ProWash HQ rejected the install key. Brayden needs to check INSTALL_INGEST_KEY.").catch(() => {}); return { error: 401 }; }
    if (res.status === 429 || res.status >= 500 || !res.status) {
      st.tries = (st.tries || 0) + 1; st.wait = Date.now() + (res.status === 429 ? 60e3 : [60e3, 5 * 60e3, 15 * 60e3][Math.min(st.tries - 1, 2)]);
      logLine(st, { mode, sent: batch.length, status: res.status, note: res.status === 429 ? "too many requests, retrying in 1 min" : "HQ didn't save the batch, will retry" }); await put(st); return { retry: res.status };
    }
    const bad = new Set((res.body.errors || []).map((e) => e.row));
    batch.forEach((r, k) => { if (!bad.has(k)) st.sent[r.install_id] = r.status === "cancelled" ? "x" : hash(r); else errors.push({ id: r.install_id.replace(/-.*/, ""), message: String((res.body.errors.find((e) => e.row === k) || {}).message || "").slice(0, 120) }); });
    inserted += +res.body.inserted || 0; updated += +res.body.updated || 0;
    if (i + 500 < out.length) await new Promise((ok) => setTimeout(ok, 3000));
  }
  st.tries = 0; st.wait = 0;
  // forget rows older than 30 days
  const cut = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  for (const id of Object.keys(st.sent)) { const d = (id.match(/-(\d{4}-\d{2}-\d{2})-/) || [])[1]; if (d && d < cut) delete st.sent[id]; }
  logLine(st, { mode, sent: out.length, inserted, updated, errors: errors.slice(0, 10) }); await put(st);
  return { sent: out.length, inserted, updated, errors: errors.length };
}
const keyTag = () => crypto.createHash("sha1").update(String(process.env.INSTALL_INGEST_KEY || "")).digest("hex").slice(0, 8);

// Spec test: one real completed install from today, sent twice; the second send must not insert again.
async function selfTest(st, rows) {
  const today = nyDay(new Date().toISOString());
  const one = rows.find((r) => r.status === "completed" && r.date === today && r.amount > 0);
  if (!one) return { skipped: "test waits for a completed install today" };
  const a = await send([one]), b = a.status === 200 ? await send([one]) : null;
  const ok = a.status === 200 && !(a.body.errors || []).length && (+a.body.inserted === 1 || +a.body.updated === 1) && b && b.status === 200 && +b.body.inserted === 0;
  logLine(st, { mode: "test", sent: 2, status: a.status, first: { inserted: a.body.inserted, updated: a.body.updated }, second: b && { inserted: b.body.inserted, updated: b.body.updated }, ok });
  if (a.status === 401) { st.blocked = true; st.blockedKey = keyTag(); }
  if (ok) { st.live = true; st.liveAt = new Date().toISOString(); st.sent[one.install_id] = hash(one); }
  await put(st);
  await alert(ok ? "HQ install export is live ✓" : "HQ install export test failed",
    ok ? "Test passed: one install sent twice, no double count. Tell Brayden to check the $ installed per installer per day card." : `HQ answered ${a.status}${a.status === 401 ? " (key rejected)" : ""}. Nothing else was sent.`, /^raul\b/i).catch(() => {});
  return { test: ok, status: a.status };
}

module.exports = { run, buildRows };
