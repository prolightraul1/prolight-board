// Once a minute (called by Supabase pg_cron): daily team call reminder + start, and missed-call notices.
const { sb, firstTime, pushTo, staffAll, crewsAll, lang } = require("./_lib/notify");
const CALL_MSG = "📹 Video call", ROOM = "meet:prolight";

function nyNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
const hhmm = (m) => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "AM" : "PM"}`; };

async function joinedSince(channel, sinceISO) {
  const rows = await sb(`/rest/v1/push_log?key=like.${encodeURIComponent("join:" + channel + ":")}*&at=gte.${encodeURIComponent(sinceISO)}&select=key`);
  return new Set(rows.map((r) => r.key.split(":").slice(-2, -1)[0]));
}

async function docsOf(coll, extra = "") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await sb(`/rest/v1/docs?coll=eq.${coll}${extra}&select=id,data`, { headers: { Range: `${from}-${from + 999}` } });
    out.push(...page); if (page.length < 1000) return out;
  }
}
async function notDonePush(staff, crews, date) {
  const [jobs, clients, done] = await Promise.all([docsOf("jobs"), docsOf("clients"), docsOf("log", "&data->>kind=eq.done")]);
  const ok = new Set(done.map((d) => d.data.jobId + "|" + d.data.visitId));
  const nc = (c) => (c === "prolight" ? "pl1" : c || ""), cname = (c) => (crews.find((x) => x.id === c) || {}).name || "No crew";
  const left = [];
  for (const j of jobs) {
    if (j.data.stage === "cancelled") continue;
    for (const v of j.data.visits || []) if (v.date === date && !ok.has(j.id + "|" + v.id)) left.push({ crew: cname(nc(v.crew || j.data.crew)), client: ((clients.find((c) => c.id === j.data.clientId) || {}).data || {}).name || "a job" });
  }
  const me = staff.filter((p) => p.active && /^raul\b/i.test(String(p.name || "").trim()));
  const byCrew = {}; for (const l of left) (byCrew[l.crew] = byCrew[l.crew] || []).push(l.client);
  const list = Object.entries(byCrew).map(([c, a]) => `${c}: ${a.join(", ")}`).join(" · ");
  const clip = (t) => (t.length > 170 ? t.slice(0, 167) + "…" : t);
  return pushTo(me, "notdone", (p) => !left.length
    ? (lang(p) === "es" ? { title: "Todo listo hoy ✓", body: "Todas las paradas de hoy están marcadas como hechas.", url: "/?go=notdone", tag: "notdone" } : { title: "All done today ✓", body: "Every stop on today's schedule is checked off.", url: "/?go=notdone", tag: "notdone" })
    : (lang(p) === "es" ? { title: `${left.length} sin marcar hoy`, body: clip(list), url: "/?go=notdone", tag: "notdone" } : { title: `${left.length} stop${left.length === 1 ? "" : "s"} not marked done today`, body: clip(list), url: "/?go=notdone", tag: "notdone" }));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ skipped: "not set up" });
  const out = { did: [] };
  try {
    const [staff, crews, board] = await Promise.all([staffAll(), crewsAll(), sb("/rest/v1/docs?coll=eq.settings&id=eq.board&select=data")]);
    const cfg = { on: true, time: "08:00", days: [1, 2, 3, 4, 5], ...((((board[0] || {}).data || {}).meeting) || {}) };
    const ss = crews.filter((c) => c.co === "shipshape").map((c) => c.id);
    const team = staff.filter((p) => p.active && (p.can_manage || p.can_edit || !(p.partner === "shipshape" || ss.includes(p.crew))));
    const now = nyNow(), [H, M] = String(cfg.time).split(":").map(Number), T = H * 60 + M;

    if (cfg.on && cfg.days.includes(now.dow) && isFinite(T)) {
      // reminder 10 minutes before
      if (now.min >= T - 10 && now.min < T && (await firstTime("meet-remind:" + now.date))) {
        out.did.push("remind:" + await pushTo(team, "meeting", (p) => lang(p) === "es"
          ? { title: "Llamada del equipo en 10 minutos", body: `La llamada diaria empieza a las ${hhmm(T)}.`, url: "/?go=" + encodeURIComponent("chat:" + ROOM), tag: "meet-remind" }
          : { title: "Team call in 10 minutes", body: `The daily team call starts at ${hhmm(T)}.`, url: "/?go=" + encodeURIComponent("chat:" + ROOM), tag: "meet-remind" }));
      }
      // start: posting the call message rings everyone (see /api/notify)
      if (now.min >= T && now.min < T + 10 && (await firstTime("meet-start:" + now.date))) {
        const host = staff.find((p) => p.can_manage && p.active) || team[0];
        if (host) { await sb("/rest/v1/messages", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ channel: ROOM, body: CALL_MSG, by: host.id }) }); out.did.push("start"); }
      }
      // missed: 15-30 minutes after start, for people who never joined
      if (now.min >= T + 15 && now.min < T + 30 && (await firstTime("meet-missed:" + now.date))) {
        const start = (await sb(`/rest/v1/messages?channel=eq.${encodeURIComponent(ROOM)}&body=eq.${encodeURIComponent(CALL_MSG)}&order=at.desc&limit=1&select=at`))[0];
        if (start) { const joined = await joinedSince(ROOM, start.at);
          out.did.push("missed:" + await pushTo(team.filter((p) => !joined.has(p.id)), "meeting", (p) => lang(p) === "es"
            ? { title: "Llamada perdida", body: "Te perdiste la llamada diaria del equipo.", url: "/?go=" + encodeURIComponent("chat:" + ROOM), tag: "meet-missed" }
            : { title: "Missed call", body: "You missed the daily team call.", url: "/?go=" + encodeURIComponent("chat:" + ROOM), tag: "meet-missed" })); }
      }
    }

    // missed one-on-one and crew calls: 2 to 15 minutes after the call started, nobody else joined
    const since = new Date(Date.now() - 15 * 60e3).toISOString(), until = new Date(Date.now() - 2 * 60e3).toISOString();
    const calls = await sb(`/rest/v1/messages?body=eq.${encodeURIComponent(CALL_MSG)}&at=gte.${encodeURIComponent(since)}&at=lte.${encodeURIComponent(until)}&select=id,channel,by,at`);
    for (const c of calls) {
      if (c.channel === ROOM || c.channel === "ann") continue;
      let who = [];
      if (c.channel.startsWith("dm:")) who = staff.filter((p) => p.id !== c.by && c.channel.slice(3).split(":").includes(p.id));
      else if (c.channel.startsWith("crew:")) { const cid = c.channel.slice(5); who = staff.filter((p) => p.id !== c.by && (p.crew === cid || (ss.includes(cid) && p.partner === "shipshape"))); }
      if (!who.length) continue;
      const joined = await joinedSince(c.channel, c.at), from = (staff.find((p) => p.id === c.by) || {}).name || "Someone";
      for (const p of who) {
        if (joined.has(p.id) || !(await firstTime(`missed:${c.id}:${p.id}`))) continue;
        await pushTo([p], "meeting", (x) => lang(x) === "es"
          ? { title: "Llamada perdida", body: `${from} te llamó.`, url: "/?go=" + encodeURIComponent("chat:" + c.channel), tag: "missed-" + c.id }
          : { title: "Missed call", body: `${from} called you.`, url: "/?go=" + encodeURIComponent("chat:" + c.channel), tag: "missed-" + c.id });
        out.did.push("missed-call");
      }
    }
    // Monday 7 AM: last week's payroll is ready (money managers)
    if (now.dow === 1 && now.min >= 7 * 60 && now.min < 7 * 60 + 15 && (await firstTime("payroll-ready:" + now.date))) {
      const money = await sb("/rest/v1/staff?can_money=eq.true&active=eq.true&select=id,name,active,notify,look").catch(() => []);
      out.did.push("payroll:" + await pushTo(money, "payroll", (p) => lang(p) === "es"
        ? { title: "Nómina lista", body: "La nómina de la semana pasada está lista en Oficina → Nómina.", url: "/?go=office:payroll-last", tag: "payroll" }
        : { title: "Payroll is ready", body: "Last week's payroll is ready. Tap to open it.", url: "/?go=office:payroll-last", tag: "payroll" }));
    }
    // 8 PM: today's stops nobody checked off (to Raul)
    if (now.min >= 20 * 60 && now.min < 20 * 60 + 15 && (await firstTime("notdone:" + now.date))) {
      try { out.did.push("notdone:" + await notDonePush(staff, crews, now.date)); } catch (e) { out.notdoneError = String(e.message || e).slice(0, 160); }
    }
    // TCL feed (once TCL gives us a read-only link): every 15 minutes
    if (process.env.TCL_FEED_URL && now.min % 15 === 0) {
      try { const t = await require("./tcl.js").pollFeed(); if (t && (t.changed || []).length) out.tcl = t.changed.length; } catch (e) { out.tclError = String(e.message || e).slice(0, 160); }
    }
    // board check-offs → Jobber (visit completed + notes, photos, videos)
    try { const jp = await require("./jobber.js").pushToJobber({ max: 3 }); if (jp && (jp.completed?.length || jp.notes || jp.errors?.length)) out.jobber = jp; } catch (e) { out.jobberError = String(e.message || e).slice(0, 160); }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ error: e.message, ...out });
  }
};
module.exports.config = { maxDuration: 60 };
