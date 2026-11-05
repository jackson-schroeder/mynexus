// Search everything in myNexus. It's a library of providers: each returns items { title, kind, sub?, keys?, go() }.
// To make something new searchable, call Search.add(() => [...items]) — static pages/sections below, live data (exercises,
// tasks, events, projects, cards…) is read fresh on every search so it's always up to date.
const Search = (() => {
  const providers = [];
  const add = fn => providers.push(fn);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nice = t => (/^my[A-Z]/.test(t) ? `<span class="my">my</span><span class="nm">${esc(t.slice(2))}</span>` : esc(t));

  // ---------- Pages, sections, settings, actions ----------
  const page = (title, path, keys = '', sub = '') => ({ title, kind: 'Page', sub, keys, go: () => go(path) });
  const section = (title, path, sub, keys = '') => ({ title, kind: 'Section', sub, keys, go: () => go(path) });
  const setting = (title, keys = '') => ({ title, kind: 'Setting', sub: 'mySettings', keys, go: () => go('Settings') });
  const action = (title, sub, keys, fn) => ({ title, kind: 'Action', sub, keys, go: fn });
  add(() => [
    page('myDashboard', 'Dashboard', 'home main overview summary start'),
    page('myFitness', 'Fitness', 'health workout exercise gym training'),
    page('myLifting', 'Fitness/Lifting', 'gym weights strength sets reps muscles', 'myFitness'),
    page('myRunning', 'Fitness/Running', 'run cardio miles pace jog', 'myFitness'),
    page('myDiet', 'Fitness/Diet', 'food nutrition calories meals protein carbs sugar fat macros', 'myFitness'),
    page('myTime', 'Time', 'schedule planning'),
    page('myTodo', 'Time/Todo', 'tasks to do list checklist', 'myTime'),
    page('myCalendar', 'Time/Calendar', 'events schedule month day agenda', 'myTime'),
    page('myGoals', 'Time/Goals', 'goals targets', 'myTime'),
    page('myTime', 'Time/Time', 'timer tracking', 'myTime'),
    page('myProjects', 'Projects', 'board kanban cards team friends collaborate'),
    page('myFinance', 'Finance', 'money budget spending bank'),
    page('mySettings', 'Settings', 'preferences options account'),
    section('myRecents', 'Dashboard', 'myDashboard', 'recent activity history latest updates'),
    section('Today\'s calendar', 'Dashboard', 'myDashboard', 'agenda next up'),
    section('Muscle balance', 'Fitness/Lifting', 'myLifting', 'radar chart muscle groups pecs delts triceps biceps lats traps abs glutes quads hamstrings'),
    section('Last session', 'Fitness/Lifting', 'myLifting', 'last workout recent'),
    section('Personal records', 'Fitness/Lifting', 'myLifting', 'pr prs best max heaviest'),
    { title: 'Lift stats', kind: 'Section', sub: 'myLifting', keys: 'progress chart graph improvement 1rm one rep max history', go: () => FitnessUI.showStats() },
    section('Training mix', 'Fitness/Running', 'myRunning', 'radar effort easy tempo intervals'),
    section('Nutrients today', 'Fitness/Diet', 'myDiet', 'radar protein carbs fat sugar fiber sodium'),
    section('Calories', 'Fitness/Diet', 'myDiet', 'kcal energy goal'),
    section('Most urgent tasks', 'Time/Todo', 'myTodo', 'urgent overdue priority summary'),
    setting('Account', 'profile login username email password'),
    setting('Sign in', 'log in login account'),
    setting('Create account', 'sign up register new account'),
    setting('Sign out', 'log out logout'),
    setting('Tabs', 'hide show turn off remove add back sections'),
    setting('Demo data', 'example sample dummy fake data'),
    action('Log workout', 'myLifting', 'add workout train push pull legs split', () => FitnessUI.openLog('workout')),
    section('Project timeline', 'Projects', 'myProjects', 'timeline weeks phases portions start end date schedule assign cards my cards all cards'),
    section('Project updates', 'Projects', 'myProjects', 'updates activity feed unread news changes message chat conversation group send'),
    section('Weekly miles', 'Fitness/Running', 'myRunning', 'running chart miles per week 3 month year'),
    action('Log meal', 'myDiet', 'log food eat ate meal breakfast lunch dinner snack', () => { go('Fitness/Diet'); DietUI.logMeal(); }),
    action('Add meal', 'myDiet', 'create new custom meal recipe ingredients macros', () => { go('Fitness/Diet'); DietUI.addMeal(); }),
    action('Build a smoothie', 'myDiet', 'smoothie shake blend fruit protein', () => { go('Fitness/Diet'); DietUI.smoothie(); }),
    { title: 'Eating history', kind: 'Section', sub: 'myDiet', keys: 'diet history past eating habits weekly quarterly yearly calories chart', go: () => DietUI.showHistory() },
    action('Edit lift stats', 'Lift stats', 'add edit remove entry entries history sets fix stats', () => FitnessUI.showStats()),
    action('Log exercise', 'myLifting', 'add single exercise forgot past date', () => FitnessUI.openLog('exercise')),
    action('Add a task', 'myTodo', 'new task todo', () => { go('Time/Todo'); setTimeout(() => document.getElementById('tdNew')?.focus(), 50); }),
    action('Add an event', 'myCalendar', 'new event appointment', () => { go('Time/Calendar'); setTimeout(() => document.querySelector('#calRoot [data-new="event"]')?.click(), 50); }),
    action('Start a Project', 'myProjects', 'new project board', () => { go('Projects'); setTimeout(() => document.querySelector('#projectsRoot [data-act="new"]')?.click(), 50); })
  ]);

  // ---------- Your data ----------
  add(() => FitnessUI.exerciseNames().map(n => ({ title: n, kind: 'Exercise', sub: 'Lift stats', keys: 'exercise lift stats progress', go: () => FitnessUI.openStats(n) })));
  add(() => FitnessUI.splitNames().map(n => ({ title: n + ' workout', kind: 'Split', sub: 'Log workout', keys: 'split workout ' + n, go: () => FitnessUI.openLog('workout') })));
  add(() => Personal.tasks.filter(t => !t.done).map(t => ({ title: t.title, kind: 'Task', sub: t.date ? TimeUI.dayLabel(t.date) : 'Anytime', keys: 'task todo', go: () => TimeUI.Todo.edit(t.id) })));
  add(() => Personal.events.map(e => ({ title: e.title, kind: 'Event', sub: TimeUI.dayLabel(e.date) + (e.allDay ? ' · All day' : ' · ' + TimeUI.time12(e.start)), keys: 'event calendar', go: () => TimeUI.Calendar.openDay(e.date) })));
  add(() => (typeof Store === 'undefined' ? [] : Store.myProjects().map(p => ({ title: p.name, kind: 'Project', sub: 'myProjects', keys: 'project board', go: () => Projects.open(p.id) }))));
  add(() => (typeof Store === 'undefined' ? [] : Store.myProjects().flatMap(p => Store.projectCards(p.id).map(c => ({ title: c.title, kind: 'Card', sub: p.name, keys: 'card ' + (c.description || '').slice(0, 200), go: () => Projects.open(p.id, c.id) })))));

  add(() => DietUI.myMeals().map(m => ({ title: m.name, kind: 'Meal', sub: 'My meals · ' + m.kcal + ' kcal', keys: 'meal food', go: () => { go('Fitness/Diet'); DietUI.logMeal(m.name); } })));
  add(() => FOODS.map(f => ({ title: f.name, kind: 'Food', sub: f.kcal + ' kcal · ' + f.protein + ' g protein', keys: f.cat, go: () => { go('Fitness/Diet'); DietUI.logMeal(f.name); } })));

  // ---------- Matching ----------
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function find(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const all = providers.flatMap(p => { try { return p(); } catch { return []; } });
    const seen = new Set();
    return all.map(it => {
      const t = norm(it.title), t2 = t.replace(/^my/, ''), hay = `${t} ${norm(it.sub)} ${norm(it.kind)} ${norm(it.keys)}`;
      if (!words.every(w => hay.includes(w))) return null;
      const q0 = words.join(' ');
      let score = t === q0 || t2 === q0 ? 100 : t.startsWith(q0) || t2.startsWith(q0) ? 80 : new RegExp('\\b' + q0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t) ? 60 : t.includes(q0) ? 45 : 20;
      score += { Page: 6, Action: 5, Exercise: 4, Section: 3, Meal: 3, Food: -4 }[it.kind] || 0;
      return { ...it, score: score - t.length / 100 };
    }).filter(Boolean).sort((a, b) => b.score - a.score)
      .filter(it => { const k = it.kind + '|' + it.title + '|' + it.sub; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  }

  // ---------- Search bar ----------
  const input = document.getElementById('searchIn'), pop = document.createElement('div');
  pop.className = 'search-pop glass';
  pop.hidden = true;
  document.body.appendChild(pop);
  let results = [], sel = 0;
  function place() { const r = input.closest('.search').getBoundingClientRect(); Object.assign(pop.style, { left: r.left + 'px', top: r.bottom + 8 + 'px', width: r.width + 'px' }); }
  function show() {
    results = find(input.value);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    if (!input.value.trim()) { pop.hidden = true; return; }
    place();
    pop.innerHTML = results.length ? results.map((r, i) => `<button class="search-row${i === sel ? ' on' : ''}" data-i="${i}">
        <span class="search-kind">${r.kind}</span><span class="search-title">${nice(r.title)}</span><span class="search-sub">${nice(r.sub || '')}</span></button>`).join('')
      : `<div class="search-none">Nothing found for “${esc(input.value.trim())}”</div>`;
    pop.hidden = false;
  }
  function choose(i) {
    const r = results[i];
    if (!r) return;
    input.value = ''; pop.hidden = true; input.blur();
    r.go();
  }
  input.addEventListener('input', () => { sel = 0; show(); });
  input.addEventListener('focus', show);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length); show(); }
    else if (e.key === 'Enter') choose(sel);
    else if (e.key === 'Escape') { input.value = ''; pop.hidden = true; input.blur(); }
  });
  pop.addEventListener('pointerdown', e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); choose(+b.dataset.i); } });
  pop.addEventListener('pointermove', e => { const b = e.target.closest('[data-i]'); if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; pop.querySelectorAll('.search-row').forEach((x, i) => x.classList.toggle('on', i === sel)); } });
  input.addEventListener('blur', () => setTimeout(() => (pop.hidden = true), 120));
  addEventListener('resize', () => !pop.hidden && place());
  // Ctrl+K (or "/") jumps to search from anywhere
  addEventListener('keydown', e => {
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName))) { e.preventDefault(); input.focus(); input.select(); }
  });

  return { add, find };
})();
