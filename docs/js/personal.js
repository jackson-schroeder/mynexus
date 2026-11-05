// Personal data shared by myTodo, myCalendar, myRecents and the dashboard.
// Offline-first: every change is saved on this computer right away and queued. When you're signed in to your
// myNexus account (same account as myProjects) the queue is pushed to Supabase and fresh data is pulled,
// so the phone app will see the same tasks, events and recents.
const Personal = (() => {
  const KEY = 'me.db';
  const blank = () => ({ owner: null, tasks: [], events: [], activity: [], prefs: { hidden: [] }, kv: {}, queue: [] });
  const load = () => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return blank(); } };
  let db = load();
  // Bring over recents saved before accounts existed
  try { const old = JSON.parse(localStorage.getItem('activity')); if (old && !db.activity.length) db.activity = old; localStorage.removeItem('activity'); } catch {}
  const listeners = new Set();
  let queued = false;
  function emit() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; listeners.forEach(f => f()); });
  }
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());

  // ---------- Demo data ----------
  // Shown only where you have no real data yet (and "Demo data" is on in mySettings). Never saved or synced,
  // and it disappears for a feature as soon as you add something real there.
  const demoOn = () => db.prefs.demo === true; // example data is off unless you turn it on
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const ago = h => Date.now() - h * 36e5;
  const DEMO_TASKS = () => [
    ['Finish lab report', -1, null, false], ['Pay rent', 0, null, false], ['Email professor', 0, null, true], ['Gym — push day', 0, '18:00', false],
    ['Grocery run', 1, null, false], ['Call mom', 3, null, false], ['Read 20 pages', null, null, false], ['Clean garage', null, null, false]
  ].map(([title, d, time, done], i) => ({ id: 'demo-t' + i, demo: true, title, notes: '', date: d === null ? null : day(d), time, priority: 0, done, doneAt: done ? ago(2) : null, createdAt: ago(48 + i) }));
  const DEMO_EVENTS = () => [
    ['Team sync', 0, '14:00', '15:00', 3], ['Dinner with Sam', 0, '19:00', '20:30', 2], ['Dentist', 1, '10:00', '11:00', 5],
    ['Study group', 3, '16:00', '17:30', 1], ['Weekend trip', 5, null, null, 4]
  ].map(([title, d, start, end, color], i) => ({ id: 'demo-e' + i, demo: true, title, notes: '', date: day(d), allDay: !start, start: start || '09:00', end: end || '10:00', color }));
  const DEMO_ACTIVITY = () => [['Fitness/Lifting', 'Logged Push workout', 3], ['Time/Todo', 'Completed “Email professor”', 5], ['Time/Calendar', 'Added event “Dentist”', 26]]
    .map(([path, text, h]) => ({ path, text, at: ago(h), demo: true }));
  const shown = (real, demo) => (real.length || !demoOn() ? real : demo());

  // ---------- Cloud mapping (app fields <-> table columns) ----------
  const MAP = {
    tasks: { title: 'title', notes: 'notes', date: 'due_date', time: 'due_time', priority: 'priority', done: 'done', doneAt: 'done_at', createdAt: 'created_at' },
    events: { title: 'title', notes: 'notes', date: 'ev_date', allDay: 'all_day', start: 'start_time', end: 'end_time', color: 'color' }
  };
  const toRow = (t, o) => Object.fromEntries(Object.entries(o).filter(([k]) => k === 'id' || MAP[t][k]).map(([k, v]) => [k === 'id' ? 'id' : MAP[t][k], v]));
  const fromRow = (t, r) => ({ id: r.id, ...Object.fromEntries(Object.entries(MAP[t]).map(([k, c]) => [k, r[c]])) });

  // ---------- Local changes (queued for the cloud) ----------
  function push(op) { db.queue.push(op); emit(); flush(); }
  function insert(t, row) { db[t].push(row); push({ op: 'insert', t, row: toRow(t, row) }); return row; }
  function update(t, id, patch) {
    const r = db[t].find(x => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    push({ op: 'update', t, id, patch: toRow(t, patch) });
  }
  function remove(t, id) { db[t] = db[t].filter(x => x.id !== id); push({ op: 'delete', t, id }); }

  // Tasks: { id, title, notes, date 'YYYY-MM-DD'|null, time 'HH:MM'|null, priority 0-3, done, doneAt, createdAt }
  function addTask(t) {
    const task = insert('tasks', { id: crypto.randomUUID(), title: '', notes: '', date: null, time: null, priority: 0, done: false, doneAt: null, createdAt: Date.now(), ...t });
    logActivity('Time/Todo', `Added task “${task.title}”`);
    return task;
  }
  const updateTask = (id, patch) => { update('tasks', id, patch); if ('done' in patch && typeof CardLink !== 'undefined') CardLink.taskChanged(id); };
  function toggleTask(id) {
    const t = db.tasks.find(x => x.id === id);
    if (!t) return;
    update('tasks', id, { done: !t.done, doneAt: !t.done ? Date.now() : null });
    if (typeof CardLink !== 'undefined') CardLink.taskChanged(id); // a linked project card follows
    if (t.done) logActivity('Time/Todo', `Completed “${t.title}”`);
  }
  const removeTask = id => { remove('tasks', id); if (typeof CardLink !== 'undefined') CardLink.taskRemoved(id); };
  const clearCompleted = () => db.tasks.filter(t => t.done).forEach(t => remove('tasks', t.id));

  // Events: { id, title, notes, date, allDay, start 'HH:MM', end 'HH:MM', color 1-5 }
  function addEvent(e) {
    const ev = insert('events', { id: crypto.randomUUID(), title: '', notes: '', date: today(), allDay: false, start: '09:00', end: '10:00', color: 1, ...e });
    logActivity('Time/Calendar', `Added event “${ev.title}”`);
    return ev;
  }
  const updateEvent = (id, patch) => update('events', id, patch);
  const removeEvent = id => remove('events', id);

  // myRecents: newest first, last 50, saved to your account as one value
  function logActivity(path, text) {
    db.activity = [{ path, text, at: Date.now() }, ...db.activity].slice(0, 50);
    saveKv('activity');
  }

  // Per-account values stored as one row each (only the latest needs uploading)
  function saveKv(key) { db.queue = db.queue.filter(q => !(q.op === 'kv' && q.key === key)); push({ op: 'kv', key }); }
  // Any other synced value (e.g. 'lift.splits', 'lift.sessions'): read with getKv, write with setKv
  const getKv = (key, fallback) => (key in db.kv ? db.kv[key] : fallback);
  function setKv(key, value) { db.kv[key] = value; saveKv(key); }
  // App preferences, e.g. which tabs are hidden
  function setPrefs(patch) { db.prefs = { ...db.prefs, ...patch }; saveKv('prefs'); }

  // ---------- Sync ----------
  const hasStore = () => typeof Store !== 'undefined';
  const sb = () => (hasStore() && Store.client && Store.me ? Store.client : null);
  let flushing = false, missing = false;
  async function flush() {
    const c = sb();
    if (!c || flushing || !navigator.onLine || db.owner !== Store.me.id) return;
    flushing = true;
    while (db.queue.length) {
      const q = db.queue[0];
      let res;
      if (q.op === 'insert') res = await c.from(q.t).upsert({ ...q.row, owner: Store.me.id });
      else if (q.op === 'update') res = await c.from(q.t).update(q.patch).eq('id', q.id);
      else if (q.op === 'delete') res = await c.from(q.t).delete().eq('id', q.id);
      else res = await c.from('user_kv').upsert({ owner: Store.me.id, key: q.key, value: q.key in db.kv ? db.kv[q.key] : db[q.key], updated_at: new Date().toISOString() });
      if (res.error && /fetch|network/i.test(res.error.message)) break; // offline again: keep the rest queued
      if (res.error?.code === 'PGRST205') { missing = true; emit(); break; } // tables not created yet: keep everything queued
      if (res.error) console.warn('Personal sync rejected', q, res.error.message);
      missing = false;
      db.queue.shift();
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    }
    flushing = false;
    if (!db.queue.length) pull();
  }
  async function pull() {
    const c = sb();
    if (!c || !navigator.onLine || db.queue.length) return;
    const [t, e, kv] = await Promise.all([c.from('tasks').select('*'), c.from('events').select('*'), c.from('user_kv').select('*')]);
    missing = [t, e, kv].some(r => r.error?.code === 'PGRST205');
    if (t.error || e.error || kv.error || db.queue.length) return emit();
    db.tasks = t.data.map(r => fromRow('tasks', r));
    db.events = e.data.map(r => fromRow('events', r));
    db.activity = kv.data.find(r => r.key === 'activity')?.value || db.activity;
    db.prefs = kv.data.find(r => r.key === 'prefs')?.value || db.prefs;
    kv.data.filter(r => r.key !== 'activity' && r.key !== 'prefs').forEach(r => (db.kv[r.key] = r.value));
    emit();
  }
  // When an account signs in: the first time, upload what's on this computer; after that just sync.
  let user = null, channel = null;
  function onAuth() {
    const id = Store.me?.id || null;
    if (!Store.client || id === user) return;
    user = id;
    if (channel) { Store.client.removeChannel(channel); channel = null; }
    if (!id) return;
    if (db.owner !== id) {
      if (db.owner) { db.tasks = []; db.events = []; db.activity = []; db.prefs = { hidden: [] }; db.kv = {}; db.queue = []; } // another account's data: start clean
      else db.queue = [...db.tasks.map(r => ({ op: 'insert', t: 'tasks', row: toRow('tasks', r) })), ...db.events.map(r => ({ op: 'insert', t: 'events', row: toRow('events', r) })), { op: 'kv', key: 'activity' }, { op: 'kv', key: 'prefs' }, ...Object.keys(db.kv).map(key => ({ op: 'kv', key }))];
      db.owner = id; emit();
    }
    let timer;
    channel = Store.client.channel('personal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => { clearTimeout(timer); timer = setTimeout(pull, 250); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { clearTimeout(timer); timer = setTimeout(pull, 250); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kv' }, () => { clearTimeout(timer); timer = setTimeout(pull, 250); })
      .subscribe();
    flush(); pull();
  }
  function start() {
    if (!hasStore()) return;
    Store.subscribe(onAuth); onAuth();
    addEventListener('online', flush);
    addEventListener('focus', () => { flush(); pull(); });
    setInterval(() => { flush(); pull(); }, 60000);
  }

  const byTime = (a, b) => (a.time || a.start || '99') < (b.time || b.start || '99') ? -1 : (a.time || a.start || '99') > (b.time || b.start || '99') ? 1 : (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt;
  const tasksOn = date => shown(db.tasks, DEMO_TASKS).filter(t => t.date === date).sort(byTime);
  const eventsOn = date => shown(db.events, DEMO_EVENTS).filter(e => e.date === date).sort((a, b) => (a.allDay ? -1 : b.allDay ? 1 : a.start < b.start ? -1 : 1));

  // Wipe everything personal on this device (the cloud copy is deleted by Store.resetEverything first)
  function resetLocal() { db = blank(); db.owner = Store.me?.id ?? null; emit(); }

  return {
    resetLocal, ymd, today, byTime, start, subscribe: f => (listeners.add(f), () => listeners.delete(f)),
    get tasks() { return shown(db.tasks, DEMO_TASKS); }, get events() { return shown(db.events, DEMO_EVENTS); }, get activity() { return shown(db.activity, DEMO_ACTIVITY); },
    get demoOn() { return demoOn(); }, isDemo: kind => demoOn() && !db[kind].length, get prefs() { return db.prefs; }, setPrefs, getKv, setKv,
    get pending() { return db.queue.length; }, get cloudMissing() { return missing; }, get synced() { return !!sb() && db.owner === Store.me?.id; },
    task: id => shown(db.tasks, DEMO_TASKS).find(t => t.id === id), event: id => shown(db.events, DEMO_EVENTS).find(e => e.id === id),
    addTask, updateTask, toggleTask, removeTask, clearCompleted, addEvent, updateEvent, removeEvent, tasksOn, eventsOn, logActivity
  };
})();
