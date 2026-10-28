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
    async chatDelete(id) {
      const { error } = await sb.from("messages").delete().eq("id", id);
      if (error) throw new Error(error.message);
      window.dispatchEvent(new CustomEvent("prolight:msg", { detail: { eventType: "DELETE", old: { id } } }));
    },
    async signOut() {
      await sb.auth.signOut();
      try { localStorage.removeItem("prolight-last"); if (ME) localStorage.removeItem(ckey(ME.id)); } catch (e) {}
      location.reload();
    },
    geocode: async (q) => {
      const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
      if (!r.ok) return null;
      return r.json();
    },
  });
  window.mediaUrl = (id) => sb.storage.from("media").getPublicUrl(id).data.publicUrl;

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
  function docRef(path) {
    const [coll, id] = path.split("/");
    return {
      id, path,
      async get() { return snap(id, cache.get(coll).get(id)); },
      async set(data) {
        const { error } = await sb.from("docs").upsert({ coll, id, data, updated_at: new Date().toISOString() });
        if (error) throw asErr(error);
        cache.get(coll).set(id, data); emit(coll, id);
      },
      async update(patch) {
        const { error } = await sb.rpc("doc_merge", { p_coll: coll, p_id: id, p_patch: patch });
        if (error) throw asErr(error);
        cache.get(coll).set(id, { ...(cache.get(coll).get(id) || {}), ...patch }); emit(coll, id);
      },
      async delete() {
        const { error } = await sb.from("docs").delete().eq("coll", coll).eq("id", id);
        if (error) throw asErr(error);
        cache.get(coll).delete(id); emit(coll, id);
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
      const { error } = await sb.storage.from("media").upload(path, blob, { contentType: type, upsert: false });
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
    g.innerHTML = `<div class="gate-card"><div class="gate-brand"><img src="/brand/prolight.png" alt="ProLight Tallahassee" width="220" height="91"><span>Season Board</span></div>${html}</div>`;
    g.hidden = false;
    return g;
  }
  function hideGate() { const g = $("#gate"); if (g) g.hidden = true; }

  function pinPad(title, sub, onDone) {
    const g = showGate(`<button type="button" class="gate-back" data-g="back">‹ Back</button><h2>${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}
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

  async function signInAs(person, pin) {
    const { error } = await sb.auth.signInWithPassword({ email: person.email, password: pin });
    if (error) return /rate|many/i.test(error.message) ? "Too many tries. Wait a few minutes and try again." : "That PIN didn't match. Try again.";
    try { localStorage.setItem("prolight-last", person.id); } catch (e) {}
    await afterSignIn();
    return null;
  }

  async function start() {
    const { data: s } = await sb.auth.getSession();
    if (s && s.session) return afterSignIn();
    const { data: needs, error } = await sb.rpc("needs_owner");
    if (error) return showGate(`<h2>Can't reach the board</h2><p>Check your connection and reload. (${esc(error.message)})</p>`);
    if (needs) return setupOwner();
    const { data: people } = await sb.rpc("login_names");
    let last = null; try { last = localStorage.getItem("prolight-last"); } catch (e) {}
    const list = (people || []).slice().sort((a, b) => (b.id === last) - (a.id === last));
    const g = showGate(`<h2>Who's signing in?</h2><div class="gate-names">${list.map((p) => `<button type="button" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join("")}</div>`);
    g.onclick = (e) => { const b = e.target.closest("button[data-id]"); if (!b) return; const p = list.find((x) => x.id === b.dataset.id); pinPad(p.name, "Enter your 6-digit PIN", (pin) => signInAs(p, pin)); };
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
    hideGate();
    document.onkeydown = null;
    resolveReady();
  }

  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && loaded) location.reload(); });
  document.addEventListener("DOMContentLoaded", start);
})();
