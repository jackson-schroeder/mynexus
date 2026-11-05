// myDiet: log meals from the food library in two taps, build smoothies, save your own meals, keep an on-target streak,
// and glide down to a page with your eating history. Everything saves to your account (Personal kv: diet.log / diet.meals / diet.goals).
const DietUI = (() => {
  const F = FitnessUI, esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, today = () => ymd(new Date());
  const N = [['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'], ['sugar', 'Sugar', 'g'], ['fiber', 'Fiber', 'g'], ['sodium', 'Sodium', 'mg']];
  const KEYS = N.map(n => n[0]);
  const GOALS = { kcal: 2600, protein: 180, carbs: 300, fat: 80, sugar: 50, fiber: 30, sodium: 2300 };
  const PORTIONS = { plate: [['Small plate', .65], ['Medium plate', 1], ['Large plate', 1.5]], unit: [['½', .5], ['1', 1], ['2', 2], ['3', 3]], drink: [['Small', .75], ['Medium', 1], ['Large', 1.5]] };
  const SIZES = [['8 oz', .5], ['12 oz', .75], ['16 oz', 1], ['20 oz', 1.25], ['24 oz', 1.5], ['32 oz', 2]];
  const PART = [['S', .5, 'Small'], ['M', 1, 'Medium'], ['L', 1.5, 'Large']];
  const mealOf = h => (h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack');
  const scale = (f, q) => Object.fromEntries(KEYS.map(k => [k, Math.round((f[k] || 0) * q)]));
  const sum = list => Object.fromEntries(KEYS.map(k => [k, list.reduce((a, x) => a + (x[k] || 0), 0)]));

  // ---------- Data ----------
  const real = () => Personal.getKv('diet.log', []);
  const myMeals = () => Personal.getKv('diet.meals', []);
  const goals = () => ({ ...GOALS, ...Personal.getKv('diet.goals', {}) });
  const demo = () => !real().length && Personal.demoOn;
  let demoCache = null;
  function demoLog() { // a year of believable eating (never saved): 3–4 meals a day around the goals
    const day = today();
    if (demoCache?.day === day) return demoCache.list;
    const pick = ['Greek yogurt bowl with blueberries and granola', 'Chicken teriyaki rice bowl', 'Whey protein shake with whole milk', 'Steak with sweet potato and green beans', 'Egg scramble with turkey bacon and toast', 'Turkey and cheddar sandwich', 'Salmon with rice and broccoli', 'Chipotle burrito bowl', 'Oatmeal with banana and peanut butter', 'Banana', 'Apple', 'Protein bar'];
    const food = n => FOODS.find(f => f.name === n) || FOODS[0];
    const list = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let d = 365; d >= 0; d--) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const n = d === 0 ? 3 : 3 + (rnd() > .5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const f = food(pick[Math.floor(rnd() * pick.length)]), q = .8 + rnd() * .6, at = new Date(date); at.setHours([8, 13, 16, 19][i], 10);
        list.push({ id: `demo-d${d}-${i}`, demo: true, day: ymd(date), at: at.getTime(), name: f.name, portion: 'Medium plate', meal: mealOf(at.getHours()), ...scale(f, d === 0 ? 1 : q) });
      }
    }
    return (demoCache = { day, list: list.reverse() }).list;
  }
  const log = () => (demo() ? demoLog() : real());
  const dayTotals = day => sum(log().filter(e => e.day === day));
  const onTarget = day => { const t = dayTotals(day), g = goals(); return KEYS.every(k => Math.abs(t[k] - g[k]) <= g[k] * .1); };
  function streak() {
    const d = new Date();
    if (!onTarget(ymd(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (n < 3650 && onTarget(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function addEntry(name, macros, portion, extra = {}) {
    const now = new Date();
    Personal.setKv('diet.log', [{ id: crypto.randomUUID(), day: today(), at: now.getTime(), name, portion, meal: mealOf(now.getHours()), ...macros, ...extra }, ...real()]);
    Personal.logActivity('Fitness/Diet', `Logged ${name}`);
  }
  const removeEntry = id => Personal.setKv('diet.log', real().filter(e => e.id !== id));

  // ---------- Page ----------
  let root = null, page = 0, paging = false, hist = 'week';
  function mount(el) {
    if (root !== el) { root = el; bind(); }
    render();
  }
  Personal.subscribe(() => root && !root.hidden && !document.querySelector('.dt-modal') && render());

  function render() {
    const t = dayTotals(today()), g = goals(), isDemo = demo(), todays = log().filter(e => e.day === today()).sort((a, b) => b.at - a.at);
    const pctOf = k => Math.min(100, Math.round(t[k] / g[k] * 100));
    const row = ([k, label, u]) => `<div class="fx-nut${Math.abs(t[k] - g[k]) <= g[k] * .1 ? ' hit' : ''}"><div class="pj-row"><span>${label}</span><span class="pj-spacer"></span><span class="p">${t[k].toLocaleString()} / ${g[k].toLocaleString()} ${u}</span></div><div class="prog"><b style="width:${pctOf(k)}%"></b></div></div>`;
    root.innerHTML = `<div class="lg-pages"><div class="lg-track" style="transform:translateY(${-page * 100}%)">
      <div class="lg-page"><div class="fx-wrap">
        <div class="fx-stats st-row">${F.streakBadge(streak(), 'day on-target streak', 'hit every goal within 10% to light it up')}
          ${F.stat(`${t.kcal.toLocaleString()}<small>/${g.kcal.toLocaleString()}</small>`, 'Calories today')}${F.stat(`${t.protein}<small> g</small>`, 'Protein today')}${F.stat(todays.length, 'Meals today')}
          <div class="dt-actions"><button class="tile pj-btn" data-addmeal>+ Add meal</button><button class="tile pj-btn primary" data-logmeal>+ Log meal</button></div></div>
        <div class="fx-grid three">
          <section class="tile fx-card fx-radar-card dt-nutrients">
            <div class="fx-h"><h3>Nutrients today</h3>${isDemo ? F.demoTag : ''}</div>
            ${F.radar(N.slice(1).map(([k, l]) => [l, pctOf(k)]), { size: 300, label: 'Nutrients' })}
            <div class="fx-nuts">${N.map(row).join('')}</div>
          </section>
          <div class="fx-col">
            <section class="tile fx-card fx-fill"><div class="fx-h"><h3>Calories</h3></div>
              <div class="fx-calrow"><div class="fx-cal">${F.ringSvg(pctOf('kcal'))}<div class="fx-cal-in"><b>${Math.max(0, g.kcal - t.kcal).toLocaleString()}</b><span>kcal left</span></div></div>
                <div class="fx-calnums"><div><b>${t.kcal.toLocaleString()}</b><span class="p">eaten</span></div><div><b>${g.kcal.toLocaleString()}</b><span class="p">goal</span></div><div><b>${KEYS.filter(k => Math.abs(t[k] - g[k]) <= g[k] * .1).length}/7</b><span class="p">on target</span></div></div></div></section>
            <section class="tile fx-card fx-fill"><div class="fx-h"><h3>Your meals</h3></div>
              <div class="fx-list" data-fit>${myMeals().map(m => `<div class="tile fx-meal dt-quick" data-quick="${m.id}"><div><div class="it">${esc(m.name)}</div><div class="p">${m.kcal} kcal · ${m.protein} g protein</div></div><span class="pj-spacer"></span><span class="chip">Log</span></div>`).join('') || '<div class="p">Meals you create with <b>Add meal</b> show up here for one-tap logging.</div>'}</div></section>
          </div>
          <section class="tile fx-card"><div class="fx-h"><h3>Meals today</h3></div>
            <div class="fx-list" data-fit>${todays.map(e => `<div class="tile fx-meal fx-meal-col"><div class="pj-row"><div><div class="it">${esc(e.name)}</div><div class="p">${e.meal} · ${e.portion}</div></div><span class="pj-spacer"></span><div class="fx-kcal"><b>${e.kcal}</b><span class="p">kcal · ${e.protein} g protein</span></div>${e.demo ? '' : `<button class="pj-x" data-rmentry="${e.id}" title="Remove">×</button>`}</div></div>`).join('') || '<div class="p">Nothing logged yet today. Tap <b>Log meal</b>.</div>'}</div>
            <div class="fx-total p">${Math.max(0, g.kcal - t.kcal).toLocaleString()} kcal left today · Total <b>${t.kcal.toLocaleString()} kcal</b></div></section>
        </div></div>
        <button class="lg-next" data-dtpage="1">Eating history ↓</button></div>
      <div class="lg-page" id="dtHist">${historyPage()}<button class="lg-next up" data-dtpage="0">↑ myDiet</button></div>
    </div></div>`;
  }

  // ---------- History page ----------
  const HIST = [['week', 'Week'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All']];
  function historyPage() {
    const days = {};
    log().forEach(e => ((days[e.day] ||= []).push(e)));
    const keys = Object.keys(days).sort();
    if (!keys.length) return `<div class="ls-wrap"><section class="tile fx-card ls-empty">${F.emptyCard('No eating history yet', 'Log meals and your history builds up here.')}</section></div>`;
    const totalFor = d => sum(days[d]);
    const fmt = at => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let pts;
    if (hist === 'week') pts = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = ymd(d); return { at: d.getTime(), v: days[k] ? totalFor(k).kcal : 0, note: days[k] ? `${days[k].length} meals` : 'nothing logged' }; });
    else {
      const span = hist === 'quarter' ? 91 : hist === 'year' ? 365 : Infinity, bucket = hist === 'all' && keys.length > 400 ? 30 : 7, groups = {};
      keys.filter(k => new Date(k + 'T12:00') >= Date.now() - span * 864e5).forEach(k => { const at = new Date(k + 'T12:00').getTime(), b = Math.floor(at / (bucket * 864e5)); (groups[b] ||= []).push(totalFor(k).kcal); });
      pts = Object.entries(groups).map(([b, v]) => ({ at: +b * bucket * 864e5, v: Math.round(v.reduce((a, x) => a + x, 0) / v.length), note: `avg of ${v.length} day${v.length === 1 ? '' : 's'}` }));
    }
    const span = hist === 'week' ? 7 : hist === 'quarter' ? 91 : hist === 'year' ? 365 : 1e6;
    const inRange = keys.filter(k => new Date(k + 'T12:00') >= Date.now() - span * 864e5), tot = inRange.map(totalFor);
    const avg = k => (tot.length ? Math.round(tot.reduce((a, x) => a + x[k], 0) / tot.length) : 0);
    const hit = inRange.filter(onTarget).length;
    const counts = {};
    log().filter(e => inRange.includes(e.day)).forEach(e => (counts[e.name] = (counts[e.name] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return `<div class="ls-wrap">
      <aside class="tile fx-card ls-list"><div class="fx-h"><h3>Most eaten</h3>${demo() ? F.demoTag : ''}</div>
        <div class="fx-list" data-fit>${top.map(([n, c]) => `<div class="ls-item"><span>${esc(n)}</span><span class="p">${c}×</span></div>`).join('')}</div></aside>
      <section class="tile fx-card ls-main">
        <div class="fx-h"><h3>Eating history</h3><div class="td-seg ls-seg">${HIST.map(([k, l]) => `<button class="${hist === k ? 'on' : ''}" data-hist="${k}">${l}</button>`).join('')}</div></div>
        <div class="ls-chartwrap"><span class="ls-unit tip" data-tip="${hist === 'week' ? 'Calories each day' : 'Average calories per day'}">KCAL</span>${F.lineChart(pts, 'v', 'kcal', hist === 'week' ? 'Calories' : 'Avg calories', hist === 'week' ? at => new Date(at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : fmt)}<div class="ls-tip" hidden></div></div>
        <div class="ls-stats">${[[`${avg('kcal').toLocaleString()} <small>kcal</small>`, 'Avg calories / day'], [`${avg('protein')} <small>g</small>`, 'Avg protein'], [`${avg('carbs')} <small>g</small>`, 'Avg carbs'], [`${avg('sugar')} <small>g</small>`, 'Avg sugar'],
          [`${hit}<small>/${inRange.length}</small>`, 'Days on target'], [`${avg('sodium').toLocaleString()} <small>mg</small>`, 'Avg sodium']].map(([v, l]) => `<div class="ls-stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      </section></div>`;
  }

  // Page glide (same feel as myLifting): one scroll = one whole page, can't be interrupted
  function setPage(i) {
    const track = root.querySelector('.lg-track');
    i = Math.max(0, Math.min(1, i));
    if (!track || i === page || paging) return;
    page = i; paging = true; window.crumbChanged?.();
    track.style.willChange = 'transform';
    track.style.transition = 'transform .8s cubic-bezier(.65,0,.35,1)';
    track.style.transform = `translateY(${-i * 100}%)`;
    setTimeout(() => { track.style.willChange = ''; setTimeout(() => (paging = false), 450); }, 820);
  }

  // ---------- Modals ----------
  function modal(cls = '') {
    const wrap = document.createElement('div');
    wrap.className = 'pj-overlay';
    wrap.innerHTML = `<div class="pj-modal glass lg-modal dt-modal ${cls}"></div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('on'));
    const close = () => { wrap.classList.remove('on'); setTimeout(() => { wrap.remove(); if (root) render(); }, 250); };
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
    return { box: wrap.firstChild, close };
  }
  const toast = (box, text) => { const t = box.querySelector('.dt-toast'); if (!t) return; t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); };
  const results = (q, opts = {}) => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean), match = f => words.every(w => f.name.toLowerCase().includes(w) || (f.cat || '').toLowerCase().includes(w));
    const mine = myMeals().map(m => ({ ...m, kind: 'plate', mine: true, serving: 'your meal' }));
    const recentNames = [...new Set(real().map(e => e.name))].slice(0, 12), recent = recentNames.map(n => FOODS.find(f => f.name === n)).filter(Boolean);
    if (!words.length) return [...mine, ...recent, ...FOODS.filter(f => !f.combo).slice(0, 30)].slice(0, opts.limit || 40);
    return [...mine.filter(match), ...FOODS.filter(match).sort((a, b) => a.name.length - b.name.length)].slice(0, opts.limit || 40);
  };
  const foodRow = (f, i) => `<div class="tile dt-food" data-i="${i}"><div><div class="it">${esc(f.name)}${f.mine ? ' <span class="chip">My meal</span>' : ''}</div><div class="p">${f.serving} · ${f.kcal} kcal · ${f.protein} g protein</div></div>
    <div class="dt-portions">${PORTIONS[f.kind || 'plate'].map(([l, q]) => `<button class="td-toggle" data-q="${q}" data-l="${l}">${l}</button>`).join('')}</div></div>`;

  // Log meal: search (or pick a recent / your meal), tap a portion — logged. Smoothies open the builder.
  function logMeal(prefill = '') {
    const { box, close } = modal();
    let list = [];
    box.innerHTML = `<div class="pj-row"><h3>Log meal</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
      <input class="pj-in" id="dtQ" placeholder="Search ${(FOODS.length + myMeals().length).toLocaleString()} meals" value="${esc(prefill)}" autocomplete="off">
      <div class="dt-results"></div><div class="pj-row end"><span class="dt-toast p"></span><span class="pj-spacer"></span><button class="tile pj-btn primary" data-x>Done</button></div>`;
    const draw = () => {
      const q = box.querySelector('#dtQ').value;
      // 'Build a smoothie' is just one of the options: shown up top when the search is empty or matches it
      const words = q.toLowerCase().split(/\s+/).filter(Boolean), sm = words.every(w => 'build a smoothie shake blend'.includes(w));
      list = results(q);
      const smRow = sm ? `<div class="tile dt-food dt-smoothie" data-smoothie><div><div class="it">Build a smoothie</div><div class="p">Pick a size, tap ingredients, done</div></div><span class="chip">Open</span></div>` : '';
      box.querySelector('.dt-results').innerHTML = (smRow + list.map(foodRow).join('')) || '<div class="p">No matches. Try another word, or use <b>Add meal</b> to create it.</div>';
    };
    box.addEventListener('input', e => e.target.id === 'dtQ' && draw());
    box.addEventListener('click', e => {
      const t = e.target.closest('button, [data-smoothie]');
      if (!t) return;
      if ('x' in t.dataset) return close();
      if ('smoothie' in t.dataset) { box.closest('.pj-overlay').remove(); return smoothie(); }
      if (t.dataset.q) {
        const f = list[+t.closest('[data-i]').dataset.i];
        addEntry(f.name, scale(f, +t.dataset.q), t.dataset.l);
        toast(box, `✓ Logged ${f.name} (${t.dataset.l})`);
      }
    });
    draw();
    box.querySelector('#dtQ').focus();
  }

  // Smoothie builder: size → tap ingredients → pick S / M / L for each → log. Macros add up automatically.
  function smoothie() {
    const { box, close } = modal('dt-wide');
    let size = SIZES[2], picked = [], choosing = null;
    const totals = () => sum(picked.map(p => scale(p.part.food, p.part.q * p.q * size[1])));
    const draw = () => {
      const t = totals();
      box.innerHTML = `<div class="pj-row"><h3>Build a smoothie</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
        <div class="tm-gh">Size</div><div class="td-seg dt-sizes">${SIZES.map(s => `<button class="${s === size ? 'on' : ''}" data-size="${s[0]}">${s[0]}</button>`).join('')}</div>
        ${choosing == null
          ? `<div class="tm-gh">Ingredients · tap to add</div>
        <div class="dt-parts">${SMOOTHIE_PARTS.map((p, i) => `<button class="tile dt-part" data-part="${i}">${p.label}</button>`).join('')}</div>`
          : `<div class="tm-gh">How much ${SMOOTHIE_PARTS[choosing].label.toLowerCase()}?</div>
        <div class="dt-choose"><button class="tile pj-btn" data-back>← Back</button>${PART.map(([s, q, l]) => `<button class="tile pj-btn dt-size" data-pq="${q}">${l}</button>`).join('')}</div>`}
        <div class="tm-gh">Your smoothie</div>
        <div class="dt-picked">${picked.map((p, i) => `<span class="chip dt-chip">${p.part.label} · ${p.label}<button class="pj-x" data-unpick="${i}">×</button></span>`).join('') || '<span class="p">Nothing added yet</span>'}</div>
        <div class="dt-macros">${N.map(([k, l, u]) => `<div><b>${t[k].toLocaleString()}</b><span>${l}${u === 'kcal' ? '' : ' (' + u + ')'}</span></div>`).join('')}</div>
        <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn primary" data-logs ${picked.length ? '' : 'disabled'}>Log ${size[0]} smoothie</button></div>`;
    };
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if (d.size) size = SIZES.find(s => s[0] === d.size);
      if (d.part) choosing = +d.part; // ingredients step aside so you just pick its size
      if ('back' in d) choosing = null; // misclicked: back to the ingredient list
      if (d.pq) { const [, q, l] = PART.find(p => p[1] === +d.pq); picked.push({ part: SMOOTHIE_PARTS[choosing], q, label: l }); choosing = null; }
      if (d.unpick) picked.splice(+d.unpick, 1);
      if ('logs' in d) { addEntry(`Smoothie (${size[0]})`, totals(), size[0], { items: picked.map(p => `${p.part.label} (${p.label})`) }); return close(); }
      draw();
    });
    draw();
  }

  // Add meal: name it, add ingredients from the library with portions (macros add up), or type the macros yourself
  function addMeal() {
    const { box, close } = modal('dt-wide');
    let name = '', ings = [], manual = {}, list = [];
    const auto = () => sum(ings.map(i => scale(i.f, i.q)));
    const val = k => (k in manual ? manual[k] : auto()[k]);
    const draw = () => {
      box.innerHTML = `<div class="pj-row"><h3>Add meal</h3><span class="pj-spacer"></span><button class="pj-x" data-x>×</button></div>
        <input class="pj-in" id="mName" placeholder="Meal name (e.g. Post-workout bowl)" value="${esc(name)}">
        <div class="dt-addcols"><div>
          <div class="tm-gh">Ingredients</div>
          <input class="pj-in" id="mQ" placeholder="Add an ingredient…" autocomplete="off">
          <div class="dt-results sm"></div>
          <div class="dt-picked">${ings.map((x, i) => `<span class="chip dt-chip">${esc(x.f.name)} · ${x.l}<button class="pj-x" data-unpick="${i}">×</button></span>`).join('') || '<span class="p">No ingredients yet — or just type the numbers on the right</span>'}</div>
        </div><div>
          <div class="tm-gh">Nutrition ${Object.keys(manual).length ? '<button class="td-toggle" data-reset>reset to ingredients</button>' : '(adds up from ingredients)'}</div>
          <div class="dt-fields">${N.map(([k, l, u]) => `<label class="tm-field"><span>${l} (${u})</span><input class="pj-in" type="number" min="0" data-m="${k}" value="${val(k)}"></label>`).join('')}</div>
        </div></div>
        <div class="pj-row end"><button class="tile pj-btn" data-x>Cancel</button><button class="tile pj-btn" data-save>Save meal</button><button class="tile pj-btn primary" data-savelog>Save & log now</button></div>`;
      drawResults();
    };
    const drawResults = () => {
      const q = box.querySelector('#mQ')?.value || '';
      list = q ? results(q, { limit: 12 }).filter(f => !f.mine) : [];
      box.querySelector('.dt-results').innerHTML = list.map(foodRow).join('');
    };
    box.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'mName') name = t.value;
      if (t.id === 'mQ') drawResults();
      if (t.dataset.m) manual[t.dataset.m] = +t.value || 0;
    });
    box.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      const d = t.dataset;
      if ('x' in d) return close();
      if (d.q) { ings.push({ f: list[+t.closest('[data-i]').dataset.i], q: +d.q, l: d.l }); const keep = name; draw(); name = keep; box.querySelector('#mQ').focus(); return; }
      if (d.unpick) { ings.splice(+d.unpick, 1); return draw(); }
      if ('reset' in d) { manual = {}; return draw(); }
      if ('save' in d || 'savelog' in d) {
        if (!name.trim()) return box.querySelector('#mName').focus();
        const macros = Object.fromEntries(KEYS.map(k => [k, Math.round(val(k))]));
        const meal = { id: crypto.randomUUID(), name: name.trim(), ingredients: ings.map(x => `${x.f.name} (${x.l})`), ...macros };
        Personal.setKv('diet.meals', [meal, ...myMeals()]);
        if ('savelog' in d) addEntry(meal.name, macros, 'Medium plate');
        close();
      }
    });
    draw();
    box.querySelector('#mName').focus();
  }

  function bind() {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-logmeal],[data-addmeal],[data-quick],[data-rmentry],[data-dtpage],[data-hist]');
      if (!t) return;
      const d = t.dataset;
      if ('logmeal' in d) logMeal();
      else if ('addmeal' in d) addMeal();
      else if (d.quick) { const m = myMeals().find(x => x.id === d.quick); addEntry(m.name, Object.fromEntries(KEYS.map(k => [k, m[k]])), 'Medium plate'); }
      else if (d.rmentry) removeEntry(d.rmentry);
      else if (d.dtpage) setPage(+d.dtpage);
      else if (d.hist) { hist = d.hist; root.querySelector('#dtHist').innerHTML = historyPage() + '<button class="lg-next up" data-dtpage="0">↑ myDiet</button>'; }
    });
    root.addEventListener('wheel', e => {
      const l = e.target.closest('.fx-list, .ls-items');
      if (l && l.scrollHeight > l.clientHeight + 1 && (e.deltaY < 0 ? l.scrollTop > 0 : l.scrollTop + l.clientHeight < l.scrollHeight - 1)) return;
      e.preventDefault();
      if (!paging && Math.abs(e.deltaY) >= 4) setPage(page + Math.sign(e.deltaY));
    }, { passive: false });
  }

  const showHistory = () => { go('Fitness/Diet'); requestAnimationFrame(() => setPage(1)); };
  const onHistory = () => page === 1 && !document.documentElement.classList.contains('phone');
  const toMain = () => setPage(0);
  return { onHistory, toMain, mount, logMeal, addMeal, smoothie, showHistory, myMeals };
})();
