// myTodo and myCalendar. Both read and write the same Personal store, so they stay in sync.
const TimeUI = (() => {
  const P = Personal;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return P.ymd(d); };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function time12(t) { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${ap}`; }
  function dayLabel(s) {
    const t = P.today(), diff = Math.round((parse(s) - parse(t)) / 864e5), d = parse(s);
    if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 7) return DAYS[d.getDay()];
    return `${DAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  }
  const longDay = s => { const d = parse(s); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>';
  const PRI = ['None', 'Low', 'Medium', 'High'];

  // Week runs Sunday to Saturday; "This Week" tasks are due Saturday
  const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return P.ymd(d); };
  const weekEnd = () => addDays(weekStart(), 6);
  // Due label in urgency terms: Overdue, Today, This week, a date for later, or Anytime
  function dueLabel(t) {
    const d = P.today();
    if (!t.date) return 'Anytime';
    if (t.date < d) return t.done ? dayLabel(t.date) : 'Overdue';
    if (t.date === d) return 'Today' + (t.time ? ' · ' + time12(t.time) : '');
    if (t.date <= weekEnd()) return 'This week';
    return dayLabel(t.date);
  }

  // Keeps focus/caret when a view re-renders while you're typing in it
  function keepFocus(root, fn) {
    const a = document.activeElement, id = a && root.contains(a) ? a.id : null, pos = id ? [a.selectionStart, a.selectionEnd] : null;
    fn();
    if (id) { const el = root.querySelector('#' + id); if (el) { el.focus(); try { el.setSelectionRange(...pos); } catch {} } }
  }

  function taskRow(t, opts = {}) {
    const over = t.date && t.date < P.today() && !t.done;
    return `<div class="tile tm-task${t.done ? ' done' : ''}${opts.selected ? ' sel' : ''}" data-task="${t.id}" ${opts.draggable ? 'draggable="true"' : ''}>
      <button class="tm-check" data-check="${t.id}" aria-label="Complete">${CHECK}</button>
      <div class="tm-tbody"><div class="it tm-ttitle">${esc(t.title)}</div>
        ${t.notes && !opts.compact ? `<div class="p tm-tnotes">${esc(t.notes.split('\n')[0])}</div>` : ''}</div>
      <div class="tm-tmeta">
        ${t.priority ? `<span class="tm-pri p${t.priority}" title="${PRI[t.priority]} priority"></span>` : ''}
        ${!opts.hideDate ? `<span class="tm-due${over ? ' over' : ''}">${dueLabel(t)}</span>` : t.time ? `<span class="tm-due">${time12(t.time)}</span>` : ''}
      </div></div>`;
  }

  // Check off with a short animation before the list updates
  function animateCheck(btn) {
    const row = btn.closest('.tm-task');
    row.classList.add('checking');
    setTimeout(() => P.toggleTask(btn.dataset.check), 320);
  }

  // ======================= myTodo =======================
  // Left half: summary (today + week progress, counts, the 3 most urgent). Right half: add + task list.
  // New tasks are just a title and an urgency: Today, This Week (due Saturday) or Anytime.
  const Todo = (() => {
    let root = null, urg = 'today', editing = null, showDone = false;
    const URG = [['today', 'Today'], ['week', 'This Week'], ['anytime', 'Anytime']];
    function mount(el) {
      if (root !== el) { root = el; bind(); }
      render();
    }
    P.subscribe(() => root && !root.hidden && render());

    const rank = t => { const d = P.today(); return !t.date ? 3 : t.date < d ? 0 : t.date === d ? 1 : 2; };
    const urgent = open => open.slice().sort((a, b) => rank(a) - rank(b) || (a.date || '').localeCompare(b.date || '') || P.byTime(a, b));
    function stats() {
      const d = P.today(), ws = weekStart(), we = weekEnd(), doneToday = x => x.done && x.doneAt && P.ymd(new Date(x.doneAt)) === d;
      const inToday = x => x.date && (x.date === d || (x.date < d && (!x.done || doneToday(x))));
      const inWeek = x => x.date && ((x.date >= ws && x.date <= we) || (x.date < ws && (!x.done || doneToday(x))));
      const tt = P.tasks.filter(inToday), wt = P.tasks.filter(inWeek);
      const pc = a => (a.length ? Math.round(a.filter(x => x.done).length / a.length * 100) : 0);
      const open = P.tasks.filter(x => !x.done);
      return { today: pc(tt), todayN: tt.length, todayDone: tt.filter(x => x.done).length, week: pc(wt), weekN: wt.length, weekDone: wt.filter(x => x.done).length,
        overdue: open.filter(x => x.date && x.date < d).length, dueToday: open.filter(x => x.date === d).length,
        dueWeek: open.filter(x => x.date > d && x.date <= we).length, anytime: open.filter(x => !x.date).length, open };
    }
    const ring = (pct, label, sub) => `<div class="td-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52" style="stroke-dashoffset:${327 - 327 * pct / 100}"/></svg>
      <div class="td-ring-in"><b>${pct}<small>%</small></b><span>${label}</span><em>${sub}</em></div></div>`;

    function row(t) {
      if (editing !== t.id) return taskRow(t);
      const d = P.today(), u = t.date && t.date <= d ? 'today' : t.date && t.date <= weekEnd() ? 'week' : t.date ? 'later' : 'anytime';
      return `<div class="tile tm-task td-edit">
        <button class="tm-check" data-check="${t.id}">${CHECK}</button>
        <div class="tm-tbody"><input class="pj-in" id="tdEdit" value="${esc(t.title)}">
          <div class="td-seg">${URG.map(([k, l]) => `<button class="${u === k ? 'on' : ''}" data-seturg="${k}">${l}</button>`).join('')}
            <span class="pj-spacer"></span><button class="danger" data-del="${t.id}">Delete</button><button data-doneedit>Done</button></div></div></div>`;
    }

    function render() {
      keepFocus(root, () => {
        const s = stats(), d = P.today(), we = weekEnd();
        const top = urgent(s.open).slice(0, 3);
        const groups = [['Overdue', s.open.filter(x => x.date && x.date < d)], ['Today', s.open.filter(x => x.date === d)],
          ['This Week', s.open.filter(x => x.date > d && x.date <= we)], ['Later', s.open.filter(x => x.date > we)], ['Anytime', s.open.filter(x => !x.date)]]
          .map(([n, a]) => [n, a.sort(P.byTime)]).filter(([, a]) => a.length);
        const done = P.tasks.filter(x => x.done).sort((a, b) => b.doneAt - a.doneAt);
        const headline = s.todayN && s.today === 100 ? 'All done today' : s.open.length ? `${s.open.length} open task${s.open.length === 1 ? '' : 's'}` : 'All clear';
        root.innerHTML = `<div class="td-wrap">
          <section class="surface td-summary">
            <div class="td-head"><h2>${headline}${P.isDemo('tasks') ? ' <span class="fx-demo">Demo data</span>' : ''}</h2><div class="p">${longDay(d)}</div></div>
            <div class="td-rings">${ring(s.today, 'Today', `${s.todayDone} of ${s.todayN} done`)}${ring(s.week, 'This week', `${s.weekDone} of ${s.weekN} done`)}</div>
            <div class="td-stats">${[['Overdue', s.overdue, 'over'], ['Due today', s.dueToday, ''], ['This week', s.dueWeek, ''], ['Anytime', s.anytime, '']]
              .map(([l, n, c]) => `<div class="td-stat ${c}${n ? '' : ' zero'}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
            <div class="td-urgent"><div class="tm-gh">Most urgent</div>
              ${top.map((t, i) => `<div class="td-urow"><span class="td-rank">${i + 1}</span>${taskRow(t)}</div>`).join('') || '<div class="p td-none">Nothing urgent. Enjoy it.</div>'}</div>
          </section>
          <section class="td-tasks">
            <div class="tile td-add">
              <span class="tm-plus">+</span>
              <input id="tdNew" class="tm-addin" placeholder="Add a task…" autocomplete="off">
              <div class="td-seg">${URG.map(([k, l]) => `<button class="${urg === k ? 'on' : ''}" data-urg="${k}">${l}</button>`).join('')}</div>
            </div>
            <div class="tm-groups">${groups.map(([n, items]) => `<div class="tm-group"><div class="tm-gh${n === 'Overdue' ? ' over' : ''}">${n}<span>${items.length}</span></div>${items.map(row).join('')}</div>`).join('')
              || `<div class="tm-empty"><div class="tm-empty-ring">${CHECK}</div><div class="it">All clear</div><div class="p">Add a task above to get started.</div></div>`}
              ${done.length ? `<button class="td-toggle" data-showdone>${showDone ? 'Hide' : 'Show'} completed (${done.length})</button>
                ${showDone ? `<div class="tm-group">${done.map(row).join('')}<button class="tile pj-btn tm-clear" data-clear>Clear completed</button></div>` : ''}` : ''}
            </div>
          </section>
        </div>`;
      });
    }

    const dateFor = u => (u === 'today' ? P.today() : u === 'week' ? weekEnd() : null);
    function bind() {
      const save = () => { const v = root.querySelector('#tdEdit')?.value.trim(); if (v && editing) P.updateTask(editing, { title: v }); };
      root.addEventListener('keydown', e => {
        if (e.target.id === 'tdNew' && e.key === 'Enter' && e.target.value.trim()) { const title = e.target.value.trim(); e.target.value = ''; P.addTask({ title, date: dateFor(urg) }); }
        if (e.target.id === 'tdEdit' && (e.key === 'Enter' || e.key === 'Escape')) { if (e.key === 'Enter') save(); editing = null; render(); }
      });
      root.addEventListener('focusout', e => { if (e.target.id === 'tdEdit') save(); });
      root.addEventListener('click', e => {
        const el = e.target.closest('[data-check],[data-urg],[data-seturg],[data-del],[data-doneedit],[data-showdone],[data-clear],[data-task]');
        if (!el) return;
        const d = el.dataset;
        if (d.check) { e.stopPropagation(); return el.closest('.td-edit') ? P.toggleTask(d.check) : animateCheck(el); }
        if (d.urg) { urg = d.urg; root.querySelectorAll('[data-urg]').forEach(b => b.classList.toggle('on', b === el)); root.querySelector('#tdNew').focus(); }
        else if (d.seturg) P.updateTask(editing, { date: dateFor(d.seturg), time: d.seturg === 'today' ? P.task(editing).time : null });
        else if (d.del) { P.removeTask(d.del); editing = null; }
        else if ('doneedit' in d) { save(); editing = null; render(); }
        else if ('showdone' in d) { showDone = !showDone; render(); }
        else if ('clear' in d) P.clearCompleted();
        else if (d.task) { editing = d.task; render(); root.querySelector('#tdEdit')?.focus(); }
      });
    }
    // Search hook: open myTodo with a task ready to edit
    function edit(id) { editing = id; go('Time/Todo'); }
    return { mount, edit };
  })();

  // ======================= myCalendar =======================
  const Calendar = (() => {
    let root = null, month = P.today().slice(0, 7), day = P.today(), drag = null;
    const HOUR = 52;
    function mount(el) {
      if (root !== el) { root = el; bind(); }
      render();
      requestAnimationFrame(() => { const tl = root.querySelector('.cal-tl'); if (tl && !tl.dataset.scrolled) { tl.scrollTop = 7 * HOUR; tl.dataset.scrolled = 1; } });
    }
    P.subscribe(() => root && !root.hidden && render());

    function render() {
      const tl = root.querySelector('.cal-tl'), scroll = tl ? tl.scrollTop : 7 * HOUR;
      const [y, m] = month.split('-').map(Number);
      const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - first.getDay());
      const t = P.today();
      const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return P.ymd(d); });
      const grid = cells.map(c => {
        const evs = P.eventsOn(c), ts = P.tasksOn(c), items = [...evs.map(e => ({ k: 'e', e })), ...ts.map(x => ({ k: 't', x }))];
        const out = c.slice(0, 7) !== month;
        return `<button class="tile cal-cell${out ? ' out' : ''}${c === t ? ' today' : ''}${c === day ? ' sel' : ''}" data-day="${c}">
          <span class="cal-top"><span class="cal-num">${parse(c).getDate()}</span><span class="cal-more fit-more" hidden></span></span>
          <span class="cal-items" data-fit>${items.map(it => it.k === 'e'
            ? `<span class="cal-ev c${it.e.color}">${esc(it.e.title)}</span>`
            : `<span class="cal-tk${it.x.done ? ' done' : ''}"><i></i>${esc(it.x.title)}</span>`).join('')}</span></button>`;
      }).join('');
      root.innerHTML = `<div class="cal-wrap">
        <section class="surface cal-month">
          <div class="cal-head">
            <h2><span class="nm">${MONTHS[m - 1]}</span> <span class="my">${y}</span></h2>${P.isDemo('events') ? '<span class="fx-demo">Demo data</span>' : ''}
            <div class="pj-spacer"></div>
            <button class="tile pj-btn" data-nav="today">Today</button>
            <button class="tile pj-btn cal-arrow" data-nav="-1" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
            <button class="tile pj-btn cal-arrow" data-nav="1" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
          </div>
          <div class="cal-dow">${DAYS.map(d => `<span>${d.slice(0, 3)}</span>`).join('')}</div>
          <div class="cal-grid">${grid}</div>
        </section>
        ${dayPanel()}
      </div>`;
      const ntl = root.querySelector('.cal-tl');
      if (ntl) { ntl.scrollTop = scroll; ntl.dataset.scrolled = 1; }
    }

    function dayPanel() {
      const evs = P.eventsOn(day), ts = P.tasksOn(day);
      const allDay = evs.filter(e => e.allDay), timed = evs.filter(e => !e.allDay);
      const timedTasks = ts.filter(x => x.time), untimed = ts.filter(x => !x.time);
      // Lay overlapping events side by side
      const blocks = [...timed.map(e => ({ type: 'e', id: e.id, s: mins(e.start), en: Math.max(mins(e.end), mins(e.start) + 30), e })),
        ...timedTasks.map(x => ({ type: 't', id: x.id, s: mins(x.time), en: mins(x.time) + 30, x }))].sort((a, b) => a.s - b.s);
      const lanes = [];
      blocks.forEach(b => { let i = lanes.findIndex(end => end <= b.s); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = b.en; b.lane = i; });
      blocks.forEach(b => { b.cols = Math.max(1, ...blocks.filter(o => o.s < b.en && o.en > b.s).map(o => o.lane + 1)); });
      const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
      return `<aside class="surface cal-day">
        <div class="cal-dayhead"><div><div class="p">${dayLabel(day)}</div><h3>${longDay(day)}</h3></div></div>
        <div class="pj-row"><button class="tile pj-btn primary" data-new="event">+ Event</button><button class="tile pj-btn" data-new="task">+ Task</button></div>
        ${allDay.length || untimed.length ? `<div class="cal-allday">${allDay.map(e => `<div class="tile cal-chip c${e.color}" data-ev="${e.id}" draggable="true">${esc(e.title)}<span class="p">All day</span></div>`).join('')}
          ${untimed.map(x => taskRow(x, { compact: true, hideDate: true, draggable: true })).join('')}</div>` : ''}
        <div class="cal-tl"><div class="cal-hours" style="height:${24 * HOUR}px">
          ${Array.from({ length: 24 }, (_, h) => `<div class="cal-hour" style="top:${h * HOUR}px" data-hour="${h}"><span>${h === 0 ? '' : time12(`${h}:00`).replace(':00', '')}</span></div>`).join('')}
          ${blocks.map(b => {
            const style = `top:${b.s / 60 * HOUR}px;height:${Math.max(24, (b.en - b.s) / 60 * HOUR - 2)}px;left:calc(56px + (100% - 62px) * ${b.lane / b.cols});width:calc((100% - 62px) / ${b.cols} - 4px)`;
            return b.type === 'e'
              ? `<div class="cal-block c${b.e.color}" style="${style}" data-ev="${b.id}" draggable="true"><b>${esc(b.e.title)}</b><span>${time12(b.e.start)} – ${time12(b.e.end)}</span></div>`
              : `<div class="cal-block task${b.x.done ? ' done' : ''}" style="${style}" data-task="${b.id}" draggable="true"><button class="tm-check sm" data-check="${b.id}">${CHECK}</button><b>${esc(b.x.title)}</b></div>`;
          }).join('')}
          ${day === P.today() ? `<div class="cal-now" style="top:${nowMin / 60 * HOUR}px"></div>` : ''}
        </div></div>
        ${!evs.length && !ts.length ? `<div class="p cal-free">Nothing scheduled. Drag items here from another day, or add one.</div>` : ''}
      </aside>`;
    }
    const mins = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };

    function eventModal(ev, date, startTime) {
      const isNew = !ev;
      ev = ev || { title: '', date, allDay: false, start: startTime || '09:00', end: startTime ? `${String(Math.min(23, +startTime.slice(0, 2) + 1)).padStart(2, '0')}:${startTime.slice(3)}` : '10:00', color: 1, notes: '' };
      const wrap = document.createElement('div');
      wrap.className = 'pj-overlay';
      wrap.innerHTML = `<div class="pj-modal glass cal-modal">
        <div class="pj-row"><h3>${isNew ? 'New event' : 'Edit event'}</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
        <input class="pj-in pj-ctitlein" id="evTitle" placeholder="Event title" value="${esc(ev.title)}">
        <div class="cal-form">
          <label class="tm-field"><span>Date</span><input type="date" class="pj-in" id="evDate" value="${ev.date}"></label>
          <label class="pj-perm"><input type="checkbox" id="evAll" ${ev.allDay ? 'checked' : ''}><span class="pj-toggle"></span>All day</label>
          <label class="tm-field" ${ev.allDay ? 'hidden' : ''} data-timed><span>Starts</span><input type="time" class="pj-in" id="evStart" value="${ev.start}"></label>
          <label class="tm-field" ${ev.allDay ? 'hidden' : ''} data-timed><span>Ends</span><input type="time" class="pj-in" id="evEnd" value="${ev.end}"></label>
        </div>
        <div class="tm-field"><span>Color</span><div class="cal-swatches">${[1, 2, 3, 4, 5].map(c => `<button class="cal-sw c${c}${ev.color === c ? ' on' : ''}" data-color="${c}"></button>`).join('')}</div></div>
        <textarea class="pj-in" id="evNotes" rows="3" placeholder="Notes">${esc(ev.notes)}</textarea>
        <div class="pj-row end">${isNew ? '' : `<button class="tile pj-btn danger" data-delev>Delete</button><span class="pj-spacer"></span>`}<button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>${isNew ? 'Add event' : 'Save'}</button></div>
      </div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('on'));
      let color = ev.color;
      const $ = s => wrap.querySelector(s);
      const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
      $('#evTitle').focus();
      $('#evAll').onchange = e => wrap.querySelectorAll('[data-timed]').forEach(f => (f.hidden = e.target.checked));
      const save = () => {
        const title = $('#evTitle').value.trim();
        if (!title) return $('#evTitle').focus();
        let start = $('#evStart').value || '09:00', end = $('#evEnd').value || start;
        if (end <= start) end = `${String(Math.min(23, +start.slice(0, 2) + 1)).padStart(2, '0')}:${start.slice(3)}`;
        const data = { title, date: $('#evDate').value || date, allDay: $('#evAll').checked, start, end, color, notes: $('#evNotes').value };
        isNew ? P.addEvent(data) : P.updateEvent(ev.id, data);
        day = data.date; month = day.slice(0, 7);
        close(); render();
      };
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'evTitle') save(); if (e.key === 'Escape') close(); });
      wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
      wrap.addEventListener('click', e => {
        const t = e.target.closest('[data-x],[data-save],[data-color],[data-delev]');
        if (!t) return;
        if ('x' in t.dataset) close();
        else if ('save' in t.dataset) save();
        else if ('delev' in t.dataset) { P.removeEvent(ev.id); close(); }
        else { color = +t.dataset.color; wrap.querySelectorAll('.cal-sw').forEach(s => s.classList.toggle('on', s === t)); }
      });
    }

    function taskModal(date, time) {
      const wrap = document.createElement('div');
      wrap.className = 'pj-overlay';
      wrap.innerHTML = `<div class="pj-modal glass cal-modal"><h3>New task · ${dayLabel(date)}</h3>
        <input class="pj-in" id="ntTitle" placeholder="What needs doing?">
        <label class="tm-field"><span>Time (optional)</span><input type="time" class="pj-in" id="ntTime" value="${time || ''}"></label>
        <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>Add task</button></div></div>`;
      document.body.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('on'));
      const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
      const save = () => { const v = wrap.querySelector('#ntTitle').value.trim(); if (!v) return; P.addTask({ title: v, date, time: wrap.querySelector('#ntTime').value || null }); close(); };
      wrap.querySelector('#ntTitle').focus();
      wrap.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') close(); });
      wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); if (e.target.closest('[data-save]')) save(); });
    }

    function bind() {
      root.addEventListener('click', e => {
        const el = e.target.closest('[data-check],[data-day],[data-nav],[data-new],[data-ev],[data-task],[data-hour]');
        if (!el) return;
        const d = el.dataset;
        if (d.check) { e.stopPropagation(); P.toggleTask(d.check); }
        else if (d.day) { day = d.day; if (day.slice(0, 7) !== month) month = day.slice(0, 7); render(); }
        else if (d.nav) {
          if (d.nav === 'today') { day = P.today(); month = day.slice(0, 7); }
          else { const [y, m] = month.split('-').map(Number); const n = new Date(y, m - 1 + +d.nav, 1); month = P.ymd(n).slice(0, 7); }
          render();
        }
        else if (d.new === 'event') eventModal(null, day);
        else if (d.new === 'task') taskModal(day);
        else if (d.ev) eventModal(P.event(d.ev));
        else if (d.task) { window.go?.('Time/Todo'); }
        else if (d.hour) eventModal(null, day, `${String(d.hour).padStart(2, '0')}:00`);
      });
      // Drag events and tasks onto a day to reschedule
      root.addEventListener('dragstart', e => {
        const ev = e.target.closest('[data-ev]'), tk = e.target.closest('[data-task]');
        drag = ev ? { type: 'e', id: ev.dataset.ev } : tk ? { type: 't', id: tk.dataset.task } : null;
        if (!drag) return;
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag.id);
      });
      root.addEventListener('dragover', e => {
        const c = drag && e.target.closest('[data-day]');
        root.querySelectorAll('.cal-cell.drop').forEach(x => x !== c && x.classList.remove('drop'));
        if (c) { e.preventDefault(); c.classList.add('drop'); }
      });
      root.addEventListener('drop', e => {
        const c = drag && e.target.closest('[data-day]');
        if (!c) return;
        e.preventDefault();
        drag.type === 'e' ? P.updateEvent(drag.id, { date: c.dataset.day }) : P.updateTask(drag.id, { date: c.dataset.day });
        day = c.dataset.day; drag = null; render();
      });
      root.addEventListener('dragend', () => { drag = null; root.querySelectorAll('.cal-cell.drop').forEach(x => x.classList.remove('drop')); });
    }
    // Search hook: open myCalendar on a given day
    function openDay(date) { day = date; month = date.slice(0, 7); go('Time/Calendar'); }
    return { mount, openDay };
  })();

  return { Todo, Calendar, taskRow, animateCheck, time12, dayLabel, CHECK };
})();
