// myNotes: a plain, standard notes app. Notes are saved in your account (synced) and keep working offline.
const NotesUI = (() => {
  const KEY = 'notes';
  let root = null, sel = null, q = '', timer = null, pending = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const all = () => Personal.getKv(KEY, []) || [];
  const put = list => Personal.setKv(KEY, list);
  const get = id => all().find(n => n.id === id);
  const stamp = t => { const d = new Date(t), now = new Date(), same = d.toDateString() === now.toDateString();
    return same ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }); };
  const label = n => (n.title || '').trim() || (n.body || '').trim().split('\n')[0].slice(0, 60) || 'New note';
  const preview = n => { const lines = (n.body || '').trim().split('\n').filter(Boolean); return (n.title.trim() ? lines[0] : lines[1]) || ''; };
  const shown = () => {
    const s = q.trim().toLowerCase();
    return all().filter(n => !s || (n.title + ' ' + n.body).toLowerCase().includes(s)).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at);
  };

  function mount(el) {
    if (root !== el) { root = el; bind(); }
    flush();
    if (sel && !get(sel)) sel = null;
    render();
  }
  Personal.subscribe(() => { if (root && !root.hidden && !root.contains(document.activeElement)) render(); });

  function row(n) {
    return `<button class="tile nt-row${n.id === sel ? ' on' : ''}" data-note="${n.id}"><span class="nt-t">${n.pin ? '<i class="nt-pin">📌</i>' : ''}${esc(label(n))}</span>
      <span class="p nt-sub"><b>${stamp(n.at)}</b> ${esc(preview(n))}</span></button>`;
  }
  function listHtml() {
    const list = shown();
    if (!all().length) return '<div class="nt-empty"><div class="it">No notes yet</div><div class="p">Tap + to write your first one.</div></div>';
    if (!list.length) return '<div class="nt-empty"><div class="p">No notes match “' + esc(q) + '”.</div></div>';
    const pinned = list.filter(n => n.pin), rest = list.filter(n => !n.pin);
    return (pinned.length ? `<div class="tm-gh">Pinned</div>${pinned.map(row).join('')}` : '') + (pinned.length && rest.length ? '<div class="tm-gh">Notes</div>' : '') + rest.map(row).join('');
  }
  function editorHtml() {
    const n = sel && get(sel);
    if (!n) return '<div class="nt-blank"><div class="it">Select a note</div><div class="p">Or tap + to start a new one.</div></div>';
    return `<div class="nt-bar"><button class="tile pj-btn nt-back" data-ntback>← Notes</button><span class="p nt-when">Edited ${stamp(n.at)}</span><span class="pj-spacer"></span>
        <button class="tile pj-btn${n.pin ? ' primary' : ''}" data-ntpin>${n.pin ? 'Pinned' : 'Pin'}</button><button class="tile pj-btn danger" data-ntdel>Delete</button></div>
      <textarea class="nt-title" id="ntTitle" rows="1" data-ntgrow placeholder="Title">${esc(n.title)}</textarea>
      <textarea class="nt-body" id="ntBody" placeholder="Start writing…">${esc(n.body)}</textarea>`;
  }
  function render() {
    if (!root) return;
    root.innerHTML = `<div class="nt-wrap${sel ? ' editing' : ''}">
      <section class="surface nt-side"><div class="pj-row"><h2><span class="my">my</span><span class="nm">Notes</span></h2><span class="pj-spacer"></span><button class="tile pj-btn primary nt-new" data-ntnew aria-label="New note">+ New</button></div>
        <label class="tile nt-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="ntSearch" placeholder="Search notes" value="${esc(q)}" autocomplete="off"></label>
        <div class="nt-list" id="ntList">${listHtml()}</div></section>
      <section class="surface nt-edit" id="ntEdit">${editorHtml()}</section></div>`;
    const t = root.querySelector('#ntTitle'); if (t) grow(t);
  }
  const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const refreshList = () => { const l = root.querySelector('#ntList'); if (l) l.innerHTML = listHtml(); const w = root.querySelector('.nt-when'); const n = sel && get(sel); if (w && n) w.textContent = 'Edited ' + stamp(n.at); };

  function flush() { clearTimeout(timer); timer = null; if (pending) { const l = pending; pending = null; put(l); if (root) refreshList(); } }
  function select(id) { flush(); dropEmpty(); sel = id; render(); if (id && !matchMedia('(max-width: 820px)').matches) root.querySelector('#ntBody')?.focus(); }
  function dropEmpty() { // a note you never typed anything in is not kept
    const n = sel && get(sel);
    if (n && !n.title.trim() && !n.body.trim()) put(all().filter(x => x.id !== n.id));
  }
  function create() {
    flush(); dropEmpty(); q = '';
    const n = { id: crypto.randomUUID(), title: '', body: '', at: Date.now(), created: Date.now(), pin: false };
    put([...all(), n]); sel = n.id; render(); root.querySelector('#ntTitle')?.focus();
  }
  function edit(field, value) { // typing: save quietly after a short pause, update the list in place
    const list = all(), n = list.find(x => x.id === sel); if (!n) return;
    n[field] = value; n.at = Date.now(); pending = list;
    clearTimeout(timer); timer = setTimeout(flush, 350);
  }
  function bind() {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-note],[data-ntnew],[data-ntback],[data-ntpin],[data-ntdel]');
      if (!t) return;
      if (t.dataset.note) select(t.dataset.note);
      else if ('ntnew' in t.dataset) create();
      else if ('ntback' in t.dataset) { flush(); dropEmpty(); sel = null; render(); }
      else if ('ntpin' in t.dataset) { const n = get(sel); if (n) { put(all().map(x => (x.id === sel ? { ...x, pin: !x.pin } : x))); render(); } }
      else if ('ntdel' in t.dataset) {
        const n = get(sel); if (!n) return;
        if (confirm('Delete this note? This can\'t be undone.')) { put(all().filter(x => x.id !== sel)); sel = null; render(); }
      }
    });
    root.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'ntSearch') { q = t.value; refreshList(); }
      else if (t.id === 'ntTitle') { grow(t); edit('title', t.value); }
      else if (t.id === 'ntBody') edit('body', t.value);
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ntTitle') { e.preventDefault(); root.querySelector('#ntBody')?.focus(); } });
    root.addEventListener('focusout', flush);
    addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  }
  return { mount, create: () => { go('Time/Notes'); setTimeout(create, 50); } };
})();
