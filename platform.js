/* ProLight Season Board — sign-in and data layer (Supabase).
   Gives the board the same small API it used on claude.ai:
   claude.use("db" | "user" | "assets"). */
(function () {
  const cfg = window.PROLIGHT_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || /YOUR-/.test(cfg.supabaseUrl)) {
    document.addEventListener("DOMContentLoaded", () => showGate(`<h2>Almost there</h2><p>Add your Supabase project URL and anon key to <b>config.js</b>, then reload.</p>`));
    window.claude = { use: () => new Promise(() => {}) };
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "prolight-session" },
  });
  window.SB = sb;

  /* ---------- people ---------- */
  let ME = null;
  let STAFF = new Map();
  const PL = (window.PL = {
    me: () => ME,
    staff: () => [...STAFF.values()].sort((a, b) => a.name.localeCompare(b.name)),
    async reloadStaff() {
      const { data, error } = await sb.from("staff").select("*");
      if (error) throw error;
      STAFF = new Map(data.map((s) => [s.id, s]));
      const { data: u } = await sb.auth.getUser();
      ME = u && u.user ? STAFF.get(u.user.id) || null : null;
      window.dispatchEvent(new Event("prolight:staff"));
      return ME;
    },
    async add(p) {
      const { error } = await sb.rpc("staff_add", { p_name: p.name, p_pin: p.pin, p_crew: p.crew || "", p_edit: !!p.can_edit, p_money: !!p.can_money, p_manage: !!p.can_manage, p_log: !!p.can_log, p_all: !!p.all_crews, p_partner: p.partner || "" });
      if (error) throw new Error(error.message);
      await PL.reloadStaff();
    },
    async update(p) {
      const { error } = await sb.rpc("staff_update", { p_id: p.id, p_name: p.name, p_crew: p.crew || "", p_edit: !!p.can_edit, p_money: !!p.can_money, p_manage: !!p.can_manage, p_log: !!p.can_log, p_all: !!p.all_crews, p_active: !!p.active, p_partner: p.partner || "" });
      if (error) throw new Error(error.message);
      await PL.reloadStaff();
    },
    async remove(id) {
      const { error } = await sb.rpc("staff_delete", { p_id: id });
      if (error) throw new Error(error.message);
      await PL.reloadStaff();
    },
    async pinReport() {
      const { data, error } = await sb.rpc("pin_report");
      if (error) throw new Error(error.message);
      return data || [];
    },
    async setLook(colors) {
      const look = { ...((ME && ME.look) || {}), colors };
      const { error } = await sb.rpc("staff_set_look", { p_look: look });
      if (error) throw new Error(error.message);
      if (ME) ME.look = look;
    },
    async setLang(lang) {
      const look = { ...((ME && ME.look) || {}), lang };
      const { error } = await sb.rpc("staff_set_look", { p_look: look });
      if (error) throw new Error(error.message);
      if (ME) ME.look = look;
    },
    async setPin(id, pin) {
      const { error } = await sb.rpc("staff_set_pin", { p_id: id, p_pin: pin });
      if (error) throw new Error(error.message);
    },
    async statement() {
      const { data, error } = await sb.rpc("partner_statement");
      if (error) throw new Error(error.message);
      return data;
    },
    async chatLoad() {
      const since = new Date(Date.now() - 45 * 864e5).toISOString();
      const { data, error } = await sb.from("messages").select("*").gte("at", since).order("at", { ascending: true }).limit(2000);
      if (error) throw new Error(error.message);
      return data;
    },
    async chatSend(channel, body) {
      const { data, error } = await sb.from("messages").insert({ channel, body, by: ME.id }).select().single();
      if (error) throw new Error(error.message);
      window.dispatchEvent(new CustomEvent("prolight:msg", { detail: { eventType: "INSERT", new: data } }));
      return data;
    },
    async callTicket(channel) {
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/call?channel=" + encodeURIComponent(channel), { method: "POST", headers: { Authorization: "Bearer " + (data.session ? data.session.access_token : "") } });
      const j = await r.json().catch(() => ({ error: "No response" }));
      if (!r.ok) throw new Error(j.error || "Couldn't start the call");
      return j;
    },
    async chatDelete(id) {
      const { error } = await sb.from("messages").delete().eq("id", id);
      if (error) throw new Error(error.message);
      window.dispatchEvent(new CustomEvent("prolight:msg", { detail: { eventType: "DELETE", old: { id } } }));
    },
    async jobber(action) {
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/jobber?action=" + action, { method: action === "status" ? "GET" : "POST", headers: { Authorization: "Bearer " + (data.session ? data.session.access_token : "") } });
      const j = await r.json().catch(() => ({ error: "No response" }));
      if (!r.ok) throw new Error(j.error || "Request failed");
      return j;
    },
    async setTitle(id, title) {
      const { error } = await sb.rpc("staff_set_title", { p_id: id, p_title: title || "" });
      if (error) throw new Error(error.message);
      await PL.reloadStaff();
    },
    async setPhoto(id, blob) {
      const path = `staff/${id}-${Date.now()}.jpg`;
      const up = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const { error } = await sb.rpc("staff_set_photo", { p_id: id, p_photo: path });
      if (error) throw new Error(error.message);
      await PL.reloadStaff();
      return path;
    },
    outbox: () => outCount,
    flushOutbox: () => flush(),
    photoUrl: (p) => (p && p.photo ? sb.storage.from("media").getPublicUrl(p.photo).data.publicUrl : ""),
    squarePhoto,
    async logEvents(events) {
      if (!events || !events.length) return;
      const { error } = await sb.rpc("log_events", { p_events: events });
      if (error) throw new Error(error.message);
    },
    async auditList(o) {
      const { data, error } = await sb.rpc("audit_list", { p_before: o.before || null, p_filter: o.filter || "all", p_who: o.who || null, p_limit: o.limit || 150 });
      if (error) throw new Error(error.message);
      return data || [];
    },
    async auditHealth() {
      const { data, error } = await sb.rpc("audit_health");
      if (error) throw new Error(error.message);
      return data || {};
    },
    async signedInAt() {
      const { data } = await sb.auth.getSession();
      const u = data && data.session && data.session.user;
      return (u && u.last_sign_in_at) || null;
    },
    async requireNewPins() {
      const { data, error } = await sb.rpc("staff_require_new_pins");
      if (error) throw new Error(error.message);
      if (ME) ME.pin_ok = true;
      return data;
    },
    async signOut() {
      await sb.auth.signOut();
      try { localStorage.removeItem("prolight-last"); localStorage.removeItem("prolight-day"); if (ME) localStorage.removeItem(ckey(ME.id)); } catch (e) {}
      location.reload();
    },
    geocode: async (q) => {
      const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
      if (!r.ok) return null;
      return r.json();
    },
  });
  window.mediaUrl = (id) => pendingUrl.get(id) || sb.storage.from("media").getPublicUrl(id).data.publicUrl;

  /* ---------- documents ---------- */
  const COLLS = ["clients", "jobs", "log", "fin", "settings"];
  const cache = new Map(COLLS.map((c) => [c, new Map()]));
  const listeners = new Map();
  const docListeners = new Map();
  let loaded = false;
  const snap = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
  function emit(coll, id) {
    const m = cache.get(coll);
    const docs = [...m.entries()].map(([i, d]) => snap(i, d));
    const qs = { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} };
    (listeners.get(coll) || []).forEach((f) => { try { f(qs); } catch (e) { console.error(e); } });
    for (const [k, set] of docListeners) {
      const [c, i] = k.split("/");
      if (c === coll && (!id || i === id)) set.forEach((f) => { try { f(snap(i, m.get(i))); } catch (e) { console.error(e); } });
    }
  }
  /* last copy of the board on this device, so it opens instantly; refreshed in the background */
  const ckey = (uid) => "prolight-cache:" + uid;
  function saveCache() {
    clearTimeout(saveCache.t);
    saveCache.t = setTimeout(() => {
      if (!ME) return;
      try { localStorage.setItem(ckey(ME.id), JSON.stringify({ v: 1, at: Date.now(), staff: [...STAFF.values()], d: Object.fromEntries(COLLS.map((c) => [c, [...cache.get(c)]])) })); }
      catch (e) { try { localStorage.removeItem(ckey(ME.id)); } catch (x) {} }
    }, 1500);
  }
  function readCache(uid) {
    try { const o = JSON.parse(localStorage.getItem(ckey(uid)) || "null"); return o && o.v === 1 && Date.now() - o.at < 7 * 864e5 ? o : null; } catch (e) { return null; }
  }
  let lastLoad = 0, loading = null;
  function loadAll() {
    if (loading) return loading;
    loading = (async () => {
      if (outCount && navigator.onLine) await flush();
      const fresh = await Promise.all(COLLS.map(async (c) => {
        const m = new Map();
        for (let from = 0; ; from += 1000) {
          const { data, error } = await sb.from("docs").select("id,data").eq("coll", c).range(from, from + 999);
          if (error) throw error;
          data.forEach((r) => m.set(r.id, r.data));
          if (data.length < 1000) break;
        }
        return [c, m];
      }));
      const changed = fresh.filter(([c, m]) => !sameMap(cache.get(c), m)).map(([c]) => c);
      fresh.forEach(([c, m]) => cache.set(c, m));
      const first = !loaded; loaded = true; lastLoad = Date.now();
      (first ? COLLS : changed).forEach((c) => emit(c));
      saveCache();
      if (first) { outboxChanged(); setTimeout(flush, 500); }
    })().finally(() => { loading = null; });
    return loading;
  }
  function sameMap(a, b) {
    if (!a || a.size !== b.size) return false;
    for (const [k, v] of b) if (!a.has(k) || JSON.stringify(a.get(k)) !== JSON.stringify(v)) return false;
    return true;
  }
  let channel = null;
  function subscribe() {
    if (channel) sb.removeChannel(channel);
    channel = sb
      .channel("board-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => {
        const row = p.eventType === "DELETE" ? p.old : p.new;
        if (!row || !cache.has(row.coll)) return;
        if (p.eventType === "DELETE") cache.get(row.coll).delete(row.id);
        else cache.get(row.coll).set(row.id, row.data);
        emit(row.coll, row.id);
        saveCache();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        window.dispatchEvent(new CustomEvent("prolight:msg", { detail: p }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => {
        PL.reloadStaff().then((me) => { if (!me || !me.active) PL.signOut(); }).catch(() => {});
      })
      .subscribe((status) => { if (status === "SUBSCRIBED" && loaded) { loadAll().catch(() => {}); window.dispatchEvent(new Event("prolight:chatreload")); } });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && loaded && Date.now() - lastLoad > 30000) { loadAll().catch(() => {}); window.dispatchEvent(new Event("prolight:chatreload")); } });

  const asErr = (e) => {
    const x = new Error(e && e.message ? e.message : "Request failed");
    x.code = e && (e.code === "42501" || /row-level security|not allowed|permission/i.test(e.message || "")) ? "invalid_argument" : "unavailable";
    return x;
  };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : Math.random().toString(36).slice(2, 14));
  /* ---------- offline outbox: changes made with no signal wait here and send when it's back ---------- */
  const isNet = (e) => !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|fetch failed|timed? ?out/i.test((e && (e.message || e.details)) || "");
  const IDB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((ok, no) => { const r = indexedDB.open("prolight-outbox", 1); r.onupgradeneeded = () => r.result.createObjectStore("q", { keyPath: "seq", autoIncrement: true }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
    const tx = async (mode, fn) => { const d = await open(); return new Promise((ok, no) => { const t = d.transaction("q", mode), st = t.objectStore("q"), res = fn(st); t.oncomplete = () => ok(res && res.result); t.onerror = () => no(t.error); }); };
    return { add: (o) => tx("readwrite", (st) => st.add(o)), all: () => tx("readonly", (st) => st.getAll()), del: (k) => tx("readwrite", (st) => st.delete(k)) };
  })();
  let outCount = 0;
  const pendingUrl = new Map();
  async function outboxChanged() { try { outCount = (await IDB.all()).length; } catch (e) {} window.dispatchEvent(new CustomEvent("prolight:outbox", { detail: outCount })); }
  async function queue(op) { await IDB.add({ ...op, at: Date.now(), uid: ME && ME.id }); saveCache(); outboxChanged(); }
  async function runOp(o) {
    if (o.kind === "set") { const { error } = await sb.from("docs").upsert({ coll: o.coll, id: o.id, data: o.data, updated_at: new Date().toISOString() }); if (error) throw error; }
    else if (o.kind === "merge") { const { error } = await sb.rpc("doc_merge", { p_coll: o.coll, p_id: o.id, p_patch: o.patch }); if (error) throw error; }
    else if (o.kind === "del") { const { error } = await sb.from("docs").delete().eq("coll", o.coll).eq("id", o.id); if (error) throw error; }
    else if (o.kind === "upload") { const { error } = await sb.storage.from("media").upload(o.path, o.blob, { contentType: o.type, upsert: false }); if (error && !/exists|duplicate/i.test(error.message)) throw error; }
  }
  let flushing = null;
  function flush() {
    if (flushing || !loaded || !navigator.onLine) return flushing;
    flushing = (async () => {
      let sent = 0, dropped = 0;
      for (const o of await IDB.all().catch(() => [])) {
        if (o.uid && ME && o.uid !== ME.id) { await IDB.del(o.seq); continue; }
        try { await runOp(o); await IDB.del(o.seq); sent++; }
        catch (e) { if (isNet(e)) break; await IDB.del(o.seq); dropped++; }
      }
      await outboxChanged();
      if (sent || dropped) { window.dispatchEvent(new CustomEvent("prolight:outboxSent", { detail: { sent, dropped } })); loadAll().catch(() => {}); }
    })().finally(() => { flushing = null; });
    return flushing;
  }
  window.addEventListener("online", () => setTimeout(flush, 800));
  setInterval(() => { if (outCount) flush(); }, 20000);
  async function write(op, local) {
    local(); emit(op.coll, op.id);
    if (!navigator.onLine) return queue(op);
    try { await runOp(op); }
    catch (e) { if (isNet(e)) return queue(op); throw asErr(e); }
  }
  function docRef(path) {
    const [coll, id] = path.split("/");
    return {
      id, path,
      async get() { return snap(id, cache.get(coll).get(id)); },
      async set(data) {
        const prev = cache.get(coll).get(id);
        try { await write({ kind: "set", coll, id, data }, () => cache.get(coll).set(id, data)); }
        catch (e) { if (prev === undefined) cache.get(coll).delete(id); else cache.get(coll).set(id, prev); emit(coll, id); throw e; }
      },
      async update(patch) {
        const prev = cache.get(coll).get(id);
        try { await write({ kind: "merge", coll, id, patch }, () => cache.get(coll).set(id, { ...(prev || {}), ...patch })); }
        catch (e) { if (prev === undefined) cache.get(coll).delete(id); else cache.get(coll).set(id, prev); emit(coll, id); throw e; }
      },
      async delete() {
        const prev = cache.get(coll).get(id);
        try { await write({ kind: "del", coll, id }, () => cache.get(coll).delete(id)); }
        catch (e) { if (prev !== undefined) cache.get(coll).set(id, prev); emit(coll, id); throw e; }
      },
      onSnapshot(fn) {
        const k = coll + "/" + id;
        if (!docListeners.has(k)) docListeners.set(k, new Set());
        docListeners.get(k).add(fn);
        if (loaded) setTimeout(() => fn(snap(id, cache.get(coll).get(id))), 0);
        return () => docListeners.get(k).delete(fn);
      },
    };
  }
  function collRef(coll) {
    return {
      path: coll,
      doc: (id) => docRef(coll + "/" + (id || newId())),
      async add(d) { const r = docRef(coll + "/" + newId()); await r.set(d); return r; },
      onSnapshot(fn) {
        if (!listeners.has(coll)) listeners.set(coll, new Set());
        listeners.get(coll).add(fn);
        if (loaded) setTimeout(() => emit(coll), 0);
        return () => listeners.get(coll).delete(fn);
      },
    };
  }
  const db = { doc: docRef, collection: collRef };

  const user = {
    isOwner: async () => !!(ME && ME.can_manage),
    canEdit: async () => !!(ME && ME.can_edit),
    can: async (n) => (n === "data.write" ? !!(ME && ME.can_edit) : null),
    id: async () => (ME ? ME.id : null),
    me: async () => ({ id: ME ? ME.id : null, name: ME ? ME.name : "", isOwner: !!(ME && ME.can_edit), canEdit: !!(ME && ME.can_edit), avatarUrl: "", color: "#888", email: null, perms: ME }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: (STAFF.get(i) || {}).name || "", avatarUrl: "", color: "#888", email: null, isMe: !!ME && i === ME.id, guest: false }])),
  };

  const assets = {
    async upload(blob, opts = {}) {
      const type = opts.type || blob.type || "application/octet-stream";
      const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "application/pdf": "pdf" })[type] || "bin";
      const path = `${new Date().getFullYear()}/${newId()}.${ext}`;
      const offline = async () => { await queue({ kind: "upload", path, blob, type }); pendingUrl.set(path, URL.createObjectURL(blob)); return { id: path, url: pendingUrl.get(path), sizeBytes: blob.size, contentType: type, pending: true }; };
      if (!navigator.onLine) return offline();
      let error;
      try { ({ error } = await sb.storage.from("media").upload(path, blob, { contentType: type, upsert: false })); } catch (e) { error = e; }
      if (error && isNet(error)) return offline();
      if (error) {
        const e = new Error(error.message);
        e.code = /size|large|exceed/i.test(error.message) ? "too_large" : /mime|type/i.test(error.message) ? "unsupported_type" : /security|policy|unauthor/i.test(error.message) ? "not_granted" : "upstream_error";
        throw e;
      }
      return { id: path, url: window.mediaUrl(path), sizeBytes: blob.size, contentType: type };
    },
    async delete(id) { await sb.storage.from("media").remove([id]); return { deleted: true }; },
  };

  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  window.claude = {
    use: async (n) => {
      await ready;
      if (n === "db") return db;
      if (n === "user") return user;
      if (n === "assets") return ME && ME.can_log ? assets : null;
      return null;
    },
  };

  /* ---------- sign-in screen ---------- */
  function showGate(html) {
    let g = $("#gate");
    if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
    const es = (() => { try { return localStorage.getItem("lang") === "es"; } catch (e) { return false; } })();
    g.innerHTML = `<button type="button" class="gate-lang" id="gate-lang">${es ? "English" : "Español"}</button><div class="gate-card"><div class="gate-brand"><img src="/brand/prolight.png" alt="ProLight Tallahassee" width="220" height="91"><span>Season Board</span></div>${html}</div>`;
    g.hidden = false;
    return g;
  }
  function hideGate() { const g = $("#gate"); if (g) g.hidden = true; }
  PL.pickLook = async (why) => { await lookStep(why); hideGate(); };

  function pinPad(title, sub, onDone, noBack) {
    const g = showGate(`${noBack ? "" : '<button type="button" class="gate-back" data-g="back">‹ Back</button>'}<h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}
      <div class="gate-dots" aria-live="polite">${"<i></i>".repeat(6)}</div><p class="gate-err" id="gate-err"></p>
      <div class="gate-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => k === "" ? "<span></span>" : `<button type="button" data-k="${k}">${k}</button>`).join("")}</div>`);
    let pin = "";
    const dots = () => g.querySelectorAll(".gate-dots i").forEach((d, i) => d.classList.toggle("on", i < pin.length));
    const press = async (k) => {
      if (k === "⌫") pin = pin.slice(0, -1);
      else if (pin.length < 6) pin += k;
      dots();
      if (pin.length === 6) {
        const p = pin; pin = "";
        const msg = await onDone(p);
        if (msg) { $("#gate-err").textContent = msg; g.querySelector(".gate-dots").classList.add("shake"); setTimeout(() => { const d = g.querySelector(".gate-dots"); if (d) d.classList.remove("shake"); dots(); }, 450); }
      }
    };
    g.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.g === "back") return start(); if (b.dataset.k !== undefined) press(b.dataset.k); };
    document.onkeydown = (e) => { if ($("#gate") && !$("#gate").hidden) { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("⌫"); } };
  }

  const dayKey = () => { const d = new Date(Date.now() - 3 * 3600e3); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  const dayOk = () => { try { return localStorage.getItem("prolight-day") === dayKey(); } catch (e) { return false; } };
  async function endDay() {
    try { const { data } = await sb.auth.getSession(); const uid = data.session && data.session.user.id; if (uid) localStorage.removeItem(ckey(uid)); } catch (e) {}
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && loaded && !dayOk()) endDay().then(() => location.reload()); });
  let freshSignIn = false, lastPin = "";
  /* square, centered, 480px JPEG from any photo */
  async function squarePhoto(file) {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
    const s = Math.min(img.naturalWidth, img.naturalHeight), cv = document.createElement("canvas"); cv.width = cv.height = 480;
    cv.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 3, s, s, 0, 0, 480, 480);
    return new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.86));
  }
  function pinStep() {
    return new Promise((resolve) => {
      const first = (ME.name || "").split(" ")[0];
      const g = showGate(`<h2>${esc(first)}, pick your own PIN</h2><p>You signed in with the PIN the office gave you. Choose a new 6-digit PIN only you know.</p>
        <form id="np-form" class="gate-form"><label>New 6-digit PIN<input id="np-1" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
        <label>Type it again<input id="np-2" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
        <p class="gate-err" id="gate-err"></p><button type="submit" class="gate-go">Save my PIN</button></form>`);
      g.querySelector("#np-form").onsubmit = async (e) => {
        e.preventDefault();
        const a = $("#np-1").value.trim(), b = $("#np-2").value.trim(), btn = g.querySelector(".gate-go");
        if (!/^[0-9]{6}$/.test(a)) { $("#gate-err").textContent = "Use exactly 6 digits."; return; }
        if (a !== b) { $("#gate-err").textContent = "The two PINs don't match."; return; }
        if (a === lastPin) { $("#gate-err").textContent = "Pick a PIN that's different from the one the office gave you."; return; }
        if (/^(\d)\1{5}$/.test(a) || a === "123456" || a === "654321") { $("#gate-err").textContent = "That PIN is too easy to guess. Try another."; return; }
        btn.disabled = true; btn.textContent = "Saving…";
        try { await PL.setPin(ME.id, a); ME.pin_ok = true; resolve(); }
        catch (x) { btn.disabled = false; btn.textContent = "Save my PIN"; $("#gate-err").textContent = /taken|use|belongs|unique/i.test(x.message) ? "That PIN is taken. Pick another." : "Couldn't save it: " + x.message; }
      };
    });
  }
  function photoStep() {
    return new Promise((resolve) => {
      const first = (ME.name || "").split(" ")[0];
      const g = showGate(`<h2>Hey ${esc(first)}! Add your headshot</h2><p>It shows when you sign in and next to your messages. A clear photo of your face works best.</p>
        <div class="head-prev" id="hs-prev"><span>${esc((first[0] || "?").toUpperCase())}</span></div>
        <label class="gate-go head-pick">Take or choose a photo<input type="file" id="hs-file" accept="image/*" hidden></label>
        <button type="button" class="gate-go" id="hs-save" hidden>Use this photo</button>
        <p class="gate-err" id="gate-err"></p>`);
      let blob = null;
      g.querySelector("#hs-file").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { blob = await squarePhoto(f); } catch (x) { if (/jpe?g|png|webp/i.test(f.type)) blob = f; else { $("#gate-err").textContent = "Couldn't read that photo. Try a different one (JPG or PNG)."; return; } }
        $("#hs-prev").innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
        $("#hs-save").hidden = false; g.querySelector(".head-pick").firstChild.textContent = "Pick a different one";
      };
      g.querySelector("#hs-save").onclick = async (e) => {
        e.target.disabled = true; e.target.textContent = "Saving…";
        try { await PL.setPhoto(ME.id, blob); resolve(); }
        catch (x) { e.target.disabled = false; e.target.textContent = "Use this photo"; $("#gate-err").textContent = "Couldn't save it: " + (x.message || "check your signal") + ". Try again."; }
      };
    });
  }
  const WCOL = { warm: "#FFB23E", white: "#EEF3FF", red: "#E8352B", green: "#22B04F", blue: "#2F6BFF", purple: "#8E4DFF", orange: "#FF7A1A", yellow: "#FFD21F", teal: "#14B8A6" };
  const LCOMBOS = [["Warm white",["warm"]],["Pure white",["white"]],["Warm + pure white",["warm","white"]],["Classic multicolor",["red","green","blue","orange","yellow"]],["Red & green",["red","green"]],["Candy cane",["red","white"]],["Red, white & green",["red","white","green"]],["Blue & white",["blue","white"]],["Icy",["white","blue","teal"]],["Red, white & blue",["red","white","blue"]],["Green & gold",["green","yellow"]],["Purple & teal",["purple","teal"]],...(new Date().getMonth() === 9 ? [["Halloween",["orange","purple"]]] : []),["Rainbow",["red","orange","yellow","green","teal","blue","purple","white","warm"]]];
  const lookFlag = () => { try { return !!localStorage.getItem("prolight-look-set:" + ME.id); } catch (e) { return false; } };
  function saveLookLocal(colors) { try { const o = JSON.parse(localStorage.getItem("look") || "{}"); o.colors = colors; localStorage.setItem("look", JSON.stringify(o)); localStorage.setItem("prolight-look-set:" + ME.id, "1"); } catch (e) {} }
  function lookStep(why) {
    return new Promise((resolve) => {
      const first = (ME.name || "").split(" ")[0];
      let pick = null;
      const sw = (cs) => `<span class="look-swatch">${cs.map((k) => `<i style="--c:${WCOL[k]}"></i>`).join("")}</span>`;
      const g = showGate(`<h2>${why ? esc(why) : esc(first) + ", pick your lights"}</h2><p>Your colors light up the bulbs across the board: your route, check-offs and the welcome screen. You can change them later in Account.</p>
        <div class="look-combos" style="width:100%;text-align:left">${LCOMBOS.map(([l, cs], i) => `<button type="button" class="look-combo" data-i="${i}" aria-pressed="false" style="color:var(--night-ink);background:var(--night-2);border-color:#2a3832">${sw(cs)}${esc(l)}</button>`).join("")}</div>
        <button type="button" class="gate-go" id="lk-save" disabled>Pick a set of colors</button><p class="gate-err" id="gate-err"></p>`);
      g.querySelector(".gate-card").style.width = "min(560px,100%)";
      g.querySelectorAll(".look-combo").forEach((b) => b.onclick = () => { pick = LCOMBOS[+b.dataset.i]; g.querySelectorAll(".look-combo").forEach((x) => x.setAttribute("aria-pressed", x === b)); const s = $("#lk-save"); s.disabled = false; s.textContent = "Use " + pick[0]; });
      $("#lk-save").onclick = async (e) => {
        if (!pick) return; e.target.disabled = true; e.target.textContent = "Saving…";
        saveLookLocal(pick[1]);
        try { await PL.setLook(pick[1]); } catch (x) {}
        if (typeof applyLook === "function") try { applyLook(); } catch (x) {}
        resolve();
      };
    });
  }
  function welcome() {
    let cols = ["warm"]; try { cols = (JSON.parse(localStorage.getItem("look") || "{}").colors || cols).filter((k) => WCOL[k]); } catch (e) {}
    if (!cols.length) cols = ["warm"];
    const first = (ME.name || "").split(" ")[0] || "there", url = PL.photoUrl(ME), n = 14;
    const ring = [...Array(n)].map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return `<span class="wb" style="left:${(50 + Math.cos(a) * 50).toFixed(2)}%;top:${(50 + Math.sin(a) * 50).toFixed(2)}%;--bc:${WCOL[cols[i % cols.length]]};--d:${i};--r:${(a * 180 / Math.PI + 90).toFixed(1)}deg"></span>`; }).join("");
    const el = document.createElement("div"); el.id = "welcome";
    el.innerHTML = `<div class="w-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="none" stroke="#2a6e4e" stroke-width="1.2"/></svg>${ring}
      <div class="w-face">${url ? `<img src="${esc(url)}" alt="">` : `<span>${esc(first[0].toUpperCase())}</span>`}</div></div>
      <div class="w-hi">Welcome, ${esc(first)}!</div>${ME.title ? `<div class="w-title">${esc(ME.title)}</div>` : ""}`;
    document.body.appendChild(el);
    return new Promise((resolve) => {
      const done = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), 450); resolve(); };
      el.addEventListener("click", done); setTimeout(done, 2900);
      setTimeout(resolve, 300); // let the board load underneath right away
    });
  }
  async function signInAs(person, pin) {
    const { error } = await sb.auth.signInWithPassword({ email: person.email, password: pin });
    if (error) return /rate|many/i.test(error.message) ? "Too many tries. Wait a few minutes and try again." : "That PIN didn't match. Try again.";
    try { localStorage.setItem("prolight-day", dayKey()); localStorage.removeItem("prolight-last"); } catch (e) {}
    freshSignIn = true; lastPin = pin;
    await afterSignIn();
    return null;
  }

  async function start() {
    const { data: s } = await sb.auth.getSession();
    if (s && s.session) { if (dayOk()) return afterSignIn(); await endDay(); }
    const { data: needs, error } = await sb.rpc("needs_owner");
    if (error) return showGate(`<h2>Can't reach the board</h2><p>Check your connection and reload. (${esc(error.message)})</p>`);
    if (needs) return setupOwner();
    pinPad("Enter your PIN", "", async (pin) => {
      const { data: email, error: e2 } = await sb.rpc("pin_login", { p_pin: pin });
      if (e2) return /many|belongs/i.test(e2.message) ? e2.message : "Couldn't check that PIN. Check your connection.";
      if (!email) return "That PIN didn't match. Try again.";
      return signInAs({ email }, pin);
    }, true);
  }

  function setupOwner() {
    const g = showGate(`<h2>Set up the board</h2><p>Create the owner login. You can add your crews after this.</p>
      <form id="owner-form" class="gate-form"><label>Your name<input id="o-name" autocomplete="name" required></label>
      <label>Choose a 6-digit PIN<input id="o-pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>
      <label>Type it again<input id="o-pin2" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label>
      <p class="gate-err" id="gate-err"></p><button type="submit" class="gate-go">Create owner login</button></form>`);
    g.querySelector("#owner-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = $("#o-name").value.trim(), pin = $("#o-pin").value.trim();
      if (pin !== $("#o-pin2").value.trim()) { $("#gate-err").textContent = "The two PINs don't match."; return; }
      const { data: id, error } = await sb.rpc("bootstrap_owner", { p_name: name, p_pin: pin });
      if (error) { $("#gate-err").textContent = error.message; return; }
      const msg = await signInAs({ id, email: id + "@pin.example.com" }, pin);
      if (msg) $("#gate-err").textContent = msg;
    };
  }

  async function afterSignIn() {
    const { data: ss } = await sb.auth.getSession();
    const uid = ss && ss.session && ss.session.user.id, c = uid && readCache(uid);
    if (c) {
      STAFF = new Map(c.staff.map((x) => [x.id, x])); ME = STAFF.get(uid) || null;
      if (ME && ME.active) {
        COLLS.forEach((k) => cache.set(k, new Map(c.d[k] || [])));
        loaded = true; hideGate(); document.onkeydown = null; resolveReady();
        PL.reloadStaff().then((me) => { if (!me || !me.active) PL.signOut(); }).catch(() => {});
        loadAll().catch(() => {}).then(subscribe);
        return;
      }
    }
    let me = null;
    try { me = await PL.reloadStaff(); } catch (e) {}
    if (!me || !me.active) {
      await sb.auth.signOut();
      return showGate(`<h2>No access</h2><p>This login isn't active. Ask the office to turn it back on.</p><button type="button" class="gate-go" onclick="location.reload()">Back</button>`);
    }
    try { await loadAll(); } catch (e) { return showGate(`<h2>Can't load the board</h2><p>${esc(e.message)}</p>`); }
    subscribe();
    if (freshSignIn) {
      freshSignIn = false; document.onkeydown = null;
      if (ME.pin_ok === false) await pinStep();
      if (!ME.photo) await photoStep();
      if (ME.look && Array.isArray(ME.look.colors) && ME.look.colors.length) saveLookLocal(ME.look.colors.filter((k) => WCOL[k]));
      else if (!lookFlag()) await lookStep();
      { let cur = "en"; try { cur = localStorage.getItem("lang") || "en"; } catch (e) {}
        if (ME.look && ME.look.lang && ME.look.lang !== cur) { try { localStorage.setItem("lang", ME.look.lang); } catch (e) {} location.reload(); return; }
        if (cur === "es" && !(ME.look && ME.look.lang)) PL.setLang("es").catch(() => {}); }
      hideGate(); resolveReady(); welcome();
      { const ua = navigator.userAgent, dev = /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
        PL.logEvents([{ type: "signin", device: dev }]).catch(() => {}); }
      return;
    }
    hideGate();
    document.onkeydown = null;
    resolveReady();
  }

  document.addEventListener("click", (e) => { if (e.target && e.target.id === "gate-lang") { try { localStorage.setItem("lang", localStorage.getItem("lang") === "es" ? "en" : "es"); } catch (x) {} location.reload(); } });
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && loaded) location.reload(); });
  document.addEventListener("DOMContentLoaded", start);
})();
