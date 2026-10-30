// Push notifications.
//   GET  /api/notify?key=1          -> { key } public key phones use to sign up
//   POST /api/notify {t,id,...}     -> the database pings this when something happens; we re-read the record ourselves
const { sb, firstTime, pushTo, staffAll, crewsAll, lang } = require("./_lib/notify");

const first = (n) => String(n || "").split(" ")[0];
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const dayISO = (off) => { const d = new Date(Date.now() + off * 864e5); const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); return p; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({ skipped: "not set up" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = String(b.id || "");
    if (!id || !/^[\w:.-]{1,120}$/.test(id)) return res.status(400).json({ error: "bad id" });
    const staff = await staffAll(), crews = await crewsAll();
    const nameOf = (uid) => (staff.find((p) => p.id === uid) || {}).name || "Someone";
    const ssCrews = crews.filter((c) => c.co === "shipshape").map((c) => c.id);
    const crewPeople = (cid) => staff.filter((p) => (p.crew === cid || (cid === "pl1" && p.crew === "prolight")) || (ssCrews.includes(cid) && p.partner === "shipshape"));
    const crewName = (cid) => (crews.find((c) => c.id === cid) || {}).name || "your crew";
    const managers = staff.filter((p) => p.can_manage);
    let sent = 0;

    if (b.t === "msg") {
      const m = (await sb(`/rest/v1/messages?id=eq.${id}&select=id,channel,body,by,at`))[0];
      if (!m || !(await firstTime("msg:" + id))) return res.status(200).json({ sent: 0 });
      const call = m.body === "📹 Video call", from = nameOf(m.by);
      let who = [];
      if (m.channel === "ann") who = staff.filter((p) => p.id !== m.by);
      else if (m.channel.startsWith("crew:")) who = crewPeople(m.channel.slice(5)).filter((p) => p.id !== m.by);
      else if (m.channel.startsWith("dm:")) who = staff.filter((p) => p.id !== m.by && m.channel.slice(3).split(":").includes(p.id));
      const url = "/?go=" + encodeURIComponent(call ? "call:" + m.channel : "chat:" + m.channel);
      sent = await pushTo(who, call ? "meeting" : "chat", (p) => {
        const es = lang(p) === "es";
        if (call && m.channel === "ann") return { title: es ? "📹 Reunión en vivo" : "📹 Crew meeting is live", body: es ? `${from} empezó la reunión. Toca para unirte.` : `${from} started the meeting. Tap to join.`, url, tag: "meeting" };
        if (call) return { title: es ? "📹 Videollamada" : "📹 Video call", body: es ? `${from} te está llamando. Toca para unirte.` : `${from} is calling. Tap to join.`, url, tag: "call-" + m.channel };
        const title = m.channel === "ann" ? (es ? "Anuncio" : "Announcement") : m.channel.startsWith("crew:") ? crewName(m.channel.slice(5)) : from;
        return { title, body: (m.channel.startsWith("dm:") ? "" : first(from) + ": ") + clip(m.body, 160), url, tag: "chat-" + m.channel };
      });
    } else if (b.t === "log") {
      const d = (await sb(`/rest/v1/docs?coll=eq.log&id=eq.${encodeURIComponent(id)}&select=data`))[0];
      if (!d) return res.status(200).json({ sent: 0 });
      const e = d.data, job = e.jobId ? (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(e.jobId)}&select=data`))[0] : null;
      const client = job && job.data.clientId ? ((await sb(`/rest/v1/docs?coll=eq.clients&id=eq.${encodeURIComponent(job.data.clientId)}&select=data`))[0] || {}).data || {} : {};
      const cname = client.name || "a job", jurl = e.jobId ? "/?go=" + encodeURIComponent("job:" + e.jobId) : "/";
      if (e.kind === "timereq" && e.status === "pending") {
        if (await firstTime("treq:" + id)) sent = await pushTo(managers.filter((p) => p.id !== e.by), "time", (p) => lang(p) === "es"
          ? { title: "Corrección de tiempo", body: `${nameOf(e.by)} pidió una corrección: ${clip(e.summary, 120)}`, url: "/?go=office:payroll", tag: "treq" }
          : { title: "Time fix request", body: `${nameOf(e.by)} asked for a fix: ${clip(e.summary, 120)}`, url: "/?go=office:payroll", tag: "treq" });
      } else if (e.kind === "timereq" && (e.status === "approved" || e.status === "denied")) {
        if (await firstTime("treq:" + id + ":" + e.status) && e.decidedBy !== e.by) sent = await pushTo(staff.filter((p) => p.id === e.by), "time", (p) => {
          const es = lang(p) === "es", ok = e.status === "approved";
          return { title: ok ? (es ? "Corrección aprobada" : "Time fix approved") : (es ? "Corrección negada" : "Time fix denied"), body: clip(e.summary, 120) + (e.note ? " · " + clip(e.note, 80) : ""), url: "/?go=account", tag: "treq-" + id };
        });
      } else if (e.kind === "issue") {
        if (await firstTime("issue:" + id)) sent = await pushTo(managers.filter((p) => p.id !== e.by), "problems", (p) => lang(p) === "es"
          ? { title: `Problema en ${cname}`, body: `${nameOf(e.by)}: ${clip([e.reason, e.text].filter(Boolean).join(" · "), 140)}`, url: jurl, tag: "issue-" + id }
          : { title: `Problem at ${cname}`, body: `${nameOf(e.by)}: ${clip([e.reason, e.text].filter(Boolean).join(" · "), 140)}`, url: jurl, tag: "issue-" + id });
      } else if (e.kind === "partial") {
        if (await firstTime("partial:" + id)) sent = await pushTo(managers.filter((p) => p.id !== e.by), "problems", (p) => lang(p) === "es"
          ? { title: `${cname}: parcialmente listo`, body: `${nameOf(e.by)}: ${clip([e.reason, e.left].filter(Boolean).join(" · "), 140)}`, url: jurl, tag: "partial-" + id }
          : { title: `${cname}: partly done`, body: `${nameOf(e.by)}: ${clip([e.reason, e.left].filter(Boolean).join(" · "), 140)}`, url: jurl, tag: "partial-" + id });
      }
    } else if (b.t === "job") {
      const d = (await sb(`/rest/v1/docs?coll=eq.jobs&id=eq.${encodeURIComponent(id)}&select=data`))[0];
      if (!d) return res.status(200).json({ sent: 0 });
      const j = d.data, client = j.clientId ? ((await sb(`/rest/v1/docs?coll=eq.clients&id=eq.${encodeURIComponent(j.clientId)}&select=data`))[0] || {}).data || {} : {};
      const cname = client.name || "a customer", url = "/?go=" + encodeURIComponent("job:" + id);
      const crewOf = (v) => (v && v.crew) || j.crew || "";
      // newly given to a crew
      if (j.crew && j.crew !== b.oldCrew && (await firstTime(`assign:${id}:${j.crew}`)))
        sent += await pushTo(crewPeople(j.crew).filter((p) => !p.can_manage), "jobs", (p) => lang(p) === "es"
          ? { title: "Trabajo nuevo para tu equipo", body: cname, url, tag: "job-" + id }
          : { title: "New job for your crew", body: cname, url, tag: "job-" + id });
      // a stop added to today's or tomorrow's route
      const old = new Map(((Array.isArray(b.oldVisits) ? b.oldVisits : []) || []).map((v) => [v.id, v]));
      for (const v of j.visits || []) {
        const o = old.get(v.id), soon = [dayISO(0), dayISO(1)].includes(v.date), cid = crewOf(v);
        if (!soon || !cid || (o && o.date === v.date && crewOf(o) === cid)) continue;
        if (!(await firstTime(`route:${id}:${v.id}:${v.date}:${cid}`))) continue;
        const today = v.date === dayISO(0);
        sent += await pushTo(crewPeople(cid).filter((p) => !p.can_manage), "jobs", (p) => lang(p) === "es"
          ? { title: today ? "Cambio en la ruta de hoy" : "Cambio en la ruta de mañana", body: `${cname} se agregó a ${today ? "hoy" : "mañana"}`, url, tag: "route-" + v.date }
          : { title: today ? "Today's route changed" : "Tomorrow's route changed", body: `${cname} was added for ${today ? "today" : "tomorrow"}`, url, tag: "route-" + v.date });
      }
    }
    return res.status(200).json({ sent });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
};
