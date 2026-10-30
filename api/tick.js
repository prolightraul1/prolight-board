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
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({ error: e.message, ...out });
  }
};
