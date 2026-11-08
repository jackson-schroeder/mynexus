// myFitness overview, myLifting, myRunning and myDiet. Everything shown comes from what you log (no demo data).
const FitnessUI = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const title = n => `<span class="my">my</span><span class="nm">${n}</span>`;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ---------- Radar chart (hexagon-style grid, gradient fill, labels with %) ----------
  let rid = 0;
  function radar(axes, { size = 320, label = '' } = {}) {
    const n = axes.length, c = size / 2, r = size * 0.32, id = 'rg' + (++rid);
    const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f]; };
    const poly = f => axes.map((_, i) => pt(i, f).join(',')).join(' ');
    const empty = axes.every(([, v]) => !v);
    const shape = axes.map(([, v], i) => pt(i, Math.max(.04, v / 100)).join(',')).join(' ');
    const labels = axes.map(([name, v], i) => {
      const [x, y] = pt(i, 1.3), anchor = Math.abs(x - c) < 4 ? 'middle' : x > c ? 'start' : 'end';
      return `<text x="${x}" y="${y - 6}" text-anchor="${anchor}" class="rd-name">${esc(name)}</text><text x="${x}" y="${y + 12}" text-anchor="${anchor}" class="rd-val">${v}%</text>`;
    }).join('');
    return `<svg class="radar" viewBox="${-size * .12} 0 ${size * 1.24} ${size}" role="img" aria-label="${esc(label)}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--name-3);stop-opacity:.6"/><stop offset="1" style="stop-color:var(--name-2);stop-opacity:.18"/></linearGradient></defs>
      ${[.25, .5, .75].map(f => `<polygon points="${poly(f)}" class="rd-ring"/>`).join('')}
      <polygon points="${poly(1)}" class="rd-outer"/>
      ${axes.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}" class="rd-spoke"/>`).join('')}
      ${empty ? '' : `<g class="rd-shape" style="transform-origin:${c}px ${c}px"><polygon points="${shape}" fill="url(#${id})" class="rd-fill"/>
        ${axes.map(([, v], i) => { const [x, y] = pt(i, Math.max(.04, v / 100)); return `<circle cx="${x}" cy="${y}" r="3.5" class="rd-dot"/>`; }).join('')}</g>`}
      ${labels}</svg>`;
  }

  // Streak badge (no bubble): a purple-white flame, then "N streak". The flame grows bigger and brighter with the streak: faint ember at 0, full blaze at 30 days.
  // Shared by myLifting (workout days) and myDiet (days on target).
  function streakBadge(n, tip = 'day workout streak', hint = 'log a workout to light it up') {
    // grows a little every day and peaks at 30 days
    const t = Math.min(n, 30) / 30, heat = n ? 1 : 0;
    const vars = `--fs:${(.55 + .6 * t).toFixed(3)};--fo:${n ? (.7 + .3 * t).toFixed(3) : .3};--fspd:${(1.9 - 1.1 * t).toFixed(2)}s;--glow:${(3 + 15 * t).toFixed(1)}px;--ga:${(.3 + .6 * t).toFixed(2)};--br:${(1 + .5 * t).toFixed(2)}`;
    return `<div class="fx-streak ${heat ? 'hot' : 'heat0'} tip" style="${vars}" data-tip="${n} ${tip}${heat ? '' : ' · ' + hint}">
      <svg viewBox="0 0 64 64" class="st-logo" aria-hidden="true">
        <g class="st-fire">
          <path class="fl f1" d="M32 60C18 60 10 50 12 38c1-7 6-11 7-19 4 5 4 9 4 12 2-9 7-15 6-27 9 7 14 17 13 27 2-3 3-7 2-11 6 6 10 14 9 22-1 12-9 18-21 18z"/>
          <path class="fl f2" d="M32 58c-9 0-15-7-14-15 1-6 5-8 6-14 3 4 3 7 3 9 2-6 5-10 5-18 6 5 9 12 9 19 1-2 2-4 1-7 4 4 6 9 5 14-1 7-6 12-15 12z"/>
        </g>
      </svg>
      <b>${n}</b><span class="st-word">streak</span></div>`;
  }
  const stat = (n, l, sub) => `<div class="tile fx-stat"><b>${n}</b><span>${l}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const emptyCard = (msg, sub) => `<div class="fx-empty"><div class="it">${msg}</div><div class="p">${sub}</div></div>`;

  // ---------- Lifting data: saved to your account ----------
  // Splits: [{ id, name, exercises: [names] }]. Sessions (newest first): [{ id, at, split, exercises: [{ name, sets: [{ reps, weight }] }] }]
  const DEFAULT_SPLITS = [
    ['Push', ['Bench press', 'Overhead press', 'Incline DB press', 'Tricep pushdown']],
    ['Pull', ['Deadlift', 'Pull-ups', 'Barbell row', 'Hammer curl']],
    ['Legs', ['Squat', 'Romanian deadlift', 'Leg press', 'Calf raise']],
    ['Abs', ['Hanging leg raise', 'Cable crunch', 'Plank']]
  ].map(([name, exercises]) => ({ id: crypto.randomUUID(), name, exercises }));
  const Lift = {
    get splits() { return Personal.getKv('lift.splits', null) || DEFAULT_SPLITS; },
    set splits(v) { Personal.setKv('lift.splits', v); },
    get real() { return Personal.getKv('lift.sessions', []); },          // what you logged (edits always use this)
    get sessions() { const r = this.real; return r.length || !Personal.demoOn ? r : demoSessions(); }, // what's shown
    get demo() { return !this.real.length && Personal.demoOn; },
    set sessions(v) { Personal.setKv('lift.sessions', v.slice().sort((a, b) => b.at - a.at)); }
  };
  let demoCache = null;
  function demoSessions() {
    const day = new Date().toDateString();
    if (demoCache?.day === day) return demoCache.list;
    const PLAN = [['Push', [['Bench press', 155, 8], ['Overhead press', 85, 10], ['Incline DB press', 50, 12], ['Tricep pushdown', 40, 15]]],
      ['Pull', [['Deadlift', 225, 5], ['Pull-ups', 0, 8], ['Barbell row', 115, 10], ['Hammer curl', 25, 12]]],
      ['Legs', [['Squat', 185, 5], ['Romanian deadlift', 155, 10], ['Leg press', 270, 12], ['Calf raise', 70, 15]]]];
    const list = [];
    for (let i = 0, d = 120; d >= 0; i++, d -= 2) {
      const [split, lifts] = PLAN[i % 3], gain = Math.floor((120 - d) / 6) * 2.5;
      list.push({ id: 'demo-s' + i, demo: true, at: Date.now() - d * 864e5 - 3 * 36e5, split,
        exercises: lifts.map(([name, w, reps]) => ({ name, sets: [0, 1, 2].map(j => ({ reps: reps - (j === 2 ? 1 : 0), weight: w ? Math.round((w + gain * (w > 150 ? 2 : 1)) / 2.5) * 2.5 : '' })) })) });
    }
    demoCache = { day, list: list.reverse() };
    return demoCache.list;
  }
  const demoTag = '<span class="fx-demo">Demo data</span>';
  const volume = s => s.exercises.reduce((a, e) => a + e.sets.reduce((b, x) => b + (+x.reps || 0) * (+x.weight || 0), 0), 0);
  const thisWeek = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return Lift.sessions.filter(s => s.at >= d.getTime()); };
  const whenLabel = at => { const d = new Date(at), diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 864e5);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff > 1 && diff < 7 ? DOW[d.getDay()] : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  // Days in a row (ending today or yesterday) with at least one workout
  function streak() {
    const days = new Set(Lift.sessions.map(s => ymd(new Date(s.at)))), d = new Date();
    if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // Muscle chart from what you logged this week: sets per muscle, relative to your most-trained muscle
  const MUSCLES = ['Pecs', 'Delts', 'Triceps', 'Biceps', 'Lats', 'Traps', 'Abs', 'Glutes', 'Quads', 'Hamstrings'];
  const WORKS = [
    [/bench|chest|push.?up|fly|flye|pec|dip/, ['Pecs']], [/bench|incline|dip|push.?up|close.?grip|tricep|pushdown|skull|extension(?!.*leg)/, ['Triceps']],
    [/overhead|shoulder|military|arnold|lateral|delt|incline|face pull|upright/, ['Delts']], [/curl(?!.*leg)|bicep|hammer|chin/, ['Biceps']],
    [/pull.?up|chin|pulldown|lat|row/, ['Lats']], [/shrug|trap|face pull|upright|deadlift|row/, ['Traps']],
    [/crunch|plank|leg raise|sit.?up|\babs?\b|core|russian|twist|rollout/, ['Abs']], [/squat|lunge|hip thrust|glute|deadlift|bridge|leg press|step.?up/, ['Glutes']],
    [/squat|leg press|lunge|leg extension|quad|step.?up|hack/, ['Quads']], [/deadlift|rdl|romanian|hamstring|leg curl|good morning/, ['Hamstrings']]
  ];
  function muscleAxes(sessions = thisWeek()) {
    const sets = Object.fromEntries(MUSCLES.map(m => [m, 0]));
    sessions.forEach(s => s.exercises.forEach(e => { const n = e.name.toLowerCase(); WORKS.forEach(([re, ms]) => { if (re.test(n)) ms.forEach(m => (sets[m] += e.sets.length)); }); }));
    const max = Math.max(...Object.values(sets));
    return MUSCLES.map(m => [m, max ? Math.round(sets[m] / max * 100) : 0]);
  }

  // "3 × 8 · 185 lb" when every set matches, otherwise each set listed
  function setsText(sets) {
    const same = sets.every(x => x.reps === sets[0].reps && x.weight === sets[0].weight);
    const w = x => (x.weight ? `${x.weight} lb` : 'BW');
    return same ? [`${sets.length} × ${sets[0].reps}`, w(sets[0])] : [sets.map(x => `${x.reps}×${x.weight || 'BW'}`).join(', '), ''];
  }
  // Last time you did an exercise → prefill its sets next time
  const lastSets = name => { for (const s of Lift.sessions) { const e = s.exercises.find(x => x.name.toLowerCase() === name.toLowerCase()); if (e) return e.sets.map(x => ({ ...x })); } return [{ reps: 10, weight: '' }]; };

  function sessionCard(s, flat) {
    return `<div class="${flat ? 'fx-session flat' : 'tile fx-session'}"><div class="pj-row"><div><div class="it fx-sname">${esc(s.split)}</div>
      <div class="p">${whenLabel(s.at)} · ${s.exercises.length} exercise${s.exercises.length === 1 ? "" : "s"} · ${volume(s).toLocaleString()} lb volume</div></div>
      <span class="pj-spacer"></span>${flat || s.demo ? '' : `<button class="pj-x" data-delsession="${s.id}" title="Delete workout">×</button>`}</div>
      <div class="fx-lifts" data-fit>${s.exercises.map(e => { const [a, b] = setsText(e.sets); return `<div class="fx-lift"><span>${esc(e.name)}</span><span class="p">${a}</span><b>${b}</b></div>`; }).join('')}</div><span class="p fit-more" hidden></span></div>`;
  }
  const radarFoot = axes => { const on = axes.filter(([, v]) => v).sort((a, b) => b[1] - a[1]), off = axes.filter(([, v]) => !v);
    return on.length ? `<div class="fx-foot"><span class="p">Most worked</span>${on.slice(0, 3).map(([n]) => `<span class="chip">${n}</span>`).join('')}
      ${off.length ? `<span class="pj-spacer"></span><span class="p">Not yet</span>${off.slice(0, 3).map(([n]) => `<span class="chip">${n}</span>`).join('')}` : ''}</div>` : '<div class="p">Log a workout and this fills in automatically.</div>'; };

  // ---------- Pages ----------
  // ---------- Lift stats (second page of myLifting) ----------
  // Pick any exercise you've logged and see its progress over 1 month (default), 1 year or all time.
  const statsView = { ex: null, range: 'month', q: '' };
  const RANGES = [['month', '1M', 30], ['year', '1Y', 365], ['all', 'All', Infinity]];
  const e1rm = x => (+x.weight || 0) * (1 + (+x.reps || 0) / 30); // Epley estimate of your one-rep max
  // One point per day you did the exercise (oldest first)
  function history(name) {
    const byDay = {};
    Lift.sessions.forEach(s => s.exercises.filter(e => e.name.toLowerCase() === name.toLowerCase()).forEach(e => {
      const day = ymd(new Date(s.at)), d = (byDay[day] ||= { at: new Date(day + 'T12:00').getTime(), sets: [] });
      d.sets.push(...e.sets);
    }));
    return Object.values(byDay).sort((a, b) => a.at - b.at).map(d => {
      const best = d.sets.reduce((b, x) => (e1rm(x) > e1rm(b) ? x : b), d.sets[0]);
      return { at: d.at, sets: d.sets, best, top: Math.max(...d.sets.map(x => +x.weight || 0)), e1rm: Math.round(e1rm(best)),
        volume: d.sets.reduce((a, x) => a + (+x.reps || 0) * (+x.weight || 0), 0), reps: d.sets.reduce((a, x) => a + (+x.reps || 0), 0) };
    });
  }
  function allExercises() {
    const seen = {};
    Lift.sessions.forEach(s => s.exercises.forEach(e => { const k = e.name.toLowerCase(); if (!seen[k] || s.at > seen[k].last) seen[k] = { name: e.name, last: s.at, n: (seen[k]?.n || 0) + 1 }; else seen[k].n++; }));
    return Object.values(seen).sort((a, b) => b.last - a.last);
  }

  // Line chart with gradient area, dots and axis labels
  function lineChart(points, key, unit, label = '1RM', fmtDay, width = 1000) {
    const W = width, H = 330, L = 46, R = 14, T = 16, B = 30; // drawn near its on-screen size so labels stay crisp
    if (!points.length) return `<div class="ls-nochart p">No sessions in this range.</div>`;
    const vals = points.map(p => p[key]), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * .15 || Math.max(5, hi * .1);
    const y0 = Math.max(0, lo - pad), y1 = hi + pad, t0 = points[0].at, t1 = points[points.length - 1].at;
    const x = t => (t1 === t0 ? (L + W - R) / 2 : L + (t - t0) / (t1 - t0) * (W - L - R)), y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
    const area = `${line} L${x(t1).toFixed(1)} ${H - B} L${x(t0).toFixed(1)} ${H - B} Z`;
    const ticks = [0, .5, 1].map(f => y0 + (y1 - y0) * f);
    const fmt = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const xt = t1 === t0 ? [t0] : [t0, (t0 + t1) / 2, t1];
    return `<svg class="ls-chart" viewBox="0 0 ${W} ${H}">
      <defs><linearGradient id="lsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--name-3);stop-opacity:.45"/><stop offset="1" style="stop-color:var(--name-2);stop-opacity:0"/></linearGradient></defs>
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="ls-grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ls-ax">${Math.round(v).toLocaleString()}</text>`).join('')}
      ${xt.map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle" class="ls-ax">${fmt(t)}</text>`).join('')}
      ${points.length > 1 ? `<path d="${area}" fill="url(#lsArea)"/><path d="${line}" class="ls-line"/>` : ''}
      ${points.map(p => `<circle cx="${x(p.at)}" cy="${y(p[key])}" r="5" class="ls-dot" data-lsday="${ymd(new Date(p.at))}" data-v="${p[key].toLocaleString()} ${unit}" data-d="${fmtDay ? fmtDay(p.at) : new Date(p.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}" data-s="${p.note ?? (p.sets ? setsText(p.sets).filter(Boolean).join(' · ') : '')}" data-l="${label}"></circle>`).join('')}
    </svg>`;
  }

  function statsPage() {
    const list = allExercises();
    if (!list.length) return `<div class="ls-wrap"><section class="tile fx-card ls-empty">${emptyCard('No lift stats yet', 'Log a workout and every exercise gets its own progress chart here.')}</section></div>`;
    if (!statsView.ex || !list.some(e => e.name === statsView.ex)) statsView.ex = list[0].name;
    const all = history(statsView.ex), days = RANGES.find(r => r[0] === statsView.range)[2];
    const pts = all.filter(p => p.at >= Date.now() - days * 864e5);
    const mk = 'e1rm', mLabel = '1RM', unit = 'lb'; // the chart always shows estimated 1-rep max
    const first = pts[0]?.[mk], lastV = pts[pts.length - 1]?.[mk], change = pts.length > 1 ? lastV - first : 0;
    const pctCh = pts.length > 1 && first ? Math.round(change / first * 100) : 0;
    const bestSet = all.reduce((b, p) => (e1rm(p.best) > e1rm(b) ? p.best : b), all[0].best);
    const q = statsView.q.toLowerCase();
    return `<div class="ls-wrap">
      <aside class="tile fx-card ls-list">
        <div class="fx-h"><h3>Lift stats</h3>${Lift.demo ? demoTag : ''}</div>
        <input class="pj-in" id="lsSearch" placeholder="Find an exercise…" value="${esc(statsView.q)}">
        <div class="ls-items">${list.filter(e => !q || e.name.toLowerCase().includes(q)).map(e => `<button class="ls-item${e.name === statsView.ex ? ' on' : ''}" data-lsex="${esc(e.name)}"><span>${esc(e.name)}</span><span class="p">${e.n}×</span></button>`).join('')}</div>
      </aside>
      <section class="tile fx-card ls-main">
        <div class="fx-h"><h3>${esc(statsView.ex)}</h3><div class="ls-actions"><button class="tile pj-btn lg-log" data-lsadd>+ Add entry</button><button class="tile pj-btn lg-log" data-lsentries>Entries</button></div>
          <div class="td-seg ls-seg">${RANGES.map(([k, l]) => `<button class="${statsView.range === k ? 'on' : ''}" data-lsrange="${k}">${l}</button>`).join('')}</div></div>
        <div class="ls-chartwrap"><span class="ls-unit tip" data-tip="1 Rep Max">1RM</span>${lineChart(pts, mk, unit)}<div class="ls-tip" hidden></div></div>
        <div class="ls-stats">
          ${[[pts.length ? `${lastV.toLocaleString()} <small>${unit}</small>` : '—', `Latest · ${mLabel}`],
            [pts.length > 1 ? `${change >= 0 ? '+' : ''}${change.toLocaleString()} <small>${unit}</small>` : '—', `Change${pts.length > 1 ? ` · ${pctCh >= 0 ? '+' : ''}${pctCh}%` : ''}`],
            [`${Math.max(...all.map(p => p.top)).toLocaleString()} <small>${unit}</small>`, 'Heaviest ever'],
            [`${bestSet.reps} × ${bestSet.weight || 'BW'}`, 'Best set (est. 1RM)'],
            [pts.length, `Session${pts.length === 1 ? '' : 's'} in range`],
            [pts.reduce((a, p) => a + p.volume, 0).toLocaleString() + ` <small>${unit}</small>`, 'Volume in range']]
            .map(([v, l], i) => `<div class="ls-stat${i === 1 && pts.length > 1 ? (change >= 0 ? ' up' : ' down') : ''}"><b>${v}</b><span>${l}</span></div>`).join('')}
        </div>
      </section></div>`;
  }

  // Page glide: myLifting has two full pages stacked vertically. A scroll moves one whole page with a smooth glide
  // that can't be interrupted; further scrolling is ignored until it has landed. Lists inside still scroll normally.
  let liftPage = 0, paging = false;
  function setLiftPage(i) {
    const track = document.querySelector('#liftRoot .lg-track');
    i = Math.max(0, Math.min(1, i));
    if (!track || i === liftPage || paging) return;
    liftPage = i; paging = true; window.crumbChanged?.();
    track.style.willChange = 'transform';
    track.style.transition = 'transform .8s cubic-bezier(.65,0,.35,1)';
    track.style.transform = `translateY(${-i * 100}%)`;
    const done = () => { track.style.willChange = ''; track.removeEventListener('transitionend', done); clearTimeout(fallback); setTimeout(() => (paging = false), 450); };
    const fallback = setTimeout(done, 1200);
    track.addEventListener('transitionend', done);
  }
  const scrollsItself = (e, root) => { const l = e.target.closest('.ls-items, .tm-groups, .cal-tl, .pj-cards'); if (!l || !root.contains(l) || l.scrollHeight <= l.clientHeight + 1) return false;
    return e.deltaY < 0 ? l.scrollTop > 0 : l.scrollTop + l.clientHeight < l.scrollHeight - 1; };

  // myLifting = two full-height pages (overview, lift stats); scrolling snaps to one page or the other
  function lifting(el) {
    const sessions = Lift.sessions, last = sessions[0], week = thisWeek(), axes = muscleAxes(week);
    const prs = {};
    sessions.forEach(s => s.exercises.forEach(e => e.sets.forEach(x => { if (+x.weight > (prs[e.name] || 0)) prs[e.name] = +x.weight; })));
    const prList = Object.entries(prs).sort((a, b) => b[1] - a[1]).slice(0, 4);
    el.innerHTML = `<div class="lg-pages"><div class="lg-track" style="transform:translateY(${-liftPage * 100}%)"><div class="lg-page"><div class="fx-wrap"><div class="fx-split lift">
      <section class="tile fx-card fx-radar-card fx-sm">
        <div class="fx-h"><h3>Muscle balance</h3>${Lift.demo ? demoTag : ''}</div>
        <div class="p">Sets per muscle this week, compared to your most-trained muscle</div>
        ${radar(axes, { size: 300, label: 'Muscle balance' })}
        ${radarFoot(axes)}
      </section>
      <div class="fx-col">
        <div class="fx-stats st-row">${streakBadge(streak())}${stat(week.length, 'Workouts this week')}</div>
        <section class="tile fx-card fx-fill">
          <div class="fx-h"><h3>Last session</h3>${Lift.demo ? demoTag : ''}<div class="lg-actions"><button class="tile pj-btn primary lg-log" data-log>+ Log workout</button><button class="tile pj-btn lg-log" data-logex>+ Log exercise</button></div></div>
          ${last ? sessionCard(last) : `<div class="p lg-none">No workouts logged yet. Tap <b>Log workout</b>, pick a split and go.</div>`}
          ${sessions.length > 1 ? `<div class="tm-gh lg-earlier-h">Earlier</div><div class="lg-earlier" data-fit data-fit-optional>${sessions.slice(1, 4).map(s => `<div class="lg-erow"><span class="it">${esc(s.split)}</span><span class="p">${whenLabel(s.at)} · ${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}</span><b>${volume(s).toLocaleString()} lb</b></div>`).join('')}</div>` : ''}
        </section>
        ${prList.length ? `<section class="tile fx-card"><div class="fx-h"><h3>Personal records</h3></div>
          <div class="fx-prs">${prList.map(([n, w]) => `<div class="fx-pr"><b>${w} lb</b><span class="p">${esc(n)}</span></div>`).join('')}</div></section>` : ''}
      </div></div></div>
      <button class="lg-next" data-lspage="1">Lift stats ↓</button></div>
      <div class="lg-page" id="lsPage">${statsPage()}<button class="lg-next up" data-lspage="0">↑ myLifting</button></div></div></div>`;
    if (!el.dataset.bound) {
      el.dataset.bound = 1;
      el.addEventListener('click', e => {
        if (e.target.closest('[data-log]')) logWorkout(() => lifting(el));
        if (e.target.closest('[data-logex]')) logExercise(() => lifting(el));
        const redraw = () => lifting(el);
        if (e.target.closest('[data-lsadd]')) return Lift.demo ? entriesModal(statsView.ex, redraw) : entryEditor(statsView.ex, null, redraw);
        if (e.target.closest('[data-lsentries]')) return entriesModal(statsView.ex, redraw);
        const dot = e.target.closest('[data-lsday]');
        if (dot) return Lift.demo ? entriesModal(statsView.ex, redraw) : entryEditor(statsView.ex, dot.dataset.lsday, redraw);
        const t = e.target.closest('[data-lsex],[data-lsrange],[data-lspage]');
        if (t) {
          const d = t.dataset;
          if (d.lspage) return setLiftPage(+d.lspage);
          if (d.lsex) statsView.ex = d.lsex;
          if (d.lsrange) statsView.range = d.lsrange;
          el.querySelector('#lsPage').innerHTML = statsPage();
        }
        const del = e.target.closest('[data-delsession]');
        if (del && confirm('Delete this workout?')) { Lift.sessions = Lift.real.filter(s => s.id !== del.dataset.delsession); lifting(el); }
      });
      el.addEventListener('wheel', e => {
        if (scrollsItself(e, el)) return; // a list inside is scrolling
        e.preventDefault();
        if (!paging && Math.abs(e.deltaY) >= 4) setLiftPage(liftPage + Math.sign(e.deltaY));
      }, { passive: false });
      el.addEventListener('input', e => {
        if (e.target.id !== 'lsSearch') return;
        statsView.q = e.target.value;
        const q = statsView.q.toLowerCase();
        el.querySelectorAll('.ls-item').forEach(b => (b.hidden = q && !b.dataset.lsex.toLowerCase().includes(q)));
      });
      Personal.subscribe(() => { if (!el.hidden && !document.querySelector('.lg-modal') && document.activeElement?.id !== 'lsSearch') lifting(el); });
    }
  }

  // Log workout: 1) pick a split  2) pick the date, adjust exercises / sets  3) save. Edits to a split's exercises are remembered.
  function logWorkout(done) {
    let splits = Lift.splits.map(s => ({ ...s, exercises: [...s.exercises] })), pick = null, editing = false, ex = [], date = ymd(new Date());
    const wrap = document.createElement('div');
    wrap.className = 'pj-overlay';
    wrap.innerHTML = '<div class="pj-modal glass lg-modal"></div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('on'));
    const box = wrap.firstChild;
    const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
    const choose = id => {
      pick = id;
      const sp = splits.find(s => s.id === id);
      ex = (sp ? sp.exercises : []).map(name => ({ name, sets: lastSets(name) }));
      if (!ex.length) ex.push({ name: '', sets: [{ reps: 10, weight: '' }] });
      draw();
    };
    function draw() {
      const sp = splits.find(s => s.id === pick);
      if (!pick) {
        box.innerHTML = `<div class="pj-row"><h3>Log workout</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
          <div class="p">Pick a split</div>
          ${editing ? `<div class="lg-edit">${splits.map(s => `<div class="pj-row"><input class="pj-in" data-rename="${s.id}" value="${esc(s.name)}"><button class="pj-x" data-rmsplit="${s.id}" title="Remove">×</button></div>`).join('')}
              <button class="tile pj-btn" data-addsplit>+ Add split</button></div>
              <div class="pj-row end"><button class="tile pj-btn primary" data-doneedit>Done</button></div>`
            : `<div class="lg-splits">${splits.map(s => `<button class="tile lg-split" data-pick="${s.id}"><b>${esc(s.name)}</b><span class="p">${s.exercises.length} exercises</span></button>`).join('')}
              <button class="tile lg-split custom" data-pick="custom"><b>Custom</b><span class="p">Start blank</span></button></div>
              <button class="td-toggle" data-editsplits>Edit splits</button>`}`;
        return;
      }
      box.innerHTML = `<div class="pj-row"><button class="pj-x" data-back title="Back">←</button><h3>${sp ? esc(sp.name) : 'Custom'} workout</h3><span class="pj-spacer"></span>
          <input type="date" class="pj-in lg-date" id="lgDate" value="${date}" max="${ymd(new Date())}" title="Workout date"><button class="pj-x" data-x>×</button></div>
        <div class="lg-exs">${ex.map((e, i) => `<div class="tile lg-ex">
          <div class="pj-row"><input class="pj-in lg-name" data-exname="${i}" value="${esc(e.name)}" placeholder="Exercise name"><button class="pj-x" data-rmex="${i}" title="Remove exercise">×</button></div>
          <div class="lg-sets">${e.sets.map((x, j) => `<div class="lg-set"><span class="p">${j + 1}</span>
            <input class="pj-in" type="number" min="0" inputmode="numeric" data-reps="${i}.${j}" value="${x.reps}"><span class="p">reps ×</span>
            <input class="pj-in" type="number" min="0" inputmode="decimal" data-weight="${i}.${j}" value="${x.weight}" placeholder="BW"><span class="p">lb</span>
            <button class="pj-x" data-rmset="${i}.${j}" title="Remove set">×</button></div>`).join('')}</div>
          <button class="td-toggle" data-addset="${i}">+ Add set</button></div>`).join('')}</div>
        <button class="tile pj-btn" data-addex>+ Add exercise</button>
        <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>Log workout</button></div>`;
    }
    box.addEventListener('input', e => {
      const t = e.target, d = t.dataset;
      if (t.id === 'lgDate' && t.value) date = t.value;
      if (d.exname) ex[+d.exname].name = t.value;
      if (d.reps) { const [i, j] = d.reps.split('.'); ex[i].sets[j].reps = t.value; }
      if (d.weight) { const [i, j] = d.weight.split('.'); ex[i].sets[j].weight = t.value; }
      if (d.rename) splits.find(s => s.id === d.rename).name = t.value;
    });
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if (d.pick) return choose(d.pick);
      if ('back' in d) { pick = null; return draw(); }
      if ('editsplits' in d) { editing = true; return draw(); }
      if ('doneedit' in d) { splits = splits.filter(s => s.name.trim()); Lift.splits = splits; editing = false; return draw(); }
      if ('addsplit' in d) { splits.push({ id: crypto.randomUUID(), name: 'New split', exercises: [] }); draw(); return box.querySelector('[data-rename]:last-of-type')?.select(); }
      if (d.rmsplit) { splits = splits.filter(s => s.id !== d.rmsplit); return draw(); }
      if ('addex' in d) { ex.push({ name: '', sets: [{ reps: 10, weight: '' }] }); draw(); return box.querySelectorAll('.lg-name')[ex.length - 1].focus(); }
      if (d.rmex) { ex.splice(+d.rmex, 1); return draw(); }
      if (d.addset) { const s = ex[+d.addset].sets; s.push({ ...(s[s.length - 1] || { reps: 10, weight: '' }) }); return draw(); }
      if (d.rmset) { const [i, j] = d.rmset.split('.').map(Number); ex[i].sets.splice(j, 1); if (!ex[i].sets.length) ex.splice(i, 1); return draw(); }
      if ('save' in d) {
        const clean = ex.filter(x => x.name.trim()).map(x => ({ name: x.name.trim(), sets: x.sets.map(s => ({ reps: +s.reps || 0, weight: s.weight === '' ? '' : +s.weight })) }));
        if (!clean.length) return box.querySelector('.lg-name')?.focus();
        const sp = splits.find(s => s.id === pick), name = sp ? sp.name : 'Custom';
        if (sp) { sp.exercises = clean.map(x => x.name); Lift.splits = splits; } // remember exercise changes for next time
        // Today = now; another day = that day at the current time of day
        const now = new Date(), [y, m, dd] = date.split('-').map(Number);
        const at = date === ymd(now) ? now.getTime() : new Date(y, m - 1, dd, now.getHours(), now.getMinutes()).getTime();
        Lift.sessions = [{ id: crypto.randomUUID(), at, split: name, exercises: clean }, ...Lift.real];
        Personal.logActivity('Fitness/Lifting', `Logged ${name} workout${date === ymd(now) ? '' : ' · ' + whenLabel(at)}`);
        close(); done();
      }
    });
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    draw();
  }

  // ---------- Editing lift stats ----------
  // An "entry" is one day of one exercise (all its sets that day). Adding, editing or removing an entry changes your
  // real workouts, so the chart, stats and records all follow. Demo workouts can't be edited.
  const dayKey = at => ymd(new Date(at));
  function saveEntry(name, oldDay, newDay, sets) {
    const lc = name.toLowerCase();
    let list = Lift.real.map(s => (oldDay && dayKey(s.at) === oldDay ? { ...s, exercises: s.exercises.filter(e => e.name.toLowerCase() !== lc) } : s))
      .filter(s => s.exercises.length);
    if (sets) {
      const ex = { name, sets }, host = list.find(s => dayKey(s.at) === newDay);
      if (host) list = list.map(s => (s === host ? { ...s, exercises: [...s.exercises, ex] } : s));
      else {
        const now = new Date(), [y, m, d] = newDay.split('-').map(Number);
        list = [{ id: crypto.randomUUID(), at: newDay === ymd(now) ? now.getTime() : new Date(y, m - 1, d, 12).getTime(), split: name, exercises: [ex] }, ...list];
      }
    }
    Lift.sessions = list;
  }
  function modalShell() {
    const wrap = document.createElement('div');
    wrap.className = 'pj-overlay';
    wrap.innerHTML = '<div class="pj-modal glass lg-modal"></div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('on'));
    const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    return { box: wrap.firstChild, close };
  }

  // Add (day = null) or edit one entry
  function entryEditor(name, day, done) {
    const { box, close } = modalShell();
    const existing = day && history(name).find(p => dayKey(p.at) === day);
    let date = day || ymd(new Date()), sets = existing ? existing.sets.map(x => ({ ...x })) : lastSets(name);
    function draw() {
      box.innerHTML = `<div class="pj-row"><h3>${existing ? 'Edit' : 'Add'} entry · ${esc(name)}</h3><span class="pj-spacer"></span>
          <input type="date" class="pj-in lg-date" id="enDate" value="${date}" max="${ymd(new Date())}" title="Date"><button class="pj-x" data-x>×</button></div>
        <div class="tile lg-ex"><div class="lg-sets">${sets.map((x, j) => `<div class="lg-set"><span class="p">${j + 1}</span>
            <input class="pj-in" type="number" min="0" inputmode="numeric" data-reps="${j}" value="${x.reps}"><span class="p">reps ×</span>
            <input class="pj-in" type="number" min="0" inputmode="decimal" data-weight="${j}" value="${x.weight}" placeholder="BW"><span class="p">lb</span>
            <button class="pj-x" data-rmset="${j}" title="Remove set">×</button></div>`).join('')}</div>
          <button class="td-toggle" data-addset>+ Add set</button></div>
        <div class="pj-row end">${existing ? '<button class="tile pj-btn danger" data-del>Remove entry</button><span class="pj-spacer"></span>' : ''}
          <button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>${existing ? 'Save' : 'Add entry'}</button></div>`;
    }
    box.addEventListener('input', e => {
      const t = e.target, d = t.dataset;
      if (t.id === 'enDate' && t.value) date = t.value;
      if (d.reps) sets[+d.reps].reps = t.value;
      if (d.weight) sets[+d.weight].weight = t.value;
    });
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if ('addset' in d) { sets.push({ ...(sets[sets.length - 1] || { reps: 10, weight: '' }) }); return draw(); }
      if (d.rmset) { sets.splice(+d.rmset, 1); if (!sets.length) sets.push({ reps: 10, weight: '' }); return draw(); }
      if ('del' in d) { if (!confirm(`Remove ${name} from ${whenLabel(existing.at)}?`)) return; saveEntry(name, day, null, null); Personal.logActivity('Fitness/Lifting', `Removed ${name} · ${whenLabel(existing.at)}`); close(); return done(); }
      if ('save' in d) {
        const clean = sets.map(s => ({ reps: +s.reps || 0, weight: s.weight === '' ? '' : +s.weight })).filter(s => s.reps);
        if (!clean.length) return;
        saveEntry(name, day, date, clean);
        Personal.logActivity('Fitness/Lifting', `${existing ? 'Edited' : 'Added'} ${name} · ${whenLabel(new Date(date + 'T12:00').getTime())}`);
        close(); done();
      }
    });
    draw();
  }

  // Every entry for an exercise, newest first, each editable / removable
  function entriesModal(name, done) {
    const { box, close } = modalShell();
    const draw = () => {
      const list = history(name).slice().reverse(), demo = Lift.demo;
      box.innerHTML = `<div class="pj-row"><h3>${esc(name)} · entries</h3><span class="pj-spacer"></span>${demo ? '' : '<button class="tile pj-btn primary lg-log" data-add>+ Add entry</button>'}<button class="pj-x" data-x>×</button></div>
        ${demo ? '<p class="p">These are demo workouts, so they can\'t be edited. Add a real entry and your own data replaces the demo.</p>' : ''}
        <div class="en-list">${list.map(p => { const [a, b] = setsText(p.sets);
          return `<div class="tile en-row"><div><div class="it">${whenLabel(p.at)}</div><div class="p">${new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
            <span class="p">${a}${b ? ' · ' + b : ''}</span><b>${p.e1rm} lb</b>
            ${demo ? '' : `<button class="tile pj-btn lg-log" data-edit="${dayKey(p.at)}">Edit</button><button class="pj-x" data-rm="${dayKey(p.at)}" title="Remove">×</button>`}</div>`; }).join('')}</div>
        ${demo ? '<div class="pj-row end"><button class="tile pj-btn primary" data-add>+ Add a real entry</button></div>' : ''}`;
    };
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if ('add' in d) { close(); return entryEditor(name, null, done); }
      if (d.edit) { close(); return entryEditor(name, d.edit, done); }
      if (d.rm && confirm(`Remove ${name} from ${whenLabel(new Date(d.rm + 'T12:00').getTime())}?`)) { saveEntry(name, d.rm, null, null); done(); draw(); }
    });
    draw();
  }

  // Log exercise: one exercise on any date. If you already logged a workout that day it's added to it,
  // otherwise it's saved on its own (good for a single lift or something you forgot to log).
  function logExercise(done) {
    let date = ymd(new Date()), name = '', sets = [{ reps: 10, weight: '' }];
    const known = [...new Set([...Lift.splits.flatMap(s => s.exercises), ...Lift.sessions.flatMap(s => s.exercises.map(e => e.name))])].sort();
    const wrap = document.createElement('div');
    wrap.className = 'pj-overlay';
    wrap.innerHTML = '<div class="pj-modal glass lg-modal"></div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('on'));
    const box = wrap.firstChild;
    const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
    const sameDay = () => Lift.real.find(s => ymd(new Date(s.at)) === date);
    const note = () => { const s = sameDay(); return s ? `Will be added to your <b>${esc(s.split)}</b> workout from ${whenLabel(s.at)}.` : 'Saved as its own entry for that day.'; };
    function draw() {
      box.innerHTML = `<div class="pj-row"><h3>Log exercise</h3><span class="pj-spacer"></span>
          <input type="date" class="pj-in lg-date" id="lxDate" value="${date}" max="${ymd(new Date())}" title="Date"><button class="pj-x" data-x>×</button></div>
        <div class="tile lg-ex">
          <input class="pj-in lg-name" id="lxName" list="lxKnown" value="${esc(name)}" placeholder="Exercise name"><datalist id="lxKnown">${known.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
          <div class="lg-sets">${sets.map((x, j) => `<div class="lg-set"><span class="p">${j + 1}</span>
            <input class="pj-in" type="number" min="0" inputmode="numeric" data-reps="${j}" value="${x.reps}"><span class="p">reps ×</span>
            <input class="pj-in" type="number" min="0" inputmode="decimal" data-weight="${j}" value="${x.weight}" placeholder="BW"><span class="p">lb</span>
            <button class="pj-x" data-rmset="${j}" title="Remove set">×</button></div>`).join('')}</div>
          <button class="td-toggle" data-addset>+ Add set</button></div>
        <div class="p" id="lxNote">${note()}</div>
        <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>Log exercise</button></div>`;
    }
    box.addEventListener('input', e => {
      const t = e.target, d = t.dataset;
      if (t.id === 'lxDate' && t.value) { date = t.value; box.querySelector('#lxNote').innerHTML = note(); }
      if (t.id === 'lxName') name = t.value;
      if (d.reps) sets[+d.reps].reps = t.value;
      if (d.weight) sets[+d.weight].weight = t.value;
    });
    // Picking a known exercise fills in the sets you did last time
    box.addEventListener('change', e => { if (e.target.id === 'lxName' && known.includes(e.target.value)) { sets = lastSets(e.target.value); draw(); } });
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if ('addset' in d) { sets.push({ ...(sets[sets.length - 1] || { reps: 10, weight: '' }) }); return draw(); }
      if (d.rmset) { sets.splice(+d.rmset, 1); if (!sets.length) sets.push({ reps: 10, weight: '' }); return draw(); }
      if ('save' in d) {
        if (!name.trim()) return box.querySelector('#lxName').focus();
        const exercise = { name: name.trim(), sets: sets.map(s => ({ reps: +s.reps || 0, weight: s.weight === '' ? '' : +s.weight })) };
        const existing = sameDay();
        if (existing) Lift.sessions = Lift.real.map(s => (s.id === existing.id ? { ...s, exercises: [...s.exercises, exercise] } : s));
        else {
          const now = new Date(), [y, m, dd] = date.split('-').map(Number);
          const at = date === ymd(now) ? now.getTime() : new Date(y, m - 1, dd, now.getHours(), now.getMinutes()).getTime();
          Lift.sessions = [{ id: crypto.randomUUID(), at, split: exercise.name, exercises: [exercise] }, ...Lift.real];
        }
        Personal.logActivity('Fitness/Lifting', `Logged ${exercise.name}${date === ymd(new Date()) ? '' : ' · ' + whenLabel(new Date(date + 'T12:00').getTime())}`);
        close(); done();
      }
    });
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    draw();
    box.querySelector('#lxName').focus();
  }

  // myDiet and myRunning: logging isn't built yet, so they show demo data (when "Demo data" is on) or empty charts
  const pct = (a, b) => Math.min(100, Math.round(a / b * 100));
  const ringSvg = p => `<svg viewBox="0 0 120 120" class="fx-ring"><circle cx="60" cy="60" r="52"/><circle class="arc" cx="60" cy="60" r="52" style="stroke-dashoffset:${327 - 327 * p / 100}"/></svg>`;
  const bars = (vals, labels) => { const max = Math.max(...vals, 1), today = new Date().getDay();
    return `<div class="fx-bars">${vals.map((v, i) => `<div class="fx-bar${i === today ? ' hl' : ''}"><span class="fx-bv">${v || ''}</span><i style="height:${Math.max(4, v / max * 100)}%"></i><span class="p">${labels[i]}</span></div>`).join('')}</div>`; };
  const DEMO_DIET = {
    calories: 1840, goal: 2600,
    nutrients: [['Protein', 142, 180, 'g'], ['Carbs', 210, 300, 'g'], ['Fat', 58, 80, 'g'], ['Sugar', 44, 50, 'g'], ['Fiber', 18, 30, 'g'], ['Sodium', 1900, 2300, 'mg']],
    meals: [['Breakfast', 'Greek yogurt, granola, berries', 520, '7:40 AM'], ['Lunch', 'Chicken rice bowl', 760, '12:15 PM'], ['Snack', 'Protein shake, banana', 560, '3:30 PM']]
  };
  const runView = { range: 'quarter' };
  const RUN_RANGES = [['quarter', '3M', 91], ['year', '1Y', 365], ['all', 'All', Infinity]];
  let runWeeksCache = null;
  function runWeeks() { // [{ at, miles }] one per week, oldest first (demo)
    if (runWeeksCache) return runWeeksCache;
    const out = [], start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - start.getDay());
    for (let i = 104; i >= 0; i--) {
      const at = start.getTime() - i * 7 * 864e5, base = 8 + (104 - i) * 0.09, wave = Math.sin(i / 3.1) * 2.4 + Math.cos(i / 1.7) * 1.3;
      out.push({ at, miles: Math.max(0, Math.round((base + wave) * 10) / 10) });
    }
    return (runWeeksCache = out);
  }
  const DEMO_RUN = {
    week: [0, 3.1, 0, 4.2, 0, 5.1, 0], goal: 20, pace: '8:42', month: [14.2, 18.6, 16.1, 12.4],
    zones: [['Easy', 55], ['Steady', 20], ['Tempo', 15], ['Intervals', 5], ['Long', 30], ['Recovery', 25]],
    prs: [['Fastest mile', '7:12'], ['Fastest 5K', '24:48'], ['Longest run', '7.8 mi'], ['Best week', '18.6 mi']],
    log: [['Thu', 'Evening run', 5.1, '44:21', '8:42'], ['Mon', 'Easy loop', 4.2, '38:10', '9:05'], ['Sat', 'Long run', 7.8, '1:11:36', '9:11']]
  };
  const nutrientRows = () => DEMO_DIET.nutrients.map(([n, a, g, u]) => `<div class="fx-nut"><div class="pj-row"><span>${n}</span><span class="pj-spacer"></span><span class="p">${a.toLocaleString()} / ${g.toLocaleString()} ${u}</span></div><div class="prog"><b style="width:${pct(a, g)}%"></b></div></div>`).join('');

  // ---------- myRunning: log your runs (saved in your account). Example data only shows if you turned it on and have no runs. ----------
  const RunLog = {
    get all() { return (Personal.getKv('run.log', []) || []).slice().sort((a, b) => b.at - a.at); },
    save: list => Personal.setKv('run.log', list),
    get goal() { return Number(Personal.getKv('run.goal', 20)) || 20; }
  };
  const fmtTime = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
  const fmtPace = (secs, miles) => (miles > 0 && secs > 0 ? fmtTime(secs / miles) : '—');
  const parseTime = str => { const p = String(str).trim().split(':').map(Number); if (!p.length || p.some(n => !isFinite(n) || n < 0)) return 0; return p.length === 1 ? p[0] * 60 : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]; };
  const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
  const r1 = n => Math.round(n * 10) / 10;
  let runRoot = null;

  function runModel() {
    const runs = RunLog.all;
    if (!runs.length) {
      if (!Personal.demoOn) return null;
      const r = DEMO_RUN;
      return { demo: true, week: r.week, goal: r.goal, pace: r.pace, runsThisWeek: r.week.filter(Boolean).length, month: r.month.reduce((x, y) => x + y, 0), pts: runWeeks(), prs: r.prs,
        thisWeek: r.log.filter(x => ['Mon', 'Thu'].includes(x[0])).map(([when, name, dist]) => ({ when, name, dist })), log: r.log.map(([when, name, dist, time, pace]) => ({ when, name, dist, time, pace })) };
    }
    const sow = weekStart(Date.now()), thisWeek = runs.filter(x => x.at >= sow), week = Array(7).fill(0);
    thisWeek.forEach(x => { week[new Date(x.at).getDay()] += x.miles; });
    const d28 = runs.filter(x => x.at >= Date.now() - 28 * 864e5), secs28 = d28.reduce((s, x) => s + x.secs, 0), mi28 = d28.reduce((s, x) => s + x.miles, 0);
    const byWeek = new Map(); runs.forEach(x => { const k = weekStart(x.at); byWeek.set(k, (byWeek.get(k) || 0) + x.miles); });
    const pts = [], d = new Date(weekStart(runs[runs.length - 1].at));
    while (d.getTime() <= sow) { pts.push({ at: d.getTime() + 432e5, miles: r1(byWeek.get(d.getTime()) || 0) }); d.setDate(d.getDate() + 7); }
    const mile = runs.filter(x => x.miles >= 1).sort((a, b) => a.secs / a.miles - b.secs / b.miles)[0];
    const prs = [['Fastest pace', mile ? fmtPace(mile.secs, mile.miles) + ' /mi' : '—'], ['Longest run', Math.max(...runs.map(x => x.miles)).toFixed(1) + ' mi'], ['Best week', Math.max(...byWeek.values()).toFixed(1) + ' mi'], ['Total miles', runs.reduce((s, x) => s + x.miles, 0).toFixed(0) + ' mi']];
    const lbl = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { demo: false, week, goal: RunLog.goal, pace: d28.length ? fmtPace(secs28, mi28) : '—', runsThisWeek: thisWeek.length, month: mi28, pts, prs,
      thisWeek: thisWeek.map(x => ({ when: new Date(x.at).toLocaleDateString(undefined, { weekday: 'short' }), name: x.name || 'Run', dist: x.miles })),
      log: runs.map(x => ({ id: x.id, when: lbl(x.at), name: x.name || 'Run', dist: x.miles, time: fmtTime(x.secs), pace: fmtPace(x.secs, x.miles) })) };
  }

  function running(el) {
    runRoot = el;
    const m = runModel(), days = RUN_RANGES.find(x => x[0] === runView.range)[2];
    const weekOf = at => 'Week of ' + new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!m) {
      el.innerHTML = `<div class="fx-wrap"><section class="tile fx-card fx-span2">${emptyCard('No runs yet', 'Log your first run and your weekly miles, pace and goal fill in here.')}
        <div class="pj-row fx-center"><button class="tile pj-btn primary" data-runlog>+ Log run</button></div></section></div>`;
    } else {
      const miles = m.week.reduce((x, y) => x + y, 0), pts = m.pts.filter(p => p.at >= Date.now() - days * 864e5);
      el.innerHTML = `<div class="fx-wrap">
        <div class="fx-runbar">${m.demo ? demoTag : ''}<span class="pj-spacer"></span><button class="tile pj-btn primary" data-runlog>+ Log run</button></div>
        <div class="fx-stats">${stat(m.runsThisWeek, 'Runs this week')}${stat(m.pace, 'Avg pace', 'min / mi')}${stat(r1(miles) + '<small> mi</small>', 'This week', `goal ${m.goal} mi`)}${stat(r1(m.month), 'Miles, last 4 weeks')}</div>
        <div class="fx-grid three">
          <section class="tile fx-card ls-main">
            <div class="fx-h"><h3>Weekly miles</h3>
              <div class="td-seg ls-seg">${RUN_RANGES.map(([k, l]) => `<button class="${runView.range === k ? 'on' : ''}" data-runrange="${k}">${l}</button>`).join('')}</div></div>
            <div class="ls-chartwrap"><span class="ls-unit tip" data-tip="Miles per week">MI</span>${lineChart(pts.map(p => ({ ...p, note: '' })), 'miles', 'mi', 'Weekly miles', weekOf, 520)}<div class="ls-tip" hidden></div></div>
            ${pts.length ? `<div class="ls-stats run">${[[`${(pts.reduce((x, p) => x + p.miles, 0) / pts.length).toFixed(1)} <small>mi</small>`, 'Avg week'], [`${Math.max(...pts.map(p => p.miles))} <small>mi</small>`, 'Best week'], [`${pts.reduce((x, p) => x + p.miles, 0).toFixed(0)} <small>mi</small>`, 'In range']].map(([v, l]) => `<div class="ls-stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>` : ''}
          </section>
          <div class="fx-col">
            <section class="tile fx-card"><div class="fx-h"><h3>Weekly goal</h3><span class="pj-spacer"></span>${m.demo ? '' : '<button class="td-toggle" data-rungoal>Edit goal</button>'}</div>
              <div class="fx-calrow"><div class="fx-cal">${ringSvg(pct(miles, m.goal))}<div class="fx-cal-in"><b>${pct(miles, m.goal)}%</b><span>of ${m.goal} mi</span></div></div>
                <div class="fx-calnums">${m.thisWeek.map(x => `<div><b>${r1(x.dist)}</b><span class="p">${esc(x.when)} · ${esc(x.name)}</span></div>`).join('')}<div><b>${Math.max(0, m.goal - miles).toFixed(1)}</b><span class="p">mi to go</span></div></div></div></section>
            <section class="tile fx-card fx-fill"><div class="fx-h"><h3>This week</h3></div>${bars(m.week, DOW)}</section>
          </div>
          <div class="fx-col">
            <section class="tile fx-card"><div class="fx-h"><h3>Personal records</h3></div><div class="fx-prs">${m.prs.map(([n, v]) => `<div class="fx-pr"><b>${v}</b><span class="p">${n}</span></div>`).join('')}</div></section>
            <section class="tile fx-card fx-fill"><div class="fx-h"><h3>Recent runs</h3></div>
              <div class="fx-list" data-fit>${m.log.map(x => `<button class="tile fx-meal fx-run" ${x.id ? `data-runedit="${x.id}"` : ''}><div class="fx-runi"><div class="it">${esc(x.name)}</div><div class="p">${esc(x.when)} · ${x.time} · ${x.pace}/mi</div></div><span class="pj-spacer"></span><div class="fx-kcal"><b>${typeof x.dist === 'number' ? r1(x.dist) : x.dist}</b><span class="p">miles</span></div></button>`).join('')}</div></section>
          </div>
        </div></div>`;
    }
    if (!el.dataset.bound) {
      el.dataset.bound = 1;
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-runrange],[data-runlog],[data-runedit],[data-rungoal]'); if (!b) return;
        if (b.dataset.runrange) { runView.range = b.dataset.runrange; running(el); }
        else if ('runlog' in b.dataset) runModal();
        else if (b.dataset.runedit) runModal(b.dataset.runedit);
        else if ('rungoal' in b.dataset) goalModal();
      });
    }
  }
  Personal.subscribe(() => { if (runRoot && !runRoot.hidden && !document.querySelector('.pj-overlay')) running(runRoot); });

  function overlay(html) {
    const wrap = document.createElement('div'); wrap.className = 'pj-overlay';
    wrap.innerHTML = `<div class="pj-modal glass lg-modal">${html}</div>`;
    document.body.appendChild(wrap); requestAnimationFrame(() => wrap.classList.add('on'));
    const close = () => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 250); };
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return { wrap, close };
  }
  function runModal(id) {
    const ex = id && RunLog.all.find(x => x.id === id);
    const { wrap, close } = overlay(`<div class="pj-row"><h3>${ex ? 'Edit run' : 'Log a run'}</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
      <label class="tm-field col"><span>Date</span><input type="date" class="pj-in" id="rnDate" value="${ymd(new Date(ex ? ex.at : Date.now()))}" max="${ymd(new Date())}"></label>
      <label class="tm-field col"><span>Distance (miles)</span><input class="pj-in" id="rnMi" type="number" min="0" step="0.01" inputmode="decimal" placeholder="3.10" value="${ex ? ex.miles : ''}"></label>
      <label class="tm-field col"><span>Time (mm:ss or h:mm:ss)</span><input class="pj-in" id="rnTime" inputmode="numeric" placeholder="27:30" autocomplete="off" value="${ex ? fmtTime(ex.secs) : ''}"></label>
      <label class="tm-field col"><span>Name (optional)</span><input class="pj-in" id="rnName" placeholder="Evening run" value="${esc(ex?.name || '')}"></label>
      <div class="p" id="rnPace">&nbsp;</div><div class="pj-err" id="rnErr"></div>
      <div class="pj-row end">${ex ? '<button class="tile pj-btn danger" data-del>Delete</button>' : ''}<button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>${ex ? 'Save' : 'Log run'}</button></div>`);
    const q = s => wrap.querySelector(s), pace = () => { const mi = parseFloat(q('#rnMi').value), s = parseTime(q('#rnTime').value); q('#rnPace').innerHTML = mi > 0 && s > 0 ? `Pace: <b>${fmtPace(s, mi)}</b> /mi` : '&nbsp;'; };
    wrap.addEventListener('input', pace); pace(); q('#rnMi').focus();
    const save = () => {
      const miles = parseFloat(q('#rnMi').value), secs = parseTime(q('#rnTime').value), date = q('#rnDate').value;
      if (!(miles > 0) || !(secs > 0)) { q('#rnErr').textContent = 'Enter a distance and a time.'; return; }
      if (!date) { q('#rnErr').textContent = 'Pick the date.'; return; }
      const at = new Date(date + 'T12:00').getTime(), name = q('#rnName').value.trim(), list = RunLog.all.filter(x => x.id !== (ex && ex.id));
      list.push({ id: ex ? ex.id : crypto.randomUUID(), at, miles: Math.round(miles * 100) / 100, secs, name });
      RunLog.save(list);
      if (!ex) Personal.logActivity('Fitness/Running', `Logged a ${miles.toFixed(1)} mi run`);
      close(); running(runRoot);
    };
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) save(); });
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) close();
      else if (e.target.closest('[data-save]')) save();
      else if (e.target.closest('[data-del]') && confirm('Delete this run?')) { RunLog.save(RunLog.all.filter(x => x.id !== ex.id)); close(); running(runRoot); }
    });
  }
  function goalModal() {
    const { wrap, close } = overlay(`<div class="pj-row"><h3>Weekly goal</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
      <label class="tm-field col"><span>Miles per week</span><input class="pj-in" id="rgMi" type="number" min="1" step="1" inputmode="decimal" value="${RunLog.goal}"></label>
      <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-save>Save</button></div>`);
    const save = () => { const v = parseFloat(wrap.querySelector('#rgMi').value); if (v > 0) { Personal.setKv('run.goal', v); close(); running(runRoot); } };
    wrap.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    wrap.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); else if (e.target.closest('[data-save]')) save(); });
  }

  // Dashboard card: workouts this week + this week's muscle chart
  function dashCard(el) {
    const week = thisWeek(), last = Lift.sessions[0];
    el.innerHTML = `<div class="big">${week.length} <span class="chip">workout${week.length === 1 ? '' : 's'} this week</span></div>
      <div class="fx-dash">${radar(muscleAxes(week), { size: 260, label: 'Muscle groups' })}</div>
      <div class="p">${last ? `Last: ${esc(last.split)} · ${whenLabel(last.at)}` : 'No workouts logged yet'}</div>`;
  }

  // Hovering any chart dot shows a small card with its value, label, date and note
  document.addEventListener('mouseover', e => {
    const dot = e.target.closest?.('.ls-dot'), wrapEl = dot?.closest('.ls-chartwrap') || e.target.closest?.('.ls-chartwrap');
    document.querySelectorAll('.ls-tip').forEach(t => { if (!wrapEl || !wrapEl.contains(t) || !dot) t.hidden = true; });
    if (!dot || !wrapEl) return;
    const tip = wrapEl.querySelector('.ls-tip'), wrap = wrapEl.getBoundingClientRect(), r = dot.getBoundingClientRect(), left = r.left + r.width / 2 - wrap.left;
    tip.innerHTML = `<b>${dot.dataset.v}</b><span>${dot.dataset.l} · ${dot.dataset.d}</span>${dot.dataset.s ? `<em>${dot.dataset.s}</em>` : ''}`;
    tip.style.left = left + 'px'; tip.style.top = r.top - wrap.top + 'px';
    tip.classList.toggle('flip', left > wrap.width - 140); tip.classList.toggle('flipl', left < 140);
    tip.hidden = false;
  });

  // Search hooks: jump to an exercise's stats page, or start logging
  function openStats(name) {
    statsView.ex = name;
    go('Fitness/Lifting');
    requestAnimationFrame(() => setLiftPage(1));
  }
  const openLog = kind => { go('Fitness/Lifting'); const el = document.getElementById('liftRoot'); (kind === 'exercise' ? logExercise : logWorkout)(() => lifting(el)); };
  const exerciseNames = () => [...new Set([...Lift.splits.flatMap(s => s.exercises), ...Lift.sessions.flatMap(s => s.exercises.map(e => e.name))])];
  const splitNames = () => Lift.splits.map(s => s.name);

  const showStats = () => { go('Fitness/Lifting'); requestAnimationFrame(() => setLiftPage(1)); };
  const onStats = () => liftPage === 1 && !document.documentElement.classList.contains('phone');
  const toMain = () => setLiftPage(0);
  const openRun = () => { go('Fitness/Running'); setTimeout(() => runModal(), 80); };
  return { openRun, onStats, toMain, showStats, lifting, running, dashCard, radar, lineChart, ringSvg, streakBadge, stat, emptyCard, demoTag, openStats, openLog, exerciseNames, splitNames, loggedExercises: () => allExercises().map(e => e.name) };
})();
