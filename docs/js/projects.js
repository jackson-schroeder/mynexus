// myProjects UI: project list, kanban board, card details, people and roles.
// Renders into any element via Projects.mount(el) — used by the myNexus tab and the standalone myProjects app.
const Projects = (() => {
  let root = null, view = { name: 'list' }, modal = null, dragging = false, pendingRender = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const title = n => `<span class="my">my</span><span class="nm">${n}</span>`;
  const initials = u => esc(Store.initials(u));
  const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  const size = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
  const log = text => window.logActivity?.('Projects', text); // feeds myRecents in myNexus
  const STATUS = { local: 'On this computer only', online: 'Synced', syncing: 'Syncing…', offline: 'Offline — changes saved, will sync', nosetup: 'Cloud database not set up' };

  function mount(el) {
    root = el;
    if (!root.dataset.bound) { bind(); root.dataset.bound = 1; }
    render();
  }
  Store.subscribe(() => {
    if (!root || dragging) return;
    const a = document.activeElement;
    if (a && root.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) { pendingRender = true; return; }
    render();
    modal?.refresh?.();
  });

  // ---------- Views ----------
  function render() {
    if (!root) return;
    pendingRender = false;
    const me = Store.me;
    if (Store.cloud && !me) root.innerHTML = authView();
    else if (view.name === 'board' && Store.get('projects', view.id)) root.innerHTML = boardView(view.id);
    else { view = { name: 'list' }; root.innerHTML = listView(); }
    if (view.tab === 'updates') setTimeout(watchSeen); // start noticing which unread updates you actually look at
  }
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>';

  function bar(left) {
    const me = Store.me;
    return `<div class="pj-bar">${left}<div class="pj-spacer"></div>
      <span class="pj-status ${Store.status}">${STATUS[Store.status]}</span>
      ${me && Store.cloud ? `<span class="pj-me">@${esc(me.username)}</span><button class="tile pj-btn" data-act="signout">Sign out</button>` : ''}</div>`;
  }

  function authView() {
    return `<div class="pj-auth tile">
      <h2>${title('Projects')}</h2><p class="p">Sign in to share projects with your friends.</p>
      ${Store.ready ? '' : `<p class="pj-err">The cloud database isn't set up yet. Run supabase/schema.sql in the Supabase SQL Editor, then reopen the app.</p>`}
      <div class="pj-tabs"><button class="tile pj-btn on" data-act="authmode" data-mode="in">Sign in</button><button class="tile pj-btn" data-act="authmode" data-mode="up">Create account</button></div>
      <input class="pj-in" id="pjUser" placeholder="Username (letters, numbers, _)" hidden>
      <input class="pj-in" id="pjEmail" type="email" placeholder="Email">
      <div class="pw-wrap"><input class="pj-in" id="pjPass" type="password" placeholder="Password (6+ characters)"><button type="button" class="pw-eye" data-eye aria-label="Show password"></button></div>
      <div class="pw-wrap" id="pjPass2Wrap" hidden><input class="pj-in" id="pjPass2" type="password" placeholder="Type your password again"><button type="button" class="pw-eye" data-eye aria-label="Show password"></button></div>
      <button class="tile pj-btn primary" data-act="auth" data-mode="in">Sign in</button>
      ${AuthFlow.html()}
      <div class="pj-err" id="pjErr"></div></div>`;
  }

  function listView() {
    const invites = Store.myInvites();
    const ps = Store.myProjects();
    return `${bar(`<button class="tile pj-btn primary" data-act="new">+ Start a Project</button>`)}
      ${invites.length ? `<h3 class="pj-h">Invites</h3><div class="pj-grid">${invites.map(i => `
        <div class="tile pj-proj"><div class="pj-pname">${esc(i.project_name)}</div>
          <div class="p">@${esc(Store.username(i.invited_by))} invited you as ${esc(Store.get('roles', i.role_id)?.name || 'member')}</div>
          <div class="pj-row"><button class="tile pj-btn primary" data-act="accept" data-id="${i.id}">Join</button><button class="tile pj-btn" data-act="decline" data-id="${i.id}">Decline</button></div></div>`).join('')}</div>` : ''}
      <div class="pj-grid">${ps.map(projectTile).join('') || `<div class="pj-empty p">No projects yet. Start one to get a board.</div>`}</div>`;
  }

  function projectTile(p) {
    const cs = Store.projectCards(p.id), { pct } = Store.progress(p.id);
    return `<div class="tile pj-proj" data-act="open" data-id="${p.id}">
      <div class="pj-pname">${esc(p.name)}</div>
      <div class="p">${Store.steps(p.id).length} steps · ${cs.length} cards · ${Store.members(p.id).length} people</div>
      <div class="pj-row"><div class="prog"><b style="width:${pct}%"></b></div><span class="p">${pct}%</span></div></div>`;
  }

  function boardView(pid) {
    const p = Store.get('projects', pid);
    const canSteps = Store.can(pid, 'edit_steps'), canCards = Store.can(pid, 'create_cards'), canMove = Store.can(pid, 'move_cards');
    const inTl = view.tab === 'timeline' && view.tlPhase, phaseSet = inTl ? phaseIds(pid, view.tlPhase) : null;
    const cols = Store.steps(pid).map(s => {
      const cs = Store.cards(s.id).filter(c => !phaseSet || phaseSet.has(c.id));
      return `<div class="pj-col tile" data-step="${s.id}">
        <div class="pj-colhead" ${canSteps ? 'draggable="true"' : ''} data-dragstep="${s.id}">
          <input class="pj-stepname" data-step-name="${s.id}" value="${esc(s.name)}" ${canSteps ? '' : 'readonly'}>
          <span class="chip">${cs.length}</span>
          ${canSteps ? `<button class="pj-x" data-act="delstep" data-id="${s.id}" title="Delete step">×</button>` : ''}
        </div>
        <div class="pj-cards" data-drop="${s.id}">${cs.map(c => cardTile(c, canMove)).join('')}</div>
        ${canCards ? `<button class="tile pj-btn pj-add" data-act="addcard" data-id="${s.id}">+ Add card</button>` : ''}
      </div>`;
    }).join('');
    const tab = view.tab || 'cards', nUnread = Store.unread(pid).length;
    const tabs = `<div class="td-seg pj-ptabs">${[['cards', 'Cards'], ['timeline', 'Timeline'], ['updates', 'Updates']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="ptab" data-tab="${k}">${l}${k === 'updates' && nUnread ? ` <span class="pj-badge">${nUnread}</span>` : ''}</button>`).join('')}</div>`;
    return `${bar(`<button class="tile pj-btn" data-act="back">← All projects</button>${tabs}
        <input class="pj-title" data-project-name="${pid}" value="${esc(p.name)}" ${Store.can(pid, 'manage_roles') ? '' : 'readonly'}>
        <button class="tile pj-btn" data-act="people">People</button>
        ${Store.can(pid, 'manage_roles') ? `<button class="tile pj-btn" data-act="roles">Roles</button>` : ''}`)}
      ${tab === 'timeline' && !inTl ? timelineView(pid) : tab === 'updates' ? updatesView(pid) : `${inTl ? `<div class="pj-row"><button class="tile pj-btn" data-act="tlback">← Timeline</button><h3>${esc(phaseName(pid, view.tlPhase))}</h3></div>` : ''}<div class="pj-board" data-board="${pid}">${cols}
        ${canSteps ? `<button class="tile pj-col pj-newstep" data-act="addstep">+ Add step</button>` : ''}</div>`}`;
  }

  // Timeline: a start → finish range split into weeks. Drag across weeks to group them into bigger portions,
  // then drag cards onto a portion. Stored in the milestones table as tagged rows, so no extra database setup:
  //   "§range|<start>" due=<end>   ·   "§part|<start>|<name>" due=<end>   ·   "§card|<cardId>" due=<a day inside its portion>
  const DAY = 864e5, ymdOf = d => new Date(d).toISOString().slice(0, 10), addDays = (d, n) => ymdOf(new Date(d + 'T12:00').getTime() + n * DAY);
  const fmtD = d => new Date(d + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  function tlData(pid) {
    const rows = Store.milestones(pid), range = rows.find(m => m.title.startsWith('§range|'));
    if (!range) return { rows };
    const start = range.title.split('|')[1], end = range.due, weeks = [];
    for (let d = start; d <= end && weeks.length < 156; d = addDays(d, 7)) weeks.push({ start: d, end: addDays(d, 6) > end ? end : addDays(d, 6) });
    const parts = rows.filter(m => m.title.startsWith('§part|')).map(m => { const [, ps, ...n] = m.title.split('|'); return { id: m.id, start: ps, end: m.due, name: n.join('|') }; });
    const portions = [];
    weeks.forEach((w, k) => {
      const p = parts.find(p => w.start >= p.start && w.start <= p.end), last = portions[portions.length - 1];
      if (p && last?.part === p) { last.end = w.end; last.n++; }
      else portions.push({ part: p || null, id: p?.id || 'w' + k, name: p ? p.name : 'Week ' + (k + 1), start: w.start, end: w.end, first: k, n: 1 });
    });
    const links = rows.filter(m => m.title.startsWith('§card|'));
    return { rows, range, start, end, weeks, parts, portions, links };
  }
  function timelineView(pid) {
    const canEdit = Store.can(pid, 'edit_cards'), today = ymdOf(Date.now()), t = tlData(pid);
    const v2 = Store.v2Missing ? '<p class="p pj-err">Timeline and Updates need one more database step: run supabase/projects-v2.sql in Supabase. Until then they stay on this computer.</p>' : '';
    if (!t.range) return `<div class="pj-tl">${v2}<div class="tile pj-empty-tl"><h3>Set up the timeline</h3>
        <p class="p">Pick when the project starts and when it should be finished. It splits into weeks you can group into bigger portions.</p>
        ${canEdit ? `<div class="pj-row tl-setup"><label class="p">Start <input class="pj-in" type="date" id="tlStart" value="${today}"></label><label class="p">Finish <input class="pj-in" type="date" id="tlEnd" value="${addDays(today, 55)}"></label><button class="tile pj-btn primary" data-act="tlcreate">Create timeline</button></div>` : '<p class="p">Ask someone who can edit cards to set it up.</p>'}</div></div>`;
    const me = Store.me?.id, mine = view.tlMine;
    const cards = Store.projectCards(pid).filter(c => !mine || c.assignees.includes(me));
    const where = c => { const l = t.links.find(l => l.title === '§card|' + c.id); return l && t.portions.find(p => l.due >= p.start && l.due <= p.end); };
    const chip = c => `<div class="tile tl-card" data-act="card" data-id="${c.id}" data-tcard="${c.id}" ${canEdit ? 'draggable="true"' : ''}><span class="it">${esc(c.title)}</span>
      ${c.assignees.map(u => `<span class="pj-av" title="@${esc(Store.username(u))}">${initials(Store.username(u))}</span>`).join('')}</div>`;
    const lastStep = Store.steps(pid).slice(-1)[0]?.id;
    const tile = (key, name, dates, list, now) => {
      const yours = list.filter(c => c.assignees.includes(me)).length, done = list.filter(c => c.step_id === lastStep).length;
      return `<div class="tile tl-phase${now ? ' now' : ''}" data-act="tlphase" data-id="${key}"><b>${esc(name)}</b><div class="p">${dates}</div>
        <div class="pj-row"><div class="prog"><b style="width:${list.length ? Math.round(done / list.length * 100) : 0}%"></b></div><span class="p">${list.length} card${list.length === 1 ? '' : 's'}${yours ? ` · ${yours} yours` : ''}</span></div></div>`;
    };
    const W = t.weeks.length, pos = d => Math.min(100, Math.max(0, (new Date(d + 'T12:00') - new Date(t.start + 'T12:00')) / DAY / ((new Date(t.end + 'T12:00') - new Date(t.start + 'T12:00')) / DAY + 1) * 100));
    return `<div class="pj-tl">${v2}
      <div class="pj-row tl-bar">
        <label class="p">Start <input class="pj-in" type="date" data-tlstart value="${t.start}" ${canEdit ? '' : 'disabled'}></label>
        <label class="p">Finish <input class="pj-in" type="date" data-tlend value="${t.end}" ${canEdit ? '' : 'disabled'}></label>
        <span class="p tl-hint">${W} weeks${canEdit ? ' · drag across weeks to group them' : ''}</span><span class="pj-spacer"></span>
        <div class="td-seg"><button class="${mine ? 'on' : ''}" data-act="tlmine" data-v="1">My cards</button><button class="${mine ? '' : 'on'}" data-act="tlmine" data-v="">All cards</button></div></div>
      <div class="tile tl-track" style="--w:${W}">
        <div class="tl-parts">${t.portions.map(p => `<div class="tl-part${p.part ? ' big' : ''}" style="grid-column:${p.first + 1} / span ${p.n}" title="${esc(p.name)} · ${fmtD(p.start)} – ${fmtD(p.end)}">
          ${p.part ? `<input class="tl-pname" data-partname="${p.id}" value="${esc(p.name)}" ${canEdit ? '' : 'readonly'}>${canEdit ? `<button class="pj-x" data-act="tlsplit" data-id="${p.id}" title="Split back into weeks">×</button>` : ''}` : `<span>Week ${p.first + 1}</span>`}</div>`).join('')}</div>
        <div class="tl-weeks">${t.weeks.map((w, k) => `<div class="tl-wk${today >= w.start && today <= w.end ? ' now' : ''}" data-wk="${k}" title="Week ${k + 1} · ${fmtD(w.start)} – ${fmtD(w.end)}">${k === 0 || w.start.slice(5, 7) !== t.weeks[k - 1].start.slice(5, 7) ? `<em>${new Date(w.start + 'T12:00').toLocaleDateString(undefined, { month: 'short' })}</em>` : ''}</div>`).join('')}
          ${today >= t.start && today <= t.end ? `<div class="pj-today" style="left:${pos(today)}%"><span>Today</span></div>` : ''}</div></div>
      <h3 class="pj-h">Phases</h3>
      <div class="tl-cols">${tile('all', 'Entire project', `${fmtD(t.start)} – ${fmtD(t.end)}`, cards)}${t.portions.map(p => tile(p.start, p.name, `${fmtD(p.start)} – ${fmtD(p.end)}`, cards.filter(c => where(c) === p), today >= p.start && today <= p.end)).join('')}${tile('none', 'Not placed yet', 'No phase', cards.filter(c => !where(c)))}</div></div>`;
  }
  function phaseIds(pid, key) { // ids of cards in a phase; null = the whole project
    if (!key || key === 'all') return null;
    const t = tlData(pid), p = t.portions.find(p => p.start === key), inP = c => { const l = t.links.find(l => l.title === '§card|' + c.id); return !!l && !!p && l.due >= p.start && l.due <= p.end; };
    return new Set(Store.projectCards(pid).filter(c => key === 'none' ? !t.links.some(l => l.title === '§card|' + c.id) : inP(c)).map(c => c.id));
  }
  function phaseName(pid, key) { return key === 'all' ? 'Entire project' : key === 'none' ? 'Not placed yet' : tlData(pid).portions.find(p => p.start === key)?.name || 'Phase'; }
  function tlGroup(a, b) { // weeks a..b (indices) become one portion, swallowing any portion they touch
    const t = tlData(view.id); let lo = t.weeks[Math.min(a, b)].start, hi = t.weeks[Math.max(a, b)].end;
    const hit = t.parts.filter(p => p.start <= hi && p.end >= lo);
    hit.forEach(p => { if (p.start < lo) lo = p.start; if (p.end > hi) hi = p.end; Store.remove('milestones', p.id); });
    const name = hit[0]?.name || 'Phase ' + (t.parts.length - hit.length + 1);
    Store.insert('milestones', { project_id: view.id, title: '§part|' + lo + '|' + name, due: hi, done: false, created_by: Store.me.id, created_at: new Date().toISOString() });
    Store.note(view.id, 'grouped ' + fmtD(lo) + ' – ' + fmtD(hi) + ' into “' + name + '”');
  }
  function tlAssign(cid, day) {
    const t = tlData(view.id), l = t.links.find(l => l.title === '§card|' + cid), c = Store.get('cards', cid);
    if (!day) { if (l) Store.remove('milestones', l.id); return; }
    if (l) Store.update('milestones', l.id, { due: day });
    else Store.insert('milestones', { project_id: view.id, title: '§card|' + cid, due: day, done: false, created_by: Store.me.id, created_at: new Date().toISOString() });
    const p = t.portions.find(p => day >= p.start && day <= p.end);
    if (p) Store.note(view.id, 'put “' + c.title + '” in ' + p.name);
  }



  // Updates: only unread ones first. Scrolling marks the ones you actually saw; they clear when you leave this tab.
  // Updates are also a group conversation: messages are stored as updates whose text starts with "msg:".
  let pendingSeen = new Set(), showPast = false, seenObserver = null, sentNow = new Set();
  const MSG = 'msg:';
  function updatesView(pid) {
    const me = Store.me?.id, seen = Store.seenIds();
    const unread = Store.unread(pid), mine = Store.updates(pid).filter(u => sentNow.has(u.id)); // what you just sent shows right away
    const past = Store.updates(pid).filter(u => (u.user_id === me || seen.has(u.id)) && !sentNow.has(u.id));
    const item = (u, cls) => {
      const msg = u.text.startsWith(MSG), who = `@${esc(Store.username(u.user_id))}`;
      return `<div class="tile up-item ${cls}${msg ? ' msg' : ''}${msg && u.user_id === me ? ' mine' : ''}" data-up="${u.id}"><span class="pj-av">${initials(Store.username(u.user_id))}</span>
        <div>${msg ? `<div class="p"><b>${who}</b> · ${ago(u.created_at)}</div><div class="it up-text">${esc(u.text.slice(MSG.length))}</div>`
          : `<div class="it"><b>${who}</b> ${esc(u.text)}</div><div class="p">${ago(u.created_at)}</div>`}</div></div>`;
    };
    const feed = [...unread, ...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return `<div class="up-wrap"><div class="up-list">
      ${Store.v2Missing ? '<p class="p pj-err">Run supabase/projects-v2.sql in Supabase to share updates with your team.</p>' : ''}
      ${feed.length ? `<div class="tm-gh">New · ${unread.length}</div>${feed.map(u => item(u, sentNow.has(u.id) ? 'past' : 'unread')).join('')}` : '<div class="p up-none">You\'re all caught up.</div>'}
      <button class="tile pj-btn up-past" data-act="pastupd">${showPast ? 'Hide past updates' : `View past updates (${past.length})`}</button>
      ${showPast ? past.map(u => item(u, 'past')).join('') : ''}</div>
      <div class="tile up-compose"><textarea class="pj-in" id="upMsg" rows="1" placeholder="Write an update to the group…"></textarea><button class="tile pj-btn primary" data-act="sendupd">Send</button></div></div>`;
  }
  function sendUpdate() {
    const box = root.querySelector('#upMsg'), text = box?.value.trim();
    if (!text) return;
    const row = Store.note(view.id, MSG + text);
    if (row) sentNow.add(row.id);
    box.value = '';
  }
  function watchSeen() {
    seenObserver?.disconnect();
    const list = root?.querySelector('.up-list');
    if (!list) return;
    seenObserver = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.intersectionRatio > .6) pendingSeen.add(e.target.dataset.up); }), { root: list, threshold: [.6] });
    list.querySelectorAll('.up-item.unread').forEach(el => seenObserver.observe(el));
  }
  function commitSeen() {
    if (pendingSeen.size && view.id) Store.markSeen(view.id, [...pendingSeen]);
    pendingSeen = new Set();
  }

  function cardTile(c, canMove) {
    const nc = Store.comments(c.id).length, na = Store.attachments(c.id).length;
    return `<div class="tile pj-card" data-act="card" data-id="${c.id}" ${canMove ? 'draggable="true"' : ''}>
      <div class="pj-ctitle">${esc(c.title)}</div>
      ${c.description ? `<div class="p pj-snip">${esc(c.description.slice(0, 120))}</div>` : ''}
      <div class="pj-meta">${c.assignees.map(u => `<span class="pj-av" title="@${esc(Store.username(u))}">${initials(Store.username(u))}</span>`).join('')}
        <span class="pj-spacer"></span>${na ? `<span class="p">📎 ${na}</span>` : ''}${nc ? `<span class="p">💬 ${nc}</span>` : ''}</div></div>`;
  }

  // ---------- Modals ----------
  function openModal(html, refresh, onClose) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'pj-overlay';
    el.innerHTML = `<div class="pj-modal glass">${html}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    el.addEventListener('pointerdown', e => { if (e.target === el) closeModal(); });
    modal = { el, refresh, onClose };
    queueMicrotask(() => modal?.el === el && refresh?.()); // after the caller has its handle on el
    return el;
  }
  function closeModal() {
    if (!modal) return;
    const { el, onClose } = modal;
    modal = null; onClose?.();
    el.classList.remove('on');
    setTimeout(() => el.remove(), 250);
    if (pendingRender) render();
  }

  function ask(label, placeholder, value, done) {
    const el = openModal(`<h3>${label}</h3><input class="pj-in" id="pjAsk" placeholder="${esc(placeholder)}" value="${esc(value || '')}">
      <div class="pj-row end"><button class="tile pj-btn" data-act="close">Cancel</button><button class="tile pj-btn primary" id="pjAskOk">OK</button></div>`);
    const inp = el.querySelector('#pjAsk');
    const ok = () => { const v = inp.value.trim(); if (v) { closeModal(); done(v); } };
    inp.focus(); inp.select();
    inp.addEventListener('keydown', e => e.key === 'Enter' && ok());
    el.querySelector('#pjAskOk').onclick = ok;
  }

  function cardModal(id) {
    const c = Store.get('cards', id), pid = c.project_id;
    const canEdit = Store.can(pid, 'edit_cards'), ro = canEdit ? '' : 'readonly';
    const el = openModal(`
      <div class="pj-row">
        <input class="pj-in pj-ctitlein" id="cTitle" value="${esc(c.title)}" ${ro}><button class="pj-x" data-act="close">×</button></div>
      <div class="pj-row"><div class="p" id="cStep"></div>${Store.can(pid, 'move_cards') ? '<select class="pj-in" id="cMove" style="width:auto" aria-label="Move to step"></select>' : ''}${canEdit && tlData(pid).range ? '<span class="pj-spacer"></span><select class="pj-in" id="cPhase" style="width:auto"></select>' : ''}</div>
      <h4>People</h4><div class="pj-row wrap" id="cPeople"></div>
      ${canEdit ? `<input class="pj-in" id="cAssign" placeholder="@username to assign" list="cMembers"><datalist id="cMembers">${Store.members(pid).map(m => `<option value="@${esc(Store.username(m.user_id))}">`).join('')}</datalist>` : ''}
      <h4>Description</h4><textarea class="pj-in pj-desc" id="cDesc" placeholder="Add as much detail as you want…" ${ro}>${esc(c.description)}</textarea>
      <h4>Files</h4><div id="cFiles"></div>
      ${Store.can(pid, 'attach_files') ? `<label class="tile pj-btn pj-file">+ Attach file<input type="file" id="cFile" multiple hidden></label><div class="pj-err" id="cFileErr"></div>` : ''}
      <h4>Comments</h4><div id="cComments"></div>
      ${Store.can(pid, 'comment') ? `<div class="pj-row"><textarea class="pj-in" id="cMsg" rows="2" placeholder="Write a comment…"></textarea><button class="tile pj-btn primary" id="cSend">Send</button></div>` : ''}
      ${Store.can(pid, 'delete_cards') ? `<div class="pj-row end"><button class="tile pj-btn danger" id="cDel">Delete card</button></div>` : ''}`,
      () => {
        const cur = Store.get('cards', id);
        if (!cur) return closeModal();
        el.querySelector('#cStep').textContent = 'In ' + (Store.get('steps', cur.step_id)?.name || '');
        const mv = el.querySelector('#cMove');
        if (mv && document.activeElement !== mv) mv.innerHTML = Store.steps(pid).map(st => `<option value="${st.id}" ${st.id === cur.step_id ? 'selected' : ''}>${esc(st.name)}</option>`).join('');
        const ph = el.querySelector('#cPhase');
        if (ph && document.activeElement !== ph) { const t = tlData(pid), l = t.links.find(l => l.title === '§card|' + id), at = l && t.portions.find(p => l.due >= p.start && l.due <= p.end); ph.innerHTML = '<option value="">No phase</option>' + t.portions.map(p => `<option value="${p.start}" ${at === p ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); }
        el.querySelector('#cPeople').innerHTML = cur.assignees.map(u => `<span class="chip pj-person">@${esc(Store.username(u))}${canEdit ? ` <button class="pj-x" data-unassign="${u}">×</button>` : ''}</span>`).join('') || '<span class="p">Nobody yet</span>';
        el.querySelector('#cFiles').innerHTML = Store.attachments(id).map(a => `<div class="row tile pj-fileitem" data-file="${a.id}"><div><div class="it">${esc(a.name)}</div><div class="p">${size(a.size)} · @${esc(Store.username(a.uploaded_by))}</div></div><div class="r">Open</div>${a.uploaded_by === Store.me.id || Store.can(pid, 'delete_cards') ? `<button class="pj-x" data-delfile="${a.id}">×</button>` : ''}</div>`).join('') || '<span class="p">No files</span>';
        el.querySelector('#cComments').innerHTML = Store.comments(id).map(m => `<div class="pj-comment"><div class="p">@${esc(Store.username(m.user_id))} · ${ago(m.created_at)}${m.user_id === Store.me.id ? ` <button class="pj-x" data-delcomment="${m.id}">×</button>` : ''}</div><div class="it">${esc(m.body)}</div></div>`).join('') || '<span class="p">No comments yet</span>';
      });
    const desc = el.querySelector('#cDesc');
    const grow = () => { desc.style.height = 'auto'; desc.style.height = Math.min(desc.scrollHeight, 420) + 'px'; };
    grow(); desc.addEventListener('input', grow);
    if (canEdit) {
      el.querySelector('#cMove')?.addEventListener('change', e => { const to = e.target.value, c2 = Store.get('cards', id); if (to === c2.step_id) return; Store.moveCard(id, to, Store.cards(to).length); Store.note(pid, `moved “${c2.title}” to ${Store.get('steps', to).name}`); });
      el.querySelector('#cPhase')?.addEventListener('change', e => tlAssign(id, e.target.value));
      el.querySelector('#cTitle').addEventListener('change', e => e.target.value.trim() && Store.update('cards', id, { title: e.target.value.trim() }));
      desc.addEventListener('change', () => Store.update('cards', id, { description: desc.value }));
      el.querySelector('#cAssign').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const name = e.target.value.replace(/^@/, '').trim();
        const m = Store.members(pid).find(x => Store.username(x.user_id).toLowerCase() === name.toLowerCase());
        if (!m) { e.target.value = ''; e.target.placeholder = `@${name} isn't in this project`; return; }
        const cur = Store.get('cards', id);
        if (!cur.assignees.includes(m.user_id)) Store.update('cards', id, { assignees: [...cur.assignees, m.user_id] });
        e.target.value = '';
      });
    }
    el.querySelector('#cFile')?.addEventListener('change', async e => {
      const err = el.querySelector('#cFileErr'); err.textContent = '';
      for (const f of e.target.files) { const msg = await Store.attach(Store.get('cards', id), f); if (msg) err.textContent = msg; else Store.note(pid, `attached ${f.name} to “${Store.get('cards', id).title}”`); }
      e.target.value = '';
    });
    const send = () => { const t = el.querySelector('#cMsg'); if (t.value.trim()) { Store.comment(Store.get('cards', id), t.value.trim()); Store.note(pid, `commented on “${Store.get('cards', id).title}”: ${t.value.trim().slice(0, 80)}`); log(`Commented on “${Store.get('cards', id).title}”`); t.value = ''; } };
    el.querySelector('#cSend')?.addEventListener('click', send);
    el.querySelector('#cMsg')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    el.querySelector('#cDel')?.addEventListener('click', () => { if (confirm('Delete this card?')) { Store.note(pid, `deleted card “${Store.get('cards', id).title}”`); Store.remove('cards', id); closeModal(); } });
    el.addEventListener('click', async e => {
      const t = e.target;
      if (t.dataset.unassign) Store.update('cards', id, { assignees: Store.get('cards', id).assignees.filter(u => u !== t.dataset.unassign) });
      else if (t.dataset.delcomment) Store.remove('comments', t.dataset.delcomment);
      else if (t.dataset.delfile) { e.stopPropagation(); const a = Store.get('attachments', t.dataset.delfile); if (confirm(`Remove ${a.name}?`)) Store.removeAttachment(a); }
      else if (t.closest('[data-file]')) {
        const a = Store.get('attachments', t.closest('[data-file]').dataset.file);
        const url = await Store.fileUrl(a);
        if (url) { const link = document.createElement('a'); link.href = url; link.download = a.name; link.target = '_blank'; link.click(); }
      }
    });
  }

  function peopleModal(pid) {
    const canRoles = Store.can(pid, 'manage_roles'), canInvite = Store.can(pid, 'invite');
    const roleOpts = sel => Store.roles(pid).map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    const el = openModal(`<div class="pj-row"><h3>People</h3><span class="pj-spacer"></span><button class="pj-x" data-act="close">×</button></div>
      <div id="pMembers"></div><div id="pInvites"></div>
      ${canInvite ? `<h4>Invite</h4>${Store.cloud ? `<div class="pj-row"><input class="pj-in" id="pName" placeholder="@username"><select class="pj-in pj-sel" id="pRole">${roleOpts(Store.roles(pid)[1]?.id)}</select><button class="tile pj-btn primary" id="pInvite">Invite</button></div><div class="pj-err" id="pErr"></div>` : `<p class="p">Inviting friends needs the cloud connected (Supabase). Projects are on this computer only for now.</p>`}` : ''}`,
      () => {
        const p = Store.get('projects', pid);
        el.querySelector('#pMembers').innerHTML = Store.members(pid).map(m => `<div class="row tile"><span class="pj-av">${initials(Store.username(m.user_id))}</span><div class="it">@${esc(Store.username(m.user_id))}${m.user_id === p.owner ? ' <span class="chip">Owner</span>' : ''}</div>
          <span class="pj-spacer"></span>${canRoles && m.user_id !== p.owner ? `<select class="pj-in pj-sel" data-member-role="${m.id}">${roleOpts(m.role_id)}</select><button class="pj-x" data-kick="${m.id}" title="Remove">×</button>` : `<span class="p">${esc(Store.get('roles', m.role_id)?.name || '')}</span>`}</div>`).join('');
        const inv = Store.projectInvites(pid);
        el.querySelector('#pInvites').innerHTML = inv.length ? `<h4>Pending</h4>` + inv.map(i => `<div class="row tile"><div class="it">@${esc(i.username)}</div><span class="pj-spacer"></span><span class="p">${esc(Store.get('roles', i.role_id)?.name || '')}</span>${canInvite ? `<button class="pj-x" data-uninvite="${i.id}">×</button>` : ''}</div>`).join('') : '';
      });
    el.addEventListener('change', e => { if (e.target.dataset.memberRole) Store.update('members', e.target.dataset.memberRole, { role_id: e.target.value }); });
    el.addEventListener('click', e => {
      if (e.target.dataset.kick && confirm('Remove this person from the project?')) Store.remove('members', e.target.dataset.kick);
      if (e.target.dataset.uninvite) Store.remove('invites', e.target.dataset.uninvite);
    });
    el.querySelector('#pInvite')?.addEventListener('click', async () => {
      const name = el.querySelector('#pName').value.replace(/^@/, '').trim(), err = el.querySelector('#pErr');
      if (!name) return;
      const u = await Store.findUser(name);
      if (!u) return (err.textContent = `No account named @${name}. They need to create one in myProjects first.`);
      if (Store.members(pid).some(m => m.user_id === u.id)) return (err.textContent = `@${u.username} is already in this project.`);
      Store.invite(pid, u.username, el.querySelector('#pRole').value);
      el.querySelector('#pName').value = ''; err.textContent = `Invited @${u.username}. They'll see it next time they open myProjects.`;
    });
  }

  function rolesModal(pid) {
    const el = openModal(`<div class="pj-row"><h3>Roles</h3><span class="pj-spacer"></span><button class="pj-x" data-act="close">×</button></div>
      <p class="p">Choose what each role can do in this project. The owner can always do everything.</p>
      <div id="rList"></div><button class="tile pj-btn" id="rAdd">+ Add role</button>`,
      () => {
        el.querySelector('#rList').innerHTML = Store.roles(pid).map(r => {
          const used = Store.members(pid).some(m => m.role_id === r.id) || Store.projectInvites(pid).some(i => i.role_id === r.id);
          return `<div class="tile pj-role"><div class="pj-row"><input class="pj-in" data-role-name="${r.id}" value="${esc(r.name)}">
            ${used ? '' : `<button class="pj-x" data-delrole="${r.id}" title="Delete role">×</button>`}</div>
            <div class="pj-perms">${Object.entries(Store.PERMS).map(([k, label]) => `<label class="pj-perm"><input type="checkbox" data-role="${r.id}" data-perm="${k}" ${r.perms[k] ? 'checked' : ''}><span class="pj-toggle"></span>${label}</label>`).join('')}</div></div>`;
        }).join('');
      });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.perm) { const r = Store.get('roles', t.dataset.role); Store.update('roles', r.id, { perms: { ...r.perms, [t.dataset.perm]: t.checked } }); }
      if (t.dataset.roleName && t.value.trim()) Store.update('roles', t.dataset.roleName, { name: t.value.trim() });
    });
    el.addEventListener('click', e => { if (e.target.dataset.delrole) Store.remove('roles', e.target.dataset.delrole); });
    el.querySelector('#rAdd').onclick = () => ask('New role', 'Role name', '', name => { Store.insert('roles', { project_id: pid, name, perms: { comment: true } }); rolesModal(pid); });
  }

  // ---------- Events ----------
  function bind() {
    document.addEventListener('click', async e => {
      const t = e.target.closest('[data-act]');
      if (!t || !(root.contains(t) || modal?.el.contains(t))) return;
      const id = t.dataset.id, act = t.dataset.act;
      if (act === 'close') closeModal();
      else if (act === 'new') ask('Start a Project', 'Project name', '', name => { const p = Store.startProject(name); log(`Started ${name}`); view = { name: 'board', id: p.id }; render(); });
      else if (act === 'open') { commitSeen(); view = { name: 'board', id, tab: 'cards' }; render(); }
      else if (act === 'back') { commitSeen(); view = { name: 'list' }; render(); }
      else if (act === 'ptab') { commitSeen(); view.tab = t.dataset.tab; view.tlPhase = null; showPast = false; sentNow = new Set(); render(); }
      else if (act === 'pastupd') { showPast = !showPast; render(); }
      else if (act === 'sendupd') sendUpdate();
      else if (act === 'tlcreate') {
        const a = root.querySelector('#tlStart').value, b = root.querySelector('#tlEnd').value;
        if (!a || !b || b < a) return root.querySelector('#tlEnd').focus();
        Store.insert('milestones', { project_id: view.id, title: '§range|' + a, due: b, done: false, created_by: Store.me.id, created_at: new Date().toISOString() });
        Store.note(view.id, 'set the timeline: ' + fmtD(a) + ' – ' + fmtD(b));
      }
      else if (act === 'tlphase') { view.tlPhase = id; render(); }
      else if (act === 'tlback') { view.tlPhase = null; render(); }
      else if (act === 'tlmine') { view.tlMine = !!t.dataset.v; render(); }
      else if (act === 'tlsplit') { const p = tlData(view.id).parts.find(p => p.id === id); Store.remove('milestones', id); Store.note(view.id, 'split “' + p.name + '” back into weeks'); }
      else if (act === 'accept') { const inv = Store.get('invites', id); Store.acceptInvite(inv); setTimeout(() => Store.note(inv.project_id, 'joined the project'), 50); }
      else if (act === 'decline') Store.remove('invites', id);
      else if (act === 'addstep') ask('New step', 'Step name (e.g. Review)', '', name => { Store.addStep(view.id, name); Store.note(view.id, `added step “${name}”`); });
      else if (act === 'delstep') { if (confirm('Delete this step and all its cards?')) { Store.note(view.id, `deleted step “${Store.get('steps', id).name}”`); Store.remove('steps', id); } }
      else if (act === 'addcard') ask('New card', 'Card title', '', name => { const nc = Store.addCard(view.id, id, name); if (view.tab === 'timeline' && view.tlPhase && !['all', 'none'].includes(view.tlPhase)) tlAssign(nc.id, view.tlPhase); Store.note(view.id, `added card “${name}” to ${Store.get('steps', id).name}`); log(`Added card “${name}”`); });
      else if (act === 'card') cardModal(id);
      else if (act === 'people') peopleModal(view.id);
      else if (act === 'roles') rolesModal(view.id);
      else if (act === 'signout') Store.signOut();
      else if (act === 'authmode') {
        const up = t.dataset.mode === 'up';
        root.querySelectorAll('[data-act="authmode"]').forEach(b => b.classList.toggle('on', b === t));
        root.querySelector('#pjUser').hidden = !up;
        root.querySelector('#pjPass2Wrap').hidden = !up;
        const go = root.querySelector('[data-act="auth"]'); go.dataset.mode = t.dataset.mode; go.textContent = up ? 'Create account' : 'Sign in';
      } else if (act === 'auth') {
        const email = root.querySelector('#pjEmail').value.trim(), pass = root.querySelector('#pjPass').value;
        if (t.dataset.mode === 'up' && pass !== root.querySelector('#pjPass2').value) { root.querySelector('#pjErr').textContent = "Passwords don't match"; return; }
        const err = root.querySelector('#pjErr'); err.textContent = '…';
        const msg = t.dataset.mode === 'up' ? await Store.signUp(email, pass, root.querySelector('#pjUser').value.trim()) : await Store.signIn(email, pass);
        if (msg && root.querySelector('#pjErr')) root.querySelector('#pjErr').textContent = msg;
      }
    });
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.stepName && t.value.trim()) Store.update('steps', t.dataset.stepName, { name: t.value.trim() });
      if ('tlstart' in t.dataset || 'tlend' in t.dataset) {
        const r = tlData(view.id).range, a = 'tlstart' in t.dataset ? t.value : r.title.split('|')[1], b = 'tlend' in t.dataset ? t.value : r.due;
        if (a && b && b >= a) Store.update('milestones', r.id, { title: '§range|' + a, due: b }); else render();
      }
      if (t.dataset.partname && t.value.trim()) { const m = Store.get('milestones', t.dataset.partname), [, ps] = m.title.split('|'); Store.update('milestones', m.id, { title: '§part|' + ps + '|' + t.value.trim() }); }
      if (t.dataset.projectName && t.value.trim()) Store.update('projects', t.dataset.projectName, { name: t.value.trim() });
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.pj-stepname, .pj-title, .tl-pname')) e.target.blur(); });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'upMsg') { e.preventDefault(); sendUpdate(); } }); // Enter sends, Shift+Enter = new line
    root.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !root.contains(document.activeElement)) render(); }));

    // Timeline: press on a week and drag across others to group them into one portion
    let wsel = null;
    const paintSel = () => root.querySelectorAll('.tl-wk').forEach(el => { const k = +el.dataset.wk; el.classList.toggle('sel', !!wsel && k >= Math.min(wsel.a, wsel.b) && k <= Math.max(wsel.a, wsel.b)); });
    root.addEventListener('pointerdown', e => {
      const wk = e.target.closest('[data-wk]');
      if (!wk || !Store.can(view.id, 'edit_cards')) return;
      e.preventDefault(); wsel = { a: +wk.dataset.wk, b: +wk.dataset.wk }; paintSel();
    });
    document.addEventListener('pointermove', e => {
      if (!wsel) return;
      const wk = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-wk]');
      if (wk && +wk.dataset.wk !== wsel.b) { wsel.b = +wk.dataset.wk; paintSel(); }
    });
    document.addEventListener('pointerup', () => { if (!wsel) return; const { a, b } = wsel; wsel = null; if (a !== b) tlGroup(a, b); else { const w = tlData(view.id).weeks[a]; if (w && !tlData(view.id).parts.some(p => p.start <= w.start && p.end >= w.start)) tlGroup(a, a); else paintSel(); } });

    // Drag cards between steps, and drag step headers to reorder steps
    let drag = null;
    const marker = document.createElement('div'); marker.className = 'pj-marker';
    root.addEventListener('dragstart', e => {
      const card = e.target.closest?.('.pj-card'), head = e.target.closest?.('[data-dragstep]'), tcard = e.target.closest?.('[data-tcard]');
      if (tcard) drag = { type: 'tcard', id: tcard.dataset.tcard, el: tcard };
      else if (card) drag = { type: 'card', id: card.dataset.id, el: card };
      else if (head) drag = { type: 'step', id: head.dataset.dragstep, el: head.parentElement };
      else return;
      dragging = true;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.id);
      requestAnimationFrame(() => drag?.el.classList.add('dragging'));
    });
    root.addEventListener('dragover', e => {
      if (!drag) return;
      if (drag.type === 'tcard') {
        const col = e.target.closest('[data-part]');
        root.querySelectorAll('.tl-col.over').forEach(c => c !== col && c.classList.remove('over'));
        if (col) { e.preventDefault(); col.classList.add('over'); }
        return;
      }
      if (drag.type === 'card') {
        const list = e.target.closest('[data-drop]') || e.target.closest('.pj-col')?.querySelector('[data-drop]');
        if (!list) return;
        e.preventDefault();
        const after = [...list.querySelectorAll('.pj-card:not(.dragging)')].find(c => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
        list.insertBefore(marker, after || null);
      } else {
        const board = e.target.closest('[data-board]');
        if (!board) return;
        e.preventDefault();
        const after = [...board.querySelectorAll('.pj-col[data-step]:not(.dragging)')].find(c => e.clientX < c.getBoundingClientRect().left + c.offsetWidth / 2);
        marker.classList.add('vert');
        board.insertBefore(marker, after || board.querySelector('.pj-newstep'));
      }
    });
    root.addEventListener('drop', e => {
      if (drag?.type === 'tcard') { const col = e.target.closest('[data-part]'); if (col) { e.preventDefault(); tlAssign(drag.id, col.dataset.part); } return; }
      if (!drag || !marker.parentElement) return;
      e.preventDefault();
      if (drag.type === 'card') {
        const list = marker.parentElement;
        const index = [...list.children].filter(c => c === marker || (c.classList.contains('pj-card') && !c.classList.contains('dragging'))).indexOf(marker);
        const from = Store.get('cards', drag.id).step_id;
        Store.moveCard(drag.id, list.dataset.drop, index);
        if (from !== list.dataset.drop) Store.note(view.id, `moved “${Store.get('cards', drag.id).title}” to ${Store.get('steps', list.dataset.drop).name}`);
        log(`Moved “${Store.get('cards', drag.id).title}” to ${Store.get('steps', list.dataset.drop).name}`);
      } else {
        const board = marker.parentElement;
        const index = [...board.children].filter(c => c === marker || (c.dataset.step && !c.classList.contains('dragging'))).indexOf(marker);
        Store.moveStep(drag.id, view.id, index);
      }
    });
    root.addEventListener('dragend', () => {
      marker.remove(); marker.classList.remove('vert');
      drag?.el.classList.remove('dragging');
      drag = null; dragging = false;
      render();
    });
  }

  // Search hook: open a project board, optionally with a card open
  function open(pid, cid) { view = { name: 'board', id: pid }; go('Projects'); if (cid) setTimeout(() => cardModal(cid)); }

  const leave = () => { commitSeen(); render(); };
  return { mount, render, open, leave };
})();
