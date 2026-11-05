// myProjects data store: offline-first.
// Every change is applied to a local copy right away (saved on this computer) and queued.
// When Supabase is configured and we're online, the queue is pushed in order and fresh data is pulled.
// With no Supabase config it runs fully local (single user) so the app works before the cloud is set up.
const Store = (() => {
  const cfg = window.NEXUS_CONFIG || {};
  const WEB = 'https://jackson-schroeder.github.io/mynexus/'; // where email links open (the phone web app), never localhost
  const sb = cfg.supabaseUrl && cfg.supabaseKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;
  const TABLES = ['projects', 'roles', 'members', 'invites', 'steps', 'cards', 'comments', 'attachments', 'milestones', 'updates', 'update_seen', 'profiles'];
  const V2 = ['milestones', 'updates', 'update_seen']; // from supabase/projects-v2.sql; treated as empty until that's run
  const CHILD = { projects: ['roles', 'members', 'invites', 'steps', 'cards', 'comments', 'attachments', 'milestones', 'updates', 'update_seen'], steps: ['cards'], cards: ['comments', 'attachments'] };
  const FK = { projects: 'project_id', steps: 'step_id', cards: 'card_id' };

  const PERMS = {
    create_cards: 'Create cards', edit_cards: 'Edit cards (title, description, people)', move_cards: 'Move cards',
    delete_cards: 'Delete cards', attach_files: 'Attach files', comment: 'Comment',
    edit_steps: 'Add, rename and reorder steps', invite: 'Invite people', manage_roles: 'Manage roles and members'
  };
  const ALL = Object.fromEntries(Object.keys(PERMS).map(k => [k, true]));
  const DEFAULT_ROLES = [
    { name: 'Admin', perms: ALL },
    { name: 'Member', perms: { create_cards: true, edit_cards: true, move_cards: true, attach_files: true, comment: true } },
    { name: 'Helper', perms: { move_cards: true, comment: true } }
  ];

  // Local-only and cloud data are kept apart, so test projects made before connecting stay on this computer
  const NS = sb ? 'p.cloud.' : 'p.';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(NS + k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch {} };
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  let db = load('db', Object.fromEntries(TABLES.map(t => [t, []])));
  TABLES.forEach(t => (db[t] ||= []));
  let queue = load('queue', []);
  let me = sb ? load('me', null) : { id: 'local', username: 'me' };
  if (!sb && !db.profiles.some(p => p.id === 'local')) db.profiles.push({ id: 'local', username: 'me' });
  let status = sb ? 'offline' : 'local', v2Missing = false;
  const listeners = new Set();

  let emitQueued = false;
  function emit() {
    save('db', db); save('queue', queue);
    if (emitQueued) return;
    emitQueued = true;
    setTimeout(() => { emitQueued = false; listeners.forEach(f => f()); });
  }

  // ---------- Local mutations (queued for the cloud) ----------
  function insert(table, row) {
    row = { id: uuid(), ...row };
    db[table].push(row);
    queue.push({ op: 'insert', table, row });
    emit(); flush();
    return row;
  }
  function update(table, id, patch) {
    const row = db[table].find(r => r.id === id);
    if (!row) return;
    Object.assign(row, patch);
    queue.push({ op: 'update', table, id, patch });
    emit(); flush();
  }
  function removeLocal(table, id) {
    db[table] = db[table].filter(r => r.id !== id);
    (CHILD[table] || []).forEach(c => db[c].filter(r => r[FK[table]] === id).forEach(r => removeLocal(c, r.id)));
  }
  function remove(table, id) {
    removeLocal(table, id);
    queue.push({ op: 'delete', table, id });
    emit(); flush();
  }

  // ---------- Cloud sync ----------
  let flushing = false;
  async function flush() {
    if (!sb || !me || flushing || !navigator.onLine) return;
    flushing = true;
    while (queue.length) {
      const q = queue[0];
      let res;
      if (q.op === 'insert') res = await sb.from(q.table).insert(q.row);
      else if (q.op === 'update') res = await sb.from(q.table).update(q.patch).eq('id', q.id);
      else res = await sb.from(q.table).delete().eq('id', q.id);
      if (res.error && /fetch|network/i.test(res.error.message)) break; // still offline: keep it queued
      if (res.error) console.warn('Sync rejected', q, res.error.message); // not allowed: drop it, pull will correct
      queue.shift(); save('queue', queue);
    }
    flushing = false;
    if (!queue.length) pull();
  }

  let pulling = false, pullAgain = false;
  async function pull() {
    if (!sb || !me || !navigator.onLine) return;
    if (queue.length) { flush(); return; } // local changes not sent yet: send them first (flush pulls when done), so a pull can never undo them
    if (pulling) { pullAgain = true; return; }
    pulling = true;
    try {
      const next = {};
      for (const t of ['projects', 'roles', 'members', 'invites', 'steps', 'cards', 'comments', 'attachments', ...V2]) {
        const { data, error } = await sb.from(t).select('*');
        if (error && V2.includes(t) && error.code === 'PGRST205') { v2Missing = true; next[t] = db[t] || []; continue; } // keep them on this computer until the SQL is run
        if (error) throw error;
        next[t] = data;
      }
      const ids = [...new Set([me.id, ...next.members.map(m => m.user_id), ...next.invites.map(i => i.invited_by)].filter(Boolean))];
      const { data: profs } = await sb.from('profiles').select('*').in('id', ids);
      next.profiles = profs || [];
      if (!queue.length) { db = next; status = 'online'; emit(); }
    } catch (e) { status = e?.code === 'PGRST205' ? 'nosetup' : 'offline'; emit(); }
    pulling = false;
    if (pullAgain) { pullAgain = false; pull(); }
  }

  let channel = null;
  function listen() {
    if (!sb || channel) return;
    let t;
    channel = sb.channel('myprojects')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { clearTimeout(t); t = setTimeout(pull, 250); })
      .subscribe();
  }

  async function checkSetup() {
    if (!navigator.onLine) return;
    const { error } = await sb.from('profiles').select('id').limit(1);
    if (error?.code === 'PGRST205') { status = 'nosetup'; emit(); }
  }
  async function start() {
    if (!sb) { emit(); return; }
    // Stay signed in until you've been away 30 days in a row
    const IDLE = 30 * 864e5, touch = () => { try { localStorage.setItem('nx.active', Date.now()); } catch {} };
    let last = 0; try { last = Number(localStorage.getItem('nx.active')) || 0; } catch {}
    if (me && last && Date.now() - last > IDLE) await signOut();
    touch(); setInterval(touch, 60000); addEventListener('focus', touch); document.addEventListener('visibilitychange', touch);
    await checkSetup();
    const { data } = await sb.auth.getSession();
    if (data.session) await setUser(data.session.user);
    else if (me && navigator.onLine) { me = null; save('me', null); emit(); } // the saved login is gone: ask for it again
    addEventListener('online', () => { status = 'syncing'; emit(); flush(); pull(); });
    addEventListener('offline', () => { status = 'offline'; emit(); });
    // Safety net alongside live updates: refresh when the window is focused and once a minute
    addEventListener('focus', () => { flush(); pull(); });
    setInterval(() => { flush(); pull(); }, 60000);
  }
  async function setUser(user) {
    let username = user.user_metadata?.username;
    if (navigator.onLine) {
      const { data } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (data) username = data.username;
    }
    me = { id: user.id, username };
    save('me', me);
    listen(); flush(); pull(); emit();
  }

  // ---------- Accounts ----------
  async function signUp(email, password, username) {
    username = String(username || '').replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return 'Username must be 3-20 letters, numbers or _';
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: WEB } });
    if (error) return /database error/i.test(error.message) ? 'That username is taken' : error.message;
    if (!data.session) return 'Check your email to confirm, then sign in';
    await setUser(data.user);
  }
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await setUser(data.user);
  }
  // Email codes: a one-time code (also a link) is emailed; the app takes the code
  async function requestCode(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: WEB } });
    return error ? (/signups not allowed|not found/i.test(error.message) ? 'No account with that email.' : error.message) : '';
  }
  async function verifyCode(email, token) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return /expired|invalid/i.test(error.message) ? 'That code is wrong or expired. Ask for a new one.' : error.message;
    await setUser(data.user); return '';
  }
  async function requestReset(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: WEB });
    return error ? error.message : '';
  }
  async function resetPassword(email, token, password) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) return /expired|invalid/i.test(error.message) ? 'That code is wrong or expired. Ask for a new one.' : error.message;
    const up = await sb.auth.updateUser({ password });
    if (up.error) return up.error.message;
    await setUser(data.user); return '';
  }
  // Delete ALL of this account's data: personal data, and every project you own (friends lose those too).
  // Needs a connection so the cloud copy really goes; otherwise it would just come back on the next sync.
  async function resetEverything() {
    if (!sb || !me) return 'Sign in first.';
    if (!navigator.onLine) return 'Connect to the internet first, so your account copy is wiped too.';
    const id = me.id, tries = [
      sb.from('tasks').delete().eq('owner', id), sb.from('events').delete().eq('owner', id), sb.from('user_kv').delete().eq('owner', id),
      sb.from('projects').delete().eq('owner', id), sb.from('update_seen').delete().eq('user_id', id), sb.from('members').delete().eq('user_id', id)
    ];
    const res = await Promise.all(tries);
    const bad = res.find((r, i) => r.error && i < 4 && r.error.code !== 'PGRST205');
    if (bad) return 'Could not delete everything: ' + bad.error.message;
    queue = []; db = Object.fromEntries(TABLES.map(t => [t, []])); db.profiles.push({ id, username: me.username });
    emit();
    if (typeof Personal !== 'undefined') Personal.resetLocal();
    return '';
  }
  async function signOut() {
    await sb.auth.signOut();
    me = null; db = Object.fromEntries(TABLES.map(t => [t, []])); queue = [];
    save('me', null); emit();
  }

  // ---------- Queries ----------
  const byPos = (a, b) => a.position - b.position;
  const get = (t, id) => db[t].find(r => r.id === id);
  const myProjects = () => db.projects.filter(p => p.owner === me?.id || db.members.some(m => m.project_id === p.id && m.user_id === me?.id))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const steps = pid => db.steps.filter(s => s.project_id === pid).sort(byPos);
  const cards = sid => db.cards.filter(c => c.step_id === sid).sort(byPos);
  const projectCards = pid => db.cards.filter(c => c.project_id === pid);
  const roles = pid => db.roles.filter(r => r.project_id === pid);
  const members = pid => db.members.filter(m => m.project_id === pid);
  const comments = cid => db.comments.filter(c => c.card_id === cid).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const attachments = cid => db.attachments.filter(a => a.card_id === cid);
  const myInvites = () => db.invites.filter(i => i.username === me?.username);
  const projectInvites = pid => db.invites.filter(i => i.project_id === pid);
  // Profile picture letters: first initial, or first + last if the username has two names
  // ("jackson" -> J, "jackson_schroeder" / "JacksonSchroeder" / "jackson.s" -> JS)
  function initials(name = '') {
    const parts = String(name).replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_.\-\d]+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  const username = uid => db.profiles.find(p => p.id === uid)?.username || 'someone';
  function can(pid, perm) {
    const p = get('projects', pid);
    if (!p || !me) return false;
    if (p.owner === me.id) return true;
    const m = db.members.find(x => x.project_id === pid && x.user_id === me.id);
    return !!get('roles', m?.role_id)?.perms?.[perm];
  }
  // Progress = share of cards that have reached the last step
  function progress(pid) {
    const all = projectCards(pid), last = steps(pid).at(-1);
    const finished = last ? all.filter(c => c.step_id === last.id).length : 0;
    return { finished, total: all.length, pct: all.length ? Math.round(finished / all.length * 100) : 0 };
  }
  const nextPos = list => (list.length ? list[list.length - 1].position + 1 : 1);

  // ---------- Actions ----------
  function startProject(name) {
    const p = insert('projects', { name, owner: me.id, created_at: now() });
    const rs = DEFAULT_ROLES.map(r => insert('roles', { project_id: p.id, name: r.name, perms: r.perms }));
    insert('members', { project_id: p.id, user_id: me.id, role_id: rs[0].id });
    ['To do', 'In progress', 'Done'].forEach((n, i) => insert('steps', { project_id: p.id, name: n, position: i + 1 }));
    return p;
  }
  const addStep = (pid, name) => insert('steps', { project_id: pid, name, position: nextPos(steps(pid)) });
  const addCard = (pid, sid, title) => insert('cards', {
    project_id: pid, step_id: sid, title, description: '', assignees: [],
    position: nextPos(cards(sid)), created_by: me.id, created_at: now(), updated_at: now()
  });
  // Place an item between its new neighbours (fractional positions keep moves to a single row update)
  function between(list, index) {
    const a = list[index - 1]?.position, b = list[index]?.position;
    return a == null && b == null ? 1 : a == null ? b - 1 : b == null ? a + 1 : (a + b) / 2;
  }
  function moveCard(cid, sid, index) {
    const list = cards(sid).filter(c => c.id !== cid);
    update('cards', cid, { step_id: sid, position: between(list, index) });
  }
  function moveStep(id, pid, index) {
    const list = steps(pid).filter(s => s.id !== id);
    update('steps', id, { position: between(list, index) });
  }
  // Updates feed: every change in a project is noted so members can catch up; 'seen' is tracked per person
  const note = (pid, text) => me && insert('updates', { project_id: pid, user_id: me.id, text, created_at: now() });
  const updates = pid => db.updates.filter(u => u.project_id === pid).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const seenIds = () => new Set(db.update_seen.filter(x => x.user_id === me?.id).map(x => x.update_id));
  const unread = pid => { const seen = seenIds(); return updates(pid).filter(u => u.user_id !== me?.id && !seen.has(u.id)); };
  function markSeen(pid, ids) { const seen = seenIds(); ids.filter(id => !seen.has(id)).forEach(id => insert('update_seen', { user_id: me.id, update_id: id, project_id: pid })); }
  const milestones = pid => db.milestones.filter(m => m.project_id === pid).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const comment = (card, body) => insert('comments', { project_id: card.project_id, card_id: card.id, user_id: me.id, body, created_at: now() });
  function invite(pid, uname, roleId) {
    return insert('invites', { project_id: pid, project_name: get('projects', pid).name, username: uname, role_id: roleId, invited_by: me.id, created_at: now() });
  }
  async function findUser(uname) {
    if (!sb) return null;
    const { data } = await sb.from('profiles').select('id, username').eq('username', uname).maybeSingle();
    return data;
  }
  function acceptInvite(inv) {
    insert('members', { project_id: inv.project_id, user_id: me.id, role_id: inv.role_id });
    remove('invites', inv.id);
  }

  async function attach(card, file) {
    const path = `${card.project_id}/${card.id}/${uuid()}-${file.name}`;
    if (isImage(file.name) && imageUsage() + file.size > IMG_LIMIT) return LIMIT_MSG;
    if (sb) {
      if (!navigator.onLine) return 'Files can only be attached while online';
      const { error } = await sb.storage.from('attachments').upload(path, file);
      if (error) return error.message;
      insert('attachments', { project_id: card.project_id, card_id: card.id, path, name: file.name, size: file.size, uploaded_by: me.id, created_at: now() });
    } else {
      if (file.size > 2e6) return 'Local mode keeps files on this computer only, up to 2 MB. Connect Supabase for bigger files.';
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
      insert('attachments', { project_id: card.project_id, card_id: card.id, path: data, name: file.name, size: file.size, uploaded_by: me.id, created_at: now() });
    }
  }
  async function fileUrl(a) {
    if (!sb) return a.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(a.path, 3600);
    return data?.signedUrl;
  }
  // ---------- Pictures: everyone gets 30 MB of images (project pictures + image attachments) ----------
  const IMG_LIMIT = 30 * 1024 * 1024, IMG_RE = /\.(png|jpe?g|gif|webp|bmp|heic|heif|avif|svg)$/i;
  const isImage = name => IMG_RE.test(name || '');
  const LIMIT_MSG = 'You’ve hit your 30 MB image limit. Remove personal images from myNexus to add more.';
  const picRow = pid => db.milestones.find(m => m.project_id === pid && m.title.startsWith('§pic|'));
  const picSize = row => (row ? Number(row.title.split('|')[2]) || 0 : 0);
  function imageUsage() {
    const id = me?.id;
    return db.attachments.filter(a => a.uploaded_by === id && isImage(a.name)).reduce((s, a) => s + (a.size || 0), 0)
      + db.milestones.filter(m => m.created_by === id && m.title.startsWith('§pic|')).reduce((s, m) => s + picSize(m), 0);
  }
  // A project's title picture is stored as a tagged row: "§pic|<path>|<bytes>" (no extra database setup)
  async function setProjectPic(pid, file) {
    const old = picRow(pid), used = imageUsage() - (old && old.created_by === me?.id ? picSize(old) : 0);
    if (used + file.size > IMG_LIMIT) return LIMIT_MSG;
    let path;
    if (sb) {
      if (!navigator.onLine) return 'Pictures can only be added while online';
      path = `${pid}/pic/${uuid()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await sb.storage.from('attachments').upload(path, file);
      if (error) return error.message;
    } else path = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    if (old) await removeProjectPic(pid);
    insert('milestones', { project_id: pid, title: `§pic|${path}|${file.size}`, due: now().slice(0, 10), done: false, created_by: me.id, created_at: now() });
    return '';
  }
  async function removeProjectPic(pid) {
    const row = picRow(pid); if (!row) return;
    const path = row.title.split('|')[1];
    if (sb && !path.startsWith('data:')) await sb.storage.from('attachments').remove([path]);
    remove('milestones', row.id);
  }
  const picCache = new Map();
  async function picUrl(row) {
    const path = row.title.split('|')[1];
    if (!sb || path.startsWith('data:')) return path;
    const hit = picCache.get(path); if (hit && hit.at > Date.now() - 50 * 60 * 1000) return hit.url;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) picCache.set(path, { url: data.signedUrl, at: Date.now() });
    return data?.signedUrl;
  }

  async function removeAttachment(a) {
    if (sb) await sb.storage.from('attachments').remove([a.path]);
    remove('attachments', a.id);
  }

  return {
    PERMS, cloud: !!sb, client: sb, get me() { return me; }, get status() { return queue.length && status === 'online' ? 'syncing' : status; }, get ready() { return status !== 'nosetup'; },
    subscribe: f => (listeners.add(f), () => listeners.delete(f)), start, signUp, signIn, signOut, requestCode, verifyCode, requestReset, resetPassword, resetEverything, kick: emit,
    get, insert, update, remove, myProjects, rows: t => db[t], steps, cards, projectCards, roles, members, comments, attachments,
    myInvites, projectInvites, note, updates, unread, markSeen, seenIds, milestones, get v2Missing() { return v2Missing; }, username, initials, can, progress, startProject, addStep, addCard, moveCard, moveStep, comment,
    invite, findUser, acceptInvite, attach, fileUrl, removeAttachment,
    projectPic: picRow, picUrl, setProjectPic, removeProjectPic, imageUsage, IMG_LIMIT, isImage
  };
})();
