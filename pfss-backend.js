/* Public Force Security Services: backend layer (Supabase)
 *
 * The app was written for Claude's runtime (window.claude.use("db"), "user", "assets", "downloads").
 * This file provides the same four capabilities on top of Supabase, and puts a sign-in screen in
 * front of everything. The app only gets its database after a staff member has signed in.
 * If window.claude already exists (the app is opened inside Claude), this file does nothing.
 */
(function () {
  'use strict';
  if (window.claude && typeof window.claude.use === 'function') return;

  var cfg = window.PFSS_CONFIG || {};
  var IDLE_MS = (Number(cfg.IDLE_MINUTES) || 30) * 60 * 1000;
  var BUCKET = 'employee-docs';
  var DOC_PREFIX = 'pfss-doc:';
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) && window.supabase);
  var sb = null, session = null, profile = null, readyPromise = null;
  var listeners = {}, channels = {}, refreshTimers = {};

  /* ---------- small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function newId() { var s = '', c = 'abcdefghijklmnopqrstuvwxyz0123456789'; for (var i = 0; i < 20; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  function dbError(err) {
    var code = (err && err.code) || 'error';
    if (code === '42501' || /row-level security|permission denied/i.test((err && err.message) || '')) code = 'no-permission';
    var e = new Error((err && err.message) || 'Database error'); e.code = code; return e;
  }
  function toast(msg) { var t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function canWrite() { return !!profile && (profile.role === 'admin' || profile.role === 'manager'); }

  /* ---------- sign-in screens ---------- */
  var overlay = null;
  function showOverlay(build) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:var(--bg,#F3F5F4);display:grid;place-items:center;padding:20px;overflow:auto';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';
    var card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:380px;background:var(--surface,#fff);border:1px solid var(--line,#DCE2E0);border-radius:14px;padding:28px 26px';
    overlay.appendChild(card);
    build(card);
  }
  function hideOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'style') n.style.cssText = attrs[k]; else n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text; return n;
  }
  function field(card, label, type, id, autocomplete) {
    var wrap = el('div', { style: 'display:flex;flex-direction:column;gap:5px;margin-top:14px' });
    wrap.appendChild(el('label', { for: id, style: 'font-size:12.5px;font-weight:600;color:var(--muted,#5C6A72)' }, label));
    var inp = el('input', { id: id, type: type, autocomplete: autocomplete || 'off', required: 'required' });
    wrap.appendChild(inp); card.appendChild(wrap); return inp;
  }
  function heading(card, title, sub) {
    card.appendChild(el('h2', { style: 'margin:0;font-size:1.3rem' }, title));
    if (sub) card.appendChild(el('p', { style: 'margin:6px 0 0;color:var(--muted,#5C6A72);font-size:.9rem' }, sub));
  }

  function showSetupMessage(why) {
    showOverlay(function (card) {
      heading(card, 'Setup needed', 'This app is not connected to its database yet.');
      card.appendChild(el('p', { style: 'font-size:.9rem;line-height:1.5' }, why));
      card.appendChild(el('p', { style: 'font-size:.85rem;color:var(--muted,#5C6A72)' }, 'Open config.js and enter the Supabase project URL and anon key. The README has the steps.'));
    });
  }

  function showLogin() {
    return new Promise(function (resolve) {
      showOverlay(function (card) {
        heading(card, 'Public Force Security Services', 'Staff sign in');
        var form = el('form', { novalidate: 'novalidate' });
        card.appendChild(form);
        var email = field(form, 'Email', 'email', 'pfssEmail', 'username');
        var pass = field(form, 'Password', 'password', 'pfssPass', 'current-password');
        var msg = el('p', { role: 'alert', style: 'min-height:1.2em;margin:12px 0 0;font-size:.85rem;color:var(--bad,#B03A2E)' });
        form.appendChild(msg);
        var btn = el('button', { type: 'submit', class: 'btn', style: 'width:100%;justify-content:center;margin-top:6px' }, 'Sign in');
        form.appendChild(btn);
        var forgot = el('button', { type: 'button', style: 'background:none;border:0;padding:0;margin-top:14px;color:var(--brand,#0D6A60);cursor:pointer;font-size:.85rem;text-decoration:underline' }, 'Forgot password?');
        card.appendChild(forgot);
        card.appendChild(el('p', { style: 'margin:18px 0 0;font-size:.75rem;color:var(--muted,#5C6A72)' }, 'Authorised staff only. Access is logged.'));
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          if (!email.value.trim() || !pass.value) { msg.textContent = 'Enter your email and password.'; return; }
          btn.disabled = true; btn.textContent = 'Signing in...'; msg.textContent = '';
          var r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
          if (r.error || !r.data || !r.data.session) {
            msg.textContent = (r.error && /rate|too many/i.test(r.error.message)) ? 'Too many attempts. Wait a minute and try again.' : 'Email or password is incorrect.';
            btn.disabled = false; btn.textContent = 'Sign in'; pass.value = ''; pass.focus(); return;
          }
          resolve(r.data.session);
        });
        forgot.addEventListener('click', async function () {
          if (!email.value.trim()) { msg.style.color = 'var(--bad,#B03A2E)'; msg.textContent = 'Type your email first, then choose Forgot password.'; return; }
          await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname });
          msg.style.color = 'var(--ok,#1B7A44)'; msg.textContent = 'If that email has an account, a reset link is on its way.';
        });
        email.focus();
      });
    });
  }

  function showSetPassword() {
    return new Promise(function (resolve) {
      showOverlay(function (card) {
        heading(card, 'Set a new password', 'Choose a password of at least 10 characters.');
        var form = el('form', { novalidate: 'novalidate' }); card.appendChild(form);
        var p1 = field(form, 'New password', 'password', 'pfssNew1', 'new-password');
        var p2 = field(form, 'Repeat password', 'password', 'pfssNew2', 'new-password');
        var msg = el('p', { role: 'alert', style: 'min-height:1.2em;margin:12px 0 0;font-size:.85rem;color:var(--bad,#B03A2E)' }); form.appendChild(msg);
        var btn = el('button', { type: 'submit', class: 'btn', style: 'width:100%;justify-content:center;margin-top:6px' }, 'Save password'); form.appendChild(btn);
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          if (p1.value.length < 10) { msg.textContent = 'Use at least 10 characters.'; return; }
          if (p1.value !== p2.value) { msg.textContent = 'The two passwords do not match.'; return; }
          btn.disabled = true;
          var r = await sb.auth.updateUser({ password: p1.value });
          if (r.error) { msg.textContent = 'Could not save the password. Try the reset link again.'; btn.disabled = false; return; }
          history.replaceState(null, '', location.pathname);
          resolve();
        });
        p1.focus();
      });
    });
  }

  function showBlocked(text) {
    return new Promise(function (resolve) {
      showOverlay(function (card) {
        heading(card, 'No access', text);
        var btn = el('button', { type: 'button', class: 'btn', style: 'width:100%;justify-content:center;margin-top:18px' }, 'Sign out');
        btn.addEventListener('click', function () { resolve(); }); card.appendChild(btn);
      });
    });
  }

  /* ---------- session, profile, idle timeout ---------- */
  async function loadProfile() {
    var r = await sb.from('profiles').select('id,email,full_name,role').eq('id', session.user.id).maybeSingle();
    return r.error ? null : r.data;
  }
  async function signOut() { try { await sb.auth.signOut(); } catch (e) {} location.reload(); }

  function installSessionBar() {
    var top = $('.top'); if (!top || $('#pfssSession')) return;
    var box = el('div', { id: 'pfssSession', style: 'display:flex;align-items:center;gap:10px;font-size:.85rem;color:var(--muted,#5C6A72)' });
    box.appendChild(el('span', null, (profile.full_name || profile.email) + ' (' + profile.role + ')'));
    var b = el('button', { type: 'button', class: 'btn small ghost' }, 'Sign out');
    b.addEventListener('click', signOut); box.appendChild(b); top.appendChild(box);
  }
  function startIdleTimer() {
    var t; function reset() { clearTimeout(t); t = setTimeout(signOut, IDLE_MS); }
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, reset, { passive: true }); });
    reset();
  }

  async function start() {
    if (!window.supabase) { showSetupMessage('The Supabase library did not load. Check your internet connection and that the script tag in index.html is present.'); return new Promise(function () {}); }
    if (!configured) { showSetupMessage('The Supabase project URL and key have not been entered.'); return new Promise(function () {}); }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    var recovery = /type=recovery/.test(location.hash);
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') recovery = true; if (ev === 'SIGNED_OUT' && profile) location.reload(); });
    var r = await sb.auth.getSession(); session = r.data && r.data.session;
    await new Promise(function (res) { setTimeout(res, 60); });
    if (recovery && session) { await showSetPassword(); }
    for (;;) {
      if (!session) session = await showLogin();
      profile = await loadProfile();
      if (profile && profile.role !== 'disabled') break;
      await showBlocked(profile ? 'This account has been switched off. Ask an administrator.' : 'This account has not been set up for the app yet. Ask an administrator.');
      try { await sb.auth.signOut(); } catch (e) {} session = null;
    }
    hideOverlay(); installSessionBar(); startIdleTimer();
    return true;
  }
  function whenReady() { if (!readyPromise) readyPromise = start(); return readyPromise; }

  /* ---------- database (same calls the app already makes) ---------- */
  function snapOf(row) { return { id: row.id, exists: true, data: function () { return row.data; } }; }
  async function fetchCollection(name) {
    var rows = [], from = 0, size = 1000;
    for (;;) {
      var r = await sb.from('documents').select('id,data').eq('collection', name).order('id').range(from, from + size - 1);
      if (r.error) throw dbError(r.error);
      rows = rows.concat(r.data || []);
      if (!r.data || r.data.length < size) break;
      from += size;
    }
    return rows;
  }
  async function refresh(name) {
    var subs = listeners[name]; if (!subs || !subs.length) return;
    try {
      var rows = await fetchCollection(name), snap = { docs: rows.map(snapOf) };
      subs.slice().forEach(function (s) { try { s.cb(snap); } catch (e) { console.error(e); } });
    } catch (e) { subs.slice().forEach(function (s) { if (s.err) s.err({ code: e.code || 'error', message: e.message }); }); }
  }
  function scheduleRefresh(name) { clearTimeout(refreshTimers[name]); refreshTimers[name] = setTimeout(function () { refresh(name); }, 150); }
  function ensureChannel(name) {
    if (channels[name]) return;
    try {
      channels[name] = sb.channel('docs-' + name)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: 'collection=eq.' + name }, function () { scheduleRefresh(name); })
        .subscribe();
    } catch (e) { channels[name] = true; }
  }
  setInterval(function () { if (document.visibilityState !== 'hidden') Object.keys(listeners).forEach(function (n) { if (listeners[n].length) refresh(n); }); }, 30000);

  function subscribe(name, cb, err) {
    var s = { cb: cb, err: err };
    (listeners[name] = listeners[name] || []).push(s);
    ensureChannel(name); refresh(name);
    return function () { listeners[name] = (listeners[name] || []).filter(function (x) { return x !== s; }); };
  }
  function clean(data) { return JSON.parse(JSON.stringify(data || {})); }
  function docRef(col, id) {
    return {
      id: id,
      get: async function () {
        var r = await sb.from('documents').select('data').eq('collection', col).eq('id', id).maybeSingle();
        if (r.error) throw dbError(r.error);
        return r.data ? { id: id, exists: true, data: function () { return r.data.data; } } : { id: id, exists: false, data: function () { return undefined; } };
      },
      set: async function (data) {
        var r = await sb.from('documents').upsert({ collection: col, id: id, data: clean(data) }, { onConflict: 'collection,id' });
        if (r.error) throw dbError(r.error); scheduleRefresh(col);
      },
      update: async function (data) {
        var cur = await sb.from('documents').select('data').eq('collection', col).eq('id', id).maybeSingle();
        if (cur.error) throw dbError(cur.error);
        if (!cur.data) { var nf = new Error('Document not found'); nf.code = 'not-found'; throw nf; }
        var merged = Object.assign({}, cur.data.data, clean(data));
        var r = await sb.from('documents').upsert({ collection: col, id: id, data: merged }, { onConflict: 'collection,id' });
        if (r.error) throw dbError(r.error); scheduleRefresh(col);
      },
      delete: async function () {
        var r = await sb.from('documents').delete().eq('collection', col).eq('id', id);
        if (r.error) throw dbError(r.error); scheduleRefresh(col);
      }
    };
  }
  var dbApi = {
    collection: function (name) {
      return {
        onSnapshot: function (cb, err) { return subscribe(name, cb, err); },
        add: async function (data) {
          var id = newId();
          var r = await sb.from('documents').insert({ collection: name, id: id, data: clean(data) });
          if (r.error) throw dbError(r.error); scheduleRefresh(name); return { id: id };
        },
        doc: function (id) { return docRef(name, id); }
      };
    },
    doc: function (path) {
      var p = String(path).split('/');
      if (p.length !== 2 || !p[0] || !p[1]) throw new Error('Unsupported document path: ' + path);
      return docRef(p[0], p[1]);
    }
  };

  /* ---------- who is signed in; approver search ---------- */
  function nameOf(p) { return p.full_name || p.email || 'Unnamed'; }
  var userApi = {
    me: async function () { return { id: session.user.id, name: nameOf(profile), email: profile.email, isOwner: profile.role === 'admin', canEdit: canWrite() }; },
    id: async function () { return session.user.id; },
    isOwner: function () { return profile.role === 'admin'; },
    canEdit: function () { return canWrite(); },
    can: function () { return canWrite(); },
    search: async function (q) {
      var query = sb.from('profiles').select('id,email,full_name,role').in('role', ['admin', 'manager']).limit(20);
      var term = String(q || '').replace(/[,()%*]/g, ' ').trim();
      if (term) query = query.or('full_name.ilike.%' + term + '%,email.ilike.%' + term + '%');
      var r = await query; if (r.error) throw dbError(r.error);
      return (r.data || []).map(function (p) { return { id: p.id, name: nameOf(p) }; });
    },
    profiles: async function (ids) {
      var out = {}; if (!ids || !ids.length) return out;
      var r = await sb.from('profiles').select('id,email,full_name').in('id', ids);
      if (!r.error) (r.data || []).forEach(function (p) { out[p.id] = { id: p.id, name: nameOf(p) }; });
      return out;
    }
  };

  /* ---------- downloads (a normal file download) ---------- */
  var downloadsApi = {
    save: async function (req) {
      var blob = (req.data instanceof Blob) ? req.data : new Blob([req.data]);
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = req.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
  };

  /* ---------- employee documents: private storage, opened through short-lived links ---------- */
  var assetsApi = {
    upload: async function (file) {
      if (!canWrite()) { var e = new Error('No permission'); e.code = 'no-permission'; throw e; }
      var safe = String(file.name || 'file').replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
      var path = newId() + '-' + safe;
      var r = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (r.error) throw dbError(r.error);
      return { id: path, url: DOC_PREFIX + path, contentType: file.type, sizeBytes: file.size };
    }
  };
  document.addEventListener('click', async function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="' + DOC_PREFIX + '"]') : null;
    if (!a || !sb) return;
    ev.preventDefault();
    var path = a.getAttribute('href').slice(DOC_PREFIX.length), w = window.open('about:blank', '_blank');
    var r = await sb.storage.from(BUCKET).createSignedUrl(path, 120);
    if (r.error || !r.data) { if (w) w.close(); toast('Could not open the document.'); return; }
    if (w) { w.opener = null; w.location.href = r.data.signedUrl; } else { location.href = r.data.signedUrl; }
  }, true);

  /* ---------- what the app calls ---------- */
  window.claude = {
    use: function (name) {
      if (name === 'db') return whenReady().then(function () { return dbApi; });
      if (name === 'user') return whenReady().then(function () { return userApi; });
      if (name === 'downloads') return whenReady().then(function () { return downloadsApi; });
      if (name === 'assets') return whenReady().then(function () { return assetsApi; });
      return Promise.resolve(null);
    }
  };
  /* test hook (ignored in the browser) */
  window.__pfssBackend = { _setClient: function (c, s, p) { sb = c; session = s; profile = p; } };
})();
