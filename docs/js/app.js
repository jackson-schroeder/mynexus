// Hidden tabs (mySettings) — saved to your account
const isHidden = path => { const h = Personal.prefs.hidden || [], [tab] = path.split('/'); return h.includes(tab) || h.includes(path); };
function applyTabs() {
  document.querySelectorAll('nav button[data-go]').forEach(b => (b.hidden = b.dataset.go !== 'Dashboard' && isHidden(b.dataset.go)));
  document.querySelectorAll('#dash [data-tab]').forEach(el => (el.hidden = isHidden(el.dataset.tab)));
  document.querySelectorAll('#subtabs [data-go]').forEach(b => (b.hidden = isHidden(b.dataset.go)));
  moveIndicator();
  if (current && current !== 'Settings' && current !== 'Dashboard' && isHidden(current)) go('Dashboard');
}
let current = 'Dashboard';
const SUBS = { Fitness: ['Lifting', 'Running', 'Diet'], Time: ['Todo', 'Calendar', 'Notes', 'Goals', 'Time'], Projects: [], Finance: [], Settings: [] };
const title = n => `<span class="my">my</span><span class="nm">${n}</span>`;

const LAST_KEY = 'nav.last';
const lastSub = (() => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) || {}; } catch { return {}; } })();
function resolve(path) {
  const [tab, sub] = path.split('/');
  if (sub || !SUBS[tab]?.length) return path;
  const visible = SUBS[tab].filter(x => !isHidden(tab + '/' + x));
  const pick = visible.includes(lastSub[tab]) ? lastSub[tab] : visible[0] || SUBS[tab][0];
  return tab + '/' + pick;
}
const ORDER = ['Dashboard', 'Fitness/Lifting', 'Fitness/Running', 'Fitness/Diet', 'Time/Todo', 'Time/Calendar', 'Time/Notes', 'Time/Goals', 'Time/Time', 'Projects', 'Finance', 'Settings'];
function slide(from, to) {
  const dir = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(from));
  const el = document.querySelector('.view.on');
  if (!dir || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([{ transform: `translateX(${dir * 60}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)' });
}
// The top-left title is a "back one level" button: inside a project it reads myProjects (click -> the projects hub),
// on a hub or any page it reads myNexus (click -> the dashboard).
const crumbs = () => {
  if (current === 'Projects' && typeof Projects !== 'undefined' && Projects.inBoard()) return { name: 'Projects', tip: 'Back to the myProjects hub', up: () => Projects.toHub() };
  if (current === 'Fitness/Lifting' && typeof FitnessUI !== 'undefined' && FitnessUI.onStats()) return { name: 'Lifting', tip: 'Back to myLifting', up: () => FitnessUI.toMain() };
  if (current === 'Fitness/Diet' && typeof DietUI !== 'undefined' && DietUI.onHistory()) return { name: 'Diet', tip: 'Back to myDiet', up: () => DietUI.toMain() };
  return { name: 'Nexus', tip: 'Back to myDashboard', up: () => { if (current !== 'Dashboard') go('Dashboard'); } };
};
function updateCrumb() {
  const h = document.getElementById('crumb'), c = crumbs();
  if (!h || h.dataset.crumb === c.name) return;
  const first = !h.dataset.crumb; h.dataset.crumb = c.name; h.title = c.tip;
  h.querySelector('.nm').textContent = c.name; h.querySelector('.ver').hidden = c.name !== 'Nexus';
  if (!first) h.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' });
}
window.crumbChanged = updateCrumb;
document.getElementById('crumb').addEventListener('click', () => crumbs().up());
function go(path) {
  path = resolve(path);
  const [tab, sub] = path.split('/');
  if (sub) { lastSub[tab] = sub; try { localStorage.setItem(LAST_KEY, JSON.stringify(lastSub)); } catch {} }
  const prev = current;
  current = path;
  if (prev.startsWith('Projects') && tab !== 'Projects') Projects.leave(); // clear the updates you saw
  requestAnimationFrame(() => slide(prev, path));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.go === tab));
  updateCrumb();
  moveIndicator();
  document.getElementById('dash').classList.toggle('on', tab === 'Dashboard');
  document.getElementById('page').classList.toggle('on', tab !== 'Dashboard');
  document.querySelectorAll('.view').forEach(v => { v.scrollTop = 0; v.scrollLeft = 0; }); // phone pages scroll: start each page at the top
  if (tab === 'Dashboard') return;
  // Pages that are built; everything else shows "Nothing here yet"
  const MODULES = { Projects: ['projectsRoot', el => Projects.mount(el)], 'Time/Todo': ['todoRoot', el => TimeUI.Todo.mount(el)], 'Time/Calendar': ['calRoot', el => TimeUI.Calendar.mount(el)], 'Time/Notes': ['notesRoot', el => NotesUI.mount(el)], Settings: ['settingsRoot', el => Account.mount(el)],
    'Fitness/Lifting': ['liftRoot', el => FitnessUI.lifting(el)], 'Fitness/Diet': ['dietRoot', el => DietUI.mount(el)], 'Fitness/Running': ['runRoot', el => FitnessUI.running(el)] };
  const mod = MODULES[sub ? tab + '/' + sub : tab];
  Object.values(MODULES).forEach(([id]) => (document.getElementById(id).hidden = !mod || mod[0] !== id));
  document.querySelector('#page .empty').hidden = !!mod;
  if (mod) mod[1](document.getElementById(mod[0]));
  const pt = document.getElementById('pageTitle');
  pt.innerHTML = title(sub || tab);
  pt.dataset.go = tab; // clicking a page's title goes back to that tab (its last sub-tab)
  document.getElementById('subtabs').innerHTML = SUBS[tab].map(s =>
    `<button class="tile${s === sub ? ' on' : ''}" data-go="${tab}/${s}" ${isHidden(tab + '/' + s) ? 'hidden' : ''}>${title(s)}</button>`).join('');
}
// Phone: swipe sideways to switch tabs (ignored over things that scroll sideways, fields and pop-ups)
(() => {
  let s = null;
  const tabs = () => [...document.querySelectorAll('nav button[data-go]:not([hidden])')].map(b => b.dataset.go);
  const scrollsX = el => { for (; el && el !== document.body; el = el.parentElement) { const o = getComputedStyle(el).overflowX; if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 2) return true; } return false; };
  document.addEventListener('touchstart', e => {
    const t = e.target, one = e.touches.length === 1;
    s = isPhone() && one && !t.closest('input, textarea, select, .pj-overlay, .gate:not([hidden]), .search-pop, .tl-wk, [draggable="true"]') && !scrollsX(t) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y; s = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const list = tabs(), i = list.indexOf(current.split('/')[0]), to = list[i + (dx < 0 ? 1 : -1)];
    if (i >= 0 && to) go(to);
  }, { passive: true });
})();
// Tab bar: handle is exactly as wide as the bar (which changes when tabs are hidden);
// the active highlight slides to the tab you open, and a softer one glides after your mouse
const place = (el, b) => { el.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`; el.style.width = b.offsetWidth + 'px'; };
function moveIndicator() {
  const nav = document.querySelector('nav'), ind = nav.querySelector('.indicator'), b = nav.querySelector('button.active:not([hidden])');
  document.querySelector('.navwrap').style.setProperty('--navw', nav.offsetWidth + 'px');
  ind.style.opacity = b ? 1 : 0;
  if (b) place(ind, b);
}
(() => {
  const nav = document.querySelector('nav'), dot = nav.querySelector('.hoverdot');
  nav.addEventListener('pointerover', e => {
    const b = e.target.closest('nav button');
    if (!b) return;
    if (!dot.classList.contains('on')) { dot.classList.add('jump'); place(dot, b); void dot.offsetWidth; dot.classList.remove('jump'); }
    else place(dot, b);
    dot.classList.add('on');
  });
  nav.addEventListener('pointerleave', () => dot.classList.remove('on'));
})();
// myRecents: activity lives in the Personal store so it's saved to your account
window.logActivity = (path, text) => Personal.logActivity(path, text);
function ago(t) {
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}
function renderUpdates() {
  document.getElementById('updates').innerHTML = Personal.activity.slice(0, 3).map(u =>
    `<div class="row tile" data-go="${u.path}"><div><div class="it">${u.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div><div class="p">${title(u.path.split('/').pop())}</div></div><div class="r">${ago(u.at)}</div></div>`).join('') || '<div class="p dash-empty">Your latest changes show up here.</div>';
}
renderUpdates();

// Dashboard myProjects: newest projects with progress, live from the projects store
function renderDashProjects() {
  const ps = Store.myProjects().slice(-3).reverse();
  document.getElementById('dashProjects').innerHTML = ps.map(p => {
    const { finished, total, pct } = Store.progress(p.id);
    return `<div class="row tile" data-go="Projects"><div><div class="it">${p.name.replace(/</g, '&lt;')}</div><div class="p">${finished} of ${total} cards in final step</div></div><div class="prog"><b style="width:${pct}%"></b></div><div class="r">${pct}%</div></div>`;
  }).join('') || `<div class="row tile" data-go="Projects"><div class="it">+ Start a Project</div></div>`;
}
Store.subscribe(renderDashProjects);

// Dashboard myCalendar (today's events + timed tasks) and myTodo (next open tasks) — live from the same store as the pages
function renderDashTime() {
  const t = Personal.today(), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const now = new Date().toTimeString().slice(0, 5);
  const items = [...Personal.eventsOn(t).map(e => ({ at: e.allDay ? '' : e.start, title: e.title, sub: e.allDay ? 'All day' : TimeUI.time12(e.start) + ' – ' + TimeUI.time12(e.end), c: `var(--ev-${e.color})`, end: e.allDay ? '24:00' : e.end })),
    ...Personal.tasksOn(t).filter(x => x.time).map(x => ({ at: x.time, title: x.title, sub: x.done ? 'Done' : 'Task', c: 'var(--icon-a)', end: x.time }))]
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  const next = items.find(i => i.end >= now);
  document.getElementById('dashAgenda').innerHTML = items.slice(0, 5).map(i =>
    `<div class="ev" style="--c:${i.c}"><span class="tm">${i.at ? TimeUI.time12(i.at) : 'All day'}</span><span class="bar"></span><div><div class="it">${esc(i.title)}</div><div class="p">${i === next ? 'Next up · ' : ''}${i.sub}</div></div></div>`).join('')
    || '<div class="p dash-empty">Nothing scheduled today. Open myCalendar to add something.</div>';
  const open = Personal.tasks.filter(x => !x.done).sort((a, b) => ((a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : Personal.byTime(a, b)));
  document.getElementById('dashTodo').innerHTML = open.slice(0, 3).map(x => TimeUI.taskRow(x)).join('')
    || '<div class="row tile" data-go="Time/Todo"><div class="it">+ Add a task</div></div>';
}
Personal.subscribe(renderDashTime);
Personal.subscribe(renderUpdates);
Personal.subscribe(applyTabs);
applyTabs();
renderDashTime();
setInterval(renderDashTime, 60000);
document.getElementById('dashTodo').addEventListener('click', e => {
  const c = e.target.closest('[data-check]');
  if (c) { e.stopPropagation(); TimeUI.animateCheck(c); }
  else if (e.target.closest('[data-task]')) go('Time/Todo');
});
renderDashProjects();
FitnessUI.dashCard(document.getElementById('dashFitness'));
Personal.subscribe(() => FitnessUI.dashCard(document.getElementById('dashFitness')));
Store.start().then(() => Personal.start());

moveIndicator();
addEventListener('resize', moveIndicator);
document.fonts?.ready.then(moveIndicator); // labels change width once the font loads
document.addEventListener('click', e => { const t = e.target.closest('[data-go]'); if (t) go(t.dataset.go); });

const WX = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01"/>',
  storm: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M13 15l-2 4h3l-2 4"/>'
};
const wxKind = c => c <= 1 ? 'sun' : c <= 48 ? 'cloud' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'rain';
function showWeather(w) { document.getElementById('weather').innerHTML = `<svg viewBox="0 0 24 24">${WX[wxKind(w.code)]}</svg><div>${Math.round(w.temp)}°F<small>${w.city || ''}</small></div>`; }
async function loadWeather() {
  try { const c = JSON.parse(localStorage.getItem('wx')); if (c) showWeather(c); } catch {}
  try {
    const loc = await (await fetch('https://ipapi.co/json/')).json();
    const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)).json();
    const w = { temp: r.current.temperature_2m, code: r.current.weather_code, city: [loc.city, loc.region_code].filter(Boolean).join(', ') };
    showWeather(w);
    try { localStorage.setItem('wx', JSON.stringify(w)); } catch {}
  } catch {}
}
loadWeather();
setInterval(loadWeather, 30 * 60 * 1000);

document.getElementById('date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
